# TOXEL — START HERE FOR STAGING

This file is the **SINGLE SOURCE OF TRUTH** for the current TaxSimba staging deployment.

For staging, follow **THIS FILE** first.

Historical SHAs, freeze tips, old PR notes, old chat instructions and legacy folders must **not** be used to choose the deploy version.

Always deploy the **CURRENT HEAD** of:

`toxel-uat-approved`

**Do not deploy or test `taxsimba-p0-integration`.** That branch is historical and is not the UAT baseline.

---

## 1. CURRENT DEPLOYMENT SOURCE

**Branch:** `toxel-uat-approved`

**Approved baseline SHA (this handoff):** `d30ddbccc487f560e9c5cfbf5405c67135b23f56`

**Deploy tip:** pull current HEAD of `toxel-uat-approved` (includes this documentation stamp on top of the approved content SHA above). All three apps must still be built from the **same** pulled tip.

**Instruction:** Pull and deploy this exact branch. Prefer the SHA above; if you pull later commits on the same branch, confirm with TaxSimba before promoting.

Confirm current HEAD:

```bash
git fetch origin
git checkout toxel-uat-approved
git pull --ff-only origin toxel-uat-approved
git rev-parse HEAD
```

**All three apps must be clean-built from the same SHA** (`backend-node`, `tax_simba_frontend`, `tax_simba_admin_frontend`). Do not mix SHAs across services.

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

Latest verified status on `toxel-uat-approved`:

- Backend build: **PASS**
- Backend typecheck: **PASS**
- Backend tests: **PASS** (full suite; 0 failures; 0 skipped)
- Client clean install/build: **PASS**
- Admin clean install/build: **PASS**
- Ownership-aware checkout-success → `/mtd-dashboard` or `/dashboard`: **PASS**
- MTD / SA catalogue journey + intent persistence: **PASS**
- Stripe Checkout / fulfilment / webhook contract: **PASS**
- SA / MTD entitlement isolation + dual-service: **PASS**
- Admin UUID-safe assignment: **PASS**
- MTD assignment handoff (canonical users.id → Assigned-to-Me list + rich notification): **PASS**
- Authoritative MTD obligation / overdue semantics across client + staff: **PASS**
- Verification vs purchase email separation (PNG logo): **PASS**

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
SEED_DEMO_DATA
EMAIL_DRIVER
EMAIL_FROM
```

**`SEED_DEMO_DATA` must be explicitly set to `false` in staging and production.**  
If unset or any value other than the string `false`, startup seeds demo data. Staging handoff expects:

```text
SEED_DEMO_DATA=false
```

**`APP_BASE_URL`** = the **client public origin** (customer-facing HTTPS site), e.g. `https://staging-app.example.com`.  
Used for links in transactional emails (verification, password reset, purchase CTAs) and the absolute PNG logo `${APP_BASE_URL}/images/logo.png`. It is **not** the admin origin and **not** the API host. Never use `logo.svg` in emails.

**Client and admin API bases** must both point at **this same backend SHA**:

```text
NEXT_PUBLIC_API_URL=https://<STAGING-API-HOST>/api/compat/
API_URL=https://<STAGING-API-HOST>/api/compat/
BACKEND_URL=https://<STAGING-API-HOST>/api/compat/
```

**`CORS_ORIGINS`** must list **both** frontend origins (comma-separated), with no wildcard `*`:

```text
CORS_ORIGINS=https://<CLIENT-ORIGIN>,https://<ADMIN-ORIGIN>
```

### Clear caches before rebuild

Before rebuilding staging containers / Next apps from this SHA:

1. Stop running client, admin, and backend containers/processes for this environment.
2. Clear Next.js build caches (`.next/`) and any Docker/buildkit layer caches for these three apps.
3. `npm ci` in each of `backend-node`, `tax_simba_frontend`, `tax_simba_admin_frontend` from the **same** commit.
4. Rebuild and restart all three together.
5. Use **fresh test email accounts** for registration / purchase / assignment retests (do not reuse prior UAT accounts that may have mixed entitlements).

### Safe staging catalogue reconciliation

Boot does **not** mutate catalogue rows when `SEED_DEMO_DATA=false`. If staging package prices/codes look drifted, reconcile explicitly:

```bash
cd backend-node
npx ts-node src/scripts/reconcilePackages.ts --dry-run
# Review the dry-run report carefully
npx ts-node src/scripts/reconcilePackages.ts --apply
```

Do **not** run `--apply` until the dry-run report has been reviewed. Do not embed credentials in tickets or this file.

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

### Email environment variables (required for the chosen driver)

Always set:

```text
EMAIL_DRIVER
EMAIL_FROM
EMAIL_REPLY_TO
EMAIL_MAX_ATTEMPTS
APP_BASE_URL
```

| `EMAIL_DRIVER` | Additional required variables |
| --- | --- |
| `none` (default) | none — delivery disabled; in-app notifications still work |
| `log` | none — messages logged only |
| `smtp` | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` |
| `resend` | `RESEND_API_KEY` |

`EMAIL_FROM` is required whenever delivery is attempted (`smtp` / `resend`).  
`EMAIL_REPLY_TO` is optional.  
`EMAIL_MAX_ATTEMPTS` defaults to `5` if unset.

**Registration email verification (staging):** set `EMAIL_DRIVER` to `smtp` or `resend` (not `none`), configure the matching provider credentials, set `EMAIL_FROM`, and set `APP_BASE_URL` to the **client** public origin. With `EMAIL_DRIVER=none`, registration still succeeds but **no verification email is sent** (by design until email is configured).

**Contact Us form** (`POST /api/compat/contact-us`) also requires a working email driver. Optional inbox override:

```text
CONTACT_TO
```

If `CONTACT_TO` is unset, the backend uses `EMAIL_REPLY_TO`, then the address inside `EMAIL_FROM`.

Optional reminder worker (enable on exactly one instance if used):

```text
REMINDERS_ENABLED
REMINDER_INTERVAL_MINUTES
REMINDER_REPEAT_DAYS
REMINDER_DEADLINE_DAYS
```

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

**Admin `NEXTAUTH_URL` must include `/admin`.**  
The admin app is deployed with Next.js `basePath: '/admin'`, so the public auth base must be the admin origin **including** that path, e.g.:

```text
NEXTAUTH_URL=https://<ADMIN-HOST>/admin
```

**Local / LAN staging example format only (do not copy a fixed IP):**

```text
NEXTAUTH_URL=http://<ADMIN-HOST>:3001/admin
```

If admin `NEXTAUTH_URL` is mistakenly set to the **client** origin (for example port `3000`), logout will redirect to the client host and produce a 404. Admin logout uses a path callback (`/admin/auth/signin`); NextAuth resolves it against `NEXTAUTH_URL`.

### Admin entry URLs (expected behaviour)

The admin app is served under `basePath: '/admin'`.

| URL | Expected result |
| --- | --- |
| `http://<ADMIN-HOST>:3001/` | Outside the app basePath → Next.js error/404 (not a defect) |
| `http://<ADMIN-HOST>:3001/admin` | Admin landing (`/admin/home`) with Sign In link |
| `http://<ADMIN-HOST>:3001/admin/auth/signin` | Admin Sign In |

Use `/admin` or `/admin/auth/signin` as the staging entry. Do not expect bare host root `/` on the admin port to redirect into the app.

### Package pricing (admin UI)

- Public route (with basePath): **`/admin/package-pricing`**
- Source of truth: live catalogue `packages.price` via native APIs
- **SUPER_ADMIN** can edit prices and schedule future price changes
- **ADMIN** can open the page **read-only** (API writes return 403)
- Checkout amounts use `packages.price`; existing customers keep frozen `agreed_price`

Optional where used:

```text
API_URL
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_BASE_URL
NEXTAUTH_TRUST_HOST
```

Client and admin frontends both default to Next.js port **3000** locally, so they must run on **separate hosts / ports / services** in staging.

---

## 7. API BASE / STRIPE WEBHOOK / NATIVE PACKAGES

Backend compat API mount (used by both frontends for day-to-day APIs):

```text
/api/compat
```

Frontend base must therefore be:

```text
https://<STAGING-API-HOST>/api/compat/
```

Trailing slash **REQUIRED**.

**Native package-pricing APIs are also required** (used by `/admin/package-pricing`).  
Staging reverse-proxy / ingress must expose **both**:

```text
/api/compat/*
/api/packages*
```

Examples of native routes the admin pricing UI calls:

```text
GET    /api/packages
PATCH  /api/packages/:packageId/price
GET    /api/packages/:packageId/price-history
GET    /api/packages/:packageId/price-schedule
POST   /api/packages/:packageId/price-schedule
DELETE /api/packages/:packageId/price-schedule/:entryId
```

Do **not** assume `/api/compat/` alone is enough for Super Admin package pricing.

Stripe webhook:

```text
POST /api/stripe/webhook
```

Do **NOT** configure Stripe Elements as the main P0 payment flow.  
Current P0 payment flow is **Stripe Checkout Session**.

**Do not claim Stripe wallet / BNPL methods** (Apple Pay, Google Pay, Klarna, Clearpay/Afterpay, etc.) unless those payment methods are actually enabled and configured in the Stripe account / Checkout settings for this environment. P0 must only be described as Stripe Checkout Session unless wallets/BNPL are verified live.

---

## 8. MAIN PRODUCT RULES TO PRESERVE

- Registration does **NOT** automatically activate Self Assessment.
- `SELF_ASSESSMENT` and `MTD_INCOME_TAX` start **NOT_ACTIVE**.
- Purchase/fulfilment activates **only** the purchased entitlement.
- A client may have SA only, MTD only, both, or neither.
- `GET /api/my-services` is the entitlement source of truth.
- SA and MTD cases remain isolated by entitlement.
- Engagement / client-care acceptance is required after activation before the operational journey.
- Missing UTR must **not** block dashboard access. UTR (and UTR confirmation upload) are optional during engagement / onboarding and may be provided later or requested by the accountant.
- Accountant sees **assigned cases only**.
- Admin operational access remains masked where required.
- Super Admin full-contact reveal is restricted and audited.
- Additional-work payments must **not** incorrectly activate SA or MTD.
- External tax submission is recorded in the platform.
- **HMRC APIs are NOT required** and are **OUT OF SCOPE** for this staging release.
- Customer / SEO surfaces must not hard-code package catalogue prices; live cards and checkout use `packages.price`.
- Chatbot registration exit must preserve journey: SA pages → `/register`; MTD pages → `/register?role=MTD` (must not force MTD onto SA PPC traffic).

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
24. SUPER_ADMIN can open `/admin/package-pricing`, edit/schedule; ADMIN sees read-only  

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

- [ ] branch = `toxel-uat-approved`
- [ ] `git rev-parse HEAD` matches approved baseline SHA in section 1 (or agreed later tip on same branch)
- [ ] `backend-node`, `tax_simba_frontend`, and `tax_simba_admin_frontend` all built from **that same SHA**
- [ ] `taxsimba-p0-integration` is **not** deployed
- [ ] old Next/build/container caches cleared before rebuild
- [ ] fresh test email accounts used for retest
- [ ] `frontend/` **NOT** deployed
- [ ] `NEXT_PUBLIC_API_URL` ends in `/api/compat/`
- [ ] trailing slash present
- [ ] client `API_URL` set to same backend
- [ ] admin `BACKEND_URL` set to same backend
- [ ] client `NEXTAUTH_URL` = client public origin
- [ ] admin `NEXTAUTH_URL` includes `/admin`
- [ ] backend `APP_BASE_URL` = client public HTTPS origin
- [ ] `CORS_ORIGINS` includes **both** client and admin origins
- [ ] `SEED_DEMO_DATA=false`
- [ ] email env vars set for chosen `EMAIL_DRIVER` (`EMAIL_FROM`, plus SMTP_* or `RESEND_API_KEY`)
- [ ] catalogue reconciled only via dry-run → review → apply when needed
- [ ] admin entry uses `/admin` or `/admin/auth/signin` (not bare `:3001/`)
- [ ] admin `NEXTAUTH_URL` is the **admin** host including `/admin` (never the client port)
- [ ] proxy exposes `/api/compat/*` **and** `/api/packages*`
- [ ] Stripe webhook configured at `/api/stripe/webhook`
- [ ] Stripe wallets / BNPL **not** claimed unless actually enabled
- [ ] `/admin/package-pricing` reachable; SUPER_ADMIN edit, ADMIN read-only
- [ ] client / admin on separate hosts / services
- [ ] smoke test completed (SA + MTD + dual-service + admin assign + accountant + super-admin)
- [ ] exact evidence captured for any failure before code changes

---

If this checklist is followed, Toxel has the correct current staging handoff.
