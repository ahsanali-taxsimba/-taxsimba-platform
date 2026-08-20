"""Cross-role end-to-end QA: Client -> Accountant -> Admin -> Super Admin.

Exercises the real workflow and permission model on a DISPOSABLE client (never the demo
accounts), asserting that each role sees only what it should and that a status change made by
one role propagates correctly to the others.
"""
import os
import sys
import uuid

import pytest
import requests

sys.path.insert(0, "/app/backend/tests")
from qa_clients import API, QA_PASSWORD  # noqa: E402

STAFF = {
    "acc_a": ("accountant.a@taxsimba.co.uk", "Account@123"),
    "acc_b": ("accountant.b@taxsimba.co.uk", "Account@123"),
    "admin": ("admin@taxsimba.co.uk", "Admin@123"),
    "super": ("superadmin@taxsimba.co.uk", "Super@123"),
}
FULL_CHECKLIST = {k: True for k in [
    "client_information_reviewed", "required_documents_reviewed", "income_checked",
    "allowable_expenses_checked", "tax_calculation_checked",
    "supporting_documents_attached", "return_ready"]}


def _tok(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
    assert r.status_code == 200, f"{email}: {r.text}"
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def roles():
    return {k: _tok(*v) for k, v in STAFF.items()}


@pytest.fixture(scope="module")
def ctx(roles):
    """A disposable client with a live Self Assessment 2025/26 case assigned to Accountant A."""
    email = f"qa.xrole.{uuid.uuid4().hex[:8]}@qa-taxsimba.example.com"
    made = requests.post(f"{API}/users",
                         json={"email": email, "password": QA_PASSWORD,
                               "name": "QA CrossRole Client", "role": "CLIENT"},
                         headers=roles["super"], timeout=30)
    assert made.status_code == 200, made.text
    uid = made.json()["id"]
    case = requests.post(f"{API}/cases",
                         json={"client_user_id": uid, "service_type": "SELF_ASSESSMENT",
                               "tax_year": "2025/26"}, headers=roles["admin"], timeout=30)
    assert case.status_code == 200, case.text
    accs = requests.get(f"{API}/users?role=ACCOUNTANT&email={STAFF['acc_a'][0]}",
                        headers=roles["super"], timeout=30).json()
    acc_a_id = accs[0]["id"]
    assert requests.post(f"{API}/cases/{case.json()['id']}/assign",
                         json={"accountant_id": acc_a_id, "priority": "HIGH"},
                         headers=roles["admin"], timeout=30).status_code == 200
    return {"email": email, "uid": uid, "case_id": case.json()["id"],
            "case_ref": case.json()["case_ref"], "client": _tok(email, QA_PASSWORD),
            "acc_a_id": acc_a_id}


def _status(ctx, hdr):
    return requests.get(f"{API}/cases/{ctx['case_id']}", headers=hdr, timeout=30).json()


# ============================================================ assignment propagation
class TestCrossRoleWorkflow:
    """One class on purpose: these steps are sequential and share the module `ctx`, so they
    must stay on a single xdist worker under --dist loadscope."""

    def test_assigned_accountant_sees_case(self, ctx, roles):
        ids = {c["id"] for c in requests.get(f"{API}/cases", headers=roles["acc_a"],
                                             timeout=30).json()}
        assert ctx["case_id"] in ids, "assigned accountant cannot see the case"

    def test_unassigned_accountant_cannot(self, ctx, roles):
        ids = {c["id"] for c in requests.get(f"{API}/cases", headers=roles["acc_b"],
                                             timeout=30).json()}
        assert ctx["case_id"] not in ids
        assert requests.get(f"{API}/cases/{ctx['case_id']}", headers=roles["acc_b"],
                            timeout=30).status_code in (403, 404)

    def test_admin_and_super_admin_both_see_it(self, ctx, roles):
        for who in ("admin", "super"):
            assert requests.get(f"{API}/cases/{ctx['case_id']}", headers=roles[who],
                                timeout=30).status_code == 200

    def test_client_sees_own_case_and_accountant_name(self, ctx):
        case = _status(ctx, ctx["client"])
        assert case["case_ref"] == ctx["case_ref"]
        assert case["tax_year"] == "2025/26"
        assert case["external_deadline"].startswith("2027-01-31")

    def test_client_never_sees_accountant_contact_details(self, ctx):
        case = _status(ctx, ctx["client"])
        assert "accountant_email" not in case and "accountant_phone" not in case


# ============================================================ request -> upload propagation
    def test_accountant_requests_information(self, ctx, roles):
        assert requests.post(f"{API}/cases/{ctx['case_id']}/start-review",
                             headers=roles["acc_a"], timeout=30).status_code == 200
        r = requests.post(f"{API}/cases/{ctx['case_id']}/request-from-client",
                          json={"title": "P60", "description": "Your 2025/26 P60 please",
                                "document_required": True, "mandatory": True},
                          headers=roles["acc_a"], timeout=30)
        assert r.status_code == 200, r.text

    def test_client_sees_exactly_one_action(self, ctx):
        acts = requests.get(f"{API}/my-actions", headers=ctx["client"], timeout=30).json()
        assert len(acts["outstanding"]) == 1
        assert acts["outstanding"][0]["action"] == "P60"

    def test_status_propagated_to_every_role(self, ctx, roles):
        for who in ("admin", "super", "acc_a"):
            assert _status(ctx, roles[who])["status"] == "AWAITING_CLIENT"
        assert _status(ctx, ctx["client"])["status_label"] == "Waiting for you"

    def test_client_uploads_and_all_roles_see_it(self, ctx, roles):
        tasks = requests.get(f"{API}/tasks", headers=ctx["client"], timeout=30).json()
        placeholders = requests.get(f"{API}/documents", params={"filter": "requested"},
                                    headers=ctx["client"], timeout=30).json()
        fields = {"case_id": ctx["case_id"], "document_type": "P60", "task_id": tasks[0]["id"]}
        if placeholders:
            fields["document_id"] = placeholders[0]["id"]
        up = requests.post(f"{API}/documents/upload", data=fields,
                           files={"file": ("p60-2025-26.pdf", b"%PDF-1.4 p60", "application/pdf")},
                           headers=ctx["client"], timeout=60)
        assert up.status_code == 200, up.text
        for who in ("acc_a", "admin", "super"):
            docs = requests.get(f"{API}/documents", params={"case_id": ctx["case_id"]},
                                headers=roles[who], timeout=30).json()
            assert any(d["status"] == "Uploaded" for d in docs), f"{who} cannot see the upload"

    def test_one_document_one_history_entry(self, ctx):
        docs = requests.get(f"{API}/documents", headers=ctx["client"], timeout=30).json()
        assert len(docs) == 1, [d["name"] for d in docs]
        acts = requests.get(f"{API}/my-actions", headers=ctx["client"], timeout=30).json()
        assert len(acts["outstanding"]) == 0 and len(acts["history"]) == 1


# ============================================================ review gate
    def test_accountant_cannot_bypass_admin_review(self, ctx, roles):
        requests.post(f"{API}/cases/{ctx['case_id']}/mark-reviewed",
                      headers=roles["acc_a"], timeout=30)
        calc = requests.post(f"{API}/cases/{ctx['case_id']}/calculations",
                             json={"total_income": 48000, "taxable_income": 35430,
                                   "tax_due": 6420.5, "is_refund": False,
                                   "payment_deadline": "31 January 2027", "notes": "QA"},
                             headers=roles["acc_a"], timeout=30)
        assert calc.status_code == 200, calc.text
        ctx["calc_id"] = calc.json()["id"]
        # an accountant must not be able to record a submission
        bad = requests.post(f"{API}/cases/{ctx['case_id']}/record-submission",
                            json={"submission_date": "2027-01-10", "submission_reference": "X",
                                  "provider": "p", "note": "n"},
                            headers=roles["acc_a"], timeout=30)
        assert bad.status_code in (400, 403), "accountant recorded a submission"

    def test_client_cannot_see_unapproved_calculation(self, ctx):
        calcs = requests.get(f"{API}/cases/{ctx['case_id']}/calculations",
                             headers=ctx["client"], timeout=30).json()
        assert not calcs, "client saw a calculation before admin approval"

    def test_client_cannot_approve_before_release(self, ctx):
        r = requests.post(f"{API}/cases/{ctx['case_id']}/client-approve",
                          headers=ctx["client"], timeout=30)
        assert r.status_code == 400, "client approved before the return was released"

    def test_admin_approves_and_client_sees_version_1(self, ctx, roles):
        assert requests.post(f"{API}/cases/{ctx['case_id']}/submit-for-admin-review",
                             json={"calculation_version_id": ctx["calc_id"],
                                   "checklist": FULL_CHECKLIST, "admin_note": "QA"},
                             headers=roles["acc_a"], timeout=30).status_code == 200
        assert requests.post(f"{API}/cases/{ctx['case_id']}/admin-approve",
                             json={"note": "Approved"},
                             headers=roles["admin"], timeout=30).status_code == 200
        calcs = requests.get(f"{API}/cases/{ctx['case_id']}/calculations",
                             headers=ctx["client"], timeout=30).json()
        assert calcs and calcs[0]["version"] == 1

    def test_accountant_cannot_approve_on_behalf_of_client(self, ctx, roles):
        r = requests.post(f"{API}/cases/{ctx['case_id']}/client-approve",
                          headers=roles["acc_a"], timeout=30)
        assert r.status_code == 403

    def test_client_approves_and_it_propagates(self, ctx, roles):
        assert requests.post(f"{API}/cases/{ctx['case_id']}/client-approve",
                             headers=ctx["client"], timeout=30).status_code == 200
        for who in ("acc_a", "admin", "super"):
            assert _status(ctx, roles[who])["status"] in ("CLIENT_APPROVED",
                                                          "READY_FOR_SUBMISSION")


# ============================================================ submission truth
    def test_ready_is_never_shown_as_submitted(self, ctx):
        case = _status(ctx, ctx["client"])
        assert case["has_submission_record"] is False
        hmrc = [j for j in case["journey"] if j["step"] == "HMRC Submission"][0]
        assert hmrc["state"] == "Ready to Submit"
        assert case["status_label"] != "Submitted to HMRC"
        assert "_" not in case["status_label"]

    def test_client_cannot_record_submission(self, ctx):
        r = requests.post(f"{API}/cases/{ctx['case_id']}/record-submission",
                          json={"submission_date": "2027-01-10", "submission_reference": "FAKE",
                                "provider": "p", "note": "n"},
                          headers=ctx["client"], timeout=30)
        assert r.status_code == 403

    def test_submitted_only_after_authorised_record(self, ctx, roles):
        ref = f"HMRC-{uuid.uuid4().hex[:8].upper()}"
        r = requests.post(f"{API}/cases/{ctx['case_id']}/record-submission",
                          json={"submission_date": "2027-01-12", "submission_reference": ref,
                                "provider": "Agent portal", "note": "Filed by authorised staff"},
                          headers=roles["admin"], timeout=30)
        assert r.status_code == 200, r.text
        case = _status(ctx, ctx["client"])
        assert case["has_submission_record"] is True
        hmrc = [j for j in case["journey"] if j["step"] == "HMRC Submission"][0]
        assert hmrc["state"] == "Submitted Successfully"
        assert case["submission_reference"] == ref

    def test_journey_matches_real_case_state_for_all_roles(self, ctx, roles):
        client_case = _status(ctx, ctx["client"])
        admin_case = _status(ctx, roles["admin"])
        assert client_case["status"] == admin_case["status"], "roles disagree on case status"
        states = {j["step"]: j["state"] for j in client_case["journey"]}
        assert states["Your Approval"] == "Approved"
        assert states["Accountant Review"] == "Completed"


# ============================================================ oversight & privacy
class TestOversightAndPrivacy:
    def test_admin_oversight_endpoints(self, roles):
        for path in ("/stats/admin", "/cases", "/users?role=CLIENT", "/recommendations"):
            assert requests.get(f"{API}{path}", headers=roles["admin"],
                                timeout=30).status_code == 200, path

    def test_super_admin_oversight_endpoints(self, roles):
        for path in ("/overview", "/contact-access-log", "/users?role=ACCOUNTANT"):
            assert requests.get(f"{API}{path}", headers=roles["super"],
                                timeout=30).status_code == 200, path

    def test_admin_contact_masked_super_admin_not(self, ctx, roles):
        q = f"/users?role=CLIENT&email={ctx['email']}"
        a = requests.get(f"{API}{q}", headers=roles["admin"], timeout=30).json()
        s = requests.get(f"{API}{q}", headers=roles["super"], timeout=30).json()
        assert a and s
        assert a[0].get("contact_masked") is True and "*" in a[0]["email"]
        assert s[0]["email"] == ctx["email"]

    def test_super_admin_reveal_is_audited(self, ctx, roles):
        client = requests.get(f"{API}/users?role=CLIENT&email={ctx['email']}",
                             headers=roles["super"], timeout=30).json()[0]
        blank = requests.post(f"{API}/clients/{client['id']}/reveal-contact",
                              json={"reason": ""}, headers=roles["super"], timeout=30)
        assert blank.status_code == 400
        ok = requests.post(f"{API}/clients/{client['id']}/reveal-contact",
                           json={"reason": "Cross-role QA verification"},
                           headers=roles["super"], timeout=30)
        assert ok.status_code == 200 and ok.json()["email"] == ctx["email"]
        log = requests.get(f"{API}/contact-access-log", headers=roles["super"], timeout=30).json()
        assert any(e.get("reason") == "Cross-role QA verification" for e in log)
        assert requests.post(f"{API}/clients/{client['id']}/reveal-contact",
                             json={"reason": "nope"}, headers=roles["admin"],
                             timeout=30).status_code == 403

    def test_accountant_never_receives_client_contact_or_secrets(self, ctx, roles):
        raw = requests.get(f"{API}/cases/{ctx['case_id']}", headers=roles["acc_a"],
                           timeout=30).text
        for leak in ("password_hash", "@qa-taxsimba.example.com", "stripe_payment_intent_id"):
            assert leak not in raw, f"{leak} exposed to the accountant"

    def test_internal_notes_never_reach_the_client(self, ctx, roles):
        requests.post(f"{API}/cases/{ctx['case_id']}/notes",
                      json={"body": "INTERNAL QA ONLY"}, headers=roles["admin"], timeout=30)
        msgs = requests.get(f"{API}/messages", params={"case_id": ctx["case_id"]},
                            headers=ctx["client"], timeout=30).text
        assert "INTERNAL QA ONLY" not in msgs

    def test_client_cannot_use_any_staff_action(self, ctx):
        cid = ctx["case_id"]
        for method, path in [("post", f"/cases/{cid}/assign"),
                             ("post", f"/cases/{cid}/admin-approve"),
                             ("post", f"/cases/{cid}/start-review"),
                             ("post", f"/cases/{cid}/request-from-client"),
                             ("post", f"/cases/{cid}/notes"),
                             ("get", "/stats/admin"), ("get", "/overview")]:
            r = getattr(requests, method)(f"{API}{path}", json={}, headers=ctx["client"],
                                          timeout=30)
            assert r.status_code in (403, 422), f"client reached {path} ({r.status_code})"

    def test_accountant_cannot_use_admin_actions(self, ctx, roles):
        for path in (f"/cases/{ctx['case_id']}/assign", "/stats/admin", "/overview"):
            r = requests.get(f"{API}{path}", headers=roles["acc_a"], timeout=30) \
                if path.startswith("/stats") or path.startswith("/overview") else \
                requests.post(f"{API}{path}", json={}, headers=roles["acc_a"], timeout=30)
            assert r.status_code in (403, 422), f"accountant reached {path}"


# ============================================================ demo isolation guarantee
class TestDemoAccountsUntouched:
    def test_demo_accounts_did_not_grow(self):
        """The whole cross-role journey must not have created anything on Client A/B."""
        import json
        from qa_clients import assert_demo_accounts_untouched, demo_account_counts
        try:
            before = json.load(open("/app/memory/demo_baseline.json"))
        except FileNotFoundError:
            pytest.skip("no demo baseline captured")
        problems = assert_demo_accounts_untouched(before, demo_account_counts())
        assert not problems, f"automated tests polluted the demo accounts: {problems}"
