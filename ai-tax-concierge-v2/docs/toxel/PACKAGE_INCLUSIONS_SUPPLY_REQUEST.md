# Package inclusions — TaxSimba / Toxel supply request

**Status:** **PARTIAL** — public subscription-plans API recovered (2026-11-13). Feature text is loaded as **PENDING APPROVAL**, not signed off.  
**Rule:** SIMBA must **not invent** beyond the recovered catalogue and must **not change** verified prices.  
**Runtime flag:** `detailed_recommendations_status: partial_recovered_public_api_pending_signoff`  
**Versioned catalogue:** `backend-node/data/catalog/packages_inclusions_catalogue.v2026-11-13.json`  
**Report:** `docs/verification/inclusions_resolution/INCLUSIONS_RESOLUTION_REPORT.md`

---

## Recovered sources

| Source | URL / path |
|--------|------------|
| Public SA plans | https://taxsimba.co.uk/api/compat/subscription-plans?category=taxSimba |
| Public MTD plans | https://taxsimba.co.uk/api/compat/subscription-plans?category=mtd |
| Evidence JSON | `docs/verification/inclusions_resolution/public_api_*.json` |

---

## What still needs TaxSimba sign-off

Tick and sign to promote each row from `pending_taxsimba_signoff` → `approved_by_taxsimba`.

### Self Assessment (prices VERIFIED)

| Code | Name | Price | Approve description? | Approve inclusions? | Approve exclusions? | Approved by | Date |
|------|------|------:|----------------------|---------------------|---------------------|-------------|------|
| SA_SIMPLE | Self Assessment Simple | £119 | ☐ | ☐ | ☐ (missing) | | |
| SA_SMART | Self Assessment Smart | £149 | ☐ | ☐ | ☐ (missing) | | |
| SA_ELITE | Self Assessment Elite | £299 | ☐ | ☐ | ☐ (missing) | | |

### Making Tax Digital (prices VERIFIED; **names conflict**)

| Code (SIMBA) | SIMBA name | Public API | Price | Approve **name**? | Approve description/inclusions? | Approved by | Date |
|--------------|------------|------------|------:|-------------------|----------------------------------|-------------|------|
| MTD_STARTER | MTD Starter | Simbian Comply / MTD_COMPLY | £29.99 | ☐ | ☐ | | |
| MTD_GROWTH | MTD Growth | Simbian Growth / MTD_GROWTH | £59.99 | ☐ | ☐ | | |
| MTD_COMPLETE | MTD Complete | Simbian Elite / MTD_ELITE | £89.99 | ☐ | ☐ | | |

### Consultation

| Code | Price | Approve inclusions? | Calendly URL | Approved by | Date |
|------|------:|---------------------|--------------|-------------|------|
| ACCOUNTANT_CONSULT_99 | £99 / 30 min | ☐ | _TBD_ | | |

### Also confirm

1. Soft registration / checkout paths (`routes.json`) → mark `live_verified` after staging check.  
2. Sign-off that pending public-API text may be spoken by SIMBA **without** the pending disclaimer.  
3. Staging Stripe Checkout `amount_total` for Elite **29900** and MTD **2999/5999/8999**.

---

## How SIMBA consumes data today

- **VERIFIED** prices/names spoken confidently.  
- Recovered inclusions spoken **only** with PENDING APPROVAL labelling.  
- Lowest suitable package recommended from circumstance heuristics.  
- After sign-off: set `inclusions_status` / `description_status` to `approved_by_taxsimba`, resolve MTD name conflicts, flip `detailed_recommendations_status` to `approved_by_taxsimba`.
