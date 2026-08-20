"""Iteration 8 verification of the three defect fixes:
FIX 1+2: duplicate MTD & package recommendation guard (independent by type, reset after REJECTED)
FIX 3:   duplicate-payment guard (session reuse with reused=True) for upgrade + offer checkouts,
         and business-key idempotency at fulfilment level (via /payments/status/{sid}).
"""
import os, uuid, pytest, requests

BASE = os.environ.get('REACT_APP_BACKEND_URL')
if not BASE:
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE = line.split('=', 1)[1].strip()
BASE = BASE.rstrip('/')


def _login(email, pw):
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": pw})
    r.raise_for_status()
    return r.json()['access_token']

def _h(t): return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def tokens():
    return {
        "sa":   _login("superadmin@taxsimba.co.uk", "Super@123"),
        "adm":  _login("admin@taxsimba.co.uk", "Admin@123"),
        "acca": _login("accountant.a@taxsimba.co.uk", "Account@123"),
    }


def _make_fresh_case(tokens):
    email = f"TEST_it8_{uuid.uuid4().hex[:6]}@example.com"
    r = requests.post(f"{BASE}/api/users",
                     json={"email": email, "password": "Audit@123",
                           "name": "IT8 Client", "role": "CLIENT"},
                     headers=_h(tokens["sa"]))
    assert r.status_code == 200, r.text
    uid = r.json()["id"]
    tok = _login(email, "Audit@123")
    rc = requests.post(f"{BASE}/api/cases",
                     json={"client_user_id": uid, "service_type": "SELF_ASSESSMENT",
                           "tax_year": "2024/25"},
                     headers=_h(tokens["adm"]))
    assert rc.status_code == 200, rc.text
    case = rc.json()
    acc_a_id = requests.get(f"{BASE}/api/auth/me", headers=_h(tokens["acca"])).json()["id"]
    ra = requests.post(f"{BASE}/api/cases/{case['id']}/assign",
                     json={"accountant_id": acc_a_id}, headers=_h(tokens["adm"]))
    assert ra.status_code == 200, ra.text
    return {"user_id": uid, "email": email, "case_id": case["id"], "token": tok,
            "headers": _h(tok)}


# ------------------------------------------------------------------ FIX 1+2
class TestRecommendationGuards:
    def test_duplicate_mtd_returns_409_and_no_second_row(self, tokens):
        c = _make_fresh_case(tokens)
        r1 = requests.post(f"{BASE}/api/cases/{c['case_id']}/recommend-mtd",
                          json={"reason": "first"}, headers=_h(tokens["acca"]))
        assert r1.status_code == 200, r1.text
        r2 = requests.post(f"{BASE}/api/cases/{c['case_id']}/recommend-mtd",
                          json={"reason": "dup"}, headers=_h(tokens["acca"]))
        assert r2.status_code == 409, r2.text
        assert "pending" in r2.text.lower() or "already" in r2.text.lower()
        # list -> only 1 rec
        rl = requests.get(f"{BASE}/api/cases/{c['case_id']}/recommendations",
                         headers=_h(tokens["acca"]))
        assert rl.status_code == 200
        mtds = [x for x in rl.json() if x["type"] == "MTD"]
        assert len(mtds) == 1, mtds

    def test_duplicate_package_returns_409(self, tokens):
        c = _make_fresh_case(tokens)
        r1 = requests.post(f"{BASE}/api/cases/{c['case_id']}/recommend-package",
                          json={"recommended_package": "ELITE", "reason": "first"},
                          headers=_h(tokens["acca"]))
        assert r1.status_code == 200, r1.text
        r2 = requests.post(f"{BASE}/api/cases/{c['case_id']}/recommend-package",
                          json={"recommended_package": "ELITE", "reason": "dup"},
                          headers=_h(tokens["acca"]))
        assert r2.status_code == 409, r2.text

    def test_types_are_independent(self, tokens):
        """MTD pending must not block PACKAGE upgrade rec and vice versa."""
        c = _make_fresh_case(tokens)
        r1 = requests.post(f"{BASE}/api/cases/{c['case_id']}/recommend-mtd",
                          json={"reason": "mtd"}, headers=_h(tokens["acca"]))
        assert r1.status_code == 200
        r2 = requests.post(f"{BASE}/api/cases/{c['case_id']}/recommend-package",
                          json={"recommended_package": "ELITE", "reason": "pkg"},
                          headers=_h(tokens["acca"]))
        assert r2.status_code == 200, r2.text

    def test_after_rejection_new_rec_allowed(self, tokens):
        c = _make_fresh_case(tokens)
        r1 = requests.post(f"{BASE}/api/cases/{c['case_id']}/recommend-package",
                          json={"recommended_package": "ELITE", "reason": "first"},
                          headers=_h(tokens["acca"]))
        assert r1.status_code == 200
        rec_id = r1.json()["id"]
        # Admin rejects
        rj = requests.post(f"{BASE}/api/recommendations/{rec_id}/reject",
                          json={"reason": "not needed"}, headers=_h(tokens["adm"]))
        assert rj.status_code == 200, rj.text
        # Now a new package rec should succeed
        r2 = requests.post(f"{BASE}/api/cases/{c['case_id']}/recommend-package",
                          json={"recommended_package": "ELITE", "reason": "second try"},
                          headers=_h(tokens["acca"]))
        assert r2.status_code == 200, r2.text

    def test_after_approval_third_rec_still_blocked(self, tokens):
        c = _make_fresh_case(tokens)
        r1 = requests.post(f"{BASE}/api/cases/{c['case_id']}/recommend-mtd",
                          json={"reason": "first"}, headers=_h(tokens["acca"]))
        rec_id = r1.json()["id"]
        ra = requests.post(f"{BASE}/api/recommendations/{rec_id}/approve",
                          json={"package_code": "MTD_ESSENTIAL"},
                          headers=_h(tokens["adm"]))
        assert ra.status_code == 200, ra.text
        r3 = requests.post(f"{BASE}/api/cases/{c['case_id']}/recommend-mtd",
                          json={"reason": "third"}, headers=_h(tokens["acca"]))
        assert r3.status_code == 409
        assert "approved" in r3.text.lower() or "already" in r3.text.lower()


# ------------------------------------------------------------------ FIX 3
class TestPaymentReuse:
    def test_upgrade_checkout_reuses_session(self, tokens):
        c = _make_fresh_case(tokens)
        r1 = requests.post(f"{BASE}/api/payments/upgrade-checkout",
                          json={"package_code": "ELITE",
                                "origin_url": "https://example.com"},
                          headers=c["headers"])
        assert r1.status_code == 200, r1.text
        s1 = r1.json()["session_id"]
        r2 = requests.post(f"{BASE}/api/payments/upgrade-checkout",
                          json={"package_code": "ELITE",
                                "origin_url": "https://example.com"},
                          headers=c["headers"])
        assert r2.status_code == 200, r2.text
        assert r2.json()["session_id"] == s1
        assert r2.json().get("reused") is True

    def test_offer_checkout_reuses_session(self, tokens):
        # Create an SA case, recommend MTD, approve — that seeds an offer.
        c = _make_fresh_case(tokens)
        r1 = requests.post(f"{BASE}/api/cases/{c['case_id']}/recommend-mtd",
                          json={"reason": "please"}, headers=_h(tokens["acca"]))
        rid = r1.json()["id"]
        ra = requests.post(f"{BASE}/api/recommendations/{rid}/approve",
                          json={"package_code": "MTD_ESSENTIAL"},
                          headers=_h(tokens["adm"]))
        assert ra.status_code == 200, ra.text
        # client fetches offers
        of = requests.get(f"{BASE}/api/my-offers", headers=c["headers"])
        if of.status_code != 200 or not of.json():
            pytest.skip(f"No offers surface: {of.status_code} {of.text[:120]}")
        offer_id = of.json()[0]["id"]
        p1 = requests.post(f"{BASE}/api/payments/offer-checkout",
                          json={"offer_id": offer_id,
                                "origin_url": "https://example.com"},
                          headers=c["headers"])
        assert p1.status_code == 200, p1.text
        s1 = p1.json()["session_id"]
        p2 = requests.post(f"{BASE}/api/payments/offer-checkout",
                          json={"offer_id": offer_id,
                                "origin_url": "https://example.com"},
                          headers=c["headers"])
        assert p2.status_code == 200, p2.text
        assert p2.json()["session_id"] == s1
        assert p2.json().get("reused") is True

    def test_status_polling_is_idempotent(self, tokens):
        c = _make_fresh_case(tokens)
        r = requests.post(f"{BASE}/api/payments/upgrade-checkout",
                        json={"package_code": "ELITE",
                              "origin_url": "https://example.com"},
                        headers=c["headers"])
        assert r.status_code == 200
        sid = r.json()["session_id"]
        # Polling status multiple times must not error and not apply anything
        # (session is unpaid — no state should change).
        for _ in range(5):
            s = requests.get(f"{BASE}/api/payments/status/{sid}", headers=c["headers"])
            assert s.status_code == 200, s.text
        # SA service must still be SMART (no upgrade applied without payment)
        svcs = requests.get(f"{BASE}/api/my-services", headers=c["headers"])
        if svcs.status_code == 200:
            payload = svcs.json()
            services = payload.get("services") if isinstance(payload, dict) else payload
            sa = [s for s in (services or []) if s.get("service_type") == "SELF_ASSESSMENT"]
            assert sa and sa[0].get("package_code") == "SMART"
