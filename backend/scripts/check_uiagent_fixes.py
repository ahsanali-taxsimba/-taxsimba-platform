"""Targeted retest of the two UI-agent findings on the MTD-2019 fixture (Q2)."""
import asyncio
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
    acct = login("accountant.a@taxsimba.co.uk", "Account@123")
    admin = login("admin@taxsimba.co.uk", "Admin@123")
    cli = login("uat.ui@qa-taxsimba.example.com", "UatAuto@12345")
    case = await db.cases.find_one({"case_ref": "MTD-2019"})
    q2 = await db.mtd_periods.find_one({"case_id": case["id"], "quarter": 2})

    # (b) Action Required must list the specific MTD request and link to /mtd
    req = requests.post(f"{API}/mtd/periods/{q2['id']}/requests", headers=acct,
                        json={"document_type": "Sales records", "note": "Q2 sales",
                              "due_date": "2026-12-01"}).json()
    actions = requests.get(f"{API}/my-actions", headers=cli).json()
    item = next((a for a in actions["outstanding"]
                 if a["action"] == "Quarter 2: Sales records"), None)
    R["Action Required lists the specific MTD request"] = bool(
        item and item["link"] == "/mtd" and item["case_ref"] == "MTD-2019"
        and item["mtd_period_label"] == "Quarter 2" and item["due_date"] == "2026-12-01")

    # (a) net recompute: figures saved with derived net, then an expenses-only edit
    requests.post(f"{API}/mtd/periods/{q2['id']}/figures", headers=acct,
                  json={"income": 10000, "expenses": 3000, "net_profit": 7000})
    first = (await db.mtd_periods.find_one({"id": q2["id"]}))["draft"]["net_profit"]
    # frontend now recomputes on edit; the same payload shape is asserted here
    requests.post(f"{API}/mtd/periods/{q2['id']}/figures", headers=acct,
                  json={"income": 10000, "expenses": 3500, "net_profit": 6500})
    second = (await db.mtd_periods.find_one({"id": q2["id"]}))["draft"]["net_profit"]
    derive = requests.post(f"{API}/mtd/periods/{q2['id']}/figures", headers=acct,
                           json={"income": 10000, "expenses": 4000, "net_profit": None})
    third = (await db.mtd_periods.find_one({"id": q2["id"]}))["draft"]["net_profit"]
    R["Net follows income - expenses on edit"] = (first == 7000 and second == 6500
                                                  and derive.status_code == 200
                                                  and third == 6000)

    # leave the fixture tidy: clear the Q2 draft and the disposable request
    await db.mtd_periods.update_one({"id": q2["id"]},
                                    {"$set": {"draft": None, "status": "NOT_STARTED"}})
    await db.documents.delete_many({"id": req["id"]})
    await db.document_requests.delete_many({"id": req["request_id"]})
    await db.tasks.delete_many({"id": req["task_id"]})

    for k, v in R.items():
        print(f"{k}: {'PASS' if v else 'FAIL'}")
    mtd2004 = await db.cases.find_one({"case_ref": "MTD-2004"})
    print("MTD-2004:", mtd2004["status"], mtd2004.get("assigned_accountant_name"),
          await db.mtd_periods.count_documents({"case_id": mtd2004["id"]}), "periods")
    _ = admin


asyncio.run(main())
