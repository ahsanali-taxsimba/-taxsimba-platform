"""Iteration 14 — 2FA, upload validation, password policy, security headers, pagination.

Uses the dedicated QA clients / accountant.c disposable staff account. Any 2FA enrolment is
cleaned up at the end so demo staff accounts are never left with two-factor on.
"""
import io
import os
import time
import uuid

import pyotp
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") \
    else open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip()
API = f"{BASE_URL}/api"

CREDS = {
    "CLIENT": ("clienta@example.com", "Client@123"),
    "CLIENT_B": ("clientb@example.com", "Client@123"),
    "ACC_A": ("accountant.a@taxsimba.co.uk", "Account@123"),
    "ACC_B": ("accountant.b@taxsimba.co.uk", "Account@123"),
    "ACC_C": ("accountant.c@taxsimba.co.uk", "Account@123"),
    "ADMIN": ("admin@taxsimba.co.uk", "Admin@123"),
    "SUPER": ("superadmin@taxsimba.co.uk", "Super@123"),
    "QA_A": ("qa.client.a@qa-taxsimba.example.com", "QaClient@123"),
}


def _login(email, password):
    return requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)


def _token(email, password):
    r = _login(email, password)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _auth(email, password):
    return {"Authorization": f"Bearer {_token(email, password)}"}


# ------------------------------------------------------------------ 1. Basic 4-role login
class TestBaselineLogin:
    def test_client_login_no_2fa(self):
        r = _login(*CREDS["CLIENT"])
        assert r.status_code == 200
        j = r.json()
        assert "access_token" in j and j.get("user", {}).get("role") == "CLIENT"
        assert "two_factor_required" not in j

    def test_accountant_login_no_2fa(self):
        j = _login(*CREDS["ACC_A"]).json()
        assert j.get("user", {}).get("role") == "ACCOUNTANT"

    def test_admin_login_no_2fa(self):
        # superadmin had 2FA removed after main-agent testing; both admin roles should
        # currently login without a challenge.
        j = _login(*CREDS["ADMIN"]).json()
        assert j.get("user", {}).get("role") == "ADMIN"
        assert "two_factor_required" not in j

    def test_super_admin_login_no_2fa(self):
        j = _login(*CREDS["SUPER"]).json()
        assert j.get("user", {}).get("role") == "SUPER_ADMIN"
        assert "two_factor_required" not in j


# ------------------------------------------------------------------ 2. Security headers
class TestSecurityHeaders:
    def test_headers_present_on_api(self):
        r = requests.get(f"{API}/auth/2fa/status",
                         headers=_auth(*CREDS["ACC_A"]), timeout=30)
        assert r.status_code == 200
        h = {k.lower(): v for k, v in r.headers.items()}
        for name in ["x-frame-options", "x-content-type-options",
                     "strict-transport-security", "referrer-policy",
                     "content-security-policy", "permissions-policy", "x-request-id"]:
            assert name in h, f"missing header {name}"


# ------------------------------------------------------------------ 3. Password policy
class TestPasswordPolicy:
    def _change(self, tok, current, new):
        return requests.post(f"{API}/my-profile/change-password",
                             headers={"Authorization": f"Bearer {tok}"},
                             json={"current_password": current, "new_password": new},
                             timeout=30)

    def test_rejects_short(self):
        tok = _token(*CREDS["QA_A"])
        r = self._change(tok, "QaClient@123", "Short1!a")
        assert r.status_code == 400
        assert "12" in r.text

    def test_rejects_common(self):
        tok = _token(*CREDS["QA_A"])
        r = self._change(tok, "QaClient@123", "Password1234!")
        assert r.status_code == 400

    def test_rejects_contains_email_local(self):
        tok = _token(*CREDS["QA_A"])
        # local part is "qa.client.a"
        r = self._change(tok, "QaClient@123", "Qa.Client.A-Strong99!")
        assert r.status_code == 400

    def test_strong_password_accepted_and_revokes_sessions(self):
        # Use a disposable brand-new QA client so we do not disturb QA_A.
        super_h = _auth(*CREDS["SUPER"])
        email = f"qa.pwtest.{uuid.uuid4().hex[:8]}@qa-taxsimba.example.com"
        old = "Original@Passw0rd!"
        create = requests.post(f"{API}/auth/register",
                               json={"email": email, "name": "PW Tester",
                                     "password": old, "phone": "+441000000000"},
                               timeout=30)
        assert create.status_code == 200, create.text
        session_a = requests.Session()
        r = session_a.post(f"{API}/auth/login", json={"email": email, "password": old})
        assert r.status_code == 200
        tok_a = r.json()["access_token"]

        session_b = requests.Session()
        r2 = session_b.post(f"{API}/auth/login", json={"email": email, "password": old})
        tok_b = r2.json()["access_token"]

        new_pw = "V3ryStrongPass!x92"
        r = self._change(tok_b, old, new_pw)
        assert r.status_code == 200, r.text

        # Session A's refresh cookie should now be revoked (change-password revokes others).
        refresh_a = session_a.post(f"{API}/auth/refresh", timeout=30)
        assert refresh_a.status_code in (401, 403), \
            f"expected refresh to be revoked, got {refresh_a.status_code}"

        # Cleanup: deactivate the throwaway user
        try:
            uid = requests.get(f"{API}/users", headers=super_h, params={"role": "CLIENT"},
                               timeout=30).json()
            match = [u for u in uid if u.get("email") == email]
            if match:
                requests.delete(f"{API}/users/{match[0]['id']}", headers=super_h, timeout=30)
        except Exception:
            pass


# ------------------------------------------------------------------ 4. Upload validation
class TestUploadValidation:
    @pytest.fixture
    def case_id(self):
        h = _auth(*CREDS["QA_A"])
        r = requests.get(f"{API}/cases", headers=h, timeout=30)
        if r.status_code == 200 and r.json():
            return r.json()[0]["id"], h
        # Create a case on the fly.
        c = requests.post(f"{API}/cases", headers=h,
                          json={"service_type": "SELF_ASSESSMENT", "tax_year": "2024/25"},
                          timeout=30)
        assert c.status_code == 200, c.text
        return c.json()["id"], h

    def test_exe_rejected_415(self, case_id):
        cid, h = case_id
        r = requests.post(f"{API}/documents/upload", headers=h,
                          files={"file": ("bad.exe", b"MZ\x00\x00", "application/x-msdownload")},
                          data={"case_id": cid, "document_type": "Other"}, timeout=30)
        assert r.status_code == 415, r.text

    def test_html_rejected_415(self, case_id):
        cid, h = case_id
        r = requests.post(f"{API}/documents/upload", headers=h,
                          files={"file": ("x.html", b"<html>hi</html>", "text/html")},
                          data={"case_id": cid, "document_type": "Other"}, timeout=30)
        assert r.status_code == 415, r.text

    def test_empty_rejected_400(self, case_id):
        cid, h = case_id
        r = requests.post(f"{API}/documents/upload", headers=h,
                          files={"file": ("empty.pdf", b"", "application/pdf")},
                          data={"case_id": cid, "document_type": "Other"}, timeout=30)
        assert r.status_code == 400, r.text

    def test_oversize_rejected_413(self, case_id):
        cid, h = case_id
        big = b"%PDF-1.4\n" + b"0" * (26 * 1024 * 1024)
        r = requests.post(f"{API}/documents/upload", headers=h,
                          files={"file": ("big.pdf", big, "application/pdf")},
                          data={"case_id": cid, "document_type": "Other"}, timeout=60)
        assert r.status_code == 413, r.text

    def test_valid_pdf_uploads(self, case_id):
        cid, h = case_id
        content = b"%PDF-1.4\n%TEST\n" + b"0" * 1024
        r = requests.post(f"{API}/documents/upload", headers=h,
                          files={"file": ("ok.pdf", content, "application/pdf")},
                          data={"case_id": cid, "document_type": "Other"}, timeout=30)
        assert r.status_code == 200, r.text
        doc_id = r.json().get("id")
        v = requests.get(f"{API}/documents/{doc_id}/download", headers=h, timeout=30, allow_redirects=False)
        assert v.status_code in (200, 302, 307)


# ------------------------------------------------------------------ 5. 2FA lifecycle on accountant.c
class TestTwoFactor:
    """Full lifecycle. accountant.c is disposable and has no cases assigned."""

    _secret = {"v": None}

    def test_a_enrol_returns_qr_and_secret(self):
        h = _auth(*CREDS["ACC_C"])
        r = requests.post(f"{API}/auth/2fa/enrol", headers=h, timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "otpauth_uri" in j and j["otpauth_uri"].startswith("otpauth://")
        assert "manual_secret" in j and len(j["manual_secret"]) >= 16
        TestTwoFactor._secret["v"] = j["manual_secret"]

    def test_b_activate_returns_recovery_codes(self):
        secret = TestTwoFactor._secret["v"]
        assert secret
        h = _auth(*CREDS["ACC_C"])
        code = pyotp.TOTP(secret).now()
        r = requests.post(f"{API}/auth/2fa/activate", headers=h,
                          json={"code": code}, timeout=30)
        assert r.status_code == 200, r.text
        codes = r.json()["recovery_codes"]
        assert len(codes) == 10
        TestTwoFactor._secret["recovery"] = codes

    def test_c_login_now_returns_challenge_no_session(self):
        r = _login(*CREDS["ACC_C"])
        assert r.status_code == 200
        j = r.json()
        assert j.get("two_factor_required") is True
        assert "access_token" not in j
        assert "challenge" in j
        TestTwoFactor._secret["challenge"] = j["challenge"]

    def test_d_wrong_code_rejected(self):
        r = requests.post(f"{API}/auth/login/2fa",
                          json={"challenge": TestTwoFactor._secret["challenge"],
                                "code": "000000"}, timeout=30)
        assert r.status_code == 401

    def test_e_valid_code_issues_session(self):
        secret = TestTwoFactor._secret["v"]
        totp = pyotp.TOTP(secret)
        # Guarantee we're at a step later than the one recorded by activate().
        time.sleep(31)
        r = _login(*CREDS["ACC_C"])
        challenge = r.json()["challenge"]
        code = totp.now()
        r2 = requests.post(f"{API}/auth/login/2fa",
                           json={"challenge": challenge, "code": code}, timeout=30)
        assert r2.status_code == 200, r2.text
        assert "access_token" in r2.json()
        TestTwoFactor._secret["last_valid_code"] = code
        TestTwoFactor._secret["last_valid_challenge"] = challenge

    def test_f_challenge_cannot_be_replayed(self):
        r = requests.post(f"{API}/auth/login/2fa",
                          json={"challenge": TestTwoFactor._secret["last_valid_challenge"],
                                "code": pyotp.TOTP(TestTwoFactor._secret["v"]).now()},
                          timeout=30)
        assert r.status_code == 401, r.text

    def test_g_totp_code_cannot_be_used_twice(self):
        # Fresh challenge, reuse the exact code used in test_e (may still be in the same step
        # window or previous). Either way it must be rejected: same step → last_step guard,
        # different step → code no longer valid.
        r = _login(*CREDS["ACC_C"])
        challenge = r.json()["challenge"]
        r2 = requests.post(f"{API}/auth/login/2fa",
                           json={"challenge": challenge,
                                 "code": TestTwoFactor._secret["last_valid_code"]},
                           timeout=30)
        assert r2.status_code == 401

    def test_h_recovery_code_works_once(self):
        recovery = TestTwoFactor._secret["recovery"][0]
        r = _login(*CREDS["ACC_C"])
        challenge = r.json()["challenge"]
        r2 = requests.post(f"{API}/auth/login/2fa",
                           json={"challenge": challenge, "code": recovery}, timeout=30)
        assert r2.status_code == 200, r2.text
        # Second use of same recovery code
        r3 = _login(*CREDS["ACC_C"])
        challenge2 = r3.json()["challenge"]
        r4 = requests.post(f"{API}/auth/login/2fa",
                           json={"challenge": challenge2, "code": recovery}, timeout=30)
        assert r4.status_code == 401

    def test_i_client_login_unaffected(self):
        j = _login(*CREDS["CLIENT"]).json()
        assert "two_factor_required" not in j
        assert "access_token" in j

    def test_j_admin_cannot_disable_own_2fa(self):
        # Role guard fires before password/code checks, so we can just call as admin.
        h = _auth(*CREDS["ADMIN"])
        r = requests.post(f"{API}/auth/2fa/disable", headers=h,
                          json={"password": "Admin@123", "code": "000000"}, timeout=30)
        assert r.status_code == 403, r.text

    def test_k_super_admin_cannot_disable_own_2fa(self):
        h = _auth(*CREDS["SUPER"])
        r = requests.post(f"{API}/auth/2fa/disable", headers=h,
                          json={"password": "Super@123", "code": "000000"}, timeout=30)
        assert r.status_code == 403

    def test_l_accountant_can_disable(self):
        # accountant.c currently has 2FA on — disable with real password + valid TOTP code.
        secret = TestTwoFactor._secret["v"]
        totp = pyotp.TOTP(secret)
        time.sleep(31)
        challenge = _login(*CREDS["ACC_C"]).json()["challenge"]
        code = totp.now()
        r2 = requests.post(f"{API}/auth/login/2fa",
                           json={"challenge": challenge, "code": code}, timeout=30)
        assert r2.status_code == 200, r2.text
        tok = r2.json()["access_token"]

        time.sleep(31)
        code2 = totp.now()
        r = requests.post(f"{API}/auth/2fa/disable",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"password": CREDS["ACC_C"][1], "code": code2}, timeout=30)
        assert r.status_code == 200, r.text
        j = _login(*CREDS["ACC_C"]).json()
        assert "two_factor_required" not in j and "access_token" in j


# ------------------------------------------------------------------ 6. Pagination
class TestPagination:
    def test_cases_limit_skip(self):
        h = _auth(*CREDS["SUPER"])
        p1 = requests.get(f"{API}/cases", headers=h,
                          params={"limit": 2, "skip": 0, "include_test": "true"}, timeout=30)
        assert p1.status_code == 200
        j1 = p1.json()
        assert isinstance(j1, list) and len(j1) <= 2
        p2 = requests.get(f"{API}/cases", headers=h,
                          params={"limit": 2, "skip": 2, "include_test": "true"}, timeout=30)
        assert p2.status_code == 200
        j2 = p2.json()
        if j1 and j2:
            assert {c["id"] for c in j1}.isdisjoint({c["id"] for c in j2})

    def test_audit_limit_skip(self):
        h = _auth(*CREDS["SUPER"])
        p1 = requests.get(f"{API}/audit-log", headers=h,
                          params={"limit": 5, "skip": 0}, timeout=30)
        assert p1.status_code == 200
        j1 = p1.json()
        assert isinstance(j1, list) and len(j1) <= 5
        p2 = requests.get(f"{API}/audit-log", headers=h,
                          params={"limit": 5, "skip": 5}, timeout=30)
        assert p2.status_code == 200


# ------------------------------------------------------------------ Session cleanup: make
# absolutely sure no demo staff account is left with 2FA on. If a prior test failed midway we
# still want to strip totp/recovery_codes off any of the demo staff accounts.
@pytest.fixture(scope="module", autouse=True)
def _module_cleanup():
    yield
    try:
        import motor.motor_asyncio, asyncio
        MONGO_URL = os.environ.get("MONGO_URL")
        DB_NAME = os.environ.get("DB_NAME")
        if not MONGO_URL:
            with open("/app/backend/.env") as f:
                for line in f:
                    if line.startswith("MONGO_URL="):
                        MONGO_URL = line.split("=", 1)[1].strip().strip('"')
                    if line.startswith("DB_NAME="):
                        DB_NAME = line.split("=", 1)[1].strip().strip('"')

        async def strip():
            cli = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
            d = cli[DB_NAME]
            await d.users.update_many(
                {"email": {"$in": [
                    "accountant.a@taxsimba.co.uk", "accountant.b@taxsimba.co.uk",
                    "accountant.c@taxsimba.co.uk", "admin@taxsimba.co.uk",
                    "superadmin@taxsimba.co.uk"]}},
                {"$unset": {"totp": "", "recovery_code_hashes": "",
                            "recovery_codes_generated_at": ""}})
            cli.close()
        asyncio.run(strip())
    except Exception as e:
        print(f"cleanup warning: {e}")
