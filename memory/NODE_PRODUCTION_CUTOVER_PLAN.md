# Production cutover plan — Python → Node for taxsimba.co.uk

Planning document only. Nothing here has been deployed, and the React frontend stays unchanged.
Python (`backend/`) remains deployable throughout and is the rollback target.

## 1. Frontend API base URL

The frontend has exactly one backend entrypoint:

```js
// frontend/src/lib/api.js
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const api = axios.create({ baseURL: API, withCredentials: true });
```

`REACT_APP_BACKEND_URL` is also used directly for two `<a href>` downloads (payment receipts and
document download in `MyServices.jsx` / `CaseWorkspace.jsx`). Nothing else addresses the backend.

`REACT_APP_*` values are **baked in at build time** by Create React App, so there are two ways to
point the app at Node — pick one:

- **Preferred (no rebuild): reverse-proxy switch.** Keep `REACT_APP_BACKEND_URL=https://taxsimba.co.uk`
  (same origin) and change only the proxy rule for `/api/*` from the Python upstream to the Node
  upstream. The currently deployed bundle then talks to Node with no rebuild, no redeploy and no
  code change, and rollback is the same rule reverted.
- **Alternative: rebuild with a new base URL** (e.g. `https://api.taxsimba.co.uk` pointing at Node).
  Still no source change, but it requires a frontend rebuild and static redeploy, which makes
  rollback slower. Only use this if Node must live on a different hostname.

If Node is put on a **different origin** from the frontend, the cookie requirements in §7 change
(`SameSite=None; Secure` and an exact CORS origin allowlist) — this is the main reason to prefer
same-origin.

## 2. Node environment variables

Startup fails fast if any `required()` variable is missing, so a misconfigured deployment never
serves traffic in a half-configured state.

| Variable | Staging | Production | Notes |
| --- | --- | --- | --- |
| `PORT` | 8002 | 8002 | behind the proxy; not exposed publicly |
| `MONGO_URL` | staging cluster | production cluster | never the operational DB in staging |
| `DB_NAME` | `taxsimba_staging` | existing production database name | must match the Python value exactly at cutover |
| `JWT_SECRET` | staging value | **existing production value** | see §8 |
| `TOTP_FERNET_KEY` | staging value | **existing production value** | see §8 |
| `TOTP_ISSUER` | `TaxSimba (staging)` | `TaxSimba` | shown in authenticator apps |
| `STORAGE_DRIVER` | `s3` | `s3` | `local` is test-only |
| `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` | staging bucket | production bucket | §5 |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | staging IAM user | production IAM user | scoped to the bucket only |
| `S3_FORCE_PATH_STYLE` | `true` for MinIO/R2/Spaces, `false` for AWS | same | |
| `MAX_UPLOAD_MB` | as today | as today | |
| `STRIPE_SECRET_KEY` | `sk_test_…` | `sk_live_…` | §4 |
| `STRIPE_WEBHOOK_SECRET` | test endpoint secret | live endpoint secret | distinct per endpoint |
| `CORS_ORIGINS` | staging origin | `https://taxsimba.co.uk` (+ `https://www.taxsimba.co.uk` if used) | wildcard/empty = startup failure |
| `CORS_DEV_ORIGINS` | preview origins | unset | |
| `COOKIE_SECURE` | `true` | `true` | |
| `COOKIE_SAMESITE` | `lax` same-origin, `none` cross-origin | same | §7 |
| `TRUSTED_PROXY_CIDRS` | proxy/LB ranges | proxy/LB ranges | §6 |
| `API_RATE_LIMIT_PER_MINUTE` | match Python | match Python | |
| `SEED_DEMO_DATA` | `false` unless demo logins are wanted | **`false`** | otherwise startup seeds demo accounts and FAQ rows into the live database |

`SEED_DEMO_DATA=false` in production is not optional — `startup()` seeds demo users and the
SELF_ASSESSMENT service row otherwise (this mirrors the Python bootstrap, but there is no reason to
re-run it against a live database).

## 3. Mongo configuration

- Same cluster, same database, same collections as Python — **no schema migration and no data
  transformation**. Both implementations read and write the same document shapes with the same
  string `id` fields.
- Node calls `ensureQueryIndexes()`, `ensureLoginIndexes()`, `ensureMfaIndexes()` and
  `ensureRateIndexes()` at startup. These are additive `createIndex` calls (`cases`, `documents`,
  `mtd_periods`, `tasks`, `messages`, `notifications`, `activity_logs`, `payment_transactions`,
  `clients`, `client_services`, and others) and index creation on an existing large collection
  should be run/verified in a maintenance window, or pre-created with `background: true`, before
  the first production boot.
- The unique/idempotency constraints Python relies on are preserved, so a duplicate service
  activation or replayed webhook behaves identically.
- The Mongo user needs `readWrite` plus index creation on the application database.
- Take a full backup/snapshot immediately before cutover (this is the only true data rollback for
  writes made while Node is live).

## 4. Stripe

- Staging: test-mode `sk_test_…` with its own webhook endpoint and `whsec_…`.
- Production: existing live key and a **new** webhook endpoint pointing at the Node deployment,
  with its own signing secret. Do not reuse the test secret in production or vice versa.
- Webhook path is unchanged: `POST /api/stripe/webhook`. Node mounts it with
  `express.raw({ type: "*/*" })` before the JSON parser so signature verification sees exact bytes;
  any proxy in front must forward the body unmodified (no rewriting, no buffering transforms).
- During the cutover window, register the Node endpoint **before** switching traffic and leave the
  Python endpoint enabled. Fulfilment is idempotent on both sides, so a duplicated delivery does
  not double-activate a service or issue a second receipt.
- Stripe Tax head-office configuration is provider-side account state; Node deliberately does not
  re-apply it at boot, so no action is needed as long as the account is already configured.
- Verify with a real test-mode checkout in staging before production: the browser UAT never
  completed hosted checkout because no test key was configured.

## 5. Object storage

Python writes through the Emergent integrations proxy; Node writes to S3-compatible storage.
**Object keys are identical** (`taxsimba/<case_id>/<uuid>_<filename>`), and `documents.storage_path`
holds that key, so no database rewrite is needed.

Required before cutover: **copy every existing object out of the Emergent object store into the
target bucket, preserving keys**, then verify a sample of historical documents downloads through
Node. This is the single largest data-migration task in the cutover and it must be finished (and
re-synced for anything uploaded after the initial copy) before traffic moves. If the copy is
incomplete, historical downloads 500 while new uploads work — which is easy to miss in smoke tests.

Bucket requirements: private (no public read), server-side encryption on, versioning on
(protects against a bad rollback), credentials scoped to `Get/PutObject` on that bucket only.

## 6. TRUSTED_PROXY_CIDRS

`loginLockout.ts` calls `required("TRUSTED_PROXY_CIDRS")` and Node sets `app.set("trust proxy", false)`,
resolving the real client IP explicitly rather than trusting `X-Forwarded-For` blindly. Set it to the
CIDR ranges of your ingress/load balancer only (matching what Python's `ratelimit.py` uses today).

- Wrong or missing value → login lockout and rate limiting key off the proxy IP, so one abusive
  client can lock out everyone, or requests fail outright.
- The proxy must set `X-Forwarded-For` and `X-Forwarded-Proto` correctly and must not allow client
  spoofing of those headers.

## 7. CORS, cookies and sessions for taxsimba.co.uk

- Cookies: `access_token` (httpOnly), `refresh_token` (httpOnly), `csrf_token` (readable — that is
  the double-submit pattern), all `Path=/`, `Secure=true` in production.
- Same-origin deployment (recommended): `COOKIE_SAMESITE=lax`, `CORS_ORIGINS=https://taxsimba.co.uk`.
- Cross-origin deployment (e.g. `api.taxsimba.co.uk`): `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`,
  and `CORS_ORIGINS` must list the exact frontend origins. The frontend already sends
  `withCredentials: true` and echoes `X-CSRF-Token`, so nothing changes on its side.
- CORS is an explicit allowlist; `*` or an empty value is a hard startup failure. Allowed headers
  are `Content-Type`, `Authorization`, `X-CSRF-Token`; `credentials: true`.
- Sessions survive the cutover **only if `JWT_SECRET` is identical** — tokens are HS256 with the
  same claims and the `refresh_tokens` collection is shared, so logged-in users are not signed out.
  A different secret logs every user out at cutover.
- If `www.taxsimba.co.uk` is also served, either redirect it to the apex before login or add it to
  `CORS_ORIGINS`; cookie host scope must match the origin the app is loaded from.

## 8. Secrets that must be reused, not regenerated

- **`TOTP_FERNET_KEY`** — enrolled staff MFA secrets are encrypted with it. A new key makes every
  existing MFA secret undecryptable and locks staff out; rotation requires a deliberate
  re-enrolment procedure, not a cutover. Node's Fernet implementation is byte-compatible and is
  covered by a test that decrypts a Python-generated token.
- **`JWT_SECRET`** — see §7.
- Both must be delivered through the platform's secret store, never through the repository.

## 9. Health checks

Node exposes `GET /api/` → `{"message": "TaxSimba API"}` (same as Python). Use it as the
load-balancer health check; it returns 200 only after the app is up, though it does not itself
prove Mongo connectivity. Recommended readiness gate for the cutover, in order:

1. `GET /api/` returns 200.
2. `POST /api/auth/login` with a staging/service account returns 200 and sets all three cookies.
3. `GET /api/cases` with those cookies returns 200 (proves Mongo).
4. `GET /api/documents/<known id>/download` returns the file (proves the object-store copy).
5. From the browser at `https://taxsimba.co.uk`: log in, open an SA case and an MTD quarter.

Worth adding later (not required for cutover): a dedicated `/api/health` that pings Mongo, so the
LB can drop an instance whose database connection has failed.

## 10. Data compatibility summary

| Concern | Status |
| --- | --- |
| Collections / document shapes / `id` fields | identical, no migration |
| Password hashes | bcrypt on both sides, verify unchanged |
| JWT access/refresh tokens and `refresh_tokens` rotation | identical claims and algorithm; sessions carry over with the same secret |
| MFA secrets | Fernet-compatible; requires the existing key |
| `documents.storage_path` | unchanged keys; objects must be copied to the bucket (§5) |
| Indexes | additive only |
| Unscoped `GET /api/documents` | **behaviour change (approved B4)**: 400 instead of 200. Verified in the browser that no screen calls it unscoped |
| Validation errors | pydantic-identical envelope, so error text renders the same |

## 11. Rollback to Python

Because Python is untouched and both read the same database, rollback is a routing change:

1. Revert the proxy `/api/*` upstream to the Python service (keep it running, warm, and
   health-checked throughout the cutover window — do not stop it).
2. Re-point or re-enable the Stripe webhook endpoint for Python.
3. Sessions survive the rollback provided the same `JWT_SECRET` was used.
4. Files uploaded while Node was live exist only in the S3 bucket; if Python is restored, those
   objects must be copied back into the Emergent store (or Python left able to read the bucket)
   or those specific downloads will fail. Everything else — cases, figures, submissions, payments —
   is in Mongo and is immediately visible to Python again.
5. Database rollback is only needed if a Node write is found to be corrupting data; use the
   pre-cutover snapshot, accepting loss of writes made during the window.

Time to roll back: one proxy config change (seconds to a couple of minutes) if the reverse-proxy
approach in §1 is used; a frontend rebuild if the separate-hostname approach is used.

## 12. Cutover sequence (minimal downtime)

**Ahead of the window**

1. Provision staging Node with production-shaped configuration and a copy (not the live DB) of the
   data; run full staging UAT including a real test-mode Stripe checkout.
2. Copy all existing objects into the production bucket, preserving keys; set up an incremental
   re-sync.
3. Pre-create the Mongo indexes against production.
4. Deploy Node to production **without traffic**, sharing the production database, with
   `SEED_DEMO_DATA=false`, the existing `JWT_SECRET` and `TOTP_FERNET_KEY`.
5. Register the Node Stripe webhook endpoint; leave Python's enabled.
6. Run the §9 readiness gate against the Node instance directly (bypassing the public route).

**Window (no user-facing downtime with same-origin proxying)**

7. Optional: put the platform in a brief read-only/announcement state if you want a clean line
   between the two backends.
8. Final incremental object re-sync.
9. Switch the proxy `/api/*` upstream to Node — draining connections, not killing them. In-flight
   requests finish on Python; new ones land on Node. Existing browser sessions keep working.
10. Re-run the §9 gate through the public URL, plus one end-to-end smoke: log in as staff, open a
    case, upload and download a document, open an MTD quarter, view a receipt.
11. Watch for 15–30 minutes: 5xx rate, 400s on `/api/documents` (would indicate an unscoped caller),
    Stripe webhook delivery success, login/refresh failures, document download failures.

**After**

12. Keep Python running and rollback-ready for at least one full billing/submission cycle.
13. Retire the Python Stripe webhook endpoint only after Node has processed live events cleanly.
14. Then schedule the deferred production items: transactional email and the scheduled reminder
    worker.

## 13. Config-only question

**Yes** — the frontend switches from Python to Node with configuration only, no source change. All
backend access flows through `REACT_APP_BACKEND_URL` plus `/api`, the API paths, request bodies,
response fields, status codes and error envelope are unchanged, and cookie/CSRF handling is
identical. Note the one nuance: `REACT_APP_BACKEND_URL` is baked in at build time, so a *value*
change needs a rebuild of the static bundle (still no code change) — routing `/api` at the proxy
avoids even that.

## 14. Verdicts

**FRONTEND CONFIG-ONLY CUTOVER: YES** — no frontend code change; with same-origin proxy routing, not
even a rebuild.

**PRODUCTION CUTOVER BLOCKERS** (all environment/configuration and data-movement, none in the Node code):

1. Existing objects must be copied from the Emergent object store into the target S3 bucket with keys
   preserved, and verified through Node — otherwise historical document downloads fail.
2. Live Stripe key plus a new Node webhook endpoint and signing secret; a real checkout has never
   been completed end-to-end against Node (no test key was available during UAT) — must pass in
   staging first.
3. Production `JWT_SECRET` and `TOTP_FERNET_KEY` must be reused; a new Fernet key locks out every
   enrolled staff MFA user.
4. `TRUSTED_PROXY_CIDRS`, `CORS_ORIGINS`, `COOKIE_SECURE`/`COOKIE_SAMESITE` set for taxsimba.co.uk;
   `SEED_DEMO_DATA=false`.
5. S3 bucket and scoped credentials provisioned.
6. Mongo indexes pre-created and a pre-cutover backup taken.
7. Staging UAT on production-shaped configuration, including MFA login by a real enrolled staff
   account and a historical document download.
8. Deferred and still absent: transactional email and the scheduled reminder worker — confirm the
   business accepts going live without them (they do not exist in Python today either).
9. No CI in the repository, so build/test gating before deploy is manual.

**ROLLBACK READY: YES** — Python is unmodified, shares the same database and session secret, and is
restored by reverting one proxy rule; the only asymmetry is objects uploaded while Node is live,
which must be copied back or made readable to Python.
