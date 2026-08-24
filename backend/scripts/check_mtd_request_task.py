"""Targeted check: MTD period document request creates a client task that closes on upload."""
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

EMAIL = "chk.mtdtask@qa-taxsimba.example.com"


async def cleanup():
    users = [u async for u in db.users.find({"email": EMAIL})]
    uids = [u["id"] for u in users]
    clients = [c async for c in db.clients.find({"user_id": {"$in": uids}})]
    cids = [c["id"] for c in clients]
    cases = [c async for c in db.cases.find({"client_id": {"$in": cids}})]
    case_ids = [c["id"] for c in cases]
    for coll, q in [("mtd_periods", {"case_id": {"$in": case_ids}}),
                    ("documents", {"case_id": {"$in": case_ids}}),
                    ("document_requests", {"case_id": {"$in": case_ids}}),
                    ("tasks", {"case_id": {"$in": case_ids}}),
                    ("activity_log", {"case_id": {"$in": case_ids}}),
                    ("audit_log", {"case_id": {"$in": case_ids}}),
                    ("notifications", {"user_id": {"$in": uids}}),
                    ("client_services", {"client_id": {"$in": cids}}),
                    ("cases", {"client_id": {"$in": cids}}),
                    ("clients", {"user_id": {"$in": uids}}),
                    ("users", {"id": {"$in": uids}})]:
        await db[coll].delete_many(q)


async def main():
    import mtd
    from mtd import QuarterRequestIn, request_quarter_document

    await cleanup()
    user = {"id": str(uuid.uuid4()), "email": EMAIL, "name": "Chk MTD Task", "role": "ACCOUNTANT",
            "password_hash": hash_password("ChkAccount@12345"), "is_active": True,
            "created_at": now_iso()}
    client_user = {"id": str(uuid.uuid4()), "email": EMAIL, "name": "Chk MTD Task",
                   "role": "CLIENT", "password_hash": hash_password("ChkAccount@12345"),
                   "is_active": True, "created_at": now_iso()}
    await db.users.insert_one(dict(client_user))
    client = {"id": str(uuid.uuid4()), "user_id": client_user["id"], "name": "Chk MTD Task",
              "email": EMAIL, "is_test": True, "client_ref": "CHK", "created_at": now_iso()}
    await db.clients.insert_one(dict(client))
    await bootstrap_client_services(client)
    result = await activate_service(client, client_user, MTD, "MTD_ESSENTIAL")
    case = result["case"]
    await db.cases.update_one({"id": case["id"]},
                              {"$set": {"assigned_accountant_id": user["id"],
                                        "assigned_accountant_name": user["name"]}})
    q1 = await db.mtd_periods.find_one({"case_id": case["id"], "quarter": 1})

    doc = await request_quarter_document(q1["id"], QuarterRequestIn(
        document_type="Q1 bank statements", note="Please upload"), user)
    task = await db.tasks.find_one({"case_id": case["id"], "owner_role": "CLIENT"})
    req = await db.document_requests.find_one({"case_id": case["id"]})
    check1 = bool(task and task["status"] == "OPEN"
                  and task.get("mtd_period_id") == q1["id"]
                  and doc["task_id"] == task["id"] and req["task_id"] == task["id"]
                  and doc["mtd_period_id"] == q1["id"])
    print("1 request creates open client task linked to the period:", check1, task["name"])

    # repeat request must not duplicate the task/request
    await request_quarter_document(q1["id"], QuarterRequestIn(
        document_type="Q1 bank statements", note="Please upload"), user)
    tasks = await db.tasks.count_documents({"case_id": case["id"], "owner_role": "CLIENT"})
    placeholders = await db.documents.count_documents({"case_id": case["id"],
                                                       "status": "Requested"})
    check2 = tasks == 1 and placeholders == 1
    print("2 no duplicate task/placeholder on repeat:", check2, tasks, placeholders)

    # client upload against the placeholder closes the task (mirrors /documents/upload)
    from server import complete_task
    existing = await db.documents.find_one({"id": doc["id"]})
    await db.documents.update_one({"id": doc["id"]},
                                  {"$set": {"status": "Uploaded", "upload_date": now_iso()}})
    await db.document_requests.update_one({"id": existing["request_id"]},
                                          {"$set": {"status": "Uploaded"}})
    await complete_task(existing["task_id"], client_user)
    task_after = await db.tasks.find_one({"id": existing["task_id"]})
    check3 = task_after["status"] == "COMPLETED"
    print("3 upload closes the task:", check3, task_after["status"])

    # the action feed picks it up (task is owned by the client on an owned case)
    owned = await db.tasks.count_documents({"owner_id": client_user["id"],
                                            "case_id": case["id"]})
    periods = await db.mtd_periods.count_documents({"case_id": case["id"]})
    check4 = owned == 1 and periods == 5
    print("4 client-owned task on the MTD case, periods intact:", check4, owned, periods)

    print("RESULT:", "PASS" if all([check1, check2, check3, check4]) else "FAIL")
    await cleanup()
    print("cleanup left users:", await db.users.count_documents({"email": EMAIL}))
    _ = mtd


asyncio.run(main())
