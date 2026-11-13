# SIMBA AI — Customer journey test matrix

**Date:** 2026-11-13 (Europe/London)  
**Evidence classes:** L1 conversation · L2 link · L3 public page · L4 staging transaction  

| Journey | L1 | L2 | L3 | L4 | Notes |
|---------|----|----|----|----|-------|
| A. Self Assessment — who needs it | PASS | PASS | PASS (`/self-assessment` title verified) | BLOCKED | Registration/payment/dashboard not exercised |
| A. SA packages £119/£149/£299 | PASS | PASS | PASS (`/pricing`, `/self-assessment`) | BLOCKED | Prices from catalogue; inclusions not invented |
| A. Package selection → pay → dashboard | NOT TESTED | PARTIAL | soft_or_generic `/register` | BLOCKED | Needs staging Stripe + portal |
| B. MTD eligibility / bands / dates | PASS | PASS | PASS (`/making-tax-digital`) | N/A | Includes £50k/2026, £30k/2027, £20k/2028 |
| B. MTD plans £29.99/£59.99/£89.99 | PASS | PASS | PASS | BLOCKED | Checkout not live |
| B. Voluntary / future eligibility | PASS | PASS | PASS | N/A | Conversation + corpus |
| C. 17 calculators | PASS | PASS | PASS (all 17 titles live_verified) | N/A | Paths updated to real taxsimba.co.uk calculators |
| C. Articles / FAQs | PARTIAL | PARTIAL | soft_or_generic | BLOCKED | Generic page titles — confirm with Toxel |
| D. £99 consultation explain | PASS | PARTIAL | soft_or_generic `/book-consultation` | BLOCKED | Calendly + Stripe + Meet not verified |
| D. Slots / pay / confirm / cancel | NOT TESTED | BLOCKED | BLOCKED | BLOCKED | Provider not connected |
| E. Existing customer → assigned accountant | PASS (journey copy) | stub `/dashboard` | BLOCKED | BLOCKED | No authenticated session available |
| Helpful-first (explicitly won’t buy) | PASS | N/A | N/A | N/A | Packages/consultation suppressed |
| Security injection probe | PASS | N/A | N/A | N/A | Live harness |

## Blocked access required from Toxel / admin

1. Staging Stripe keys + webhook endpoint for SA/MTD checkout  
2. Production or staging Calendly event URL for £99 / 30-min Google Meet  
3. Staging client portal credentials (existing customer + new registration + email verify)  
4. Confirmed FAQ/articles/consultation page URLs if soft routes should become live_verified  
5. Approval to embed widget on a staging host of taxsimba.co.uk (not done in this PR)
