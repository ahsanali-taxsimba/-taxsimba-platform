"""Parity check: request -> upload -> completion is identical for Q2, Q4 and Final Declaration."""
import asyncio
import io
import sys

sys.path.insert(0, "/app/backend")

from dotenv import load_dotenv  # noqa: E402

load_dotenv("/app/backend/.env")

import requests  # noqa: E402

from db import db  # noqa: E402

API = "https://taxsimba-foundation.preview.emergentagent.com/api"


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def main():
    acct = login("accountant.a@taxsimba.co.uk", "Account@123")
    cli = login("uat.mtd@taxsimba-uat.example.com", "UatMtd@12345")
    case = await db.cases.find_one({"case_ref": "MTD-2004"})
    acct_user = await db.users.find_one({"email": "accountant.a@taxsimba.co.uk"})
    was = case.get("assigned_accountant_id")
    await db.cases.update_one({"id": case["id"]},
                              {"$set": {"assigned_accountant_id": acct_user["id"],
                                        "assigned_accountant_name": acct_user["name"]}})

    targets = []
    for q in (2, 4):
        targets.append(await db.mtd_periods.find_one({"case_id": case["id"], "quarter": q}))
    targets.append(await db.mtd_periods.find_one({"case_id": case["id"],
                                                  "kind": "FINAL_DECLARATION"}))

    ok = True
    for p in targets:
        acts_before = await db.activity_logs.count_documents({"case_id": case["id"]})
        note_before_row = await db.notifications.find_one(
            {"user_id": acct_user["id"], "case_id": case["id"],
             "title": "Client upload received"})
        stamp_before = (note_before_row or {}).get("created_at")
        req = requests.post(f"{API}/mtd/periods/{p['id']}/requests", headers=acct,
                            json={"document_type": f"UAT parity {p['label']}"}).json()
        waiting = next(x for x in requests.get(f"{API}/mtd/cases/{case['id']}/periods",
                                               headers=acct).json() if x["id"] == p["id"])
        up = requests.post(f"{API}/documents/upload", headers=cli,
                           data={"case_id": case["id"], "document_type": req["document_type"],
                                 "mtd_period_id": p["id"], "document_id": req["id"]},
                           files={"file": ("parity.pdf", io.BytesIO(b"%PDF-1.4 parity"),
                                            "application/pdf")}).json()
        rrow = await db.document_requests.find_one({"id": req["request_id"]})
        trow = await db.tasks.find_one({"id": req["task_id"]})
        after = next(x for x in requests.get(f"{API}/mtd/cases/{case['id']}/periods",
                                             headers=acct).json() if x["id"] == p["id"])
        checks = {
            "waiting_before": waiting["awaiting_documents"] is True,
            "req_link": up.get("request_id") == req["request_id"],
            "task_link": up.get("task_id") == req["task_id"],
            "period_link": up.get("mtd_period_id") == p["id"],
            "doc_uploaded": up.get("status") == "Uploaded",
            "req_status": rrow["status"] == "Uploaded",
            "task_done": trow["status"] == "COMPLETED",
            "not_waiting_after": after["awaiting_documents"] is False,
            "not_overdue_wait": after["overdue_waiting_for_client"] is False,
            "owner_accountant": after["next_action_owner"] == "ACCOUNTANT",
            "activity": await db.activity_logs.count_documents(
                {"case_id": case["id"]}) > acts_before,
            "notified": bool(await db.notifications.find_one(
                {"user_id": acct_user["id"], "case_id": case["id"],
                 "title": "Client upload received",
                 "created_at": {"$gt": stamp_before}} if stamp_before else
                {"user_id": acct_user["id"], "case_id": case["id"],
                 "title": "Client upload received"})),
        }
        passed = all(checks.values())
        ok = ok and passed
        print(f"{p['label']} ({p['kind']}): {'PASS' if passed else 'FAIL'}",
              {k: v for k, v in checks.items() if not v})
        await db.documents.delete_many({"id": req["id"]})
        await db.document_requests.delete_many({"id": req["request_id"]})
        await db.tasks.delete_many({"id": req["task_id"]})

    if not was:
        await db.cases.update_one({"id": case["id"]},
                                  {"$set": {"assigned_accountant_id": None,
                                            "assigned_accountant_name": None}})
    print("ALL PERIODS IDENTICAL:", "PASS" if ok else "FAIL")
    print("parity leftovers:",
          await db.document_requests.count_documents({"title": {"$regex": "^UAT parity"}}))


asyncio.run(main())
