"""Login rate limiting + temporary account lockout (MongoDB-backed, TTL expiry).

Only genuine credential failures (unknown email / wrong password) are counted. A correct
password on a disabled account is not a guess and is never counted. Locks are temporary
and lift automatically; there is no permanent lock and no admin unlock.
"""
import ipaddress
import os
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException, Request

from db import db

# --- policy ----------------------------------------------------------------
WINDOW_MINUTES = 15
SCOPES = {
    # scope: (max_failures, base_lock_minutes)
    "ip_email": (5, 15),
    "account": (10, 15),
    "ip": (50, 15),
}
BACKOFF_MINUTES = [15, 30, 60]  # 1st, 2nd, 3rd+ offence (capped at 60)


def _trusted_networks():
    raw = os.environ["TRUSTED_PROXY_CIDRS"]
    return [ipaddress.ip_network(c.strip()) for c in raw.split(",") if c.strip()]


def client_ip(request: Request) -> str:
    """Real client IP.

    X-Forwarded-For is honoured ONLY when the immediate peer is a trusted proxy/ingress,
    and then only its right-most entry is used -- that value is appended by the trusted
    proxy itself, so an arbitrary internet client cannot spoof it by sending its own
    X-Forwarded-For header.
    """
    peer = request.client.host if request.client else "unknown"
    try:
        peer_addr = ipaddress.ip_address(peer)
    except ValueError:
        return peer
    if not any(peer_addr in net for net in _trusted_networks()):
        return peer
    xff = request.headers.get("x-forwarded-for", "")
    hops = [h.strip() for h in xff.split(",") if h.strip()]
    return hops[-1] if hops else peer


def _keys(ip: str, email: str):
    return [("ip_email", f"{ip}|{email}"), ("account", email), ("ip", ip)]


def _lock_minutes(offences: int) -> int:
    return BACKOFF_MINUTES[min(offences, len(BACKOFF_MINUTES)) - 1] if offences > 0 else BACKOFF_MINUTES[0]


async def ensure_indexes():
    await db.login_attempts.create_index([("scope", 1), ("key", 1)], unique=True)
    await db.login_attempts.create_index("expires_at", expireAfterSeconds=0)
    await db.refresh_tokens.create_index("jti", unique=True)
    await db.refresh_tokens.create_index("expires_at", expireAfterSeconds=0)
    try:
        await db.users.create_index("email", unique=True)
    except Exception as e:  # pre-existing duplicates must not block startup
        print(f"users.email unique index skipped: {e}")


async def enforce_login_allowed(ip: str, email: str):
    """Raise 429 with Retry-After if any scope is currently locked."""
    now = datetime.now(timezone.utc)
    for scope, key in _keys(ip, email):
        doc = await db.login_attempts.find_one({"scope": scope, "key": key})
        if not doc or not doc.get("locked_until"):
            continue
        until = doc["locked_until"]
        if until.tzinfo is None:
            until = until.replace(tzinfo=timezone.utc)
        if until > now:
            retry = max(1, int((until - now).total_seconds()))
            raise HTTPException(
                status_code=429,
                detail="Too many failed login attempts. This account is temporarily locked. "
                       f"Try again in {max(1, retry // 60)} minute(s).",
                headers={"Retry-After": str(retry)},
            )


async def record_failure(ip: str, email: str):
    now = datetime.now(timezone.utc)
    for scope, key in _keys(ip, email):
        limit, _ = SCOPES[scope]
        doc = await db.login_attempts.find_one({"scope": scope, "key": key})
        window_start = doc.get("window_start") if doc else None
        if window_start and window_start.tzinfo is None:
            window_start = window_start.replace(tzinfo=timezone.utc)
        fresh = not doc or not window_start or (now - window_start) > timedelta(minutes=WINDOW_MINUTES)
        count = 1 if fresh else doc.get("count", 0) + 1
        offences = 0 if fresh else doc.get("offences", 0)
        update = {
            "scope": scope, "key": key, "count": count, "offences": offences,
            "window_start": now if fresh else window_start,
            "last_failure_at": now,
            "expires_at": now + timedelta(days=1),
        }
        if count >= limit:
            offences += 1
            mins = _lock_minutes(offences)
            update.update({
                "count": 0, "offences": offences, "window_start": now,
                "locked_until": now + timedelta(minutes=mins),
                "expires_at": now + timedelta(minutes=mins) + timedelta(days=1),
            })
        await db.login_attempts.update_one({"scope": scope, "key": key}, {"$set": update}, upsert=True)


async def clear_failures(ip: str, email: str):
    """A successful login clears the applicable counters (locks are never bypassed --
    enforce_login_allowed runs before the password is ever checked)."""
    for scope, key in _keys(ip, email):
        await db.login_attempts.delete_one({"scope": scope, "key": key})
