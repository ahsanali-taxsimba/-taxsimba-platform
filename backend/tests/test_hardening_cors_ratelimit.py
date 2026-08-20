"""Production hardening verification — CORS allowlist, login rate limiting / temporary
lockout, and JWT access+refresh session hardening. No product code is exercised beyond the
public API plus direct unit checks of the rate-limit policy module."""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta

import jwt
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
sys.path.insert(0, "/app/backend")

BASE = os.environ["REACT_APP_BACKEND_URL"] if os.environ.get("REACT_APP_BACKEND_URL") \
    else "https://taxsimba-foundation.preview.emergentagent.com"
API = f"{BASE}/api"

APPROVED_ORIGIN = "https://taxsimba-foundation.preview.emergentagent.com"
EVIL_ORIGIN = "https://attacker.example.com"

# CORS is an application-boundary control and is asserted directly against the app origin.
# The shared preview edge (Cloudflare) rewrites CORS headers on its own responses, so testing
# CORS through the public preview hostname measures the edge, not this application.
APP = "http://localhost:8001/api"

CREDS = {
    "client_a": ("clienta@example.com", "Client@123"),
    "acc_a": ("accountant.a@taxsimba.co.uk", "Account@123"),
    "acc_b": ("accountant.b@taxsimba.co.uk", "Account@123"),
    "acc_c": ("accountant.c@taxsimba.co.uk", "Account@123"),
    "admin": ("admin@taxsimba.co.uk", "Admin@123"),
    "super": ("superadmin@taxsimba.co.uk", "Super@123"),
}


def _login(email, pw, session=None):
    poster = session or requests
    return poster.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)


@pytest.fixture(scope="module")
def super_token():
    r = _login(*CREDS["super"])
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _mk_user(super_token, pw="Hard@1234"):
    email = f"TEST_hard_{uuid.uuid4().hex[:8]}@example.com".lower()
    r = requests.post(f"{API}/users",
                      json={"email": email, "password": pw, "name": "TEST Hardening",
                            "role": "CLIENT"},
                      headers={"Authorization": f"Bearer {super_token}"}, timeout=30)
    assert r.status_code == 200, r.text
    return email, pw


# ============================================================ CORS
class TestCors:
    def test_no_wildcard_origin_returned(self):
        r = requests.get(f"{APP}/auth/me", headers={"Origin": APPROVED_ORIGIN}, timeout=30)
        assert r.headers.get("access-control-allow-origin") != "*", \
            "wildcard CORS origin is still being returned"

    def test_approved_origin_allowed(self):
        r = requests.options(
            f"{APP}/auth/login",
            headers={"Origin": APPROVED_ORIGIN, "Access-Control-Request-Method": "POST"},
            timeout=30)
        assert r.headers.get("access-control-allow-origin") == APPROVED_ORIGIN
        assert r.headers.get("access-control-allow-credentials") == "true"

    def test_unapproved_origin_rejected(self):
        r = requests.options(
            f"{APP}/auth/login",
            headers={"Origin": EVIL_ORIGIN, "Access-Control-Request-Method": "POST"},
            timeout=30)
        assert r.status_code == 400
        assert r.headers.get("access-control-allow-origin") not in (EVIL_ORIGIN, "*"), \
            "unapproved origin was granted CORS access"

    def test_env_has_no_wildcard(self):
        raw = os.environ["CORS_ORIGINS"]
        assert raw.strip() and "*" not in raw

    def test_startup_guard_rejects_wildcard_and_empty(self, monkeypatch):
        import server
        for bad in ("*", "", "  ", "https://a.example.com,*"):
            monkeypatch.setenv("CORS_ORIGINS", bad)
            with pytest.raises(RuntimeError):
                server._allowed_origins()
        monkeypatch.setenv("CORS_ORIGINS", "https://a.example.com,https://b.example.com")
        assert server._allowed_origins() == ["https://a.example.com", "https://b.example.com"]


# ============================================================ rate limit / lockout
class TestLoginRateLimit:
    def test_five_failures_then_429_with_retry_after(self, super_token):
        email, pw = _mk_user(super_token)
        for i in range(5):
            r = _login(email, "WrongPass!1")
            assert r.status_code == 401, f"attempt {i + 1} expected 401, got {r.status_code}"
        r = _login(email, "WrongPass!1")
        assert r.status_code == 429, f"6th failed attempt should be 429, got {r.status_code}"
        assert r.headers.get("Retry-After"), "429 must carry a Retry-After header"
        assert int(r.headers["Retry-After"]) > 0

    def test_lock_applies_even_to_correct_password(self, super_token):
        email, pw = _mk_user(super_token)
        for _ in range(5):
            assert _login(email, "WrongPass!1").status_code == 401
        r = _login(email, pw)
        assert r.status_code == 429, \
            "a locked account must not be unlockable by supplying the correct password"

    def test_other_account_unaffected_by_lock(self, super_token):
        victim, _ = _mk_user(super_token)
        for _ in range(5):
            _login(victim, "WrongPass!1")
        assert _login(victim, "WrongPass!1").status_code == 429
        r = _login(*CREDS["client_a"])
        assert r.status_code == 200, "lockout must be scoped, not global"

    def test_success_clears_counters(self, super_token):
        email, pw = _mk_user(super_token)
        for _ in range(3):
            assert _login(email, "WrongPass!1").status_code == 401
        assert _login(email, pw).status_code == 200
        # counters cleared -> a further 3 failures must still not lock (would be 6 if kept)
        for _ in range(3):
            assert _login(email, "WrongPass!1").status_code == 401
        assert _login(email, pw).status_code == 200

    def test_disabled_account_failure_is_not_counted(self, super_token):
        email, pw = _mk_user(super_token)
        h = {"Authorization": f"Bearer {super_token}"}
        uid = requests.get(f"{API}/users?role=CLIENT", headers=h, timeout=30).json()
        uid = [u for u in uid if u["email"] == email][0]["id"]
        assert requests.patch(f"{API}/users/{uid}/active?is_active=false",
                              headers=h, timeout=30).status_code == 200
        for _ in range(7):
            r = _login(email, pw)
            assert r.status_code == 401, \
                f"correct password on a disabled account must stay 401, got {r.status_code}"


# ============================================================ policy module (multi-IP scopes)
class TestRateLimitPolicy:
    """Account-wide and per-IP scopes cannot be exercised from a single test host, so they
    are verified directly against the MongoDB-backed policy module."""

    def test_scope_thresholds(self):
        from ratelimit import BACKOFF_MINUTES, SCOPES
        assert SCOPES["ip_email"][0] == 5
        assert SCOPES["account"][0] == 10
        assert SCOPES["ip"][0] == 50
        assert BACKOFF_MINUTES == [15, 30, 60]

    def test_account_scope_locks_across_ips(self):
        from fastapi import HTTPException
        from ratelimit import clear_failures, enforce_login_allowed, record_failure

        email = f"policy_{uuid.uuid4().hex[:8]}@example.com"

        async def run():
            # 9 failures from 9 distinct IPs -> under the account threshold of 10
            for i in range(9):
                await record_failure(f"203.0.113.{i + 1}", email)
            await enforce_login_allowed("203.0.113.200", email)  # must not raise
            await record_failure("203.0.113.10", email)          # 10th -> account lock
            with pytest.raises(HTTPException) as ex:
                await enforce_login_allowed("203.0.113.201", email)
            assert ex.value.status_code == 429
            assert ex.value.headers["Retry-After"]
            for i in range(12):
                await clear_failures(f"203.0.113.{i + 1}", email)
            await clear_failures("203.0.113.200", email)
            await clear_failures("203.0.113.201", email)

        asyncio.get_event_loop().run_until_complete(run())

    def test_exponential_backoff(self):
        from db import db
        from ratelimit import clear_failures, record_failure

        email = f"backoff_{uuid.uuid4().hex[:8]}@example.com"
        ip = "203.0.113.77"

        async def run():
            seen = []
            for offence in range(3):
                for _ in range(5):
                    await record_failure(ip, email)
                doc = await db.login_attempts.find_one({"scope": "ip_email", "key": f"{ip}|{email}"})
                locked = doc["locked_until"]
                if locked.tzinfo is None:
                    locked = locked.replace(tzinfo=timezone.utc)
                seen.append(round((locked - datetime.now(timezone.utc)).total_seconds() / 60))
                await db.login_attempts.update_one(
                    {"scope": "ip_email", "key": f"{ip}|{email}"},
                    {"$set": {"locked_until": None}})
            assert seen == [15, 30, 60], f"expected 15/30/60 minute backoff, got {seen}"
            await clear_failures(ip, email)

        asyncio.get_event_loop().run_until_complete(run())

    def test_xff_only_trusted_from_proxy_cidrs(self):
        from unittest.mock import Mock
        from ratelimit import client_ip

        def req(peer, xff):
            r = Mock()
            r.client = Mock(host=peer)
            r.headers = {"x-forwarded-for": xff} if xff else {}
            return r

        # untrusted public peer -> its spoofed XFF is ignored entirely
        assert client_ip(req("198.51.100.9", "1.2.3.4")) == "198.51.100.9"
        # trusted in-cluster proxy -> right-most (proxy-appended) hop is used, not the
        # left-most value a client could have injected
        assert client_ip(req("10.1.2.3", "1.2.3.4, 203.0.113.5")) == "203.0.113.5"
        assert client_ip(req("10.1.2.3", None)) == "10.1.2.3"


# ============================================================ JWT / session hardening
class TestSessionHardening:
    def test_access_token_is_short_lived(self):
        r = _login(*CREDS["client_a"])
        assert r.status_code == 200
        payload = jwt.decode(r.json()["access_token"], options={"verify_signature": False})
        ttl = datetime.fromtimestamp(payload["exp"], timezone.utc) - datetime.now(timezone.utc)
        assert timedelta(minutes=5) < ttl <= timedelta(minutes=20), \
            f"access token TTL should be ~15 minutes, got {ttl}"
        assert payload["type"] == "access"

    def test_login_sets_httponly_access_and_refresh_cookies(self):
        s = requests.Session()
        r = _login(*CREDS["client_a"], session=s)
        assert r.status_code == 200
        raw = r.headers.get("set-cookie", "")
        assert "access_token=" in raw and "refresh_token=" in raw
        assert raw.lower().count("httponly") >= 2, "both session cookies must be httpOnly"
        assert "access_token" in s.cookies and "refresh_token" in s.cookies

    def test_refresh_issues_new_access_token(self):
        s = requests.Session()
        assert _login(*CREDS["client_a"], session=s).status_code == 200
        r = s.post(f"{API}/auth/refresh", timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["access_token"]
        assert s.get(f"{API}/auth/me", timeout=30).status_code == 200

    def test_refresh_token_rotation_revokes_the_old_one(self):
        s = requests.Session()
        assert _login(*CREDS["client_a"], session=s).status_code == 200
        old = s.cookies["refresh_token"]
        assert s.post(f"{API}/auth/refresh", timeout=30).status_code == 200
        new = s.cookies["refresh_token"]
        assert new != old, "refresh token must rotate"
        replay = requests.post(f"{API}/auth/refresh", cookies={"refresh_token": old}, timeout=30)
        assert replay.status_code == 401, \
            "a rotated (already used) refresh token must be revoked and unusable"

    def test_refresh_token_cannot_be_used_as_access_token(self):
        s = requests.Session()
        assert _login(*CREDS["client_a"], session=s).status_code == 200
        rt = s.cookies["refresh_token"]
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {rt}"}, timeout=30)
        assert r.status_code == 401, "a refresh token must never authenticate an API call"

    def test_logout_revokes_the_session(self):
        s = requests.Session()
        assert _login(*CREDS["client_a"], session=s).status_code == 200
        rt = s.cookies["refresh_token"]
        assert s.post(f"{API}/auth/logout", timeout=30).status_code == 200
        assert requests.post(f"{API}/auth/refresh", cookies={"refresh_token": rt},
                             timeout=30).status_code == 401, \
            "logout must revoke the refresh token so the session cannot be resumed"

    def test_expired_access_token_rejected(self):
        forged = jwt.encode(
            {"sub": "x", "email": "x@x.com", "type": "access",
             "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
            os.environ["JWT_SECRET"], algorithm="HS256")
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {forged}"}, timeout=30)
        assert r.status_code == 401

    def test_no_password_hash_in_login_response(self):
        r = _login(*CREDS["admin"])
        assert "password_hash" not in r.text

    def test_frontend_does_not_store_token_in_localstorage(self):
        for path in ("/app/frontend/src/lib/api.js", "/app/frontend/src/context/AuthContext.jsx"):
            src = open(path).read()
            assert "setItem" not in src, f"{path} still writes an auth token to localStorage"


# ============================================================ all roles still log in
class TestAllRoleLogins:
    @pytest.mark.parametrize("role", list(CREDS))
    def test_role_login_and_me(self, role):
        email, pw = CREDS[role]
        r = _login(email, pw)
        assert r.status_code == 200, f"{role} login failed: {r.status_code} {r.text}"
        tok = r.json()["access_token"]
        me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"}, timeout=30)
        assert me.status_code == 200
        assert me.json()["email"] == email
