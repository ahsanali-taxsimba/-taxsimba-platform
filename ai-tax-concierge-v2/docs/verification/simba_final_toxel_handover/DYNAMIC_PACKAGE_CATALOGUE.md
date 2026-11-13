# Dynamic Package Catalogue

## Authority

Owner-approved TaxSimba catalogue is authoritative for SIMBA. Live public compat API (2026-11-13 recheck):

- SA: Simple £119 / Smart £149 / Elite £299 (API names Tax Simba Simple/Smart/Elite)
- MTD: Simbian Comply £29.99 / Growth £59.99 / Elite £89.99 VAT inclusive monthly
- Consultation: £99 / 30 minutes (SIMBA catalogue)

Internal SKUs preserved: `SA_*`, `MTD_STARTER|GROWTH|COMPLETE`, `ACCOUNTANT_CONSULT_99`.

## Sync behaviour

- Local file: `data/catalog/packages.json`
- Optional remote: `CATALOGUE_SOURCE_URL`
- Staging override file: `data/catalog/remote/staging_override.json` (never production)
- Cache invalidation via `packagesCatalog.clearCache`
- Failure: do not guess prices; `getCheckoutAuthorisedAmount` returns `authorised:false`

## Staging price proof

`evidence/dynamic_catalogue_staging_price_proof.json` — Growth £59.99 → £64.99 → restore without redeploy; production override refused.
