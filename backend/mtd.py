"""MTD for Income Tax — a separate quarterly workflow built on the shared foundation.

Self Assessment is untouched. MTD reuses the existing case, permission, document, payment
and audit architecture and adds its own period-level workflow: four quarterly updates plus a
Final Declaration, each prepared by the accountant, reviewed by admin, approved by the client
and then recorded as an external submission (TaxSimba never files to HMRC directly).
"""
import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user, require_roles
from db import clean, clean_many, db
from workflow import log_activity, notify, now_iso

router = APIRouter(prefix="/api/mtd")

MTD = "MTD_INCOME_TAX"

# period status machine -- deliberately separate from the Self Assessment case machine
NOT_STARTED = "NOT_STARTED"
IN_PROGRESS = "IN_PROGRESS"
ADMIN_REVIEW = "ADMIN_REVIEW"
AWAITING_CLIENT = "AWAITING_CLIENT_APPROVAL"
APPROVED = "APPROVED"
SUBMITTED = "SUBMITTED"

STAGE_LABEL = {
    NOT_STARTED: "Not started",
    IN_PROGRESS: "Accountant preparing",
    ADMIN_REVIEW: "Internal review",
    AWAITING_CLIENT: "Waiting for your approval",
    APPROVED: "Approved — ready to submit",
    SUBMITTED: "Submitted",
}
NEXT_ACTION = {
    NOT_STARTED: ("Accountant to enter the quarterly figures", "ACCOUNTANT"),
    IN_PROGRESS: ("Accountant to finish and send for internal review", "ACCOUNTANT"),
    ADMIN_REVIEW: ("Admin to review the figures", "ADMIN"),
    AWAITING_CLIENT: ("Client to approve the figures", "CLIENT"),
    APPROVED: ("Admin to submit externally and record the reference", "ADMIN"),
    SUBMITTED: ("Nothing — this period is filed", "NONE"),
}

# 6 Apr - 5 Jul, 6 Jul - 5 Oct, 6 Oct - 5 Jan, 6 Jan - 5 Apr. Deadline = period end + 1 month + 7 days.
QUARTERS = [(1, (4, 6), (7, 5), 0), (2, (7, 6), (10, 5), 0),
            (3, (10, 6), (1, 5), 1), (4, (1, 6), (4, 5), 1)]


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
        exists = await db.mtd_periods.find_one({"case_id": case["id"], "kind": row["kind"],
                                                "quarter": row["quarter"]})
        if exists:
            continue
        await db.mtd_periods.insert_one({
            "id": str(uuid.uuid4()), "case_id": case["id"], "case_ref": case["case_ref"],
            "client_id": case["client_id"], "client_user_id": case["client_user_id"],
            "client_name": case.get("client_name"), "tax_year": case["tax_year"],
            "is_test": bool(case.get("is_test")), **row,
            "status": NOT_STARTED, "income": None, "expenses": None, "profit": None,
            "figures_note": None, "prepared_by_name": None, "prepared_at": None,
            "admin_reviewed_by_name": None, "admin_reviewed_at": None,
            "changes_reason": None, "client_approved_at": None,
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


def _decorate(row: dict) -> dict:
    action, owner = NEXT_ACTION[row["status"]]
    return {**row, "stage_label": STAGE_LABEL[row["status"]],
            "next_action": action, "next_action_owner": owner}


async def _advance(row: dict, case: dict, status: str, action: str, user: dict,
                   extra: Optional[dict] = None, comments: Optional[str] = None):
    update = {"status": status, "updated_at": now_iso(), **(extra or {})}
    await db.mtd_periods.update_one({"id": row["id"]}, {"$set": update})
    await log_activity(case["id"], f"MTD {row['label']}: {action}", user,
                       meta={"mtd_period_id": row["id"], "period_status": status},
                       comments=comments)
    return _decorate({**row, **update})


class FiguresIn(BaseModel):
    income: float
    expenses: float
    note: Optional[str] = None


class ReasonIn(BaseModel):
    reason: str


class SubmissionIn(BaseModel):
    submission_reference: str
    submission_date: str
    provider: Optional[str] = None
    note: Optional[str] = None


@router.get("/cases/{case_id}/periods")
async def list_periods(case_id: str, user: dict = Depends(get_current_user)):
    case = await _case(case_id, user)
    rows = await db.mtd_periods.find({"case_id": case_id}).to_list(20)
    if not rows:
        await ensure_periods(case)
        rows = await db.mtd_periods.find({"case_id": case_id}).to_list(20)
    rows = clean_many(rows)
    rows.sort(key=lambda r: (r["kind"] == "FINAL_DECLARATION", r["quarter"] or 0))
    return [_decorate(r) for r in rows]


@router.post("/cases/{case_id}/generate-periods")
async def generate_periods(case_id: str,
                           user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    case = await _case(case_id, user)
    created = await ensure_periods(case)
    if created:
        await log_activity(case_id, f"MTD schedule generated ({created} periods)", user)
    return {"created": created}


@router.post("/periods/{period_id}/figures")
async def save_figures(period_id: str, body: FiguresIn,
                       user: dict = Depends(require_roles("ACCOUNTANT", "ADMIN",
                                                          "SUPER_ADMIN"))):
    row, case = await _period(period_id, user)
    if row["status"] in (ADMIN_REVIEW, AWAITING_CLIENT, APPROVED, SUBMITTED):
        raise HTTPException(status_code=400,
                            detail="Figures are locked while this period is under review, "
                                   "awaiting the client or already submitted")
    if body.income < 0 or body.expenses < 0:
        raise HTTPException(status_code=400, detail="Figures cannot be negative")
    profit = round(body.income - body.expenses, 2)
    return await _advance(row, case, IN_PROGRESS, "figures updated", user,
                          extra={"income": round(body.income, 2),
                                 "expenses": round(body.expenses, 2), "profit": profit,
                                 "figures_note": body.note,
                                 "prepared_by_name": user["name"], "prepared_at": now_iso(),
                                 "changes_reason": None})


@router.post("/periods/{period_id}/submit-for-review")
async def submit_for_review(period_id: str,
                            user: dict = Depends(require_roles("ACCOUNTANT", "ADMIN",
                                                               "SUPER_ADMIN"))):
    row, case = await _period(period_id, user)
    if row["status"] != IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Enter the figures first")
    out = await _advance(row, case, ADMIN_REVIEW, "sent for internal review", user)
    async for admin in db.users.find({"role": {"$in": ["ADMIN", "SUPER_ADMIN"]},
                                      "is_active": True}):
        await notify(admin["id"], "MTD period ready for review",
                     f"{case['client_name']} — {case['case_ref']} {row['label']}",
                     case["id"], f"/admin/cases/{case['id']}", "REVIEW")
    return out


@router.post("/periods/{period_id}/admin-approve")
async def admin_approve(period_id: str,
                        user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    row, case = await _period(period_id, user)
    if row["status"] != ADMIN_REVIEW:
        raise HTTPException(status_code=400, detail="This period is not awaiting internal review")
    out = await _advance(row, case, AWAITING_CLIENT, "approved internally, released to client",
                         user, extra={"admin_reviewed_by_name": user["name"],
                                      "admin_reviewed_at": now_iso()})
    await notify(case["client_user_id"], f"MTD {row['label']} ready to approve",
                 f"Please review and approve your {row['label'].lower()} figures.",
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


@router.post("/periods/{period_id}/client-approve")
async def client_approve(period_id: str, user: dict = Depends(require_roles("CLIENT"))):
    row, case = await _period(period_id, user)
    if row["status"] != AWAITING_CLIENT:
        raise HTTPException(status_code=400, detail="This period is not awaiting your approval")
    out = await _advance(row, case, APPROVED, "approved by the client", user,
                         extra={"client_approved_at": now_iso()})
    async for admin in db.users.find({"role": {"$in": ["ADMIN", "SUPER_ADMIN"]},
                                      "is_active": True}):
        await notify(admin["id"], "MTD period approved by client",
                     f"{case['client_name']} — {case['case_ref']} {row['label']}",
                     case["id"], f"/admin/cases/{case['id']}", "SUBMISSION")
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
                                "submitted_by_name": user["name"],
                                "submitted_at": now_iso()},
                         comments=body.note)
    await notify(case["client_user_id"], f"MTD {row['label']} submitted",
                 f"Submission reference {body.submission_reference.strip()}",
                 case["id"], "/mtd", "SUBMISSION")
    return out
