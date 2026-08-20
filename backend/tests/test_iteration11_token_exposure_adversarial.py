"""Iteration 11 adversarial probes for the browser-detection heuristic used by
_is_browser() / _auth_response() in backend/server.py.

We try to break the browser detection so a browser-shaped caller sneaks a token
into the response body, or so a legit CLI caller stops getting one.
"""
import os
import re
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://taxsimba-foundation.preview.emergentagent.com").rstrip("/")
APPROVED_ORIGIN = "https://taxsimba-foundation.preview.emergentagent.com"

CLIENT = {"email": "clienta@example.com", "password": "Client@123"}

JWT_RE = re.compile(r"eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+")


def _login(headers):
    return requests.post(f"{BASE_URL}/api/auth/login", json=CLIENT, headers=headers, timeout=15)


def _assert_no_token(body_json, raw_text):
    assert "access_token" not in body_json, "browser body leaked access_token"
    assert "refresh_token" not in body_json, "browser body leaked refresh_token"
    assert not JWT_RE.search(raw_text), "browser body contains a JWT substring"
    assert list(body_json.keys()) == ["user"], f"unexpected body keys: {list(body_json.keys())}"


class TestBrowserDetectionAdversarial:
    def test_origin_only(self):
        r = _login({"Origin": APPROVED_ORIGIN})
        assert r.status_code == 200
        _assert_no_token(r.json(), r.text)

    def test_sec_fetch_mode_only_no_origin(self):
        # No Origin header, only Sec-Fetch-Mode. Still browser-shaped -> no token.
        r = _login({"Sec-Fetch-Mode": "cors"})
        assert r.status_code == 200
        _assert_no_token(r.json(), r.text)

    def test_full_browser_headers(self):
        r = _login({
            "Origin": APPROVED_ORIGIN,
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "Referer": f"{APPROVED_ORIGIN}/login",
            "User-Agent": "Mozilla/5.0",
        })
        assert r.status_code == 200
        _assert_no_token(r.json(), r.text)

    def test_referer_only_is_NOT_treated_as_browser(self):
        """DOCUMENTED gap: server only inspects Origin and Sec-Fetch-Mode. A caller that
        sends Referer only (and no Origin/Sec-Fetch) is treated as a CLI and DOES get
        access_token in body. This is acceptable because real browsers always send
        Origin on POSTs, but we pin the behaviour here so any future change is intentional."""
        r = _login({"Referer": f"{APPROVED_ORIGIN}/login", "User-Agent": "Mozilla/5.0"})
        assert r.status_code == 200
        body = r.json()
        # Confirm the current design: not detected as browser -> token IS returned.
        assert "access_token" in body, (
            "Referer-only was previously treated as CLI; if this now returns no token "
            "that's a design change worth flagging."
        )

    def test_pure_cli_still_gets_bearer_and_it_works(self):
        # No Origin, no Sec-Fetch-Mode: pure CLI. Must still get access_token.
        r = requests.post(f"{BASE_URL}/api/auth/login", json=CLIENT,
                          headers={"User-Agent": "curl/8.0"}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body and body["access_token"]
        token = body["access_token"]
        me = requests.get(f"{BASE_URL}/api/auth/me",
                          headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert me.status_code == 200
        assert me.json()["email"] == CLIENT["email"]

    def test_browser_login_cookie_only_session_works(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login", json=CLIENT,
                   headers={"Origin": APPROVED_ORIGIN, "Sec-Fetch-Mode": "cors"}, timeout=15)
        assert r.status_code == 200
        _assert_no_token(r.json(), r.text)
        # cookie-only /me works
        me = s.get(f"{BASE_URL}/api/auth/me",
                   headers={"Origin": APPROVED_ORIGIN, "Sec-Fetch-Mode": "cors"}, timeout=15)
        assert me.status_code == 200
        assert me.json()["email"] == CLIENT["email"]

    def test_browser_refresh_rotates_and_leaks_nothing(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login", json=CLIENT,
                   headers={"Origin": APPROVED_ORIGIN, "Sec-Fetch-Mode": "cors"}, timeout=15)
        assert r.status_code == 200
        old_refresh = s.cookies.get("refresh_token")
        assert old_refresh
        rr = s.post(f"{BASE_URL}/api/auth/refresh",
                    headers={"Origin": APPROVED_ORIGIN, "Sec-Fetch-Mode": "cors"}, timeout=15)
        assert rr.status_code == 200
        _assert_no_token(rr.json(), rr.text)
        new_refresh = s.cookies.get("refresh_token")
        assert new_refresh and new_refresh != old_refresh, "refresh cookie was not rotated"
        # Replaying the OLD refresh must fail.
        replay = requests.post(
            f"{BASE_URL}/api/auth/refresh",
            headers={"Origin": APPROVED_ORIGIN, "Sec-Fetch-Mode": "cors",
                     "Cookie": f"refresh_token={old_refresh}"},
            timeout=15,
        )
        assert replay.status_code == 401, f"old refresh should be revoked, got {replay.status_code}"


class TestCookieAttributes:
    def test_login_sets_httponly_secure_samesite_on_both_cookies(self):
        r = _login({"Origin": APPROVED_ORIGIN, "Sec-Fetch-Mode": "cors"})
        assert r.status_code == 200
        set_cookies = r.raw.headers.getlist("Set-Cookie") if hasattr(r.raw.headers, "getlist") else r.headers.get("Set-Cookie", "").split(",")
        joined = " || ".join(set_cookies).lower()
        for name in ("access_token", "refresh_token"):
            assert name in joined, f"{name} cookie not set: {joined}"
        assert "httponly" in joined
        assert "secure" in joined
        assert "samesite=" in joined
