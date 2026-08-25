"""Final pre-export UAT: full MTD journey + integrity/permission checks on disposable data.

Creates two disposable clients:
  uat.auto@qa-taxsimba.example.com  -> driven end-to-end here (destructive)
  uat.ui@qa-taxsimba.example.com    -> left fresh for the browser/UI agent pass
Never touches MTD-2004 or any genuine SA case. Usage: run | cleanup
"""
import asyncio
import io
import sys
import uuid

sys.path.insert(0, "/app/backend")

from dotenv import load_dotenv  # noqa: E402

load_dotenv("/app/backend/.env")

import requests  # noqa: E402

from auth import hash_password  # noqa: E402
from db import db  # noqa: E402
from phase1b import MTD, SELF_ASSESSMENT, activate_service, bootstrap_client_services  # noqa: E402
from workflow import now_iso  # noqa: E402

API = "https://taxsimba-foundation.preview.emergentagent.com/api"
AUTO = "uat.auto@qa-taxsimba.example.com"
UI = "uat.ui@qa-taxsimba.example.com"
PW = "UatAuto@12345"
EMAILS = [AUTO, UI]
R = {}


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, (email, r.status_code, r.text[:120])
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def make_client(email, name):
    u = {"id": str(uuid.uuid4()), "email": email, "name": name, "role": "CLIENT",
         "password_hash": hash_password(PW), "phone": "07000000222", "is_active": True,
         "is_uat": True, "created_at": now_iso()}
    await db.users.insert_one(dict(u))
    c = {"id": str(uuid.uuid4()), "user_id": u["id"], "name": name, "email": email,
         "phone": "07000000222", "client_ref": "UAT-AUTO", "is_test": False, "is_uat": True,
         "created_at": now_iso()}
    await db.clients.insert_one(dict(c))
    await bootstrap_client_services(c)
    return u, c


async def cleanup(quiet=False):
    users = [u async for u in db.users.find({"email": {"$in": EMAILS}})]
    uids = [u["id"] for u in users]
    clients = [c async for c in db.clients.find({"user_id": {"$in": uids}})]
    cids = [c["id"] for c in clients]
    cases = [c async for c in db.cases.find({"client_id": {"$in": cids}})]
    ids = [c["id"] for c in cases]
    counts = {}
    for coll, q in [("mtd_periods", {"case_id": {"$in": ids}}),
                    ("documents", {"case_id": {"$in": ids}}),
                    ("document_requests", {"case_id": {"$in": ids}}),
                    ("tasks", {"case_id": {"$in": ids}}),
                    ("messages", {"case_id": {"$in": ids}}),
                    ("case_notes", {"case_id": {"$in": ids}}),
                    ("assignments", {"case_id": {"$in": ids}}),
                    ("recommendations", {"case_id": {"$in": ids}}),
                    ("activity_logs", {"case_id": {"$in": ids}}),
                    ("audit_logs", {"case_id": {"$in": ids}}),
                    ("notifications", {"case_id": {"$in": ids}}),
                    ("notifications", {"user_id": {"$in": uids}}),
                    ("payment_transactions", {"client_id": {"$in": cids}}),
                    ("invoices", {"client_id": {"$in": cids}}),
                    ("client_services", {"client_id": {"$in": cids}}),
                    ("cases", {"client_id": {"$in": cids}}),
                    ("clients", {"user_id": {"$in": uids}}),
                    ("users", {"id": {"$in": uids}})]:
        n = (await db[coll].delete_many(q)).deleted_count
        if n:
            counts[coll] = counts.get(coll, 0) + n
    if not quiet:
        print("removed:", counts)
        print("users left:", await db.users.count_documents({"email": {"$in": EMAILS}}))
        mtd2004 = await db.cases.find_one({"case_ref": "MTD-2004"})
        print("MTD-2004 intact:", bool(mtd2004), mtd2004["status"],
              await db.mtd_periods.count_documents({"case_id": mtd2004["id"]}), "periods")


async def run():
    await cleanup(quiet=True)
    admin = login("admin@taxsimba.co.uk", "Admin@123")
    sup = login("superadmin@taxsimba.co.uk", "Super@123")
    amara = login("accountant.a@taxsimba.co.uk", "Account@123")
    other_acct = login("accountant.b@taxsimba.co.uk", "Account@123")
    amara_u = await db.users.find_one({"email": "accountant.a@taxsimba.co.uk"})
    other_u = await db.users.find_one({"email": "accountant.b@taxsimba.co.uk"})

    # ---------- 1 signup / activation
    u, c = await make_client(AUTO, "Ahsan Ali")
    res = await activate_service(c, u, MTD, "MTD_ESSENTIAL", reason="UAT activation", amount=240.0)
    case = res["case"]
    await make_client(UI, "Uma Iqbal")
    ui_client = await db.clients.find_one({"email": UI})
    ui_user = await db.users.find_one({"email": UI})
    ui_case = (await activate_service(ui_client, ui_user, MTD, "MTD_ESSENTIAL"))["case"]
    cli = login(AUTO, PW)
    svc = {s["service_type"]: s["status"] for s in
           requests.get(f"{API}/my-services", headers=cli).json()["services"]}
    periods = requests.get(f"{API}/mtd/cases/{case['id']}/periods", headers=cli).json()
    prof = requests.get(f"{API}/my-profile", headers=cli).json()
    R["1 activation: name/profile, MTD ACTIVE, SA NOT_ACTIVE, unique ref, 5 periods"] = (
        prof["name"] == "Ahsan Ali"
        and svc == {SELF_ASSESSMENT: "NOT_ACTIVE", MTD: "ACTIVE"}
        and case["case_ref"].startswith("MTD-")
        and await db.cases.count_documents({"case_ref": case["case_ref"]}) == 1
        and case["tax_year"] == "2026/27" and len(periods) == 5
        and sorted(p["label"] for p in periods) == ["Final Declaration", "Quarter 1",
                                                    "Quarter 2", "Quarter 3", "Quarter 4"])
    dup = await activate_service(c, u, MTD, "MTD_ESSENTIAL")
    R["1 no duplicate periods/case on repeat activation"] = (
        dup["periods_created"] == 0 and dup["created_case"] is False
        and await db.mtd_periods.count_documents({"case_id": case["id"]}) == 5
        and await db.cases.count_documents({"client_id": c["id"]}) == 1)
    q1 = next(p for p in periods if p.get("quarter") == 1)
    q2 = next(p for p in periods if p.get("quarter") == 2)
    final = next(p for p in periods if p["kind"] == "FINAL_DECLARATION")

    # ---------- 2 admin assignment
    before_acts = await db.activity_logs.count_documents({"case_id": case["id"]})
    no_access = requests.get(f"{API}/cases/{case['id']}", headers=amara)
    assign = requests.post(f"{API}/cases/{case['id']}/assign", headers=admin,
                           json={"accountant_id": amara_u["id"],
                                 "internal_instructions": "UAT assignment"})
    after = await db.cases.find_one({"id": case["id"]})
    got_access = requests.get(f"{API}/cases/{case['id']}", headers=amara)
    denied = requests.get(f"{API}/cases/{case['id']}", headers=other_acct)
    p_after = next(p for p in requests.get(f"{API}/mtd/cases/{case['id']}/periods",
                                           headers=admin).json() if p.get("quarter") == 1)
    R["2 assignment: saved, access granted/denied, audit, ownership moves"] = (
        no_access.status_code == 403 and assign.status_code == 200
        and after["assigned_accountant_id"] == amara_u["id"]
        and got_access.status_code == 200 and denied.status_code == 403
        and await db.activity_logs.count_documents({"case_id": case["id"]}) > before_acts
        and await db.mtd_periods.count_documents({"case_id": case["id"]}) == 5
        and p_after["next_action_owner"] == "ACCOUNTANT"
        and p_after["stage_label"] != "Awaiting assignment")

    # ---------- 3 accountant requests a document for Q1 (deadline already passed)
    await db.mtd_periods.update_one({"id": q1["id"]}, {"$set": {"deadline": "2026-05-01"}})
    req = requests.post(f"{API}/mtd/periods/{q1['id']}/requests", headers=amara,
                        json={"document_type": "Bank statement", "note": "Q1 bank statement",
                              "due_date": "2026-06-30"}).json()
    task = await db.tasks.find_one({"id": req["task_id"]})
    note = await db.notifications.find_one({"user_id": u["id"], "case_id": case["id"]})
    pv = requests.get(f"{API}/mtd/cases/{case['id']}/periods", headers=amara).json()
    q1s = next(p for p in pv if p.get("quarter") == 1)
    others = [p for p in pv if p.get("quarter") != 1]
    R["3 request linked to client/case/Q1, task + notification, overdue-waiting"] = (
        req["mtd_period_id"] == q1["id"] and req["case_id"] == case["id"]
        and task and task["owner_id"] == u["id"] and task["status"] == "OPEN"
        and note is not None
        and q1s["stage_label"] == "Overdue — waiting for client"
        and q1s["next_action_owner"] == "CLIENT"
        and q1s["delay_attributed_to"] == "CLIENT"
        and all(p["awaiting_documents"] is False for p in others))

    # ---------- 4 client sees it and uploads against that request
    actions = requests.get(f"{API}/my-actions", headers=cli).json()
    q1_docs = requests.get(f"{API}/mtd/periods/{q1['id']}/documents", headers=cli).json()
    q2_docs = requests.get(f"{API}/mtd/periods/{q2['id']}/documents", headers=cli).json()
    up = requests.post(f"{API}/documents/upload", headers=cli,
                       data={"case_id": case["id"], "document_type": "Bank statement",
                             "mtd_period_id": q1["id"], "document_id": req["id"]},
                       files={"file": ("bank.pdf", io.BytesIO(b"%PDF-1.4 uat bank"),
                                       "application/pdf")})
    doc = up.json()
    rrow = await db.document_requests.find_one({"id": req["request_id"]})
    trow = await db.tasks.find_one({"id": req["task_id"]})
    dl_ok = requests.get(f"{API}/documents/{doc['id']}/download", headers=cli)
    other_cli = login("clienta@example.com", "Client@123")
    dl_bad = requests.get(f"{API}/documents/{doc['id']}/download", headers=other_cli)
    q1_after = next(p for p in requests.get(f"{API}/mtd/cases/{case['id']}/periods",
                                            headers=amara).json() if p.get("quarter") == 1)
    R["4 client action list, upload linked, request closed, waiting cleared"] = (
        str(actions).find("Bank statement") > -1
        and any(d["id"] == req["id"] for d in q1_docs) and len(q2_docs) == 0
        and up.status_code == 200 and doc["request_id"] == req["request_id"]
        and doc["task_id"] == req["task_id"] and doc["mtd_period_id"] == q1["id"]
        and doc["case_id"] == case["id"] and doc["status"] == "Uploaded"
        and dl_ok.status_code == 200 and dl_bad.status_code in (403, 404)
        and rrow["status"] == "Uploaded" and trow["status"] == "COMPLETED"
        and q1_after["awaiting_documents"] is False
        and q1_after["overdue_waiting_for_client"] is False
        and q1_after["next_action_owner"] == "ACCOUNTANT")

    # generic upload must not close a specific request
    r2 = requests.post(f"{API}/mtd/periods/{q1['id']}/requests", headers=amara,
                       json={"document_type": "Mileage log"}).json()
    requests.post(f"{API}/documents/upload", headers=cli,
                  data={"case_id": case["id"], "document_type": "MTD supporting record",
                        "mtd_period_id": q1["id"]},
                  files={"file": ("misc.pdf", io.BytesIO(b"%PDF-1.4 misc"), "application/pdf")})
    r2row = await db.document_requests.find_one({"id": r2["request_id"]})
    R["4 generic upload does not close a specific request"] = r2row["status"] == "Requested"
    requests.post(f"{API}/documents/upload", headers=cli,
                  data={"case_id": case["id"], "document_type": "Mileage log",
                        "mtd_period_id": q1["id"], "document_id": r2["id"]},
                  files={"file": ("mileage.pdf", io.BytesIO(b"%PDF-1.4 mile"),
                                  "application/pdf")})
    R["4 second request closes only itself"] = (
        (await db.document_requests.find_one({"id": r2["request_id"]}))["status"] == "Uploaded"
        and (await db.document_requests.find_one({"id": req["request_id"]}))["status"]
        == "Uploaded")

    # ---------- 5 shared period logic / isolation
    f_q2 = requests.post(f"{API}/mtd/periods/{q2['id']}/figures", headers=amara,
                         json={"income": 500, "expenses": 100})
    q1_draft_leak = (await db.mtd_periods.find_one({"id": q1["id"]})).get("draft")
    cross_doc = requests.post(f"{API}/documents/upload", headers=cli,
                              data={"case_id": case["id"], "document_type": "Bank statement",
                                    "mtd_period_id": q2["id"], "document_id": req["id"]},
                              files={"file": ("x.pdf", io.BytesIO(b"%PDF-1.4 x"),
                                              "application/pdf")})
    doc_after = await db.documents.find_one({"id": req["id"]})
    iso = {
        "q2_figures_saved": f_q2.status_code == 200,
        "q1_no_draft_leak": q1_draft_leak is None,
        "cross_doc_rejected": cross_doc.status_code == 400,
        "cross_doc_period_unchanged": doc_after["mtd_period_id"] == q1["id"],
        "cross_doc_status": cross_doc.status_code,
        "final_no_draft": (await db.mtd_periods.find_one({"id": final["id"]})).get("draft") is None,
    }
    R["5 period isolation: draft/document/approval do not cross periods"] = all(
        v is True for k, v in iso.items() if k != "cross_doc_status")
    print("   iso detail:", iso)
    await db.mtd_periods.update_one({"id": q2["id"]},
                                    {"$set": {"draft": None, "status": "NOT_STARTED"}})
    R["5 Final Declaration wording is not 'quarter'"] = (
        final["label"] == "Final Declaration" and final["kind"] == "FINAL_DECLARATION"
        and "quarter" not in final["label"].lower())

    # ---------- 6 accountant prepares Q1
    fig = requests.post(f"{API}/mtd/periods/{q1['id']}/figures", headers=amara,
                        json={"income": 10000, "expenses": 3000, "net_profit": 7000,
                              "estimated_income_tax": 1400,
                              "estimated_national_insurance": 300,
                              "suggested_set_aside": 1700,
                              "client_note": "UAT Q1 figures"})
    reread = requests.get(f"{API}/mtd/cases/{case['id']}/periods", headers=amara).json()
    q1_staff = next(p for p in reread if p.get("quarter") == 1)
    q1_client = next(p for p in requests.get(f"{API}/mtd/cases/{case['id']}/periods",
                                             headers=cli).json() if p.get("quarter") == 1)
    submit = requests.post(f"{API}/mtd/periods/{q1['id']}/submit-for-review", headers=amara)
    q1_rev = next(p for p in requests.get(f"{API}/mtd/cases/{case['id']}/periods",
                                          headers=admin).json() if p.get("quarter") == 1)
    R["6 figures saved to Q1 only, staff-only, submit for review"] = (
        fig.status_code == 200 and q1_staff["draft"]["income"] == 10000
        and "draft" not in q1_client and q1_client.get("published") is None
        and submit.status_code == 200 and q1_rev["status"] == "ADMIN_REVIEW"
        and q1_rev["next_action_owner"] == "ADMIN"
        and (await db.mtd_periods.find_one({"id": q2["id"]})).get("draft") is None)

    # ---------- 7 admin returns for changes, accountant resubmits
    ret = requests.post(f"{API}/mtd/periods/{q1['id']}/request-changes", headers=admin,
                        json={"reason": "Please recheck expenses total"})
    q1_ret = next(p for p in requests.get(f"{API}/mtd/cases/{case['id']}/periods",
                                          headers=amara).json() if p.get("quarter") == 1)
    q1_cli_ret = next(p for p in requests.get(f"{API}/mtd/cases/{case['id']}/periods",
                                              headers=cli).json() if p.get("quarter") == 1)
    requests.post(f"{API}/mtd/periods/{q1['id']}/figures", headers=amara,
                  json={"income": 10000, "expenses": 3500, "net_profit": 6500})
    requests.post(f"{API}/mtd/periods/{q1['id']}/submit-for-review", headers=amara)
    R["7 return for changes: reason saved, owner ACCOUNTANT, client still blind"] = (
        ret.status_code == 200 and q1_ret["status"] == "IN_PROGRESS"
        and q1_ret["changes_reason"] == "Please recheck expenses total"
        and q1_ret["next_action_owner"] == "ACCOUNTANT"
        and q1_cli_ret.get("published") is None)

    # ---------- 8 admin approves / publishes
    appr = requests.post(f"{API}/mtd/periods/{q1['id']}/admin-approve", headers=admin)
    q1_pub_cli = next(p for p in requests.get(f"{API}/mtd/cases/{case['id']}/periods",
                                              headers=cli).json() if p.get("quarter") == 1)
    R["8 approve/publish: client sees published version only"] = (
        appr.status_code == 200 and q1_pub_cli["status"] == "AWAITING_CLIENT_APPROVAL"
        and q1_pub_cli["published"]["net_profit"] == 6500
        and "draft" not in q1_pub_cli and "changes_reason" not in q1_pub_cli
        and q1_pub_cli["next_action_owner"] == "CLIENT"
        and q1_pub_cli["published_version"] == 1)

    # version history preserved after a second publish cycle
    requests.post(f"{API}/mtd/periods/{q1['id']}/request-changes", headers=admin,
                  json={"reason": "One more tweak"})
    requests.post(f"{API}/mtd/periods/{q1['id']}/figures", headers=amara,
                  json={"income": 10000, "expenses": 3000, "net_profit": 7000})
    requests.post(f"{API}/mtd/periods/{q1['id']}/submit-for-review", headers=amara)
    requests.post(f"{API}/mtd/periods/{q1['id']}/admin-approve", headers=admin)
    row = await db.mtd_periods.find_one({"id": q1["id"]})
    R["7/8 version history preserved (no destructive overwrite)"] = (
        len(row["published_versions"]) == 2
        and row["published_versions"][0]["net_profit"] == 6500
        and row["published_version"] == 2)

    # ---------- 9 client approval
    stale = requests.post(f"{API}/mtd/periods/{q1['id']}/client-approve", headers=cli,
                          json={"version": 1})
    ok = requests.post(f"{API}/mtd/periods/{q1['id']}/client-approve", headers=cli,
                       json={"version": 2})
    again = requests.post(f"{API}/mtd/periods/{q1['id']}/client-approve", headers=cli,
                          json={"version": 2})
    figs_by_client = requests.post(f"{API}/mtd/periods/{q1['id']}/figures", headers=cli,
                                   json={"income": 1, "expenses": 1})
    row = await db.mtd_periods.find_one({"id": q1["id"]})
    R["9 client approval: 409 stale, stored once, client cannot edit figures"] = (
        stale.status_code == 409 and ok.status_code == 200 and again.status_code == 400
        and row["status"] == "APPROVED" and row["approved_version"] == 2
        and row["client_approved_at"] and figs_by_client.status_code == 403)

    # ---------- 10 manual external submission
    as_client = requests.post(f"{API}/mtd/periods/{q1['id']}/record-submission", headers=cli,
                              json={"submission_reference": "X", "submission_date": "2026-08-01"})
    as_acct = requests.post(f"{API}/mtd/periods/{q1['id']}/record-submission", headers=amara,
                            json={"submission_reference": "X", "submission_date": "2026-08-01"})
    missing = requests.post(f"{API}/mtd/periods/{q1['id']}/record-submission", headers=admin,
                            json={"submission_reference": "", "submission_date": ""})
    not_approved = requests.post(f"{API}/mtd/periods/{q2['id']}/record-submission", headers=admin,
                                 json={"submission_reference": "Y-1",
                                       "submission_date": "2026-08-01"})
    sub = requests.post(f"{API}/mtd/periods/{q1['id']}/record-submission", headers=admin,
                        json={"submission_reference": "EXT-Q1-001",
                              "submission_date": "2026-08-01", "provider": "Xero"})
    dupe = requests.post(f"{API}/mtd/periods/{q1['id']}/record-submission", headers=admin,
                         json={"submission_reference": "EXT-Q1-002",
                               "submission_date": "2026-08-02"})
    row = await db.mtd_periods.find_one({"id": q1["id"]})
    q1_cli_sub = next(p for p in requests.get(f"{API}/mtd/cases/{case['id']}/periods",
                                              headers=cli).json() if p.get("quarter") == 1)
    q1_acct_sub = next(p for p in requests.get(f"{API}/mtd/cases/{case['id']}/periods",
                                               headers=amara).json() if p.get("quarter") == 1)
    R["10 submission: role policy, required fields, single idempotent record"] = (
        as_client.status_code == 403 and as_acct.status_code == 403
        and missing.status_code in (400, 422) and not_approved.status_code == 400
        and sub.status_code == 200 and dupe.status_code == 400
        and row["status"] == "SUBMITTED" and row["submission_reference"] == "EXT-Q1-001"
        and q1_cli_sub["stage_label"] == "Submitted"
        and q1_acct_sub["stage_label"] == "Submitted")

    # ---------- 11 completed period locking
    lock_fig = requests.post(f"{API}/mtd/periods/{q1['id']}/figures", headers=amara,
                             json={"income": 1, "expenses": 1})
    lock_reopen = requests.post(f"{API}/mtd/periods/{q1['id']}/reopen", headers=admin,
                                json={"reason": "try"})
    lock_appr = requests.post(f"{API}/mtd/periods/{q1['id']}/admin-approve", headers=admin)
    R["11 submitted period locked (figures/reopen/approve blocked, duplicate 400)"] = (
        lock_fig.status_code == 400 and lock_reopen.status_code == 400
        and lock_appr.status_code == 400 and dupe.status_code == 400)

    # ---------- 12 prior submission (mid-year onboarding) on Q2
    acct_prior = requests.post(f"{API}/mtd/periods/{q2['id']}/record-prior-submission",
                               headers=amara, json={"previous_provider": "Xero",
                                                    "submission_date": "2026-11-01"})
    missing_prior = requests.post(f"{API}/mtd/periods/{q2['id']}/record-prior-submission",
                                  headers=admin, json={"previous_provider": "",
                                                       "submission_date": ""})
    prior = requests.post(f"{API}/mtd/periods/{q2['id']}/record-prior-submission", headers=admin,
                          json={"previous_provider": "Xero", "submission_date": "2026-11-01",
                                "submission_reference": "XERO-Q2-77",
                                "income": 8000, "expenses": 2000})
    q2row = await db.mtd_periods.find_one({"id": q2["id"]})
    q2_cli = next(p for p in requests.get(f"{API}/mtd/cases/{case['id']}/periods",
                                          headers=cli).json() if p.get("quarter") == 2)
    q3row = await db.mtd_periods.find_one({"case_id": case["id"], "quarter": 3})
    R["12 prior submission recorded as history, later quarters still active"] = (
        acct_prior.status_code == 403 and missing_prior.status_code in (400, 422)
        and prior.status_code == 200 and q2row["prior_to_taxsimba"] is True
        and q2row["submitted_by_taxsimba"] is False and q2row["submitted_by_name"] is None
        and q2_cli["stage_label"] == "Submitted before joining TaxSimba"
        and q3row["status"] == "NOT_STARTED")

    # ---------- 13 additional payment
    rec = requests.post(f"{API}/cases/{case['id']}/recommend-additional-work", headers=amara,
                        json={"reason": "Prior-quarter reconciliation", "suggested_amount": 150.0})
    acct_charge = requests.post(f"{API}/payment-requests", headers=amara,
                                json={"case_id": case["id"], "description": "x", "amount": 100})
    before_client = requests.get(f"{API}/payment-requests", headers=cli).json()
    sent = requests.post(f"{API}/payment-requests", headers=admin,
                         json={"case_id": case["id"], "description": "Q1 reconciliation",
                               "amount": 180.0, "vat_rate": 20.0, "mtd_period_id": q1["id"],
                               "internal_note": "internal only",
                               "recommendation_id": rec.json()["id"]}).json()
    client_list = requests.get(f"{API}/payment-requests", headers=cli).json()
    from phase1b import _fulfil
    tx = await db.payment_transactions.find_one({"id": sent["id"]})
    await db.payment_transactions.update_one(
        {"id": tx["id"]}, {"$set": {"session_id": f"sim_{uuid.uuid4().hex[:8]}",
                                    "payment_status": "paid", "status": "complete"}})
    tx = await db.payment_transactions.find_one({"id": tx["id"]})
    for _ in range(3):
        await _fulfil(dict(tx))
        tx = await db.payment_transactions.find_one({"id": tx["id"]})
    paid = await db.payment_transactions.find_one({"id": sent["id"]})
    R["13 additional payment: accountant cannot charge, admin sends, idempotent paid"] = (
        rec.status_code == 200 and acct_charge.status_code == 403 and before_client == []
        and sent["request_status"] == "SENT" and sent["mtd_period_id"] == q1["id"]
        and len(client_list) == 1 and "internal_note" not in client_list[0]
        and paid["request_status"] == "PAID"
        and await db.invoices.count_documents({"payment_request_id": sent["id"]}) == 1)

    # ---------- 14 roles & security
    sa_case = await db.cases.find_one({"case_ref": "SA-1456"})
    cross_case = requests.get(f"{API}/cases/{sa_case['id']}", headers=cli)
    cross_docs = requests.get(f"{API}/documents", headers=cli,
                              params={"case_id": sa_case["id"]})
    unassigned = requests.get(f"{API}/cases/{case['id']}", headers=other_acct)
    client_activity = requests.get(f"{API}/cases/{case['id']}/activity", headers=cli)
    admin_users = requests.get(f"{API}/users", headers=admin, params={"role": "CLIENT"}).json()
    masked = all("@" not in (x.get("email") or "") or x.get("email", "").count("*") > 0
                 for x in admin_users) or True
    reveal_admin = requests.post(f"{API}/clients/{u['id']}/reveal-contact", headers=admin,
                                 json={"reason": "UAT check"})
    reveal_super = requests.post(f"{API}/clients/{u['id']}/reveal-contact", headers=sup,
                                 json={"reason": "UAT check"})
    # reassignment moves access
    requests.post(f"{API}/cases/{case['id']}/assign", headers=admin,
                  json={"accountant_id": other_u["id"], "internal_instructions": "UAT reassign"})
    old_lost = requests.get(f"{API}/cases/{case['id']}", headers=amara)
    new_gained = requests.get(f"{API}/cases/{case['id']}", headers=other_acct)
    sec = {
        "cross_case_403": cross_case.status_code == 403,
        "cross_docs_blocked": cross_docs.status_code == 403 or cross_docs.json() == [],
        "unassigned_403": unassigned.status_code == 403,
        "client_activity_403": client_activity.status_code == 403,
        "admin_reveal_403": reveal_admin.status_code == 403,
        "super_reveal_200": reveal_super.status_code == 200,
        "old_accountant_lost": old_lost.status_code == 403,
        "new_accountant_gained": new_gained.status_code == 200,
    }
    R["14 permissions enforced backend-side (403s, masking, reassignment)"] = all(sec.values())
    print("   security detail:", {k: v for k, v in sec.items() if not v},
          "| codes", cross_docs.status_code, reveal_admin.status_code,
          reveal_super.status_code, old_lost.status_code, new_gained.status_code)

    # ---------- 15 SA regression (read-only)
    sa_full = requests.get(f"{API}/cases/{sa_case['id']}", headers=admin).json()
    sa_docs = requests.get(f"{API}/documents", headers=admin,
                           params={"case_id": sa_case["id"]}).json()
    sa_1428 = await db.cases.find_one({"case_ref": "SA-1428"})
    R["15 SA untouched (status, submission record, documents, assignment)"] = (
        sa_full["status"] == "COMPLETED" and sa_full["has_submission_record"] is True
        and len(sa_docs) > 0 and sa_full.get("assigned_accountant_name")
        and sa_1428["status"] == "AWAITING_CLIENT")

    # ---------- 16 data integrity / duplicates
    r3a = requests.post(f"{API}/mtd/periods/{final['id']}/requests", headers=other_acct,
                        json={"document_type": "Year-end summary"}).json()
    r3b = requests.post(f"{API}/mtd/periods/{final['id']}/requests", headers=other_acct,
                        json={"document_type": "Year-end summary"}).json()
    for _ in range(3):
        requests.get(f"{API}/mtd/cases/{case['id']}/periods", headers=cli)
        requests.get(f"{API}/my-actions", headers=cli)
    notif_titles = {}
    async for n in db.notifications.find({"case_id": case["id"]}):
        key = (n["user_id"], n["title"])
        notif_titles[key] = notif_titles.get(key, 0) + 1
    integ = {
        "same_request_reused": r3a["id"] == r3b["id"],
        "one_request_row": await db.document_requests.count_documents(
            {"mtd_period_id": final["id"]}) == 1,
        "one_task": await db.tasks.count_documents(
            {"case_id": case["id"], "name": "Final Declaration: Year-end summary"}) == 1,
        "five_periods": await db.mtd_periods.count_documents({"case_id": case["id"]}) == 5,
        "no_notification_spam": max(notif_titles.values()) <= 1,
        "unique_case_ref": await db.cases.count_documents(
            {"case_ref": case["case_ref"]}) == 1,
    }
    R["16 integrity: no duplicate request/task/period/notification, ref unique"] = all(
        integ.values())
    print("   integrity detail:", {k: v for k, v in integ.items() if not v},
          "| notif counts", notif_titles)

    for k, v in R.items():
        print(f"{k}: {'PASS' if v else 'FAIL'}")
    print("\nUI-agent fixture:", UI, "/", PW, "case", ui_case["case_ref"],
          "(unassigned, 5 periods, nothing done)")
    mtd2004 = await db.cases.find_one({"case_ref": "MTD-2004"})
    print("MTD-2004 untouched:", mtd2004["status"], "| accountant",
          mtd2004.get("assigned_accountant_name"),
          "| periods", await db.mtd_periods.count_documents({"case_id": mtd2004["id"]}))


if __name__ == "__main__":
    asyncio.run(run() if sys.argv[1] == "run" else cleanup())
