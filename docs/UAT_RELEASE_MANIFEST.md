# UAT Release Manifest — Final Contract RC

## Identity

- **Base SHA:** `870b29d76959e3083f2b854689156e7ef54fbfae`
- **Working branch:** `cursor/final-contract-rc-80a7`
- **Integration target:** `toxel-uat-approved`
- **New tip SHA:** *(filled after merge — use `git rev-parse HEAD` on toxel-uat-approved)*

## Local release gate (this RC)

| Check | Result |
|---|---|
| Backend typecheck | PASS |
| Backend full suite | PASS (429 tests) |
| Client production build | PASS |
| Admin production build | PASS |
| Contract DTO suite | PASS |
| Release-acceptance API suite | PASS |
| Client Playwright static guards | PASS (4/4; live staging skipped without E2E_BASE_URL) |
| Shared-staging 30/30 browser suite | NOT EXECUTED in this environment |

## Deployment order

1. Backend (`backend-node`)
2. Client (`tax_simba_frontend`)
3. Admin (`tax_simba_admin_frontend`)

All three must report the same tip SHA via build-info.

## Migrations

None. No schema migration scripts required for this RC.

## Environment variables

No new required variables. Optional:

- `EMAIL_LOGO_URL` — absolute HTTPS PNG logo override
- Existing Stripe TEST keys remain required on shared staging (`PAYMENT_PROVIDER=fake` is localhost-only)

## Rollback

Redeploy previous tip `870b29d76959e3083f2b854689156e7ef54fbfae` for Backend → Client → Admin in that order.

## Staging acceptance

See `docs/STAGING_RELEASE_ACCEPTANCE.md`.
