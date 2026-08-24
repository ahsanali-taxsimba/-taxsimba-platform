"""Cross-cutting request protections: security headers, general API rate limiting and
request-scoped logging that never records credentials or personal data.
"""
import hashlib
import os
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from db import db
from ratelimit import client_ip

# Per-caller request ceiling for the whole API. Generous for real use, cheap protection against
# scraping and credential/enumeration sweeps. Login has its own stricter lockout policy.
WINDOW_SECONDS = 60
MAX_REQUESTS = int(os.environ.get("API_RATE_LIMIT_PER_MINUTE", "300"))

SENSITIVE = ("password", "token", "secret", "code", "otp", "utr")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy",
                                    "geolocation=(), microphone=(), camera=(), payment=()")
        response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        response.headers.setdefault("Strict-Transport-Security",
                                    "max-age=31536000; includeSubDomains")
        # API responses are data, never documents -- nothing may be framed or executed.
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; "
            "img-src 'self' data:; style-src 'unsafe-inline'")
        response.headers.setdefault("X-Request-ID", getattr(request.state, "request_id",
                                                            str(uuid.uuid4())))
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.request_id = str(uuid.uuid4())
        # Prefer the caller's identity: the ingress can present several source addresses for
        # one client, so an IP-only key under-counts. Falls back to the spoof-proof IP.
        token = request.headers.get("authorization") or request.cookies.get("access_token") or ""
        key = hashlib.sha256(token.encode()).hexdigest()[:32] if token else client_ip(request)
        # Counted in MongoDB rather than in process memory so the ceiling holds across every
        # replica the ingress may route to.
        now = datetime.now(timezone.utc)
        bucket = int(now.timestamp() // WINDOW_SECONDS)
        try:
            doc = await db.api_rate_buckets.find_one_and_update(
                {"key": key, "bucket": bucket},
                {"$inc": {"count": 1},
                 "$setOnInsert": {"expires_at": now + timedelta(seconds=WINDOW_SECONDS * 3)}},
                upsert=True, return_document=True)
            count = (doc or {}).get("count", 1)
        except Exception:
            count = 0  # never let the limiter take the API down
        if count > MAX_REQUESTS:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests — please slow down"},
                headers={"Retry-After": str(WINDOW_SECONDS)})
        return await call_next(request)


async def ensure_indexes():
    await db.api_rate_buckets.create_index([("key", 1), ("bucket", 1)], unique=True)
    await db.api_rate_buckets.create_index("expires_at", expireAfterSeconds=0)


# ------------------------------------------------------------------- upload validation
ALLOWED_UPLOAD_TYPES = {
    "application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif",
    "text/csv", "text/plain",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel", "application/msword",
}
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_MB", "25")) * 1024 * 1024


def safe_filename(name: str) -> str:
    """Strips any path component and anything that could be interpreted by a shell or path."""
    base = (name or "file").replace("\\", "/").split("/")[-1]
    cleaned = "".join(c for c in base if c.isalnum() or c in " ._-()").strip()
    return (cleaned or "file")[:120]


def validate_upload(content_type: str, size: int, filename: str) -> str:
    if size > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413,
                            detail=f"Files must be {MAX_UPLOAD_BYTES // (1024 * 1024)}MB or smaller")
    if not size:
        raise HTTPException(status_code=400, detail="The file appears to be empty")
    if (content_type or "").split(";")[0].strip().lower() not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type. Please upload a PDF, image, CSV, Word or Excel file")
    return safe_filename(filename)
