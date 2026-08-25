import os
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse
from typing import Optional, List

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response as FastResponse
from pydantic import BaseModel, EmailStr

from auth import (ACCESS_COOKIE, ACCESS_TTL_MINUTES, REFRESH_COOKIE, REFRESH_TTL_DAYS,
                  create_access_token, get_current_user, hash_password, is_admin, is_staff,
                  issue_refresh_token, require_roles, revoke_refresh_token,
                  rotate_refresh_token, verify_password)
from db import clean, clean_many, db, mask_contact_many, scrub, scrub_many
from helpcentre import DEFAULT_FAQS, FAQ_CATEGORIES
from protections import (RateLimitMiddleware, SecurityHeadersMiddleware, validate_upload)
from protections import ensure_indexes as ensure_rate_indexes
from security import (MFA_REQUIRED_ROLES, check_password_strength, consume_challenge,
                      create_challenge, decrypt_secret, encrypt_secret,
                      generate_recovery_codes, match_recovery_code, new_secret,
                      verify_code)
from security import ensure_indexes as ensure_mfa_indexes
from testdata import OPERATIONAL_ONLY, TEST_EMAIL_REGEX, is_test_email
from invites import consume_invite, find_valid_invite, issue_invite
from ratelimit import (clear_failures, client_ip, enforce_login_allowed, ensure_indexes,
                       record_failure)
from seed import seed
from phase1b import bootstrap_client_services, ensure_phase1b_data, router as phase1b_router
from mtd import router as mtd_router
from storage import init_storage, put_object, get_object, APP_NAME
from workflow import (ALLOWED_TRANSITIONS, STATUSES, STATUS_META, client_status,
                      deadline_for_tax_year, journey, log_activity, notify, now_iso,
                      payment_deadline_label, transition)

app = FastAPI(title="TaxSimba")
api = APIRouter(prefix="/api")

CSRF_COOKIE = "csrf_token"


def _allowed_origins() -> List[str]:
    """Explicit allowlist only. A wildcard or empty value is a hard startup failure so the
    permissive '*' configuration can never silently return.

    CORS_ORIGINS holds the official production domains. CORS_DEV_ORIGINS holds the separate
    preview/development origins and can be emptied for a production deployment without
    touching the production list.
    """
    raw = os.environ.get("CORS_ORIGINS", "")
    dev = os.environ.get("CORS_DEV_ORIGINS", "")
    prod_origins = [o.strip() for o in raw.split(",") if o.strip()]
    dev_origins = [o.strip() for o in dev.split(",") if o.strip()]
    if not prod_origins:
        raise RuntimeError("CORS_ORIGINS must list at least one approved origin")
    origins = prod_origins + [o for o in dev_origins if o not in prod_origins]
    if any(o == "*" for o in origins):
        raise RuntimeError("CORS_ORIGINS must not contain a wildcard '*'")
    return origins


ALLOWED_ORIGINS = _allowed_origins()

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await seed()
    await ensure_phase1b_data()
    await ensure_indexes()
    await _seed_faqs()
    await ensure_mfa_indexes()
    await ensure_rate_indexes()
    await ensure_query_indexes()
    try:
        init_storage()
    except Exception as e:
        print(f"storage init failed: {e}")


async def ensure_query_indexes():
    """Indexes for every hot query path. Without these each list endpoint scans the whole
    collection, which is what makes a large client base feel slow."""
    plans = {
        "cases": ["client_user_id", "assigned_accountant_id", "status", "is_test",
                  "internal_deadline", "client_id"],
        "documents": ["case_id", "client_user_id", "is_internal", "is_deleted"],
        "tasks": ["case_id", "status", "owner_id", "client_user_id"],
        "messages": ["case_id", "created_at"],
        "notifications": ["user_id", "read_at", "created_at"],
        "activity_logs": ["case_id", "created_at", "user_name"],
        "payment_transactions": ["user_id", "client_id", "kind", "payment_status",
                                 "session_id", "created_at"],
        "clients": ["user_id", "is_test", "client_ref"],
        "client_services": ["client_id", "service_type", "status"],
        "calculation_versions": ["case_id"],
        "document_requests": ["case_id", "status"],
        "case_notes": ["case_id"],
        "recommendations": ["case_id", "status", "type"],
        "invoices": ["payment_request_id", "client_user_id", "case_id"],
        "staff_invites": ["user_id", "token_hash"],
        "users": ["role", "is_test", "created_at"],
    }
    for collection, fields in plans.items():
        for field in fields:
            try:
                await db[collection].create_index(field)
            except Exception as e:
                print(f"index {collection}.{field} skipped: {e}")


async def _seed_faqs():
    """Seed Help Centre content. The default answers are the canonical wording, so they are
    kept in step on start-up; admin-authored FAQs are untouched."""
    for order, (category, question, answer) in enumerate(DEFAULT_FAQS):
        await db.faqs.update_one(
            {"question": question},
            {"$set": {"category": category, "answer": answer, "order": order,
                      "is_active": True},
             "$setOnInsert": {"id": str(uuid.uuid4()), "question": question,
                              "created_at": now_iso()}},
            upsert=True)


# ---------------------------------------------------------------- schemas
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None


class CreateUserIn(RegisterIn):
    role: str


class StaffInviteIn(BaseModel):
    name: str
    email: str
    role: str = "ACCOUNTANT"
    specialisms: list[str] = ["SELF_ASSESSMENT"]
    capacity: Optional[int] = None


class AcceptInviteIn(BaseModel):
    password: str


class CaseIn(BaseModel):
    client_user_id: Optional[str] = None
    tax_year: str = "2024/25"
    service_type: str = "SELF_ASSESSMENT"


class AssignIn(BaseModel):
    accountant_id: str
    priority: str = "MEDIUM"
    internal_deadline: Optional[str] = None
    internal_instructions: Optional[str] = None


class RequestIn(BaseModel):
    request_type: str = "DOCUMENT"
    title: str
    description: str = ""
    document_required: bool = True
    mandatory: bool = False
    due_date: Optional[str] = None
    message: str = ""


class CalcIn(BaseModel):
    total_income: float
    taxable_income: float
    tax_due: float
    is_refund: bool = False
    notes: str = ""
    payment_deadline: Optional[str] = None
    breakdown: Optional[dict] = None


class ChecklistIn(BaseModel):
    calculation_version_id: str
    checklist: dict
    admin_note: Optional[str] = None


class SubmissionIn(BaseModel):
    submission_date: str
    submission_reference: str
    provider: Optional[str] = None
    evidence_document_id: Optional[str] = None
    note: Optional[str] = None


class ReasonIn(BaseModel):
    reason: str


class ApproveIn(BaseModel):
    note: Optional[str] = None


class ReturnChangesIn(BaseModel):
    reason: str
    instructions: str


class MessageIn(BaseModel):
    case_id: str
    body: str
    recipient_id: Optional[str] = None


class NoteIn(BaseModel):
    body: str


# ---------------------------------------------------------------- auth
def _cookie_kwargs() -> dict:
    """Session cookie security controls. Secure/SameSite are environment-configurable so a
    same-site production deployment can tighten SameSite without a code change."""
    return {
        "httponly": True,
        "secure": os.environ["COOKIE_SECURE"].lower() == "true",
        "samesite": os.environ["COOKIE_SAMESITE"].lower(),
        "path": "/",
    }


def _set_session_cookies(response: Response, access: str, refresh: str):
    kw = _cookie_kwargs()
    response.set_cookie(ACCESS_COOKIE, access, max_age=ACCESS_TTL_MINUTES * 60, **kw)
    response.set_cookie(REFRESH_COOKIE, refresh, max_age=REFRESH_TTL_DAYS * 86400, **kw)
    # The CSRF token is deliberately readable by page script -- that is how the double-submit
    # pattern works. It is not an authentication credential and grants no access on its own.
    response.set_cookie(CSRF_COOKIE, secrets.token_urlsafe(32),
                        max_age=REFRESH_TTL_DAYS * 86400, **{**kw, "httponly": False})


def _is_browser(request: Request) -> bool:
    """Browsers always send Origin on POST and Sec-Fetch-* on fetch/XHR. Non-browser API
    and CLI clients send neither."""
    return bool(request.headers.get("origin") or request.headers.get("sec-fetch-mode"))


def _norm_origin(value: str) -> str:
    return value.strip().rstrip("/").lower()


def _self_origins(request: Request) -> set:
    """Origins that represent this application itself.

    The ingress/edge may rewrite the inbound Origin to an internal cluster hostname while
    preserving the public one in X-Forwarded-Host, so a genuine same-origin request can
    legitimately arrive with either. Host headers are set by the trusted proxy, and Origin is
    set by the browser and cannot be spoofed by page script, so comparing the two is a sound
    same-origin test: a third-party page always sends its own (non-matching) Origin.
    """
    scheme = request.headers.get("x-forwarded-proto") or request.url.scheme
    hosts = {request.headers.get("host"), request.headers.get("x-forwarded-host")}
    return {_norm_origin(f"{scheme}://{h}") for h in hosts if h}


def _enforce_csrf(request: Request):
    """CSRF defence for cookie-authenticated state-changing endpoints.

    The session lives in cookies, so a cross-origin page could otherwise make the browser
    POST these endpoints with the victim's cookies attached. Three independent checks are
    applied, because this deployment sits behind an edge proxy that REWRITES the inbound
    Origin header to its own hostname -- Origin alone is therefore not a trustworthy signal
    here, while Sec-Fetch-Site and Referer are passed through untouched.

      1. Sec-Fetch-Site: set by the browser and not settable by page script. Anything other
         than same-origin/none is refused.
      2. Referer: must match the CORS allowlist or this application's own origin.
      3. Double-submit token: the X-CSRF-Token header must equal the csrf_token cookie. A
         third-party origin cannot read that cookie, so it cannot forge a matching header.
         This check is proxy-independent and is the primary defence.

    A request carrying none of these browser markers cannot originate from a browser
    document and so cannot be a CSRF vector; non-browser API/CLI clients are unaffected.
    """
    permitted = {_norm_origin(o) for o in ALLOWED_ORIGINS} | _self_origins(request)

    fetch_site = request.headers.get("sec-fetch-site")
    if fetch_site and fetch_site.lower() not in ("same-origin", "none"):
        raise HTTPException(status_code=403, detail="Cross-origin request rejected")

    referer = request.headers.get("referer")
    if referer:
        parsed = urlparse(referer)
        if _norm_origin(f"{parsed.scheme}://{parsed.netloc}") not in permitted:
            raise HTTPException(status_code=403, detail="Cross-origin request rejected")

    is_browser = bool(fetch_site or referer or request.headers.get("origin")
                      or request.headers.get("sec-fetch-mode"))
    if is_browser:
        sent = request.headers.get("x-csrf-token")
        expected = request.cookies.get(CSRF_COOKIE)
        if not sent or not expected or not secrets.compare_digest(sent, expected):
            raise HTTPException(status_code=403, detail="Invalid or missing CSRF token")


async def _auth_response(response: Response, user: dict, request: Request):
    token = create_access_token(user["id"], user["email"])
    refresh = await issue_refresh_token(user["id"])
    _set_session_cookies(response, token, refresh)
    body = {"user": clean(dict(user))}
    if not _is_browser(request):
        # API/CLI clients have no cookie jar and authenticate with a Bearer token. Browser
        # sign-ins are served entirely by the httpOnly cookies, so no token is ever placed
        # where page JavaScript could read it.
        body["access_token"] = token
    return body


@api.post("/auth/register")
async def register(body: RegisterIn, request: Request, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = {
        "id": str(uuid.uuid4()), "email": email, "name": body.name, "role": "CLIENT",
        "password_hash": hash_password(body.password), "phone": body.phone,
        "is_active": True, "created_at": now_iso(),
    }
    await db.users.insert_one(dict(user))
    client = {"id": str(uuid.uuid4()), "user_id": user["id"], "name": body.name,
              "email": email, "phone": body.phone, "is_test": is_test_email(email),
              "created_at": now_iso()}
    count = await db.clients.count_documents({})
    client["client_ref"] = f"CL-{42 + count:04d}"
    await db.clients.insert_one(dict(client))
    await bootstrap_client_services(client)
    return await _auth_response(response, user, request)


@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    ip = client_ip(request)
    await enforce_login_allowed(ip, email)
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") \
            or not verify_password(body.password, user["password_hash"]):
        await record_failure(ip, email)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("status") == "PENDING":
        raise HTTPException(status_code=401,
                            detail="Your account setup is not complete — use your invitation link")
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account disabled")
    await clear_failures(ip, email)
    if (user.get("totp") or {}).get("enabled"):
        # No session is issued until the second factor is verified.
        return {"two_factor_required": True, "challenge": create_challenge(user["id"]),
                "expires_in": 300}
    return await _auth_response(response, user, request)


class TwoFactorLoginIn(BaseModel):
    challenge: str
    code: str


@api.post("/auth/login/2fa")
async def login_2fa(body: TwoFactorLoginIn, request: Request, response: Response):
    ip = client_ip(request)
    user_id = await consume_challenge(body.challenge)
    user = await db.users.find_one({"id": user_id})
    totp = (user or {}).get("totp") or {}
    if not user or not user.get("is_active", True) or not totp.get("enabled"):
        raise HTTPException(status_code=401, detail="Invalid authentication")
    await enforce_login_allowed(ip, user["email"])
    ok, step = verify_code(decrypt_secret(totp["secret_enc"]), body.code, totp.get("last_step"))
    if ok:
        claimed = await db.users.update_one(
            {"id": user["id"], "totp.last_step": totp.get("last_step")},
            {"$set": {"totp.last_step": step}})
        if not claimed.modified_count:
            raise HTTPException(status_code=401, detail="That code has already been used")
    else:
        index = match_recovery_code(body.code, user.get("recovery_code_hashes"))
        if index is None:
            await record_failure(ip, user["email"])
            raise HTTPException(status_code=401, detail="Invalid authentication code")
        used = user["recovery_code_hashes"][index]
        pulled = await db.users.update_one({"id": user["id"], "recovery_code_hashes": used},
                                           {"$pull": {"recovery_code_hashes": used}})
        if not pulled.modified_count:
            raise HTTPException(status_code=401, detail="Invalid authentication code")
        await db.activity_logs.insert_one({
            "id": str(uuid.uuid4()), "case_id": None, "action": "Recovery code used to sign in",
            "user_id": user["id"], "user_name": user["name"], "role": user["role"],
            "meta": {}, "created_at": now_iso()})
    await clear_failures(ip, user["email"])
    return await _auth_response(response, user, request)


@api.get("/auth/2fa/status")
async def two_factor_status(user: dict = Depends(get_current_user)):
    row = await db.users.find_one({"id": user["id"]}, {"totp": 1, "recovery_code_hashes": 1})
    totp = (row or {}).get("totp") or {}
    return {"enabled": bool(totp.get("enabled")),
            "required": user["role"] in MFA_REQUIRED_ROLES,
            "recovery_codes_remaining": len((row or {}).get("recovery_code_hashes") or [])}


@api.post("/auth/2fa/enrol")
async def enrol_2fa(request: Request, user: dict = Depends(get_current_user)):
    _enforce_csrf(request)
    row = await db.users.find_one({"id": user["id"]}, {"totp": 1})
    if ((row or {}).get("totp") or {}).get("enabled"):
        raise HTTPException(status_code=409, detail="Two-factor authentication is already on")
    secret, uri = new_secret(user["email"])
    await db.users.update_one({"id": user["id"]}, {"$set": {
        "totp": {"enabled": False, "secret_enc": encrypt_secret(secret), "last_step": None}}})
    return {"otpauth_uri": uri, "manual_secret": secret}


class CodeIn(BaseModel):
    code: str


@api.post("/auth/2fa/activate")
async def activate_2fa(body: CodeIn, request: Request, user: dict = Depends(get_current_user)):
    _enforce_csrf(request)
    row = await db.users.find_one({"id": user["id"]}, {"totp": 1})
    totp = (row or {}).get("totp") or {}
    if totp.get("enabled") or not totp.get("secret_enc"):
        raise HTTPException(status_code=409, detail="Start the setup again")
    ok, step = verify_code(decrypt_secret(totp["secret_enc"]), body.code, None)
    if not ok:
        raise HTTPException(status_code=400, detail="That code isn't right — please try again")
    codes, hashes = generate_recovery_codes()
    await db.users.update_one({"id": user["id"]}, {"$set": {
        "totp.enabled": True, "totp.last_step": step, "totp.enabled_at": now_iso(),
        "recovery_code_hashes": hashes, "recovery_codes_generated_at": now_iso()}})
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()), "case_id": None, "action": "Two-factor authentication enabled",
        "user_id": user["id"], "user_name": user["name"], "role": user["role"],
        "meta": {}, "created_at": now_iso()})
    return {"recovery_codes": codes}


class Disable2FAIn(BaseModel):
    password: str
    code: str


@api.post("/auth/2fa/disable")
async def disable_2fa(body: Disable2FAIn, request: Request,
                      user: dict = Depends(get_current_user)):
    """Turning 2FA off needs the password AND a valid code, so a hijacked session cannot."""
    _enforce_csrf(request)
    if user["role"] in MFA_REQUIRED_ROLES:
        raise HTTPException(status_code=403,
                            detail="Two-factor authentication is required for this role")
    row = await db.users.find_one({"id": user["id"]})
    totp = (row or {}).get("totp") or {}
    if not verify_password(body.password, row.get("password_hash") or ""):
        raise HTTPException(status_code=401, detail="Password is incorrect")
    ok = False
    if totp.get("secret_enc"):
        ok, _ = verify_code(decrypt_secret(totp["secret_enc"]), body.code, None)
    if not ok and match_recovery_code(body.code, row.get("recovery_code_hashes")) is None:
        raise HTTPException(status_code=401, detail="Invalid authentication code")
    await db.users.update_one({"id": user["id"]},
                             {"$unset": {"totp": "", "recovery_code_hashes": ""}})
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()), "case_id": None, "action": "Two-factor authentication disabled",
        "user_id": user["id"], "user_name": user["name"], "role": user["role"],
        "meta": {}, "created_at": now_iso()})
    return {"ok": True}


@api.post("/auth/refresh")
async def refresh_session(request: Request, response: Response):
    _enforce_csrf(request)
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user, new_refresh = await rotate_refresh_token(token)
    access = create_access_token(user["id"], user["email"])
    _set_session_cookies(response, access, new_refresh)
    body = {"user": clean(dict(user))}
    if not _is_browser(request):
        body["access_token"] = access
    return body


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    _enforce_csrf(request)
    await revoke_refresh_token(request.cookies.get(REFRESH_COOKIE))
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------------------------------------------------------------- helpers
async def _client_record(user: dict) -> Optional[dict]:
    return await db.clients.find_one({"user_id": user["id"]})


async def _owned_case_ids(user: dict, service_type: Optional[str] = None) -> List[str]:
    """The authoritative set of case ids the authenticated client owns.

    Ownership is derived from the CASE (authenticated user -> client record -> cases), never
    from a denormalised copy of the user id on a child row. Child records such as tasks and
    documents carry their own `owner_id`/`client_user_id` fields, and a stale or incorrectly
    written value on one of those rows must never grant a client access to another client's
    data, so every client-facing query is constrained by this set.
    """
    query = {"client_user_id": user["id"]}
    client = await _client_record(user)
    if client:
        query = {"$or": [{"client_user_id": user["id"]}, {"client_id": client["id"]}]}
    if service_type:
        query = {"$and": [query, {"service_type": service_type}]}
    return [c["id"] async for c in db.cases.find(query, {"id": 1})]


async def _get_case(case_id: str, user: dict) -> dict:
    case = await db.cases.find_one({"id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if user["role"] == "CLIENT":
        client = await _client_record(user)
        owns = case.get("client_user_id") == user["id"] or (
            client and case.get("client_id") == client["id"])
        if not owns:
            raise HTTPException(status_code=403, detail="Not your case")
    if user["role"] == "ACCOUNTANT" and case.get("assigned_accountant_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Case not assigned to you")
    return clean(case)


def _days_left(case: dict):
    dl = case.get("internal_deadline")
    if not dl:
        return None
    try:
        return (datetime.fromisoformat(dl) - datetime.now(timezone.utc)).days
    except Exception:
        return None


async def _decorate(cases: List[dict]):
    out = [clean(c) for c in cases]
    # One query for every case's latest activity instead of one query per case.
    ids = [c["id"] for c in out]
    latest = {}
    if ids:
        pipeline = [{"$match": {"case_id": {"$in": ids}}},
                    {"$sort": {"created_at": -1}},
                    {"$group": {"_id": "$case_id", "doc": {"$first": "$$ROOT"}}}]
        async for row in db.activity_logs.aggregate(pipeline):
            latest[row["_id"]] = clean(row["doc"])
    for c in out:
        c["days_left"] = _days_left(c)
        c["last_activity"] = latest.get(c["id"])
    return out


# ---------------------------------------------------------------- cases
@api.get("/cases")
async def list_cases(status: Optional[str] = None, bucket: Optional[str] = None,
                     accountant_id: Optional[str] = None, priority: Optional[str] = None,
                     tax_year: Optional[str] = None, service_type: Optional[str] = None,
                     q: Optional[str] = None, include_test: bool = False,
                     limit: int = 100, skip: int = 0,
                     user: dict = Depends(get_current_user)):
    query = {}
    if not include_test:
        # Automated-test cases stay in the database but never appear in operational views.
        query.update(OPERATIONAL_ONLY)
    if service_type:
        query["service_type"] = service_type
    if user["role"] == "CLIENT":
        query["client_user_id"] = user["id"]
    elif user["role"] == "ACCOUNTANT":
        query["assigned_accountant_id"] = user["id"]

    if status:
        query["status"] = {"$in": status.split(",")}
    if accountant_id:
        query["assigned_accountant_id"] = None if accountant_id == "UNASSIGNED" else accountant_id
    if priority:
        query["priority"] = priority
    if tax_year:
        query["tax_year"] = tax_year

    buckets = {
        "new": {"status": {"$in": ["NEW", "ONBOARDING", "AWAITING_ASSIGNMENT"]}},
        "unassigned": {"assigned_accountant_id": None},
        "in_progress": {"status": {"$in": ["ASSIGNED", "ACCOUNTANT_REVIEW", "IN_PREPARATION", "CHANGES_REQUIRED"]}},
        "waiting_client": {"status": "AWAITING_CLIENT"},
        "awaiting_client": {"status": "AWAITING_CLIENT"},
        "admin_review": {"status": {"$in": ["READY_FOR_ADMIN_REVIEW", "ADMIN_REVIEW"]}},
        "client_approval": {"status": {"$in": ["ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL"]}},
        "ready_submission": {"status": {"$in": ["CLIENT_APPROVED", "READY_FOR_SUBMISSION"]}},
        "overdue": {"internal_deadline": {"$lt": now_iso()},
                    "status": {"$nin": ["SUBMITTED", "COMPLETED"]}},
        "needs_my_action": {"next_action_owner": "ACCOUNTANT",
                            "status": {"$nin": ["SUBMITTED", "COMPLETED"]}},
        "ready_for_admin": {"status": {"$in": ["READY_FOR_ADMIN_REVIEW", "ADMIN_REVIEW"]}},
        "admin_changes": {"status": "CHANGES_REQUIRED"},
        "completed": {"status": {"$in": ["SUBMITTED", "COMPLETED", "READY_FOR_SUBMISSION"]}},
        "due_today": {"internal_deadline": {"$lte": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()},
                      "status": {"$nin": ["SUBMITTED", "COMPLETED"]}},
        "due_week": {"internal_deadline": {"$lte": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()},
                     "status": {"$nin": ["SUBMITTED", "COMPLETED"]}},
        # queue buckets
        "new_assigned": {"status": "ASSIGNED"},
        "assigned": {"assigned_accountant_id": {"$ne": None}},
        "changes_required": {"status": "CHANGES_REQUIRED"},
        "awaiting_admin_review": {"status": {"$in": ["READY_FOR_ADMIN_REVIEW", "ADMIN_REVIEW"]}},
        "awaiting_client_approval": {"status": {"$in": ["ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL"]}},
        "approved_ready": {"status": {"$in": ["ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL",
                                              "CLIENT_APPROVED", "READY_FOR_SUBMISSION"]}},
        "submitted": {"status": {"$in": ["SUBMITTED", "SUBMISSION_IN_PROGRESS"]}},
        "case_completed": {"status": "COMPLETED"},
        "attention": {"$or": [{"status": "SUBMISSION_ISSUE"},
                              {"internal_deadline": {"$lt": now_iso()},
                               "status": {"$nin": ["SUBMITTED", "COMPLETED"]}}]},
    }
    if bucket and bucket in buckets:
        query.update(buckets[bucket])
    elif bucket:
        # An unknown bucket used to be ignored, which silently returned every case under the
        # wrong status filter.
        raise HTTPException(status_code=400, detail="Unknown case filter")
    if q:
        # Search by client name, case reference or the client's email address. The client's
        # current name is resolved from the client record, so a case whose denormalised copy is
        # stale is still found. Email is used to locate the case only -- it is never returned.
        matched_users = [u["id"] async for u in db.users.find(
            {"role": "CLIENT", "$or": [{"email": {"$regex": q, "$options": "i"}},
                                       {"name": {"$regex": q, "$options": "i"}}]}, {"id": 1})]
        query["$or"] = [{"client_name": {"$regex": q, "$options": "i"}},
                        {"case_ref": {"$regex": q, "$options": "i"}},
                        {"client_user_id": {"$in": matched_users}}]

    cases = await db.cases.find(query).sort("last_updated", -1).skip(skip).to_list(limit)
    return scrub_many(await _decorate(cases), user)


async def _next_case_ref() -> str:
    """Allocate a unique case reference. Derived from the highest reference ever issued, not
    from the document count, so deleting a case can never re-issue its reference."""
    while True:
        counter = await db.counters.find_one_and_update(
            {"id": "case_ref"}, {"$inc": {"value": 1}},
            upsert=True, return_document=True)
        seq = (counter or {}).get("value", 1)
        if seq < 1001:
            highest = 1000
            async for c in db.cases.find({"case_ref": {"$regex": r"^SA-\d+$"}}, {"case_ref": 1}):
                highest = max(highest, int(c["case_ref"].split("-")[1]))
            await db.counters.update_one({"id": "case_ref"}, {"$set": {"value": highest}},
                                         upsert=True)
            continue
        ref = f"SA-{seq}"
        if not await db.cases.find_one({"case_ref": ref}):
            return ref


@api.post("/cases")
async def create_case(body: CaseIn, user: dict = Depends(get_current_user)):
    if user["role"] == "CLIENT":
        client_user_id = user["id"]
    else:
        if not body.client_user_id:
            raise HTTPException(status_code=400, detail="client_user_id required")
        client_user_id = body.client_user_id
    client_user = await db.users.find_one({"id": client_user_id, "role": "CLIENT"})
    if not client_user:
        raise HTTPException(status_code=404, detail="Client not found")
    client = await db.clients.find_one({"user_id": client_user_id})
    stage, next_action, owner = STATUS_META["AWAITING_ASSIGNMENT"]
    case = {
        "id": str(uuid.uuid4()), "case_ref": await _next_case_ref(),
        "is_test": is_test_email(client_user.get("email")),
        "client_id": client["id"] if client else None, "client_user_id": client_user_id,
        "client_name": client_user["name"], "service_type": body.service_type,
        "tax_year": body.tax_year, "assigned_accountant_id": None,
        "assigned_accountant_name": None, "admin_reviewer_id": None, "admin_reviewer_name": None,
        "status": "AWAITING_ASSIGNMENT", "current_stage": stage, "next_action": next_action,
        "next_action_owner": owner, "priority": "MEDIUM",
        "internal_deadline": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
        "external_deadline": deadline_for_tax_year(body.tax_year), "internal_instructions": None,
        "waiting_reason": None, "approved_version_id": None,
        "created_at": now_iso(), "last_updated": now_iso(),
    }
    await db.cases.insert_one(dict(case))
    await log_activity(case["id"], "Case created", user)
    async for admin in db.users.find({"role": {"$in": ["ADMIN", "SUPER_ADMIN"]}}):
        await notify(admin["id"], "New case awaiting assignment",
                     f"{case['client_name']} — {case['case_ref']}", case["id"], f"/admin/cases/{case['id']}")
    return clean(case)


@api.get("/cases/{case_id}")
async def get_case(case_id: str, user: dict = Depends(get_current_user)):
    case = await _get_case(case_id, user)
    case["days_left"] = _days_left(case)
    # The record moves READY -> SUBMITTED -> COMPLETED when the case is completed, so both
    # of the later states count as a genuine recorded submission.
    submission = await db.submission_records.find_one(
        {"case_id": case_id, "status": {"$in": ["SUBMITTED", "COMPLETED"]}})
    case["journey"] = journey(case["status"], has_submission=bool(submission))
    case["status_label"] = client_status(case["status"])
    case["has_submission_record"] = bool(submission)
    if submission:
        case["submission_date"] = submission.get("submission_date") or case.get("submission_date")
        case["submission_reference"] = (submission.get("reference")
                                        or submission.get("submission_reference")
                                        or case.get("submission_reference"))
    approval = await db.client_approvals.find_one({"case_id": case_id})
    case["approved_version"] = approval.get("version") if approval else None
    if not case.get("external_deadline") and case.get("tax_year"):
        case["external_deadline"] = deadline_for_tax_year(case["tax_year"])
    return scrub(case, user)


@api.post("/cases/{case_id}/assign")
async def assign_case(case_id: str, body: AssignIn,
                      user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    case = await _get_case(case_id, user)
    if case["status"] == "COMPLETED":
        raise HTTPException(status_code=400,
                            detail="Completed cases are locked — reopen the case first")
    acc = await db.users.find_one({"id": body.accountant_id, "role": "ACCOUNTANT", "is_active": True})
    if not acc:
        raise HTTPException(status_code=404, detail="Accountant not found")
    await db.assignments.insert_one({
        "id": str(uuid.uuid4()), "case_id": case_id, "accountant_id": acc["id"],
        "accountant_name": acc["name"], "assigned_by": user["id"], "assigned_by_name": user["name"],
        "priority": body.priority, "internal_deadline": body.internal_deadline,
        "internal_instructions": body.internal_instructions, "created_at": now_iso(),
    })
    extra = {"assigned_accountant_id": acc["id"], "assigned_accountant_name": acc["name"],
             "priority": body.priority, "internal_instructions": body.internal_instructions}
    if body.internal_deadline:
        extra["internal_deadline"] = body.internal_deadline
    previous_id = case.get("assigned_accountant_id")
    if previous_id and previous_id != acc["id"]:
        # Reassignment changes ownership only. The workflow state (stage, status, next-action
        # owner, waiting reason) belongs to the case, not the accountant, so it is left alone.
        await db.cases.update_one({"id": case_id},
                                  {"$set": {**extra, "last_updated": now_iso()}})
        await log_activity(
            case_id,
            f"Case reassigned from {case.get('assigned_accountant_name')} to {acc['name']}",
            user, {"previous_accountant_id": previous_id,
                   "previous_accountant_name": case.get("assigned_accountant_name"),
                   "new_accountant_id": acc["id"], "new_accountant_name": acc["name"]})
        await notify(previous_id, "Case reassigned",
                     f"{case['client_name']} — {case['case_ref']} is now with {acc['name']}",
                     case_id, "/work", "ASSIGNMENT")
    elif previous_id == acc["id"]:
        await db.cases.update_one({"id": case_id},
                                  {"$set": {**extra, "last_updated": now_iso()}})
        await log_activity(case_id, f"Assignment details updated for {acc['name']}", user, extra)
    else:
        await transition(case, "ASSIGNED", user, f"Assigned to {acc['name']}", extra=extra)
    await notify(acc["id"], "New case assigned",
                 f"{case['client_name']} — {case['case_ref']} ({case['tax_year']})",
                 case_id, f"/work/cases/{case_id}", "ASSIGNMENT")
    return await get_case(case_id, user)


@api.post("/cases/{case_id}/start-review")
async def start_review(case_id: str, user: dict = Depends(require_roles("ACCOUNTANT"))):
    case = await _get_case(case_id, user)
    if case["status"] not in ("ASSIGNED", "AWAITING_CLIENT", "CHANGES_REQUIRED", "ACCOUNTANT_REVIEW"):
        raise HTTPException(status_code=400, detail="Not allowed at this stage")
    await transition(case, "ACCOUNTANT_REVIEW", user, "Accountant started review")
    return await get_case(case_id, user)


@api.post("/cases/{case_id}/mark-reviewed")
async def mark_reviewed(case_id: str, user: dict = Depends(require_roles("ACCOUNTANT"))):
    case = await _get_case(case_id, user)
    await transition(case, "IN_PREPARATION", user, "Information marked as reviewed")
    return await get_case(case_id, user)


@api.post("/cases/{case_id}/request-from-client")
async def request_from_client(case_id: str, body: RequestIn,
                             user: dict = Depends(require_roles("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"))):
    case = await _get_case(case_id, user)
    if "AWAITING_CLIENT" not in ALLOWED_TRANSITIONS.get(case["status"], []):
        raise HTTPException(
            status_code=400,
            detail=f"Information cannot be requested from the client at this stage ({case['status']})")
    req_id = str(uuid.uuid4())
    task_id = str(uuid.uuid4())
    # Idempotency: one genuine request produces one genuine task/request/document. A repeated
    # click, refresh or retry for the same still-open item reuses the existing records.
    existing_task = await db.tasks.find_one({
        "case_id": case_id, "name": body.title, "owner_role": "CLIENT", "status": "OPEN"})
    if existing_task:
        await transition(case, "AWAITING_CLIENT", user,
                         f"Requested from client: {body.title}", waiting_reason=body.title)
        return {"ok": True, "task_id": existing_task["id"], "duplicate_prevented": True}
    await db.tasks.insert_one({
        "id": task_id, "case_id": case_id, "case_ref": case["case_ref"],
        "name": body.title, "description": body.description, "owner_role": "CLIENT",
        "owner_id": case["client_user_id"], "due_date": body.due_date, "status": "OPEN",
        "mandatory": body.mandatory,
        "created_by": user["id"], "created_by_name": user["name"],
        "created_at": now_iso(), "completed_date": None, "request_id": req_id,
    })
    if body.document_required:
        await db.document_requests.insert_one({
            "id": req_id, "case_id": case_id, "client_user_id": case["client_user_id"],
            "title": body.title, "description": body.description, "task_id": task_id,
            "status": "Requested", "requested_by": user["id"], "requested_by_name": user["name"],
            "due_date": body.due_date, "created_at": now_iso(),
        })
        await db.documents.insert_one({
            "id": str(uuid.uuid4()), "case_id": case_id, "client_user_id": case["client_user_id"],
            "tax_year": case["tax_year"], "document_type": body.title, "name": body.title,
            "status": "Requested", "request_id": req_id, "task_id": task_id,
            "storage_path": None, "uploader_id": None, "uploader_name": None,
            "content_type": None, "size": 0, "is_internal": False,
            "created_at": now_iso(), "upload_date": None,
        })
    if body.message:
        await db.messages.insert_one({
            "id": str(uuid.uuid4()), "case_id": case_id, "sender_id": user["id"],
            "sender_name": user["name"], "sender_role": user["role"],
            "recipient_id": case["client_user_id"], "body": body.message,
            "is_read": False, "created_at": now_iso(),
        })
    await notify(case["client_user_id"], "Action required: " + body.title,
                 body.description or "Your accountant needs information from you.",
                 case_id, f"/tasks?task={task_id}", "TASK")
    await transition(case, "AWAITING_CLIENT", user, f"Requested from client: {body.title}",
                     waiting_reason=body.title)
    return {"ok": True, "task_id": task_id, "request_id": req_id}


@api.post("/cases/{case_id}/calculations")
async def create_calculation(case_id: str, body: CalcIn,
                             user: dict = Depends(require_roles("ACCOUNTANT"))):
    case = await _get_case(case_id, user)
    if case["status"] in ("SUBMITTED", "COMPLETED"):
        raise HTTPException(status_code=400, detail="This case is locked")
    count = await db.calculation_versions.count_documents({"case_id": case_id})
    calc = {
        "id": str(uuid.uuid4()), "case_id": case_id, "version": count + 1,
        "total_income": body.total_income, "taxable_income": body.taxable_income,
        "tax_due": body.tax_due, "is_refund": body.is_refund, "notes": body.notes,
        "payment_deadline": body.payment_deadline or payment_deadline_label(case["tax_year"]),
        "breakdown": body.breakdown or {},
        "created_by": user["id"], "created_by_name": user["name"],
        "is_locked": False, "is_approved": False, "created_at": now_iso(),
    }
    await db.calculation_versions.insert_one(dict(calc))
    await transition(case, "IN_PREPARATION", user, f"Calculation V{calc['version']} created")
    return clean(calc)


@api.get("/cases/{case_id}/calculations")
async def list_calculations(case_id: str, user: dict = Depends(get_current_user)):
    case = await _get_case(case_id, user)
    query = {"case_id": case_id}
    if user["role"] == "CLIENT":
        # Client may only ever see admin-approved versions.
        query["is_approved"] = True
    calcs = await db.calculation_versions.find(query).sort("version", -1).to_list(100)
    # The payment deadline is always derived from the case tax year, so historic records that
    # stored an older literal still display the correct date.
    derived = payment_deadline_label(case["tax_year"])
    for c in calcs:
        c["payment_deadline"] = derived
    return scrub_many(clean_many(calcs), user)


@api.post("/cases/{case_id}/submit-for-admin-review")
async def submit_for_admin_review(case_id: str, body: ChecklistIn,
                                  user: dict = Depends(require_roles("ACCOUNTANT"))):
    case = await _get_case(case_id, user)
    required = ["client_information_reviewed", "required_documents_reviewed", "income_checked",
                "allowable_expenses_checked", "tax_calculation_checked",
                "supporting_documents_attached", "return_ready"]
    missing = [k for k in required if not body.checklist.get(k)]
    if missing:
        raise HTTPException(status_code=400, detail=f"Checklist incomplete: {', '.join(missing)}")
    calc = await db.calculation_versions.find_one({"id": body.calculation_version_id, "case_id": case_id})
    if not calc:
        raise HTTPException(status_code=404, detail="Calculation version not found")
    await db.calculation_versions.update_one({"id": calc["id"]}, {"$set": {"is_locked": True}})
    await db.reviews.insert_one({
        "id": str(uuid.uuid4()), "case_id": case_id, "calculation_version_id": calc["id"],
        "version": calc["version"], "checklist": body.checklist, "submitted_by": user["id"],
        "submitted_by_name": user["name"], "submitted_at": now_iso(),
        "outcome": None, "reviewer_id": None, "reviewer_name": None,
        "reason": None, "instructions": None, "decided_at": None,
    })
    await transition(case, "READY_FOR_ADMIN_REVIEW", user,
                     f"Calculation V{calc['version']} sent to admin for review",
                     comments=body.admin_note)
    if body.admin_note:
        await db.internal_notes.insert_one({
            "id": str(uuid.uuid4()), "case_id": case_id,
            "body": f"Note for Admin review: {body.admin_note}",
            "author_id": user["id"], "author_name": user["name"], "author_role": user["role"],
            "created_at": now_iso(),
        })
        await db.reviews.update_one({"case_id": case_id, "calculation_version_id": calc["id"]},
                                    {"$set": {"accountant_note": body.admin_note}})
    async for admin in db.users.find({"role": {"$in": ["ADMIN", "SUPER_ADMIN"]}}):
        await notify(admin["id"], "Admin review required",
                     f"{case['client_name']} — V{calc['version']} submitted by {user['name']}",
                     case_id, f"/admin/review/{case_id}", "REVIEW")
    return {"ok": True}


@api.post("/cases/{case_id}/admin-approve")
async def admin_approve(case_id: str, body: Optional[ApproveIn] = None,
                        user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    case = await _get_case(case_id, user)
    if case["status"] not in ("READY_FOR_ADMIN_REVIEW", "ADMIN_REVIEW"):
        raise HTTPException(status_code=400, detail="Case is not awaiting admin review")
    review = await db.reviews.find_one({"case_id": case_id, "outcome": None}, sort=[("submitted_at", -1)])
    if not review:
        raise HTTPException(status_code=400, detail="No submitted work to approve")
    admin_note = body.note if body else None
    await db.calculation_versions.update_one(
        {"id": review["calculation_version_id"]},
        {"$set": {"is_approved": True, "is_locked": True, "approved_by": user["name"],
                  "approved_at": now_iso()}})
    await db.reviews.update_one({"id": review["id"]}, {"$set": {
        "outcome": "APPROVED", "reviewer_id": user["id"], "reviewer_name": user["name"],
        "admin_note": admin_note, "decided_at": now_iso()}})
    await transition(case, "ADMIN_APPROVED", user, f"Admin approved V{review['version']}",
                     comments=admin_note,
                     extra={"approved_version_id": review["calculation_version_id"],
                            "admin_reviewer_id": user["id"], "admin_reviewer_name": user["name"],
                            "admin_approved_at": now_iso(), "admin_approved_by": user["name"]})
    # The approved version supersedes any earlier admin change request, so its task is resolved.
    # The original return-for-changes stays in the activity history.
    closed = await db.tasks.update_many(
        {"case_id": case_id, "status": "OPEN", "name": {"$regex": "^Admin changes required"}},
        {"$set": {"status": "COMPLETED", "completed_at": now_iso(),
                  "completed_by_name": user["name"]}})
    if closed.modified_count:
        await log_activity(case_id, "Admin change request resolved by the approved version", user,
                           {"tasks_closed": closed.modified_count})
    await transition(case, "AWAITING_CLIENT_APPROVAL", user,
                     "Approved calculation released to client for review")
    await notify(case["client_user_id"], "Your tax return is ready to review",
                 "Your Self Assessment calculation has been approved and is ready for your review.",
                 case_id, "/my-return", "APPROVAL")
    if case.get("assigned_accountant_id"):
        await notify(case["assigned_accountant_id"], "Admin approved your work",
                     f"V{review['version']} approved for {case['client_name']}", case_id,
                     f"/work/cases/{case_id}", "APPROVAL")
    return await get_case(case_id, user)


@api.post("/cases/{case_id}/admin-return")
async def admin_return(case_id: str, body: ReturnChangesIn,
                       user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    case = await _get_case(case_id, user)
    review = await db.reviews.find_one({"case_id": case_id, "outcome": None}, sort=[("submitted_at", -1)])
    if not review:
        raise HTTPException(status_code=400, detail="No submitted work to return")
    await db.reviews.update_one({"id": review["id"]}, {"$set": {
        "outcome": "CHANGES_REQUIRED", "reviewer_id": user["id"], "reviewer_name": user["name"],
        "reason": body.reason, "instructions": body.instructions, "decided_at": now_iso()}})
    await db.tasks.insert_one({
        "id": str(uuid.uuid4()), "case_id": case_id, "case_ref": case["case_ref"],
        "name": f"Admin changes required: {body.reason}", "description": body.instructions,
        "owner_role": "ACCOUNTANT", "owner_id": case.get("assigned_accountant_id"),
        "due_date": None, "status": "OPEN", "created_by": user["id"],
        "created_by_name": user["name"], "created_at": now_iso(), "completed_date": None,
    })
    await transition(case, "CHANGES_REQUIRED", user,
                     f"Admin returned V{review['version']} for changes: {body.reason}",
                     comments=body.instructions)
    if case.get("assigned_accountant_id"):
        await notify(case["assigned_accountant_id"], "Admin returned changes",
                     f"{case['client_name']}: {body.reason}", case_id,
                     f"/work/cases/{case_id}", "CHANGES")
    return await get_case(case_id, user)


@api.post("/cases/{case_id}/client-approve")
async def client_approve(case_id: str, user: dict = Depends(require_roles("CLIENT"))):
    case = await _get_case(case_id, user)
    if case["status"] not in ("ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL"):
        raise HTTPException(status_code=400, detail="Return is not ready for your approval")
    calc = await db.calculation_versions.find_one({"id": case.get("approved_version_id")})
    await db.client_approvals.insert_one({
        "id": str(uuid.uuid4()), "case_id": case_id, "client_user_id": user["id"],
        "client_name": user["name"], "calculation_version_id": case.get("approved_version_id"),
        "version": calc["version"] if calc else None,
        "confirmation": "I confirm the information is complete and correct to the best of my knowledge.",
        "approved_at": now_iso(),
    })
    await transition(case, "CLIENT_APPROVED", user,
                     f"Client approved V{calc['version'] if calc else ''}",
                     extra={"client_approved_at": now_iso()})
    blocking = await db.tasks.count_documents({"case_id": case_id, "status": "OPEN"})
    if blocking:
        # Client approval stands, but the case cannot be ready for submission while work is open.
        return await get_case(case_id, user)
    await transition(case, "READY_FOR_SUBMISSION", user, "Case ready for submission")
    await db.submission_records.insert_one({
        "id": str(uuid.uuid4()), "case_id": case_id, "status": "READY",
        "calculation_version_id": case.get("approved_version_id"),
        "reference": None, "created_at": now_iso(),
    })
    for uid in [case.get("assigned_accountant_id")]:
        if uid:
            await notify(uid, "Client approved the return",
                         f"{case['client_name']} approved their tax return.", case_id,
                         f"/work/cases/{case_id}", "APPROVAL")
    async for admin in db.users.find({"role": {"$in": ["ADMIN", "SUPER_ADMIN"]}}):
        await notify(admin["id"], "Ready for submission",
                     f"{case['client_name']} — {case['case_ref']}", case_id,
                     f"/admin/cases/{case_id}", "SUBMISSION")
    return await get_case(case_id, user)


# ---------------------------------------------------------------- submission
@api.post("/cases/{case_id}/record-submission")
async def record_submission(case_id: str, body: SubmissionIn,
                            user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    """Records an out-of-band submission. Requires admin approval AND client approval."""
    case = await _get_case(case_id, user)
    if case["status"] == "COMPLETED":
        raise HTTPException(status_code=400,
                            detail="Completed cases are locked — reopen the case first")
    if case["status"] == "SUBMITTED":
        # Idempotent: a double-click or repeated request returns the existing record rather
        # than creating a second submission.
        return await get_case(case_id, user)
    if not body.submission_date.strip() or not body.submission_reference.strip():
        raise HTTPException(status_code=400,
                            detail="Submission date and submission reference are required")
    review = await db.reviews.find_one({"case_id": case_id, "outcome": "APPROVED"})
    approval = await db.client_approvals.find_one({"case_id": case_id})
    if not review or not case.get("approved_version_id"):
        raise HTTPException(status_code=400, detail="Admin approval is not complete")
    if not approval:
        raise HTTPException(status_code=400, detail="Client approval is not complete")
    if case["status"] != "READY_FOR_SUBMISSION":
        raise HTTPException(status_code=400, detail=f"Case must be READY_FOR_SUBMISSION (currently {case['status']})")
    blocking = await db.tasks.count_documents({"case_id": case_id, "status": "OPEN"})
    if blocking:
        raise HTTPException(
            status_code=400,
            detail=f"{blocking} item(s) are still outstanding on this case — "
                   "these must be resolved before a submission can be recorded")
    await db.submission_records.update_one(
        {"case_id": case_id},
        {"$set": {"status": "SUBMITTED", "case_id": case_id,
                  "case_ref": case["case_ref"],
                  "submission_date": body.submission_date,
                  "reference": body.submission_reference, "submitted_by": user["id"],
                  "submitted_by_name": user["name"], "submitted_by_role": user["role"],
                  "note": body.note,
                  "provider": body.provider, "evidence_document_id": body.evidence_document_id,
                  "calculation_version_id": case.get("approved_version_id"),
                  "recorded_at": now_iso()}},
        upsert=True,
    )
    await transition(case, "SUBMITTED", user,
                     f"Submission recorded (ref {body.submission_reference}"
                     f"{', via ' + body.provider if body.provider else ''})",
                     comments=body.note,
                     extra={"submission_reference": body.submission_reference,
                            "submission_date": body.submission_date,
                            "submission_provider": body.provider,
                            "submitted_by_name": user["name"]})
    await notify(case["client_user_id"], "Your tax return has been submitted",
                 f"Submission reference {body.submission_reference}", case_id, "/my-return", "SUBMISSION")
    if case.get("assigned_accountant_id"):
        await notify(case["assigned_accountant_id"], "Submission recorded",
                     f"{case['client_name']} — ref {body.submission_reference}", case_id,
                     f"/work/cases/{case_id}", "SUBMISSION")
    return await get_case(case_id, user)


@api.post("/cases/{case_id}/complete")
async def complete_case(case_id: str, body: Optional[ApproveIn] = None,
                        user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    case = await _get_case(case_id, user)
    if case["status"] != "SUBMITTED":
        raise HTTPException(status_code=400, detail="Case must be SUBMITTED before completion")
    await transition(case, "COMPLETED", user, "Case marked completed",
                     comments=body.note if body else None,
                     extra={"completed_at": now_iso(), "completed_by_name": user["name"],
                            "completed_by_id": user["id"]})
    await db.submission_records.update_one({"case_id": case_id},
                                          {"$set": {"status": "COMPLETED", "completed_at": now_iso()}})
    await notify(case["client_user_id"], "Your Self Assessment is complete",
                 "Your case has been completed by TaxSimba.", case_id, "/my-return", "INFO")
    return await get_case(case_id, user)


@api.get("/cases/{case_id}/submission")
async def get_submission(case_id: str, user: dict = Depends(get_current_user)):
    await _get_case(case_id, user)
    rec = await db.submission_records.find_one({"case_id": case_id})
    return clean(rec) if rec else None


@api.post("/cases/{case_id}/reopen")
async def reopen_case(case_id: str, body: ReasonIn,
                      user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    """Completed cases are locked; reopening requires a reason and is audited."""
    case = await _get_case(case_id, user)
    if case["status"] != "COMPLETED":
        raise HTTPException(status_code=400, detail="Only completed cases can be reopened")
    if not body.reason.strip():
        raise HTTPException(status_code=400, detail="A reason is required to reopen a case")
    target = "ACCOUNTANT_REVIEW" if case.get("assigned_accountant_id") else "ASSIGNED"
    await transition(case, target, user, f"Case reopened by {user['name']}", comments=body.reason)
    if case.get("assigned_accountant_id"):
        await notify(case["assigned_accountant_id"], "Case reopened",
                     f"{case['client_name']}: {body.reason}", case_id,
                     f"/work/cases/{case_id}", "CHANGES")
    return await get_case(case_id, user)


@api.post("/cases/{case_id}/unassign")
async def unassign_case(case_id: str, body: ReasonIn,
                        user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    case = await _get_case(case_id, user)
    if case["status"] == "COMPLETED":
        raise HTTPException(status_code=400,
                            detail="Completed cases are locked — reopen the case first")
    if not case.get("assigned_accountant_id"):
        raise HTTPException(status_code=400, detail="Case is not assigned")
    previous = case.get("assigned_accountant_name")
    await db.assignments.update_many({"case_id": case_id, "ended_at": None},
                                     {"$set": {"ended_at": now_iso(),
                                               "ended_by": user["name"],
                                               "end_reason": body.reason}})
    await db.cases.update_one({"id": case_id}, {"$set": {
        "assigned_accountant_id": None, "assigned_accountant_name": None,
        "status": "AWAITING_ASSIGNMENT", "current_stage": "Information",
        "next_action": "Assign an accountant", "next_action_owner": "ADMIN",
        "last_updated": now_iso()}})
    await log_activity(case_id, f"Case unassigned from {previous}", user,
                       previous_status=case["status"], new_status="AWAITING_ASSIGNMENT",
                       comments=body.reason)
    return await get_case(case_id, user)


@api.get("/cases/{case_id}/assignments")
async def assignment_history(case_id: str,
                             user: dict = Depends(require_roles("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"))):
    await _get_case(case_id, user)
    rows = await db.assignments.find({"case_id": case_id}).sort("created_at", -1).to_list(100)
    return scrub_many(clean_many(rows), user)


# ---------------------------------------------------------------- tasks
@api.get("/tasks")
async def list_tasks(case_id: Optional[str] = None, status: Optional[str] = None,
                     service_type: Optional[str] = None,
                     user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] == "CLIENT":
        # Scoped by owned CASES, not by the task's own owner_id copy.
        owned = await _owned_case_ids(user, service_type)
        query["case_id"] = {"$in": owned}
        query["owner_id"] = user["id"]
        query["owner_role"] = "CLIENT"
    else:
        if service_type:
            ids = [c["id"] async for c in db.cases.find({"service_type": service_type}, {"id": 1})]
            query["case_id"] = {"$in": ids}
        if user["role"] == "ACCOUNTANT" and not case_id:
            query["owner_id"] = user["id"]
    if case_id:
        await _get_case(case_id, user)
        query["case_id"] = case_id
        if user["role"] == "CLIENT":
            query["owner_role"] = "CLIENT"
            query["owner_id"] = user["id"]
    if status:
        query["status"] = status
    tasks = await db.tasks.find(query).sort("created_at", -1).to_list(300)
    tasks = clean_many(tasks)
    # Tax year comes from the parent case; fetched in one query for the whole page.
    ids = list({t.get("case_id") for t in tasks if t.get("case_id")})
    years = {c["id"]: c.get("tax_year")
             async for c in db.cases.find({"id": {"$in": ids}}, {"id": 1, "tax_year": 1})}
    for t in tasks:
        t["tax_year"] = years.get(t.get("case_id"))
    return scrub_many(tasks, user)


@api.post("/tasks/{task_id}/complete")
async def complete_task(task_id: str, user: dict = Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.get("owner_id") != user["id"] and not is_admin(user):
        raise HTTPException(status_code=403, detail="Not your task")
    await db.tasks.update_one({"id": task_id}, {"$set": {"status": "COMPLETED",
                                                         "completed_date": now_iso()}})
    case = await db.cases.find_one({"id": task["case_id"]})
    case = clean(case)
    await log_activity(case["id"], f"Task completed: {task['name']}", user)
    if task.get("owner_role") == "CLIENT":
        open_client_tasks = await db.tasks.count_documents(
            {"case_id": case["id"], "owner_role": "CLIENT", "status": "OPEN"})
        if case.get("assigned_accountant_id"):
            await notify(case["assigned_accountant_id"], "Client completed a task",
                         f"{case['client_name']}: {task['name']}", case["id"],
                         f"/work/cases/{case['id']}", "TASK")
        if open_client_tasks == 0 and case["status"] == "AWAITING_CLIENT":
            await transition(case, "ACCOUNTANT_REVIEW", user,
                             "Client provided requested information — back to accountant")
    return {"ok": True}


# ---------------------------------------------------------------- documents
@api.get("/documents")
async def list_documents(case_id: Optional[str] = None, filter: Optional[str] = None,
                         service_type: Optional[str] = None,
                         mtd_period_id: Optional[str] = None,
                         user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] == "CLIENT":
        # Scoped by owned CASES, not by the document's own client_user_id copy.
        owned = await _owned_case_ids(user, service_type)
        query["case_id"] = {"$in": owned}
        query["is_internal"] = False
    else:
        if service_type:
            ids = [c["id"] async for c in db.cases.find({"service_type": service_type}, {"id": 1})]
            query["case_id"] = {"$in": ids}
        if user["role"] == "ACCOUNTANT":
            case_ids = [c["id"] async for c in db.cases.find({"assigned_accountant_id": user["id"]}, {"id": 1})]
            query["case_id"] = {"$in": case_ids}
    if case_id:
        await _get_case(case_id, user)
        query["case_id"] = case_id
    if mtd_period_id:
        query["mtd_period_id"] = mtd_period_id

    if filter == "requested":
        query["status"] = "Requested"
    elif filter == "uploaded":
        query["status"] = {"$in": ["Uploaded", "Under Review", "Accepted", "Replacement Required"]}
    elif filter == "final":
        query["is_final"] = True
    query["is_deleted"] = {"$ne": True}
    docs = await db.documents.find(query).sort("created_at", -1).to_list(500)
    return scrub_many(clean_many(docs), user)


@api.post("/documents/upload")
async def upload_document(case_id: str = Form(...), document_type: str = Form("Other"),
                          document_id: Optional[str] = Form(None),
                          task_id: Optional[str] = Form(None),
                          mtd_period_id: Optional[str] = Form(None),
                          is_internal: bool = Form(False),
                          file: UploadFile = File(...),
                          user: dict = Depends(get_current_user)):
    case = await _get_case(case_id, user)
    if is_internal and user["role"] == "CLIENT":
        raise HTTPException(status_code=403, detail="Clients cannot upload internal documents")
    ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    clean_name = validate_upload(file.content_type, len(data), file.filename)
    result = put_object(path, data, file.content_type or "application/octet-stream")
    record = {
        "id": document_id or str(uuid.uuid4()), "case_id": case_id,
        "client_user_id": case["client_user_id"], "tax_year": case["tax_year"],
        "document_type": document_type, "name": file.filename,
        "status": "Final" if is_internal else "Uploaded",
        "storage_path": result["path"], "uploader_id": user["id"],
        "uploader_name": user["name"], "content_type": file.content_type,
        "size": result.get("size", len(data)), "is_internal": is_internal,
        "is_deleted": False, "upload_date": now_iso(), "created_at": now_iso(),
        "task_id": task_id, "mtd_period_id": mtd_period_id,
    }
    existing = await db.documents.find_one({"id": record["id"]})
    if existing:
        # A referenced document keeps its own case and MTD period — an upload can never
        # move a document (or a request) from one period or case to another.
        if existing["case_id"] != case_id or (
                mtd_period_id and existing.get("mtd_period_id")
                and mtd_period_id != existing["mtd_period_id"]):
            raise HTTPException(
                status_code=400,
                detail="This document belongs to a different case or period")
        record["created_at"] = existing.get("created_at", now_iso())
        record["request_id"] = existing.get("request_id")
        record["task_id"] = task_id or existing.get("task_id")
        record["mtd_period_id"] = existing.get("mtd_period_id") or mtd_period_id
        await db.documents.replace_one({"id": record["id"]}, dict(record))
        if existing.get("request_id"):
            await db.document_requests.update_one({"id": existing["request_id"]},
                                                  {"$set": {"status": "Uploaded"}})
    else:
        await db.documents.insert_one(dict(record))
    await log_activity(case_id, f"Document uploaded: {file.filename}", user)
    if user["role"] == "CLIENT" and case.get("assigned_accountant_id"):
        await notify(case["assigned_accountant_id"], "Client upload received",
                     f"{case['client_name']} uploaded {file.filename}", case_id,
                     f"/work/cases/{case_id}", "UPLOAD")
        await db.cases.update_one({"id": case_id}, {"$set": {
            "next_action_owner": "ACCOUNTANT",
            "next_action": "Review the document the client uploaded",
            "last_updated": now_iso()}}) if case["status"] in (
                "ASSIGNED", "ACCOUNTANT_REVIEW", "AWAITING_CLIENT", "CHANGES_REQUIRED") else None
    if record.get("task_id"):
        await complete_task(record["task_id"], user)
    return clean(record)

@api.patch("/documents/{document_id}/status")
async def set_document_status(document_id: str, status: str = Query(...),
                              user: dict = Depends(require_roles("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"))):
    doc = await db.documents.find_one({"id": document_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    case = await _get_case(doc["case_id"], user)
    if case["status"] == "COMPLETED" and user["role"] == "ACCOUNTANT":
        raise HTTPException(status_code=400, detail="This case is completed and locked")
    if status not in ("Requested", "Uploaded", "Under Review", "Accepted", "Replacement Required", "Final"):
        raise HTTPException(status_code=400, detail="Invalid status")
    await db.documents.update_one({"id": document_id}, {"$set": {"status": status}})
    await log_activity(doc["case_id"], f"Document '{doc['name']}' marked {status}", user)
    return {"ok": True}


@api.get("/documents/{document_id}/download")
async def download_document(document_id: str, user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": document_id})
    if not doc or not doc.get("storage_path"):
        raise HTTPException(status_code=404, detail="File not found")
    if user["role"] == "CLIENT":
        if doc.get("is_internal"):
            raise HTTPException(status_code=403, detail="Not allowed")
        # Ownership is proven against the parent case, not the document's copied field.
        await _get_case(doc["case_id"], user)
    if user["role"] == "ACCOUNTANT":
        await _get_case(doc["case_id"], user)
    data, ctype = get_object(doc["storage_path"])
    return FastResponse(content=data, media_type=doc.get("content_type") or ctype,
                        headers={"Content-Disposition": f'inline; filename="{doc["name"]}"'})


# ---------------------------------------------------------------- messages / notes
@api.get("/messages")
async def list_messages(case_id: str, user: dict = Depends(get_current_user)):
    await _get_case(case_id, user)
    msgs = await db.messages.find({"case_id": case_id}).sort("created_at", 1).to_list(500)
    await db.messages.update_many({"case_id": case_id, "recipient_id": user["id"]},
                                  {"$set": {"is_read": True}})
    return scrub_many(clean_many(msgs), user)


@api.post("/messages")
async def send_message(body: MessageIn, user: dict = Depends(get_current_user)):
    case = await _get_case(body.case_id, user)
    recipient = body.recipient_id
    if not recipient:
        recipient = case.get("assigned_accountant_id") if user["role"] == "CLIENT" else case["client_user_id"]
    msg = {
        "id": str(uuid.uuid4()), "case_id": body.case_id, "sender_id": user["id"],
        "sender_name": user["name"], "sender_role": user["role"], "recipient_id": recipient,
        "body": body.body, "is_read": False, "created_at": now_iso(),
    }
    await db.messages.insert_one(dict(msg))
    await log_activity(body.case_id, "Message sent", user)
    if recipient:
        recipient_user = await db.users.find_one({"id": recipient}, {"role": 1})
        # Staff open the exact case conversation; the client's own thread lives on Messages.
        link = "/messages" if (recipient_user or {}).get("role") == "CLIENT" \
            else f"/work/cases/{body.case_id}"
        await notify(recipient, f"New message from {user['name']}", body.body[:120],
                     body.case_id, link, "MESSAGE")
    if user["role"] == "CLIENT" and case["status"] in (
            "ASSIGNED", "ACCOUNTANT_REVIEW", "AWAITING_CLIENT", "CHANGES_REQUIRED"):
        # A new client message needs a human response -- put this case in the accountant's
        # "Needs My Action" queue without touching any other case. Cases already past
        # preparation (approved / ready for submission) keep their own next action.
        await db.cases.update_one({"id": body.case_id}, {"$set": {
            "next_action_owner": "ACCOUNTANT",
            "next_action": "Reply to the client's message",
            "last_updated": now_iso()}})
    return clean(msg)


@api.get("/cases/{case_id}/notes")
async def list_notes(case_id: str, user: dict = Depends(require_roles("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"))):
    await _get_case(case_id, user)
    notes = await db.internal_notes.find({"case_id": case_id}).sort("created_at", -1).to_list(200)
    return scrub_many(clean_many(notes), user)


@api.post("/cases/{case_id}/notes")
async def add_note(case_id: str, body: NoteIn,
                   user: dict = Depends(require_roles("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"))):
    await _get_case(case_id, user)
    note = {"id": str(uuid.uuid4()), "case_id": case_id, "body": body.body,
            "author_id": user["id"], "author_name": user["name"], "author_role": user["role"],
            "created_at": now_iso()}
    await db.internal_notes.insert_one(dict(note))
    await log_activity(case_id, "Internal note added", user)
    return clean(note)


@api.get("/cases/{case_id}/activity")
async def case_activity(case_id: str,
                        user: dict = Depends(require_roles("ACCOUNTANT", "ADMIN",
                                                           "SUPER_ADMIN"))):
    """Staff-only. The raw log carries internal comments and staff-only events, so a client
    must never read it -- clients follow their case through their own journey screens."""
    await _get_case(case_id, user)
    logs = await db.activity_logs.find({"case_id": case_id}).sort("created_at", -1).to_list(500)
    return scrub_many(clean_many(logs), user)


@api.get("/cases/{case_id}/reviews")
async def case_reviews(case_id: str, user: dict = Depends(require_roles("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"))):
    await _get_case(case_id, user)
    reviews = await db.reviews.find({"case_id": case_id}).sort("submitted_at", -1).to_list(100)
    return scrub_many(clean_many(reviews), user)


# ---------------------------------------------------------------- notifications
@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    query = {"user_id": user["id"]}
    if user["role"] == "CLIENT":
        # Belt and braces: a notification must belong to this client AND reference either no
        # case or a case they actually own.
        owned = await _owned_case_ids(user)
        query["$or"] = [{"case_id": None}, {"case_id": {"$in": owned}}]
    items = await db.notifications.find(query).sort("created_at", -1).to_list(200)
    if user["role"] in ("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"):
        # Notifications raised by automated-test cases must not clutter operational staff views.
        test_ids = {c["id"] async for c in db.cases.find({"is_test": True}, {"id": 1})}
        items = [i for i in items if i.get("case_id") not in test_ids][:100]
    else:
        items = items[:100]
    return scrub_many(clean_many(items), user)


@api.post("/notifications/{notification_id}/read")
async def read_notification(notification_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": notification_id, "user_id": user["id"]},
                                      {"$set": {"is_read": True}})
    return {"ok": True}


@api.post("/notifications/read-all")
async def read_all(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"is_read": True}})
    return {"ok": True}


@api.get("/notifications/unread-count")
async def unread_count(user: dict = Depends(get_current_user)):
    items = await list_notifications(user)
    return {"count": sum(1 for n in items if not n.get("is_read"))}


# ---------------------------------------------------------------- client profile & settings
class ProfileIn(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class EmailChangeIn(BaseModel):
    new_email: str


class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str


class PrefsIn(BaseModel):
    preferences: dict


class DataRequestIn(BaseModel):
    kind: str
    reason: Optional[str] = None


NOTIFICATION_PREF_KEYS = [
    "accountant_message", "document_requested", "calculation_ready",
    "approval_required", "submission_update", "payment_update",
]


def _mask_utr(utr: Optional[str]) -> Optional[str]:
    if not utr:
        return None
    tail = str(utr)[-4:]
    return f"{'*' * max(len(str(utr)) - 4, 0)}{tail}"


@api.get("/my-profile")
async def my_profile(user: dict = Depends(require_roles("CLIENT"))):
    client = await _client_record(user)
    prefs = await db.notification_preferences.find_one({"user_id": user["id"]}) or {}
    pending_email = await db.email_change_requests.find_one(
        {"user_id": user["id"], "status": "PENDING"})
    return {
        "name": user["name"], "email": user["email"],
        "phone": (client or {}).get("phone"), "address": (client or {}).get("address"),
        "client_ref": (client or {}).get("client_ref"),
        # UTR is masked by default and is never casually editable by the client.
        "utr_masked": _mask_utr((client or {}).get("utr")),
        "utr_on_record": bool((client or {}).get("utr")),
        "pending_email_change": pending_email["new_email"] if pending_email else None,
        "preferences": {k: prefs.get("preferences", {}).get(k, True) for k in NOTIFICATION_PREF_KEYS},
    }


@api.get("/my-profile/utr")
async def reveal_utr(user: dict = Depends(require_roles("CLIENT"))):
    client = await _client_record(user)
    return {"utr": (client or {}).get("utr")}


@api.patch("/my-profile")
async def update_my_profile(body: ProfileIn, user: dict = Depends(require_roles("CLIENT"))):
    if body.name:
        await db.users.update_one({"id": user["id"]}, {"$set": {"name": body.name}})
    updates = {k: v for k, v in {"phone": body.phone, "address": body.address}.items()
               if v is not None}
    if body.name:
        updates["name"] = body.name
    if updates:
        await db.clients.update_one({"user_id": user["id"]}, {"$set": updates})
    if body.name:
        # The client's name is denormalised onto their cases for staff views -- keep every copy
        # in step so one client always resolves to the same identity everywhere.
        await db.cases.update_many({"client_user_id": user["id"]},
                                   {"$set": {"client_name": body.name}})
    if updates:
        # Audit who changed which personal details and when -- values themselves are not logged.
        await db.activity_logs.insert_one({
            "id": str(uuid.uuid4()), "case_id": None, "action": "Personal details updated",
            "user_id": user["id"], "user_name": body.name or user["name"], "role": user["role"],
            "meta": {"fields": sorted(updates.keys())}, "created_at": now_iso(),
        })
    return await my_profile(user)


@api.post("/my-profile/email-change")
async def request_email_change(body: EmailChangeIn, user: dict = Depends(require_roles("CLIENT"))):
    """Email changes are verified, never applied straight away."""
    new_email = body.new_email.strip().lower()
    if "@" not in new_email:
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    if await db.users.find_one({"email": new_email}):
        raise HTTPException(status_code=400, detail="That email address is already in use")
    existing = await db.email_change_requests.find_one({"user_id": user["id"], "status": "PENDING"})
    if existing:
        await db.email_change_requests.update_one(
            {"id": existing["id"]}, {"$set": {"new_email": new_email, "created_at": now_iso()}})
        return {"ok": True, "status": "PENDING", "duplicate_prevented": True}
    await db.email_change_requests.insert_one({
        "id": str(uuid.uuid4()), "user_id": user["id"], "current_email": user["email"],
        "new_email": new_email, "status": "PENDING", "created_at": now_iso(),
    })
    async for admin in db.users.find({"role": {"$in": ["ADMIN", "SUPER_ADMIN"]}}):
        await notify(admin["id"], "Email change verification requested",
                     f"{user['name']} asked to change their sign-in email.", None,
                     "/admin", "SECURITY")
    return {"ok": True, "status": "PENDING"}


@api.post("/my-profile/change-password")
async def change_my_password(body: PasswordChangeIn, user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    if not verify_password(body.current_password, full["password_hash"]):
        raise HTTPException(status_code=400, detail="Your current password is not correct")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Choose a password of at least 8 characters")
    check_password_strength(body.new_password, user.get("email"), user.get("name"))
    await db.users.update_one({"id": user["id"]},
                             {"$set": {"password_hash": hash_password(body.new_password)}})
    # A password change ends every other session, so a stolen session cannot survive it.
    await db.refresh_tokens.update_many({"user_id": user["id"], "revoked_at": None},
                                        {"$set": {"revoked_at": datetime.now(timezone.utc)}})
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()), "case_id": None, "action": "Password changed",
        "user_id": user["id"], "user_name": user["name"], "role": user["role"],
        "meta": {}, "created_at": now_iso(),
    })
    return {"ok": True}


@api.patch("/my-preferences")
async def update_prefs(body: PrefsIn, user: dict = Depends(require_roles("CLIENT"))):
    prefs = {k: bool(body.preferences.get(k, True)) for k in NOTIFICATION_PREF_KEYS}
    await db.notification_preferences.update_one(
        {"user_id": user["id"]}, {"$set": {"user_id": user["id"], "preferences": prefs}},
        upsert=True)
    return {"preferences": prefs}


@api.post("/my-data-requests")
async def create_data_request(body: DataRequestIn, user: dict = Depends(require_roles("CLIENT"))):
    """Data export / account closure requests are controlled. Closure never destroys records
    that must be retained for tax and accounting purposes."""
    if body.kind not in ("DATA_EXPORT", "ACCOUNT_CLOSURE"):
        raise HTTPException(status_code=400, detail="Unknown request type")
    existing = await db.data_requests.find_one({"user_id": user["id"], "kind": body.kind,
                                                "status": "PENDING"})
    if existing:
        return {"ok": True, "status": "PENDING", "duplicate_prevented": True}
    await db.data_requests.insert_one({
        "id": str(uuid.uuid4()), "user_id": user["id"], "user_name": user["name"],
        "kind": body.kind, "reason": body.reason, "status": "PENDING", "created_at": now_iso(),
    })
    async for admin in db.users.find({"role": {"$in": ["ADMIN", "SUPER_ADMIN"]}}):
        await notify(admin["id"], "Client data request",
                     f"{user['name']} submitted a {body.kind.replace('_', ' ').lower()} request.",
                     None, "/admin", "REQUEST")
    return {"ok": True, "status": "PENDING"}


@api.get("/my-data-requests")
async def list_my_data_requests(user: dict = Depends(require_roles("CLIENT"))):
    rows = await db.data_requests.find({"user_id": user["id"]}).sort("created_at", -1).to_list(20)
    return clean_many(rows)


# ---------------------------------------------------------------- help centre
class FaqIn(BaseModel):
    category: str
    question: str
    answer: str
    order: int = 0


@api.get("/faqs")
async def list_faqs(category: Optional[str] = None, q: Optional[str] = None,
                    user: dict = Depends(get_current_user)):
    query = {"is_active": True}
    if category:
        query["category"] = category
    rows = await db.faqs.find(query).sort("order", 1).to_list(300)
    rows = clean_many(rows)
    if q:
        needle = q.lower()
        rows = [r for r in rows
                if needle in r["question"].lower() or needle in r["answer"].lower()
                or needle in r["category"].lower()]
    return rows


@api.get("/faq-categories")
async def faq_categories(user: dict = Depends(get_current_user)):
    return FAQ_CATEGORIES


@api.post("/faqs")
async def create_faq(body: FaqIn, user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    row = {"id": str(uuid.uuid4()), "category": body.category, "question": body.question,
           "answer": body.answer, "order": body.order, "is_active": True,
           "updated_by": user["name"], "created_at": now_iso()}
    await db.faqs.insert_one(dict(row))
    return clean(row)


@api.patch("/faqs/{faq_id}")
async def update_faq(faq_id: str, body: FaqIn,
                     user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    res = await db.faqs.update_one({"id": faq_id}, {"$set": {
        "category": body.category, "question": body.question, "answer": body.answer,
        "order": body.order, "updated_by": user["name"], "updated_at": now_iso()}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="FAQ not found")
    return {"ok": True}


@api.delete("/faqs/{faq_id}")
async def delete_faq(faq_id: str, user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    await db.faqs.update_one({"id": faq_id}, {"$set": {"is_active": False}})
    return {"ok": True}


# ---------------------------------------------------------------- stats
async def _count(query):
    return await db.cases.count_documents({**query, **OPERATIONAL_ONLY})


@api.get("/stats/admin")
async def admin_stats(user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    active = {"$nin": ["SUBMITTED", "COMPLETED"]}
    return {
        "new": await _count({"status": {"$in": ["NEW", "ONBOARDING", "AWAITING_ASSIGNMENT"]}}),
        "unassigned": await _count({"assigned_accountant_id": None}),
        "in_progress": await _count({"status": {"$in": ["ASSIGNED", "ACCOUNTANT_REVIEW", "IN_PREPARATION", "CHANGES_REQUIRED"]}}),
        "waiting_client": await _count({"status": "AWAITING_CLIENT"}),
        "admin_review": await _count({"status": {"$in": ["READY_FOR_ADMIN_REVIEW", "ADMIN_REVIEW"]}}),
        "client_approval": await _count({"status": {"$in": ["ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL"]}}),
        "awaiting_admin_review": await _count({"status": {"$in": ["READY_FOR_ADMIN_REVIEW", "ADMIN_REVIEW"]}}),
        "awaiting_client_approval": await _count({"status": {"$in": ["ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL"]}}),
        "ready_submission": await _count({"status": {"$in": ["CLIENT_APPROVED", "READY_FOR_SUBMISSION"]}}),
        "assigned": await _count({"assigned_accountant_id": {"$ne": None}, "status": active}),
        "changes_required": await _count({"status": "CHANGES_REQUIRED"}),
        "submitted": await _count({"status": {"$in": ["SUBMITTED", "SUBMISSION_IN_PROGRESS"]}}),
        "case_completed": await _count({"status": "COMPLETED"}),
        "attention": await _count({"$or": [{"status": "SUBMISSION_ISSUE"},
                                           {"internal_deadline": {"$lt": now_iso()}, "status": active}]}),
        "overdue": await _count({"internal_deadline": {"$lt": now_iso()}, "status": active}),
    }


@api.get("/stats/accountant")
async def accountant_stats(user: dict = Depends(require_roles("ACCOUNTANT"))):
    base = {"assigned_accountant_id": user["id"]}
    active = {"$nin": ["SUBMITTED", "COMPLETED"]}
    week = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    today = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    return {
        "needs_my_action": await _count({**base, "next_action_owner": "ACCOUNTANT", "status": active}),
        "due_today": await _count({**base, "internal_deadline": {"$lte": today}, "status": active}),
        "due_week": await _count({**base, "internal_deadline": {"$lte": week}, "status": active}),
        "awaiting_client": await _count({**base, "status": "AWAITING_CLIENT"}),
        "new_assigned": await _count({**base, "status": "ASSIGNED"}),
        "in_progress": await _count({**base, "status": {"$in": ["ACCOUNTANT_REVIEW", "IN_PREPARATION"]}}),
        "changes_required": await _count({**base, "status": "CHANGES_REQUIRED"}),
        "awaiting_admin_review": await _count({**base, "status": {"$in": ["READY_FOR_ADMIN_REVIEW", "ADMIN_REVIEW"]}}),
        "approved_ready": await _count({**base, "status": {"$in": ["ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL", "CLIENT_APPROVED", "READY_FOR_SUBMISSION"]}}),
        "case_completed": await _count({**base, "status": {"$in": ["SUBMITTED", "COMPLETED"]}}),
        "ready_for_admin": await _count({**base, "status": {"$in": ["READY_FOR_ADMIN_REVIEW", "ADMIN_REVIEW"]}}),
        "admin_changes": await _count({**base, "status": "CHANGES_REQUIRED"}),
        "completed": await _count({**base, "status": {"$in": ["SUBMITTED", "COMPLETED", "READY_FOR_SUBMISSION"]}}),
    }


@api.get("/accountants/workload")
async def accountant_workload(user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    out = []
    week = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    active = {"$nin": ["SUBMITTED", "COMPLETED"]}
    async for acc in db.users.find({"role": "ACCOUNTANT", "is_active": True, **OPERATIONAL_ONLY}):
        base = {"assigned_accountant_id": acc["id"]}
        profile = await db.accountant_profiles.find_one({"user_id": acc["id"]})
        capacity = (profile or {}).get("capacity", 15)
        active_cases = await _count({**base, "status": active})
        out.append({
            "id": acc["id"], "name": acc["name"], "email": acc["email"],
            "active_cases": active_cases,
            "waiting_client": await _count({**base, "status": "AWAITING_CLIENT"}),
            "due_this_week": await _count({**base, "internal_deadline": {"$lte": week}, "status": active}),
            "overdue": await _count({**base, "internal_deadline": {"$lt": now_iso()}, "status": active}),
            "capacity": capacity,
            "availability": "Available" if active_cases < capacity else "At Capacity",
        })
    return out


# ---------------------------------------------------------------- super admin
@api.get("/users")
async def list_users(role: Optional[str] = None, email: Optional[str] = None,
                     include_test: bool = False,
                     user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    """Staff directory lookup.

    The list is capped, so an exact `email` lookup is resolved server-side rather than by
    scanning a truncated page -- otherwise an older account can silently fall off the end
    once enough newer accounts exist.
    """
    query = {}
    if role:
        query["role"] = role
    if email:
        query["email"] = email.strip().lower()
    if not include_test:
        # Automated-test accounts stay in the database but leave the operational directory.
        # Filtered in the query so they cannot consume the result cap and push genuine
        # (older) accounts off the end of the list.
        query["email"] = query.get("email") or {"$not": {"$regex": TEST_EMAIL_REGEX}}
        query["is_test"] = {"$ne": True}
    users = await db.users.find(query).sort("created_at", -1).to_list(500)
    users = clean_many(users)
    for u in users:
        if u.get("status") == "PENDING":
            invite = await db.staff_invites.find_one(
                {"user_id": u["id"], "used_at": None, "revoked_at": None},
                sort=[("created_at", -1)])
            # Only the expiry is exposed -- never the token.
            u["invite_expires_at"] = invite.get("expires_at") if invite else None
    return mask_contact_many(users, user)


@api.post("/clients/{client_user_id}/reveal-contact")
async def reveal_contact(client_user_id: str, body: ReasonIn,
                         user: dict = Depends(require_roles("SUPER_ADMIN"))):
    """Authorised full-contact reveal — recorded in the audit trail."""
    if not body.reason.strip():
        raise HTTPException(status_code=400, detail="A reason is required")
    target = await db.users.find_one({"id": client_user_id, "role": "CLIENT"})
    if not target:
        raise HTTPException(status_code=404, detail="Client not found")
    await db.contact_access_audit.insert_one({
        "id": str(uuid.uuid4()), "client_user_id": client_user_id,
        "client_name": target["name"], "accessed_by": user["name"], "role": user["role"],
        "reason": body.reason, "created_at": now_iso(),
    })
    return {"email": target["email"], "phone": target.get("phone"),
            "name": target["name"], "utr": target.get("utr")}


@api.get("/contact-access-log")
async def contact_access_log(user: dict = Depends(require_roles("SUPER_ADMIN"))):
    rows = await db.contact_access_audit.find({}).sort("created_at", -1).to_list(200)
    return clean_many(rows)


@api.post("/users")
async def create_user(body: CreateUserIn, user: dict = Depends(require_roles("SUPER_ADMIN"))):
    if body.role not in ("CLIENT", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=400, detail="Invalid role")
    if await db.users.find_one({"email": body.email.lower()}):
        raise HTTPException(status_code=400, detail="Email already exists")
    new = {"id": str(uuid.uuid4()), "email": body.email.lower(), "name": body.name,
           "role": body.role, "password_hash": hash_password(body.password),
           "phone": body.phone, "is_active": True, "created_at": now_iso()}
    await db.users.insert_one(dict(new))
    if body.role == "CLIENT":
        client = {"id": str(uuid.uuid4()), "user_id": new["id"], "name": body.name,
                  "email": new["email"], "phone": body.phone,
                  "is_test": is_test_email(new["email"]), "created_at": now_iso()}
        count = await db.clients.count_documents({})
        client["client_ref"] = f"CL-{42 + count:04d}"
        await db.clients.insert_one(dict(client))
        await bootstrap_client_services(client)
    if body.role == "ACCOUNTANT":
        await db.accountant_profiles.insert_one({"id": str(uuid.uuid4()), "user_id": new["id"],
                                                 "name": body.name, "email": new["email"],
                                                 "specialisms": ["SELF_ASSESSMENT"], "capacity": 15,
                                                 "is_active": True, "created_at": now_iso()})
    return clean(new)


@api.patch("/users/{user_id}/active")
async def toggle_user(user_id: str, is_active: bool = Query(...),
                      user: dict = Depends(require_roles("SUPER_ADMIN"))):
    await db.users.update_one({"id": user_id}, {"$set": {"is_active": is_active}})
    # Deactivation keeps every historical record; only the login and new assignments stop.
    open_cases = 0
    if not is_active:
        open_cases = await db.cases.count_documents({
            "assigned_accountant_id": user_id,
            "status": {"$nin": ["COMPLETED", "SUBMITTED"]},
            **OPERATIONAL_ONLY})
        await db.accountant_profiles.update_one({"user_id": user_id},
                                               {"$set": {"is_active": False}})
        await log_activity(None, "Staff account deactivated", user,
                           {"target_user_id": user_id, "active_cases": open_cases})
    else:
        await db.accountant_profiles.update_one({"user_id": user_id},
                                               {"$set": {"is_active": True}})
    return {"ok": True, "active_cases_needing_reassignment": open_cases}


# ------------------------------------------------------------- staff invitations
@api.post("/staff-invites")
async def invite_staff(body: StaffInviteIn, request: Request,
                       user: dict = Depends(require_roles("SUPER_ADMIN"))):
    """Creates a pending staff account and a single-use setup link. No password is set here."""
    if body.role not in ("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=400, detail="Invalid role")
    email = body.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already exists")
    new = {"id": str(uuid.uuid4()), "email": email, "name": body.name.strip(),
           "role": body.role, "password_hash": None, "phone": None,
           "is_active": False, "status": "PENDING", "created_at": now_iso()}
    await db.users.insert_one(dict(new))
    if body.role == "ACCOUNTANT":
        await db.accountant_profiles.update_one(
            {"user_id": new["id"]},
            {"$set": {"name": new["name"], "email": email,
                      "specialisms": body.specialisms,
                      "capacity": body.capacity if body.capacity is not None else 15,
                      "is_active": False},
             "$setOnInsert": {"id": str(uuid.uuid4()), "user_id": new["id"],
                              "created_at": now_iso()}},
            upsert=True)
    invite = await issue_invite(new["id"], email, user["id"])
    await log_activity(None, f"Staff invitation sent to {email}", user,
                       {"target_user_id": new["id"], "role": body.role})
    origin = request.headers.get("origin") or ""
    return {"user": clean(new), "setup_link": f"{origin}/invite/{invite['token']}",
            "expires_at": invite["expires_at"]}


@api.post("/staff-invites/{user_id}/resend")
async def resend_invite(user_id: str, request: Request,
                        user: dict = Depends(require_roles("SUPER_ADMIN"))):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("status") != "PENDING":
        raise HTTPException(status_code=400, detail="This account is already active")
    invite = await issue_invite(user_id, target["email"], user["id"])
    await log_activity(None, f"Staff invitation resent to {target['email']}", user,
                       {"target_user_id": user_id})
    origin = request.headers.get("origin") or ""
    return {"setup_link": f"{origin}/invite/{invite['token']}",
            "expires_at": invite["expires_at"]}


@api.get("/auth/invite/{token}")
async def check_invite(token: str):
    invite = await find_valid_invite(token)
    if not invite:
        raise HTTPException(status_code=400, detail="This invitation is no longer valid")
    target = await db.users.find_one({"id": invite["user_id"]})
    return {"name": target["name"], "email": target["email"], "role": target["role"]}


@api.post("/auth/invite/{token}/accept")
async def accept_invite(token: str, body: AcceptInviteIn):
    invite = await find_valid_invite(token)
    if not invite:
        raise HTTPException(status_code=400, detail="This invitation is no longer valid")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    check_password_strength(body.password)
    await db.users.update_one({"id": invite["user_id"]}, {"$set": {
        "password_hash": hash_password(body.password), "is_active": True,
        "status": "ACTIVE", "activated_at": now_iso()}})
    await db.accountant_profiles.update_one({"user_id": invite["user_id"]},
                                            {"$set": {"is_active": True}})
    await consume_invite(invite["id"])
    target = await db.users.find_one({"id": invite["user_id"]})
    await log_activity(None, "Staff account activated via invitation", target,
                       {"target_user_id": invite["user_id"]})
    return {"ok": True}


@api.get("/services")
async def list_services(user: dict = Depends(get_current_user)):
    return clean_many(await db.services.find({}).to_list(50))


@api.get("/workflow/settings")
async def workflow_settings(user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    return {"statuses": STATUSES, "meta": {k: {"stage": v[0], "next_action": v[1], "owner": v[2]}
                                           for k, v in STATUS_META.items()}}


@api.get("/audit-log")
async def audit_log(case_ref: Optional[str] = None, user_name: Optional[str] = None,
                    action: Optional[str] = None, date_from: Optional[str] = None,
                    date_to: Optional[str] = None, include_test: bool = False,
                    limit: int = 100, skip: int = 0,
                    user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    """Genuine operational activity, newest first. Nothing is ever deleted -- automated-test
    activity is only filtered out, and can be included on request."""
    query = {}
    if user_name:
        query["user_name"] = {"$regex": user_name, "$options": "i"}
    if action:
        query["action"] = {"$regex": action, "$options": "i"}
    if date_from or date_to:
        query["created_at"] = {}
        if date_from:
            query["created_at"]["$gte"] = date_from
        if date_to:
            query["created_at"]["$lte"] = date_to + "T23:59:59"
    # Audit and payment lists page through the data instead of loading everything.
    logs = await db.activity_logs.find(query).sort("created_at", -1).skip(skip).to_list(limit + 200)
    logs = clean_many(logs)
    case_ids = list({l["case_id"] for l in logs if l.get("case_id")})
    cases = {c["id"]: c async for c in db.cases.find(
        {"id": {"$in": case_ids}}, {"id": 1, "case_ref": 1, "client_name": 1, "is_test": 1})}
    out = []
    for l in logs:
        case = cases.get(l.get("case_id"))
        if not include_test and l.get("case_id") and (case is None or case.get("is_test")):
            # Test-case activity, including activity whose test case has already been cleaned.
            continue
        l["case_ref"] = case["case_ref"] if case else None
        l["client_name"] = case["client_name"] if case else None
        if case_ref and (l["case_ref"] or "").lower() != case_ref.strip().lower():
            continue
        out.append(l)
    return out[:limit]


SERVICE_LABELS_ALL = {"SELF_ASSESSMENT": "Self Assessment", "MTD_INCOME_TAX": "MTD for Income Tax"}


@api.get("/my-actions")
async def my_actions(user: dict = Depends(require_roles("CLIENT"))):
    """Single Action Required feed for the client across every service."""
    outstanding, history = [], []
    owned = set(await _owned_case_ids(user))
    seen_history = set()
    async for t in db.tasks.find({"owner_id": user["id"], "case_id": {"$in": list(owned)}}
                                ).sort("created_at", -1):
        case = await db.cases.find_one({"id": t["case_id"]})
        item = {
            "id": t["id"], "type": "TASK", "action": t["name"], "description": t.get("description"),
            "service_type": case["service_type"] if case else None,
            "service_name": SERVICE_LABELS_ALL.get(case["service_type"]) if case else None,
            "case_id": t["case_id"], "case_ref": t.get("case_ref"),
            "due_date": t.get("due_date"), "status": t["status"],
            "mtd_period_label": t.get("mtd_period_label"),
            "link": "/mtd" if t.get("mtd_period_id") else "/tasks",
            "completed_date": t.get("completed_date"), "created_at": t["created_at"],
        }
        if t["status"] == "COMPLETED":
            # One completed request must produce exactly one completed-history entry.
            key = (t["name"], t["case_id"], (t.get("completed_date") or "")[:10])
            if key in seen_history:
                continue
            seen_history.add(key)
            history.append(item)
        else:
            outstanding.append(item)

    async for c in db.cases.find({"client_user_id": user["id"], "id": {"$in": list(owned)},
                                  "status": {"$in": ["ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL"]}}):
        outstanding.append({
            "id": f"approve-{c['id']}", "type": "APPROVAL",
            "action": "Review and approve your tax return",
            "description": "Your return has been approved internally and is ready for your approval.",
            "service_type": c["service_type"],
            "service_name": SERVICE_LABELS_ALL.get(c["service_type"]),
            "case_id": c["id"], "case_ref": c["case_ref"], "due_date": c.get("external_deadline"),
            "status": "OPEN", "link": "/my-return", "created_at": c["last_updated"],
        })

    async for o in db.offers.find({"client_user_id": user["id"], "status": "PENDING"}):
        outstanding.append({
            "id": o["id"], "type": "RECOMMENDATION",
            "action": f"Review recommended service: {o.get('service_name')}",
            "description": "Your accountant recommended this and our team has approved it for review.",
            "service_type": o["service_type"], "service_name": o.get("service_name"),
            # A recommendation is account-level, not tied to a case.
            "case_id": None, "recommendation_id": o.get("recommendation_id"),
            "case_ref": None, "due_date": None,
            "status": "OPEN", "link": f"/recommendation/{o['id']}", "created_at": o["created_at"],
        })

    return {"outstanding": outstanding, "history": history}


@api.get("/overview")
async def business_overview(user: dict = Depends(require_roles("SUPER_ADMIN"))):
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0,
                                                     microsecond=0).isoformat()
    year_start = datetime.now(timezone.utc).replace(month=1, day=1, hour=0, minute=0, second=0,
                                                    microsecond=0).isoformat()
    active = {"$nin": ["SUBMITTED", "COMPLETED"]}
    # Reporting uses the same genuine-record rule as the operational Admin/accountant views.
    genuine_clients = {c["id"] async for c in db.clients.find(OPERATIONAL_ONLY, {"id": 1})}
    genuine_client_users = {c["user_id"] async for c in db.clients.find(OPERATIONAL_ONLY,
                                                                       {"user_id": 1})}

    sa_active = {c["client_id"] async for c in db.client_services.find(
        {"service_type": "SELF_ASSESSMENT", "status": "ACTIVE"}) if c["client_id"] in genuine_clients}
    mtd_active = {c["client_id"] async for c in db.client_services.find(
        {"service_type": "MTD_INCOME_TAX", "status": "ACTIVE"}) if c["client_id"] in genuine_clients}

    paid_rows = await db.payment_transactions.aggregate([
        {"$match": {"payment_status": "paid", "user_id": {"$in": list(genuine_client_users)}}},
        {"$project": {"amount": 1, "created_at": 1, "service_type": 1, "kind": 1}},
    ]).to_list(None)
    paid = paid_rows

    def total(rows):
        return round(sum(r.get("amount", 0) for r in rows), 2)

    per_accountant = []
    async for a in db.users.find({"role": "ACCOUNTANT", "is_active": True, **OPERATIONAL_ONLY}):
        per_accountant.append({
            "name": a["name"],
            "open_cases": await _count({"assigned_accountant_id": a["id"], "status": active}),
            "completed_cases": await _count({"assigned_accountant_id": a["id"],
                                             "status": "COMPLETED"}),
        })

    failed = await db.payment_transactions.count_documents({
        "payment_status": {"$in": ["failed", "expired"]},
        "user_id": {"$in": list(genuine_client_users)}})

    return {
        "clients": {
            "total": await db.clients.count_documents(OPERATIONAL_ONLY),
            "new_this_month": await db.clients.count_documents({"created_at": {"$gte": month_start},
                                                               **OPERATIONAL_ONLY}),
            "active_self_assessment": len(sa_active),
            "active_mtd": len(mtd_active),
            "both_services": len(sa_active & mtd_active),
        },
        "cases": {
            "open": await _count({"status": active}),
            "completed": await _count({"status": "COMPLETED"}),
            "overdue": await _count({"internal_deadline": {"$lt": now_iso()}, "status": active}),
            "per_accountant": per_accountant,
        },
        "revenue": {
            "this_month": total([p for p in paid if p["created_at"] >= month_start]),
            "this_year": total([p for p in paid if p["created_at"] >= year_start]),
            "self_assessment": total([p for p in paid if p.get("service_type") == "SELF_ASSESSMENT"]),
            "mtd": total([p for p in paid if p.get("service_type") == "MTD_INCOME_TAX"]),
            "package_upgrades": total([p for p in paid if p.get("kind") == "SA_UPGRADE"]),
            "successful_payments": len(paid),
            "failed_payments": failed,
            "note": "Revenue is summed from unique genuine successful payment transactions only. "
                    "Self Assessment and MTD are the service categories and add up to the total; "
                    "package upgrades are a subset of Self Assessment revenue, not additional "
                    "revenue. Automated-test transactions are excluded.",
        },
    }


# ------------------------------------------------------- final client documents
FINAL_STAGES = ("READY_FOR_SUBMISSION", "SUBMITTED", "COMPLETED")


@api.post("/cases/{case_id}/final-documents")
async def publish_final_document(case_id: str,
                                 document_type: str = Form("Final tax return"),
                                 file: UploadFile = File(...),
                                 user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    """Publishes the final client copy. Each publish is a new immutable version, so a case
    that is reopened and re-completed keeps every earlier final document as evidence."""
    case = await _get_case(case_id, user)
    if case.get("service_type") == "MTD_INCOME_TAX":
        # MTD has its own workflow: the final client copy follows the submitted Final Declaration.
        final = await db.mtd_periods.find_one({"case_id": case_id,
                                              "kind": "FINAL_DECLARATION"})
        if not final or final.get("status") != "SUBMITTED":
            raise HTTPException(status_code=400,
                                detail="The Final Declaration must be submitted before the "
                                       "final client copy can be published")
    elif case["status"] not in FINAL_STAGES:
        raise HTTPException(status_code=400,
                            detail="The final client copy can only be published once the "
                                   "return is approved and ready for submission")
    data = await file.read()
    validate_upload(file.content_type, len(data), file.filename)
    ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
    result = put_object(f"{APP_NAME}/final/{case_id}/{uuid.uuid4()}.{ext}", data,
                        file.content_type or "application/octet-stream")
    version = await db.documents.count_documents({"case_id": case_id, "is_final": True}) + 1
    record = {
        "id": str(uuid.uuid4()), "case_id": case_id, "case_ref": case["case_ref"],
        "client_user_id": case["client_user_id"], "tax_year": case["tax_year"],
        "document_type": document_type, "name": file.filename, "status": "Final",
        "storage_path": result["path"], "uploader_id": user["id"], "uploader_name": user["name"],
        "content_type": file.content_type, "size": result.get("size", len(data)),
        "is_internal": False, "is_final": True, "final_version": version, "is_deleted": False,
        "published_at": now_iso(), "upload_date": now_iso(), "created_at": now_iso(),
    }
    await db.documents.insert_one(dict(record))
    await log_activity(case_id,
                       f"Final client document published: {file.filename} (version {version})",
                       user)
    await notify(case["client_user_id"], "Your final documents are available",
                 f"{document_type} for {case['tax_year']} is ready to download.",
                 case_id, "/documents", "INFO")
    return clean(record)


@api.get("/cases/{case_id}/final-documents")
async def list_final_documents(case_id: str, user: dict = Depends(get_current_user)):
    await _get_case(case_id, user)
    rows = await db.documents.find({"case_id": case_id, "is_final": True,
                                    "is_deleted": {"$ne": True}}).sort("final_version", -1).to_list(100)
    return scrub_many(clean_many(rows), user)


# ------------------------------------------------------- service issues / complaints
ISSUE_STATUSES = ("OPEN", "IN_REVIEW", "RESOLVED")


class ServiceIssueIn(BaseModel):
    category: str
    subject: str
    description: str
    case_id: Optional[str] = None


class ServiceIssueUpdate(BaseModel):
    status: str
    resolution: Optional[str] = None


def _issue_for_accountant(row: dict) -> dict:
    """An accountant may see that an issue exists on their case, never manage it."""
    return {k: row[k] for k in ("id", "case_id", "case_ref", "category", "status",
                                "created_at", "resolved_at") if k in row}


@api.post("/service-issues")
async def create_service_issue(body: ServiceIssueIn,
                               user: dict = Depends(require_roles("CLIENT"))):
    if not body.subject.strip() or not body.description.strip():
        raise HTTPException(status_code=400, detail="A subject and description are required")
    case = None
    if body.case_id:
        case = await _get_case(body.case_id, user)
    row = {
        "id": str(uuid.uuid4()), "client_user_id": user["id"], "client_name": user["name"],
        "case_id": body.case_id, "case_ref": case["case_ref"] if case else None,
        "service_type": case["service_type"] if case else None,
        "category": body.category, "subject": body.subject.strip(),
        "description": body.description.strip(), "status": "OPEN",
        "resolution": None, "resolved_at": None, "resolved_by_name": None,
        "handled_by_name": None, "is_test": bool(user.get("is_test")),
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.service_issues.insert_one(dict(row))
    # Complaints are recorded alongside the case history but never change its workflow.
    await log_activity(body.case_id, f"Service issue raised by client: {row['subject']}", user,
                       meta={"service_issue_id": row["id"], "category": body.category})
    async for admin in db.users.find({"role": {"$in": ["ADMIN", "SUPER_ADMIN"]},
                                      "is_active": True}):
        await notify(admin["id"], "Service issue raised",
                     f"{user['name']}: {row['subject']}", body.case_id,
                     "/admin/service-issues", "CHANGES")
    return clean(row)


@api.get("/service-issues")
async def list_service_issues(status: Optional[str] = None, case_id: Optional[str] = None,
                              include_test: bool = False,
                              user: dict = Depends(get_current_user)):
    query: dict = {}
    if status:
        query["status"] = status
    if case_id:
        query["case_id"] = case_id
    if user["role"] == "CLIENT":
        query["client_user_id"] = user["id"]
    elif user["role"] == "ACCOUNTANT":
        ids = [c["id"] async for c in db.cases.find({"assigned_accountant_id": user["id"]},
                                                    {"id": 1})]
        query["case_id"] = {"$in": ids} if not case_id else case_id
        if case_id and case_id not in ids:
            raise HTTPException(status_code=403, detail="Not allowed")
    elif not include_test:
        query.update(OPERATIONAL_ONLY)
    rows = clean_many(await db.service_issues.find(query).sort("created_at", -1).to_list(300))
    if user["role"] == "ACCOUNTANT":
        return [_issue_for_accountant(r) for r in rows]
    return rows


@api.patch("/service-issues/{issue_id}")
async def update_service_issue(issue_id: str, body: ServiceIssueUpdate,
                               user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    row = await db.service_issues.find_one({"id": issue_id})
    if not row:
        raise HTTPException(status_code=404, detail="Service issue not found")
    if body.status not in ISSUE_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    if body.status == "RESOLVED" and not (body.resolution or "").strip():
        raise HTTPException(status_code=400,
                            detail="A resolution message for the client is required")
    update = {"status": body.status, "updated_at": now_iso(),
              "handled_by_name": user["name"]}
    if body.resolution is not None:
        update["resolution"] = body.resolution.strip() or None
    if body.status == "RESOLVED":
        update["resolved_at"] = now_iso()
        update["resolved_by_name"] = user["name"]
    await db.service_issues.update_one({"id": issue_id}, {"$set": update})
    await log_activity(row.get("case_id"),
                       f"Service issue '{row['subject']}' set to {body.status}", user,
                       meta={"service_issue_id": issue_id}, comments=body.resolution)
    await notify(row["client_user_id"],
                 "Update on your service issue" if body.status != "RESOLVED"
                 else "Your service issue has been resolved",
                 row["subject"], row.get("case_id"), "/service-issues", "INFO")
    return clean({**row, **update})


# ------------------------------------------------------- reopen history (derived from audit)
@api.get("/cases/{case_id}/reopen-history")
async def reopen_history(case_id: str,
                         user: dict = Depends(require_roles("ACCOUNTANT", "ADMIN",
                                                            "SUPER_ADMIN"))):
    """Derived from the existing activity log — no second source of truth is stored."""
    await _get_case(case_id, user)
    logs = await db.activity_logs.find({"case_id": case_id}).sort("created_at", 1).to_list(500)
    completed_at = [l["created_at"] for l in logs if l.get("new_status") == "COMPLETED"]
    out = []
    for l in logs:
        if l.get("previous_status") == "COMPLETED" and l.get("new_status") != "COMPLETED":
            before = [c for c in completed_at if c <= l["created_at"]]
            after = [c for c in completed_at if c > l["created_at"]]
            out.append({
                "reopened_by": l.get("user_name"), "reopened_by_role": l.get("role"),
                "reopened_at": l["created_at"], "reason": l.get("comments"),
                "action": l.get("action"), "new_status": l.get("new_status"),
                "previous_completed_at": before[-1] if before else None,
                "recompleted_at": after[0] if after else None,
            })
    return out


@api.get("/")
async def root():
    return {"message": "TaxSimba API"}

app.include_router(api)
app.include_router(phase1b_router)
app.include_router(mtd_router)
