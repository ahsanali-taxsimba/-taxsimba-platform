# P0 K.8 — Additional-work payment-request FE wire

## Backend
- Shared domain: `backend-node/src/domain/additionalWork.ts` (single implementation)
- Native routes call the domain helpers (behaviour preserved)
- Compat aliases under `/api/compat` for Toxel FE paths

## Admin FE
- `manage-tax/_sections/AdditionalWorkPanel.tsx` — create/list/resend/cancel on case detail
- `manage-payments` — list includes ADDITIONAL_WORK; stats/by-user deferred

## Client FE
- Billing history: `AdditionalWorkClientPanel` + `client/transaction/list` adapter
- Pay via Stripe Checkout Session (`client/payment-requests/:id/checkout`)

## Non-goals
- No HMRC
- No parallel payment system
- AW fulfil never activates SA/MTD (protected in native `fulfil`)
