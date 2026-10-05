# Task 5 — SA upgrade pricing / payment / billing history

**Status:** LOCAL PASS — SIMULATED PAYMENT  
**Stripe TEST / staging acceptance:** BLOCKED (empty Stripe keys in this environment)  
**Branch:** `cursor/toxsl-blockers-b01-b04-80a7`  
**Final Toxel handoff SHA:** deferred until remaining tasks complete  
**Evidence ZIP (downloadable):** `/opt/cursor/artifacts/task5_sa_upgrade_evidence_download.zip`

## Upgrade charging rule (established)

```
amount_payable = max(target_SA_catalogue_price − existing_SA_agreed_price, 0)
```

- Computed **server-side in integer pence**; client amounts are rejected.
- Credit is the client's frozen SA `agreed_price` (excludes MTD).
- Target price is the live Self Assessment catalogue price.
- At DEFAULT catalogue (£119 / £149 / £299): SIMPLE→SMART = **£30**, SMART→ELITE = **£150**, SIMPLE→ELITE = **£180**.
- These differences are **legitimate**, not a pricing defect. D-001 / C-009 were presentation / labelling gaps.

## Finding classification

| ID | Classification | Root cause | Correction |
|---|---|---|---|
| D-001 | Presentation / clarity (not wrong charge) | Checkout UI showed full package sticker; Stripe charged difference | Show target price, upgrade credit, amount payable |
| C-009 | Presentation / billing clarity | History showed bare delta without “upgrade difference” label | Billing description + currency + pending state |
| J-011 | Payment-flow robustness | Unclear errors; compat lacked session reuse; no amount rejection UX | mapPaymentError; inflight reuse; reject client amounts; confirm final amount |
| D-004 / D-005 | Related checklist | Catalogue / Super Admin pricing preserved | No change to agreed-price freeze / admin pricing |

## Launch apps built

1. `backend-node/` — typecheck + build PASS  
2. `tax_simba_frontend/` — `npm run build` PASS  
3. `tax_simba_admin_frontend/` — `npm run build` PASS  

## Automated commands

```bash
cd backend-node
npx vitest run tests/integration/saUpgradePricingTask5.test.ts \
  tests/integration/payments.test.ts \
  tests/integration/toxslBlockersB01toB04.test.ts \
  tests/integration/verifyPurchaseK2.test.ts \
  tests/integration/compatK9.test.ts
# → 5 files / 50 tests PASS

npx ts-node --transpile-only scripts/task5SaUpgradeProof.ts
npm run typecheck && npm run build

cd ../tax_simba_frontend && npm run build
cd ../tax_simba_admin_frontend && npm run build
```

## Checklist (LOCAL vs STAGING)

| Check | Local (SIMULATED) | Stripe/staging | Evidence |
|---|---|---|---|
| D-001 difference vs full price | PASS (documented + UI) | BLOCKED | options JSON + screenshots 02/03 |
| C-009 billing amount clarity | PASS | BLOCKED | billing screenshots 04/06 + my-payments |
| J-011 upgrade payment flow | PASS (fake) | BLOCKED | vitest + checkout JSON |
| D-004/D-005 Super Admin pricing / agreed freeze | PASS (preserved) | BLOCKED | packagePricingP0 + agreed-credit test |
| Server pence calc; reject client amount | PASS | BLOCKED | saUpgradePricingTask5 |
| Agreed SA credit; exclude MTD | PASS | BLOCKED | C-009 test |
| Catalogue price change mid-flow | PASS | BLOCKED | price-move test |
| Cancel preserves package | PASS | BLOCKED | cancel test + proof 05 |
| Success URL alone never activates | PASS (fulfil requires paid) | BLOCKED | cancel/expired path |
| Replay / idempotent fulfil | PASS | BLOCKED | replay test |
| No duplicate cases/docs loss | PASS | BLOCKED | case count assertion |
| Downgrade blocked | PASS | BLOCKED | vitest |
| Isolation | PASS | BLOCKED | isolation test |
| No SA-upgrade success email | PASS | BLOCKED | email count test |
| Refresh/re-login billing | PASS | BLOCKED | screenshot 06 |
| Real Stripe TEST checkout | BLOCKED | BLOCKED | — |

## Email scope

Do **not** send normal package / SA-upgrade payment-success emails (preserved).
