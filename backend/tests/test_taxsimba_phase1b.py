"""TaxSimba Phase 1B – multi-service accounts, upgrades, MTD recs, payments.

No live card is charged here; Stripe checkout session creation is verified but the
actual card payment + post-payment fulfilment is exercised via the frontend browser run.
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else \
    open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip()
API = f"{BASE_URL}/api"

from qa_clients import QA_CLIENT_A, QA_CLIENT_B  # noqa: E402

CREDS = {
    "admin":    ("admin@taxsimba.co.uk",        "Admin@123"),
    "super":    ("superadmin@taxsimba.co.uk",   "Super@123"),
    "acc_a":    ("accountant.a@taxsimba.co.uk", "Account@123"),
    "acc_b":    ("accountant.b@taxsimba.co.uk", "Account@123"),
    "client_a": QA_CLIENT_A,
    "client_b": QA_CLIENT_B,
}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _hdr(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def tokens():
    return {k: _login(*v) for k, v in CREDS.items()}


# ------------------------------------------------------- multi-service
class TestMultiService:
    def test_my_services_client_b(self, tokens):
        r = requests.get(f"{API}/my-services", headers=_hdr(tokens["client_b"]))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("client_ref", "").startswith("CL-")
        services = {s["service_type"]: s for s in data["services"]}
        assert "SELF_ASSESSMENT" in services and "MTD_INCOME_TAX" in services
        sa = services["SELF_ASSESSMENT"]
        assert sa["status"] == "ACTIVE"
        assert sa["package_code"] in ("SMART", "SIMPLE", "ELITE")
        assert isinstance(sa.get("cases"), list) and len(sa["cases"]) >= 1
        assert services["MTD_INCOME_TAX"]["status"] in ("NOT_ACTIVE", "ACTIVE")

    def test_admin_view_client_services(self, tokens):
        # find client B user_id
        r = requests.get(f"{API}/users?email={QA_CLIENT_B[0]}", headers=_hdr(tokens["super"]))
        assert r.status_code == 200
        cb_uid = next(u["id"] for u in r.json() if u["email"] == QA_CLIENT_B[0])
        r = requests.get(f"{API}/clients/{cb_uid}/services", headers=_hdr(tokens["admin"]))
        assert r.status_code == 200
        data = r.json()
        assert data["client_ref"].startswith("CL-")
        assert any(s["service_type"] == "SELF_ASSESSMENT" for s in data["services"])

    def test_accountant_cannot_read_client_services(self, tokens):
        r = requests.get(f"{API}/users?email={QA_CLIENT_B[0]}", headers=_hdr(tokens["super"]))
        cb_uid = next(u["id"] for u in r.json() if u["email"] == QA_CLIENT_B[0])
        r = requests.get(f"{API}/clients/{cb_uid}/services", headers=_hdr(tokens["acc_a"]))
        assert r.status_code == 403

    def test_accountant_cannot_read_my_services(self, tokens):
        r = requests.get(f"{API}/my-services", headers=_hdr(tokens["acc_a"]))
        assert r.status_code == 403


# ------------------------------------------------------- upgrade options / downgrade rejection
class TestUpgradeOptions:
    def test_client_b_upgrade_options(self, tokens):
        r = requests.get(f"{API}/my-upgrade-options", headers=_hdr(tokens["client_b"]))
        assert r.status_code == 200, r.text
        data = r.json()
        cur = data["current_package"]
        assert cur is not None
        # Every option must be strictly higher priced than current
        for opt in data["options"]:
            assert opt["upgrade_price"] > cur["price"]
            assert opt["current_package_credit"] == cur["price"]
            assert opt["additional_amount_payable"] == round(opt["upgrade_price"] - cur["price"], 2)
            assert opt["total_due_now"] == opt["additional_amount_payable"]

    def test_downgrade_checkout_rejected(self, tokens):
        # Attempt to "downgrade" to SIMPLE (which is <= SMART/ELITE)
        r = requests.post(f"{API}/payments/upgrade-checkout",
                          headers=_hdr(tokens["client_b"]),
                          json={"package_code": "SIMPLE",
                                "origin_url": "https://example.com"})
        assert r.status_code == 400

    def test_equal_package_checkout_rejected(self, tokens):
        cur = requests.get(f"{API}/my-upgrade-options", headers=_hdr(tokens["client_b"])).json()["current_package"]
        r = requests.post(f"{API}/payments/upgrade-checkout",
                          headers=_hdr(tokens["client_b"]),
                          json={"package_code": cur["code"],
                                "origin_url": "https://example.com"})
        assert r.status_code == 400


# ------------------------------------------------------- late-stage lock (Client A COMPLETED)
class TestLock:
    def test_client_a_locked(self, tokens):
        r = requests.get(f"{API}/my-upgrade-options", headers=_hdr(tokens["client_a"]))
        assert r.status_code == 200
        data = r.json()
        assert data["locked"] is True
        assert data["lock_reason"]

    def test_client_a_upgrade_blocked(self, tokens):
        r = requests.post(f"{API}/payments/upgrade-checkout",
                          headers=_hdr(tokens["client_a"]),
                          json={"package_code": "ELITE", "origin_url": "https://example.com"})
        assert r.status_code == 400

    def test_lock_settings_readable_admin(self, tokens):
        r = requests.get(f"{API}/settings/package-lock", headers=_hdr(tokens["admin"]))
        assert r.status_code == 200
        assert isinstance(r.json().get("locked_statuses"), list)

    def test_lock_settings_admin_cannot_patch(self, tokens):
        r = requests.patch(f"{API}/settings/package-lock", headers=_hdr(tokens["admin"]),
                           json={"locked_statuses": ["COMPLETED"]})
        assert r.status_code == 403

    def test_lock_settings_super_admin_patch(self, tokens):
        current = requests.get(f"{API}/settings/package-lock", headers=_hdr(tokens["super"])).json()["locked_statuses"]
        r = requests.patch(f"{API}/settings/package-lock", headers=_hdr(tokens["super"]),
                           json={"locked_statuses": current})
        assert r.status_code == 200


# ------------------------------------------------------- upgrade checkout session creation
class TestUpgradeCheckoutCreates:
    def test_upgrade_checkout_creates_session(self, tokens):
        r = requests.post(f"{API}/payments/upgrade-checkout",
                          headers=_hdr(tokens["client_b"]),
                          json={"package_code": "ELITE", "origin_url": BASE_URL})
        # If client B is already ELITE this returns 400; skip in that case
        if r.status_code == 400:
            pytest.skip("Client B already ELITE or in locked state")
        assert r.status_code == 200, r.text
        js = r.json()
        assert js["checkout_url"].startswith("https://")
        assert js["session_id"]
        assert js["amount"] > 0


# ------------------------------------------------------- recommendations
@pytest.fixture(scope="module")
def client_b_case_id(tokens):
    """A case assigned to accountant.b for Client B for recommendation tests."""
    r = requests.get(f"{API}/cases", headers=_hdr(tokens["acc_b"]))
    assert r.status_code == 200
    cases = [c for c in r.json() if c.get("client_name", "").lower().startswith("client b")
             and c["status"] not in ("COMPLETED",)]
    if cases:
        return cases[0]["id"]
    # else create one via admin
    r = requests.get(f"{API}/users?email={QA_CLIENT_B[0]}", headers=_hdr(tokens["super"]))
    cb_uid = next(u["id"] for u in r.json() if u["email"] == QA_CLIENT_B[0])
    r2 = requests.get(f"{API}/users?email=accountant.b@taxsimba.co.uk", headers=_hdr(tokens["super"]))
    acc_b_id = next(u["id"] for u in r2.json() if u["email"] == "accountant.b@taxsimba.co.uk")
    r = requests.post(f"{API}/cases", headers=_hdr(tokens["admin"]),
                      json={"client_user_id": cb_uid, "tax_year": "2024/25",
                            "service_type": "SELF_ASSESSMENT", "priority": "MEDIUM"})
    assert r.status_code in (200, 201), r.text
    cid = r.json()["id"]
    requests.post(f"{API}/cases/{cid}/assign", headers=_hdr(tokens["admin"]),
                  json={"accountant_id": acc_b_id})
    return cid


class TestRecommendations:
    def test_recommend_package_upgrade(self, tokens, client_b_case_id):
        # Choose a package strictly higher than the client's current one
        svc = requests.get(f"{API}/my-services", headers=_hdr(tokens["client_b"])).json()
        cur_code = next(s for s in svc["services"] if s["service_type"] == "SELF_ASSESSMENT")["package_code"]
        rank = {"SIMPLE": 1, "SMART": 2, "ELITE": 3}
        higher = [c for c, r in rank.items() if r > rank.get(cur_code, 0)]
        if not higher:
            pytest.skip(f"Client already on highest package ({cur_code})")
        target = higher[0]
        r = requests.post(f"{API}/cases/{client_b_case_id}/recommend-package",
                          headers=_hdr(tokens["acc_b"]),
                          json={"recommended_package": target,
                                "reason": "Complex return needs upgrade",
                                "note": "Two rental properties"})
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["status"] == "PENDING"
        # accountant sees no client_user_id/email etc.
        for f in ("client_user_id", "client_email", "email", "phone", "utr", "address"):
            assert f not in rec, f"accountant leak: {f}"

    def test_recommend_package_downgrade_rejected(self, tokens, client_b_case_id):
        # Attempt a strictly lower or equal package
        svc = requests.get(f"{API}/my-services", headers=_hdr(tokens["client_b"])).json()
        cur_code = next(s for s in svc["services"] if s["service_type"] == "SELF_ASSESSMENT")["package_code"]
        rank = {"SIMPLE": 1, "SMART": 2, "ELITE": 3}
        lower = [c for c, r in rank.items() if r <= rank.get(cur_code, 0)]
        target = lower[0] if lower else "SIMPLE"
        r = requests.post(f"{API}/cases/{client_b_case_id}/recommend-package",
                          headers=_hdr(tokens["acc_b"]),
                          json={"recommended_package": target,
                                "reason": "Try to downgrade"})
        if r.status_code == 409:
            # The duplicate-recommendation guard fires before the downgrade check when a
            # package recommendation is already pending on this case.
            pytest.skip("a package recommendation is already pending on this case")
        assert r.status_code == 400

    def test_recommend_mtd(self, tokens, client_b_case_id):
        r = requests.post(f"{API}/cases/{client_b_case_id}/recommend-mtd",
                          headers=_hdr(tokens["acc_b"]),
                          json={"reason": "Turnover > £50k",
                                "note": "MTD from next year"})
        # 200 on first recommendation, 409 if one is already pending/approved on
        # this case (duplicate-recommendation guard).
        assert r.status_code in (200, 409), r.text
        if r.status_code == 200:
            assert r.json()["type"] == "MTD"

    def test_accountant_403_on_admin_endpoints(self, tokens, client_b_case_id):
        assert requests.get(f"{API}/recommendations",
                            headers=_hdr(tokens["acc_a"])).status_code == 403
        # fake id ok — it will 403 on role check first
        assert requests.post(f"{API}/recommendations/x/send-offer",
                             headers=_hdr(tokens["acc_a"]),
                             json={"package_code": "MTD_PLUS"}).status_code == 403
        assert requests.get(f"{API}/payments",
                            headers=_hdr(tokens["acc_a"])).status_code == 403
        assert requests.get(f"{API}/my-payments",
                            headers=_hdr(tokens["acc_a"])).status_code == 403
        # patch pricing – need a real package id
        packages = requests.get(f"{API}/packages", headers=_hdr(tokens["admin"])).json()
        pid = packages[0]["id"]
        assert requests.patch(f"{API}/packages/{pid}/price",
                              headers=_hdr(tokens["acc_a"]),
                              json={"price": 999}).status_code == 403

    def test_accountant_case_list_privacy(self, tokens):
        r = requests.get(f"{API}/cases", headers=_hdr(tokens["acc_b"]))
        assert r.status_code == 200
        for c in r.json():
            for f in ("client_email", "client_phone", "client_user_id", "email", "phone",
                      "utr", "address", "password_hash", "stripe_payment_intent_id", "session_id"):
                assert f not in c, f"accountant sees leaked field '{f}' in /cases"


# ------------------------------------------------------- admin offer flow
class TestAdminOffer:
    def test_send_mtd_offer_and_decline_workflow(self, tokens, client_b_case_id):
        # ensure a fresh MTD recommendation exists
        mk = requests.post(f"{API}/cases/{client_b_case_id}/recommend-mtd",
                           headers=_hdr(tokens["acc_b"]),
                           json={"reason": "MTD offer test", "note": "n/a"})
        if mk.status_code == 409 and "approved" in mk.text.lower():
            # MTD is already approved on this seed case, so no new PENDING MTD
            # recommendation can be raised to drive the offer flow.
            pytest.skip("MTD recommendation already approved on this case")
        recs = requests.get(f"{API}/recommendations?status=PENDING",
                            headers=_hdr(tokens["admin"])).json()
        mtd_rec = next((x for x in recs if x["type"] == "MTD"
                        and x["case_id"] == client_b_case_id), None)
        if mtd_rec is None:
            pytest.skip("no pending MTD recommendation available on this case")
        r = requests.post(f"{API}/recommendations/{mtd_rec['id']}/send-offer",
                          headers=_hdr(tokens["admin"]),
                          json={"package_code": "MTD_PLUS", "price": 360,
                                "credit": 0, "message": "Please add MTD"})
        assert r.status_code == 200, r.text
        offer = r.json()
        assert offer["amount_due"] == 360
        assert offer["status"] == "PENDING"
        # rec now OFFER_SENT
        r2 = requests.get(f"{API}/recommendations", headers=_hdr(tokens["admin"]))
        target = next(x for x in r2.json() if x["id"] == mtd_rec["id"])
        assert target["status"] in ("OFFER_SENT", "APPROVED")

        # client sees the offer in /my-offers
        offers = requests.get(f"{API}/my-offers", headers=_hdr(tokens["client_b"])).json()
        assert any(o["id"] == offer["id"] for o in offers)

    def test_offer_checkout_session(self, tokens):
        offers = requests.get(f"{API}/my-offers", headers=_hdr(tokens["client_b"])).json()
        if not offers:
            pytest.skip("no offer available")
        r = requests.post(f"{API}/payments/offer-checkout",
                          headers=_hdr(tokens["client_b"]),
                          json={"offer_id": offers[0]["id"], "origin_url": BASE_URL})
        assert r.status_code == 200, r.text
        js = r.json()
        assert js["checkout_url"].startswith("https://")
        assert js["session_id"]

    def test_decline_recommendation(self, tokens, client_b_case_id):
        requests.post(f"{API}/cases/{client_b_case_id}/recommend-package",
                      headers=_hdr(tokens["acc_b"]),
                      json={"recommended_package": "ELITE", "reason": "for decline"})
        recs = requests.get(f"{API}/recommendations?status=PENDING",
                            headers=_hdr(tokens["admin"])).json()
        pkg_rec = next((x for x in recs if x["type"] == "PACKAGE_UPGRADE"
                        and x["case_id"] == client_b_case_id), None)
        if not pkg_rec:
            pytest.skip("no pending package rec")
        r = requests.post(f"{API}/recommendations/{pkg_rec['id']}/decline",
                          headers=_hdr(tokens["admin"]),
                          json={"reason": "Not needed", "recommended_package": None})
        assert r.status_code == 200


# ------------------------------------------------------- admin override
class TestOverride:
    def test_override_requires_reason(self, tokens):
        r = requests.get(f"{API}/users?email={QA_CLIENT_B[0]}", headers=_hdr(tokens["super"]))
        cb_uid = next(u["id"] for u in r.json() if u["email"] == QA_CLIENT_B[0])
        r = requests.post(f"{API}/clients/{cb_uid}/override-package",
                          headers=_hdr(tokens["admin"]),
                          json={"package_code": "SIMPLE", "reason": " "})
        assert r.status_code == 400

    def test_override_accountant_forbidden(self, tokens):
        r = requests.get(f"{API}/users?email={QA_CLIENT_B[0]}", headers=_hdr(tokens["super"]))
        cb_uid = next(u["id"] for u in r.json() if u["email"] == QA_CLIENT_B[0])
        r = requests.post(f"{API}/clients/{cb_uid}/override-package",
                          headers=_hdr(tokens["acc_a"]),
                          json={"package_code": "SIMPLE", "reason": "test"})
        assert r.status_code == 403

    def test_override_success(self, tokens):
        r = requests.get(f"{API}/users?email={QA_CLIENT_B[0]}", headers=_hdr(tokens["super"]))
        cb_uid = next(u["id"] for u in r.json() if u["email"] == QA_CLIENT_B[0])
        # get current package
        svc = requests.get(f"{API}/clients/{cb_uid}/services",
                           headers=_hdr(tokens["admin"])).json()
        sa = next(s for s in svc["services"] if s["service_type"] == "SELF_ASSESSMENT")
        cur = sa["package_code"]
        target = "SIMPLE" if cur != "SIMPLE" else "SMART"
        r = requests.post(f"{API}/clients/{cb_uid}/override-package",
                          headers=_hdr(tokens["admin"]),
                          json={"package_code": target, "reason": "Test override"})
        assert r.status_code == 200, r.text
        assert r.json()["package_code"] == target
        # revert
        requests.post(f"{API}/clients/{cb_uid}/override-package",
                      headers=_hdr(tokens["admin"]),
                      json={"package_code": cur, "reason": "Revert test override"})


# ------------------------------------------------------- super admin pricing
class TestPricing:
    def test_super_admin_can_patch_price(self, tokens):
        packages = requests.get(f"{API}/packages", headers=_hdr(tokens["admin"])).json()
        p = next(x for x in packages if x["code"] == "MTD_ESSENTIAL")
        original = p["price"]
        r = requests.patch(f"{API}/packages/{p['id']}/price",
                           headers=_hdr(tokens["super"]),
                           json={"price": original + 1})
        assert r.status_code == 200
        # revert
        requests.patch(f"{API}/packages/{p['id']}/price",
                       headers=_hdr(tokens["super"]),
                       json={"price": original})

    def test_admin_cannot_patch_price(self, tokens):
        packages = requests.get(f"{API}/packages", headers=_hdr(tokens["admin"])).json()
        p = packages[0]
        r = requests.patch(f"{API}/packages/{p['id']}/price",
                           headers=_hdr(tokens["admin"]),
                           json={"price": 500})
        assert r.status_code == 403


# ------------------------------------------------------- payments listing
class TestPaymentsListing:
    def test_admin_payments_list(self, tokens):
        r = requests.get(f"{API}/payments", headers=_hdr(tokens["admin"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_client_my_payments(self, tokens):
        r = requests.get(f"{API}/my-payments", headers=_hdr(tokens["client_b"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)
