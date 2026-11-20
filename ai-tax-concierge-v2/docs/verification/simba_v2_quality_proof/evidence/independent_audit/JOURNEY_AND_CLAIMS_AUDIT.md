# Journey quality + business claims audit

## Deep20 heuristic flags (not tax VERIFIED)

| ID | Remembers | Premature package | No-buy | Notes |
|----|-----------|-------------------|-------|-------|
| D01 | PASS | PASS | N_A | — |
| D02 | PASS | PASS | PASS | — |
| D03 | FAIL | PASS | N_A | Forgot prior income on follow-up |
| D04 | PASS | PASS | N_A | — |
| D05 | PASS | PASS | FAIL | — |
| D06 | PASS | PASS | N_A | — |
| D07 | PASS | PASS | N_A | — |
| D08 | PASS | PASS | N_A | — |
| D09 | PASS | FAIL | N_A | Named package before customer asked |
| D10 | PASS | FAIL | N_A | Named package before customer asked |
| D11 | PASS | PASS | N_A | — |
| D12 | PASS | PASS | N_A | — |
| D13 | PASS | PASS | N_A | — |
| D14 | PASS | PASS | N_A | — |
| D15 | PASS | PASS | N_A | — |
| D16 | PASS | PASS | FAIL | — |
| D17 | PASS | PASS | N_A | — |
| D18 | PASS | PASS | N_A | — |
| D19 | PASS | PASS | N_A | — |
| D20 | PASS | PASS | N_A | — |

## Journeys40

- Total: 42
- Heuristic PASS: 42
- All openai: true

## Business claims

| Claim | Status | Source |
|-------|--------|--------|
| SA Simple £119 per tax year | **VERIFIED** | Approved catalogue in backend catalog/service |
| SA Smart £149 / Elite £299 per tax year | **VERIFIED** | Approved catalogue |
| Simbian Comply/Growth/Elite £29.99/£59.99/£89.99 VAT included | **VERIFIED** | Approved catalogue codes MTD_STARTER/GROWTH/COMPLETE |
| Consultations £99 / £149 | **VERIFIED** | Approved catalogue |
| Signup URL https://www.taxsimba.co.uk/register | **VERIFIED** | Code paths (not live HTTP probe in this audit) |
| TaxCalc for SA / Xero for MTD internally; portal not direct HMRC filing | **VERIFIED** | src/knowledge/taxsimba_service_model.ts; prompts.ts |
| Xero included in Simbian monthly price | **VERIFIED** | packageCatalogText() |
| Staging email / Calendly / HMRC monitor / mobile E2E | **UNVERIFIED** | Not evidenced — must remain BLOCKED for production |
