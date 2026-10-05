# C-004 staging deploy runbook (Task 4)

**Commit to deploy:** `d97aff5b768dfcce53af1a3789d6c08cf1cc0eae`  
**PR:** https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/18  
**Status:** local pass, awaiting staging acceptance

## Missing for this agent (no secret values)

- Render deploy token / dashboard access for `taxsimba-staging-api` and client host
- Live staging URLs (blueprint `*.onrender.com` hosts currently HTTP 404)
- Non-empty Stripe TEST `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` in agent env
- Stripe CLI

## Operator deploy (exact SHA)

1. Deploy backend `backend-node` from commit `d97aff5b768dfcce53af1a3789d6c08cf1cc0eae`.
2. Deploy client **`tax_simba_frontend`** (Next.js) from the **same** commit.  
   Do not rely on CRA `frontend/` alone — C-004 CTAs/switcher are in Next.js.
3. Env on API:
   - `STRIPE_SECRET_KEY=sk_test_…`
   - `STRIPE_WEBHOOK_SECRET=whsec_…` for staging endpoint
   - `PAYMENT_PROVIDER` **unset** (disable fake fulfilment)
   - `APP_BASE_URL=https://<staging-client-origin>`
   - `GIT_SHA=d97aff5b768dfcce53af1a3789d6c08cf1cc0eae`
4. Stripe TEST webhook → `POST /api/stripe/webhook` (events include `checkout.session.completed`).
5. Verify:
   ```bash
   curl -sS "$BACKEND_URL/api/build-info"
   curl -sS "$CLIENT_URL/build-info"
   ```
   Both `gitSha` must equal `d97aff5b768dfcce53af1a3789d6c08cf1cc0eae`.
6. Run SA→MTD and MTD→SA real Checkout; complete `docs/C004_STAGING_ACCEPTANCE_HANDOFF.md` checklist.

## Fake fulfilment policy

`PAYMENT_PROVIDER=fake` is only allowed when `APP_BASE_URL` is localhost/127.0.0.1.  
Staging must leave `PAYMENT_PROVIDER` unset so fulfilment is Stripe-webhook only.
