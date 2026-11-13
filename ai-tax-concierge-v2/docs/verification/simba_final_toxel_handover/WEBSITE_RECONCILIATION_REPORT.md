# Website Reconciliation Report (live recheck 2026-11-13 Europe/London)

## Method

Compared rendered pages + `https://taxsimba.co.uk/api/compat/subscription-plans` against SIMBA catalogue. Evidence: `evidence/compat_sa.json`, `evidence/compat_mtd.json`.

## Confirmed OK

| Check | Actual | Expected |
|-------|--------|----------|
| SA API prices | 119 / 149 / 299 | 119 / 149 / 299 |
| MTD API prices | 29.99 / 59.99 / 89.99 | 29.99 / 59.99 / 89.99 |
| MTD API names | Simbian Comply/Growth/Elite | Simbian names |
| MTD VAT | INCLUSIVE | VAT included |
| MTD billing | Monthly | per month |

## Issues for Toxel

| Issue | Actual | Expected | Severity | Owner |
|-------|--------|----------|----------|-------|
| `/making-tax-digital` `<title>` | “Tax Return Information \| TaxSimba” | MTD / Simbian pricing page title | Medium | Toxel |
| Marketing HTML lacks package £ cards | No £119/£29.99 in static HTML | Clear package pricing on pages OR rely on API widgets | Medium | Toxel |
| Homepage legacy comparison £169 | Comparison table shows £169 | Align or label as competitor/legacy | Medium | Toxel |
| MTD API still lists QBR/priority/planning features | Present in API features | Remove or mark non-contractual | High (commercial) | Toxel + owner |
| Growth description “reviews your business each quarter” | Present in API description | Remove QBR language | High | Toxel + owner |
| Previously reported £1 Simple | Not reproduced as standalone £1 Simple price in this recheck (homepage hits were £100/£169 contexts) | N/A this pass | Info | Monitor |

## Responsible components

- Public compat API / CMS catalogue — Toxel
- SIMBA Node catalogue — Cursor (aligned to approved prices/names; does not auto-approve removed claims)
