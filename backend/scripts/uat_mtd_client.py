"""Disposable MTD UAT client for manual preview testing. Usage: setup | cleanup."""
import asyncio
import sys
import uuid

sys.path.insert(0, "/app/backend")

from dotenv import load_dotenv  # noqa: E402

load_dotenv("/app/backend/.env")

from auth import hash_password  # noqa: E402
from db import db  # noqa: E402
from phase1b import MTD, activate_service, bootstrap_client_services  # noqa: E402
from workflow import now_iso  # noqa: E402

EMAIL = "uat.mtd@taxsimba-uat.example.com"
PASSWORD = "UatMtd@12345"
NAME = "UAT MTD Client (disposable)"


async def setup():
    await cleanup(quiet=True)
    user = {"id": str(uuid.uuid4()), "email": EMAIL, "name": NAME, "role": "CLIENT",
            "password_hash": hash_password(PASSWORD), "phone": "07000000111",
            "is_active": True, "is_uat": True, "created_at": now_iso()}
    await db.users.insert_one(dict(user))
    client = {"id": str(uuid.uuid4()), "user_id": user["id"], "name": NAME, "email": EMAIL,
              "phone": "07000000111", "client_ref": "UAT-MTD", "is_test": False,
              "is_uat": True, "created_at": now_iso()}
    await db.clients.insert_one(dict(client))
    await bootstrap_client_services(client)
    result = await activate_service(client, user, MTD, "MTD_ESSENTIAL",
                                    reason="Disposable UAT activation", amount=240.0)
    case = result["case"]
    await db.cases.update_one({"id": case["id"]}, {"$set": {"is_uat": True}})
    svcs = {s["service_type"]: s["status"] async for s in
            db.client_services.find({"client_id": client["id"]})}
    periods = [(p["label"], p["deadline"], p["status"]) async for p in
               db.mtd_periods.find({"case_id": case["id"]}).sort("period_start", 1)]
    print("client login:", EMAIL, "/", PASSWORD)
    print("case:", case["case_ref"], "| tax year", case["tax_year"], "| status", case["status"],
          "| accountant", case["assigned_accountant_name"])
    print("services:", svcs)
    for p in periods:
        print("  period:", p)
    print("tasks:", await db.tasks.count_documents({"case_id": case["id"]}),
          "documents:", await db.documents.count_documents({"case_id": case["id"]}),
          "requests:", await db.document_requests.count_documents({"case_id": case["id"]}),
          "drafts:", await db.mtd_periods.count_documents({"case_id": case["id"],
                                                           "draft": {"$ne": None}}),
          "submissions:", await db.mtd_periods.count_documents({"case_id": case["id"],
                                                                "status": "SUBMITTED"}))


async def cleanup(quiet=False):
    users = [u async for u in db.users.find({"email": EMAIL})]
    uids = [u["id"] for u in users]
    clients = [c async for c in db.clients.find({"user_id": {"$in": uids}})]
    cids = [c["id"] for c in clients]
    cases = [c async for c in db.cases.find({"client_id": {"$in": cids}})]
    case_ids = [c["id"] for c in cases]
    counts = {}
    for coll, q in [("mtd_periods", {"case_id": {"$in": case_ids}}),
                    ("documents", {"case_id": {"$in": case_ids}}),
                    ("document_requests", {"case_id": {"$in": case_ids}}),
                    ("tasks", {"case_id": {"$in": case_ids}}),
                    ("messages", {"case_id": {"$in": case_ids}}),
                    ("case_notes", {"case_id": {"$in": case_ids}}),
                    ("assignments", {"case_id": {"$in": case_ids}}),
                    ("activity_log", {"case_id": {"$in": case_ids}}),
                    ("audit_log", {"case_id": {"$in": case_ids}}),
                    ("notifications", {"user_id": {"$in": uids}}),
                    ("payment_transactions", {"client_id": {"$in": cids}}),
                    ("client_services", {"client_id": {"$in": cids}}),
                    ("cases", {"client_id": {"$in": cids}}),
                    ("clients", {"user_id": {"$in": uids}}),
                    ("users", {"id": {"$in": uids}})]:
        counts[coll] = (await db[coll].delete_many(q)).deleted_count
    if not quiet:
        print("removed:", {k: v for k, v in counts.items() if v})
        print("users left:", await db.users.count_documents({"email": EMAIL}))


if __name__ == "__main__":
    asyncio.run(setup() if sys.argv[1] == "setup" else cleanup())
