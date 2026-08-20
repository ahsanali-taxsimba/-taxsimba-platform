"""Demo portal presentation state (sections 2, 3, 12, 17).

IMPORTANT: the older Phase 1/1B/2 suites deliberately drive the shared demo accounts
(clienta@/clientb@example.com) and create additional cases, tasks, documents and
notifications on every run. Presentation state therefore has to be asserted against a
freshly normalised demo client rather than whatever a regression run happened to leave
behind, so this module re-runs the (idempotent) demo normalisation first.

Run this module LAST -- it also leaves the preview portal in its clean, demo-ready state.
"""
import runpy
import sys

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
sys.path.insert(0, "/app/backend")

BASE = "https://taxsimba-foundation.preview.emergentagent.com"
API = f"{BASE}/api"
CLIENT_A = ("clienta@example.com", "Client@123")


@pytest.fixture(scope="module")
def clean_demo():
    """Normalise the demo clients, then return an authenticated Client A context."""
    runpy.run_path("/app/backend/scripts/fix_demo_data.py", run_name="__main__")
    r = requests.post(f"{API}/auth/login", json={"email": CLIENT_A[0], "password": CLIENT_A[1]},
                      timeout=30)
    assert r.status_code == 200, r.text
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    cases = requests.get(f"{API}/cases", headers=h, timeout=30).json()
    sa = [c for c in cases if c["service_type"] == "SELF_ASSESSMENT"]
    assert sa, "no Self Assessment case for the demo client"
    return {"h": h, "cases": cases, "sa": sa}


class TestDemoPortalState:
    def test_one_active_self_assessment_case(self, clean_demo):
        assert len(clean_demo["sa"]) == 1, \
            f"demo client shows {len(clean_demo['sa'])} SA cases: " \
            f"{[c['case_ref'] for c in clean_demo['sa']]}"

    def test_tax_year_is_2025_26(self, clean_demo):
        assert clean_demo["sa"][0]["tax_year"] == "2025/26"

    def test_deadline_is_31_january_2027(self, clean_demo):
        full = requests.get(f"{API}/cases/{clean_demo['sa'][0]['id']}",
                            headers=clean_demo["h"], timeout=30).json()
        assert full["external_deadline"].startswith("2027-01-31"), full["external_deadline"]

    def test_service_record_tax_year_matches(self, clean_demo):
        svc = requests.get(f"{API}/my-services", headers=clean_demo["h"], timeout=30).json()
        sa = [s for s in svc["services"] if s["service_type"] == "SELF_ASSESSMENT"]
        assert sa and sa[0]["tax_year"] == "2025/26"

    def test_no_duplicate_documents_or_tasks(self, clean_demo):
        docs = requests.get(f"{API}/documents", headers=clean_demo["h"], timeout=30).json()
        tasks = requests.get(f"{API}/tasks", headers=clean_demo["h"], timeout=30).json()
        assert len({(d["name"], d["status"]) for d in docs}) == len(docs), \
            f"duplicate documents: {[d['name'] for d in docs]}"
        assert len({t["name"] for t in tasks}) == len(tasks), "duplicate tasks"

    def test_documents_are_realistic_in_volume(self, clean_demo):
        docs = requests.get(f"{API}/documents", headers=clean_demo["h"], timeout=30).json()
        assert len(docs) <= 20, f"portal still shows {len(docs)} documents"

    def test_notification_badge_is_reset(self, clean_demo):
        r = requests.get(f"{API}/notifications/unread-count", headers=clean_demo["h"], timeout=30)
        assert r.json()["count"] <= 10, f"unread badge still inflated: {r.json()['count']}"

    def test_completed_history_is_clean(self, clean_demo):
        data = requests.get(f"{API}/my-actions", headers=clean_demo["h"], timeout=30).json()
        keys = [(h["action"], h["case_id"], (h.get("completed_date") or "")[:10])
                for h in data["history"]]
        assert len(keys) == len(set(keys)), "duplicate completed-history entries"
        for h in data["history"]:
            assert h["action"] and h["action"].strip()

    def test_everything_still_scoped_to_this_client(self, clean_demo):
        owned = {c["id"] for c in clean_demo["cases"]}
        for ep in ("tasks", "documents", "notifications"):
            rows = requests.get(f"{API}/{ep}", headers=clean_demo["h"], timeout=30).json()
            seen = {r.get("case_id") for r in rows if r.get("case_id")}
            assert not (seen - owned), f"{ep} leaked a foreign case after normalisation"
