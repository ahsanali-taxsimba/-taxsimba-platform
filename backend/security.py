"""Staff two-factor authentication (TOTP) and shared security controls.

TOTP secrets are encrypted at rest with Fernet, never hashed (the server must derive future
codes) and never logged. Recovery codes are bcrypt-hashed and single use. The client login
flow is untouched -- only staff accounts with 2FA enabled receive a challenge.
"""
import os
import secrets as pysecrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
import pyotp
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException

from db import db

ISSUER = os.environ.get("TOTP_ISSUER", "TaxSimba")
CHALLENGE_TTL_MINUTES = 5
STAFF_ROLES = ("ACCOUNTANT", "ADMIN", "SUPER_ADMIN")
MFA_REQUIRED_ROLES = ("ADMIN", "SUPER_ADMIN")


def _fernet() -> Fernet:
    return Fernet(os.environ["TOTP_FERNET_KEY"].encode())


def new_secret(email: str):
    secret = pyotp.random_base32(length=32)
    uri = pyotp.TOTP(secret, interval=30, digits=6).provisioning_uri(name=email,
                                                                    issuer_name=ISSUER)
    return secret, uri


def encrypt_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode()).decode()


def decrypt_secret(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        raise HTTPException(status_code=500, detail="Two-factor configuration unavailable")


def verify_code(secret: str, code: str, last_step):
    """Returns (ok, step). A step is never accepted twice, so a code cannot be replayed."""
    code = (code or "").strip()
    if not (code.isdigit() and len(code) == 6):
        return False, None
    totp = pyotp.TOTP(secret, interval=30, digits=6)
    now_step = int(datetime.now(timezone.utc).timestamp() // 30)
    for offset in (-1, 0, 1):  # one step of clock skew either side
        step = now_step + offset
        if step != last_step and totp.verify(code, for_time=step * 30, valid_window=0):
            return True, step
    return False, None


def generate_recovery_codes(count: int = 10):
    codes = [pysecrets.token_urlsafe(16) for _ in range(count)]
    hashes = [bcrypt.hashpw(c.encode(), bcrypt.gensalt()).decode() for c in codes]
    return codes, hashes


def match_recovery_code(code: str, hashes: list) -> int | None:
    for i, stored in enumerate(hashes or []):
        try:
            if bcrypt.checkpw((code or "").encode(), stored.encode()):
                return i
        except ValueError:
            continue
    return None


def create_challenge(user_id: str) -> str:
    payload = {"sub": user_id, "type": "2fa_challenge", "jti": pysecrets.token_urlsafe(16),
               "exp": datetime.now(timezone.utc) + timedelta(minutes=CHALLENGE_TTL_MINUTES)}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm="HS256")


async def consume_challenge(token: str) -> str:
    """Validates a challenge and claims its jti so it can only ever be used once."""
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="This sign-in attempt has expired")
    if payload.get("type") != "2fa_challenge" or not payload.get("jti"):
        raise HTTPException(status_code=401, detail="Invalid sign-in attempt")
    try:
        await db.used_2fa_challenges.insert_one({
            "jti": payload["jti"],
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=CHALLENGE_TTL_MINUTES)})
    except Exception:
        raise HTTPException(status_code=401, detail="This sign-in attempt has already been used")
    return payload["sub"]


async def ensure_indexes():
    await db.used_2fa_challenges.create_index("jti", unique=True)
    await db.used_2fa_challenges.create_index("expires_at", expireAfterSeconds=0)


# ------------------------------------------------------------------ password policy
COMMON = {"password", "password1", "12345678", "qwerty123", "letmein1", "taxsimba",
          "welcome1", "admin123", "changeme"}


def check_password_strength(password: str, email: str = "", name: str = ""):
    """Raises 400 when a password is too weak. Applied wherever a password is set."""
    pw = password or ""
    if len(pw) < 12:
        raise HTTPException(status_code=400,
                            detail="Password must be at least 12 characters long")
    classes = sum([any(c.islower() for c in pw), any(c.isupper() for c in pw),
                   any(c.isdigit() for c in pw), any(not c.isalnum() for c in pw)])
    if classes < 3:
        raise HTTPException(
            status_code=400,
            detail="Password must combine at least three of: lower case, upper case, "
                   "numbers and symbols")
    lowered = pw.lower()
    if lowered in COMMON or any(w and w in lowered for w in COMMON):
        raise HTTPException(status_code=400, detail="This password is too easy to guess")
    local = (email or "").split("@")[0].lower()
    if local and len(local) > 2 and local in lowered:
        raise HTTPException(status_code=400,
                            detail="Password must not contain your email address")
    for part in (name or "").lower().split():
        if len(part) > 2 and part in lowered:
            raise HTTPException(status_code=400,
                                detail="Password must not contain your name")
