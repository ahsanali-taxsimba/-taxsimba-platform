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
    "READY_FOR_SUBMISSION": ("Submitted to HMRC", "Submit return", "ADMIN"),
    "SUBMISSION_IN_PROGRESS": ("Submitted to HMRC", "Submission in progress", "ADMIN"),
    "SUBMITTED": ("Submitted to HMRC", "Awaiting confirmation", "ADMIN"),
    "SUBMISSION_ISSUE": ("Submitted to HMRC", "Resolve submission issue", "ADMIN"),
    "COMPLETED": ("Submitted to HMRC", "No action required", "NONE"),
}

STAGES = ["Information", "Documents", "Accountant Review", "Your Approval", "Submitted to HMRC"]

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
    "COMPLETED": [],
}

STAGE_ORDER = {s: i for i, s in enumerate(STAGES)}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def journey(status: str):
    """Client-facing journey derived automatically from case status."""
    order = ["NEW", "ONBOARDING", "AWAITING_ASSIGNMENT", "ASSIGNED", "ACCOUNTANT_REVIEW",
             "AWAITING_CLIENT", "IN_PREPARATION", "READY_FOR_ADMIN_REVIEW", "ADMIN_REVIEW",
             "CHANGES_REQUIRED", "ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL",
             "CLIENT_APPROVED", "READY_FOR_SUBMISSION", "SUBMISSION_IN_PROGRESS",
             "SUBMITTED", "SUBMISSION_ISSUE", "COMPLETED"]
    idx = order.index(status) if status in order else 0

    def state(step_start, step_done):
        if idx >= order.index(step_done):
            return "Completed"
        if idx >= order.index(step_start):
            return "In Progress"
        return "Not Started"

    return [
        {"step": "Information", "state": state("NEW", "AWAITING_ASSIGNMENT")},
        {"step": "Documents", "state": state("AWAITING_ASSIGNMENT", "IN_PREPARATION")},
        {"step": "Accountant Review", "state": state("ASSIGNED", "ADMIN_APPROVED")},
        {"step": "Your Approval", "state": state("ADMIN_APPROVED", "CLIENT_APPROVED")},
        {"step": "Submitted to HMRC", "state": state("READY_FOR_SUBMISSION", "SUBMITTED")},
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
