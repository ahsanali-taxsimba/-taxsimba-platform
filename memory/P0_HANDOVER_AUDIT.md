# P0 Pre-Toxel Handover Audit

**Verdict: A. READY FOR TOXEL STAGING**  
**Base tip audited:** `38549faa0d2b71da3fc8c98fd240222c279971b1` (K.9)  
**K.8 checkpoint:** `9d5251d`

## Regression

- `npm run typecheck` — PASS  
- `npm test` — PASS — **28 files / 288 tests** (was 282; +6 `handoverAudit.test.ts`)

## Launch-critical closes (this commit only)

No redesign / no parallel payment or entitlement systems / no HMRC.

1. Compat `POST /admin/tax-return/:taxReturnId/files` (+ accountant detail shape)  
2. Admin AW panel `clientAxios.get(..., true, { params })`  
3. Compat `GET client/global-fee` + `POST client/tax-return-type` from packages  
4. Compat `client/drafts` GET/approve/reject/request-changes  
5. Elements paths HIDE 405; TaxTracker PaymentModal removed  
6. MTD Start Next Quarter Start Now hidden (T3)  
7. Authenticated document download wiring (client + admin)

## Deferred (SAFE — documented in TOXEL_HANDOVER.md)

OTP/Google, Elements/portal, S6 CMS, payment analytics/export, start-next-quarter, HMRC, staff photo/UTR, non-AW VAT PDF, marketing CMS.

## Stop

Staging ops may begin after Toxel acceptance of `TOXEL_HANDOVER.md`.  
Do **not** start production. Do **not** merge without owner approval. Do **not** start K.10.
