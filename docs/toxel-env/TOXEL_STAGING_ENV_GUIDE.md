# TaxSimba — Toxel Staging Environment Guide

**Branch:** `cursor/p0-uat-corrections-80a7`  
**Documentation based on audit of SHA:** `d60141e44edd4a646765130f4a907cd0fd686447`  
**Frozen P0 (do not modify):** `taxsimba-p0-integration` @ `bded699aaa048bd44aea5334dea2ea71c6e0c1c0`

Launch applications only:

- `backend-node/`
- `tax_simba_frontend/`
- `tax_simba_admin_frontend/`

Safe templates in this folder:

- `backend.staging.env.example`
- `client.staging.env.example`
- `admin.staging.env.example`

**Never commit real secrets. Never put production credentials in git or examples.**  
Staging must use a **separate staging database**. Stripe must remain **TEST mode** during UAT.

---

## A. Toxel configures / non-secrets

Toxel may set these for the staging environment (use real staging hostnames, not production):

| Area | Variables |
| --- | --- |
| Runtime | `PORT`, `DB_NAME` |
| Cookies | `COOKIE_SECURE=true`, `COOKIE_SAMESITE=lax` |
| CORS / proxy | `CORS_ORIGINS` (client **and** admin origins), `CORS_DEV_ORIGINS`, `TRUSTED_PROXY_CIDRS` |
| Email public | `EMAIL_DRIVER`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_MAX_ATTEMPTS`, `CONTACT_TO`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` |
| URLs | `APP_BASE_URL` (= **client** public origin), client/admin `NEXTAUTH_URL`, `NEXT_PUBLIC_API_URL`, `API_URL`, `BACKEND_URL`, `NEXT_PUBLIC_BASE_URL`, `NEXTAUTH_TRUST_HOST`, `NEXT_PUBLIC_IS_STAGING` |
| Seed | `SEED_DEMO_DATA=false` |
| Storage non-secret | `STORAGE_DRIVER`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, `LOCAL_STORAGE_DIR` (if local) |
| Limits | `API_RATE_LIMIT_PER_MINUTE=300`, `MAX_UPLOAD_MB=25`, `REMINDERS_ENABLED=false` |
| MFA label | `TOTP_ISSUER=TaxSimba` |
| Stripe publishable | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_test_…` only) |

---

## B. TaxSimba supplies securely / secrets

Provide these **out-of-band** (not via git commits). Placeholders in examples use `<SUPPLY_SECURELY>`:

| Application | Secret variables |
| --- | --- |
| Backend | `MONGO_URL`, `JWT_SECRET` |
| Backend Stripe TEST | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Backend email (choose one driver) | `SMTP_USER` + `SMTP_PASSWORD` **or** `RESEND_API_KEY` |
| Backend storage (if `STORAGE_DRIVER=s3`) | `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` |
| Backend MFA (if staff MFA used) | `TOTP_FERNET_KEY` |
| Client | `NEXTAUTH_SECRET` |
| Admin | `NEXTAUTH_SECRET` |

Do **not** put production keys into staging. Use staging Mongo, Stripe **test** keys, and staging storage credentials.

---

## C. Optional variables

- `CONTACT_TO` — Contact Us inbox override  
- `EMAIL_REPLY_TO`, `EMAIL_MAX_ATTEMPTS`  
- `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`  
- `LOCAL_STORAGE_DIR` only if using `STORAGE_DRIVER=local`  
- `CORS_DEV_ORIGINS`  
- Reminder worker vars — leave `REMINDERS_ENABLED=false` unless TaxSimba asks to enable on one instance  
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_NODE_JS_URL`  
- Chatbot / translate / SimbaX (`OPENAI_API_KEY`, `GOOGLE_TRANSLATE_API_KEY`, `NEXT_PUBLIC_SIMBAX_PLATFORM_URL`) — **not a P0 staging gate**; omit unless explicitly enabled  

---

## D. Email verification requirements

**Why staging may show no inbox delivery:**  
In `backend-node`, `EMAIL_DRIVER` defaults to **`none`** when unset. `queueEmail()` then returns immediately — registration succeeds but **no verification email is sent**.

For a **real** verification email to a controlled staging inbox:

1. Set `EMAIL_DRIVER` to `smtp` **or** `resend` (not `none`, not unset).  
2. Set `EMAIL_FROM` to a verified sender for that provider.  
3. Set matching credentials:
   - SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, **`SMTP_PASSWORD`** (name confirmed in source — not `SMTP_PASS`)
   - Resend: `RESEND_API_KEY`
4. Set `APP_BASE_URL` to the **staging client public origin** (e.g. `https://staging-client.example.com`).  
   Verification links are built as: `{APP_BASE_URL}/verify-email?token=…`  
   Must **not** be localhost, admin origin, or API host.

Optional: `EMAIL_REPLY_TO`, `EMAIL_MAX_ATTEMPTS` (default 5).

Contact Us (`POST /api/compat/contact-us`) also needs a working email driver; inbox = `CONTACT_TO` → else `EMAIL_REPLY_TO` → else address in `EMAIL_FROM`.

---

## E. Stripe TEST requirements

Backend:

```text
STRIPE_SECRET_KEY=<SUPPLY_SECURELY>       # sk_test_...
STRIPE_WEBHOOK_SECRET=<SUPPLY_SECURELY>   # whsec_...
```

**Native webhook endpoint (backend):**

```text
POST /api/stripe/webhook
```

Configure the Stripe **TEST** webhook to that backend URL. Do not point webhooks at the Next.js frontends.

Client optional:

```text
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

UAT must use **TEST mode only**. Do not use live keys.

---

## F. Profile / document storage requirements

Before accepting profile-image or document persistence on staging:

```text
STORAGE_DRIVER=s3
S3_BUCKET=...
S3_REGION=...
S3_ACCESS_KEY_ID=<SUPPLY_SECURELY>
S3_SECRET_ACCESS_KEY=<SUPPLY_SECURELY>
```

Optional: `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE=true`.

Alternative for isolated local-only environments: `STORAGE_DRIVER=local` + `LOCAL_STORAGE_DIR` (not typical for shared staging).

Without storage credentials, uploads and profile photo persistence must be treated as **CONFIG_BLOCKED**, not product defects.

---

## G. Client / admin URL rules

| Rule | Correct value |
| --- | --- |
| Compat API base | `https://<STAGING-API-HOST>/api/compat/` — **trailing slash REQUIRED** |
| Client `NEXT_PUBLIC_API_URL` / `API_URL` | same compat base with trailing slash |
| Admin `NEXT_PUBLIC_API_URL` / `BACKEND_URL` | same compat base with trailing slash |
| Backend `APP_BASE_URL` | **client** public origin only |
| Client `NEXTAUTH_URL` | client public origin (no `/admin`) |
| Admin `NEXTAUTH_URL` | admin public origin **including `/admin`** (hardcoded `basePath: '/admin'`) |
| `CORS_ORIGINS` | **both** client and admin origins, comma-separated, no `*` |
| `SEED_DEMO_DATA` | exactly `false` |

Admin logout/signin must stay on the admin host. If `NEXTAUTH_URL` omits `/admin` or points at the client origin, redirects break (404 / wrong host).

---

## H. Pre-deployment checklist

- [ ] Deploy **only** branch `cursor/p0-uat-corrections-80a7` (do not merge SEO/PPC or frozen P0)  
- [ ] Apps: `backend-node`, `tax_simba_frontend`, `tax_simba_admin_frontend`  
- [ ] Staging Mongo DB only (`MONGO_URL` / `DB_NAME`)  
- [ ] `SEED_DEMO_DATA=false`  
- [ ] `CORS_ORIGINS` includes client **and** admin  
- [ ] `APP_BASE_URL` = client staging origin  
- [ ] Client `NEXTAUTH_URL` = client origin  
- [ ] Admin `NEXTAUTH_URL` includes `/admin`  
- [ ] Compat API URLs end with `/api/compat/`  
- [ ] `EMAIL_DRIVER` is `smtp` or `resend` if verifying inbox delivery  
- [ ] Stripe TEST secret + webhook secret set; webhook → `POST /api/stripe/webhook`  
- [ ] Storage configured before profile/document persistence tests  
- [ ] All `<SUPPLY_SECURELY>` secrets received from TaxSimba out-of-band  
- [ ] Restored admin public assets present (`logo.svg`, `logo-icon.svg`, favicons, `login-img.png`)  

---

## I. Post-deployment smoke test

1. Client site loads without localhost / unexplained API errors.  
2. Admin `/admin` loads (logo/login artwork render).  
3. Client login/session works.  
4. Staff login/session works.  
5. Admin logout/signin stays on correct admin host — never localhost / wrong client port.  
6. Public package catalogue loads.  
7. Approved SA/MTD prices load from backend.  
8. Stripe TEST checkout creates the correct amount for the selected package.  
9. Stripe TEST webhook reaches backend `POST /api/stripe/webhook`.  
10. Registration verification email reaches a real controlled inbox.  
11. Verification link returns to the correct **staging client** origin.  
12. Profile image persists after refresh / re-login.  
13. Document upload persists.  
14. Browser network: no unexplained 404 / 401 / 403 / CORS failures on happy-path journeys.  
15. No demo users/data seeded (`SEED_DEMO_DATA=false`).  

If any step fails: capture screenshot/video + network evidence + exact deploy SHA **before** changing code.

---

## Absolute prohibitions

- Do not commit secrets or production credentials.  
- Do not merge into `taxsimba-p0-integration`, `main`, SEO, or PPC branches from this handover.  
- Do not invent OpenAI / Translate / SimbaX credentials for P0 gate.  
- Do not claim production email/Stripe readiness without the smoke tests above.
