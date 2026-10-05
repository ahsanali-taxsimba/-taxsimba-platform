# Task 6 — Additional Work payment requests (D-006–D-010 / M-005)

**Status:** LOCAL PASS — SIMULATED PAYMENT  
**Stripe TEST / staging / external inbox:** BLOCKED (no Stripe TEST keys exercised; Mailpit local only)  
**Branch:** `cursor/toxsl-blockers-b01-b04-80a7`  
**Tested remote tip:** `1f47adbbd3db1d9b5bb20042e9c12b6e01b82040`
**J-011:** remains **UNVERIFIED** (Task 5; not reopened here)  
**Final Toxel handoff SHA:** deferred  
**Evidence ZIP:** `/opt/cursor/artifacts/task6_additional_work_evidence.zip` (not in git)

## Reproduction / root cause

| Item | Detail |
|---|---|
| Symptom | Toxel could not find Admin/Super Admin UI to create an Additional Work payment request (blocking D-006–D-010, M-005) |
| Launch app | `tax_simba_admin_frontend/` manage-tax case overview (`/admin/manage-tax/{caseId}`) |
| Root cause | **Missing UI mount** — `AdditionalWorkPanel.tsx` existed with full create/list/resend/cancel but was **never imported** into `manage-tax/[taxReturnId]/page.tsx`. Backend + client pay path already existed. |
| Not the cause | Permissions (ADMIN/SUPER_ADMIN already authorised), API routing, or missing backend domain |
| Local browser note | Admin must run on **`:3001`** (CORS allows 3000/3001; origin `:3011` is blocked and shows “Error Loading Tax Return”) |

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
node scripts/t6BrowserEvidence.mjs   # admin :3001 + client :3000
```

**Test counts:** 4 files / **44 tests PASS** (vitest). Browser Playwright admin create + client billing: **PASS**.

## Checklist (LOCAL vs STAGING)

| ID / check | Local (SIMULATED) | Stripe/staging | Notes |
|---|---|---|---|
| D-006 Admin create request (desc/amount/currency) | **PASS** | BLOCKED | Panel mounted; GBP fixed server-side; browser create £42.75 |
| D-007 Client sees request + email + in-app notify | **PASS** (Mailpit local) | BLOCKED external inbox | Deep link `/dashboard/billing-history` |
| D-008 Client can pay outstanding | **PASS** (Fake) | BLOCKED Stripe TEST | Amount locked server-side |
| D-009 Paid → receipt; unpaid on cancel/fail | **PASS** | BLOCKED | Return URL alone unpaid |
| D-010 No package activation; no double pay/receipt | **PASS** | BLOCKED | AW fulfil never activates SA/MTD |
| M-005 Staff resend/remind outstanding | **PASS** | BLOCKED | Paid cannot resend; unread collapse fixed |
| Client A ≠ Client B isolation | **PASS** | BLOCKED | |
| Persistence refresh/re-login | **PASS** (API + browser) | BLOCKED | |
| Real Stripe TEST checkout | **BLOCKED** | BLOCKED | Empty/unused Stripe keys |
| J-011 (carry-forward) | **UNVERIFIED** | BLOCKED | Task 5 |

## Browser evidence (redacted)

- Admin panel: `screenshots/13_admin_aw_panel.png`, `16_admin_aw_panel_with_rows.png`
- Admin UI create: `14_admin_aw_form_filled.png` → `15_admin_aw_after_create.png`
- Client billing: `21_client_aw_panel.png` (Pay securely + Paid receipt)
- API: `api/api_01_admin_create.json` … `api_04_return_url_alone.json`
- Mailpit: `mailpit/mailpit_summary.json` (local AW email subject present)

## Changed files (code)

- `tax_simba_admin_frontend/.../manage-tax/[taxReturnId]/page.tsx`
- `tax_simba_admin_frontend/.../AdditionalWorkPanel.tsx`
- `tax_simba_admin_frontend/P0_K8_NOTES.md`
- `backend-node/src/domain/additionalWork.ts`
- `backend-node/src/routes/payments.ts`
- `backend-node/tests/integration/additionalWorkTask6.test.ts`
- `backend-node/scripts/task6AdditionalWorkProof.ts`
- `backend-node/scripts/t6BrowserEvidence.mjs`
- `docs/T6_ADDITIONAL_WORK_RETEST_CHECKLIST.md`
- `docs/UAT_TOXSL_IMPACT_MATRIX.md`
- `START_HERE_TOXEL.md`
