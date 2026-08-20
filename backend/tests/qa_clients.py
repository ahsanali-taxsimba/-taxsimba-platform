"""Dedicated disposable QA clients.

Automated tests must NEVER create cases, notifications, payments or other records against
the persistent demo accounts (clienta@/clientb@example.com), which are kept clean for manual
preview testing. Every suite that mutates client data uses these dedicated accounts instead.

They are provisioned once and then reused, so repeated runs do not accumulate new client
accounts, and `reset_qa_clients()` prunes whatever a previous run left behind so each session
starts from a predictable, uncluttered state.
"""
import os

import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else \
    open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip()
API = f"{BASE_URL}/api"

QA_PASSWORD = "QaClient@123"
QA_CLIENT_A = ("qa.client.a@qa-taxsimba.example.com", QA_PASSWORD)
QA_CLIENT_B = ("qa.client.b@qa-taxsimba.example.com", QA_PASSWORD)

# Persistent demo accounts that automated tests must not mutate.
PROTECTED_DEMO_EMAILS = ("clienta@example.com", "clientb@example.com")


def _super_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": "superadmin@taxsimba.co.uk", "password": "Super@123"},
                      timeout=30)
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def ensure_qa_clients():
    """Create the QA clients if they do not exist yet. Safe to call repeatedly."""
    h = _super_token()
    for email, pw in (QA_CLIENT_A, QA_CLIENT_B):
        login = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
        if login.status_code == 200:
            continue
        created = requests.post(f"{API}/users",
                                json={"email": email, "password": pw,
                                      "name": f"QA {email.split('@')[0]}", "role": "CLIENT"},
                                headers=h, timeout=30)
        assert created.status_code == 200, f"could not provision {email}: {created.text}"
    return {"client_a": QA_CLIENT_A, "client_b": QA_CLIENT_B}


def reset_qa_clients():
    """Prune records the QA clients accumulated in previous runs (direct DB, no API)."""
    import asyncio
    import sys

    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    sys.path.insert(0, "/app/backend")
    from db import db

    async def _run():
        for email, _ in (QA_CLIENT_A, QA_CLIENT_B):
            user = await db.users.find_one({"email": email})
            if not user:
                continue
            uid = user["id"]
            case_ids = [c["id"] async for c in db.cases.find({"client_user_id": uid}, {"id": 1})]
            # keep the newest case so suites that expect an existing case still work
            drop = case_ids[:-1] if len(case_ids) > 1 else []
            if drop:
                await db.cases.delete_many({"id": {"$in": drop}})
                for coll in (db.tasks, db.documents, db.document_requests, db.messages,
                             db.activity_logs, db.calculations, db.reviews, db.client_approvals,
                             db.submission_records, db.assignments, db.notifications,
                             db.recommendations, db.internal_notes):
                    await coll.delete_many({"case_id": {"$in": drop}})
            await db.notifications.delete_many({"user_id": uid, "is_read": True})

    try:
        asyncio.get_event_loop().run_until_complete(_run())
    except Exception as e:  # never block a test session on housekeeping
        print(f"QA client reset skipped: {e}")


def assert_demo_accounts_untouched(before, after):
    """Compare demo-account record counts captured either side of a test session."""
    problems = []
    for email in PROTECTED_DEMO_EMAILS:
        for key in ("cases", "notifications", "documents", "tasks", "payments"):
            b, a = before[email][key], after[email][key]
            if a > b:
                problems.append(f"{email}: {key} grew {b} -> {a}")
    return problems


def demo_account_counts():
    """Snapshot of what each protected demo account owns."""
    import asyncio
    import sys

    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    sys.path.insert(0, "/app/backend")
    from db import db

    async def _run():
        out = {}
        for email in PROTECTED_DEMO_EMAILS:
            user = await db.users.find_one({"email": email})
            if not user:
                out[email] = dict.fromkeys(
                    ("cases", "notifications", "documents", "tasks", "payments"), 0)
                continue
            uid = user["id"]
            case_ids = [c["id"] async for c in db.cases.find({"client_user_id": uid}, {"id": 1})]
            out[email] = {
                "cases": len(case_ids),
                "notifications": await db.notifications.count_documents({"user_id": uid}),
                "documents": await db.documents.count_documents({"case_id": {"$in": case_ids}}),
                "tasks": await db.tasks.count_documents({"case_id": {"$in": case_ids}}),
                "payments": await db.payments.count_documents({"client_user_id": uid}),
            }
        return out

    return asyncio.get_event_loop().run_until_complete(_run())
