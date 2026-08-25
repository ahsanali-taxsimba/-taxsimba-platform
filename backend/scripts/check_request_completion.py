"""Targeted check on MTD-2004 Quarter 1: requested-document upload closes the request."""
import asyncio
import io
import sys

sys.path.insert(0, "/app/backend")

from dotenv import load_dotenv  # noqa: E402

load_dotenv("/app/backend/.env")

import requests  # noqa: E402

from db import db  # noqa: E402

API = "https://taxsimba-foundation.preview.emergentagent.com/api"
R = {}


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def main():
    admin = login("admin@taxsimba.co.uk", "Admin@123")
    acct = login("accountant.a@taxsimba.co.uk", "Account@123")
    cli = login("uat.mtd@taxsimba-uat.example.com", "UatMtd@12345")
    case = await db.cases.find_one({"case_ref": "MTD-2004"})
    acct_user = await db.users.find_one({"email": "accountant.a@taxsimba.co.uk"})
    was_assigned = case.get("assigned_accountant_id")
    await db.cases.update_one({"id": case["id"]},
                              {"$set": {"assigned_accountant_id": acct_user["id"],
                                        "assigned_accountant_name": acct_user["name"]}})
    q1 = await db.mtd_periods.find_one({"case_id": case["id"], "quarter": 1})
    acts_before = await db.activity_logs.count_documents({"case_id": case["id"]})
    notes_before = await db.notifications.count_documents({"user_id": acct_user["id"],
                                                           "case_id": case["id"]})

    # two disposable requests so we can prove one upload closes only its own request
    r1 = requests.post(f"{API}/mtd/periods/{q1['id']}/requests", headers=acct,
                       json={"document_type": "UAT check statement"}).json()
    r2 = requests.post(f"{API}/mtd/periods/{q1['id']}/requests", headers=acct,
                       json={"document_type": "UAT check invoice"}).json()

    # client uploads against request 1 only
    up = requests.post(f"{API}/documents/upload", headers=cli,
                       data={"case_id": case["id"], "document_type": r1["document_type"],
                             "mtd_period_id": q1["id"], "document_id": r1["id"]},
                       files={"file": ("uat-check.pdf", io.BytesIO(b"%PDF-1.4 uat"),
                                       "application/pdf")})
    doc = up.json()
    req1 = await db.document_requests.find_one({"id": r1["request_id"]})
    req2 = await db.document_requests.find_one({"id": r2["request_id"]})
    task1 = await db.tasks.find_one({"id": r1["task_id"]})
    task2 = await db.tasks.find_one({"id": r2["task_id"]})

    R["specific request linked to uploaded document"] = (
        up.status_code == 200 and doc["id"] == r1["id"]
        and doc["request_id"] == r1["request_id"] and doc["task_id"] == r1["task_id"]
        and doc["mtd_period_id"] == q1["id"] and doc["status"] == "Uploaded")
    R["request becomes Uploaded/Received"] = req1["status"] == "Uploaded"
    R["related client task becomes Completed"] = task1["status"] == "COMPLETED"
    R["request retained in history (not deleted)"] = req1 is not None
    R["other request untouched"] = req2["status"] == "Requested" and task2["status"] == "OPEN"

    docs = requests.get(f"{API}/documents", headers=cli,
                        params={"case_id": case["id"]}).json()
    R["uploaded document remains visible"] = any(
        d["id"] == r1["id"] and d["status"] == "Uploaded" for d in docs)
    R["audit/activity entry created"] = await db.activity_logs.count_documents(
        {"case_id": case["id"]}) > acts_before
    R["accountant notified"] = await db.notifications.count_documents(
        {"user_id": acct_user["id"], "case_id": case["id"]}) > notes_before

    # still waiting because request 2 is open
    p_mid = next(p for p in requests.get(f"{API}/mtd/cases/{case['id']}/periods",
                                         headers=acct).json() if p.get("quarter") == 1)
    R["stays waiting while another request is open"] = p_mid["awaiting_documents"] is True

    # close request 2 -> period leaves waiting-for-client
    requests.post(f"{API}/documents/upload", headers=cli,
                  data={"case_id": case["id"], "document_type": r2["document_type"],
                        "mtd_period_id": q1["id"], "document_id": r2["id"]},
                  files={"file": ("uat-check2.pdf", io.BytesIO(b"%PDF-1.4 uat2"),
                                  "application/pdf")})
    p_after = next(p for p in requests.get(f"{API}/mtd/cases/{case['id']}/periods",
                                           headers=acct).json() if p.get("quarter") == 1)
    R["Q1 leaves waiting-for-client with no open request"] = (
        p_after["awaiting_documents"] is False
        and p_after["overdue_waiting_for_client"] is False
        and p_after["next_action_owner"] == "ACCOUNTANT"
        and p_after["stage_label"] != "Overdue — waiting for client")

    others = [p for p in requests.get(f"{API}/mtd/cases/{case['id']}/periods",
                                      headers=acct).json() if p.get("quarter") != 1]
    R["Q2-Q4 + Final Declaration unchanged"] = all(
        p["status"] == "NOT_STARTED" and p["awaiting_documents"] is False for p in others)
    sa = {c["case_ref"]: c["status"] async for c in db.cases.find(
        {"case_ref": {"$in": ["SA-1456", "SA-1428"]}})}
    R["SA unchanged"] = sa == {"SA-1456": "COMPLETED", "SA-1428": "AWAITING_CLIENT"}

    for k, v in R.items():
        print(f"{k}: {'PASS' if v else 'FAIL'}")

    # remove the disposable check records, restore assignment state
    for d in (r1, r2):
        await db.documents.delete_many({"id": d["id"]})
        await db.document_requests.delete_many({"id": d["request_id"]})
        await db.tasks.delete_many({"id": d["task_id"]})
    if not was_assigned:
        await db.cases.update_one({"id": case["id"]},
                                  {"$set": {"assigned_accountant_id": None,
                                            "assigned_accountant_name": None}})
    left = await db.document_requests.count_documents({"title": {"$regex": "^UAT check"}})
    print("disposable requests left:", left)


asyncio.run(main())
