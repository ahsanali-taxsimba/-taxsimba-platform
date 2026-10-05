# Task 6 — Additional Work payment requests (D-006–D-010 / M-005)

**Status:** LOCAL PASS — SIMULATED PAYMENT  
**Stripe TEST / staging / external inbox:** BLOCKED (no Stripe TEST keys exercised; Mailpit local only when SMTP pointed at it)  
**Branch:** `cursor/toxsl-blockers-b01-b04-80a7`  
**J-011:** remains **UNVERIFIED** (Task 5; not reopened here)  
**Final Toxel handoff SHA:** deferred  

## Reproduction / root cause

| Item | Detail |
|---|---|
| Symptom | Toxel could not find Admin/Super Admin UI to create an Additional Work payment request (blocking D-006–D-010, M-005) |
| Launch app | `tax_simba_admin_frontend/` manage-tax case overview |
| Root cause | **Missing UI mount** — `AdditionalWorkPanel.tsx` existed with full create/list/resend/cancel but was **never imported** into `manage-tax/[taxReturnId]/page.tsx`. Backend + client pay path already existed. |
| Not the cause | Permissions (ADMIN/SUPER_ADMIN already authorised), routing of APIs, or missing backend domain |

## Corrections shipped

1. Mount `<AdditionalWorkPanel />` on case overview (Admin/Super Admin create button + GBP currency display).
2. Client notify deep links: `/subscription` → `/dashboard/billing-history` (create, resend, paid receipt).
3. Resend: mark prior unread reminder notifications read so reminder **email always sends** (notify collapse had skipped email).
4. AW checkout: reuse provider-complete/DB-pending session (no second payable charge).

## Launch apps verified

1. `backend-node/` — typecheck + build PASS  
2. `tax_simba_frontend/` — `npm run build` PASS  
3. `tax_simba_admin_frontend/` — `npm run build` PASS  

## Automated commands

```bash
cd backend-node
npx vitest run \
  tests/integration/additionalWorkTask6.test.ts \
  tests/integration/compatK8.test.ts \
  tests/integration/payments.test.ts \
  tests/integration/verifyPurchaseK2.test.ts
# → 4 files / 44 tests PASS

OUT_DIR=/tmp/t6-aw-proof npx ts-node --transpile-only scripts/task6AdditionalWorkProof.ts
npm run typecheck && npm run build
cd ../tax_simba_frontend && npm run build
cd ../tax_simba_admin_frontend && npm run build
```

## Checklist (LOCAL vs STAGING)

| ID / check | Local (SIMULATED) | Stripe/staging | Notes |
|---|---|---|---|
| D-006 Admin create request (desc/amount/currency) | PASS | BLOCKED | Panel mounted; GBP fixed server-side |
| D-007 Client sees request + email + in-app notify | PASS (local email / Mailpit when SMTP) | BLOCKED external inbox | Deep link `/dashboard/billing-history` |
| D-008 Client can pay outstanding | PASS (Fake) | BLOCKED Stripe TEST | Amount locked server-side |
| D-009 Paid → receipt; unpaid on cancel/fail | PASS | BLOCKED | Return URL alone unpaid |
| D-010 No package activation; no double pay/receipt | PASS | BLOCKED | AW fulfil never activates SA/MTD |
| M-005 Staff resend/remind outstanding | PASS | BLOCKED | Paid cannot resend; unread collapse fixed |
| Client A ≠ Client B isolation | PASS | BLOCKED | |
| Persistence refresh/re-login | PASS (API + browser when run) | BLOCKED | |
| Real Stripe TEST checkout | BLOCKED | BLOCKED | Empty/unused Stripe keys |
| J-011 (carry-forward) | **UNVERIFIED** | BLOCKED | Task 5 |

## Changed files (code)

- `tax_simba_admin_frontend/.../manage-tax/[taxReturnId]/page.tsx`
- `tax_simba_admin_frontend/.../AdditionalWorkPanel.tsx`
- `tax_simba_admin_frontend/P0_K8_NOTES.md`
- `backend-node/src/domain/additionalWork.ts`
- `backend-node/src/routes/payments.ts`
- `backend-node/tests/integration/additionalWorkTask6.test.ts`
- `backend-node/scripts/task6AdditionalWorkProof.ts`
- `docs/T6_ADDITIONAL_WORK_RETEST_CHECKLIST.md`
- `docs/UAT_TOXSL_IMPACT_MATRIX.md`
- `START_HERE_TOXEL.md`
