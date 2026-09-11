# TOXEL — START HERE FOR STAGING

This file is the **SINGLE SOURCE OF TRUTH** for the current TaxSimba staging deployment.

For staging, follow **THIS FILE** first.

Historical SHAs, freeze tips, old PR notes, old chat instructions and legacy folders must **not** be used to choose the deploy version.

Always deploy the **CURRENT HEAD** of:

`taxsimba-p0-integration`

---

## 1. CURRENT DEPLOYMENT SOURCE

**Branch:** `taxsimba-p0-integration`

**Instruction:** Always pull and deploy the latest/current HEAD of this branch.

Do **NOT** use the older historical freeze SHA printed in `TOXEL_HANDOVER.md` as the current deploy tip.

Confirm current HEAD:

```bash
git fetch origin
git checkout taxsimba-p0-integration
git pull origin taxsimba-p0-integration
git rev-parse HEAD
```

**Use the HEAD returned by `git rev-parse HEAD`.**

---

## 2. USE ONLY THESE 3 APPLICATIONS

**Backend:**  
`backend-node/`

**Client frontend:**  
`tax_simba_frontend/`

**Admin / Accountant / Super Admin frontend:**  
`tax_simba_admin_frontend/`

**DO NOT DEPLOY:**  
`frontend/`

`frontend/` is **legacy** and is **not** part of the current staging application.

---

## 3. WHAT HAS ALREADY BEEN VERIFIED

Latest verified status:

- Backend build: **PASS**
- Backend typecheck: **PASS**
- Backend tests: **PASS** — 29 files / 299 tests / 0 failures
- Client clean install/build: **PASS**
- Admin clean install/build: **PASS**
- Client API contract mapping: **PASS**
- Accountant API contract mapping: **PASS**
- Admin API contract mapping: **PASS**
- Super Admin security contract: **PASS**
- Stripe Checkout / fulfilment / webhook contract: **PASS**
- SA / MTD entitlement isolation: **PASS**
- No genuine code blocker found for Toxel staging

Earlier build blockers already resolved:

- missing frontend lockfiles
- missing react-toastify dependency
- admin prefer-const build error

`no-console` messages may still appear as warnings but are **not** the current build blocker.

---

## 4. BACKEND DEPLOYMENT

**Folder:** `backend-node/`

**Commands:**

```bash
cd backend-node
npm ci
npm run typecheck
npm test
npm run build
npm start
```

`npm test` is recommended before staging handoff acceptance.

**Backend default port:** `8002` if `PORT` is not set.

**Required staging environment variable names:**

```text
PORT
MONGO_URL
DB_NAME
JWT_SECRET
CORS_ORIGINS
COOKIE_SECURE
COOKIE_SAMESITE
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STORAGE_DRIVER
APP_BASE_URL
```

If `STORAGE_DRIVER=s3` also configure:

```text
S3_BUCKET
S3_REGION
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
```

Optional where applicable:

```text
S3_ENDPOINT
S3_FORCE_PATH_STYLE
```

If staff MFA is enabled:

```text
TOTP_FERNET_KEY
```

If email delivery is enabled: required SMTP/Resend variables for the configured email driver.

Do **not** put real secret values in this document or in git.

---

## 5. CLIENT FRONTEND DEPLOYMENT

**Folder:** `tax_simba_frontend/`

**Commands:**

```bash
cd tax_simba_frontend
npm ci
npm run build
npm start
```

**Required staging environment variables:**

```text
NEXT_PUBLIC_API_URL
API_URL
NEXTAUTH_URL
NEXTAUTH_SECRET
```

Set:

```text
NEXT_PUBLIC_API_URL=https://<STAGING-API-HOST>/api/compat/
```

**IMPORTANT:** Trailing slash is **REQUIRED**.

Set `API_URL` to the same compat API base for NextAuth server login:

```text
https://<STAGING-API-HOST>/api/compat/
```

`NEXTAUTH_URL`: set to the public URL of the deployed client frontend.

Optional where used:

```text
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
NEXTAUTH_TRUST_HOST
NEXT_PUBLIC_BASE_URL
```

Do **not** allow localhost fallback URLs to be used in staging. Staging env vars must be set correctly.

---

## 6. ADMIN / ACCOUNTANT FRONTEND DEPLOYMENT

**Folder:** `tax_simba_admin_frontend/`

**Commands:**

```bash
cd tax_simba_admin_frontend
npm ci
npm run build
npm start
```

**Required staging environment variables:**

```text
NEXT_PUBLIC_API_URL
BACKEND_URL
NEXTAUTH_URL
NEXTAUTH_SECRET
```

Set:

```text
NEXT_PUBLIC_API_URL=https://<STAGING-API-HOST>/api/compat/
```

Trailing slash **REQUIRED**.

Set `BACKEND_URL` to the same compat API base for staff NextAuth login:

```text
https://<STAGING-API-HOST>/api/compat/
```

`NEXTAUTH_URL`: set to the public URL of the deployed admin frontend.

Optional where used:

```text
API_URL
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_BASE_URL
NEXTAUTH_TRUST_HOST
```

Client and admin frontends both default to Next.js port **3000** locally, so they must run on **separate hosts / ports / services** in staging.

---

## 7. API BASE / STRIPE WEBHOOK

Backend compat API mount:

```text
/api/compat
```

Frontend base must therefore be:

```text
https://<STAGING-API-HOST>/api/compat/
```

Trailing slash **REQUIRED**.

Stripe webhook:

```text
POST /api/stripe/webhook
```

Do **NOT** configure Stripe Elements as the main P0 payment flow.  
Current P0 payment flow is **Stripe Checkout Session**.

---

## 8. MAIN PRODUCT RULES TO PRESERVE

- Registration does **NOT** automatically activate Self Assessment.
- `SELF_ASSESSMENT` and `MTD_INCOME_TAX` start **NOT_ACTIVE**.
- Purchase/fulfilment activates **only** the purchased entitlement.
- A client may have SA only, MTD only, both, or neither.
- `GET /api/my-services` is the entitlement source of truth.
- SA and MTD cases remain isolated by entitlement.
- Engagement / client-care acceptance is required after activation before the operational journey.
- Missing UTR must **not** block dashboard access.
- Accountant sees **assigned cases only**.
- Admin operational access remains masked where required.
- Super Admin full-contact reveal is restricted and audited.
- Additional-work payments must **not** incorrectly activate SA or MTD.
- External tax submission is recorded in the platform.
- **HMRC APIs are NOT required** and are **OUT OF SCOPE** for this staging release.

---

## 9. MAIN STAGING SMOKE TEST

Toxel should verify these after deployment:

1. Register client  
2. Verify email  
3. Unverified user cannot purchase  
4. Purchase SA via Stripe Checkout Session  
5. Confirm SA becomes ACTIVE only after proper fulfilment  
6. Accept engagement / client-care  
7. Open SA dashboard / case  
8. Upload / download documents  
9. Send / receive messages  
10. Accountant sees assigned case  
11. Accountant can update progress  
12. Accountant can request documents  
13. Accountant can upload draft / final documents  
14. Admin can assign / reassign case  
15. Admin can view operational case status  
16. Super Admin reveal-contact works  
17. Normal Admin cannot reveal full contact  
18. Additional-work payment works without changing SA/MTD entitlement  
19. Activate / test MTD separately  
20. Confirm Q1–Q4 + Final Declaration structure exists as expected  
21. Confirm SA and MTD remain isolated  
22. Record external submission when workflow reaches the permitted status  
23. Confirm no HMRC API call is required  

---

## 10. IF SOMETHING FAILS

Do **NOT** immediately rewrite or replace application code.

Before proposing changes, provide:

- application / folder affected  
- exact URL  
- exact user role  
- exact reproduction steps  
- browser Network request  
- request method  
- request URL  
- HTTP response / status code  
- response body / error  
- frontend console error if relevant  
- backend log / error if relevant  
- current `git rev-parse HEAD`  

This is required so we can distinguish:

- staging configuration issue  
- environment variable issue  
- deployment issue  
- genuine application defect  
- deferred / out-of-scope feature  

---

## 11. KNOWN NON-BLOCKING WARNINGS

- `frontend/` still exists in the repository but **MUST NOT** be deployed  
- historical freeze SHA references may still appear in `TOXEL_HANDOVER.md`; use **current branch HEAD** instead  
- localhost fallback URLs exist in source for local development if env vars are missing; staging env vars must therefore be configured correctly  
- admin may emit non-blocking `no-console` ESLint warnings  
- a stray / legacy docker-compose reference may exist and is **not** the launch deployment source  

These are **not** current staging blockers.

---

## 12. FINAL TOXEL CHECKLIST

- [ ] branch = `taxsimba-p0-integration`
- [ ] pulled latest HEAD
- [ ] `backend-node` deployed
- [ ] `tax_simba_frontend` deployed
- [ ] `tax_simba_admin_frontend` deployed
- [ ] `frontend/` **NOT** deployed
- [ ] `NEXT_PUBLIC_API_URL` ends in `/api/compat/`
- [ ] trailing slash present
- [ ] client `API_URL` set
- [ ] admin `BACKEND_URL` set
- [ ] `NEXTAUTH_URL` set for both frontends
- [ ] backend env vars configured
- [ ] Stripe webhook configured at `/api/stripe/webhook`
- [ ] client / admin on separate hosts / services
- [ ] smoke test completed
- [ ] exact evidence captured for any failure before code changes

---

If this checklist is followed, Toxel has the correct current staging handoff.
