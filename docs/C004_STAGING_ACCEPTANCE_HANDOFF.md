# Task 4 / C-004 — Staging acceptance handoff

**Status:** LOCAL PASS, awaiting staging acceptance  
**Do not mark STAGING PASS until the checklist below is green on a live host.**

## Identity (deploy this exact commit)

| Field | Value |
|---|---|
| Toxel Test ID | C-004 |
| **Deploy SHA (single source)** | contents of `docs/C004_DEPLOY_SHA.txt` |
| Branch | `cursor/toxsl-blockers-b01-b04-80a7` |
| PR | https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/18 |
| Base | `toxel-uat-approved` |
| Local verdict | **LOCAL PASS** (SIMULATED fulfilment on localhost) |
| Staging verdict | **UNVERIFIED / BLOCKED** for this agent |

Do **not** deploy an older intermediate SHA while reporting a newer tip (or vice versa). One SHA only.

## What must be deployed

C-004 UI fix lives in **Next.js client** `tax_simba_frontend/` (not the legacy CRA `frontend/` root used by the current `render.yaml` blueprint). Deploy **the same SHA** for:

1. `backend-node` — entitlements, checkout, Stripe webhook fulfil, SA Tax Tracker case filter
2. `tax_simba_frontend` — Add MTD/SA CTAs, switcher, Tax Tracker SA-only filter
3. `tax_simba_admin_frontend` — optional for C-004 client checks; keep SHA parity if deployed

Set build-info env on each service to the SHA in `docs/C004_DEPLOY_SHA.txt`:

```text
GIT_SHA=<C004_DEPLOY_SHA.txt>
# client / admin also:
NEXT_PUBLIC_GIT_SHA=<C004_DEPLOY_SHA.txt>
```

Confirm after deploy:

```bash
DEPLOY_SHA=$(cat docs/C004_DEPLOY_SHA.txt)
curl -sS "$BACKEND_URL/api/build-info" | jq .
curl -sS "$CLIENT_URL/build-info" | jq .
# Abort unless both gitSha == $DEPLOY_SHA
```

### Blueprint note

Repo `render.yaml` still points `taxsimba-staging-web` at CRA `frontend/` and branch `node-only-production`. For C-004 acceptance, either:

- Deploy `tax_simba_frontend` from SHA `branch tip` to the staging client host (recommended for Toxel UAT), **or**
- Update the Render service root/branch to build `tax_simba_frontend` from this SHA,

and keep API on the same SHA. Do **not** accept C-004 against a CRA-only deploy that lacks the Next.js switcher/CTA changes.

## Stripe TEST + disable fake fulfilment

On staging API environment:

| Variable | Required value |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe **TEST** secret (`sk_test_…`) — not live |
| `STRIPE_WEBHOOK_SECRET` | Staging endpoint signing secret (`whsec_…`) |
| `PAYMENT_PROVIDER` | **Unset** (or anything other than `fake`) |
| `APP_BASE_URL` | Staging **client** public HTTPS origin (not localhost) |

Code guard: `PAYMENT_PROVIDER=fake` is refused unless `APP_BASE_URL` is localhost/127.0.0.1. Still leave `PAYMENT_PROVIDER` unset on staging so checkout uses Stripe.

### Webhook

Stripe Dashboard → **Test mode** → Developers → Webhooks → endpoint:

```text
POST https://<staging-client-or-api-origin>/api/stripe/webhook
```

- Prefer the origin that reaches the Node API (same-origin rewrite on static host is fine: `/api/*` → API).
- Events: at least `checkout.session.completed` (also handle `checkout.session.expired` / `async_payment_failed` if already subscribed).
- Copy the endpoint `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
- Do **not** point the webhook at a Next.js page route; it must hit the Express raw body route.

Optional client: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…`.

## Deploy steps (operator)

1. Merge or manually deploy branch tip the tip recorded in `docs/C004_DEPLOY_SHA.txt` / evidence ZIP (or that commit directly).
2. Backend env: Stripe TEST keys + webhook secret; `PAYMENT_PROVIDER` unset; `APP_BASE_URL` = staging client origin; staging Mongo only.
3. Client: build `tax_simba_frontend` with `NEXT_PUBLIC_GIT_SHA` / API URL pointing at staging.
4. Restart services. Confirm `/api/` health and matching build-info SHAs.
5. Confirm Stripe TEST webhook deliveries succeed (200) for a probe Checkout session.
6. Run the staging acceptance checklist below; attach screenshots + `my-services` JSON.

## Agent access inventory (2026-10-05) — no secrets exposed

| Item | Status |
|---|---|
| Render CLI / `RENDER_API_KEY` / `RENDER_API_TOKEN` | **MISSING** |
| Deploy rights to `taxsimba-staging-api` / `taxsimba-staging-web` | **MISSING** |
| Alternate staging hostnames (custom domain) | **UNREACHABLE** from this agent |
| Blueprint hosts `https://taxsimba-staging-api.onrender.com` / `https://taxsimba-staging-web.onrender.com` | HTTP **404** (services not live or not provisioned for this agent) |
| Agent `STRIPE_SECRET_KEY` | Present as **empty string** — cannot run Stripe TEST here |
| Agent `STRIPE_WEBHOOK_SECRET` | Present as **empty string** |
| Agent `PAYMENT_PROVIDER` | Unset locally; local proofs used explicit `PAYMENT_PROVIDER=fake` with localhost `APP_BASE_URL` |
| Stripe CLI | **MISSING** |
| Staging Mongo credentials | **MISSING** (not expected in agent env) |

**Conclusion:** This agent cannot deploy or execute staging Stripe acceptance. Operator with Render + Stripe TEST access must deploy SHA `branch tip` and complete the checklist.

## Staging URL / deployed SHA (to fill after deploy)

| Field | Value |
|---|---|
| Staging client URL | `_TBD — blocked; blueprint hosts 404_` |
| Staging API URL | `_TBD — blocked; blueprint hosts 404_` |
| Deployed commit SHA | `_TBD — must be branch tipb3b1804824f3e6454e5bbd48ee6ad31aa_` |
| `GET /api/build-info` | `_TBD_` |
| `GET /build-info` | `_TBD_` |

## Staging acceptance checklist (Stripe TEST — no fake)

| # | Check | Expected | Staging result | Evidence |
|---|---|---|---|---|
| 1 | SA → MTD on same account | Second Checkout completes; both ACTIVE; separate service/case records | **BLOCKED** | |
| 2 | MTD → SA on same account | Same as above, reverse order | **BLOCKED** | |
| 3 | Activation only after confirmed payment | Pre-pay / abandoned Checkout → second service NOT_ACTIVE; first stays ACTIVE | **BLOCKED** | |
| 4 | Separate service records + dashboards | Distinct SA + MTD rows in `GET /api/my-services`; both dashboards load | **BLOCKED** | |
| 5 | Switcher after refresh | Workspace switcher on SA + MTD; survives hard refresh | **BLOCKED** | |
| 6 | Switcher after logout/login | Both services + switcher after re-auth | **BLOCKED** | |
| 7 | Cancelled second Checkout | First ACTIVE; second remains inactive | **BLOCKED** | |
| 8 | Duplicate webhook | Replayed `checkout.session.completed` does not duplicate entitlements | **BLOCKED** | |
| 9 | Client isolation | Client A cannot open Client B cases/docs | **BLOCKED** | |
| 10 | Access without UTR | Missing UTR still reaches dashboards (M-003) | **BLOCKED** | |

Local evidence for the same matrix (fake fulfilment): see package below — **not** a substitute for staging Stripe TEST.

## Local evidence archive (durable share for Toxel retest)

| Location | Notes |
|---|---|
| `/opt/cursor/artifacts/task4-c004-evidence.zip` | Primary downloadable archive |
| `/opt/cursor/artifacts/task4-c004-staging-handoff/task4-c004-evidence.zip` | Copy inside handoff folder |
| `/cursor/stores/self/task4-c004-staging-handoff/task4-c004-evidence.zip` | Agent-store durable copy |
| SHA-256 | `738aabb24c38af554849dc7e14f48329c0534b57e56e0ddc23fcbc2d83068dc9` |

Archive contents: README, pre-fix repro screenshots, post-fix proof screenshots, redacted API JSON, vitest summary, proof_report.json.

## Related docs

- `docs/STAGING_RELEASE_ACCEPTANCE.md` — SHA parity + shared staging gates
- `docs/toxel-env/TOXEL_STAGING_ENV_GUIDE.md` — Stripe TEST / webhook path
- `backend-node/docs/C004_STAGING_DEPLOY_RUNBOOK.md` — short operator runbook
- `memory/NODE_STAGING_RENDER.md` — Render blueprint provisioning
