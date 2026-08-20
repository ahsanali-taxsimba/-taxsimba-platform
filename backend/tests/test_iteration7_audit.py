"""Iteration 7 QA AUDIT — targeted defect probes for the areas main agent flagged
plus RBAC/IDOR/workflow-integrity spot checks.

Focus:
  * SECTION 6 duplicate MTD recommendations (suspected defect)
  * SECTION 4 duplicate package recommendations
  * SECTION 7 duplicate-payment protection: two concurrent checkout sessions
  * SECTION 4 downgrade rejection
  * SECTION 2 accountant PII scrub + 403 on admin-only endpoints
  * SECTION 8 IDOR on documents
  * SECTION 3 cross-accountant message access
  * SECTION 9 workflow stage-skip attempts
  * SECTION 2 deactivated-user token rejection
"""
import os, uuid, io, pytest, requests

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


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def tokens():
    return {
        "sa":   _login("superadmin@taxsimba.co.uk", "Super@123"),
        "adm":  _login("admin@taxsimba.co.uk", "Admin@123"),
        "acca": _login("accountant.a@taxsimba.co.uk", "Account@123"),
        "accb": _login("accountant.b@taxsimba.co.uk", "Account@123"),
        "cla":  _login("clienta@example.com", "Client@123"),
        "clb":  _login("clientb@example.com", "Client@123"),
    }


@pytest.fixture(scope="module")
def fresh_client(tokens):
    """SA-only client on SMART; SA case created by admin, assigned to acc_a."""
    email = f"TEST_it7_{uuid.uuid4().hex[:6]}@example.com"
    r = requests.post(f"{BASE}/api/users",
                      json={"email": email, "password": "Audit@123",
                            "name": "IT7 Audit Client", "role": "CLIENT"},
                      headers=_h(tokens["sa"]))
    assert r.status_code == 200, r.text
    uid = r.json()["id"]
    tok = _login(email, "Audit@123")

    # Admin creates SA case (uses client_user_id)
    rc = requests.post(f"{BASE}/api/cases",
                       json={"client_user_id": uid, "service_type": "SELF_ASSESSMENT",
                             "tax_year": "2024/25"},
                       headers=_h(tokens["adm"]))
    assert rc.status_code == 200, rc.text
    case = rc.json()

    # Assign to acc_a
    acc_a_id = requests.get(f"{BASE}/api/auth/me", headers=_h(tokens["acca"])).json()["id"]
    ra = requests.post(f"{BASE}/api/cases/{case['id']}/assign",
                       json={"accountant_id": acc_a_id},
                       headers=_h(tokens["adm"]))
    assert ra.status_code == 200, ra.text

    return {"email": email, "user_id": uid,
            "case_id": case["id"], "case_ref": case["case_ref"],
            "token": tok, "headers": _h(tok)}


# ---------------------------------------------------------------- SECTION 6
class TestDuplicateRecommendations:
    """Suspected defect: no guard preventing second PENDING MTD or PACKAGE rec."""

    def test_duplicate_mtd_recommendation_should_be_rejected(self, fresh_client, tokens):
        cid = fresh_client["case_id"]
        r1 = requests.post(f"{BASE}/api/cases/{cid}/recommend-mtd",
                           json={"reason": "First MTD rec"}, headers=_h(tokens["acca"]))
        assert r1.status_code == 200, r1.text

        r2 = requests.post(f"{BASE}/api/cases/{cid}/recommend-mtd",
                           json={"reason": "Second MTD rec — duplicate"},
                           headers=_h(tokens["acca"]))
        # Expected: 400/409 with duplicate guard. Current code has NO guard.
        assert r2.status_code in (400, 409), \
            f"DEFECT: duplicate MTD recommendation was accepted (status={r2.status_code}, body={r2.text})"

    def test_duplicate_package_recommendation_should_be_rejected(self, fresh_client, tokens):
        cid = fresh_client["case_id"]
        r1 = requests.post(f"{BASE}/api/cases/{cid}/recommend-package",
                           json={"recommended_package": "ELITE", "reason": "First"},
                           headers=_h(tokens["acca"]))
        assert r1.status_code == 200, r1.text

        r2 = requests.post(f"{BASE}/api/cases/{cid}/recommend-package",
                           json={"recommended_package": "ELITE", "reason": "Second"},
                           headers=_h(tokens["acca"]))
        assert r2.status_code in (400, 409), \
            f"DEFECT: duplicate PACKAGE recommendation was accepted (status={r2.status_code}, body={r2.text})"


# ---------------------------------------------------------------- SECTION 4
class TestPackageRules:
    def test_downgrade_rejected(self, tokens):
        # Client A is on SMART. Attempt downgrade to SIMPLE.
        r = requests.post(f"{BASE}/api/payments/upgrade-checkout",
                          json={"package_code": "SIMPLE",
                                "origin_url": "https://example.com"},
                          headers=_h(tokens["cla"]))
        assert r.status_code == 400, f"Downgrade must be rejected, got {r.status_code}"

    def test_equal_package_rejected(self, tokens):
        r = requests.post(f"{BASE}/api/payments/upgrade-checkout",
                          json={"package_code": "SMART",
                                "origin_url": "https://example.com"},
                          headers=_h(tokens["cla"]))
        assert r.status_code == 400


# ---------------------------------------------------------------- SECTION 7
class TestDuplicatePayment:
    """Two concurrent checkout sessions for the same offer/upgrade should not
    both be payable, OR fulfilment must recognise the second as a duplicate and
    refuse to double-activate / double-charge the business state."""

    def test_two_concurrent_upgrade_sessions_created(self, fresh_client):
        # Fresh SA client on SMART: try to create TWO upgrade sessions for ELITE.
        r1 = requests.post(f"{BASE}/api/payments/upgrade-checkout",
                           json={"package_code": "ELITE",
                                 "origin_url": "https://example.com"},
                           headers=fresh_client["headers"])
        assert r1.status_code == 200, r1.text
        s1 = r1.json()["session_id"]

        r2 = requests.post(f"{BASE}/api/payments/upgrade-checkout",
                           json={"package_code": "ELITE",
                                 "origin_url": "https://example.com"},
                           headers=fresh_client["headers"])
        # Fixed behaviour: the in-flight session is reused, so only ONE payable
        # checkout can exist per client + target package.
        assert r2.status_code == 200, r2.text
        assert r2.json()["session_id"] == s1, (
            "duplicate-payment protection: second checkout must reuse the open session")
        assert r2.json().get("reused") is True


# ---------------------------------------------------------------- SECTION 2
class TestAccountantRBAC:
    ADMIN_ONLY = [
        "/api/users", "/api/payments", "/api/my-payments", "/api/my-services",
        "/api/overview", "/api/recommendations",
    ]

    @pytest.mark.parametrize("path", ADMIN_ONLY)
    def test_accountant_forbidden(self, tokens, path):
        r = requests.get(f"{BASE}{path}", headers=_h(tokens["acca"]))
        assert r.status_code in (401, 403), f"{path} returned {r.status_code} for accountant"

    def test_accountant_cannot_see_other_accountant_case(self, tokens):
        # List acc_a's cases
        ra = requests.get(f"{BASE}/api/cases", headers=_h(tokens["acca"]))
        assert ra.status_code == 200
        a_case_ids = {c["id"] for c in ra.json()}

        # Acc_b lists their cases
        rb = requests.get(f"{BASE}/api/cases", headers=_h(tokens["accb"]))
        assert rb.status_code == 200
        b_case_ids = {c["id"] for c in rb.json()}
        cross = a_case_ids & b_case_ids
        # cases should be disjoint (or only overlap when both accountants share; usually none)
        # We just verify direct-URL access is 403
        if a_case_ids - b_case_ids:
            target = next(iter(a_case_ids - b_case_ids))
            rc = requests.get(f"{BASE}/api/cases/{target}", headers=_h(tokens["accb"]))
            assert rc.status_code in (403, 404), \
                f"IDOR: acc_b fetched acc_a case {target}: {rc.status_code}"

    def test_accountant_pii_scrub_on_case_detail(self, fresh_client, tokens):
        r = requests.get(f"{BASE}/api/cases/{fresh_client['case_id']}",
                         headers=_h(tokens["acca"]))
        assert r.status_code == 200
        body = r.json()
        forbidden = {"email", "phone", "utr", "address", "client_user_id",
                     "password_hash", "session_id"}
        leaked = forbidden & set(body.keys())
        assert not leaked, f"Accountant saw forbidden fields on case: {leaked}"


# ---------------------------------------------------------------- SECTION 2
class TestDeactivatedUser:
    def test_deactivated_token_rejected(self, tokens):
        # create user, get token, deactivate, then hit /auth/me
        email = f"TEST_it7_deact_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{BASE}/api/users",
                          json={"email": email, "password": "Audit@123",
                                "name": "Deact User", "role": "CLIENT"},
                          headers=_h(tokens["sa"]))
        assert r.status_code == 200
        uid = r.json()["id"]
        tok = _login(email, "Audit@123")

        # Deactivate via query param
        rd = requests.patch(f"{BASE}/api/users/{uid}/active?is_active=false",
                            headers=_h(tokens["sa"]))
        if rd.status_code not in (200, 204):
            pytest.skip(f"No deactivation endpoint available (status={rd.status_code})")

        # Existing token should be rejected
        me = requests.get(f"{BASE}/api/auth/me", headers=_h(tok))
        assert me.status_code == 401, \
            f"DEFECT: deactivated user's existing token still works (status={me.status_code})"

        # Cannot log in
        lg = requests.post(f"{BASE}/api/auth/login",
                          json={"email": email, "password": "Audit@123"})
        assert lg.status_code == 401


# ---------------------------------------------------------------- SECTION 9
class TestWorkflowStageSkip:
    def test_skip_to_admin_review_from_assigned(self, fresh_client, tokens):
        cid = fresh_client["case_id"]
        # Case is at ASSIGNED (fresh + assigned) — try submit-for-admin-review
        r = requests.post(f"{BASE}/api/cases/{cid}/submit-for-admin-review",
                          json={"checklist": {"figures_verified": True,
                                              "supporting_docs_reviewed": True,
                                              "internal_notes_captured": True}},
                          headers=_h(tokens["acca"]))
        assert r.status_code in (400, 409, 422), \
            f"DEFECT: submit-for-admin-review accepted from ASSIGNED (status={r.status_code})"

    def test_client_approve_before_admin_approved(self, fresh_client, tokens):
        cid = fresh_client["case_id"]
        r = requests.post(f"{BASE}/api/cases/{cid}/client-approve",
                          json={}, headers=fresh_client["headers"])
        assert r.status_code in (400, 403, 409), \
            f"DEFECT: client-approve allowed before admin approval (status={r.status_code})"

    def test_record_submission_before_ready(self, fresh_client, tokens):
        cid = fresh_client["case_id"]
        r = requests.post(f"{BASE}/api/cases/{cid}/record-submission",
                          json={"reference": "X", "provider": "HMRC",
                                "submitted_at": "2026-01-15"},
                          headers=_h(tokens["adm"]))
        assert r.status_code in (400, 409, 422), \
            f"DEFECT: record-submission accepted before READY_FOR_SUBMISSION ({r.status_code})"


# ---------------------------------------------------------------- SECTION 8
class TestDocumentIDOR:
    def test_client_cannot_download_other_client_document(self, tokens, fresh_client):
        # Client A uploads a doc on their own case, then fresh_client tries to fetch
        cla_cases = requests.get(f"{BASE}/api/cases", headers=_h(tokens["cla"])).json()
        if not cla_cases:
            pytest.skip("Client A has no cases")
        cid = cla_cases[0]["id"]
        files = {"file": ("audit.txt", io.BytesIO(b"secret A"), "text/plain")}
        up = requests.post(f"{BASE}/api/documents/upload",
                           files=files,
                           data={"case_id": cid, "document_type": "Other"},
                           headers=_h(tokens["cla"]))
        if up.status_code != 200:
            pytest.skip(f"Client A doc upload failed: {up.status_code} {up.text[:200]}")
        doc_id = up.json()["id"]

        # fresh_client tries to download
        r = requests.get(f"{BASE}/api/documents/{doc_id}/download",
                         headers=fresh_client["headers"])
        assert r.status_code in (403, 404), \
            f"IDOR DEFECT: cross-client document download returned {r.status_code}"
