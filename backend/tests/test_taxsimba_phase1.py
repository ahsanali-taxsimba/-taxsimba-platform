"""TaxSimba Phase 1 – end-to-end backend workflow tests.

Covers: JWT auth for all 4 roles, admin create-case, assign, request-from-client,
client task upload, calculation V1/V2, submit-with-checklist, admin return/approve,
client approve, role isolation, stats, notifications, super-admin user creation.
"""
import io
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else \
    open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip()
API = f"{BASE_URL}/api"

from qa_clients import QA_CLIENT_A, QA_CLIENT_B  # noqa: E402

CREDS = {
    "admin":       ("admin@taxsimba.co.uk",           "Admin@123"),
    "super":       ("superadmin@taxsimba.co.uk",      "Super@123"),
    "acc_a":       ("accountant.a@taxsimba.co.uk",    "Account@123"),
    "acc_b":       ("accountant.b@taxsimba.co.uk",    "Account@123"),
    "client_a":    QA_CLIENT_A,
    "client_b":    QA_CLIENT_B,
}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def tokens():
    return {k: _login(*v) for k, v in CREDS.items()}


# ------------------------------------------------------- auth / me
class TestAuth:
    def test_login_all_roles(self, tokens):
        assert all(tokens.values())

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@taxsimba.co.uk", "password": "bad"})
        assert r.status_code == 401

    def test_me_and_roles(self, tokens):
        role_map = {"admin": "ADMIN", "super": "SUPER_ADMIN", "acc_a": "ACCOUNTANT",
                    "acc_b": "ACCOUNTANT", "client_a": "CLIENT", "client_b": "CLIENT"}
        for k, expected in role_map.items():
            r = requests.get(f"{API}/auth/me", headers=_hdr(tokens[k]))
            assert r.status_code == 200
            assert r.json()["role"] == expected


# ------------------------------------------------------- full workflow on a fresh case
@pytest.fixture(scope="module")
def new_case(tokens):
    # find Client B user id
    r = requests.get(f"{API}/users?role=CLIENT&email={CREDS['client_b'][0]}", headers=_hdr(tokens["super"]))
    assert r.status_code == 200
    client_b = next(u for u in r.json() if u["email"] == CREDS["client_b"][0])
    r = requests.post(f"{API}/cases",
                      json={"client_user_id": client_b["id"], "tax_year": "2024/25",
                            "service_type": "SELF_ASSESSMENT"},
                      headers=_hdr(tokens["admin"]))
    assert r.status_code == 200, r.text
    case = r.json()
    assert case["status"] == "AWAITING_ASSIGNMENT"
    assert case["assigned_accountant_id"] is None
    return case


class TestWorkflow:
    def test_01_case_in_unassigned_bucket(self, tokens, new_case):
        r = requests.get(f"{API}/cases?bucket=unassigned", headers=_hdr(tokens["admin"]))
        assert r.status_code == 200
        assert any(c["id"] == new_case["id"] for c in r.json())

    def test_02_accountants_workload(self, tokens):
        r = requests.get(f"{API}/accountants/workload", headers=_hdr(tokens["admin"]))
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 2
        acc = data[0]
        for k in ["active_cases", "waiting_client", "due_this_week", "overdue", "availability"]:
            assert k in acc

    def test_03_assign_to_accountant_a(self, tokens, new_case):
        # get accountant A id
        r = requests.get(f"{API}/users?role=ACCOUNTANT", headers=_hdr(tokens["admin"]))
        acc_a = next(u for u in r.json() if u["email"] == CREDS["acc_a"][0])
        new_case["_acc_a_id"] = acc_a["id"]
        r = requests.post(f"{API}/cases/{new_case['id']}/assign",
                          json={"accountant_id": acc_a["id"], "priority": "HIGH",
                                "internal_instructions": "Please prioritise"},
                          headers=_hdr(tokens["admin"]))
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "ASSIGNED"
        assert r.json()["assigned_accountant_id"] == acc_a["id"]

    def test_04_case_in_accountant_a_needs_action(self, tokens, new_case):
        r = requests.get(f"{API}/cases?bucket=needs_my_action", headers=_hdr(tokens["acc_a"]))
        assert r.status_code == 200
        assert any(c["id"] == new_case["id"] for c in r.json())

    def test_05_role_isolation_acc_b_cannot_access(self, tokens, new_case):
        r = requests.get(f"{API}/cases/{new_case['id']}", headers=_hdr(tokens["acc_b"]))
        assert r.status_code == 403
        r = requests.get(f"{API}/cases", headers=_hdr(tokens["acc_b"]))
        assert new_case["id"] not in [c["id"] for c in r.json()]

    def test_06_start_review(self, tokens, new_case):
        r = requests.post(f"{API}/cases/{new_case['id']}/start-review", headers=_hdr(tokens["acc_a"]))
        assert r.status_code == 200
        assert r.json()["status"] == "ACCOUNTANT_REVIEW"

    def test_07_request_from_client(self, tokens, new_case):
        r = requests.post(f"{API}/cases/{new_case['id']}/request-from-client",
                          json={"title": "Upload bank statements",
                                "description": "Please upload all bank statements for 2024/25",
                                "document_required": True, "message": "Thanks!"},
                          headers=_hdr(tokens["acc_a"]))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("task_id")
        new_case["_task_id"] = data["task_id"]
        # case now AWAITING_CLIENT
        c = requests.get(f"{API}/cases/{new_case['id']}", headers=_hdr(tokens["acc_a"])).json()
        assert c["status"] == "AWAITING_CLIENT"

    def test_08_client_sees_task_and_notification(self, tokens, new_case):
        r = requests.get(f"{API}/tasks", headers=_hdr(tokens["client_b"]))
        assert r.status_code == 200
        assert any(t["id"] == new_case["_task_id"] for t in r.json())
        n = requests.get(f"{API}/notifications", headers=_hdr(tokens["client_b"])).json()
        assert any("Upload bank statements" in x.get("title", "") for x in n)

    def test_09_client_uploads_file_completes_task_returns_to_accountant(self, tokens, new_case):
        files = {"file": ("statement.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")}
        data = {"case_id": new_case["id"], "document_type": "Bank Statement",
                "task_id": new_case["_task_id"]}
        r = requests.post(f"{API}/documents/upload", data=data, files=files,
                          headers=_hdr(tokens["client_b"]))
        assert r.status_code == 200, r.text
        # verify task completed and status flipped
        c = requests.get(f"{API}/cases/{new_case['id']}", headers=_hdr(tokens["acc_a"])).json()
        assert c["status"] == "ACCOUNTANT_REVIEW", f"expected back to ACCOUNTANT_REVIEW, got {c['status']}"

    def test_10_client_cannot_see_internal_document(self, tokens, new_case):
        # accountant uploads internal working document
        files = {"file": ("working.xlsx", io.BytesIO(b"x"), "application/vnd.ms-excel")}
        data = {"case_id": new_case["id"], "document_type": "Working Paper", "is_internal": "true"}
        r = requests.post(f"{API}/documents/upload", data=data, files=files,
                          headers=_hdr(tokens["acc_a"]))
        assert r.status_code == 200
        internal_doc_id = r.json()["id"]
        # client should NOT see it
        docs = requests.get(f"{API}/documents", headers=_hdr(tokens["client_b"])).json()
        assert not any(d["id"] == internal_doc_id for d in docs)
        # client download attempt should 403
        r = requests.get(f"{API}/documents/{internal_doc_id}/download", headers=_hdr(tokens["client_b"]))
        assert r.status_code == 403

    def test_11_create_calc_v1(self, tokens, new_case):
        r = requests.post(f"{API}/cases/{new_case['id']}/calculations",
                          json={"total_income": 50000, "taxable_income": 37430,
                                "tax_due": 7486, "notes": "V1"},
                          headers=_hdr(tokens["acc_a"]))
        assert r.status_code == 200
        new_case["_v1_id"] = r.json()["id"]
        assert r.json()["version"] == 1

    def test_12_submit_blocks_on_incomplete_checklist(self, tokens, new_case):
        r = requests.post(f"{API}/cases/{new_case['id']}/submit-for-admin-review",
                          json={"calculation_version_id": new_case["_v1_id"],
                                "checklist": {"client_information_reviewed": True}},
                          headers=_hdr(tokens["acc_a"]))
        assert r.status_code == 400
        assert "Checklist incomplete" in r.json()["detail"]

    def test_13_submit_full_checklist(self, tokens, new_case):
        checklist = {k: True for k in ["client_information_reviewed", "required_documents_reviewed",
                                       "income_checked", "allowable_expenses_checked",
                                       "tax_calculation_checked", "supporting_documents_attached",
                                       "return_ready"]}
        r = requests.post(f"{API}/cases/{new_case['id']}/submit-for-admin-review",
                          json={"calculation_version_id": new_case["_v1_id"], "checklist": checklist},
                          headers=_hdr(tokens["acc_a"]))
        assert r.status_code == 200

    def test_14_client_cannot_see_unapproved_calc(self, tokens, new_case):
        r = requests.get(f"{API}/cases/{new_case['id']}/calculations", headers=_hdr(tokens["client_b"]))
        assert r.status_code == 200
        assert r.json() == []  # v1 not yet approved

    def test_15_admin_return_for_changes(self, tokens, new_case):
        r = requests.post(f"{API}/cases/{new_case['id']}/admin-return",
                          json={"reason": "Please double check expenses",
                                "instructions": "Re-check line 7 allowable expenses"},
                          headers=_hdr(tokens["admin"]))
        assert r.status_code == 200
        c = requests.get(f"{API}/cases/{new_case['id']}", headers=_hdr(tokens["acc_a"])).json()
        assert c["status"] == "CHANGES_REQUIRED"

    def test_16_v1_locked_and_v2(self, tokens, new_case):
        # V1 should be locked
        calcs = requests.get(f"{API}/cases/{new_case['id']}/calculations",
                             headers=_hdr(tokens["acc_a"])).json()
        v1 = next(c for c in calcs if c["version"] == 1)
        assert v1["is_locked"] is True
        # Create V2
        r = requests.post(f"{API}/cases/{new_case['id']}/calculations",
                          json={"total_income": 50000, "taxable_income": 36000,
                                "tax_due": 7200, "notes": "V2"},
                          headers=_hdr(tokens["acc_a"]))
        assert r.status_code == 200
        assert r.json()["version"] == 2
        new_case["_v2_id"] = r.json()["id"]

    def test_17_resubmit_and_admin_approve(self, tokens, new_case):
        checklist = {k: True for k in ["client_information_reviewed", "required_documents_reviewed",
                                       "income_checked", "allowable_expenses_checked",
                                       "tax_calculation_checked", "supporting_documents_attached",
                                       "return_ready"]}
        r = requests.post(f"{API}/cases/{new_case['id']}/submit-for-admin-review",
                          json={"calculation_version_id": new_case["_v2_id"], "checklist": checklist},
                          headers=_hdr(tokens["acc_a"]))
        assert r.status_code == 200
        r = requests.post(f"{API}/cases/{new_case['id']}/admin-approve",
                          headers=_hdr(tokens["admin"]))
        assert r.status_code == 200
        assert r.json()["status"] == "AWAITING_CLIENT_APPROVAL"

    def test_18_client_sees_only_approved_v2(self, tokens, new_case):
        r = requests.get(f"{API}/cases/{new_case['id']}/calculations",
                         headers=_hdr(tokens["client_b"]))
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 1
        assert data[0]["version"] == 2
        assert data[0]["tax_due"] == 7200

    def test_19_client_approve_ready_for_submission(self, tokens, new_case):
        r = requests.post(f"{API}/cases/{new_case['id']}/client-approve",
                          headers=_hdr(tokens["client_b"]))
        assert r.status_code == 200
        assert r.json()["status"] == "READY_FOR_SUBMISSION"
        # all three views see same status
        for who in ("admin", "acc_a", "client_b"):
            c = requests.get(f"{API}/cases/{new_case['id']}", headers=_hdr(tokens[who])).json()
            assert c["status"] == "READY_FOR_SUBMISSION"

    def test_20_activity_timeline_populated(self, tokens, new_case):
        r = requests.get(f"{API}/cases/{new_case['id']}/activity", headers=_hdr(tokens["admin"]))
        assert r.status_code == 200
        acts = r.json()
        assert len(acts) >= 8
        for a in acts:
            assert a.get("action") and a.get("user_name") and a.get("role") and a.get("created_at")


# ------------------------------------------------------- stats + isolation + super admin
class TestStatsAndAdmin:
    def test_admin_stats_shape(self, tokens):
        r = requests.get(f"{API}/stats/admin", headers=_hdr(tokens["admin"]))
        assert r.status_code == 200
        for k in ["new", "unassigned", "in_progress", "waiting_client", "admin_review",
                  "client_approval", "ready_submission", "overdue"]:
            assert k in r.json()

    def test_accountant_stats_shape(self, tokens):
        r = requests.get(f"{API}/stats/accountant", headers=_hdr(tokens["acc_a"]))
        assert r.status_code == 200
        for k in ["needs_my_action", "due_today", "due_week", "awaiting_client",
                  "ready_for_admin", "admin_changes", "completed"]:
            assert k in r.json()

    def test_client_cannot_hit_admin_stats(self, tokens):
        r = requests.get(f"{API}/stats/admin", headers=_hdr(tokens["client_a"]))
        assert r.status_code == 403

    def test_notifications_and_mark_all_read(self, tokens):
        r = requests.get(f"{API}/notifications", headers=_hdr(tokens["acc_a"]))
        assert r.status_code == 200
        requests.post(f"{API}/notifications/read-all", headers=_hdr(tokens["acc_a"]))
        r2 = requests.get(f"{API}/notifications", headers=_hdr(tokens["acc_a"])).json()
        assert all(n["is_read"] for n in r2)

    def test_super_admin_creates_user(self, tokens):
        email = f"TEST_new_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{API}/users",
                          json={"email": email, "password": "Test@1234",
                                "name": "TEST New Accountant", "role": "ACCOUNTANT"},
                          headers=_hdr(tokens["super"]))
        assert r.status_code == 200, r.text
        uid = r.json()["id"]
        # can login
        r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": "Test@1234"})
        assert r2.status_code == 200
        # toggle inactive
        r3 = requests.patch(f"{API}/users/{uid}/active?is_active=false", headers=_hdr(tokens["super"]))
        assert r3.status_code == 200
        r4 = requests.post(f"{API}/auth/login", json={"email": email, "password": "Test@1234"})
        assert r4.status_code == 401

    def test_admin_cannot_create_user(self, tokens):
        r = requests.post(f"{API}/users",
                          json={"email": "TEST_x@example.com", "password": "x", "name": "x",
                                "role": "CLIENT"},
                          headers=_hdr(tokens["admin"]))
        assert r.status_code == 403

    def test_audit_log_and_workflow_settings(self, tokens):
        r = requests.get(f"{API}/audit-log", headers=_hdr(tokens["super"]))
        assert r.status_code == 200 and isinstance(r.json(), list)
        r = requests.get(f"{API}/workflow/settings", headers=_hdr(tokens["admin"]))
        assert r.status_code == 200 and "meta" in r.json()
