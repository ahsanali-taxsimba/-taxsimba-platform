"""Targeted check: client dashboard greeting name comes from backend profile data."""
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
    cli = login("uat.mtd@taxsimba-uat.example.com", "UatMtd@12345")
    prof = requests.get(f"{API}/my-profile", headers=cli).json()
    db_client = await db.clients.find_one({"email": "uat.mtd@taxsimba-uat.example.com"})
    R["MTD client name served from backend profile"] = prof["name"] == db_client["name"]
    R["No sensitive data in greeting source"] = "utr" not in prof or prof.get("utr") is None

    # profile rename is reflected by the same endpoint, then reverted
    original = prof["name"]
    requests.patch(f"{API}/my-profile", headers=cli, json={"name": "Ahsan Ali"})
    renamed = requests.get(f"{API}/my-profile", headers=cli).json()["name"]
    me = requests.get(f"{API}/auth/me", headers=cli).json()["name"]
    R["Profile rename reflected"] = renamed == "Ahsan Ali" and me == "Ahsan Ali"
    requests.patch(f"{API}/my-profile", headers=cli, json={"name": original})
    R["Reverted"] = requests.get(f"{API}/my-profile", headers=cli).json()["name"] == original

    sa = login("clienta@example.com", "Client@123")
    sa_prof = requests.get(f"{API}/my-profile", headers=sa).json()
    sa_client = await db.clients.find_one({"email": "clienta@example.com"})
    R["SA client name unchanged"] = sa_prof["name"] == sa_client["name"]

    case = await db.cases.find_one({"case_ref": "MTD-2004"})
    R["No workflow change"] = case["status"] == "AWAITING_ASSIGNMENT" and \
        not case.get("assigned_accountant_id")

    for k, v in R.items():
        print(f"{k}: {'PASS' if v else 'FAIL'}")


asyncio.run(main())
