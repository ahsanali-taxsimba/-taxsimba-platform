# Task 5 follow-up — SA upgrade pricing / payment / billing

**Status:** LOCAL PASS — SIMULATED PAYMENT  
**Stripe TEST / staging acceptance:** BLOCKED (empty Stripe keys / no staging deploy)  
**Branch:** `cursor/toxsl-blockers-b01-b04-80a7`  
**Final Toxel handoff SHA:** deferred until remaining tasks complete  

## Upgrade charging rule (established — not a catalogue defect)

```
amount_payable = max(target_SA_catalogue_price − existing_SA_agreed_price, 0)
```

- Server-side integer pence; client amounts rejected.
- Credit = frozen SA `agreed_price` only (MTD payments excluded).
- Target = live Self Assessment catalogue price.
- Catalogue-driven; amounts are not hard-coded in application logic.
- At DEFAULT catalogue (£119 / £149 / £299):
  - SIMPLE→SMART = **£30**
  - SMART→ELITE = **£150** (credit is updated SMART agreed_price 149, not original 119)
  - SIMPLE→ELITE = **£180**
  - Sequential SIMPLE→SMART→ELITE total paid = **£299** (119+30+150)

## J-011 — original error vs hardening

| Item | Result |
|---|---|
| Toxel reported symptom | “Error during package/SA-upgrade payment flow” |
| Reproduction in this environment | **Could not reproduce** a specific runtime checkout error against FakePaymentProvider / local catalogue |
| Classification | **Original J-011 finding: UNVERIFIED** (not claimed fixed as a reproduced defect) |
| What was shipped | **Preventive hardening** — LOCAL PASS SIMULATED: `assertNoClientAmount`, `mapPaymentError`, inflight reuse (including provider-complete-but-DB-pending), final-amount confirm UX, no second payable upgrade while pending |

## Zero-payable behaviour (intended)

When a higher-rank target catalogue price is ≤ the client’s SA agreed-price credit:

1. Options quote `additional_amount_payable = 0` / `amount_due_pence = 0` (never negative).
2. Checkout is **refused** with `400 No additional amount payable` — no Stripe session, no refund.
3. Package stays unchanged until a positive payable path exists.
4. A success / return URL alone never activates the upgrade.

## Finding classification

| ID | Classification | Root cause | Correction / status |
|---|---|---|---|
| D-001 | Presentation / clarity (not wrong charge) | UI showed full sticker; charge was difference | Target / credit / payable labelled — LOCAL PASS SIMULATED |
| C-009 | Billing clarity | History lacked “upgrade difference” label | Description + currency + pending — LOCAL PASS SIMULATED |
| J-011 | Original runtime error | Not reproduced | **UNVERIFIED**; preventive hardening LOCAL PASS SIMULATED |
| D-004 / D-005 | Related | Super Admin pricing / agreed freeze | Preserved — LOCAL PASS |

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
# → 5 files / 55 tests PASS

OUT_DIR=/tmp/t5-sa-upgrade-proof-followup npx ts-node --transpile-only scripts/task5SaUpgradeProof.ts
npm run typecheck && npm run build
cd ../tax_simba_frontend && npm run build
cd ../tax_simba_admin_frontend && npm run build
```

## Checklist (LOCAL vs STAGING)

| Check | Local (SIMULATED) | Stripe/staging | Evidence |
|---|---|---|---|
| D-001 difference vs full price | PASS | BLOCKED | E2, E9, E10 |
| C-009 billing amount clarity | PASS | BLOCKED | E6, E11, E13 |
| J-011 original runtime error | **UNVERIFIED** | BLOCKED | J-011 section above |
| J-011 preventive hardening | PASS (fake) | BLOCKED | E3, E14, inflight reuse test |
| D-004/D-005 Super Admin / agreed freeze | PASS | BLOCKED | agreed-credit + packagePricingP0 |
| SIMPLE→SMART £30 | PASS | BLOCKED | E2, E4, sequential proof |
| SMART→ELITE £150 (not £180) | PASS | BLOCKED | E8 sequential / proof 08–09 |
| Sequential total paid £299 | PASS | BLOCKED | proof 09 |
| Direct SIMPLE→ELITE £180 | PASS | BLOCKED | proof 10 |
| MTD excluded from SA credit | PASS | BLOCKED | C-009 vitest |
| Zero-payable (target ≤ credit) | PASS | BLOCKED | proof 11 + vitest |
| Price change before checkout + accept final | PASS | BLOCKED | price-move vitest + confirm UI E10 |
| Delayed confirmation / pending | PASS | BLOCKED | delayed-confirm vitest |
| Failed/replayed webhooks | PASS | BLOCKED | cancel-replay vitest |
| Double-click / refresh / no second payable | PASS | BLOCKED | no-dup-upgrade vitest |
| Cancel preserves package | PASS | BLOCKED | E5, E16, E17 |
| Success URL alone never activates | PASS (vitest Fake) | BLOCKED | cancel/delayed vitest |
| No duplicate entitlements/cases | PASS | BLOCKED | cancel-replay case count |
| Isolation + reject client amount | PASS | BLOCKED | E3, isolation vitest |
| No SA-upgrade success email | PASS | BLOCKED | email count vitest |
| Refresh/re-login billing | PASS | BLOCKED | E13 |
| Real Stripe TEST checkout | BLOCKED | BLOCKED | — |

**SIMULATED fulfilment is not real Stripe payment proof.**
