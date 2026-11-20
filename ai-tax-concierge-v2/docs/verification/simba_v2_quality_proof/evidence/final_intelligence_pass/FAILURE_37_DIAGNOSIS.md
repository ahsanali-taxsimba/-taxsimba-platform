# Remaining 37 validation failures — root-cause diagnosis

Source: `VALIDATION_200_RESULTS_v2.json` (157 exact / 6 partial / 37 fail).
Retest after this pass: **37/37 exact** (`RETEST_37_RESULTS.json`).

## Grouped root causes

| Root cause | Count | Pattern | Generalisable correction |
|---|---:|---|---|
| missing_clarification | 31 | `Cash-in-hand weekend work, maybe £X. Accountant?` | Uncertain amount + accountant ask must clarify turnover/year before SA/service |
| intent_detection | 2 | `I earn £30k/£50k. MTD?` | Bare “I earn £X” ≠ MTD qualifying income |
| missing_clarification | 2 | `Rental about £20k/£50k — digital tax?` | Require tax year before exclusive-band answer |
| intent_detection | 1 | `Crypto: tax on buy or sell?` | Clarify disposal vs buy / trading vs investment |
| missing_clarification | 1 | `Dividends £1,500 — return?` | Ask other income + tax year |
| missing_clarification | 1 | `Partner 50/50 let — who files?` | Clarify joint ownership vs partnership |
| service_identification | 1 | `Sold personal bike…` | Clarify one-off personal vs trade before NO_TAXSIMBA |
| tax_knowledge | 1 | `VAT at £85k — register?` | Confirm rolling 12-month basis / live threshold |

*(Some rows share a cause class; table summarises failure classes rather than double-counting every template.)*

## Example failure cards (pre-fix)

### V064 — cash-in-hand / accountant
- **Customer:** Cash-in-hand weekend work, maybe £1050. Accountant?
- **History:** none
- **SIMBA (pre-fix):** Treated as definitive SA need
- **Expected:** MORE_INFO_NEEDED
- **Why:** Uncertain “maybe” figure + premature accountant framing
- **Cause:** missing_clarification
- **Fix:** Informal gig clarifier when maybe/accountant present

### V153 — bare earn MTD
- **Customer:** I earn £50k. MTD?
- **SIMBA (pre-fix):** Exact £50k exclusive-band refusal (invented QI + year)
- **Expected:** MORE_INFO_NEEDED
- **Cause:** intent_detection
- **Fix:** `hasSelfEmploymentOrProperty === null` for bare earn; clarifier asks income type

### V047 — rent without year
- **Customer:** Rental about £20000 — do I need the digital tax thing?
- **SIMBA (pre-fix):** Exact £20k for 2026-27 answer without year confirmation
- **Expected:** MORE_INFO_NEEDED
- **Cause:** missing_clarification
- **Fix:** Year required before exact-band MTD answers; rent clarifier asks year

## After fix
All 37 retested live via `/api/v1/chat` → **exact match**.
