"""Targeted check: deadline passing with client records outstanding escalates correctly."""
import asyncio
import sys
import uuid

sys.path.insert(0, "/app/backend")

from dotenv import load_dotenv  # noqa: E402

load_dotenv("/app/backend/.env")

import requests  # noqa: E402

from auth import hash_password  # noqa: E402
from db import db  # noqa: E402
from phase1b import MTD, activate_service, bootstrap_client_services  # noqa: E402
from workflow import now_iso  # noqa: E402

API = "https://taxsimba-foundation.preview.emergentagent.com/api"
EMAIL = "chk.overdue@qa-taxsimba.example.com"
PW = "ChkOverdue@12345"
R = {}


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def cleanup():
    users = [u async for u in db.users.find({"email": EMAIL})]
    uids = [u["id"] for u in users]
    clients = [c async for c in db.clients.find({"user_id": {"$in": uids}})]
    cids = [c["id"] for c in clients]
    cases = [c async for c in db.cases.find({"client_id": {"$in": cids}})]
    ids = [c["id"] for c in cases]
    for coll, q in [("mtd_periods", {"case_id": {"$in": ids}}),
                    ("documents", {"case_id": {"$in": ids}}),
                    ("document_requests", {"case_id": {"$in": ids}}),
                    ("tasks", {"case_id": {"$in": ids}}),
                    ("activity_logs", {"case_id": {"$in": ids}}),
                    ("audit_log", {"case_id": {"$in": ids}}),
                    ("notifications", {"case_id": {"$in": ids}}),
                    ("notifications", {"user_id": {"$in": uids}}),
                    ("payment_transactions", {"client_id": {"$in": cids}}),
                    ("client_services", {"client_id": {"$in": cids}}),
                    ("cases", {"client_id": {"$in": cids}}),
                    ("clients", {"user_id": {"$in": uids}}),
                    ("users", {"id": {"$in": uids}})]:
        await db[coll].delete_many(q)


async def main():
    await cleanup()
    admin = login("admin@taxsimba.co.uk", "Admin@123")
    acct = login("accountant.a@taxsimba.co.uk", "Account@123")
    cu = {"id": str(uuid.uuid4()), "email": EMAIL, "name": "Chk Overdue", "role": "CLIENT",
          "password_hash": hash_password(PW), "is_active": True, "created_at": now_iso()}
    await db.users.insert_one(dict(cu))
    client = {"id": str(uuid.uuid4()), "user_id": cu["id"], "name": "Chk Overdue",
              "email": EMAIL, "is_test": False, "client_ref": "CHK", "created_at": now_iso()}
    await db.clients.insert_one(dict(client))
    await bootstrap_client_services(client)
    case = (await activate_service(client, cu, MTD, "MTD_ESSENTIAL"))["case"]
    acct_user = await db.users.find_one({"email": "accountant.a@taxsimba.co.uk"})
    await db.cases.update_one({"id": case["id"]},
                              {"$set": {"assigned_accountant_id": acct_user["id"],
                                        "assigned_accountant_name": acct_user["name"]}})
    cli = login(EMAIL, PW)
    q1 = await db.mtd_periods.find_one({"case_id": case["id"], "quarter": 1})

    # accountant requests records, then the deadline passes
    requests.post(f"{API}/mtd/periods/{q1['id']}/requests", headers=acct,
                  json={"document_type": "Q1 bank statements", "note": "Please upload"})
    await db.mtd_periods.update_one({"id": q1["id"]}, {"$set": {"deadline": "2026-05-01"}})

    staff = [p for p in requests.get(f"{API}/mtd/cases/{case['id']}/periods",
                                     headers=acct).json() if p.get("quarter") == 1][0]
    client_view = [p for p in requests.get(f"{API}/mtd/cases/{case['id']}/periods",
                                           headers=cli).json() if p.get("quarter") == 1][0]
    R["Period shows OVERDUE - waiting for client"] = (
        staff["stage_label"] == "Overdue — waiting for client"
        and staff["deadline_warning"] == "OVERDUE"
        and staff["overdue_waiting_for_client"] is True)
    R["Client remains action owner"] = (staff["next_action_owner"] == "CLIENT"
                                        and client_view["stage_label"] == "Action required — overdue")
    R["Delay not attributed to accountant"] = staff["delay_attributed_to"] == "CLIENT" and \
        "accountant" not in staff["next_action"].lower()

    # request/reminder history preserved
    reqs = await db.document_requests.count_documents({"mtd_period_id": q1["id"]})
    tasks = await db.tasks.count_documents({"case_id": case["id"], "owner_role": "CLIENT"})
    placeholders = await db.documents.count_documents({"mtd_period_id": q1["id"],
                                                       "status": "Requested"})
    acts = await db.activity_logs.count_documents({"case_id": case["id"]})
    R["Request/reminder history preserved"] = reqs == 1 and tasks == 1 and \
        placeholders == 1 and acts >= 1

    # visible escalation to admin: bucket, stats and notification
    bucket = requests.get(f"{API}/mtd/periods", headers=admin,
                          params={"bucket": "overdue_waiting_client"}).json()
    stats = requests.get(f"{API}/mtd/stats", headers=admin).json()
    admin_user = await db.users.find_one({"email": "admin@taxsimba.co.uk"})
    notes = await db.notifications.count_documents(
        {"user_id": admin_user["id"], "case_id": case["id"],
         "title": {"$regex": "Overdue — waiting for client"}})
    R["Escalated visibly to Admin/Super Admin"] = any(
        p["id"] == q1["id"] and p["stage_label"] == "Overdue — waiting for client"
        for p in bucket) and "overdue_waiting_client" in stats and notes >= 1

    # repeat client fetch must not spam duplicate escalations
    requests.get(f"{API}/mtd/cases/{case['id']}/periods", headers=cli)
    notes2 = await db.notifications.count_documents(
        {"user_id": admin_user["id"], "case_id": case["id"],
         "title": {"$regex": "Overdue — waiting for client"}})
    R["Escalation not duplicated"] = notes2 == notes

    # submission still blocked without the workflow prerequisites
    sub = requests.post(f"{API}/mtd/periods/{q1['id']}/record-submission", headers=admin,
                        json={"submission_reference": "X-1", "submission_date": "2026-05-02"})
    R["Submission still blocked"] = sub.status_code == 400 and \
        "approval" in sub.json()["detail"].lower()

    # accountant workload reports it as client-side, not accountant action
    wl = requests.get(f"{API}/mtd/my-workload", headers=acct).json()
    R["Accountant workload flags client wait"] = wl["counts"]["overdue_waiting_client"] >= 1 and \
        all(i["id"] != q1["id"] for i in wl["buckets"]["needs_my_action"])

    for k, v in R.items():
        print(f"{k}: {'PASS' if v else 'FAIL'}")
    await cleanup()
    print("cleanup left users:", await db.users.count_documents({"email": EMAIL}))


asyncio.run(main())
