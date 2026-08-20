"""Controlled workflow engine for TaxSimba cases (service-type aware for future MTD)."""
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException

from db import db

STATUSES = [
    "NEW", "ONBOARDING", "AWAITING_ASSIGNMENT", "ASSIGNED", "ACCOUNTANT_REVIEW",
    "AWAITING_CLIENT", "IN_PREPARATION", "READY_FOR_ADMIN_REVIEW", "ADMIN_REVIEW",
    "CHANGES_REQUIRED", "ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL",
    "CLIENT_APPROVED", "READY_FOR_SUBMISSION", "SUBMISSION_IN_PROGRESS",
    "SUBMITTED", "SUBMISSION_ISSUE", "COMPLETED",
]

# status -> (stage label, next action, next action owner)
STATUS_META = {
    "NEW": ("Information", "Complete client onboarding", "CLIENT"),
    "ONBOARDING": ("Information", "Client to provide initial information", "CLIENT"),
    "AWAITING_ASSIGNMENT": ("Information", "Assign an accountant", "ADMIN"),
    "ASSIGNED": ("Accountant Review", "Accountant to start review", "ACCOUNTANT"),
    "ACCOUNTANT_REVIEW": ("Accountant Review", "Accountant reviewing information", "ACCOUNTANT"),
    "AWAITING_CLIENT": ("Documents", "Client to provide requested items", "CLIENT"),
    "IN_PREPARATION": ("Accountant Review", "Accountant preparing calculation", "ACCOUNTANT"),
    "READY_FOR_ADMIN_REVIEW": ("Accountant Review", "Admin to review submitted work", "ADMIN"),
    "ADMIN_REVIEW": ("Accountant Review", "Admin reviewing submitted work", "ADMIN"),
    "CHANGES_REQUIRED": ("Accountant Review", "Accountant to action admin changes", "ACCOUNTANT"),
    "ADMIN_APPROVED": ("Your Approval", "Release calculation to client", "ADMIN"),
    "AWAITING_CLIENT_APPROVAL": ("Your Approval", "Client to review and approve return", "CLIENT"),
    "CLIENT_APPROVED": ("Your Approval", "Prepare for submission", "ADMIN"),
    "READY_FOR_SUBMISSION": ("HMRC Submission", "Submit return", "ADMIN"),
    "SUBMISSION_IN_PROGRESS": ("HMRC Submission", "Submission in progress", "ADMIN"),
    "SUBMITTED": ("HMRC Submission", "Awaiting confirmation", "ADMIN"),
    "SUBMISSION_ISSUE": ("HMRC Submission", "Resolve submission issue", "ADMIN"),
    "COMPLETED": ("HMRC Submission", "No action required", "NONE"),
}

STAGES = ["Information", "Documents", "Accountant Review", "Your Approval", "HMRC Submission"]

# Plain-English, client-facing wording for every internal status. Client-facing surfaces must
# never render the raw enum.
CLIENT_STATUS_LABELS = {
    "NEW": "Getting started",
    "ONBOARDING": "Getting started",
    "AWAITING_ASSIGNMENT": "With TaxSimba",
    "ASSIGNED": "With your accountant",
    "ACCOUNTANT_REVIEW": "With your accountant",
    "AWAITING_CLIENT": "Waiting for you",
    "IN_PREPARATION": "Being prepared",
    "READY_FOR_ADMIN_REVIEW": "In internal review",
    "ADMIN_REVIEW": "In internal review",
    "CHANGES_REQUIRED": "Being updated",
    "ADMIN_APPROVED": "Ready for your approval",
    "AWAITING_CLIENT_APPROVAL": "Ready for your approval",
    "CLIENT_APPROVED": "Approved by you",
    "READY_FOR_SUBMISSION": "Ready for HMRC submission",
    "SUBMISSION_IN_PROGRESS": "Submitting to HMRC",
    "SUBMITTED": "Submitted to HMRC",
    "SUBMISSION_ISSUE": "Submission issue",
    "COMPLETED": "Completed",
}


def client_status(status: str) -> str:
    """Client-safe label. Falls back to sentence case rather than exposing an enum."""
    return CLIENT_STATUS_LABELS.get(status) or status.replace("_", " ").capitalize()


def payment_deadline_label(tax_year: str) -> str:
    """Client-facing payment deadline derived from the case tax year (2025/26 -> 31 January 2027)."""
    iso = deadline_for_tax_year(tax_year)
    return f"31 January {iso[:4]}" if iso else "31 January"


def deadline_for_tax_year(tax_year: str) -> str:
    """UK online filing/payment deadline: 31 January following the end of the tax year.

    2025/26 -> 31 January 2027. Derived from the record so no screen hard-codes a year.
    """
    try:
        start = int(str(tax_year).split("/")[0])
    except (ValueError, IndexError):
        return None
    return f"{start + 2}-01-31T23:59:00+00:00"

# Server-side workflow guard. A transition not listed here is rejected, so no API
# request can skip a stage even if the frontend is bypassed.
ALLOWED_TRANSITIONS = {
    "NEW": ["ONBOARDING", "AWAITING_ASSIGNMENT"],
    "ONBOARDING": ["AWAITING_ASSIGNMENT"],
    "AWAITING_ASSIGNMENT": ["ASSIGNED"],
    "ASSIGNED": ["ACCOUNTANT_REVIEW", "ASSIGNED"],
    "ACCOUNTANT_REVIEW": ["AWAITING_CLIENT", "IN_PREPARATION", "READY_FOR_ADMIN_REVIEW", "ASSIGNED"],
    "AWAITING_CLIENT": ["ACCOUNTANT_REVIEW", "AWAITING_CLIENT", "ASSIGNED"],
    "IN_PREPARATION": ["AWAITING_CLIENT", "IN_PREPARATION", "READY_FOR_ADMIN_REVIEW", "ASSIGNED"],
    "READY_FOR_ADMIN_REVIEW": ["ADMIN_REVIEW", "CHANGES_REQUIRED", "ADMIN_APPROVED"],
    "ADMIN_REVIEW": ["CHANGES_REQUIRED", "ADMIN_APPROVED"],
    "CHANGES_REQUIRED": ["ACCOUNTANT_REVIEW", "IN_PREPARATION", "AWAITING_CLIENT", "READY_FOR_ADMIN_REVIEW", "ASSIGNED"],
    "ADMIN_APPROVED": ["AWAITING_CLIENT_APPROVAL"],
    "AWAITING_CLIENT_APPROVAL": ["CLIENT_APPROVED", "AWAITING_CLIENT_APPROVAL"],
    "CLIENT_APPROVED": ["READY_FOR_SUBMISSION"],
    "READY_FOR_SUBMISSION": ["SUBMISSION_IN_PROGRESS", "SUBMITTED"],
    "SUBMISSION_IN_PROGRESS": ["SUBMITTED", "SUBMISSION_ISSUE"],
    "SUBMITTED": ["COMPLETED", "SUBMISSION_ISSUE"],
    "SUBMISSION_ISSUE": ["SUBMISSION_IN_PROGRESS", "SUBMITTED"],
    # Completed cases are locked; only an audited admin reopen can move them.
    "COMPLETED": ["ACCOUNTANT_REVIEW", "ASSIGNED"],
}

STAGE_ORDER = {s: i for i, s in enumerate(STAGES)}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def journey(status: str, has_submission: bool = False):
    """Client-facing journey derived automatically from case status.

    Stage wording is data-driven and never claims a successful HMRC submission unless an
    authorised submission record actually exists.
    """
    order = ["NEW", "ONBOARDING", "AWAITING_ASSIGNMENT", "ASSIGNED", "ACCOUNTANT_REVIEW",
             "AWAITING_CLIENT", "IN_PREPARATION", "READY_FOR_ADMIN_REVIEW", "ADMIN_REVIEW",
             "CHANGES_REQUIRED", "ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL",
             "CLIENT_APPROVED", "READY_FOR_SUBMISSION", "SUBMISSION_IN_PROGRESS",
             "SUBMITTED", "SUBMISSION_ISSUE", "COMPLETED"]
    idx = order.index(status) if status in order else 0

    def reached(s):
        return idx >= order.index(s)

    # Information
    if reached("AWAITING_ASSIGNMENT"):
        info = "Completed"
    elif reached("ONBOARDING"):
        info = "In Progress"
    else:
        info = "Not Started"

    # Documents
    if status == "AWAITING_CLIENT":
        docs = "Documents Required"
    elif reached("IN_PREPARATION"):
        docs = "Completed"
    elif reached("ASSIGNED"):
        docs = "In Progress"
    else:
        docs = "Not Started"

    # Accountant Review
    if reached("ADMIN_APPROVED"):
        review = "Completed"
    elif status in ("READY_FOR_ADMIN_REVIEW", "ADMIN_REVIEW", "CHANGES_REQUIRED"):
        review = "In Review"
    elif reached("ASSIGNED"):
        review = "In Review"
    else:
        review = "Waiting"

    # Your Approval
    if reached("CLIENT_APPROVED"):
        approval = "Approved"
    elif status in ("ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL"):
        approval = "Action Required"
    else:
        approval = "Waiting"

    # HMRC Submission -- only ever "Submitted Successfully" with a real submission record
    if status == "SUBMISSION_ISSUE":
        submission = "Submission Failed"
    elif status in ("SUBMITTED", "COMPLETED") and has_submission:
        submission = "Submitted Successfully"
    elif status in ("SUBMITTED", "COMPLETED"):
        submission = "Submitting"
    elif status == "SUBMISSION_IN_PROGRESS":
        submission = "Submitting"
    elif status in ("CLIENT_APPROVED", "READY_FOR_SUBMISSION"):
        submission = "Ready to Submit"
    else:
        submission = "Not Started"

    return [
        {"step": "Information", "state": info},
        {"step": "Documents", "state": docs},
        {"step": "Accountant Review", "state": review},
        {"step": "Your Approval", "state": approval},
        {"step": "HMRC Submission", "state": submission},
    ]


async def log_activity(case_id: str, action: str, user: dict, meta: dict | None = None,
                       previous_status: str | None = None, new_status: str | None = None, comments: str | None = None):
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "case_id": case_id,
        "action": action,
        "user_id": user.get("id") if user else None,
        "user_name": user.get("name") if user else "System",
        "role": user.get("role") if user else "SYSTEM",
        "previous_status": previous_status,
        "new_status": new_status,
        "comments": comments,
        "meta": meta or {},
        "created_at": now_iso(),
    })


async def notify(user_id: str, title: str, body: str, case_id: str | None = None, link: str | None = None, ntype: str = "INFO"):
    """Idempotent notification: one genuine event produces one genuine notification.

    A repeated API call or retry that would raise the same still-unread notification for the
    same user and case is collapsed instead of stacking up a duplicate badge count.
    """
    duplicate = await db.notifications.find_one({
        "user_id": user_id, "title": title, "case_id": case_id, "is_read": False,
    })
    if duplicate:
        await db.notifications.update_one({"id": duplicate["id"]},
                                         {"$set": {"body": body, "created_at": now_iso()}})
        return
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "body": body,
        "case_id": case_id,
        "link": link,
        "type": ntype,
        "is_read": False,
        "created_at": now_iso(),
    })


async def transition(case: dict, new_status: str, user: dict, action_label: str,
                     waiting_reason: str | None = None, extra: dict | None = None, comments: str | None = None):
    """Single controlled entry point for every status change, validated server-side."""
    if new_status not in STATUSES:
        raise HTTPException(status_code=400, detail=f"Unknown status {new_status}")
    previous = case["status"]
    if new_status not in ALLOWED_TRANSITIONS.get(previous, []):
        raise HTTPException(
            status_code=400,
            detail=f"Workflow rule: cannot move from {previous} to {new_status}",
        )
    stage, next_action, owner = STATUS_META[new_status]
    update = {
        "status": new_status,
        "current_stage": stage,
        "next_action": next_action,
        "next_action_owner": owner,
        "waiting_reason": waiting_reason,
        "last_updated": now_iso(),
    }
    if extra:
        update.update(extra)
    await db.cases.update_one({"id": case["id"]}, {"$set": update})
    await log_activity(case["id"], action_label, user, {"status": new_status},
                       previous_status=previous, new_status=new_status, comments=comments)
    case.update(update)
    return case
