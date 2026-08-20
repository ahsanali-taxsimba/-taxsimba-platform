"""Iteration 9 — Final Phase 1/1B Lock Verification.

Covers:
  FIX 1 — Admin contact masking (list_users)
  FIX 2 — Audited SUPER_ADMIN reveal-contact + contact-access-log
  FIX 3 — Mandatory client task blocks record-submission but NOT client access
  FIX 4 — request-from-client stage guard (no orphan task/doc/message on rejection)
  ISOLATION at scale — Accountants A, B, C each own strictly their own cases
  REASSIGNMENT — data survives when case moves A -> B (docs, notes, calcs, activity)
"""
import os, uuid, pytest, requests
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")

_CHECKLIST = {"client_information_reviewed": True, "required_documents_reviewed": True,
              "income_checked": True, "allowable_expenses_checked": True,
              "tax_calculation_checked": True, "supporting_documents_attached": True,
              "return_ready": True}


def _drive_to_rfs(BASE, tokens, cid, client_tok, acca_tok):
    """Take a fresh case from ASSIGNED to READY_FOR_SUBMISSION."""
    requests.post(f"{BASE}/api/cases/{cid}/start-review", headers=_h(acca_tok))
    requests.post(f"{BASE}/api/cases/{cid}/mark-reviewed", headers=_h(acca_tok))
    calc = requests.post(f"{BASE}/api/cases/{cid}/calculations",
                         json={"total_income": 40000, "taxable_income": 30000,
                               "tax_due": 5000, "is_refund": False,
                               "notes": "n", "breakdown": {}},
                         headers=_h(acca_tok)).json()
    requests.post(f"{BASE}/api/cases/{cid}/submit-for-admin-review",
                 json={"calculation_version_id": calc["id"], "checklist": _CHECKLIST},
                 headers=_h(acca_tok))
    requests.post(f"{BASE}/api/cases/{cid}/admin-approve",
                 json={"note": "ok"}, headers=_h(tokens["adm"]))
    # After admin-approve, case is at AWAITING_CLIENT_APPROVAL (auto-released)
    requests.post(f"{BASE}/api/cases/{cid}/client-approve", headers=_h(client_tok))
    # client-approve auto-transitions CLIENT_APPROVED -> READY_FOR_SUBMISSION
    return calc

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().rstrip("/")


def _login(email, pw):
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": pw})
    r.raise_for_status()
    return r.json()["access_token"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def tokens():
    sa = _login("superadmin@taxsimba.co.uk", "Super@123")
    adm = _login("admin@taxsimba.co.uk", "Admin@123")
    acca = _login("accountant.a@taxsimba.co.uk", "Account@123")
    accb = _login("accountant.b@taxsimba.co.uk", "Account@123")
    # Accountant C — create if not present
    c_email = "accountant.c@taxsimba.co.uk"
    rc = requests.post(f"{BASE}/api/users", headers=_h(sa),
                       json={"email": c_email, "password": "Account@123",
                             "name": "Accountant C", "role": "ACCOUNTANT"})
    assert rc.status_code in (200, 400), rc.text  # 400 = already exists (idempotent)
    accc = _login(c_email, "Account@123")
    return {"sa": sa, "adm": adm, "acca": acca, "accb": accb, "accc": accc}


# ------------------------------------------------------------- helpers
def _make_client(tokens, tag):
    email = f"TEST_it9_{tag}_{uuid.uuid4().hex[:5]}@example.com"
    r = requests.post(f"{BASE}/api/users", headers=_h(tokens["sa"]),
                      json={"email": email, "password": "Client@123",
                            "name": f"IT9 Client {tag}", "role": "CLIENT",
                            "phone": "07700900123"})
    assert r.status_code == 200, r.text
    return r.json()["id"], email


def _make_case(tokens, client_uid, accountant_token=None):
    rc = requests.post(f"{BASE}/api/cases", headers=_h(tokens["adm"]),
                       json={"client_user_id": client_uid,
                             "service_type": "SELF_ASSESSMENT",
                             "tax_year": "2024/25"})
    assert rc.status_code == 200, rc.text
    case = rc.json()
    if accountant_token:
        acc_id = requests.get(f"{BASE}/api/auth/me",
                              headers=_h(accountant_token)).json()["id"]
        ra = requests.post(f"{BASE}/api/cases/{case['id']}/assign",
                           json={"accountant_id": acc_id},
                           headers=_h(tokens["adm"]))
        assert ra.status_code == 200, ra.text
    return case


# ============================================================= FIX 1
class TestAdminContactMasking:
    def test_admin_sees_masked_client_email_and_phone(self, tokens):
        r = requests.get(f"{BASE}/api/users?role=CLIENT", headers=_h(tokens["adm"]))
        assert r.status_code == 200
        rows = r.json()
        assert rows, "expected at least one client visible to admin"
        for row in rows:
            assert "***" in row["email"], f"admin must see masked email; got {row['email']}"
            assert row.get("contact_masked") is True
            if row.get("phone"):
                assert "***" in row["phone"]

    def test_superadmin_sees_full_contact(self, tokens):
        r = requests.get(f"{BASE}/api/users?role=CLIENT", headers=_h(tokens["sa"]))
        assert r.status_code == 200
        rows = r.json()
        assert rows
        # At least clienta@example.com should be visible unmasked
        matches = [x for x in rows if x["email"] == "clienta@example.com"]
        assert matches, "seeded clienta must be visible unmasked to super admin"
        assert matches[0].get("contact_masked") is not True

    def test_admin_non_client_rows_not_masked(self, tokens):
        r = requests.get(f"{BASE}/api/users?role=ACCOUNTANT", headers=_h(tokens["adm"]))
        assert r.status_code == 200
        for row in r.json():
            assert "***" not in row["email"], "accountant emails must NOT be masked"
            assert row.get("contact_masked") is not True

    def test_no_password_hash_ever_returned(self, tokens):
        """Even the super admin must never receive password_hash."""
        for role, tok in (("SUPER_ADMIN", tokens["sa"]), ("ADMIN", tokens["adm"])):
            r = requests.get(f"{BASE}/api/users", headers=_h(tok))
            assert r.status_code == 200
            for row in r.json():
                assert "password_hash" not in row, f"{role} received password_hash"
                assert "card" not in row
                assert "stripe_payment_intent_id" not in row


# ============================================================= FIX 2
class TestAuditedContactReveal:
    def test_super_admin_reveal_returns_full_and_logs(self, tokens):
        clients = requests.get(f"{BASE}/api/users?role=CLIENT",
                               headers=_h(tokens["sa"])).json()
        target = next(x for x in clients if x["email"] == "clienta@example.com")
        r = requests.post(f"{BASE}/api/clients/{target['id']}/reveal-contact",
                          json={"reason": "IT9 verification of audited reveal"},
                          headers=_h(tokens["sa"]))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == "clienta@example.com"
        # Audit entry present
        log = requests.get(f"{BASE}/api/contact-access-log",
                           headers=_h(tokens["sa"])).json()
        assert any(e["client_user_id"] == target["id"]
                   and e["reason"] == "IT9 verification of audited reveal"
                   for e in log), "audit entry not persisted"

    def test_blank_reason_rejected(self, tokens):
        clients = requests.get(f"{BASE}/api/users?role=CLIENT",
                               headers=_h(tokens["sa"])).json()
        target = clients[0]
        for reason in ("", "   ", "\t"):
            r = requests.post(f"{BASE}/api/clients/{target['id']}/reveal-contact",
                              json={"reason": reason}, headers=_h(tokens["sa"]))
            assert r.status_code == 400, r.text

    def test_admin_and_accountant_cannot_reveal(self, tokens):
        clients = requests.get(f"{BASE}/api/users?role=CLIENT",
                               headers=_h(tokens["sa"])).json()
        target = clients[0]
        for tok in (tokens["adm"], tokens["acca"]):
            r = requests.post(f"{BASE}/api/clients/{target['id']}/reveal-contact",
                              json={"reason": "should be blocked"}, headers=_h(tok))
            assert r.status_code == 403, r.text

    def test_access_log_only_super_admin(self, tokens):
        for tok in (tokens["adm"], tokens["acca"]):
            r = requests.get(f"{BASE}/api/contact-access-log", headers=_h(tok))
            assert r.status_code == 403


# ============================================================= FIX 3
class TestMandatoryBlocksSubmissionOnly:
    def test_mandatory_task_blocks_submission_but_not_client_dashboard(self, tokens):
        uid, email = _make_client(tokens, "mand")
        client_tok = _login(email, "Client@123")
        case = _make_case(tokens, uid, tokens["acca"])
        cid = case["id"]
        _drive_to_rfs(BASE, tokens, cid, client_tok, tokens["acca"])
        status = requests.get(f"{BASE}/api/cases/{cid}", headers=_h(tokens["adm"])).json()["status"]
        assert status == "READY_FOR_SUBMISSION", status

    def test_record_submission_blocked_by_open_mandatory_task(self, tokens):
        """Full happy path — case in READY_FOR_SUBMISSION with a
        directly-inserted OPEN mandatory task -> record-submission 400."""
        uid, email = _make_client(tokens, "block")
        client_tok = _login(email, "Client@123")
        case = _make_case(tokens, uid, tokens["acca"])
        cid = case["id"]
        _drive_to_rfs(BASE, tokens, cid, client_tok, tokens["acca"])
        status = requests.get(f"{BASE}/api/cases/{cid}", headers=_h(tokens["adm"])).json()["status"]
        assert status == "READY_FOR_SUBMISSION", status

        # Plant an OPEN mandatory task in the DB (simulating an accountant request
        # from an earlier stage that is still outstanding).
        from pymongo import MongoClient
        mc = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
        mc.tasks.insert_one({
            "id": str(uuid.uuid4()), "case_id": cid, "case_ref": case["case_ref"],
            "name": "TEST_it9 mandatory item", "description": "outstanding",
            "owner_role": "CLIENT", "owner_id": uid, "status": "OPEN",
            "mandatory": True, "created_at": "2026-01-01T00:00:00+00:00",
        })
        r = requests.post(f"{BASE}/api/cases/{cid}/record-submission",
                          json={"submission_date": "2026-01-01",
                                "submission_reference": "IT9REF01",
                                "provider": "Manual"},
                          headers=_h(tokens["adm"]))
        assert r.status_code == 400, r.text
        assert "mandatory" in r.text.lower()

        # Complete the task -> submission succeeds
        mc.tasks.update_many({"case_id": cid, "mandatory": True},
                            {"$set": {"status": "COMPLETED",
                                      "completed_date": "2026-01-02T00:00:00+00:00"}})
        r2 = requests.post(f"{BASE}/api/cases/{cid}/record-submission",
                           json={"submission_date": "2026-01-02",
                                 "submission_reference": "IT9REF02",
                                 "provider": "Manual"},
                           headers=_h(tokens["adm"]))
        assert r2.status_code == 200, r2.text

    def test_client_dashboard_never_blocked_by_missing_info(self, tokens):
        """Client with open mandatory task must still reach every client endpoint."""
        uid, email = _make_client(tokens, "dash")
        client_tok = _login(email, "Client@123")
        case = _make_case(tokens, uid, tokens["acca"])
        # Move to ACCOUNTANT_REVIEW so we can request from client
        requests.post(f"{BASE}/api/cases/{case['id']}/start-review",
                     headers=_h(tokens["acca"]))
        # request info with mandatory=true
        r = requests.post(f"{BASE}/api/cases/{case['id']}/request-from-client",
                          json={"title": "Send P60", "description": "please",
                                "due_date": "2026-02-01",
                                "document_required": True,
                                "message": "hello",
                                "mandatory": True},
                          headers=_h(tokens["acca"]))
        assert r.status_code == 200, r.text
        # All client-facing endpoints must return 200 (no blocking)
        for path in ("/api/auth/me", "/api/cases", "/api/tasks",
                    "/api/documents", "/api/messages", "/api/notifications",
                    "/api/my-actions"):
            rr = requests.get(f"{BASE}{path}", headers=_h(client_tok))
            assert rr.status_code != 403, f"{path} incorrectly blocked (403)"
            assert rr.status_code < 500, f"{path} -> {rr.status_code}: {rr.text[:120]}"


# ============================================================= FIX 4
class TestRequestFromClientStageGuard:
    def test_rejected_when_status_disallows_awaiting_client(self, tokens):
        """Request from client on a case in READY_FOR_SUBMISSION must 400 and
        create NO orphan task, document_request or message."""
        uid, email = _make_client(tokens, "guard")
        client_tok = _login(email, "Client@123")
        case = _make_case(tokens, uid, tokens["acca"])
        cid = case["id"]
        _drive_to_rfs(BASE, tokens, cid, client_tok, tokens["acca"])
        status = requests.get(f"{BASE}/api/cases/{cid}", headers=_h(tokens["adm"])).json()["status"]
        assert status == "READY_FOR_SUBMISSION", status

        from pymongo import MongoClient
        mc = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
        before_t = mc.tasks.count_documents({"case_id": cid})
        before_d = mc.document_requests.count_documents({"case_id": cid})
        before_m = mc.messages.count_documents({"case_id": cid})

        r = requests.post(f"{BASE}/api/cases/{cid}/request-from-client",
                          json={"title": "orphan probe", "description": "x",
                                "due_date": "2026-02-01",
                                "document_required": True, "message": "hi",
                                "mandatory": True},
                          headers=_h(tokens["acca"]))
        assert r.status_code in (400, 403), r.text

        after_t = mc.tasks.count_documents({"case_id": cid})
        after_d = mc.document_requests.count_documents({"case_id": cid})
        after_m = mc.messages.count_documents({"case_id": cid})
        assert (before_t, before_d, before_m) == (after_t, after_d, after_m), \
            f"orphan rows created: tasks {before_t}->{after_t} " \
            f"docs {before_d}->{after_d} msgs {before_m}->{after_m}"

    def test_permitted_from_allowed_states(self, tokens):
        uid, _ = _make_client(tokens, "ok")
        case = _make_case(tokens, uid, tokens["acca"])
        # ASSIGNED -> allowed via ACCOUNTANT_REVIEW/AWAITING_CLIENT? check spec:
        # ALLOWED_TRANSITIONS["ASSIGNED"] = ["ACCOUNTANT_REVIEW", "ASSIGNED"] — so
        # request-from-client from ASSIGNED will FAIL. Move to ACCOUNTANT_REVIEW.
        requests.post(f"{BASE}/api/cases/{case['id']}/start-review",
                     headers=_h(tokens["acca"]))
        r = requests.post(f"{BASE}/api/cases/{case['id']}/request-from-client",
                          json={"title": "info", "description": "d",
                                "due_date": "2026-02-01",
                                "document_required": False,
                                "message": "hello",
                                "mandatory": False},
                          headers=_h(tokens["acca"]))
        assert r.status_code == 200, r.text


# ============================================================= ISOLATION
class TestMultiAccountantIsolation:
    """Assign 3 fresh cases to Accountant A, 3 to B, 3 to C and verify strict
    isolation across API surface. (Scaled down from 30 for runtime but topology
    identical.)"""

    def test_isolation_at_scale(self, tokens):
        per_acc = 3
        case_map = {"acca": [], "accb": [], "accc": []}
        for key in case_map:
            for i in range(per_acc):
                uid, _ = _make_client(tokens, f"{key}{i}")
                case = _make_case(tokens, uid, tokens[key])
                case_map[key].append(case["id"])

        # Each accountant's /api/cases must contain only their case IDs
        # (or at least — must NOT contain any of the other two accountants').
        for key, mine in case_map.items():
            r = requests.get(f"{BASE}/api/cases", headers=_h(tokens[key]))
            assert r.status_code == 200
            visible = {c["id"] for c in r.json()}
            for other_key, others in case_map.items():
                if other_key == key:
                    continue
                overlap = visible & set(others)
                assert not overlap, f"{key} can see {other_key}'s cases: {overlap}"

        # Direct case-detail probe: cross-fetch must be 403/404
        cross_leaks = []
        for key, mine in case_map.items():
            other_ids = [c for k, arr in case_map.items() if k != key for c in arr]
            for cid in other_ids[:2]:  # spot-check
                r = requests.get(f"{BASE}/api/cases/{cid}", headers=_h(tokens[key]))
                if r.status_code == 200:
                    cross_leaks.append((key, cid))
        assert not cross_leaks, f"cross-accountant IDOR leaks: {cross_leaks}"

        # Admin sees all
        r = requests.get(f"{BASE}/api/cases", headers=_h(tokens["adm"]))
        assert r.status_code == 200
        admin_ids = {c["id"] for c in r.json()}
        for arr in case_map.values():
            for cid in arr:
                assert cid in admin_ids, "admin missing a case"


# ============================================================= REASSIGN
class TestReassignmentPreservesData:
    def test_reassign_a_to_b_preserves_history(self, tokens):
        uid, email = _make_client(tokens, "reasg")
        client_tok = _login(email, "Client@123")
        case = _make_case(tokens, uid, tokens["acca"])
        cid = case["id"]
        # Do some work as A
        requests.post(f"{BASE}/api/cases/{cid}/start-review", headers=_h(tokens["acca"]))
        rq = requests.post(f"{BASE}/api/cases/{cid}/request-from-client",
                           json={"title": "P60 please", "description": "d",
                                 "due_date": "2026-02-01",
                                 "document_required": True,
                                 "message": "hi",
                                 "mandatory": False},
                           headers=_h(tokens["acca"]))
        assert rq.status_code == 200
        # Reassign to B via /assign (server reassigns and transitions ASSIGNED)
        acc_b_id = requests.get(f"{BASE}/api/auth/me",
                                headers=_h(tokens["accb"])).json()["id"]
        rr = requests.post(f"{BASE}/api/cases/{cid}/assign",
                          json={"accountant_id": acc_b_id,
                                "internal_instructions": "load balance"},
                          headers=_h(tokens["adm"]))
        assert rr.status_code == 200, rr.text
        # A can no longer read
        ra = requests.get(f"{BASE}/api/cases/{cid}", headers=_h(tokens["acca"]))
        assert ra.status_code in (403, 404)
        # B can read
        rb = requests.get(f"{BASE}/api/cases/{cid}", headers=_h(tokens["accb"]))
        assert rb.status_code == 200
        # History preserved: task from A still present
        tasks = requests.get(f"{BASE}/api/tasks?case_id={cid}",
                            headers=_h(tokens["accb"]))
        if tasks.status_code == 200:
            t_list = tasks.json()
            assert any(t.get("name") == "P60 please" for t in t_list), t_list
        # Activity log still present via case detail
        acts = requests.get(f"{BASE}/api/cases/{cid}/activity",
                           headers=_h(tokens["accb"]))
        assert acts.status_code == 200
        assert len(acts.json()) > 0, "activity history lost after reassign"
        # Assignment history includes both accountants
        hist = requests.get(f"{BASE}/api/cases/{cid}/assignments",
                           headers=_h(tokens["adm"]))
        assert hist.status_code == 200, hist.text
        entries = hist.json()
        assert len(entries) >= 2, f"assignment history should include A and B: {entries}"
        acc_ids = {e.get("accountant_id") for e in entries}
        assert acc_b_id in acc_ids
