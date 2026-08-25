"""Targeted check on UAT case MTD-2004: unassigned periods are ADMIN-owned."""
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
    admin = login("admin@taxsimba.co.uk", "Admin@123")
    case = await db.cases.find_one({"case_ref": "MTD-2004"})
    R["MTD-2004 still AWAITING_ASSIGNMENT, unassigned"] = (
        case["status"] == "AWAITING_ASSIGNMENT" and not case.get("assigned_accountant_id"))

    periods = requests.get(f"{API}/mtd/cases/{case['id']}/periods", headers=admin).json()
    q1 = next(p for p in periods if p.get("quarter") == 1)
    R["All unassigned periods ADMIN-owned 'Assign an accountant'"] = all(
        p["next_action"] == "Assign an accountant" and p["next_action_owner"] == "ADMIN"
        and p["stage_label"] == "Awaiting assignment" for p in periods)
    R["No ACCOUNTANT-owned action before assignment"] = all(
        p["next_action_owner"] != "ACCOUNTANT" for p in periods)
    R["Deadline/overdue calculation preserved"] = all(
        p["deadline"] and p["days_to_deadline"] is not None for p in periods)

    # after assignment the accountant action derives automatically (then reverted)
    acct = await db.users.find_one({"email": "accountant.a@taxsimba.co.uk"})
    await db.cases.update_one({"id": case["id"]},
                              {"$set": {"assigned_accountant_id": acct["id"],
                                        "assigned_accountant_name": acct["name"]}})
    after = requests.get(f"{API}/mtd/cases/{case['id']}/periods", headers=admin).json()
    q1_after = next(p for p in after if p.get("quarter") == 1)
    R["After assignment action becomes accountant-owned"] = (
        q1_after["next_action_owner"] == "ACCOUNTANT"
        and q1_after["next_action"] == "Accountant to enter the quarterly figures"
        and q1_after["stage_label"] == "Not started")
    await db.cases.update_one({"id": case["id"]},
                              {"$set": {"assigned_accountant_id": None,
                                        "assigned_accountant_name": None}})
    back = requests.get(f"{API}/mtd/cases/{case['id']}/periods", headers=admin).json()
    R["Reverted cleanly to admin-owned"] = all(p["next_action_owner"] == "ADMIN" for p in back)
    _ = q1

    sa = {c["case_ref"]: c["status"] async for c in db.cases.find(
        {"case_ref": {"$in": ["SA-1456", "SA-1428"]}})}
    R["SA-1456 / SA-1428 unchanged"] = sa == {"SA-1456": "COMPLETED",
                                              "SA-1428": "AWAITING_CLIENT"}

    for k, v in R.items():
        print(f"{k}: {'PASS' if v else 'FAIL'}")


asyncio.run(main())
