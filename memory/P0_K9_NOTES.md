# P0 K.9 — Final E2E gate + release matrix

## What landed

- CRITICAL thin compat aliases for remaining in-scope FE paths:
  - `auth/change-password`, `auth/update-account-settings`
  - admin/accountant communication-log + send-to-client
  - accountant request-documents; staff draft/final uploads
  - SA upgrade-options + upgrade-checkout (planlist fallback when already ACTIVE)
- `tests/integration/compatK9.test.ts` — continuous compat E2E gate
- `memory/P0_K9_RELEASE_MATRIX.md` — PASS/FAIL/DEFERRED/BLOCKED

## Non-goals (unchanged)

- No HMRC, no deferred S6 invent-backends, no parallel payment/data models, no Toxel redesign
- Protected branch tips untouched
- STOP before staging/production
