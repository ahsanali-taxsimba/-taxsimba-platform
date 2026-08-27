# Staging setup — Node-only production source

Minimum requirements to stand up a **staging** environment for the `node-only-production`
branch. Staging only: no production cutover, no production data, no live Stripe keys.

## 1. Hosting / runtime

| Component | Requirement |
|---|---|
| Backend | Node.js 20 LTS, 1 instance, 1 vCPU / 1 GB RAM is enough |
| Frontend | Static hosting for the CRA build output (`frontend/build`), or the same box behind nginx |
| Reverse proxy | Terminates TLS, forwards `/api/*` to the backend port, serves the frontend for all other paths |
| Reminder worker | Same Node process; enable on exactly one instance (`REMINDERS_ENABLED=true`) |

## 2. MongoDB

- MongoDB 6.x or 7.x, one dedicated **staging** database (e.g. `taxsimba_staging`).
- Never point staging at the production database.
- Indexes are created automatically at boot (`ensureCoreIndexes` + query indexes); no manual step.
- Restore of a production dump is NOT required for staging and is not recommended.

## 3. Environment variables (names only)

Backend (`backend-node/.env` or platform config — see `backend-node/.env.example`):

`PORT`, `MONGO_URL`, `DB_NAME`,
`JWT_SECRET`, `COOKIE_SECURE`, `COOKIE_SAMESITE`,
`TOTP_FERNET_KEY`, `TOTP_ISSUER`,
`CORS_ORIGINS`, `CORS_DEV_ORIGINS`, `TRUSTED_PROXY_CIDRS`,
`STORAGE_DRIVER`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
`S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `LOCAL_STORAGE_DIR`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`API_RATE_LIMIT_PER_MINUTE`, `MAX_UPLOAD_MB`, `APP_BASE_URL`,
`EMAIL_DRIVER`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_MAX_ATTEMPTS`,
`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `RESEND_API_KEY`,
`REMINDERS_ENABLED`, `REMINDER_INTERVAL_MINUTES`, `REMINDER_REPEAT_DAYS`,
`REMINDER_DEADLINE_DAYS`, `SEED_DEMO_DATA`.

Frontend build-time: `REACT_APP_BACKEND_URL`.

Staging-specific values: `COOKIE_SECURE=true` (TLS staging) or `false` (plain HTTP),
`COOKIE_SAMESITE=lax`, `SEED_DEMO_DATA=false`, `TOTP_FERNET_KEY` a **new staging key**
(never the production one), `JWT_SECRET` a new staging secret.

## 4. Object storage

- `STORAGE_DRIVER=s3` with a dedicated **staging** bucket (private, versioning optional),
  or `STORAGE_DRIVER=local` with a persistent `LOCAL_STORAGE_DIR` if you want zero cloud setup.
- Do not copy production objects into staging.
- Credentials: an access key scoped to the staging bucket only.

## 5. Stripe (TEST mode only)

- `STRIPE_SECRET_KEY` = `sk_test_…` from the Stripe **test** dashboard.
- Webhook endpoint: `POST https://<staging-host>/api/stripe/webhook`, events
  `checkout.session.completed` (plus `checkout.session.expired` if you want cancellations).
- `STRIPE_WEBHOOK_SECRET` = the `whsec_…` for that test endpoint.
- The webhook route consumes the raw body; no extra proxy configuration is needed beyond
  passing the `stripe-signature` header through unchanged.

## 6. Email

- `EMAIL_DRIVER=none` is a valid staging setting — in-app notifications still work.
- To exercise email: `EMAIL_DRIVER=smtp` against a capture service (Mailtrap/Mailpit) with
  `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`, or `EMAIL_DRIVER=resend` with a test
  `RESEND_API_KEY` and a verified sender domain.
- `APP_BASE_URL` must be the public staging frontend URL — it builds the links in emails.

## 7. CORS / trusted proxy

- `CORS_ORIGINS` = the exact staging frontend origin(s), comma separated, no trailing slash.
- `TRUSTED_PROXY_CIDRS` = the CIDR of the reverse proxy/load balancer. If this does not match
  the real hop, every request fails — this is the single most common staging misconfiguration.

## 8. Frontend backend URL

- Build with `REACT_APP_BACKEND_URL=https://<staging-host>` (no `/api` suffix; the client
  appends `/api`). Same-origin hosting behind one proxy is simplest and avoids CORS entirely.

## 9. Build and start

```bash
# backend
cd backend-node && npm ci && npm run build && npm start     # node dist/index.js

# frontend
cd frontend && npm ci && npm run build                      # serve frontend/build statically
```

## 10. Health check

- `GET /api/` → `200 {"message":"TaxSimba API"}` — use this as the load balancer/uptime probe.
  It requires no authentication and does not touch Stripe or email.

## 11. Disposable UAT seed

Creates the seven UAT roles/journeys through the real domain and HTTP layers (accounts,
service activation, mid-year questionnaire, accountant evidence, admin prior-submission
record, period-linked catch-up charge). Refuses to run unless `STAGING_UAT_SEED=yes` and the
database name contains `staging`/`uat`/`test`.

```bash
cd backend-node && npm run build
MONGO_URL=… DB_NAME=taxsimba_staging BASE_URL=https://<staging-host> \
UAT_PASSWORD='<choose one>' STAGING_UAT_SEED=yes node dist/scripts/stagingUatSeed.js

# remove everything it created
MONGO_URL=… DB_NAME=taxsimba_staging STAGING_UAT_SEED=yes node dist/scripts/stagingUatCleanup.js
```

Accounts created (all on `@uat-taxsimba.test`, all sharing `UAT_PASSWORD`):

| Role | Email | What it is for |
|---|---|---|
| SA-only client | uat.sa.only@uat-taxsimba.test | SA navigation/workflow only |
| MTD-only client | uat.mtd.only@uat-taxsimba.test | MTD only, Q1–Q4 + Final Declaration |
| Dual-service client | uat.dual@uat-taxsimba.test | SA and MTD as separate services |
| Q3 mid-year MTD client | uat.q3joiner@uat-taxsimba.test | Q1 recorded as prior submission, Q2 catch-up + £150 period-linked charge, Q3 onward normal |
| Accountant | uat.accountant@uat-taxsimba.test | Assigned work only, no client contact details |
| Admin | uat.admin@uat-taxsimba.test | Masked contact, approvals, final prior-submission record |
| Super Admin | uat.superadmin@uat-taxsimba.test | Authorised full contact access, pricing/content settings |
