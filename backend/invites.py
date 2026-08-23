"""Secure one-time staff invitations.

A Super Admin creates the staff account without a password. A single-use setup token is
generated, stored only as a hash, expires after INVITE_TTL_HOURS, and is invalidated when it is
used or when a new invite is issued. No password is ever chosen or seen by the Super Admin.
"""
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from db import db

INVITE_TTL_HOURS = 72


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def issue_invite(user_id: str, email: str, invited_by: str) -> dict:
    """Invalidate any previous invite for this user and issue a fresh single-use token."""
    now = datetime.now(timezone.utc)
    await db.staff_invites.update_many(
        {"user_id": user_id, "used_at": None, "revoked_at": None},
        {"$set": {"revoked_at": now.isoformat()}})
    token = secrets.token_urlsafe(32)
    expires = now + timedelta(hours=INVITE_TTL_HOURS)
    await db.staff_invites.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id, "email": email,
        "token_hash": _hash(token), "invited_by": invited_by,
        "expires_at": expires.isoformat(), "used_at": None, "revoked_at": None,
        "created_at": now.isoformat(),
    })
    return {"token": token, "expires_at": expires.isoformat()}


async def find_valid_invite(token: str) -> dict | None:
    invite = await db.staff_invites.find_one({"token_hash": _hash(token)})
    if not invite or invite.get("used_at") or invite.get("revoked_at"):
        return None
    if invite["expires_at"] < datetime.now(timezone.utc).isoformat():
        return None
    return invite


async def consume_invite(invite_id: str) -> None:
    await db.staff_invites.update_one(
        {"id": invite_id}, {"$set": {"used_at": datetime.now(timezone.utc).isoformat()}})
