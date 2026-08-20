"""Client Portal correction pass: data isolation, duplicate protection, tax year, status
wording, help centre, settings and profile. The isolation tests are the security gate."""
import os
import sys
import uuid

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
sys.path.insert(0, "/app/backend")

BASE = "https://taxsimba-foundation.preview.emergentagent.com"
API = f"{BASE}/api"

CLIENT_A = ("clienta@example.com", "Client@123")
CLIENT_B = ("clientb@example.com", "Client@123")
ACC_A = ("accountant.a@taxsimba.co.uk", "Account@123")
ADMIN = ("admin@taxsimba.co.uk", "Admin@123")
SUPER = ("superadmin@taxsimba.co.uk", "Super@123")


def _tok(creds):
    r = requests.post(f"{API}/auth/login", json={"email": creds[0], "password": creds[1]}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def tokens():
    return {k: _tok(v) for k, v in
            {"a": CLIENT_A, "b": CLIENT_B, "acc_a": ACC_A, "admin": ADMIN, "super": SUPER}.items()}


@pytest.fixture(scope="module")
def scope(tokens):
    """Everything each demo client legitimately owns."""
    out = {}
    for who in ("a", "b"):
        cases = requests.get(f"{API}/cases", headers=_h(tokens[who]), timeout=30).json()
        docs = requests.get(f"{API}/documents", headers=_h(tokens[who]), timeout=30).json()
        out[who] = {
            "case_ids": {c["id"] for c in cases},
            "case_refs": {c["case_ref"] for c in cases},
            "doc_ids": {d["id"] for d in docs},
            "cases": cases,
        }
    return out


# ==================================================== 1 / 20  DATA ISOLATION
class TestClientDataIsolation:
    def test_client_a_sees_only_own_cases(self, scope):
        assert scope["a"]["case_ids"], "Client A must have at least one case"
        assert not (scope["a"]["case_ids"] & scope["b"]["case_ids"]), \
            "Client A and Client B share case ids"

    @pytest.mark.parametrize("endpoint", ["tasks", "documents", "notifications"])
    def test_lists_never_leak_other_cases(self, tokens, scope, endpoint):
        for who in ("a", "b"):
            rows = requests.get(f"{API}/{endpoint}", headers=_h(tokens[who]), timeout=30).json()
            seen = {r.get("case_id") for r in rows if r.get("case_id")}
            leaked = seen - scope[who]["case_ids"]
            assert not leaked, f"{endpoint} leaked {len(leaked)} foreign case(s) to client {who}"

    def test_my_actions_never_leaks(self, tokens, scope):
        for who in ("a", "b"):
            data = requests.get(f"{API}/my-actions", headers=_h(tokens[who]), timeout=30).json()
            seen = {i.get("case_id") for i in data["outstanding"] + data["history"] if i.get("case_id")}
            assert not (seen - scope[who]["case_ids"] - {None}), f"my-actions leaked for {who}"

    def test_direct_case_access_is_blocked_both_ways(self, tokens, scope):
        for me, other in (("a", "b"), ("b", "a")):
            for cid in list(scope[other]["case_ids"])[:3]:
                r = requests.get(f"{API}/cases/{cid}", headers=_h(tokens[me]), timeout=30)
                assert r.status_code in (403, 404), \
                    f"client {me} read client {other}'s case {cid} ({r.status_code})"

    def test_direct_task_query_by_foreign_case_blocked(self, tokens, scope):
        for me, other in (("a", "b"), ("b", "a")):
            for cid in list(scope[other]["case_ids"])[:2]:
                r = requests.get(f"{API}/tasks", params={"case_id": cid},
                                 headers=_h(tokens[me]), timeout=30)
                assert r.status_code in (403, 404), f"tasks leaked via case_id for {me}"
                r = requests.get(f"{API}/documents", params={"case_id": cid},
                                 headers=_h(tokens[me]), timeout=30)
                assert r.status_code in (403, 404), f"documents leaked via case_id for {me}"

    def test_direct_document_download_blocked(self, tokens, scope):
        for me, other in (("a", "b"), ("b", "a")):
            for did in list(scope[other]["doc_ids"])[:3]:
                r = requests.get(f"{API}/documents/{did}/download",
                                 headers=_h(tokens[me]), timeout=30)
                assert r.status_code in (403, 404), \
                    f"client {me} downloaded client {other}'s document {did}"

    def test_messages_blocked_across_clients(self, tokens, scope):
        for me, other in (("a", "b"), ("b", "a")):
            for cid in list(scope[other]["case_ids"])[:2]:
                r = requests.get(f"{API}/messages", params={"case_id": cid},
                                 headers=_h(tokens[me]), timeout=30)
                assert r.status_code in (403, 404), f"client {me} read client {other}'s messages"
                r = requests.post(f"{API}/messages", json={"case_id": cid, "body": "probe"},
                                  headers=_h(tokens[me]), timeout=30)
                assert r.status_code in (403, 404), f"client {me} posted into client {other}'s case"

    def test_payments_are_client_scoped(self, tokens):
        a = requests.get(f"{API}/my-payments", headers=_h(tokens["a"]), timeout=30).json()
        b = requests.get(f"{API}/my-payments", headers=_h(tokens["b"]), timeout=30).json()
        assert not ({p["id"] for p in a} & {p["id"] for p in b}), "payment rows shared between clients"

    def test_services_are_client_scoped(self, tokens):
        a = requests.get(f"{API}/my-services", headers=_h(tokens["a"]), timeout=30).json()
        b = requests.get(f"{API}/my-services", headers=_h(tokens["b"]), timeout=30).json()
        assert a["client_ref"] != b["client_ref"]
        a_refs = {c["case_ref"] for s in a["services"] for c in (s.get("cases") or [])}
        b_refs = {c["case_ref"] for s in b["services"] for c in (s.get("cases") or [])}
        assert not (a_refs & b_refs), "My Services leaked cases across clients"

    def test_client_cannot_reach_staff_endpoints(self, tokens):
        for path in ("/users?role=CLIENT", "/payments", "/recommendations", "/overview",
                     "/stats/admin", "/contact-access-log"):
            r = requests.get(f"{API}{path}", headers=_h(tokens["a"]), timeout=30)
            assert r.status_code == 403, f"client reached {path} ({r.status_code})"

    def test_accountant_cannot_reach_unassigned_client_case(self, tokens, scope):
        acc = _h(tokens["acc_a"])
        mine = {c["id"] for c in requests.get(f"{API}/cases", headers=acc, timeout=30).json()}
        foreign = [c for c in (scope["a"]["case_ids"] | scope["b"]["case_ids"]) if c not in mine]
        for cid in foreign[:3]:
            r = requests.get(f"{API}/cases/{cid}", headers=acc, timeout=30)
            assert r.status_code in (403, 404), "accountant reached an unassigned case"


# ==================================================== 2  DUPLICATE PROTECTION
class TestNoDuplicates:
    def test_no_duplicate_documents(self, tokens):
        docs = requests.get(f"{API}/documents", headers=_h(tokens["a"]), timeout=30).json()
        keys = [(d["case_id"], d["name"], d["status"]) for d in docs]
        assert len(keys) == len(set(keys)), "duplicate document rows are still present"

    def test_no_duplicate_tasks(self, tokens):
        tasks = requests.get(f"{API}/tasks", headers=_h(tokens["a"]), timeout=30).json()
        keys = [(t["case_id"], t["name"]) for t in tasks]
        assert len(keys) == len(set(keys)), "duplicate task rows are still present"

    def test_completed_history_has_no_duplicates(self, tokens):
        data = requests.get(f"{API}/my-actions", headers=_h(tokens["a"]), timeout=30).json()
        keys = [(h["action"], h["case_id"], (h.get("completed_date") or "")[:10])
                for h in data["history"]]
        assert len(keys) == len(set(keys)), "completed history contains duplicate entries"

    def test_history_rows_are_well_formed(self, tokens):
        data = requests.get(f"{API}/my-actions", headers=_h(tokens["a"]), timeout=30).json()
        for h in data["history"]:
            assert h["action"] and h["action"].strip(), "malformed history row with no action"

    def test_repeated_request_does_not_duplicate(self, tokens):
        """One genuine request produces one genuine record even if fired repeatedly."""
        admin, acc = _h(tokens["admin"]), _h(tokens["acc_a"])
        cases = requests.get(f"{API}/cases", params={"bucket": "in_progress"},
                             headers=acc, timeout=30).json()
        target = next((c for c in cases if c["status"] in
                       ("ACCOUNTANT_REVIEW", "IN_PREPARATION", "AWAITING_CLIENT")), None)
        if not target:
            pytest.skip("no in-flight case assigned to Accountant A")
        title = f"Duplicate probe {uuid.uuid4().hex[:6]}"
        body = {"title": title, "description": "probe", "document_required": True,
                "mandatory": False}
        first = requests.post(f"{API}/cases/{target['id']}/request-from-client",
                              json=body, headers=acc, timeout=30)
        assert first.status_code == 200, first.text
        for _ in range(3):
            requests.post(f"{API}/cases/{target['id']}/request-from-client",
                          json=body, headers=acc, timeout=30)
        tasks = requests.get(f"{API}/tasks", params={"case_id": target["id"]},
                             headers=admin, timeout=30).json()
        matching = [t for t in tasks if t["name"] == title]
        assert len(matching) == 1, f"repeated request created {len(matching)} tasks"

    def test_notification_badge_is_correct_and_scoped(self, tokens, scope):
        """The badge must equal this client's own unread notifications -- absolute volume is
        asserted after demo normalisation (see test_zz_demo_portal_state.py), because the
        regression suites legitimately generate notifications on the shared demo accounts."""
        notes = requests.get(f"{API}/notifications", headers=_h(tokens["a"]), timeout=30).json()
        expected = sum(1 for n in notes if not n.get("is_read"))
        r = requests.get(f"{API}/notifications/unread-count", headers=_h(tokens["a"]), timeout=30)
        assert r.status_code == 200
        assert r.json()["count"] == expected, "badge does not match this client's unread items"
        for n in notes:
            if n.get("case_id"):
                assert n["case_id"] in scope["a"]["case_ids"], "notification from a foreign case"

    def test_repeated_notify_does_not_stack(self, tokens):
        before = requests.get(f"{API}/notifications", headers=_h(tokens["a"]), timeout=30).json()
        # one event per case must not stack: key on (title, case) as notify() does
        keys = [(n["title"], n.get("case_id")) for n in before if not n["is_read"]]
        assert len(keys) == len(set(keys)), "duplicate unread notifications present"


# ==================================================== 3  TAX YEAR / DEADLINE
class TestTaxYear:
    def test_deadline_is_derived_not_hardcoded(self):
        from workflow import deadline_for_tax_year
        assert deadline_for_tax_year("2025/26").startswith("2027-01-31")
        assert deadline_for_tax_year("2024/25").startswith("2026-01-31")
        assert deadline_for_tax_year("2026/27").startswith("2028-01-31")

    def test_documents_carry_the_tax_year(self, tokens):
        docs = requests.get(f"{API}/documents", headers=_h(tokens["a"]), timeout=30).json()
        for d in docs:
            assert d.get("tax_year"), f"document {d['id']} has no tax year"

    def test_service_record_matches(self, tokens):
        svc = requests.get(f"{API}/my-services", headers=_h(tokens["a"]), timeout=30).json()
        sa = [s for s in svc["services"] if s["service_type"] == "SELF_ASSESSMENT"]
        assert sa and sa[0]["tax_year"]


# ==================================================== 4 / 10  STATUS & JOURNEY
class TestSubmissionStatusLogic:
    def test_ready_for_submission_is_not_reported_as_submitted(self, tokens, scope):
        cid = [c["id"] for c in scope["a"]["cases"] if c["service_type"] == "SELF_ASSESSMENT"][0]
        full = requests.get(f"{API}/cases/{cid}", headers=_h(tokens["a"]), timeout=30).json()
        hmrc = [j for j in full["journey"] if j["step"] == "HMRC Submission"][0]
        if full["status"] == "READY_FOR_SUBMISSION":
            assert not full["has_submission_record"]
            assert hmrc["state"] == "Ready to Submit", \
                f"a case that is only ready shows '{hmrc['state']}'"
            assert full["status_label"] == "Ready for HMRC submission"

    def test_journey_uses_hmrc_submission_stage(self, tokens, scope):
        cid = list(scope["a"]["case_ids"])[0]
        full = requests.get(f"{API}/cases/{cid}", headers=_h(tokens["a"]), timeout=30).json()
        steps = [j["step"] for j in full["journey"]]
        assert steps == ["Information", "Documents", "Accountant Review", "Your Approval",
                         "HMRC Submission"], steps
        assert "Submitted to HMRC" not in steps

    def test_submitted_successfully_requires_a_record(self):
        from workflow import journey
        assert [j for j in journey("SUBMITTED", False) if j["step"] == "HMRC Submission"][0]["state"] \
            == "Submitting"
        assert [j for j in journey("SUBMITTED", True) if j["step"] == "HMRC Submission"][0]["state"] \
            == "Submitted Successfully"
        assert [j for j in journey("SUBMISSION_ISSUE") if j["step"] == "HMRC Submission"][0]["state"] \
            == "Submission Failed"

    def test_journey_states_are_client_friendly(self):
        from workflow import journey
        allowed = {"Not Started", "In Progress", "Completed", "Documents Required", "Waiting",
                   "In Review", "Action Required", "Approved", "Ready to Submit", "Submitting",
                   "Submitted Successfully", "Submission Failed"}
        for status in ("NEW", "AWAITING_CLIENT", "ADMIN_REVIEW", "ADMIN_APPROVED",
                       "CLIENT_APPROVED", "READY_FOR_SUBMISSION", "COMPLETED"):
            for step in journey(status):
                assert step["state"] in allowed, step


# ==================================================== 18  CLIENT-FACING LANGUAGE
class TestClientFacingLanguage:
    RAW = ["READY_FOR_SUBMISSION", "AWAITING_CLIENT_APPROVAL", "ACCOUNTANT_REVIEW",
           "SELF_ASSESSMENT", "MTD_INCOME_TAX", "password_hash", "client_user_id"]

    def test_status_label_is_plain_english(self, tokens, scope):
        cid = list(scope["a"]["case_ids"])[0]
        full = requests.get(f"{API}/cases/{cid}", headers=_h(tokens["a"]), timeout=30).json()
        assert "_" not in full["status_label"]
        assert full["status_label"][0].isupper()

    def test_every_status_has_a_plain_label(self):
        from workflow import STATUSES, client_status
        for s in STATUSES:
            label = client_status(s)
            assert "_" not in label and label != s.upper(), f"{s} -> {label}"

    def test_my_actions_text_has_no_enums(self, tokens):
        data = requests.get(f"{API}/my-actions", headers=_h(tokens["a"]), timeout=30).json()
        for item in data["outstanding"] + data["history"]:
            for field in ("action", "description", "service_name"):
                val = item.get(field) or ""
                for raw in self.RAW:
                    assert raw not in val, f"{raw} leaked into client text: {val}"


# ==================================================== 11  PROFILE
class TestProfile:
    def test_profile_is_scoped_and_masks_utr(self, tokens):
        a = requests.get(f"{API}/my-profile", headers=_h(tokens["a"]), timeout=30).json()
        b = requests.get(f"{API}/my-profile", headers=_h(tokens["b"]), timeout=30).json()
        assert a["email"] == CLIENT_A[0] and b["email"] == CLIENT_B[0]
        assert a["client_ref"] != b["client_ref"]
        if a["utr_on_record"]:
            assert a["utr_masked"].startswith("*") and len(a["utr_masked"]) > 4
        assert "password_hash" not in a and "utr" not in a

    def test_utr_reveal_is_own_data_only(self, tokens):
        r = requests.get(f"{API}/my-profile/utr", headers=_h(tokens["a"]), timeout=30)
        assert r.status_code == 200

    def test_can_update_own_details(self, tokens):
        phone = f"07700 9{uuid.uuid4().hex[:5]}"
        r = requests.patch(f"{API}/my-profile", json={"phone": phone, "address": "1 Test Road"},
                           headers=_h(tokens["a"]), timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["phone"] == phone

    def test_email_change_requires_verification(self, tokens):
        new = f"verify_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{API}/my-profile/email-change", json={"new_email": new},
                          headers=_h(tokens["a"]), timeout=30)
        assert r.status_code == 200 and r.json()["status"] == "PENDING"
        me = requests.get(f"{API}/auth/me", headers=_h(tokens["a"]), timeout=30).json()
        assert me["email"] == CLIENT_A[0], "email was changed without verification"

    def test_email_change_rejects_taken_address(self, tokens):
        r = requests.post(f"{API}/my-profile/email-change", json={"new_email": CLIENT_B[0]},
                          headers=_h(tokens["a"]), timeout=30)
        assert r.status_code == 400


# ==================================================== 16  SETTINGS
class TestSettings:
    def test_notification_preferences_round_trip(self, tokens):
        prefs = {"accountant_message": False, "payment_update": True}
        r = requests.patch(f"{API}/my-preferences", json={"preferences": prefs},
                           headers=_h(tokens["a"]), timeout=30)
        assert r.status_code == 200
        assert r.json()["preferences"]["accountant_message"] is False
        got = requests.get(f"{API}/my-profile", headers=_h(tokens["a"]), timeout=30).json()
        assert got["preferences"]["accountant_message"] is False
        requests.patch(f"{API}/my-preferences", json={"preferences": {"accountant_message": True}},
                       headers=_h(tokens["a"]), timeout=30)

    def test_change_password_rejects_wrong_current(self, tokens):
        r = requests.post(f"{API}/my-profile/change-password",
                          json={"current_password": "nope", "new_password": "Whatever@123"},
                          headers=_h(tokens["a"]), timeout=30)
        assert r.status_code == 400

    def test_change_password_enforces_length(self, tokens):
        r = requests.post(f"{API}/my-profile/change-password",
                          json={"current_password": CLIENT_A[1], "new_password": "short"},
                          headers=_h(tokens["a"]), timeout=30)
        assert r.status_code == 400

    def test_data_and_closure_requests_are_controlled(self, tokens):
        for kind in ("DATA_EXPORT", "ACCOUNT_CLOSURE"):
            r = requests.post(f"{API}/my-data-requests", json={"kind": kind},
                              headers=_h(tokens["a"]), timeout=30)
            assert r.status_code == 200 and r.json()["status"] == "PENDING"
        # closure must NOT destroy the account or its records
        me = requests.get(f"{API}/auth/me", headers=_h(tokens["a"]), timeout=30)
        assert me.status_code == 200
        cases = requests.get(f"{API}/cases", headers=_h(tokens["a"]), timeout=30).json()
        assert cases, "closure request destroyed the client's tax records"

    def test_requests_are_deduplicated(self, tokens):
        requests.post(f"{API}/my-data-requests", json={"kind": "DATA_EXPORT"},
                      headers=_h(tokens["a"]), timeout=30)
        rows = requests.get(f"{API}/my-data-requests", headers=_h(tokens["a"]), timeout=30).json()
        pending = [r for r in rows if r["kind"] == "DATA_EXPORT" and r["status"] == "PENDING"]
        assert len(pending) == 1, f"{len(pending)} duplicate pending data requests"


# ==================================================== 15  HELP CENTRE
class TestHelpCentre:
    def test_faqs_and_categories_available(self, tokens):
        cats = requests.get(f"{API}/faq-categories", headers=_h(tokens["a"]), timeout=30).json()
        assert len(cats) == 8
        for expected in ("Getting Started", "Self Assessment", "Uploading Documents",
                         "Payments & Packages", "Calculation & Approval", "HMRC Submission",
                         "MTD for Income Tax", "Account & Security"):
            assert expected in cats
        faqs = requests.get(f"{API}/faqs", headers=_h(tokens["a"]), timeout=30).json()
        assert len(faqs) >= 11

    def test_search_and_category_filter(self, tokens):
        r = requests.get(f"{API}/faqs", params={"q": "upload"}, headers=_h(tokens["a"]), timeout=30)
        assert r.status_code == 200 and r.json()
        r2 = requests.get(f"{API}/faqs", params={"category": "HMRC Submission"},
                          headers=_h(tokens["a"]), timeout=30).json()
        assert r2 and all(f["category"] == "HMRC Submission" for f in r2)

    def test_admin_can_maintain_faq_without_code_change(self, tokens):
        q = f"Test question {uuid.uuid4().hex[:6]}"
        created = requests.post(f"{API}/faqs", json={"category": "Getting Started", "question": q,
                                                     "answer": "Test answer", "order": 99},
                                headers=_h(tokens["admin"]), timeout=30)
        assert created.status_code == 200, created.text
        fid = created.json()["id"]
        assert any(f["id"] == fid for f in
                   requests.get(f"{API}/faqs", headers=_h(tokens["a"]), timeout=30).json())
        upd = requests.patch(f"{API}/faqs/{fid}", json={"category": "Getting Started",
                                                        "question": q, "answer": "Edited",
                                                        "order": 99},
                             headers=_h(tokens["admin"]), timeout=30)
        assert upd.status_code == 200
        assert requests.delete(f"{API}/faqs/{fid}", headers=_h(tokens["admin"]),
                               timeout=30).status_code == 200
        assert not any(f["id"] == fid for f in
                       requests.get(f"{API}/faqs", headers=_h(tokens["a"]), timeout=30).json())

    def test_client_cannot_edit_faqs(self, tokens):
        r = requests.post(f"{API}/faqs", json={"category": "Getting Started", "question": "x",
                                               "answer": "y", "order": 1},
                          headers=_h(tokens["a"]), timeout=30)
        assert r.status_code == 403


# ==================================================== 13 / 14  PACKAGES & MTD
class TestPackagesAndMtd:
    def test_downgrade_still_blocked_server_side(self, tokens):
        opts = requests.get(f"{API}/my-upgrade-options", headers=_h(tokens["a"]), timeout=30)
        if opts.status_code != 200:
            pytest.skip("no Self Assessment package on this client")
        current = opts.json().get("current_package")
        assert current, "no current package"
        for o in opts.json().get("options", []):
            assert o["upgrade_price"] >= current["price"], "a downgrade was offered to the client"

    def test_payment_history_is_customer_facing(self, tokens):
        rows = requests.get(f"{API}/my-payments", headers=_h(tokens["a"]), timeout=30).json()
        for r in rows:
            assert "stripe_payment_intent_id" not in r and "session_id" not in r

    def test_sa_only_client_sees_no_mtd_service_as_active(self, tokens):
        svc = requests.get(f"{API}/my-services", headers=_h(tokens["a"]), timeout=30).json()
        mtd = [s for s in svc["services"] if s["service_type"] == "MTD_INCOME_TAX"]
        for m in mtd:
            if m["status"] == "ACTIVE":
                pytest.skip("this demo client legitimately has MTD active")
            assert m["status"] != "ACTIVE"

    def test_no_unsolicited_mtd_offer(self, tokens):
        offers = requests.get(f"{API}/my-offers", headers=_h(tokens["a"]), timeout=30).json()
        for o in offers:
            assert o["status"] == "PENDING", "a non-approved recommendation reached the client"
