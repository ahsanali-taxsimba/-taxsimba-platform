"""Targeted check for the central service activation function. Creates and removes its own data."""
import asyncio
import sys
import uuid

sys.path.insert(0, "/app/backend")

from dotenv import load_dotenv  # noqa: E402

load_dotenv("/app/backend/.env")

from auth import hash_password  # noqa: E402
from db import db  # noqa: E402
from phase1b import MTD, SELF_ASSESSMENT, activate_service, bootstrap_client_services  # noqa: E402
from workflow import now_iso  # noqa: E402

EMAILS = [f"chk.{k}@qa-taxsimba.example.com" for k in ("sa", "mtd", "second")]


async def new_account(email):
    user = {"id": str(uuid.uuid4()), "email": email, "name": f"Check {email[4:7]}",
            "role": "CLIENT", "password_hash": hash_password("ChkAccount@12345"),
            "phone": "07000000000", "is_active": True, "created_at": now_iso()}
    await db.users.insert_one(dict(user))
    client = {"id": str(uuid.uuid4()), "user_id": user["id"], "name": user["name"],
              "email": email, "phone": "07000000000", "is_test": True,
              "client_ref": "CHK", "created_at": now_iso()}
    await db.clients.insert_one(dict(client))
    await bootstrap_client_services(client)
    return user, client


async def state(client):
    svcs = {s["service_type"]: s["status"] async for s in
            db.client_services.find({"client_id": client["id"]})}
    cases = [c async for c in db.cases.find({"client_id": client["id"]})]
    periods = await db.mtd_periods.count_documents({"case_id": {"$in": [c["id"] for c in cases]}})
    return svcs, [(c["case_ref"], c["service_type"]) for c in cases], periods


async def cleanup():
    users = [u async for u in db.users.find({"email": {"$in": EMAILS}})]
    uids = [u["id"] for u in users]
    clients = [c async for c in db.clients.find({"user_id": {"$in": uids}})]
    cids = [c["id"] for c in clients]
    cases = [c async for c in db.cases.find({"client_id": {"$in": cids}})]
    case_ids = [c["id"] for c in cases]
    for coll, q in [("mtd_periods", {"case_id": {"$in": case_ids}}),
                    ("activity_log", {"case_id": {"$in": case_ids}}),
                    ("audit_log", {"case_id": {"$in": case_ids}}),
                    ("notifications", {"user_id": {"$in": uids}}),
                    ("client_services", {"client_id": {"$in": cids}}),
                    ("cases", {"client_id": {"$in": cids}}),
                    ("clients", {"user_id": {"$in": uids}}),
                    ("users", {"id": {"$in": uids}})]:
        await db[coll].delete_many(q)


async def main():
    await cleanup()
    results = {}

    # 1. new account owns nothing, then SA only
    u, c = await new_account(EMAILS[0])
    before = await state(c)
    await activate_service(c, u, SELF_ASSESSMENT, "SMART")
    svcs, cases, periods = await state(c)
    results["1 new SA-only client"] = (
        before[0] == {SELF_ASSESSMENT: "NOT_ACTIVE", MTD: "NOT_ACTIVE"} and before[1] == []
        and svcs == {SELF_ASSESSMENT: "ACTIVE", MTD: "NOT_ACTIVE"}
        and len(cases) == 1 and cases[0][1] == SELF_ASSESSMENT and periods == 0)
    print("account 1:", before[0], "->", svcs, cases, "periods", periods)

    # 2. MTD-only without touching SA
    u2, c2 = await new_account(EMAILS[1])
    await activate_service(c2, u2, MTD, "MTD_ESSENTIAL")
    svcs2, cases2, periods2 = await state(c2)
    results["2 new MTD-only client"] = (
        svcs2 == {SELF_ASSESSMENT: "NOT_ACTIVE", MTD: "ACTIVE"}
        and len(cases2) == 1 and cases2[0][1] == MTD and periods2 == 5)
    print("account 2:", svcs2, cases2, "periods", periods2)

    # 3. second service later, same account
    u3, c3 = await new_account(EMAILS[2])
    await activate_service(c3, u3, SELF_ASSESSMENT, "SMART")
    await activate_service(c3, u3, MTD, "MTD_PLUS")
    svcs3, cases3, periods3 = await state(c3)
    users_for_email = await db.users.count_documents({"email": EMAILS[2]})
    clients_for_user = await db.clients.count_documents({"user_id": u3["id"]})
    results["3 second service same account"] = (
        svcs3 == {SELF_ASSESSMENT: "ACTIVE", MTD: "ACTIVE"} and len(cases3) == 2
        and periods3 == 5 and users_for_email == 1 and clients_for_user == 1)
    print("account 3:", svcs3, cases3, "periods", periods3,
          "users", users_for_email, "clients", clients_for_user)

    # 4. idempotency: repeat activation (webhook replay) must not duplicate anything
    for _ in range(2):
        await activate_service(c3, u3, MTD, "MTD_PLUS")
        await activate_service(c2, u2, MTD, "MTD_ESSENTIAL")
    svcs3b, cases3b, periods3b = await state(c3)
    svcs2b, cases2b, periods2b = await state(c2)
    services_rows = await db.client_services.count_documents({"client_id": c3["id"]})
    results["4 no duplicates on replay"] = (
        cases3b == cases3 and periods3b == 5 and services_rows == 2
        and cases2b == cases2 and periods2b == 5)
    print("replay:", cases3b, periods3b, "service rows", services_rows, "|", cases2b, periods2b)

    for k, v in results.items():
        print(f"{k}: {'PASS' if v else 'FAIL'}")
    await cleanup()
    print("cleanup left users:", await db.users.count_documents({"email": {"$in": EMAILS}}))


asyncio.run(main())
