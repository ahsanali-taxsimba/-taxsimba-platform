# C-004 / Task 4 — consolidated retest checklist

**Status:** LOCAL PASS, awaiting staging acceptance  
**Branch:** `cursor/toxsl-blockers-b01-b04-80a7`  
**Deploy SHA:** see `docs/C004_DEPLOY_SHA.txt` (single source — must match build-info)  
**PR:** https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/18  

Tasks 1–3 remain preserved on this branch (SA certificate, client upload, email branding).

## Fulfilment legend

| Mode | Meaning |
|---|---|
| **SIMULATED** | Local `PAYMENT_PROVIDER=fake` with localhost `APP_BASE_URL` |
| **BLOCKED** | Not executed here (Stripe TEST keys empty / staging unreachable) |
| **STAGING** | Operator must run after deploy of the deploy SHA |

## Local matrix (SIMULATED)

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Original C-004 repro (no Add MTD CTA / locked planlist) | PASS | evidence zip `repro/` |
| 2 | SA→MTD same account both ACTIVE | PASS (SIMULATED) | `api/sa_then_mtd_my_services.json`, screenshots |
| 3 | MTD→SA same account both ACTIVE | PASS (SIMULATED) | `api/mtd_then_sa_my_services.json`, screenshots |
| 4 | Activation only after payment; cancel leaves second inactive | PASS (SIMULATED) | vitest C-004 cancel |
| 5 | Separate service rows + case IDs | PASS | `api/case_ids_sa_then_mtd.json` |
| 6 | Switcher SA↔MTD + refresh | PASS | `browser_*_both.json` |
| 7 | Logout/login retains switcher | PASS | `*_05_after_relogin.png` |
| 8 | Replay fulfilment no duplicates | PASS (SIMULATED) | vitest C-004 replay |
| 9 | Client isolation | PASS | vitest + proof `isolationNoOverlap` |
| 10 | Access without UTR | PASS | vitest unpaid/UTR |
| 11 | SA Tax Tracker excludes MTD cases (no dual WIP leak) | PASS | `api/sa_then_mtd_all_tax_returns.json`; AFTER screenshot 1 WIP |
| 12 | Stripe TEST checkout | **BLOCKED** | — |
| 13 | Staging acceptance | **BLOCKED** | — |

## Staging matrix (operator — Stripe TEST)

Repeat checks 2–11 on the **deploy SHA** with `PAYMENT_PROVIDER` unset and Stripe TEST webhook. Do not mark STAGING PASS until complete.

## Automated commands (local)

```bash
cd backend-node
npx vitest run tests/integration/toxelC004DualService.test.ts \
  tests/integration/toxslBlockersB01toB04.test.ts \
  tests/integration/clientContractDto.test.ts \
  tests/integration/finalUatHardeningLifecycle.test.ts
node scripts/assertCatalogueJourneyC004.mjs
```

Latest local totals: **29 passed / 0 failed / 0 skipped**.

## Downloadable evidence

Artifact (Cursor walkthrough upload): `task4_c004_evidence_download.zip`  
Also mirrored under `/opt/cursor/artifacts/task4_c004_evidence_download/` and agent store.
