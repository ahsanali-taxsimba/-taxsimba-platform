"""Targeted checks for pricing, additional-work charging and mid-year MTD onboarding."""
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
EMAIL = "chk.polish@qa-taxsimba.example.com"
EMAIL2 = "chk.polish2@qa-taxsimba.example.com"
PW = "ChkPolish@12345"
R = {}


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def cleanup():
    users = [u async for u in db.users.find({"email": {"$in": [EMAIL, EMAIL2]}})]
    uids = [u["id"] for u in users]
    clients = [c async for c in db.clients.find({"user_id": {"$in": uids}})]
    cids = [c["id"] for c in clients]
    cases = [c async for c in db.cases.find({"client_id": {"$in": cids}})]
    ids = [c["id"] for c in cases]
    for coll, q in [("mtd_periods", {"case_id": {"$in": ids}}),
                    ("documents", {"case_id": {"$in": ids}}),
                    ("document_requests", {"case_id": {"$in": ids}}),
                    ("tasks", {"case_id": {"$in": ids}}),
                    ("recommendations", {"case_id": {"$in": ids}}),
                    ("activity_log", {"case_id": {"$in": ids}}),
                    ("audit_log", {"case_id": {"$in": ids}}),
                    ("notifications", {"user_id": {"$in": uids}}),
                    ("payment_transactions", {"client_id": {"$in": cids}}),
                    ("invoices", {"client_id": {"$in": cids}}),
                    ("client_services", {"client_id": {"$in": cids}}),
                    ("cases", {"client_id": {"$in": cids}}),
                    ("clients", {"user_id": {"$in": uids}}),
                    ("users", {"id": {"$in": uids}})]:
        await db[coll].delete_many(q)


async def main():
    await cleanup()
    admin = login("admin@taxsimba.co.uk", "Admin@123")
    sup = login("superadmin@taxsimba.co.uk", "Super@123")
    acct = login("accountant.a@taxsimba.co.uk", "Account@123")

    # client with MTD active
    cu = {"id": str(uuid.uuid4()), "email": EMAIL, "name": "Chk Polish", "role": "CLIENT",
          "password_hash": hash_password(PW), "is_active": True, "created_at": now_iso()}
    await db.users.insert_one(dict(cu))
    client = {"id": str(uuid.uuid4()), "user_id": cu["id"], "name": "Chk Polish", "email": EMAIL,
              "is_test": True, "client_ref": "CHK", "created_at": now_iso()}
    await db.clients.insert_one(dict(client))
    await bootstrap_client_services(client)
    case = (await activate_service(client, cu, MTD, "MTD_ESSENTIAL"))["case"]
    cli = login(EMAIL, PW)
    acct_user = await db.users.find_one({"email": "accountant.a@taxsimba.co.uk"})
    await db.cases.update_one({"id": case["id"]},
                              {"$set": {"assigned_accountant_id": acct_user["id"],
                                        "assigned_accountant_name": acct_user["name"]}})

    # --- Part A wording
    periods = requests.get(f"{API}/mtd/cases/{case['id']}/periods", headers=cli).json()
    q1 = next(p for p in periods if p.get("quarter") == 1)
    final = next(p for p in periods if p["kind"] == "FINAL_DECLARATION")
    R["MTD wording + AWAITING_ASSIGNMENT not Preparing"] = all(
        p["stage_label"] == "Preparing" for p in periods)  # accountant assigned -> Preparing
    unassigned = await db.cases.find_one({"id": case["id"]})
    await db.cases.update_one({"id": case["id"]}, {"$set": {"assigned_accountant_id": None}})
    p_un = requests.get(f"{API}/mtd/cases/{case['id']}/periods", headers=cli).json()
    R["Unassigned shows Getting started"] = all(p["stage_label"] == "Getting started"
                                                for p in p_un)
    await db.cases.update_one({"id": case["id"]},
                              {"$set": {"assigned_accountant_id": unassigned[
                                  "assigned_accountant_id"]}})
    ys = requests.get(f"{API}/mtd/cases/{case['id']}/year-summary", headers=cli).json()
    R["Year summary empty message"] = ys.get("empty_message") == "No quarterly figures published yet."
    R["Final Declaration not a quarter"] = final["kind"] == "FINAL_DECLARATION" and \
        final.get("quarter") in (None, 0)
    R["Case reference backend generated + unique"] = case["case_ref"].startswith("MTD-") and \
        await db.cases.count_documents({"case_ref": case["case_ref"]}) == 1

    # document request -> Action required wording
    requests.post(f"{API}/mtd/periods/{q1['id']}/requests", headers=acct,
                  json={"document_type": "Q1 records"})
    q1b = next(p for p in requests.get(f"{API}/mtd/cases/{case['id']}/periods",
                                       headers=cli).json() if p.get("quarter") == 1)
    R["Open request shows Action required"] = q1b["stage_label"] == "Action required"

    # --- Part B pricing
    pkg = await db.packages.find_one({"service_type": MTD, "code": "MTD_ESSENTIAL"})
    svc_before = requests.get(f"{API}/my-services", headers=cli).json()["services"]
    agreed_before = next(s for s in svc_before if s["service_type"] == MTD)["agreed_price"]
    new_price = round(float(pkg["price"]) + 60, 2)
    up = requests.patch(f"{API}/packages/{pkg['id']}", headers=sup,
                        json={"price": new_price, "billing_type": "MONTHLY",
                              "vat_treatment": "VAT_INCLUSIVE", "effective_from": "2026-07-01"})
    denied = requests.patch(f"{API}/packages/{pkg['id']}", headers=admin,
                           json={"price": 999.0})
    R["Super Admin can change master price"] = up.status_code == 200 and \
        up.json()["price"] == new_price and denied.status_code == 403
    hist = requests.get(f"{API}/packages/{pkg['id']}/price-history", headers=sup).json()
    R["Price change audited"] = any(h["new_price"] == new_price and h.get("effective_from")
                                    for h in hist)
    svc_after = requests.get(f"{API}/my-services", headers=cli).json()["services"]
    row = next(s for s in svc_after if s["service_type"] == MTD)
    R["Existing agreed price unchanged"] = row["agreed_price"] == agreed_before and \
        row["current_master_price"] == new_price

    # new purchase gets current price
    u2 = {"id": str(uuid.uuid4()), "email": EMAIL2, "name": "Chk Polish 2", "role": "CLIENT",
          "password_hash": hash_password(PW), "is_active": True, "created_at": now_iso()}
    c2 = {"id": str(uuid.uuid4()), "user_id": u2["id"], "name": "Chk Polish 2", "email": EMAIL2,
          "is_test": True, "client_ref": "CHK", "created_at": now_iso()}
    await db.users.insert_one(dict(u2))
    await db.clients.insert_one(dict(c2))
    await bootstrap_client_services(c2)
    await activate_service(c2, u2, MTD, "MTD_ESSENTIAL")
    new_row = await db.client_services.find_one({"client_id": c2["id"], "service_type": MTD})
    R["New purchase gets current price"] = new_row["agreed_price"] == new_price
    await db.packages.update_one({"id": pkg["id"]},
                                 {"$set": {"price": pkg["price"],
                                           "billing_type": pkg.get("billing_type", "ONE_OFF")}})

    # --- Part C additional work
    rec = requests.post(f"{API}/cases/{case['id']}/recommend-additional-work", headers=acct,
                        json={"reason": "Prior-quarter reconciliation", "suggested_amount": 150.0})
    acct_charge = requests.post(f"{API}/payment-requests", headers=acct,
                                json={"case_id": case["id"], "description": "x", "amount": 100})
    R["Accountant proposes but cannot charge"] = rec.status_code == 200 and \
        acct_charge.status_code == 403
    client_sees_rec = requests.get(f"{API}/payment-requests", headers=cli).json()
    R["Client sees no unapproved charge"] = len(client_sees_rec) == 0
    sent = requests.post(f"{API}/payment-requests", headers=admin,
                         json={"case_id": case["id"],
                               "description": "Prior-quarter reconciliation",
                               "amount": 180.0, "vat_rate": 20.0,
                               "mtd_period_id": q1["id"],
                               "recommendation_id": rec.json()["id"]})
    sj = sent.json()
    R["Admin approves and sends charge"] = sent.status_code == 200 and \
        sj["request_status"] == "SENT" and sj["mtd_period_id"] == q1["id"] and \
        sj["vat_amount"] == 30.0 and sj["approved_amount"] == 180.0
    client_list = requests.get(f"{API}/payment-requests", headers=cli).json()
    R["Client sees approved charge only"] = len(client_list) == 1 and \
        client_list[0]["request_status"] == "SENT" and "internal_note" not in client_list[0]

    # payment confirmed once only (simulate paid session through _fulfil twice)
    from phase1b import _fulfil
    tx = await db.payment_transactions.find_one({"id": sj["id"]})
    await db.payment_transactions.update_one({"id": tx["id"]},
                                             {"$set": {"session_id": f"sim_{uuid.uuid4().hex[:8]}",
                                                       "payment_status": "paid",
                                                       "status": "complete"}})
    tx = await db.payment_transactions.find_one({"id": tx["id"]})
    for _ in range(3):
        await _fulfil(dict(tx))
        tx = await db.payment_transactions.find_one({"id": tx["id"]})
    paid = await db.payment_transactions.find_one({"id": sj["id"]})
    receipts = await db.invoices.count_documents({"payment_request_id": sj["id"]})
    R["Payment recorded once only"] = paid["request_status"] == "PAID" and \
        paid["fulfilled"] is True and receipts == 1

    # --- Part D mid-year onboarding
    prior = requests.post(f"{API}/mtd/periods/{q1['id']}/record-prior-submission", headers=admin,
                          json={"previous_provider": "Xero", "submission_date": "2026-08-01",
                                "submission_reference": "XERO-Q1-99",
                                "income": 12000, "expenses": 4000})
    acct_prior = requests.post(f"{API}/mtd/periods/{final['id']}/record-prior-submission",
                               headers=acct, json={"previous_provider": "X",
                                                   "submission_date": "2026-08-01"})
    row_q1 = await db.mtd_periods.find_one({"id": q1["id"]})
    client_q1 = next(p for p in requests.get(f"{API}/mtd/cases/{case['id']}/periods",
                                             headers=cli).json() if p.get("quarter") == 1)
    ys2 = requests.get(f"{API}/mtd/cases/{case['id']}/year-summary", headers=cli).json()
    R["Prior submission recorded as historical"] = prior.status_code == 200 and \
        row_q1["prior_to_taxsimba"] is True and row_q1["submitted_by_taxsimba"] is False and \
        row_q1["submitted_by_name"] is None and \
        client_q1["stage_label"] == "Submitted before joining TaxSimba" and \
        ys2["totals"]["income"] == 12000 and acct_prior.status_code == 403

    # --- SA untouched
    sa_case = await db.cases.find_one({"case_ref": "SA-1456"})
    sa_view = requests.get(f"{API}/cases/{sa_case['id']}", headers=admin).json()
    R["SA workflow unchanged"] = sa_view["status"] == "COMPLETED" and \
        sa_view.get("has_submission_record") is True

    for k, v in R.items():
        print(f"{k}: {'PASS' if v else 'FAIL'}")
    await cleanup()
    print("cleanup left users:", await db.users.count_documents(
        {"email": {"$in": [EMAIL, EMAIL2]}}))


asyncio.run(main())
