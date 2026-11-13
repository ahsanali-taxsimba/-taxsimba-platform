# Six-package approval matrix — SIMBA / TaxSimba

**Date:** 2026-11-13 (Europe/London)
**Rule:** Recovered website wording is evidence for review only — not approved contractual inclusions.
**Customer-facing VERIFIED names:** SA Simple/Smart/Elite · Simbian Comply/Growth/Elite
**Internal MTD codes (unchanged):** `MTD_STARTER` → Comply · `MTD_GROWTH` → Growth · `MTD_COMPLETE` → Elite

| Package | Field | Proposed / recovered wording | Source | Status |
|---|---|---|---|---|
| Self Assessment Simple | `name` | Self Assessment Simple | TaxSimba confirmation + public API + portal | **VERIFIED** |
| Self Assessment Simple | `price_gbp` | £119 per tax year | TaxSimba confirmation + public API + portal/Stripe unit_amount mapping | **VERIFIED** |
| Self Assessment Simple | `vat_note` | Confirm VAT treatment on checkout | portal/SIMBA catalogue | **VERIFIED** |
| Self Assessment Simple | `description` | A straightforward Self Assessment for employed and simple self-employed income, prepared and checked by a qualified accountant. | public API taxSimba category (recovered 2026-11-13) | **REQUIRES APPROVAL** |
| Self Assessment Simple | `inclusion` | Self Assessment prepared by an accountant | public API taxSimba category (recovered 2026-11-13) | **REQUIRES APPROVAL** |
| Self Assessment Simple | `inclusion` | Secure document upload | public API taxSimba category (recovered 2026-11-13) | **REQUIRES APPROVAL** |
| Self Assessment Simple | `inclusion` | Review and approval before submission | public API taxSimba category (recovered 2026-11-13) | **REQUIRES APPROVAL** |
| Self Assessment Simple | `inclusion` | Email and in-app updates | public API taxSimba category (recovered 2026-11-13) | **REQUIRES APPROVAL** |
| Self Assessment Simple | `exclusions` | (none published) | not found in public API / portal seed | **UNKNOWN** |
| Self Assessment Smart | `name` | Self Assessment Smart | TaxSimba confirmation + public API + portal | **VERIFIED** |
| Self Assessment Smart | `price_gbp` | £149 per tax year | TaxSimba confirmation + public API + portal/Stripe unit_amount mapping | **VERIFIED** |
| Self Assessment Smart | `vat_note` | Confirm VAT treatment on checkout | portal/SIMBA catalogue | **VERIFIED** |
| Self Assessment Smart | `description` | For clients with several income sources who want their allowances and expenses reviewed in detail before filing. | public API taxSimba category (recovered 2026-11-13) | **REQUIRES APPROVAL** |
| Self Assessment Smart | `inclusion` | Everything in Simple | public API taxSimba category (recovered 2026-11-13) | **REQUIRES APPROVAL** |
| Self Assessment Smart | `inclusion` | Multiple income sources reviewed | public API taxSimba category (recovered 2026-11-13) | **REQUIRES APPROVAL** |
| Self Assessment Smart | `inclusion` | Expenses and allowances check | public API taxSimba category (recovered 2026-11-13) | **REQUIRES APPROVAL** |
| Self Assessment Smart | `inclusion` | Priority accountant messaging | public API taxSimba category (recovered 2026-11-13) | **REQUIRES APPROVAL** |
| Self Assessment Smart | `exclusions` | (none published) | not found in public API / portal seed | **UNKNOWN** |
| Self Assessment Elite | `name` | Self Assessment Elite | TaxSimba confirmation + public API + portal | **VERIFIED** |
| Self Assessment Elite | `price_gbp` | £299 per tax year | TaxSimba confirmation + public API + portal/Stripe unit_amount mapping | **VERIFIED** |
| Self Assessment Elite | `vat_note` | Confirm VAT treatment on checkout | portal/SIMBA catalogue | **VERIFIED** |
| Self Assessment Elite | `description` | Our most thorough Self Assessment service, including planning conversations and a full review of your position for the year. | public API taxSimba category (recovered 2026-11-13) | **REQUIRES APPROVAL** |
| Self Assessment Elite | `inclusion` | Everything in Smart | public API taxSimba category (recovered 2026-11-13) | **REQUIRES APPROVAL** |
| Self Assessment Elite | `inclusion` | Full review of your tax position | public API taxSimba category (recovered 2026-11-13) | **REQUIRES APPROVAL** |
| Self Assessment Elite | `inclusion` | Tax planning conversation | public API taxSimba category (recovered 2026-11-13) | **REQUIRES APPROVAL** |
| Self Assessment Elite | `inclusion` | Priority turnaround | public API taxSimba category (recovered 2026-11-13) | **REQUIRES APPROVAL** |
| Self Assessment Elite | `exclusions` | (none published) | not found in public API / portal seed | **UNKNOWN** |
| Simbian Comply | `name` | Simbian Comply | TaxSimba official confirmation (2026-11-13) + public API | **VERIFIED** |
| Simbian Comply | `internal_code` | MTD_STARTER | portal/Stripe compatibility identity (unchanged amounts) | **VERIFIED** |
| Simbian Comply | `price_gbp` | £29.99 per month; VAT included | TaxSimba confirmation + public API + portal | **VERIFIED** |
| Simbian Comply | `description` | Your accountant maintains your records and handles your quarterly updates and year-end tax return. | public API mtd / MTD_COMPLY | **REQUIRES APPROVAL** |
| Simbian Comply | `inclusion` | Xero Simple subscription included | public API mtd / MTD_COMPLY | **REQUIRES APPROVAL** |
| Simbian Comply | `inclusion` | MTD registration and setup support | public API mtd / MTD_COMPLY | **REQUIRES APPROVAL** |
| Simbian Comply | `inclusion` | Accountant-maintained bookkeeping and digital records | public API mtd / MTD_COMPLY | **REQUIRES APPROVAL** |
| Simbian Comply | `inclusion` | Quarterly MTD updates prepared and submitted | public API mtd / MTD_COMPLY | **REQUIRES APPROVAL** |
| Simbian Comply | `inclusion` | Year-end Income Tax return prepared and submitted | public API mtd / MTD_COMPLY | **REQUIRES APPROVAL** |
| Simbian Comply | `inclusion` | Automated tax deadline reminders | public API mtd / MTD_COMPLY | **REQUIRES APPROVAL** |
| Simbian Comply | `inclusion` | Secure digital document exchange | public API mtd / MTD_COMPLY | **REQUIRES APPROVAL** |
| Simbian Comply | `inclusion` | Accountant support by email only | public API mtd / MTD_COMPLY | **REQUIRES APPROVAL** |
| Simbian Comply | `exclusions` | (none published) | not found in public API / portal seed | **UNKNOWN** |
| Simbian Growth | `name` | Simbian Growth | TaxSimba official confirmation (2026-11-13) + public API | **VERIFIED** |
| Simbian Growth | `internal_code` | MTD_GROWTH | portal/Stripe compatibility identity (unchanged amounts) | **VERIFIED** |
| Simbian Growth | `price_gbp` | £59.99 per month; VAT included | TaxSimba confirmation + public API + portal | **VERIFIED** |
| Simbian Growth | `description` | A dedicated accountant maintains your records, handles your filings and reviews your business each quarter. | public API mtd / MTD_GROWTH | **REQUIRES APPROVAL** |
| Simbian Growth | `inclusion` | Xero Ignite subscription included | public API mtd / MTD_GROWTH | **REQUIRES APPROVAL** |
| Simbian Growth | `inclusion` | MTD registration and setup support | public API mtd / MTD_GROWTH | **REQUIRES APPROVAL** |
| Simbian Growth | `inclusion` | Accountant-maintained bookkeeping and digital records | public API mtd / MTD_GROWTH | **REQUIRES APPROVAL** |
| Simbian Growth | `inclusion` | Quarterly MTD updates prepared and submitted | public API mtd / MTD_GROWTH | **REQUIRES APPROVAL** |
| Simbian Growth | `inclusion` | Year-end Income Tax return prepared and submitted | public API mtd / MTD_GROWTH | **REQUIRES APPROVAL** |
| Simbian Growth | `inclusion` | Dedicated accountant support by email only | public API mtd / MTD_GROWTH | **REQUIRES APPROVAL** |
| Simbian Growth | `inclusion` | Quarterly business reviews | public API mtd / MTD_GROWTH | **REQUIRES APPROVAL** |
| Simbian Growth | `inclusion` | Expenses and allowances check | public API mtd / MTD_GROWTH | **REQUIRES APPROVAL** |
| Simbian Growth | `inclusion` | Secure document exchange and deadline reminders | public API mtd / MTD_GROWTH | **REQUIRES APPROVAL** |
| Simbian Growth | `exclusions` | (none published) | not found in public API / portal seed | **UNKNOWN** |
| Simbian Elite | `name` | Simbian Elite | TaxSimba official confirmation (2026-11-13) + public API | **VERIFIED** |
| Simbian Elite | `internal_code` | MTD_COMPLETE | portal/Stripe compatibility identity (unchanged amounts) | **VERIFIED** |
| Simbian Elite | `price_gbp` | £89.99 per month; VAT included | TaxSimba confirmation + public API + portal | **VERIFIED** |
| Simbian Elite | `description` | Dedicated accountant care with maintained records, complete agreed filings and proactive tax planning. | public API mtd / MTD_ELITE | **REQUIRES APPROVAL** |
| Simbian Elite | `inclusion` | Xero Grow subscription included | public API mtd / MTD_ELITE | **REQUIRES APPROVAL** |
| Simbian Elite | `inclusion` | MTD registration and setup support | public API mtd / MTD_ELITE | **REQUIRES APPROVAL** |
| Simbian Elite | `inclusion` | Accountant-maintained bookkeeping and digital records | public API mtd / MTD_ELITE | **REQUIRES APPROVAL** |
| Simbian Elite | `inclusion` | Quarterly MTD updates prepared and submitted | public API mtd / MTD_ELITE | **REQUIRES APPROVAL** |
| Simbian Elite | `inclusion` | Year-end Income Tax return prepared and submitted | public API mtd / MTD_ELITE | **REQUIRES APPROVAL** |
| Simbian Elite | `inclusion` | Dedicated accountant with priority email support | public API mtd / MTD_ELITE | **REQUIRES APPROVAL** |
| Simbian Elite | `inclusion` | Quarterly business reviews | public API mtd / MTD_ELITE | **REQUIRES APPROVAL** |
| Simbian Elite | `inclusion` | Expenses and allowances check | public API mtd / MTD_ELITE | **REQUIRES APPROVAL** |
| Simbian Elite | `inclusion` | Full review of your tax position | public API mtd / MTD_ELITE | **REQUIRES APPROVAL** |
| Simbian Elite | `inclusion` | Proactive tax planning advice | public API mtd / MTD_ELITE | **REQUIRES APPROVAL** |
| Simbian Elite | `inclusion` | Secure document exchange and deadline reminders | public API mtd / MTD_ELITE | **REQUIRES APPROVAL** |
| Simbian Elite | `exclusions` | (none published) | not found in public API / portal seed | **UNKNOWN** |
| Private accountant consultation | `name` | Private accountant consultation | SIMBA catalogue | **VERIFIED** |
| Private accountant consultation | `price_gbp` | £99 / 30 minutes / Google Meet | SIMBA catalogue | **VERIFIED** |
| Private accountant consultation | `booking` | status=stub | SIMBA catalogue | **VERIFIED** |
| Private accountant consultation | `inclusions` | (not specified) | not found | **UNKNOWN** |
| Private accountant consultation | `exclusions` | (not specified) | not found | **UNKNOWN** |

## Counts

- VERIFIED rows: 21
- REQUIRES APPROVAL rows: 46
- UNKNOWN rows: 8

## Unresolved owners

| Item | Owner |
|---|---|
| Approve/reject every REQUIRES APPROVAL description & inclusion row | TaxSimba / accountant |
| Supply explicit exclusions (currently UNKNOWN) | TaxSimba / accountant |
| Confirm £99 consultation inclusions | TaxSimba / accountant |
| Staging Stripe Checkout amount_total for 11900/14900/29900 and 2999/5999/8999 | Toxel |
| Calendly / register / dashboard E2E | Toxel |

## SIMBA customer-facing policy

- May state VERIFIED names and prices confidently.
- Must not promise REQUIRES APPROVAL / UNKNOWN features.
- Recommend lowest suitable package from verified price tiers + circumstances; explain uncertainty.