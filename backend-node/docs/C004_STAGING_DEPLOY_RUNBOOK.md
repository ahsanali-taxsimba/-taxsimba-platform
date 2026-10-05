# C-004 staging deploy runbook (Task 4)

**Single deploy SHA:** see `docs/C004_DEPLOY_SHA.txt` (full 40-char).  
**PR:** https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/18  
**Status:** local pass, awaiting staging acceptance

Do **not** mix an older product-fix SHA with a newer tip. Deploy that one SHA everywhere.

## Missing for this agent (no secret values)

- Render deploy token / dashboard access for staging services
- Live staging URLs (blueprint `*.onrender.com` hosts currently HTTP 404)
- Non-empty Stripe TEST `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` in agent env
- Stripe CLI

## Operator deploy (exact SHA)

1. Read SHA from `docs/C004_DEPLOY_SHA.txt`.
2. Deploy backend `backend-node` from that commit.
3. Deploy client **`tax_simba_frontend`** (Next.js) from the **same** commit.  
   Do not rely on CRA `frontend/` alone — C-004 CTAs/switcher/tracker filter are in Next.js.
4. Env on API:
   - `STRIPE_SECRET_KEY=sk_test_…`
   - `STRIPE_WEBHOOK_SECRET=whsec_…` for staging endpoint
   - `PAYMENT_PROVIDER` **unset** (disable fake fulfilment)
   - `APP_BASE_URL=https://<staging-client-origin>`
   - `GIT_SHA=<same SHA as C004_DEPLOY_SHA.txt>`
5. Client/admin: `NEXT_PUBLIC_GIT_SHA` / `GIT_SHA` = same SHA.
6. Stripe TEST webhook → `POST /api/stripe/webhook` (include `checkout.session.completed`).
7. Verify:
   ```bash
   curl -sS "$BACKEND_URL/api/build-info"
   curl -sS "$CLIENT_URL/build-info"
   ```
   Both `gitSha` must equal `docs/C004_DEPLOY_SHA.txt`.
8. Run `docs/C004_RETEST_CHECKLIST.md` staging matrix with real Checkout.

## Fake fulfilment policy

`PAYMENT_PROVIDER=fake` is only allowed when `APP_BASE_URL` is localhost/127.0.0.1.  
Staging must leave `PAYMENT_PROVIDER` unset so fulfilment is Stripe-webhook only.
