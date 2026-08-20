import os
import uuid
from datetime import datetime, timezone, timedelta

from auth import hash_password
from db import db
from workflow import now_iso, STATUS_META


def _user(email, name, role, password, extra=None):
    doc = {
        "id": str(uuid.uuid4()),
        "email": email.lower(),
        "name": name,
        "role": role,
        "password_hash": hash_password(password),
        "is_active": True,
        "created_at": now_iso(),
    }
    doc.update(extra or {})
    return doc


async def seed():
    await db.users.create_index("email", unique=True)
    await db.cases.create_index("id")
    await db.services.create_index("code", unique=True)

    await db.services.update_one(
        {"code": "SELF_ASSESSMENT"},
        {"$setOnInsert": {"id": str(uuid.uuid4()), "code": "SELF_ASSESSMENT",
                          "name": "Self Assessment", "price": 199.0, "is_active": True,
                          "created_at": now_iso()}},
        upsert=True,
    )

    if await db.users.count_documents({}) > 0:
        return

    users = [
        _user("superadmin@taxsimba.co.uk", "Sarah Owusu", "SUPER_ADMIN", "Super@123"),
        _user(os.environ.get("ADMIN_EMAIL", "admin@taxsimba.co.uk"), "Daniel Mensah", "ADMIN",
              os.environ.get("ADMIN_PASSWORD", "Admin@123")),
        _user("accountant.a@taxsimba.co.uk", "Amara Boateng", "ACCOUNTANT", "Account@123"),
        _user("accountant.b@taxsimba.co.uk", "Ben Carter", "ACCOUNTANT", "Account@123"),
        _user("clienta@example.com", "Client A", "CLIENT", "Client@123",
              {"phone": "+44 7700 900111", "utr": "1234567890", "address": "12 Oak Lane, London"}),
        _user("clientb@example.com", "Client B", "CLIENT", "Client@123",
              {"phone": "+44 7700 900222", "utr": "9876543210", "address": "5 Elm Road, Manchester"}),
    ]
    await db.users.insert_many([dict(u) for u in users])

    by_email = {u["email"]: u for u in users}

    for acc in ("accountant.a@taxsimba.co.uk", "accountant.b@taxsimba.co.uk"):
        u = by_email[acc]
        await db.accountant_profiles.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": u["id"],
            "name": u["name"],
            "email": u["email"],
            "specialisms": ["SELF_ASSESSMENT"],
            "capacity": 15,
            "is_active": True,
            "created_at": now_iso(),
        })

    for u in (by_email["clienta@example.com"], by_email["clientb@example.com"]):
        await db.clients.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": u["id"],
            "name": u["name"],
            "email": u["email"],
            "phone": u.get("phone"),
            "utr": u.get("utr"),
            "created_at": now_iso(),
        })

    seq = 1001
    for u in (by_email["clienta@example.com"], by_email["clientb@example.com"]):
        client = await db.clients.find_one({"user_id": u["id"]})
        stage, next_action, owner = STATUS_META["AWAITING_ASSIGNMENT"]
        await db.cases.insert_one({
            "id": str(uuid.uuid4()),
            "case_ref": f"SA-{seq}",
            "client_id": client["id"],
            "client_user_id": u["id"],
            "client_name": u["name"],
            "service_type": "SELF_ASSESSMENT",
            "tax_year": "2024/25",
            "assigned_accountant_id": None,
            "assigned_accountant_name": None,
            "admin_reviewer_id": None,
            "admin_reviewer_name": None,
            "status": "AWAITING_ASSIGNMENT",
            "current_stage": stage,
            "next_action": next_action,
            "next_action_owner": owner,
            "priority": "MEDIUM",
            "internal_deadline": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
            "external_deadline": "2026-01-31T23:59:00+00:00",
            "internal_instructions": None,
            "waiting_reason": None,
            "approved_version_id": None,
            "created_at": now_iso(),
            "last_updated": now_iso(),
        })
        seq += 1

    async for c in db.cases.find({}):
        await db.activity_logs.insert_one({
            "id": str(uuid.uuid4()), "case_id": c["id"], "action": "Case created",
            "user_id": None, "user_name": "System", "role": "SYSTEM",
            "meta": {"status": "AWAITING_ASSIGNMENT"}, "created_at": now_iso(),
        })
