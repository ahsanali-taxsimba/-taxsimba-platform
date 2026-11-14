# Dynamic Package Catalogue (canonical)

## Authority

Owner-approved TaxSimba catalogue is authoritative for SIMBA. Live public compat API:

- SA: Simple £119 / Smart £149 / Elite £299  
- MTD: Simbian Comply £29.99 / Growth £59.99 / Elite £89.99 VAT inclusive monthly  
- Consultation: £99 / 30 minutes  

Internal SKUs preserved: `SA_*`, `MTD_STARTER|GROWTH|COMPLETE`, `ACCOUNTANT_CONSULT_99`.

Bookkeeping: **NO FIXED MONTHLY TRANSACTION CAPS** (not unlimited out-of-scope). Xero included in Simbian monthly price.

## Sync behaviour (canonical)

| Module | Role |
|--------|------|
| `src/catalog/sync/*` | Pull approved subscription-plans APIs → runtime overlay |
| `data/catalog/packages.json` | Baseline catalogue |
| `data/runtime/catalog/` (or `CONCIERGE_RUNTIME_DIR`) | Live overlay without redeploy |
| Ops | `POST /api/v1/ops/catalog/sync` · rollback |
| Env | `CONCIERGE_CATALOGUE_SYNC_ENABLED=true` |

Preserves stable package IDs / checkout mappings; strips unpublished / removed claims; refuses inventing prices.

## Proof

- Unit: `tests/catalog_sync.test.ts`  
- Live sync + staging Elite price change/revert: `evidence/dynamic_systems_demo_report.json`  
- Historical Growth staging harness evidence (prior #36): `evidence/dynamic_catalogue_staging_price_proof.json`
