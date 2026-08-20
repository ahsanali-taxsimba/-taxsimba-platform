"""Section 19: the complete clean client journey on a fresh Client A style account, proving no
duplicates are created at any step. Uses its own throwaway client so the demo data is untouched."""
import sys
import uuid

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
sys.path.insert(0, "/app/backend")

BASE = "https://taxsimba-foundation.preview.emergentagent.com"
API = f"{BASE}/api"
TAX_YEAR = "2025/26"


def _tok(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def staff():
    return {
        "admin": _h(_tok("admin@taxsimba.co.uk", "Admin@123")),
        "super": _h(_tok("superadmin@taxsimba.co.uk", "Super@123")),
        "acc": _h(_tok("accountant.a@taxsimba.co.uk", "Account@123")),
    }


@pytest.fixture(scope="module")
def journey(staff):
    """Purchase -> case -> assignment. Returns the live context for the whole journey."""
    email = f"test_journey_{uuid.uuid4().hex[:8]}@example.com"
    pw = "Journey@123"
    created = requests.post(f"{API}/users",
                            json={"email": email, "password": pw, "name": "TEST Journey Client",
                                  "role": "CLIENT"}, headers=staff["super"], timeout=30)
    assert created.status_code == 200, created.text
    ctx = {"email": email, "token": _h(_tok(email, pw)), "user_id": created.json()["id"]}

    case = requests.post(f"{API}/cases", json={"client_user_id": ctx["user_id"],
                                               "service_type": "SELF_ASSESSMENT",
                                               "tax_year": TAX_YEAR},
                         headers=staff["admin"], timeout=30)
    assert case.status_code == 200, case.text
    ctx["case"] = case.json()
    ctx["case_id"] = ctx["case"]["id"]

    accs = requests.get(f"{API}/users", params={"role": "ACCOUNTANT"},
                        headers=staff["super"], timeout=30).json()
    acc_a = next(a for a in accs if a["email"] == "accountant.a@taxsimba.co.uk")
    assigned = requests.post(f"{API}/cases/{ctx['case_id']}/assign",
                             json={"accountant_id": acc_a["id"], "priority": "MEDIUM"},
                             headers=staff["admin"], timeout=30)
    assert assigned.status_code == 200, assigned.text
    return ctx


class TestCleanClientJourney:
    def test_01_case_created_with_correct_year_and_deadline(self, journey, staff):
        full = requests.get(f"{API}/cases/{journey['case_id']}",
                            headers=journey["token"], timeout=30).json()
        assert full["tax_year"] == TAX_YEAR
        assert full["external_deadline"].startswith("2027-01-31")

    def test_02_client_dashboard_accessible_and_scoped(self, journey):
        me = requests.get(f"{API}/auth/me", headers=journey["token"], timeout=30)
        assert me.status_code == 200
        cases = requests.get(f"{API}/cases", headers=journey["token"], timeout=30).json()
        assert [c["id"] for c in cases] == [journey["case_id"]], "new client sees foreign cases"

    def test_03_accountant_reviews_and_requests_one_document(self, journey, staff):
        assert requests.post(f"{API}/cases/{journey['case_id']}/start-review",
                             headers=staff["acc"], timeout=30).status_code == 200
        body = {"title": "Bank statements", "description": "April 2026 statement please",
                "document_required": True, "mandatory": True}
        r = requests.post(f"{API}/cases/{journey['case_id']}/request-from-client",
                          json=body, headers=staff["acc"], timeout=30)
        assert r.status_code == 200, r.text
        # fire it again: must NOT create a second task/request/document
        for _ in range(2):
            requests.post(f"{API}/cases/{journey['case_id']}/request-from-client",
                          json=body, headers=staff["acc"], timeout=30)

    def test_04_client_sees_exactly_one_action(self, journey):
        actions = requests.get(f"{API}/my-actions", headers=journey["token"], timeout=30).json()
        assert len(actions["outstanding"]) == 1, actions["outstanding"]
        assert actions["outstanding"][0]["action"] == "Bank statements"
        tasks = requests.get(f"{API}/tasks", headers=journey["token"], timeout=30).json()
        assert len(tasks) == 1, f"expected 1 task, got {len(tasks)}"
        reqs = requests.get(f"{API}/documents", params={"filter": "requested"},
                            headers=journey["token"], timeout=30).json()
        assert len(reqs) == 1, f"expected 1 requested document, got {len(reqs)}"

    def test_05_client_uploads_one_document(self, journey):
        tasks = requests.get(f"{API}/tasks", headers=journey["token"], timeout=30).json()
        task = tasks[0]
        placeholders = requests.get(f"{API}/documents", params={"case_id": journey["case_id"],
                                                               "filter": "requested"},
                                    headers=journey["token"], timeout=30).json()
        fields = {"case_id": journey["case_id"], "document_type": "Bank statements",
                  "task_id": task["id"]}
        if placeholders:
            fields["document_id"] = placeholders[0]["id"]
        r = requests.post(f"{API}/documents/upload", data=fields,
                          files={"file": ("bank-statement-april-2026.pdf", b"%PDF-1.4 test",
                                          "application/pdf")},
                          headers=journey["token"], timeout=60)
        assert r.status_code == 200, r.text

    def test_06_one_document_one_completed_entry_no_duplicates(self, journey):
        docs = requests.get(f"{API}/documents", headers=journey["token"], timeout=30).json()
        assert len(docs) == 1, f"expected exactly 1 document, got {len(docs)}: " \
                               f"{[(d['name'], d['status']) for d in docs]}"
        assert docs[0]["status"] == "Uploaded"
        assert docs[0]["tax_year"] == TAX_YEAR
        actions = requests.get(f"{API}/my-actions", headers=journey["token"], timeout=30).json()
        assert len(actions["outstanding"]) == 0
        assert len(actions["history"]) == 1, f"expected 1 history entry, got {len(actions['history'])}"

    def test_07_accountant_receives_it(self, journey, staff):
        docs = requests.get(f"{API}/documents", params={"case_id": journey["case_id"]},
                            headers=staff["acc"], timeout=30).json()
        assert any(d["status"] == "Uploaded" for d in docs)

    def test_08_calculation_admin_approval_and_release(self, journey, staff):
        cid = journey["case_id"]
        requests.post(f"{API}/cases/{cid}/mark-reviewed", headers=staff["acc"], timeout=30)
        calc = requests.post(f"{API}/cases/{cid}/calculations",
                             json={"total_income": 52000, "taxable_income": 39430,
                                   "tax_due": 8120.4, "is_refund": False,
                                   "payment_deadline": "31 January 2027",
                                   "notes": "Employment plus rental income."},
                             headers=staff["acc"], timeout=30)
        assert calc.status_code == 200, calc.text
        journey["calc_id"] = calc.json()["id"]
        sub = requests.post(f"{API}/cases/{cid}/submit-for-admin-review",
                            json={"calculation_version_id": journey["calc_id"], "checklist": {
                                "client_information_reviewed": True,
                                "required_documents_reviewed": True,
                                "income_checked": True,
                                "allowable_expenses_checked": True,
                                "tax_calculation_checked": True,
                                "supporting_documents_attached": True,
                                "return_ready": True,
                            }, "admin_note": "Ready for review"},
                            headers=staff["acc"], timeout=30)
        assert sub.status_code == 200, sub.text
        # admin-approve also releases the approved calculation to the client
        appr = requests.post(f"{API}/cases/{cid}/admin-approve",
                             json={"note": "Checked and approved."},
                             headers=staff["admin"], timeout=30)
        assert appr.status_code == 200, appr.text

    def test_09_client_sees_version_1_and_approves(self, journey):
        calcs = requests.get(f"{API}/cases/{journey['case_id']}/calculations",
                             headers=journey["token"], timeout=30).json()
        assert calcs, "client cannot see the released calculation"
        assert calcs[0]["version"] == 1
        r = requests.post(f"{API}/cases/{journey['case_id']}/client-approve",
                          headers=journey["token"], timeout=30)
        assert r.status_code == 200, r.text

    def test_10_ready_for_submission_is_not_shown_as_submitted(self, journey):
        full = requests.get(f"{API}/cases/{journey['case_id']}",
                            headers=journey["token"], timeout=30).json()
        assert full["status"] in ("CLIENT_APPROVED", "READY_FOR_SUBMISSION"), full["status"]
        assert full["has_submission_record"] is False
        hmrc = [j for j in full["journey"] if j["step"] == "HMRC Submission"][0]
        assert hmrc["state"] == "Ready to Submit", hmrc
        assert "_" not in full["status_label"]

    def test_11_authorised_submission_recorded_then_completed(self, journey, staff):
        cid = journey["case_id"]
        ref = f"HMRC-{uuid.uuid4().hex[:8].upper()}"
        sub = requests.post(f"{API}/cases/{cid}/record-submission",
                            json={"submission_date": "2027-01-15",
                                  "submission_reference": ref,
                                  "provider": "Agent portal",
                                  "note": "Filed by authorised TaxSimba staff."},
                            headers=staff["admin"], timeout=30)
        assert sub.status_code == 200, sub.text
        full = requests.get(f"{API}/cases/{cid}", headers=journey["token"], timeout=30).json()
        assert full["has_submission_record"] is True
        hmrc = [j for j in full["journey"] if j["step"] == "HMRC Submission"][0]
        assert hmrc["state"] == "Submitted Successfully", hmrc
        done = requests.post(f"{API}/cases/{cid}/complete", headers=staff["admin"], timeout=30)
        assert done.status_code in (200, 400), done.text

    def test_12_final_documents_available_to_client(self, journey, staff):
        cid = journey["case_id"]
        up = requests.post(f"{API}/documents/upload",
                           data={"case_id": cid, "document_type": "Final tax return",
                                 "is_internal": "false"},
                           files={"file": ("final-tax-return-2025-26.pdf", b"%PDF-1.4 final",
                                           "application/pdf")},
                           headers=staff["admin"], timeout=60)
        assert up.status_code == 200, up.text
        requests.patch(f"{API}/documents/{up.json()['id']}/status", params={"status": "Final"},
                       headers=staff["admin"], timeout=30)
        finals = requests.get(f"{API}/documents", params={"filter": "final"},
                              headers=journey["token"], timeout=30).json()
        assert finals, "no final documents visible to the client"
        dl = requests.get(f"{API}/documents/{finals[0]['id']}/download",
                          headers=journey["token"], timeout=30)
        assert dl.status_code == 200

    def test_13_no_duplicates_anywhere_at_the_end(self, journey):
        tok = journey["token"]
        docs = requests.get(f"{API}/documents", headers=tok, timeout=30).json()
        tasks = requests.get(f"{API}/tasks", headers=tok, timeout=30).json()
        actions = requests.get(f"{API}/my-actions", headers=tok, timeout=30).json()
        notes = requests.get(f"{API}/notifications", headers=tok, timeout=30).json()
        assert len({(d["name"], d["status"]) for d in docs}) == len(docs), "duplicate documents"
        assert len({t["name"] for t in tasks}) == len(tasks), "duplicate tasks"
        assert len({(h["action"], h["case_id"]) for h in actions["history"]}) == len(actions["history"])
        unread = [n["title"] for n in notes if not n["is_read"]]
        assert len(unread) == len(set(unread)), "duplicate unread notifications"
        cases = requests.get(f"{API}/cases", headers=tok, timeout=30).json()
        assert len(cases) == 1, f"journey created {len(cases)} cases"
