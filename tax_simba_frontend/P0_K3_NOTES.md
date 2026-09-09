# TaxSimba Toxel client frontend (P0 integration working copy)

Source of truth for structure: `origin/toxel-frontend-reference` zip
(`TaxSimba_Toxel_Frontend_GitHub_Reference.zip` → `tax_simba_frontend/`).

This tree lives on `taxsimba-p0-integration` only so P0 frontend changes can ship
alongside Node compat adapters. The `toxel-frontend-reference` branch itself is
**not** modified.

## P0 K.3 changes on this copy

- Ownership SoT: ACTIVE SA/MTD via middleware JWT flags (not `isSubscriptionBuy`)
- Stripe **Checkout Session only** on plan purchase page
- Hide OTP login chooser + Google sign-in/up
- checkout-success refreshes entitlements from server; never sets `isSubscriptionBuy`
- Hide billing portal / cancel on My Subscriptions; upgrade CTA only

Point `NEXT_PUBLIC_API_URL` / `API_URL` at the Node compat base, e.g.
`https://<host>/api/compat/`.
