"""TaxSimba Phase 1B UX correction — scenarios A/B/C/E, /my-actions, /overview,
   assignment history, reopen/unassign, completed-lock, admin filters.

   Payment (Scenario D) is verified via the frontend Playwright run.
"""
import os
import uuid
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or \
    open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip()
API = f"{BASE_URL}/api"

CREDS = {
    "admin":    ("admin@taxsimba.co.uk",        "Admin@123"),
    "super":    ("superadmin@taxsimba.co.uk",   "Super@123"),
    "acc_a":    ("accountant.a@taxsimba.co.uk", "Account@123"),
    "acc_b":    ("accountant.b@taxsimba.co.uk", "Account@123"),
    "client_a": ("clienta@example.com",         "Client@123"),
    "client_b": ("clientb@example.com",         "Client@123"),
}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def tokens():
    return {k: _login(*v) for k, v in CREDS.items()}


# ---------- helper: create a fresh SA-only client via Super Admin + case via Admin
@pytest.fixture(scope="module")
def fresh_sa_client(tokens):
    email = f"ux_test_{uuid.uuid4().hex[:8]}@example.com"
    password = "UxTest@123"
    # create client user via super admin
    r = requests.post(f"{API}/users", headers=_h(tokens["super"]),
                      json={"name": "UX Test Client", "email": email,
                            "password": password, "role": "CLIENT"})
    assert r.status_code in (200, 201), r.text
    uid = r.json()["id"]
    # login as client to get token
    ctok = _login(email, password)
    # admin creates a SA case
    r = requests.post(f"{API}/cases", headers=_h(tokens["admin"]),
                      json={"client_user_id": uid, "tax_year": "2024/25",
                            "service_type": "SELF_ASSESSMENT", "priority": "MEDIUM"})
    assert r.status_code in (200, 201), r.text
    case_id = r.json()["id"]
    return {"email": email, "password": password, "user_id": uid,
            "token": ctok, "case_id": case_id}


# ============================================================ SCENARIO A
class TestScenarioA_SAOnlyClient:
    """A fresh SA-only client sees no MTD anywhere."""

    def test_my_offers_empty(self, fresh_sa_client):
        r = requests.get(f"{API}/my-offers", headers=_h(fresh_sa_client["token"]))
        assert r.status_code == 200
        assert r.json() == []

    def test_my_services_has_sa_only_active(self, fresh_sa_client):
        r = requests.get(f"{API}/my-services", headers=_h(fresh_sa_client["token"]))
        assert r.status_code == 200
        data = r.json()
        svc = {s["service_type"]: s for s in data["services"]}
        assert svc["SELF_ASSESSMENT"]["status"] == "ACTIVE"
        # MTD (if present) must be NOT_ACTIVE
        if "MTD_INCOME_TAX" in svc:
            assert svc["MTD_INCOME_TAX"]["status"] == "NOT_ACTIVE"

    def test_my_actions_no_mtd(self, fresh_sa_client):
        r = requests.get(f"{API}/my-actions", headers=_h(fresh_sa_client["token"]))
        assert r.status_code == 200
        data = r.json()
        for item in data["outstanding"] + data.get("history", []):
            assert item.get("service_type") != "MTD_INCOME_TAX", f"MTD leak in actions: {item}"

    def test_tasks_documents_no_mtd_filter(self, fresh_sa_client):
        for path in ("/tasks", "/documents"):
            r = requests.get(f"{API}{path}", headers=_h(fresh_sa_client["token"]))
            assert r.status_code == 200
            for item in r.json():
                # item may not include service_type; if it does, must be SA
                if "service_type" in item:
                    assert item["service_type"] == "SELF_ASSESSMENT"


# ============================================================ SCENARIO B: reject stays internal
class TestScenarioB_Reject:
    def test_reject_keeps_client_silent(self, tokens, fresh_sa_client):
        # accountant needs to be assigned; admin assigns accountant B to this case
        acc_b_id = next(u["id"] for u in requests.get(f"{API}/users?email=accountant.b@taxsimba.co.uk", headers=_h(tokens["admin"])).json()
                        if u["email"] == "accountant.b@taxsimba.co.uk")
        r = requests.post(f"{API}/cases/{fresh_sa_client['case_id']}/assign",
                          headers=_h(tokens["admin"]),
                          json={"accountant_id": acc_b_id})
        assert r.status_code == 200, r.text
        # accountant recommends MTD
        r = requests.post(f"{API}/cases/{fresh_sa_client['case_id']}/recommend-mtd",
                          headers=_h(tokens["acc_b"]),
                          json={"reason": "Turnover > £50k", "note": "internal only"})
        assert r.status_code == 200, r.text
        rec_id = r.json()["id"]
        # admin rejects
        r = requests.post(f"{API}/recommendations/{rec_id}/reject",
                          headers=_h(tokens["admin"]),
                          json={"reason": "Not needed"})
        assert r.status_code == 200, r.text
        # client sees NOTHING
        offers = requests.get(f"{API}/my-offers", headers=_h(fresh_sa_client["token"])).json()
        assert not any(o.get("recommendation_id") == rec_id for o in offers)
        # actions has no rec of this
        acts = requests.get(f"{API}/my-actions", headers=_h(fresh_sa_client["token"])).json()
        assert not any(a.get("id") == rec_id or a.get("type") == "RECOMMENDATION"
                       and a.get("service_type") == "MTD_INCOME_TAX"
                       for a in acts["outstanding"])
        # recommendation is REJECTED in admin queue
        recs = requests.get(f"{API}/recommendations", headers=_h(tokens["admin"])).json()
        target = next(x for x in recs if x["id"] == rec_id)
        assert target["status"] == "REJECTED"


# ============================================================ SCENARIO C: approve creates client offer
class TestScenarioC_Approve:
    def test_approve_creates_offer_and_double_approve_400(self, tokens, fresh_sa_client):
        # make sure accountant B holds this case before recommending on it
        acc_b_id = next(u["id"] for u in requests.get(f"{API}/users?email=accountant.b@taxsimba.co.uk", headers=_h(tokens["admin"])).json()
                        if u["email"] == "accountant.b@taxsimba.co.uk")
        requests.post(f"{API}/cases/{fresh_sa_client['case_id']}/assign",
                      headers=_h(tokens["admin"]), json={"accountant_id": acc_b_id})
        # create a new MTD recommendation
        r = requests.post(f"{API}/cases/{fresh_sa_client['case_id']}/recommend-mtd",
                          headers=_h(tokens["acc_b"]),
                          json={"reason": "MTD approve scenario", "note": "internal"})
        assert r.status_code == 200, r.text
        rec_id = r.json()["id"]

        # admin approves
        r = requests.post(f"{API}/recommendations/{rec_id}/approve",
                          headers=_h(tokens["admin"]),
                          json={"package_code": "MTD_PLUS", "price": 360, "credit": 0,
                                "explanation": "You now meet the MTD threshold — plain English."})
        assert r.status_code == 200, r.text
        offer = r.json()
        assert offer["service_type"] == "MTD_INCOME_TAX"
        assert offer["status"] == "PENDING"
        assert offer["amount_due"] == 360
        assert "meet the MTD threshold" in (offer.get("explanation") or "")

        # client now sees the recommendation offer
        offers = requests.get(f"{API}/my-offers", headers=_h(fresh_sa_client["token"])).json()
        assert any(o["id"] == offer["id"] for o in offers), "client should see the approved offer"

        # /my-offers/{id} works for the client
        r = requests.get(f"{API}/my-offers/{offer['id']}", headers=_h(fresh_sa_client["token"]))
        assert r.status_code == 200
        assert r.json()["id"] == offer["id"]

        # /my-actions surfaces the RECOMMENDATION action
        acts = requests.get(f"{API}/my-actions", headers=_h(fresh_sa_client["token"])).json()
        assert any(a["type"] == "RECOMMENDATION" and a["id"] == offer["id"]
                   for a in acts["outstanding"])

        # MTD is NOT auto-activated
        svc = requests.get(f"{API}/my-services", headers=_h(fresh_sa_client["token"])).json()
        mtd = next((s for s in svc["services"] if s["service_type"] == "MTD_INCOME_TAX"), None)
        if mtd:
            assert mtd["status"] == "NOT_ACTIVE"

        # double-approve rejected
        r = requests.post(f"{API}/recommendations/{rec_id}/approve",
                          headers=_h(tokens["admin"]),
                          json={"package_code": "MTD_PLUS", "price": 360, "credit": 0,
                                "explanation": "again"})
        assert r.status_code == 400, r.text


# ============================================================ SCENARIO E: accountant privacy
class TestScenarioE_AccountantPrivacy:
    LEAK_FIELDS = ("client_email", "email", "phone", "utr", "address",
                   "password_hash", "stripe_payment_intent_id", "session_id",
                   "payment_intent")

    def _no_leak(self, items):
        for it in items if isinstance(items, list) else [items]:
            if not isinstance(it, dict):
                continue
            for f in self.LEAK_FIELDS:
                assert f not in it, f"accountant leak: {f} in {it}"

    def test_cases_list_no_leak(self, tokens):
        r = requests.get(f"{API}/cases", headers=_h(tokens["acc_b"]))
        assert r.status_code == 200
        self._no_leak(r.json())

    def test_case_detail_no_leak(self, tokens):
        cases = requests.get(f"{API}/cases", headers=_h(tokens["acc_b"])).json()
        if not cases:
            pytest.skip("no cases")
        r = requests.get(f"{API}/cases/{cases[0]['id']}", headers=_h(tokens["acc_b"]))
        assert r.status_code == 200
        self._no_leak(r.json())

    def test_accountant_forbidden_endpoints(self, tokens):
        # each endpoint expects 403 for accountant role
        assert requests.get(f"{API}/users", headers=_h(tokens["acc_a"])).status_code == 403
        assert requests.get(f"{API}/payments", headers=_h(tokens["acc_a"])).status_code == 403
        assert requests.get(f"{API}/my-payments", headers=_h(tokens["acc_a"])).status_code == 403
        assert requests.get(f"{API}/my-services", headers=_h(tokens["acc_a"])).status_code == 403
        assert requests.get(f"{API}/overview", headers=_h(tokens["acc_a"])).status_code == 403
        assert requests.get(f"{API}/recommendations", headers=_h(tokens["acc_a"])).status_code == 403
        assert requests.post(f"{API}/recommendations/x/approve",
                             headers=_h(tokens["acc_a"]), json={"package_code": "MTD_PLUS"}).status_code == 403
        assert requests.post(f"{API}/recommendations/x/reject",
                             headers=_h(tokens["acc_a"]), json={"reason": "x"}).status_code == 403


# ============================================================ /my-actions structure
class TestMyActions:
    def test_client_b_actions_shape(self, tokens):
        r = requests.get(f"{API}/my-actions", headers=_h(tokens["client_b"]))
        assert r.status_code == 200
        data = r.json()
        assert "outstanding" in data and "history" in data
        assert isinstance(data["outstanding"], list)

    def test_accountant_and_admin_forbidden(self, tokens):
        assert requests.get(f"{API}/my-actions", headers=_h(tokens["acc_a"])).status_code == 403
        assert requests.get(f"{API}/my-actions", headers=_h(tokens["admin"])).status_code == 403


# ============================================================ /overview (SUPER_ADMIN only)
class TestOverview:
    def test_super_admin_can_read(self, tokens):
        r = requests.get(f"{API}/overview", headers=_h(tokens["super"]))
        assert r.status_code == 200
        data = r.json()
        assert "clients" in data and "cases" in data and "revenue" in data
        # revenue derived only from paid payment_transactions
        assert "successful_payments" in data["revenue"]
        # numbers must not be negative
        for k in ("this_month", "this_year", "self_assessment", "mtd"):
            assert data["revenue"][k] >= 0
        # cross-check against /payments (admin) to ensure numbers derive from paid txns
        payments = requests.get(f"{API}/payments", headers=_h(tokens["admin"])).json()
        paid_count = sum(1 for p in payments if p.get("payment_status") == "paid")
        assert data["revenue"]["successful_payments"] == paid_count

    def test_admin_forbidden(self, tokens):
        assert requests.get(f"{API}/overview", headers=_h(tokens["admin"])).status_code == 403

    def test_accountant_forbidden(self, tokens):
        assert requests.get(f"{API}/overview", headers=_h(tokens["acc_a"])).status_code == 403


# ============================================================ reopen requires reason
class TestReopen:
    def test_reopen_requires_nonempty_reason(self, tokens):
        # find a COMPLETED case
        cases = requests.get(f"{API}/cases", headers=_h(tokens["admin"])).json()
        completed = next((c for c in cases if c["status"] == "COMPLETED"), None)
        if not completed:
            pytest.skip("no completed case available")
        r = requests.post(f"{API}/cases/{completed['id']}/reopen",
                          headers=_h(tokens["admin"]),
                          json={"reason": "   "})
        assert r.status_code == 400


# ============================================================ unassign + assignment history
class TestUnassignAndAssignments:
    def test_unassign_and_history(self, tokens, fresh_sa_client):
        # ensure assigned
        r = requests.get(f"{API}/cases/{fresh_sa_client['case_id']}", headers=_h(tokens["admin"]))
        assert r.status_code == 200
        case = r.json()
        if not case.get("assigned_accountant_id"):
            pytest.skip("case not assigned yet")
        # unassign
        r = requests.post(f"{API}/cases/{fresh_sa_client['case_id']}/unassign",
                          headers=_h(tokens["admin"]),
                          json={"reason": "Testing unassign"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "AWAITING_ASSIGNMENT"
        # history preserved
        r = requests.get(f"{API}/cases/{fresh_sa_client['case_id']}/assignments",
                         headers=_h(tokens["admin"]))
        assert r.status_code == 200
        assert len(r.json()) >= 1


# ============================================================ admin filters (service_type)
class TestAdminFilters:
    def test_cases_filter_by_service(self, tokens):
        r = requests.get(f"{API}/cases?service_type=SELF_ASSESSMENT", headers=_h(tokens["admin"]))
        assert r.status_code == 200
        for c in r.json():
            assert c["service_type"] == "SELF_ASSESSMENT"


# ============================================================ internal notes 403 for client
class TestInternalNotesPrivacy:
    def test_client_cannot_read_case_notes(self, tokens, fresh_sa_client):
        r = requests.get(f"{API}/cases/{fresh_sa_client['case_id']}/notes",
                         headers=_h(fresh_sa_client["token"]))
        assert r.status_code == 403
