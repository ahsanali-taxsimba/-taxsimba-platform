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
from ratelimit import (clear_failures, client_ip, enforce_login_allowed, ensure_indexes,
                       record_failure)
from seed import seed
from phase1b import bootstrap_client_services, ensure_phase1b_data, router as phase1b_router
from storage import init_storage, put_object, get_object, APP_NAME
from workflow import (ALLOWED_TRANSITIONS, STATUSES, STATUS_META, journey, log_activity, notify,
                      now_iso, transition)

app = FastAPI(title="TaxSimba")
api = APIRouter(prefix="/api")

CSRF_COOKIE = "csrf_token"


def _allowed_origins() -> List[str]:
    """Explicit allowlist only. A wildcard or empty value is a hard startup failure so the
    permissive '*' configuration can never silently return."""
    raw = os.environ.get("CORS_ORIGINS", "")
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    if not origins:
        raise RuntimeError("CORS_ORIGINS must list at least one approved origin")
    if any(o == "*" for o in origins):
        raise RuntimeError("CORS_ORIGINS must not contain a wildcard '*'")
    return origins


ALLOWED_ORIGINS = _allowed_origins()

app.add_middleware(
    CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await seed()
    await ensure_phase1b_data()
    await ensure_indexes()
    try:
        init_storage()
    except Exception as e:
        print(f"storage init failed: {e}")


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
    payment_deadline: str = "31 January 2026"
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
              "email": email, "phone": body.phone, "created_at": now_iso()}
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
    if not user or not verify_password(body.password, user["password_hash"]):
        await record_failure(ip, email)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account disabled")
    await clear_failures(ip, email)
    return await _auth_response(response, user, request)


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
async def _get_case(case_id: str, user: dict) -> dict:
    case = await db.cases.find_one({"id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if user["role"] == "CLIENT" and case["client_user_id"] != user["id"]:
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
    out = []
    for c in cases:
        c = clean(c)
        c["days_left"] = _days_left(c)
        last = await db.activity_logs.find_one({"case_id": c["id"]}, sort=[("created_at", -1)])
        c["last_activity"] = clean(last) if last else None
        out.append(c)
    return out


# ---------------------------------------------------------------- cases
@api.get("/cases")
async def list_cases(status: Optional[str] = None, bucket: Optional[str] = None,
                     accountant_id: Optional[str] = None, priority: Optional[str] = None,
                     tax_year: Optional[str] = None, service_type: Optional[str] = None,
                     q: Optional[str] = None,
                     user: dict = Depends(get_current_user)):
    query = {}
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
    if q:
        query["$or"] = [{"client_name": {"$regex": q, "$options": "i"}},
                        {"case_ref": {"$regex": q, "$options": "i"}}]

    cases = await db.cases.find(query).sort("last_updated", -1).to_list(500)
    return scrub_many(await _decorate(cases), user)


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
    count = await db.cases.count_documents({})
    case = {
        "id": str(uuid.uuid4()), "case_ref": f"SA-{1001 + count}",
        "client_id": client["id"] if client else None, "client_user_id": client_user_id,
        "client_name": client_user["name"], "service_type": body.service_type,
        "tax_year": body.tax_year, "assigned_accountant_id": None,
        "assigned_accountant_name": None, "admin_reviewer_id": None, "admin_reviewer_name": None,
        "status": "AWAITING_ASSIGNMENT", "current_stage": stage, "next_action": next_action,
        "next_action_owner": owner, "priority": "MEDIUM",
        "internal_deadline": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
        "external_deadline": "2026-01-31T23:59:00+00:00", "internal_instructions": None,
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
    case["journey"] = journey(case["status"])
    return scrub(case, user)


@api.post("/cases/{case_id}/assign")
async def assign_case(case_id: str, body: AssignIn,
                      user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    case = await _get_case(case_id, user)
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
                 case_id, "/tasks", "TASK")
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
        "payment_deadline": body.payment_deadline, "breakdown": body.breakdown or {},
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
    review = await db.reviews.find_one({"case_id": case_id, "outcome": "APPROVED"})
    approval = await db.client_approvals.find_one({"case_id": case_id})
    if not review or not case.get("approved_version_id"):
        raise HTTPException(status_code=400, detail="Admin approval is not complete")
    if not approval:
        raise HTTPException(status_code=400, detail="Client approval is not complete")
    if case["status"] != "READY_FOR_SUBMISSION":
        raise HTTPException(status_code=400, detail=f"Case must be READY_FOR_SUBMISSION (currently {case['status']})")
    blocking = await db.tasks.count_documents({"case_id": case_id, "status": "OPEN",
                                              "mandatory": True})
    if blocking:
        raise HTTPException(
            status_code=400,
            detail=f"{blocking} mandatory item(s) of tax information are still outstanding — "
                   "these must be resolved before a submission can be recorded")
    await db.submission_records.update_one(
        {"case_id": case_id},
        {"$set": {"status": "SUBMITTED", "submission_date": body.submission_date,
                  "reference": body.submission_reference, "submitted_by": user["id"],
                  "submitted_by_name": user["name"], "note": body.note,
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
    if service_type:
        ids = [c["id"] async for c in db.cases.find({"service_type": service_type})]
        query["case_id"] = {"$in": ids}
    if user["role"] == "CLIENT":
        query["owner_id"] = user["id"]
    elif user["role"] == "ACCOUNTANT" and not case_id:
        query["owner_id"] = user["id"]
    if case_id:
        await _get_case(case_id, user)
        query["case_id"] = case_id
        if user["role"] == "CLIENT":
            query["owner_role"] = "CLIENT"
    if status:
        query["status"] = status
    tasks = await db.tasks.find(query).sort("created_at", -1).to_list(300)
    return scrub_many(clean_many(tasks), user)


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
                         user: dict = Depends(get_current_user)):
    query = {}
    if service_type:
        ids = [c["id"] async for c in db.cases.find({"service_type": service_type})]
        query["case_id"] = {"$in": ids}
    if user["role"] == "CLIENT":
        query["client_user_id"] = user["id"]
        query["is_internal"] = False
    elif user["role"] == "ACCOUNTANT":
        case_ids = [c["id"] async for c in db.cases.find({"assigned_accountant_id": user["id"]})]
        query["case_id"] = {"$in": case_ids}
    if case_id:
        await _get_case(case_id, user)
        query["case_id"] = case_id
    if filter == "requested":
        query["status"] = "Requested"
    elif filter == "uploaded":
        query["status"] = {"$in": ["Uploaded", "Under Review", "Accepted", "Replacement Required"]}
    elif filter == "final":
        query["status"] = "Final"
    docs = await db.documents.find(query).sort("created_at", -1).to_list(500)
    return scrub_many(clean_many(docs), user)


@api.post("/documents/upload")
async def upload_document(case_id: str = Form(...), document_type: str = Form("Other"),
                          document_id: Optional[str] = Form(None),
                          task_id: Optional[str] = Form(None),
                          is_internal: bool = Form(False),
                          file: UploadFile = File(...),
                          user: dict = Depends(get_current_user)):
    case = await _get_case(case_id, user)
    if is_internal and user["role"] == "CLIENT":
        raise HTTPException(status_code=403, detail="Clients cannot upload internal documents")
    ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
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
        "task_id": task_id,
    }
    existing = await db.documents.find_one({"id": record["id"]})
    if existing:
        record["created_at"] = existing.get("created_at", now_iso())
        record["request_id"] = existing.get("request_id")
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
    if task_id:
        await complete_task(task_id, user)
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
    if user["role"] == "CLIENT" and (doc["client_user_id"] != user["id"] or doc.get("is_internal")):
        raise HTTPException(status_code=403, detail="Not allowed")
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
        await notify(recipient, f"New message from {user['name']}", body.body[:120],
                     body.case_id, "/messages", "MESSAGE")
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
async def case_activity(case_id: str, user: dict = Depends(get_current_user)):
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
    items = await db.notifications.find({"user_id": user["id"]}).sort("created_at", -1).to_list(100)
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


# ---------------------------------------------------------------- stats
async def _count(query):
    return await db.cases.count_documents(query)


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
    async for acc in db.users.find({"role": "ACCOUNTANT", "is_active": True}):
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
async def list_users(role: Optional[str] = None,
                     user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    query = {"role": role} if role else {}
    users = await db.users.find(query).sort("created_at", -1).to_list(500)
    return mask_contact_many(clean_many(users), user)


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
                  "email": new["email"], "phone": body.phone, "created_at": now_iso()}
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
    return {"ok": True}


@api.get("/services")
async def list_services(user: dict = Depends(get_current_user)):
    return clean_many(await db.services.find({}).to_list(50))


@api.get("/workflow/settings")
async def workflow_settings(user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    return {"statuses": STATUSES, "meta": {k: {"stage": v[0], "next_action": v[1], "owner": v[2]}
                                           for k, v in STATUS_META.items()}}


@api.get("/audit-log")
async def audit_log(user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    logs = await db.activity_logs.find({}).sort("created_at", -1).to_list(300)
    out = []
    for l in clean_many(logs):
        case = await db.cases.find_one({"id": l["case_id"]})
        l["case_ref"] = case["case_ref"] if case else None
        l["client_name"] = case["client_name"] if case else None
        out.append(l)
    return out


SERVICE_LABELS_ALL = {"SELF_ASSESSMENT": "Self Assessment", "MTD_INCOME_TAX": "MTD for Income Tax"}


@api.get("/my-actions")
async def my_actions(user: dict = Depends(require_roles("CLIENT"))):
    """Single Action Required feed for the client across every service."""
    outstanding, history = [], []
    async for t in db.tasks.find({"owner_id": user["id"]}).sort("created_at", -1):
        case = await db.cases.find_one({"id": t["case_id"]})
        item = {
            "id": t["id"], "type": "TASK", "action": t["name"], "description": t.get("description"),
            "service_type": case["service_type"] if case else None,
            "service_name": SERVICE_LABELS_ALL.get(case["service_type"]) if case else None,
            "case_id": t["case_id"], "case_ref": t.get("case_ref"),
            "due_date": t.get("due_date"), "status": t["status"], "link": "/tasks",
            "completed_date": t.get("completed_date"), "created_at": t["created_at"],
        }
        (history if t["status"] == "COMPLETED" else outstanding).append(item)

    async for c in db.cases.find({"client_user_id": user["id"],
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
            "case_id": o.get("recommendation_id"), "case_ref": None, "due_date": None,
            "status": "OPEN", "link": f"/recommendation/{o['id']}", "created_at": o["created_at"],
        })

    return {"outstanding": outstanding, "history": history[:50]}


@api.get("/overview")
async def business_overview(user: dict = Depends(require_roles("SUPER_ADMIN"))):
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0,
                                                     microsecond=0).isoformat()
    year_start = datetime.now(timezone.utc).replace(month=1, day=1, hour=0, minute=0, second=0,
                                                    microsecond=0).isoformat()
    active = {"$nin": ["SUBMITTED", "COMPLETED"]}

    sa_active = {c["client_id"] async for c in db.client_services.find(
        {"service_type": "SELF_ASSESSMENT", "status": "ACTIVE"})}
    mtd_active = {c["client_id"] async for c in db.client_services.find(
        {"service_type": "MTD_INCOME_TAX", "status": "ACTIVE"})}

    paid = await db.payment_transactions.find({"payment_status": "paid"}).to_list(2000)
    def total(rows):
        return round(sum(r.get("amount", 0) for r in rows), 2)

    per_accountant = []
    async for a in db.users.find({"role": "ACCOUNTANT", "is_active": True}):
        per_accountant.append({
            "name": a["name"],
            "open_cases": await db.cases.count_documents({"assigned_accountant_id": a["id"],
                                                          "status": active}),
            "completed_cases": await db.cases.count_documents({"assigned_accountant_id": a["id"],
                                                               "status": "COMPLETED"}),
        })

    return {
        "clients": {
            "total": await db.clients.count_documents({}),
            "new_this_month": await db.clients.count_documents({"created_at": {"$gte": month_start}}),
            "active_self_assessment": len(sa_active),
            "active_mtd": len(mtd_active),
            "both_services": len(sa_active & mtd_active),
        },
        "cases": {
            "open": await db.cases.count_documents({"status": active}),
            "completed": await db.cases.count_documents({"status": "COMPLETED"}),
            "overdue": await db.cases.count_documents({"internal_deadline": {"$lt": now_iso()},
                                                       "status": active}),
            "per_accountant": per_accountant,
        },
        "revenue": {
            "this_month": total([p for p in paid if p["created_at"] >= month_start]),
            "this_year": total([p for p in paid if p["created_at"] >= year_start]),
            "self_assessment": total([p for p in paid if p.get("service_type") == "SELF_ASSESSMENT"]),
            "mtd": total([p for p in paid if p.get("service_type") == "MTD_INCOME_TAX"]),
            "package_upgrades": total([p for p in paid if p.get("kind") == "SA_UPGRADE"]),
            "successful_payments": len(paid),
            "failed_payments": await db.payment_transactions.count_documents(
                {"payment_status": {"$in": ["failed", "expired"]}}),
            "note": "Revenue is summed from recorded successful payment transactions only.",
        },
    }


@api.get("/")
async def root():
    return {"message": "TaxSimba API"}

app.include_router(api)
app.include_router(phase1b_router)
