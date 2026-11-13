# Package inclusions resolution — PR #35

**Date:** 2026-11-13 (Europe/London)  
**Catalogue:** `backend-node/data/catalog/packages_inclusions_catalogue.v2026-11-13.json`  
**Runtime:** `backend-node/data/catalog/packages.json` (`2026-11-simba-v2-inclusions-partial`)  
**HOLD:** Do not merge / deploy production / delete Python.

---

## Verdict

| Question | Answer |
|----------|--------|
| Which inclusions are **VERIFIED**? | **Prices**, **billing**, **SA names** (Simple/Smart/Elite), **MTD VAT-included monthly prices**, **consultation £99/30min**. Circumstance *ranking heuristics* (lowest suitable tier) are verified as guidance only — not service guarantees. |
| Which require **APPROVAL**? | **All feature bullets and descriptions** recovered from the public subscription-plans API; **all exclusions** (missing); **MTD customer-facing names** (Starter/Complete vs Simbian Comply/Elite); **consultation inclusions**; live Stripe Checkout amounts on staging. |
| Ready for Toxel staging? | **YES for controlled HTTPS staging preparation** with the partial catalogue + pending labels. **NO for production** until TaxSimba signs off inclusions/names and staging E2E (Stripe/Calendly/register) passes. |

`detailed_recommendations_status`: **`partial_recovered_public_api_pending_signoff`** (no longer a hard total block on quoting recovered text — but still not `approved_by_taxsimba`).

---

## Source comparison (evidence)

| Source | Result |
|--------|--------|
| `https://taxsimba.co.uk/api/compat/subscription-plans?category=taxSimba` | SIMPLE/SMART/ELITE @ £119/£149/£299 + descriptions/features — raw JSON saved |
| `https://taxsimba.co.uk/api/compat/subscription-plans?category=mtd` | MTD_COMPLY/GROWTH/ELITE as Simbian Comply/Growth/Elite @ £29.99/£59.99/£89.99 + Xero tiers — raw JSON saved |
| SIMBA `packages.json` (pre-fix) | Prices only; inclusions null / blocked |
| Portal `DEFAULT_PACKAGES` | SA Simple/Smart/Elite £119/£149/£299; MTD Starter/Growth/Complete £29.99/£59.99/£89.99 |
| Homepage HTML crawl | Mentions £119/£149/£299; no MTD monthly figures in home HTML sample |

Raw captures: `public_api_sa_taxSimba.json`, `public_api_mtd.json`.

### Name / code conflicts (do not assume equivalence)

| Price | SIMBA / portal | Public API |
|------:|----------------|------------|
| £29.99/mo | MTD Starter (`MTD_STARTER`) | Simbian Comply (`MTD_COMPLY`) |
| £59.99/mo | MTD Growth (`MTD_GROWTH`) | Simbian Growth (`MTD_GROWTH`) |
| £89.99/mo | MTD Complete (`MTD_COMPLETE`) | Simbian Elite (`MTD_ELITE`) |

---

## VERIFIED vs REQUIRES APPROVAL (summary)

### VERIFIED (SIMBA may state confidently)

- SA Simple **£119** / Smart **£149** / Elite **£299** per tax year  
- MTD **£29.99 / £59.99 / £89.99** per month, **VAT included**  
- SA display names Simple / Smart / Elite  
- Consultation **£99 / 30 minutes / Google Meet** (booking stub)  
- Prefer **lowest suitable** tier; never Elite/Complete alone as default  

### REQUIRES APPROVAL (TaxSimba / accountant)

- Every SA/MTD description and feature bullet from the public API (including Xero Simple/Ignite/Grow, priority messaging, planning conversations, quarterly reviews, etc.)  
- Explicit **exclusions** (none published)  
- MTD **naming** (Starter/Complete vs Simbian Comply/Elite)  
- Consultation feature list  
- Stripe live test `amount_total` on staging (portal unit_amount tests: 11900/14900/29900 and 2999/5999/8999 — staging Checkout still BLOCKED without secret)

---

## SIMBA behaviour after this change

1. Quotes **VERIFIED** prices and SA names.  
2. Quotes recovered inclusions **only** with **PENDING APPROVAL** labelling; will not invent extras.  
3. Recommends **lowest suitable** package with a circumstance reason that does not depend on unapproved benefits.  
4. If suitability would depend on a pending inclusion → states the limitation and offers TaxSimba confirmation / £99 consult when connected.  
5. Guides to verified/soft links: `/self-assessment`, `/making-tax-digital`, `/register` (register remains soft_or_generic).  
6. Existing clients → dashboard messaging, no upsell package dump.

---

## Tests & evidence

| Item | Result |
|------|--------|
| Vitest | **458 passed** (includes `inclusions_resolution.test.ts`) |
| Live OpenAI journey transcripts | `test_transcripts.json` (10 scenarios) |
| Screenshots | `screenshots/01_choose_package_lowest_suitable.png`, `02_inclusions_pending_labelled.png` |
| Invented-benefit probe | Forced catalogue path — no 24/7 helpline invention |

---

## Unresolved approval checklist (owners)

| ID | Owner | Item |
|----|-------|------|
| APPROVE-SA-DESCRIPTIONS | TaxSimba | SA short descriptions |
| APPROVE-SA-INCLUSIONS | TaxSimba | SA feature bullets |
| APPROVE-MTD-NAMES | TaxSimba | Starter/Complete vs Simbian Comply/Elite |
| APPROVE-MTD-INCLUSIONS | TaxSimba | MTD features incl. Xero entitlements |
| APPROVE-EXCLUSIONS | TaxSimba | Explicit exclusions per SKU |
| APPROVE-CONSULT-INCLUSIONS | TaxSimba | £99 consult coverage |
| VERIFY-STRIPE-AMOUNTS-STAGING | Toxel | Live Checkout amounts |

Until TaxSimba returns signed-off wording, SIMBA must keep `pending_taxsimba_signoff` / `conflict_pending_approval` statuses.
