"""Temporary QA clients for the three service combinations. Usage: setup | cleanup."""
import asyncio
import sys
import uuid

sys.path.insert(0, "/app/backend")

from dotenv import load_dotenv  # noqa: E402

load_dotenv("/app/backend/.env")

from auth import hash_password  # noqa: E402
from db import db  # noqa: E402
from phase1b import (MTD, SELF_ASSESSMENT, _fulfil, activate_service,  # noqa: E402
                     bootstrap_client_services)
from workflow import STATUS_META, deadline_for_tax_year, now_iso  # noqa: E402

PASSWORD = "QaCombo@12345"
COMBOS = [
    ("qa.saonly@qa-taxsimba.example.com", "QA SA Only", "sa"),
    ("qa.mtdonly@qa-taxsimba.example.com", "QA MTD Only", "mtd"),
    ("qa.both@qa-taxsimba.example.com", "QA Both Services", "both"),
]


async def make_user(email, name):
    user = {"id": str(uuid.uuid4()), "email": email, "name": name, "role": "CLIENT",
            "password_hash": hash_password(PASSWORD), "phone": "07000000000",
            "is_active": True, "created_at": now_iso()}
    await db.users.insert_one(dict(user))
    client = {"id": str(uuid.uuid4()), "user_id": user["id"], "name": name, "email": email,
              "phone": "07000000000", "is_test": False, "client_ref": f"QA-{email[3:7].upper()}",
              "created_at": now_iso()}
    await db.clients.insert_one(dict(client))
    await bootstrap_client_services(client)
    return user, client


async def make_sa_case(user, client, tax_year="2025/26"):
    stage, next_action, owner = STATUS_META["AWAITING_ASSIGNMENT"]
    seq = await db.cases.count_documents({}) + 900
    case = {"id": str(uuid.uuid4()), "case_ref": f"SA-QA{seq}", "is_test": False,
            "client_id": client["id"], "client_user_id": user["id"], "client_name": client["name"],
            "service_type": SELF_ASSESSMENT, "tax_year": tax_year,
            "assigned_accountant_id": None, "assigned_accountant_name": None,
            "admin_reviewer_id": None, "admin_reviewer_name": None,
            "status": "AWAITING_ASSIGNMENT", "current_stage": stage, "next_action": next_action,
            "next_action_owner": owner, "priority": "MEDIUM", "internal_deadline": None,
            "external_deadline": deadline_for_tax_year(tax_year), "internal_instructions": None,
            "waiting_reason": None, "approved_version_id": None,
            "created_at": now_iso(), "last_updated": now_iso()}
    await db.cases.insert_one(dict(case))
    return case


async def activate_mtd(user, client):
    """Genuine post-payment fulfilment path: confirmed payment -> ACTIVE service + case + periods."""
    tx = {"id": str(uuid.uuid4()), "session_id": f"qa_{uuid.uuid4().hex[:12]}",
          "user_id": user["id"], "client_id": client["id"], "kind": "SERVICE_ACTIVATION",
          "service_type": MTD, "previous_package": None, "new_package": "MTD_ESSENTIAL",
          "amount": 240.0, "currency": "gbp", "status": "complete", "payment_status": "paid",
          "fulfilled": False, "created_at": now_iso(), "updated_at": now_iso()}
    await db.payment_transactions.insert_one(dict(tx))
    await _fulfil(tx)


async def setup():
    await cleanup(quiet=True)
    for email, name, kind in COMBOS:
        user, client = await make_user(email, name)
        if kind in ("sa", "both"):
            await activate_service(client, user, SELF_ASSESSMENT, "SMART")
        if kind in ("mtd", "both"):
            await activate_mtd(user, client)
        svcs = [(s["service_type"], s["status"]) async for s in
                db.client_services.find({"client_id": client["id"]})]
        cases = [(c["case_ref"], c["service_type"]) async for c in
                 db.cases.find({"client_id": client["id"]})]
        periods = await db.mtd_periods.count_documents({"client_id": client["id"]}) \
            if "mtd_periods" in await db.list_collection_names() else 0
        print(f"{email} -> services={svcs} cases={cases} mtd_periods={periods}")


async def cleanup(quiet=False):
    emails = [c[0] for c in COMBOS]
    users = [u async for u in db.users.find({"email": {"$in": emails}})]
    uids = [u["id"] for u in users]
    clients = [c async for c in db.clients.find({"user_id": {"$in": uids}})]
    cids = [c["id"] for c in clients]
    cases = [c async for c in db.cases.find({"client_id": {"$in": cids}})]
    case_ids = [c["id"] for c in cases]
    counts = {}
    for coll, q in [("mtd_periods", {"case_id": {"$in": case_ids}}),
                    ("documents", {"case_id": {"$in": case_ids}}),
                    ("activity_log", {"case_id": {"$in": case_ids}}),
                    ("audit_log", {"case_id": {"$in": case_ids}}),
                    ("tasks", {"case_id": {"$in": case_ids}}),
                    ("messages", {"case_id": {"$in": case_ids}}),
                    ("notifications", {"user_id": {"$in": uids}}),
                    ("payment_transactions", {"client_id": {"$in": cids}}),
                    ("client_services", {"client_id": {"$in": cids}}),
                    ("cases", {"client_id": {"$in": cids}}),
                    ("clients", {"user_id": {"$in": uids}}),
                    ("users", {"id": {"$in": uids}})]:
        r = await db[coll].delete_many(q)
        counts[coll] = r.deleted_count
    if not quiet:
        print("removed:", counts)
        print("left users:", await db.users.count_documents({"email": {"$in": emails}}))


if __name__ == "__main__":
    asyncio.run(setup() if sys.argv[1] == "setup" else cleanup())
