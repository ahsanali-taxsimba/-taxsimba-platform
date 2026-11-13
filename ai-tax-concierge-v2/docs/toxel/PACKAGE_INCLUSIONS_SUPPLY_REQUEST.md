# Package inclusions — TaxSimba / Toxel supply request

**Status:** **NAMES & PRICES VERIFIED** · feature inclusions still **REQUIRES APPROVAL**  
**Customer-facing MTD names (confirmed):** Simbian Comply / Simbian Growth / Simbian Elite  
**Internal codes (unchanged):** `MTD_STARTER` / `MTD_GROWTH` / `MTD_COMPLETE`  
**Matrix:** [`../verification/inclusions_resolution/SIX_PACKAGE_APPROVAL_MATRIX.md`](../verification/inclusions_resolution/SIX_PACKAGE_APPROVAL_MATRIX.md)

---

## Verified catalogue (do not change without product owner)

| Family | Customer-facing name | Internal code | Price | Billing |
|--------|----------------------|---------------|------:|---------|
| SA | Self Assessment Simple | SA_SIMPLE / portal SIMPLE | £119 | per tax year |
| SA | Self Assessment Smart | SA_SMART / portal SMART | £149 | per tax year |
| SA | Self Assessment Elite | SA_ELITE / portal ELITE | £299 | per tax year |
| MTD | Simbian Comply | MTD_STARTER | £29.99 | per month, VAT included |
| MTD | Simbian Growth | MTD_GROWTH | £59.99 | per month, VAT included |
| MTD | Simbian Elite | MTD_COMPLETE | £89.99 | per month, VAT included |
| Consult | Private accountant consultation | ACCOUNTANT_CONSULT_99 | £99 | 30 minutes |

---

## Still needs TaxSimba sign-off

For each SKU, approve or rewrite recovered public-API descriptions/features in the matrix. Until signed:

- SIMBA must **not** present them as contractual inclusions  
- SIMBA may recommend lowest suitable package using verified names/prices only  

| Area | Owner | Action |
|------|-------|--------|
| SA/MTD descriptions & feature bullets | TaxSimba / accountant | Approve / edit / reject matrix REQUIRES APPROVAL rows |
| Exclusions | TaxSimba / accountant | Supply explicit exclusions (currently UNKNOWN) |
| £99 consult inclusions | TaxSimba / accountant | Define coverage |
| Stripe Checkout live amounts | Toxel | Verify staging `amount_total` |
| Calendly / register / dashboard | Toxel | Staging E2E |

---

## After approval

1. Set approved rows to `approved_by_taxsimba` in `packages.json`  
2. Optionally enable `customer_facing_inclusions: true` for approved bullets only  
3. Flip `detailed_recommendations_status` to `approved_by_taxsimba`  
4. Re-run `npm test` + live probes  
