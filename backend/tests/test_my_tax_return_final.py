"""My Tax Return final section corrections: final documents, approval wording source,
submission model (accountant files via third-party software and records the outcome), and the
payment deadline derived from the case tax year. Uses a disposable client throughout."""
import sys
import uuid

import pytest
import requests

sys.path.insert(0, "/app/backend/tests")
from qa_clients import API, QA_PASSWORD  # noqa: E402

STAFF = {"acc": ("accountant.a@taxsimba.co.uk", "Account@123"),
         "admin": ("admin@taxsimba.co.uk", "Admin@123"),
         "super": ("superadmin@taxsimba.co.uk", "Super@123")}
FULL_CHECKLIST = {k: True for k in [
    "client_information_reviewed", "required_documents_reviewed", "income_checked",
    "allowable_expenses_checked", "tax_calculation_checked",
    "supporting_documents_attached", "return_ready"]}


def _tok(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def roles():
    return {k: _tok(*v) for k, v in STAFF.items()}


def _make_client(roles, tax_year="2025/26"):
    email = f"qa.mtr.{uuid.uuid4().hex[:8]}@qa-taxsimba.example.com"
    made = requests.post(f"{API}/users", json={"email": email, "password": QA_PASSWORD,
                                               "name": "QA MTR Client", "role": "CLIENT"},
                         headers=roles["super"], timeout=30)
    assert made.status_code == 200, made.text
    case = requests.post(f"{API}/cases", json={"client_user_id": made.json()["id"],
                                               "service_type": "SELF_ASSESSMENT",
                                               "tax_year": tax_year},
                         headers=roles["admin"], timeout=30)
    assert case.status_code == 200, case.text
    accs = requests.get(f"{API}/users?role=ACCOUNTANT&email={STAFF['acc'][0]}",
                        headers=roles["super"], timeout=30).json()
    requests.post(f"{API}/cases/{case.json()['id']}/assign",
                  json={"accountant_id": accs[0]["id"], "priority": "MEDIUM"},
                  headers=roles["admin"], timeout=30)
    return {"email": email, "client": _tok(email, QA_PASSWORD),
            "case_id": case.json()["id"], "tax_year": tax_year}


def _to_client_approval(ctx, roles, deadline=None):
    cid = ctx["case_id"]
    requests.post(f"{API}/cases/{cid}/start-review", headers=roles["acc"], timeout=30)
    requests.post(f"{API}/cases/{cid}/mark-reviewed", headers=roles["acc"], timeout=30)
    body = {"total_income": 50000, "taxable_income": 37430, "tax_due": 7480.0,
            "is_refund": False, "notes": "QA"}
    if deadline:
        body["payment_deadline"] = deadline
    calc = requests.post(f"{API}/cases/{cid}/calculations", json=body,
                         headers=roles["acc"], timeout=30)
    assert calc.status_code == 200, calc.text
    requests.post(f"{API}/cases/{cid}/submit-for-admin-review",
                  json={"calculation_version_id": calc.json()["id"],
                        "checklist": FULL_CHECKLIST, "admin_note": "QA"},
                  headers=roles["acc"], timeout=30)
    requests.post(f"{API}/cases/{cid}/admin-approve", json={"note": "ok"},
                  headers=roles["admin"], timeout=30)
    return calc.json()


@pytest.fixture(scope="module")
def ctx(roles):
    c = _make_client(roles)
    c["calc"] = _to_client_approval(c, roles)
    return c


def _case(ctx, hdr=None):
    return requests.get(f"{API}/cases/{ctx['case_id']}",
                        headers=hdr or ctx["client"], timeout=30).json()


# ============================================================ 4. deadline
class TestPaymentDeadline:
    def test_2025_26_deadline_is_31_january_2027(self, ctx):
        calcs = requests.get(f"{API}/cases/{ctx['case_id']}/calculations",
                             headers=ctx["client"], timeout=30).json()
        assert calcs, "client cannot see the approved calculation"
        assert calcs[0]["payment_deadline"] == "31 January 2027", calcs[0]["payment_deadline"]

    def test_deadline_never_shows_2026_for_2025_26(self, ctx):
        calcs = requests.get(f"{API}/cases/{ctx['case_id']}/calculations",
                             headers=ctx["client"], timeout=30).json()
        assert "2026" not in calcs[0]["payment_deadline"]

    def test_deadline_is_derived_from_the_case_tax_year(self, roles):
        """A different tax year must yield a different deadline with no code change."""
        other = _make_client(roles, tax_year="2024/25")
        _to_client_approval(other, roles)
        calcs = requests.get(f"{API}/cases/{other['case_id']}/calculations",
                             headers=other["client"], timeout=30).json()
        assert calcs[0]["payment_deadline"] == "31 January 2026", calcs[0]["payment_deadline"]

    def test_stale_stored_deadline_is_overridden_on_read(self, roles):
        """Historic records that stored an old literal still display the derived date."""
        stale = _make_client(roles)
        _to_client_approval(stale, roles, deadline="31 January 2026")
        calcs = requests.get(f"{API}/cases/{stale['case_id']}/calculations",
                             headers=stale["client"], timeout=30).json()
        assert calcs[0]["payment_deadline"] == "31 January 2027"

    def test_case_filing_deadline_still_2027(self, ctx):
        assert _case(ctx)["external_deadline"].startswith("2027-01-31")


# ============================================================ 2. approval wording source
class TestApprovalAndSubmissionModel:
    """Sections 2 and 3 in one class on purpose: the submission assertions depend on the
    client-approve step above, and --dist loadscope keeps a single class on one worker."""

    def test_no_approved_version_before_client_approves(self, ctx):
        assert _case(ctx)["approved_version"] is None

    def test_approved_version_comes_from_the_approval_record(self, ctx, roles):
        assert requests.post(f"{API}/cases/{ctx['case_id']}/client-approve",
                             headers=ctx["client"], timeout=30).status_code == 200
        case = _case(ctx)
        assert case["approved_version"] == ctx["calc"]["version"]
        assert isinstance(case["approved_version"], int)

    def test_version_two_is_reported_when_two_versions_exist(self, roles):
        """Proves the number is dynamic rather than a hard-coded 1 or 2."""
        c = _make_client(roles)
        cid = c["case_id"]
        requests.post(f"{API}/cases/{cid}/start-review", headers=roles["acc"], timeout=30)
        requests.post(f"{API}/cases/{cid}/mark-reviewed", headers=roles["acc"], timeout=30)
        v1 = requests.post(f"{API}/cases/{cid}/calculations",
                           json={"total_income": 10, "taxable_income": 5, "tax_due": 1,
                                 "is_refund": False, "notes": "v1"},
                           headers=roles["acc"], timeout=30)
        assert v1.status_code == 200, v1.text
        v2 = requests.post(f"{API}/cases/{cid}/calculations",
                           json={"total_income": 20, "taxable_income": 10, "tax_due": 2,
                                 "is_refund": False, "notes": "v2"},
                           headers=roles["acc"], timeout=30)
        assert v2.status_code == 200 and v2.json()["version"] == 2
        requests.post(f"{API}/cases/{cid}/submit-for-admin-review",
                      json={"calculation_version_id": v2.json()["id"],
                            "checklist": FULL_CHECKLIST, "admin_note": "QA"},
                      headers=roles["acc"], timeout=30)
        requests.post(f"{API}/cases/{cid}/admin-approve", json={"note": "ok"},
                      headers=roles["admin"], timeout=30)
        assert requests.post(f"{API}/cases/{cid}/client-approve",
                             headers=c["client"], timeout=30).status_code == 200
        case = requests.get(f"{API}/cases/{cid}", headers=c["client"], timeout=30).json()
        assert case["approved_version"] == 2, case["approved_version"]


    # ---------------------------------------------- 3. submission model
    def test_client_approval_alone_does_not_mark_submitted(self, ctx):
        case = _case(ctx)
        assert case["status"] in ("CLIENT_APPROVED", "READY_FOR_SUBMISSION")
        assert case["has_submission_record"] is False, \
            "approval alone marked the return as submitted"
        assert case["status_label"] == "Ready for HMRC submission"
        hmrc = [j for j in case["journey"] if j["step"] == "HMRC Submission"][0]
        assert hmrc["state"] == "Ready to Submit"

    def test_status_flips_to_submitted_only_when_accountant_records_it(self, ctx, roles):
        ref = f"SW-{uuid.uuid4().hex[:6].upper()}"
        r = requests.post(f"{API}/cases/{ctx['case_id']}/record-submission",
                          json={"submission_date": "2027-01-20", "submission_reference": ref,
                                "provider": "Third-party tax software",
                                "note": "Filed via accounting software"},
                          headers=roles["admin"], timeout=30)
        assert r.status_code == 200, r.text
        case = _case(ctx)
        assert case["has_submission_record"] is True
        assert case["status_label"] == "Submitted to HMRC"
        assert case["status_label"] != "Ready for HMRC submission"

    def test_recorded_submission_date_is_returned(self, ctx):
        case = _case(ctx)
        assert case.get("submission_date"), "no recorded submission date for the client"
        assert "2027-01-20" in str(case["submission_date"])
        assert case.get("submission_reference")

    def test_journey_shows_submitted_successfully(self, ctx):
        hmrc = [j for j in _case(ctx)["journey"] if j["step"] == "HMRC Submission"][0]
        assert hmrc["state"] == "Submitted Successfully"

    def test_client_can_never_record_a_submission(self, ctx):
        r = requests.post(f"{API}/cases/{ctx['case_id']}/record-submission",
                          json={"submission_date": "2027-02-01", "submission_reference": "FAKE",
                                "provider": "x", "note": "x"},
                          headers=ctx["client"], timeout=30)
        assert r.status_code == 403


# ============================================================ 1. final documents
class TestFinalDocuments:
    def test_empty_until_released(self, roles):
        fresh = _make_client(roles)
        docs = requests.get(f"{API}/documents", params={"case_id": fresh["case_id"],
                                                       "filter": "final"},
                            headers=fresh["client"], timeout=30).json()
        assert docs == [], "final documents appeared before any were released"

    def test_released_final_document_is_visible_with_date(self, ctx, roles):
        up = requests.post(f"{API}/documents/upload",
                           data={"case_id": ctx["case_id"],
                                 "document_type": "Final tax return", "is_internal": "false"},
                           files={"file": ("final-return-2025-26.pdf", b"%PDF-1.4 f",
                                           "application/pdf")},
                           headers=roles["acc"], timeout=60)
        assert up.status_code == 200, up.text
        requests.patch(f"{API}/documents/{up.json()['id']}/status", params={"status": "Final"},
                       headers=roles["admin"], timeout=30)
        docs = requests.get(f"{API}/documents", params={"case_id": ctx["case_id"],
                                                       "filter": "final"},
                            headers=ctx["client"], timeout=30).json()
        assert docs, "released final document is not visible to the client"
        doc = docs[0]
        assert doc["name"]
        assert doc.get("upload_date") or doc.get("created_at"), "no date to display"
        ctx["final_doc_id"] = doc["id"]

    def test_client_can_download_own_final_document(self, ctx):
        r = requests.get(f"{API}/documents/{ctx['final_doc_id']}/download",
                         headers=ctx["client"], timeout=30)
        assert r.status_code == 200

    def test_final_documents_are_case_specific(self, ctx, roles):
        other = _make_client(roles)
        docs = requests.get(f"{API}/documents", params={"case_id": other["case_id"],
                                                       "filter": "final"},
                            headers=other["client"], timeout=30).json()
        assert ctx["final_doc_id"] not in {d["id"] for d in docs}

    def test_another_client_cannot_reach_the_final_document(self, ctx, roles):
        other = _make_client(roles)
        r = requests.get(f"{API}/documents/{ctx['final_doc_id']}/download",
                         headers=other["client"], timeout=30)
        assert r.status_code in (403, 404), "final document leaked to another client"
        listed = requests.get(f"{API}/documents", headers=other["client"], timeout=30).json()
        assert ctx["final_doc_id"] not in {d["id"] for d in listed}
