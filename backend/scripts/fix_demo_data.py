"""One-off demo data correction for the Client A / Client B portal journeys.

Scope is deliberately narrow (agreed with the product owner): only the two demo clients are
touched. Other test records are left alone. Nothing here deletes real accounting history for
any other client, and no product code path depends on this script.

It does three things:
  1. Repairs the orphaned child rows that caused the cross-case leak (tasks/documents whose
     denormalised owner field pointed at a demo client while their case belonged elsewhere).
  2. Collapses the accumulated duplicate cases so each demo client has ONE realistic active
     Self Assessment journey, and removes duplicate tasks/documents/notifications.
  3. Standardises the active demo journey on tax year 2025/26 with the correct 31 Jan 2027
     filing deadline, derived from the tax year rather than hard-coded per screen.

Run:  python -m scripts.fix_demo_data      (from /app/backend)
"""
import asyncio
import os
import sys

from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
sys.path.insert(0, "/app/backend")

from db import db  # noqa: E402
from workflow import deadline_for_tax_year, now_iso  # noqa: E402

DEMO_EMAILS = ["clienta@example.com", "clientb@example.com"]
TARGET_TAX_YEAR = "2025/26"


async def _purge_orphans(uid: str, owned: set) -> dict:
    """Delete child rows that reference a case this client does not own.

    These are the rows that produced the leak: a stale denormalised user id combined with a
    case_id belonging to a different client. They are junk from repeated test runs and are
    not real client records.
    """
    t = await db.tasks.delete_many({"owner_id": uid, "case_id": {"$nin": list(owned)}})
    d = await db.documents.delete_many({"client_user_id": uid, "case_id": {"$nin": list(owned)}})
    n = await db.notifications.delete_many(
        {"user_id": uid, "case_id": {"$nin": list(owned) + [None]}})
    r = await db.document_requests.delete_many(
        {"client_user_id": uid, "case_id": {"$nin": list(owned)}})
    return {"tasks": t.deleted_count, "documents": d.deleted_count,
            "notifications": n.deleted_count, "requests": r.deleted_count}


async def _dedupe(case_ids: list) -> dict:
    """Collapse duplicate rows so one genuine action shows one genuine record."""
    removed = {"tasks": 0, "documents": 0, "notifications": 0}
    seen = set()
    async for t in db.tasks.find({"case_id": {"$in": case_ids}}).sort("created_at", 1):
        key = (t["case_id"], t.get("name"), t.get("owner_role"))
        if key in seen:
            await db.tasks.delete_one({"id": t["id"]})
            removed["tasks"] += 1
        else:
            seen.add(key)
    seen = set()
    async for doc in db.documents.find({"case_id": {"$in": case_ids}}).sort("created_at", 1):
        # keep an uploaded file over an unfulfilled placeholder of the same name
        key = (doc["case_id"], doc.get("name"), doc.get("status"))
        if key in seen:
            await db.documents.delete_one({"id": doc["id"]})
            removed["documents"] += 1
        else:
            seen.add(key)
    return removed


async def main():
    report = {}
    for email in DEMO_EMAILS:
        user = await db.users.find_one({"email": email})
        if not user:
            print(f"skip {email}: no such user")
            continue
        uid = user["id"]
        client = await db.clients.find_one({"user_id": uid})
        owner = {"$or": [{"client_user_id": uid}]}
        if client:
            owner = {"$or": [{"client_user_id": uid}, {"client_id": client["id"]}]}

        cases = await db.cases.find({**owner, "service_type": "SELF_ASSESSMENT"}
                                    ).sort("created_at", -1).to_list(500)
        if not cases:
            print(f"skip {email}: no SA case")
            continue

        # Keep the most recently updated case that is still in flight; otherwise the newest.
        active = sorted(
            cases,
            key=lambda c: (c["status"] not in ("SUBMITTED", "COMPLETED"),
                           c.get("last_updated") or c.get("created_at") or ""),
            reverse=True)[0]
        keep_id = active["id"]
        drop = [c["id"] for c in cases if c["id"] != keep_id]

        # Remove the accumulated duplicate cases and everything hanging off them.
        if drop:
            await db.cases.delete_many({"id": {"$in": drop}})
            for coll in (db.tasks, db.documents, db.document_requests, db.messages,
                         db.activity_logs, db.calculations, db.reviews, db.client_approvals,
                         db.submission_records, db.assignments, db.notifications,
                         db.recommendations, db.internal_notes):
                await coll.delete_many({"case_id": {"$in": drop}})

        owned = {keep_id}
        # Any MTD case for the same client stays -- one login, multiple services.
        async for c in db.cases.find({**owner, "service_type": {"$ne": "SELF_ASSESSMENT"}}):
            owned.add(c["id"])

        orphans = await _purge_orphans(uid, owned)
        deduped = await _dedupe(list(owned))

        # Standardise the active journey on 2025/26 with the derived deadline.
        await db.cases.update_one({"id": keep_id}, {"$set": {
            "tax_year": TARGET_TAX_YEAR,
            "external_deadline": deadline_for_tax_year(TARGET_TAX_YEAR),
            "last_updated": now_iso()}})
        await db.documents.update_many({"case_id": keep_id},
                                       {"$set": {"tax_year": TARGET_TAX_YEAR}})
        await db.calculations.update_many({"case_id": keep_id},
                                          {"$set": {"tax_year": TARGET_TAX_YEAR}})
        if client:
            await db.client_services.update_many(
                {"client_id": client["id"], "service_type": "SELF_ASSESSMENT"},
                {"$set": {"tax_year": TARGET_TAX_YEAR}})

        remaining_notes = await db.notifications.count_documents({"user_id": uid})
        report[email] = {
            "kept_case": active.get("case_ref"), "duplicate_cases_removed": len(drop),
            "orphans_removed": orphans, "duplicates_removed": deduped,
            "notifications_remaining": remaining_notes,
        }

    for k, v in report.items():
        print(k, "->", v)


if __name__ == "__main__":
    asyncio.get_event_loop().run_until_complete(main())
