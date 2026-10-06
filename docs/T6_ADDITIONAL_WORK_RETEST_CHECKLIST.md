# Task 6 — Additional Work payment requests (D-006–D-010 / M-005)

**Status:** LOCAL PASS — SIMULATED PAYMENT / MAILPIT  
**Stripe TEST / staging / external inbox:** BLOCKED  
**Branch:** `cursor/toxsl-blockers-b01-b04-80a7`  
**Tested remote tip:** `63bf9f482a9f7a53967ce098bc2a34b9de286698`  
**J-011:** remains **UNVERIFIED** (Task 5; not reopened)  
**Final Toxel handoff SHA:** deferred  
**Evidence ZIP:** `/opt/cursor/artifacts/task6_additional_work_evidence.zip` (not in git)

## Reproduction / root cause

| Item | Detail |
|---|---|
| Symptom | Toxel could not find Admin/Super Admin UI to create an Additional Work payment request (blocking D-006–D-010, M-005) |
| Launch app | `tax_simba_admin_frontend/` manage-tax case overview |
| Root cause | **Missing UI mount** — `AdditionalWorkPanel` existed but was never imported into `manage-tax/[taxReturnId]/page.tsx` |
| Not the cause | Permissions, API routing, or missing backend domain |
| Browser note | Admin must be on **`:3001`** (CORS allows 3000/3001 only) |

## UAT pack checklist (corrected mapping)

| ID | UAT criterion | Local | Staging | Evidence references |
|---|---|---|---|---|
| **D-006** | Admin creates Additional Work request | **PASS** | BLOCKED | `screenshots/14_admin_aw_form_filled.png`, `16_admin_aw_panel_with_rows.png`; `finalize/api/d006_admin_create.json` (201, desc/amount/GBP) |
| **D-007** | Client sees correct description and amount | **PASS** | BLOCKED | `screenshots/21_client_aw_panel.png`, `finalize/screenshots/d007_d010_billing_panel.png`; `finalize/api/d007_client_sees_desc_amount.json` (`matches: true`, £55.50 / Finalize T6…) |
| **D-008** | Request email and in-app notification arrive | **PASS** (Mailpit local) | BLOCKED external inbox | **Email body:** `finalize/mailpit/d008_request_email.json` + `.html` + `finalize/screenshots/d008_request_email_opened.png` (desc + £ amount + Review & pay). **Opened notification:** `finalize/api/d008_inapp_notifications.json` + `finalize/screenshots/d008_opened_notification_content.png` (title/message/link `/dashboard/billing-history`) |
| **D-009** | Resend/reminder for outstanding request | **PASS** (Mailpit local) | BLOCKED | `finalize/api/d009_resend_outstanding.json` (200); **Reminder email body:** `finalize/mailpit/d009_reminder_email.json` + `.html` + `finalize/screenshots/d009_reminder_email_opened.png` (“Reminder: additional work awaiting payment”, still-outstanding desc/amount) |
| **D-010** | Successful payment, receipt/confirmation, correct status | **PASS** (SIMULATED) | BLOCKED Stripe TEST | `finalize/api/d010_checkout_simulated.json` + webhook success; **Opened receipt:** `finalize/receipts/d010_opened_receipt.html` + `finalize/screenshots/d010_opened_receipt.png` (INV-…, PAID, desc, £55.50); billing Paid badge `21_client_aw_panel.png`; optional Mailpit `finalize/mailpit/d010_payment_received_email.*` |
| **M-005** | Complete request → payment → receipt/status journey | **PASS** (SIMULATED) | BLOCKED | End-to-end: D-006→D-010 above; `proof/00_summary.json`…`10_*.json`; browser create→client billing→opened receipt |

## Additional checks (not D-006–D-010 primary IDs)

| Check | Local | Evidence |
|---|---|---|
| Amount validation / client cannot alter charge | **PASS** | `api/api_03_checkout_amount_locked.json`, `proof/05_checkout_amount_locked.json` |
| Client A ≠ Client B isolation | **PASS** | `proof/04_client_b_isolation.json` |
| Return URL alone cannot mark paid | **PASS** | `api/api_04_return_url_alone.json`, `finalize/api/addl_return_url_alone.json` |
| Failed/cancelled remains unpaid; cancel blocks pay | **PASS** | `finalize/api/addl_cancel.json`; `finalize/api/addl_paid_cancelled_guards.json` (`cancelled_checkout_status: 400`) |
| Delayed/replayed fulfilment / double-click no duplicate receipt | **PASS** | `proof/07_paid_receipt_no_dup_no_package_change.json` (receiptCount 1); webhook replay in finalize |
| AW payment does not activate/change SA or MTD packages | **PASS** | `proof/07_paid_receipt_no_dup_no_package_change.json` (`saPackage` unchanged) |
| **Paid** cannot pay again or receive outstanding reminder | **PASS** | `finalize/api/addl_paid_cancelled_guards.json` — `paid_checkout_status: 400` “already been paid”; `paid_resend_status: 400` “no longer outstanding” |
| **Cancelled** cannot pay again or receive outstanding reminder | **PASS** | same file — `cancelled_checkout_status: 400`; `cancelled_resend_status: 400` |
| Persistence after refresh/re-login | **PASS** | Browser re-login billing panel still lists paid/pending rows |
| Real Stripe TEST / external inbox / staging | **BLOCKED** | No Stripe TEST keys exercised |
| J-011 (carry-forward) | **UNVERIFIED** | Task 5 |

## Commands / counts

```bash
cd backend-node
npx vitest run \
  tests/integration/additionalWorkTask6.test.ts \
  tests/integration/compatK8.test.ts \
  tests/integration/payments.test.ts \
  tests/integration/verifyPurchaseK2.test.ts
# → 4 files / 44 tests PASS

OUT_DIR=/tmp/t6-aw-proof npx ts-node --transpile-only scripts/task6AdditionalWorkProof.ts
node scripts/t6BrowserEvidence.mjs
node scripts/t6FinalizeEvidence.mjs
npm run typecheck && npm run build
cd ../tax_simba_frontend && npm run build
cd ../tax_simba_admin_frontend && npm run build
```

**Label:** all local payments are **SIMULATED FakePaymentProvider**. Mailpit is **local only**.

## Changed files (code)

- `tax_simba_admin_frontend/.../manage-tax/[taxReturnId]/page.tsx`
- `tax_simba_admin_frontend/.../AdditionalWorkPanel.tsx`
- `backend-node/src/domain/additionalWork.ts`
- `backend-node/src/routes/payments.ts`
- `backend-node/tests/integration/additionalWorkTask6.test.ts`
- `backend-node/scripts/task6AdditionalWorkProof.ts`
- `backend-node/scripts/t6BrowserEvidence.mjs`
- `backend-node/scripts/t6FinalizeEvidence.mjs`
- `docs/T6_ADDITIONAL_WORK_RETEST_CHECKLIST.md`
- `docs/UAT_TOXSL_IMPACT_MATRIX.md`
- `START_HERE_TOXEL.md`
