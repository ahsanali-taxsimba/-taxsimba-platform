# Render + MongoDB Atlas staging — exact setup

Source branch: **`node-only-production`** only. Nothing is deployed until you say so.
No production data, no production credentials, Stripe TEST mode only.

Blueprint: `render.yaml` at the repository root (two services, `autoDeploy: false`).

## 1. Accounts to create

| Account | Plan | Why |
|---|---|---|
| MongoDB Atlas | Free M0 (or Flex if you want backups) | staging database, separate from production |
| Render | Starter (~$7/mo for the API; static site is free) | Node web service + static site. The paid plan is only needed for the 1 GB persistent disk that holds staging uploads |
| Stripe | existing account, **test mode** | test secret key + a staging webhook endpoint |

No email account needed initially (`EMAIL_DRIVER=none`).

## 2. MongoDB Atlas

1. Create project `TaxSimba Staging`, cluster `taxsimba-staging` (M0, region close to Render's — e.g. Frankfurt/eu-central).
2. Database user: `taxsimba_staging_app`, generated password, role **readWrite on `taxsimba_staging` only**.
3. Network access: allow Render's outbound IPs, or `0.0.0.0/0` while the cluster holds only disposable UAT data.
4. Connection string (this becomes `MONGO_URL`, entered only in the Render dashboard):
   `mongodb+srv://taxsimba_staging_app:<password>@taxsimba-staging.xxxxx.mongodb.net/?retryWrites=true&w=majority`
5. Database name stays `taxsimba_staging` (set as `DB_NAME` in the blueprint).

## 3. Render

1. New → **Blueprint**, connect the repo, select branch `node-only-production`. Render reads `render.yaml` and proposes two services:
   - `taxsimba-staging-api` — Node web service, root `backend-node`, build `npm ci && npm run build`, start `npm start`, health check `/api/`, 1 GB disk mounted at `/var/data/uploads`.
   - `taxsimba-staging-web` — static site, root `frontend`, build `npm ci && npm run build`, publish `build`, with `/api/*` rewritten to the API service (so the browser stays same-origin: no CORS, no cross-site cookies) and SPA fallback to `index.html`.
2. If Render assigns different hostnames than the defaults in `render.yaml`, update these three values to match: the static site's `REACT_APP_BACKEND_URL`, the API's `CORS_ORIGINS` and `APP_BASE_URL`, and the rewrite destination.
3. Leave `autoDeploy: false` until you approve the first deploy.

### Secrets to enter in the Render dashboard (API service → Environment)

| Name | Value |
|---|---|
| `MONGO_URL` | the Atlas staging string above |
| `JWT_SECRET` | **new** staging secret — `openssl rand -base64 48` |
| `TOTP_FERNET_KEY` | **new** staging key — `openssl rand -base64 32 \| tr '+/' '-_' \| tr -d '='` (32 url-safe base64 bytes) |
| `STRIPE_SECRET_KEY` | `sk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the staging endpoint below |

Never reuse the production `JWT_SECRET` or `TOTP_FERNET_KEY` here. Everything else
(`DB_NAME`, cookie flags, CORS, storage, `EMAIL_DRIVER=none`, `SEED_DEMO_DATA=false`,
`REMINDERS_ENABLED=false`) is already set in `render.yaml`.

## 4. Stripe (test mode)

- Dashboard in **Test mode** → Developers → API keys → copy the secret key (`sk_test_…`).
- Developers → Webhooks → Add endpoint: `https://<static-site-host>/api/stripe/webhook`
  (the rewrite forwards it to the API), event `checkout.session.completed`.
- Copy the signing secret (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`.

## 5. Storage

`STORAGE_DRIVER=local` with the Render disk at `/var/data/uploads` — sufficient for manual UAT
and keeps documents inside staging. Switch to a staging S3 bucket later by setting
`STORAGE_DRIVER=s3` plus the `S3_*` variables; no code change.

## 6. Staging UAT seed (after the first deploy, on your approval)

From a machine that can reach Atlas and the staging API:

```bash
cd backend-node && npm ci && npm run build
MONGO_URL='<atlas staging string>' DB_NAME=taxsimba_staging \
BASE_URL=https://<static-site-host> UAT_PASSWORD='<choose one>' \
STAGING_UAT_SEED=yes node dist/scripts/stagingUatSeed.js
```

Creates the seven roles (SA-only, MTD-only, dual-service, Q3 joiner, Accountant, Admin,
Super Admin) on `@uat-taxsimba.test` with the mid-year fixture: Q1 recorded as a prior
submission, Q2 flagged for TaxSimba catch-up with a period-linked additional-work charge,
Q3 onward normal. Cleanup: `node dist/scripts/stagingUatCleanup.js` with the same
`MONGO_URL`/`DB_NAME` and `STAGING_UAT_SEED=yes`.

The script refuses to run unless `STAGING_UAT_SEED=yes` and `DB_NAME` contains
`staging`/`uat`/`test`, so it cannot be pointed at production by accident.

## 7. Post-deploy smoke checks (one minute, no test suite)

1. `GET https://<api-host>/api/` → `{"message":"TaxSimba API"}`.
2. Static site loads and login page renders.
3. Log in as a seeded UAT client — proves cookies, CSRF and Atlas connectivity through the rewrite.
