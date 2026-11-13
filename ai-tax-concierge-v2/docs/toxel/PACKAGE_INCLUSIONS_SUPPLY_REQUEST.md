# Package inclusions — TaxSimba / Toxel supply request

**Status:** **BLOCKED** — no authoritative per-package inclusion list found in this repository or crawlable public pages.  
**Rule:** SIMBA AI Tax Assistant must **not invent** inclusions and must **not change** approved prices.  
**Until this form is completed and signed off**, detailed “what’s included / which tier fits by features” answers remain **blocked**; SIMBA may only quote **catalogue prices + billing** and circumstance-based **price-tier suggestions**.

---

## Search performed (2026-11-13)

| Source | Result |
|--------|--------|
| `ai-tax-concierge-v2/backend-node/data/catalog/packages.json` | Prices only; `inclusions: null` |
| `ai-tax-concierge-v2/backend/app/catalog/packages.json` | Same — no inclusions |
| Portal seed `backend/phase1b.py` `DEFAULT_PACKAGES` | SA Simple/Smart/Elite names+prices only (**Elite £249** in portal seed ≠ SIMBA **£299**); MTD **Essential/Plus** quarterly — **different SKUs** from SIMBA MTD Starter/Growth/Complete |
| Live taxsimba.co.uk (`/`, `/pricing`, `/self-assessment`, `/mtd`) | Marketing copy; **no per-SKU inclusion bullet lists** extracted for SA £119/£149/£299 or MTD £29.99/£59.99/£89.99 |
| Stripe / Mongo seeds in repo | No approved SIMBA inclusion text |

**Price policy for SIMBA (do not change without product owner sign-off):**  
SA **£119 / £149 / £299** · MTD **£29.99 / £59.99 / £89.99** monthly VAT included · Consultation **£99 / 30 min**.

---

## What Toxel / TaxSimba must supply

Complete one row per SKU. Use exact customer-facing wording (British English). Mark any item “not included” explicitly.

### Self Assessment

| Code | Name | Price | Billing | Approved short description (1–2 sentences) | Approved inclusions (bullet list) | Explicit exclusions | VAT note | Checkout / soft URL | Approved by | Date |
|------|------|------:|---------|--------------------------------------------|-----------------------------------|---------------------|----------|---------------------|-------------|------|
| SA_SIMPLE | Self Assessment Simple | £119 | per tax year | _TBD_ | _TBD_ | _TBD_ | Confirm on checkout | _TBD_ | | |
| SA_SMART | Self Assessment Smart | £149 | per tax year | _TBD_ | _TBD_ | _TBD_ | Confirm on checkout | _TBD_ | | |
| SA_ELITE | Self Assessment Elite | £299 | per tax year | _TBD_ | _TBD_ | _TBD_ | Confirm on checkout | _TBD_ | | |

### Making Tax Digital

| Code | Name | Price | Billing | Approved short description | Approved inclusions | Explicit exclusions | VAT note | Checkout / soft URL | Approved by | Date |
|------|------|------:|---------|----------------------------|---------------------|---------------------|----------|---------------------|-------------|------|
| MTD_STARTER | MTD Starter | £29.99 | per month | _TBD_ | _TBD_ | _TBD_ | VAT included | _TBD_ | | |
| MTD_GROWTH | MTD Growth | £59.99 | per month | _TBD_ | _TBD_ | _TBD_ | VAT included | _TBD_ | | |
| MTD_COMPLETE | MTD Complete | £89.99 | per month | _TBD_ | _TBD_ | _TBD_ | VAT included | _TBD_ | | |

### Consultation

| Code | Name | Price | Duration | Meeting | Approved inclusions | Booking provider URL | Approved by | Date |
|------|------|------:|----------|---------|---------------------|----------------------|-------------|------|
| ACCOUNTANT_CONSULT_99 | Private accountant consultation | £99 | 30 minutes | Google Meet | _TBD_ | Calendly event URL | | |

### Also confirm

1. Mapping (if any) between portal codes `SIMPLE`/`SMART`/`ELITE` / `MTD_ESSENTIAL`/`MTD_PLUS` and SIMBA consumer SKUs above.  
2. Whether portal Elite **£249** is obsolete vs SIMBA **£299**.  
3. Soft registration / checkout paths for each SKU (must be `live_verified` or `stub` in `routes.json`).  
4. Sign-off that this text may be spoken by **SIMBA AI Tax Assistant** verbatim.

---

## How SIMBA will consume the data (after approval)

1. Paste approved lists into `backend-node/data/catalog/packages.json` (`inclusions: string[]`, set `inclusions_status` to `approved_by_taxsimba`).  
2. Mirror the same file into `backend/app/catalog/packages.json` (Python reference) **or** re-vendor.  
3. Re-run `npm test` + inclusions live probes.  
4. Only then flip staging gate **detailed package recommendations** from BLOCKED → PASS.

Until then, `inclusions_status` remains `not_specified_in_catalog` / blocked, and answers to “what’s included?” refuse to invent features.
