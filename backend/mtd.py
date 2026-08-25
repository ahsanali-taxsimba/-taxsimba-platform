"""MTD for Income Tax — a separate quarterly workflow built on the shared foundation.

Self Assessment is untouched. MTD reuses the existing case, permission, document, payment
and audit architecture and adds its own period-level workflow: four quarterly updates plus a
Final Declaration, each prepared by the accountant (staff-only draft), reviewed and published
by admin, approved by the client and then recorded as an external submission. TaxSimba never
files to HMRC directly and never calculates tax — any tax/NI estimate shown to a client is
typed in and confirmed by the accountant.
"""
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user, require_roles
from db import clean, clean_many, db
from testdata import OPERATIONAL_ONLY
from workflow import log_activity, notify, now_iso

router = APIRouter(prefix="/api/mtd")

MTD = "MTD_INCOME_TAX"

NOT_STARTED = "NOT_STARTED"
IN_PROGRESS = "IN_PROGRESS"
ADMIN_REVIEW = "ADMIN_REVIEW"
AWAITING_CLIENT = "AWAITING_CLIENT_APPROVAL"
APPROVED = "APPROVED"
SUBMITTED = "SUBMITTED"

STAGE_LABEL = {
    NOT_STARTED: "Preparing",
    IN_PROGRESS: "Preparing",
    ADMIN_REVIEW: "Under review",
    AWAITING_CLIENT: "Awaiting your approval",
    APPROVED: "Approved — ready to submit",
    SUBMITTED: "Submitted",
}
STAFF_STAGE_LABEL = {
    NOT_STARTED: "Not started",
    IN_PROGRESS: "Accountant preparing",
    ADMIN_REVIEW: "Awaiting admin review",
    AWAITING_CLIENT: "Waiting for client approval",
    APPROVED: "Ready for external submission",
    SUBMITTED: "Submitted",
}
NEXT_ACTION = {
    NOT_STARTED: ("Accountant to enter the quarterly figures", "ACCOUNTANT"),
    IN_PROGRESS: ("Accountant to finish and send for admin review", "ACCOUNTANT"),
    ADMIN_REVIEW: ("Admin to review and publish the figures", "ADMIN"),
    AWAITING_CLIENT: ("Client to approve the published figures", "CLIENT"),
    APPROVED: ("Admin to submit externally and record the reference", "ADMIN"),
    SUBMITTED: ("Nothing — this period is filed", "NONE"),
}
DISCLAIMER = ("These figures have been prepared by your accountant using the information "
              "currently available. Your final tax position may change as further information "
              "is added and at the end of the tax year.")

# 6 Apr - 5 Jul, 6 Jul - 5 Oct, 6 Oct - 5 Jan, 6 Jan - 5 Apr
QUARTERS = [(1, (4, 6), (7, 5), 0), (2, (7, 6), (10, 5), 0),
            (3, (10, 6), (1, 5), 1), (4, (1, 6), (4, 5), 1)]

FIGURE_FIELDS = ("income", "expenses", "net_profit", "estimated_income_tax",
                 "estimated_national_insurance", "suggested_set_aside", "client_note")


def _start_year(tax_year: str) -> int:
    return int(str(tax_year).split("/")[0])


def _deadline(period_end: date) -> date:
    """HMRC quarterly deadline: the 7th of the month after the month the period ends in."""
    month = period_end.month + 1
    year = period_end.year + (1 if month > 12 else 0)
    return date(year, month - 12 if month > 12 else month, 7)


def period_schedule(tax_year: str) -> list[dict]:
    y = _start_year(tax_year)
    rows = []
    for q, (sm, sd), (em, ed), end_offset in QUARTERS:
        start = date(y + (1 if sm == 1 else 0), sm, sd)
        end = date(y + end_offset, em, ed)
        rows.append({"kind": "QUARTER", "quarter": q, "label": f"Quarter {q}",
                     "period_start": start.isoformat(), "period_end": end.isoformat(),
                     "deadline": _deadline(end).isoformat()})
    rows.append({"kind": "FINAL_DECLARATION", "quarter": None, "label": "Final Declaration",
                 "period_start": date(y, 4, 6).isoformat(),
                 "period_end": date(y + 1, 4, 5).isoformat(),
                 "deadline": date(y + 2, 1, 31).isoformat()})
    return rows


async def ensure_periods(case: dict) -> int:
    """Idempotent: generates the four quarters plus the Final Declaration for an MTD case."""
    if case.get("service_type") != MTD or not case.get("tax_year"):
        return 0
    created = 0
    for row in period_schedule(case["tax_year"]):
        if await db.mtd_periods.find_one({"case_id": case["id"], "kind": row["kind"],
                                          "quarter": row["quarter"]}):
            continue
        await db.mtd_periods.insert_one({
            "id": str(uuid.uuid4()), "case_id": case["id"], "case_ref": case["case_ref"],
            "client_id": case["client_id"], "client_user_id": case["client_user_id"],
            "client_name": case.get("client_name"), "tax_year": case["tax_year"],
            "is_test": bool(case.get("is_test")), **row,
            "status": NOT_STARTED,
            # staff-only working figures; never returned to a client
            "draft": None, "draft_saved_by": None, "draft_saved_at": None,
            # published, client-visible snapshots -- history is never overwritten
            "published": None, "published_version": 0, "published_versions": [],
            "changes_reason": None, "client_approved_at": None,
            "approved_version": None, "approved_snapshot": None,
            "approval_history": [], "reopened_by_name": None, "reopened_at": None,
            "submission_reference": None, "submission_date": None,
            "submitted_by_name": None, "submitted_at": None,
            "created_at": now_iso(), "updated_at": now_iso(),
        })
        created += 1
    return created


async def _case(case_id: str, user: dict) -> dict:
    case = await db.cases.find_one({"id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if case.get("service_type") != MTD:
        raise HTTPException(status_code=400, detail="Not an MTD case")
    if user["role"] == "CLIENT" and case.get("client_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your case")
    if user["role"] == "ACCOUNTANT" and case.get("assigned_accountant_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Case not assigned to you")
    return clean(case)


async def _period(period_id: str, user: dict):
    row = await db.mtd_periods.find_one({"id": period_id})
    if not row:
        raise HTTPException(status_code=404, detail="Period not found")
    case = await _case(row["case_id"], user)
    return clean(row), case


def _warning(row: dict) -> dict:
    if row["status"] == SUBMITTED:
        return {"deadline_warning": None, "days_to_deadline": None}
    days = (date.fromisoformat(row["deadline"]) - datetime.now(timezone.utc).date()).days
    level = ("OVERDUE" if days < 0 else "DUE_3" if days <= 3 else "DUE_7" if days <= 7
             else "DUE_14" if days <= 14 else None)
    return {"deadline_warning": level, "days_to_deadline": days}


def _client_stage(row: dict, case: Optional[dict], awaiting_docs: bool) -> str:
    """Client-facing wording only — backend states are never changed by this."""
    if row.get("prior_to_taxsimba"):
        return "Submitted before joining TaxSimba"
    if row["status"] == SUBMITTED:
        return "Submitted"
    if row["status"] == APPROVED:
        return "Approved"
    if row["status"] == AWAITING_CLIENT:
        return "Ready for your approval"
    if row["status"] == ADMIN_REVIEW:
        return "Under review"
    if awaiting_docs:
        return ("Action required — overdue" if _warning(row)["deadline_warning"] == "OVERDUE"
                else "Action required")
    if row["status"] == NOT_STARTED and case is not None \
            and not case.get("assigned_accountant_id"):
        return "Getting started"
    return "Preparing"


def _decorate(row: dict, user: dict, case: Optional[dict] = None,
              awaiting_docs: bool = False) -> dict:
    action, owner = NEXT_ACTION[row["status"]]
    is_client = user["role"] == "CLIENT"
    warn = _warning(row)
    # A deadline that passes while the client still owes records is not the accountant's delay:
    # the period escalates as overdue but the client stays the action owner.
    overdue_waiting = bool(awaiting_docs and warn["deadline_warning"] == "OVERDUE"
                           and row["status"] in (NOT_STARTED, IN_PROGRESS))
    awaiting_assignment = bool(case is not None and not case.get("assigned_accountant_id")
                               and row["status"] == NOT_STARTED)
    if overdue_waiting:
        action, owner = ("Client to provide the outstanding records", "CLIENT")
    staff_label = ("Overdue — waiting for client" if overdue_waiting
                   else STAFF_STAGE_LABEL[row["status"]])
    out = {**row, **warn,
           "stage_label": (_client_stage(row, case, awaiting_docs) if is_client
                           else staff_label),
           "awaiting_documents": awaiting_docs,
           "awaiting_assignment": awaiting_assignment,
           "overdue_waiting_for_client": overdue_waiting,
           "delay_attributed_to": "CLIENT" if overdue_waiting else None,
           "escalated_to_admin": overdue_waiting,
           "next_action": action, "next_action_owner": owner,
           "disclaimer": DISCLAIMER if row.get("published") else None}
    if is_client:
        # A client only ever sees published figures -- drafts and staff-only review
        # metadata stay internal.
        for k in ("draft", "draft_saved_by", "draft_saved_at", "changes_reason",
                  "published_versions", "approval_history", "reopened_by_name",
                  "reopened_at", "is_test"):
            out.pop(k, None)
    return out


async def _advance(row: dict, case: dict, status: Optional[str], action: str, user: dict,
                   extra: Optional[dict] = None, comments: Optional[str] = None):
    update = {"updated_at": now_iso(), **(extra or {})}
    if status:
        update["status"] = status
    await db.mtd_periods.update_one({"id": row["id"]}, {"$set": update})
    await log_activity(case["id"], f"MTD {row['label']}: {action}", user,
                       meta={"mtd_period_id": row["id"],
                             "period_status": status or row["status"], "service": "MTD"},
                       comments=comments)
    return _decorate({**row, **update}, user)


class FiguresIn(BaseModel):
    income: float
    expenses: float
    net_profit: Optional[float] = None
    estimated_income_tax: Optional[float] = None
    estimated_national_insurance: Optional[float] = None
    suggested_set_aside: Optional[float] = None
    client_note: Optional[str] = None


class ReasonIn(BaseModel):
    reason: str


class QuarterRequestIn(BaseModel):
    document_type: str
    note: Optional[str] = None
    due_date: Optional[str] = None


class SubmissionIn(BaseModel):
    submission_reference: str
    submission_date: str
    provider: Optional[str] = None
    outcome: Optional[str] = None
    note: Optional[str] = None


def _draft_from(body: FiguresIn, user: dict) -> dict:
    """Net profit is derived from income minus expenses unless the accountant overrides it.
    Tax and NI are never calculated -- they are only whatever the accountant typed in."""
    return {
        "income": round(body.income, 2), "expenses": round(body.expenses, 2),
        "net_profit": round(body.net_profit if body.net_profit is not None
                            else body.income - body.expenses, 2),
        "estimated_income_tax": (None if body.estimated_income_tax is None
                                 else round(body.estimated_income_tax, 2)),
        "estimated_national_insurance": (None if body.estimated_national_insurance is None
                                         else round(body.estimated_national_insurance, 2)),
        "suggested_set_aside": (None if body.suggested_set_aside is None
                                else round(body.suggested_set_aside, 2)),
        "client_note": (body.client_note or "").strip() or None,
        "prepared_by_name": user["name"],
    }


# ------------------------------------------------------------------ read
@router.get("/cases/{case_id}/periods")
async def list_periods(case_id: str, user: dict = Depends(get_current_user)):
    case = await _case(case_id, user)
    rows = await db.mtd_periods.find({"case_id": case_id}).to_list(20)
    if not rows:
        await ensure_periods(case)
        rows = await db.mtd_periods.find({"case_id": case_id}).to_list(20)
    rows = clean_many(rows)
    rows.sort(key=lambda r: (r["kind"] == "FINAL_DECLARATION", r["quarter"] or 0))
    open_requests = {d["mtd_period_id"] async for d in db.documents.find(
        {"case_id": case_id, "status": "Requested", "mtd_period_id": {"$ne": None}},
        {"mtd_period_id": 1})}
    out = [_decorate(r, user, case, r["id"] in open_requests) for r in rows]
    escalated = [r for r in out if r["overdue_waiting_for_client"]]
    if escalated:
        # Visible escalation for oversight; notify() collapses repeats so one genuine
        # overdue period produces one standing admin alert.
        admin_ids = [u["id"] async for u in db.users.find(
            {"role": {"$in": ["ADMIN", "SUPER_ADMIN"]}, "is_active": True}, {"id": 1})]
        for r in escalated:
            for uid in admin_ids:
                await notify(uid, f"Overdue — waiting for client: {r['label']}",
                             f"{case['case_ref']} ({case.get('client_name')}) — deadline "
                             f"{r['deadline']} passed with records still outstanding.",
                             case_id, "/admin/mtd?bucket=overdue_waiting_client", "DEADLINE")
    if user["role"] == "CLIENT":
        # One genuine in-app reminder per outstanding approval; notify() collapses repeats.
        for r in out:
            if r["status"] == AWAITING_CLIENT and (r["days_to_deadline"] or 99) <= 14:
                await notify(user["id"], f"Action needed: approve your {r['label']}",
                             f"Due {r['deadline']}. Please review and approve the figures.",
                             case_id, "/mtd", "REVIEW")
    return out


@router.get("/periods")
async def all_periods(bucket: Optional[str] = None, include_test: bool = False,
                      user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    query: dict = {} if include_test else dict(OPERATIONAL_ONLY)
    buckets = {
        "not_started": {"status": NOT_STARTED}, "preparing": {"status": IN_PROGRESS},
        "admin_review": {"status": ADMIN_REVIEW}, "client_action": {"status": AWAITING_CLIENT},
        "ready_submission": {"status": APPROVED}, "submitted": {"status": SUBMITTED},
    }
    if bucket in buckets:
        query.update(buckets[bucket])
    rows = clean_many(await db.mtd_periods.find(query).sort("deadline", 1).to_list(500))
    waiting_ids = {d["mtd_period_id"] async for d in db.documents.find(
        {"status": "Requested", "mtd_period_id": {"$ne": None}}, {"mtd_period_id": 1})}
    cases = {c["id"]: c async for c in db.cases.find(
        {"service_type": MTD}, {"id": 1, "assigned_accountant_name": 1,
                                "assigned_accountant_id": 1})}
    out = []
    for r in rows:
        case = cases.get(r["case_id"], {})
        out.append({**_decorate(r, user, case, r["id"] in waiting_ids),
                    "assigned_accountant_name": case.get("assigned_accountant_name"),
                    "assigned_accountant_id": case.get("assigned_accountant_id")})
    if bucket == "due_14":
        out = [r for r in out if r["deadline_warning"] in ("DUE_14", "DUE_7", "DUE_3")]
    elif bucket == "overdue":
        out = [r for r in out if r["deadline_warning"] == "OVERDUE"]
    elif bucket == "overdue_waiting_client":
        out = [r for r in out if r["overdue_waiting_for_client"]]
    elif bucket == "final_declaration":
        out = [r for r in out if r["kind"] == "FINAL_DECLARATION"]
    elif bucket == "waiting_for_client":
        out = [r for r in out if r["id"] in waiting_ids]
    return out


@router.get("/stats")
async def mtd_stats(user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    """Operational MTD counts. Test/QA data is excluded by default, like every other view."""
    rows = clean_many(await db.mtd_periods.find(dict(OPERATIONAL_ONLY)).to_list(2000))
    active_cases = {c["id"] async for c in db.cases.find(
        {"service_type": MTD, **OPERATIONAL_ONLY}, {"id": 1})}
    waiting = {d["mtd_period_id"] async for d in db.documents.find(
        {"status": "Requested", "mtd_period_id": {"$ne": None},
         "case_id": {"$in": list(active_cases)}}, {"mtd_period_id": 1})}
    decorated = [_decorate(r, user, None, r["id"] in waiting) for r in rows]
    return {
        "waiting_for_client": sum(1 for r in rows if r["id"] in waiting),
        "overdue_waiting_client": sum(1 for r in decorated if r["overdue_waiting_for_client"]),
        "active_mtd_clients": len({r["client_id"] for r in rows if r["case_id"] in active_cases}),
        "active_mtd_cases": len(active_cases),
        "not_started": sum(1 for r in rows if r["status"] == NOT_STARTED),
        "preparing": sum(1 for r in rows if r["status"] == IN_PROGRESS),
        "admin_review": sum(1 for r in rows if r["status"] == ADMIN_REVIEW),
        "client_action": sum(1 for r in rows if r["status"] == AWAITING_CLIENT),
        "ready_submission": sum(1 for r in rows if r["status"] == APPROVED),
        "submitted": sum(1 for r in rows if r["status"] == SUBMITTED),
        "due_14": sum(1 for r in decorated
                      if r["deadline_warning"] in ("DUE_14", "DUE_7", "DUE_3")),
        "final_declarations": sum(1 for r in rows
                                  if r["kind"] == "FINAL_DECLARATION"
                                  and r["status"] != SUBMITTED),
        "overdue": sum(1 for r in decorated if r["deadline_warning"] == "OVERDUE"),
    }


@router.get("/periods/{period_id}/documents")
async def period_documents(period_id: str, user: dict = Depends(get_current_user)):
    row, _ = await _period(period_id, user)
    query = {"mtd_period_id": period_id, "is_deleted": {"$ne": True}}
    if user["role"] == "CLIENT":
        query["is_internal"] = False
    return clean_many(await db.documents.find(query).sort("created_at", -1).to_list(200))


@router.post("/periods/{period_id}/requests")
async def request_quarter_document(period_id: str, body: QuarterRequestIn,
                                   user: dict = Depends(require_roles("ACCOUNTANT", "ADMIN",
                                                                      "SUPER_ADMIN"))):
    """Requests one specific document for one specific quarter. Reuses the existing document
    request architecture; the MTD case workflow status is deliberately not touched."""
    row, case = await _period(period_id, user)
    if not body.document_type.strip():
        raise HTTPException(status_code=400, detail="A document type is required")
    title = body.document_type.strip()
    task_name = f"{row['label']}: {title}"
    # Idempotency: a repeated request for the same still-open item reuses the existing records.
    existing_task = await db.tasks.find_one({"case_id": case["id"], "name": task_name,
                                             "owner_role": "CLIENT", "status": "OPEN"})
    if existing_task:
        placeholder = await db.documents.find_one({"task_id": existing_task["id"],
                                                   "status": "Requested"})
        if placeholder:
            return clean(placeholder)
    req_id = str(uuid.uuid4())
    task_id = existing_task["id"] if existing_task else str(uuid.uuid4())
    if not existing_task:
        # Client-facing task so the request appears in the client's action list, as SA does.
        await db.tasks.insert_one({
            "id": task_id, "case_id": case["id"], "case_ref": case["case_ref"],
            "name": task_name, "description": body.note, "owner_role": "CLIENT",
            "owner_id": case["client_user_id"], "due_date": body.due_date, "status": "OPEN",
            "mandatory": False, "mtd_period_id": period_id, "mtd_period_label": row["label"],
            "created_by": user["id"], "created_by_name": user["name"],
            "created_at": now_iso(), "completed_date": None, "request_id": req_id,
        })
    await db.document_requests.insert_one({
        "id": req_id, "case_id": case["id"], "client_user_id": case["client_user_id"],
        "title": title, "description": body.note, "task_id": task_id,
        "mtd_period_id": period_id, "mtd_period_label": row["label"],
        "status": "Requested", "requested_by": user["id"], "requested_by_name": user["name"],
        "due_date": body.due_date, "created_at": now_iso(),
    })
    placeholder = {
        "id": str(uuid.uuid4()), "case_id": case["id"],
        "client_user_id": case["client_user_id"], "tax_year": case["tax_year"],
        "document_type": title, "name": title,
        "status": "Requested", "request_id": req_id, "task_id": task_id,
        "mtd_period_id": period_id, "mtd_period_label": row["label"],
        "note": body.note, "due_date": body.due_date,
        "requested_by_name": user["name"], "requested_at": now_iso(),
        "storage_path": None, "uploader_id": None, "uploader_name": None,
        "content_type": None, "size": 0, "is_internal": False, "is_deleted": False,
        "created_at": now_iso(), "upload_date": None,
    }
    await db.documents.insert_one(dict(placeholder))
    await log_activity(case["id"],
                       f"MTD {row['label']}: document requested from client ({title})", user,
                       meta={"mtd_period_id": period_id, "service": "MTD"})
    await notify(case["client_user_id"], f"Document requested for {row['label']}",
                 title, case["id"], "/mtd", "UPLOAD")
    return clean(placeholder)


@router.get("/my-workload")
async def accountant_workload(user: dict = Depends(require_roles("ACCOUNTANT"))):
    """MTD-only workload for the signed-in accountant. Kept entirely separate from the
    Self Assessment workload counters."""
    cases = {c["id"]: c async for c in db.cases.find(
        {"service_type": MTD, "assigned_accountant_id": user["id"], **OPERATIONAL_ONLY})}
    rows = clean_many(await db.mtd_periods.find(
        {"case_id": {"$in": list(cases)}}).sort("deadline", 1).to_list(500)) if cases else []
    waiting_ids = {d["mtd_period_id"] async for d in db.documents.find(
        {"case_id": {"$in": list(cases)}, "status": "Requested",
         "mtd_period_id": {"$ne": None}}, {"mtd_period_id": 1})} if cases else set()
    items = [_decorate(r, user, cases.get(r["case_id"], {}), r["id"] in waiting_ids)
             for r in rows]
    for i in items:
        i.pop("draft", None)
    buckets = {
        "needs_my_action": [i for i in items if i["next_action_owner"] == "ACCOUNTANT"],
        "awaiting_admin_review": [i for i in items if i["status"] == ADMIN_REVIEW],
        "awaiting_client_approval": [i for i in items if i["status"] == AWAITING_CLIENT],
        "ready_submission": [i for i in items if i["status"] == APPROVED],
        "submitted": [i for i in items if i["status"] == SUBMITTED],
        "due_14": [i for i in items
                   if i["deadline_warning"] in ("DUE_14", "DUE_7", "DUE_3")],
        "overdue": [i for i in items if i["deadline_warning"] == "OVERDUE"],
        "overdue_waiting_client": [i for i in items if i["overdue_waiting_for_client"]],
    }
    buckets["waiting_for_client"] = [i for i in items if i["id"] in waiting_ids]
    return {"counts": {k: len(v) for k, v in buckets.items()}, "buckets": buckets}


@router.get("/cases/{case_id}/year-summary")
async def year_summary(case_id: str, user: dict = Depends(get_current_user)):
    """Year-to-date totals from PUBLISHED accountant-entered quarter figures only.
    Drafts are never included and no tax or NI is ever calculated here."""
    case = await _case(case_id, user)
    rows = clean_many(await db.mtd_periods.find({"case_id": case_id}).to_list(20))
    quarters = sorted([r for r in rows if r["kind"] == "QUARTER"],
                      key=lambda r: r["quarter"])
    out, totals = [], {"income": 0.0, "expenses": 0.0, "net_profit": 0.0}
    published_count = 0
    for r in quarters:
        pub = r.get("published")
        if pub:
            published_count += 1
            for k in totals:
                totals[k] += float(pub.get(k) or 0)
        out.append({"quarter": r["quarter"], "label": r["label"],
                    "period_start": r["period_start"], "period_end": r["period_end"],
                    "deadline": r["deadline"],
                    "stage_label": (_client_stage(r, case, False) if user["role"] == "CLIENT"
                                    else STAFF_STAGE_LABEL[r["status"]]),
                    "status": r["status"],
                    "prior_to_taxsimba": bool(r.get("prior_to_taxsimba")),
                    "income": pub["income"] if pub else None,
                    "expenses": pub["expenses"] if pub else None,
                    "net_profit": pub["net_profit"] if pub else None})
    return {"tax_year": case["tax_year"], "case_ref": case["case_ref"],
            "quarters": out, "published_quarters": published_count,
            "totals": {k: round(v, 2) for k, v in totals.items()},
            "empty_message": (None if published_count else
                              "No quarterly figures published yet."),
            "note": ("Year-to-date totals of the figures your accountant has prepared and "
                     "published so far. This is accountant-prepared information, not your "
                     "final tax liability.")}


class PriorSubmissionIn(BaseModel):
    previous_provider: str
    submission_date: str
    submission_reference: Optional[str] = None
    income: Optional[float] = None
    expenses: Optional[float] = None
    net_profit: Optional[float] = None
    note: Optional[str] = None


@router.post("/periods/{period_id}/record-prior-submission")
async def record_prior_submission(period_id: str, body: PriorSubmissionIn,
                                  user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    """Mid-year onboarding: a quarter filed elsewhere before the client joined TaxSimba.
    Recorded as verified history — TaxSimba never claims it made this submission."""
    row, case = await _period(period_id, user)
    if row["status"] == SUBMITTED:
        raise HTTPException(status_code=400, detail="This period is already submitted and locked")
    if not body.previous_provider.strip() or not body.submission_date.strip():
        raise HTTPException(status_code=400,
                            detail="The previous provider and submission date are required")
    verified = None
    if body.income is not None and body.expenses is not None:
        verified = {
            "income": round(body.income, 2), "expenses": round(body.expenses, 2),
            "net_profit": round(body.net_profit if body.net_profit is not None
                                else body.income - body.expenses, 2),
            "estimated_income_tax": None, "estimated_national_insurance": None,
            "suggested_set_aside": None,
            "client_note": f"Filed by {body.previous_provider.strip()} before joining TaxSimba.",
            "prepared_by_name": body.previous_provider.strip(),
            "verified_historical": True, "version": 1,
            "published_at": now_iso(), "published_by_name": user["name"],
        }
    extra = {"prior_to_taxsimba": True, "submitted_by_taxsimba": False,
             "previous_provider": body.previous_provider.strip(),
             "submission_reference": (body.submission_reference or "").strip() or None,
             "submission_date": body.submission_date.strip(),
             "submitted_by_name": None, "submitted_at": None,
             "verified_by_name": user["name"], "verified_at": now_iso()}
    if verified:
        extra["published"] = verified
        extra["published_version"] = 1
        extra["published_versions"] = [verified]
    out = await _advance(row, case, SUBMITTED,
                         f"recorded as submitted before joining TaxSimba "
                         f"({body.previous_provider.strip()})", user, extra=extra,
                         comments=body.note)
    return out


@router.post("/cases/{case_id}/generate-periods")
async def generate_periods(case_id: str,
                           user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    case = await _case(case_id, user)
    created = await ensure_periods(case)
    if created:
        await log_activity(case_id, f"MTD schedule generated ({created} periods)", user)
    return {"created": created}


# ------------------------------------------------------------------ accountant preparation
@router.post("/periods/{period_id}/figures")
async def save_draft(period_id: str, body: FiguresIn,
                     user: dict = Depends(require_roles("ACCOUNTANT", "ADMIN",
                                                        "SUPER_ADMIN"))):
    row, case = await _period(period_id, user)
    if row["status"] in (ADMIN_REVIEW, AWAITING_CLIENT, APPROVED, SUBMITTED):
        raise HTTPException(status_code=400,
                            detail="Figures are locked while this period is under review, "
                                   "awaiting the client or already submitted")
    if body.income < 0 or body.expenses < 0:
        raise HTTPException(status_code=400, detail="Figures cannot be negative")
    return await _advance(row, case, IN_PROGRESS, "draft figures saved", user,
                          extra={"draft": _draft_from(body, user),
                                 "draft_saved_by": user["name"], "draft_saved_at": now_iso(),
                                 "changes_reason": None})


@router.get("/periods/{period_id}/preview")
async def preview_client_view(period_id: str,
                              user: dict = Depends(require_roles("ACCOUNTANT", "ADMIN",
                                                                 "SUPER_ADMIN"))):
    """Exactly what the client would see if this draft were published. Staff only."""
    row, _ = await _period(period_id, user)
    if not row.get("draft"):
        raise HTTPException(status_code=400, detail="Enter the figures first")
    return {"label": row["label"], "period_start": row["period_start"],
            "period_end": row["period_end"], "deadline": row["deadline"],
            "version": row["published_version"] + 1, "disclaimer": DISCLAIMER,
            **row["draft"]}


@router.post("/periods/{period_id}/submit-for-review")
async def submit_for_review(period_id: str,
                            user: dict = Depends(require_roles("ACCOUNTANT", "ADMIN",
                                                               "SUPER_ADMIN"))):
    row, case = await _period(period_id, user)
    if row["status"] != IN_PROGRESS or not row.get("draft"):
        raise HTTPException(status_code=400, detail="Enter the figures first")
    out = await _advance(row, case, ADMIN_REVIEW,
                         "published to client for release — sent for admin review", user)
    async for admin in db.users.find({"role": {"$in": ["ADMIN", "SUPER_ADMIN"]},
                                      "is_active": True}):
        await notify(admin["id"], "MTD period ready for review",
                     f"{case['client_name']} — {case['case_ref']} {row['label']}",
                     case["id"], f"/admin/cases/{case['id']}", "REVIEW")
    return out


# ------------------------------------------------------------------ admin review and release
@router.post("/periods/{period_id}/admin-approve")
async def approve_and_publish(period_id: str,
                              user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    """Publishes a new immutable version to the client. Publishing does NOT submit the period."""
    row, case = await _period(period_id, user)
    if row["status"] != ADMIN_REVIEW:
        raise HTTPException(status_code=400, detail="This period is not awaiting admin review")
    if not row.get("draft"):
        raise HTTPException(status_code=400, detail="There are no prepared figures to publish")
    version = row["published_version"] + 1
    snapshot = {**row["draft"], "version": version,
                "published_by_name": user["name"], "published_at": now_iso()}
    history = list(row.get("published_versions") or []) + [snapshot]
    out = await _advance(row, case, AWAITING_CLIENT,
                         f"figures published to client (version {version})", user,
                         extra={"published": snapshot, "published_version": version,
                                "published_versions": history, "client_approved_at": None,
                                "approved_version": None, "approved_snapshot": None})
    await notify(case["client_user_id"], f"MTD {row['label']} ready to approve",
                 f"Your {row['label'].lower()} figures have been published for approval.",
                 case["id"], "/mtd", "REVIEW")
    return out


@router.post("/periods/{period_id}/request-changes")
async def request_changes(period_id: str, body: ReasonIn,
                          user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    row, case = await _period(period_id, user)
    if row["status"] not in (ADMIN_REVIEW, AWAITING_CLIENT):
        raise HTTPException(status_code=400, detail="Nothing to return at this stage")
    if not body.reason.strip():
        raise HTTPException(status_code=400, detail="A reason is required")
    out = await _advance(row, case, IN_PROGRESS, "returned for changes", user,
                         extra={"changes_reason": body.reason.strip()}, comments=body.reason)
    if case.get("assigned_accountant_id"):
        await notify(case["assigned_accountant_id"], "MTD changes required",
                     f"{case['case_ref']} {row['label']}: {body.reason}", case["id"],
                     f"/work/cases/{case['id']}", "CHANGES")
    return out


class ClientApproveIn(BaseModel):
    version: int


@router.post("/periods/{period_id}/client-approve")
async def client_approve(period_id: str, body: Optional[ClientApproveIn] = None,
                         user: dict = Depends(require_roles("CLIENT"))):
    row, case = await _period(period_id, user)
    if row["status"] != AWAITING_CLIENT:
        raise HTTPException(status_code=400, detail="This period is not awaiting your approval")
    if body and body.version != row["published_version"]:
        raise HTTPException(status_code=409,
                            detail="These figures have been updated since you opened them. "
                                   "Please refresh and review the latest version.")
    out = await _advance(row, case, APPROVED, "approved by the client", user,
                         extra={"client_approved_at": now_iso(),
                                "approved_version": row["published_version"],
                                "approved_snapshot": row.get("published")})
    async for admin in db.users.find({"role": {"$in": ["ADMIN", "SUPER_ADMIN"]},
                                      "is_active": True}):
        await notify(admin["id"], "MTD period approved by client",
                     f"{case['client_name']} — {case['case_ref']} {row['label']}",
                     case["id"], f"/admin/cases/{case['id']}", "SUBMISSION")
    return out


@router.post("/periods/{period_id}/reopen")
async def reopen_period(period_id: str, body: ReasonIn,
                        user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    """Reopens a client-approved quarter for correction. A quarter that has already been
    recorded as externally submitted stays locked. Nothing is deleted or overwritten."""
    row, case = await _period(period_id, user)
    if row["status"] == SUBMITTED:
        raise HTTPException(status_code=400,
                            detail="This period has already been submitted externally and is "
                                   "locked. A separate correction process is required.")
    if row["status"] != APPROVED:
        raise HTTPException(status_code=400,
                            detail="Only a quarter the client has approved can be reopened for "
                                   "correction")
    if not body.reason.strip():
        raise HTTPException(status_code=400, detail="A reason is required")
    # The published version and the approval that superseded it are kept as evidence.
    history = [{**v, "superseded_at": now_iso(),
                "superseded_reason": body.reason.strip(),
                "superseded_by_name": user["name"],
                "client_approved_at": row.get("client_approved_at")}
               if v["version"] == row["approved_version"] else v
               for v in (row.get("published_versions") or [])]
    approvals = list(row.get("approval_history") or []) + [{
        "version": row["approved_version"], "approved_at": row.get("client_approved_at"),
        "snapshot": row.get("approved_snapshot"),
        "reopened_at": now_iso(), "reopened_by_name": user["name"],
        "reopened_by_role": user["role"], "reason": body.reason.strip(),
    }]
    out = await _advance(row, case, IN_PROGRESS,
                         f"reopened for correction (approved version "
                         f"{row['approved_version']} superseded)", user,
                         extra={"published_versions": history,
                                "approval_history": approvals,
                                "approved_version": None, "approved_snapshot": None,
                                "client_approved_at": None,
                                "changes_reason": body.reason.strip(),
                                "reopened_by_name": user["name"],
                                "reopened_at": now_iso()},
                         comments=body.reason)
    if case.get("assigned_accountant_id"):
        await notify(case["assigned_accountant_id"], "MTD period reopened for correction",
                     f"{case['case_ref']} {row['label']}: {body.reason}", case["id"],
                     f"/work/cases/{case['id']}", "CHANGES")
    await notify(case["client_user_id"], f"MTD {row['label']} being corrected",
                 "Your accountant is making a correction. Updated figures will be sent to you "
                 "for approval.", case["id"], "/mtd", "INFO")
    return out


@router.post("/periods/{period_id}/record-submission")
async def record_period_submission(period_id: str, body: SubmissionIn,
                                   user: dict = Depends(require_roles("ADMIN",
                                                                      "SUPER_ADMIN"))):
    """The accountant files externally with approved software; TaxSimba records the outcome."""
    row, case = await _period(period_id, user)
    if row["status"] == SUBMITTED:
        raise HTTPException(status_code=400,
                            detail="This period is already submitted and locked")
    if row["status"] != APPROVED:
        raise HTTPException(status_code=400,
                            detail="Client approval is required before a submission can be recorded")
    if not body.submission_reference.strip() or not body.submission_date.strip():
        raise HTTPException(status_code=400,
                            detail="A submission reference and date are required")
    out = await _advance(row, case, SUBMITTED,
                         f"submission recorded (ref {body.submission_reference.strip()})", user,
                         extra={"submission_reference": body.submission_reference.strip(),
                                "submission_date": body.submission_date.strip(),
                                "submission_provider": body.provider,
                                "submission_outcome": body.outcome,
                                "submitted_by_name": user["name"],
                                "submitted_at": now_iso()},
                         comments=body.note)
    await notify(case["client_user_id"], f"MTD {row['label']} submitted",
                 f"Submission reference {body.submission_reference.strip()}",
                 case["id"], "/mtd", "SUBMISSION")
    return out
