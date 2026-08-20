import os
import uuid
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import HTTPException, Request

from db import db

JWT_ALGORITHM = "HS256"

ROLES = ["CLIENT", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"]

ACCESS_TTL_MINUTES = 15
REFRESH_TTL_DAYS = 7
ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TTL_MINUTES),
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


async def issue_refresh_token(user_id: str) -> str:
    """Create a refresh token and register its jti so it can be rotated/revoked."""
    jti = str(uuid.uuid4())
    expires = datetime.now(timezone.utc) + timedelta(days=REFRESH_TTL_DAYS)
    await db.refresh_tokens.insert_one({
        "jti": jti, "user_id": user_id, "created_at": datetime.now(timezone.utc),
        "expires_at": expires, "revoked_at": None, "replaced_by": None,
    })
    payload = {"sub": user_id, "type": "refresh", "jti": jti, "exp": expires}
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


async def rotate_refresh_token(token: str) -> tuple:
    """Validate a refresh token, revoke it, and issue a replacement (rotation).

    A revoked/unknown jti is rejected, so a stolen refresh token stops working as soon as
    the legitimate session rotates or logs out.
    """
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid session")
    record = await db.refresh_tokens.find_one({"jti": payload.get("jti")})
    if not record or record.get("revoked_at"):
        raise HTTPException(status_code=401, detail="Session revoked")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Not authenticated")
    new_token = await issue_refresh_token(user["id"])
    new_jti = jwt.decode(new_token, _secret(), algorithms=[JWT_ALGORITHM])["jti"]
    await db.refresh_tokens.update_one(
        {"jti": payload["jti"]},
        {"$set": {"revoked_at": datetime.now(timezone.utc), "replaced_by": new_jti}},
    )
    return user, new_token


async def revoke_refresh_token(token: str):
    if not token:
        return
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM],
                             options={"verify_exp": False})
    except jwt.InvalidTokenError:
        return
    if payload.get("jti"):
        await db.refresh_tokens.update_one(
            {"jti": payload["jti"]}, {"$set": {"revoked_at": datetime.now(timezone.utc)}})


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        header = request.headers.get("Authorization", "")
        if header.startswith("Bearer "):
            token = header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="User not found")
    user.pop("_id", None)
    user.pop("password_hash", None)
    return user


def require_roles(*roles):
    async def dep(request: Request):
        user = await get_current_user(request)
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user

    return dep


def is_staff(user: dict) -> bool:
    return user["role"] in ("ACCOUNTANT", "ADMIN", "SUPER_ADMIN")


def is_admin(user: dict) -> bool:
    return user["role"] in ("ADMIN", "SUPER_ADMIN")
