# Simbian MTD name alignment — PR #35

**Date:** 2026-11-13 (Europe/London)  
**HOLD:** No merge · no production deploy · no Python deletion · no live payment changes.

## Fixed

| Area | Change |
|------|--------|
| Customer-facing MTD names | **Simbian Comply / Growth / Elite** |
| Prices | Unchanged £29.99 / £59.99 / £89.99 VAT included |
| Internal codes | Preserved `MTD_STARTER` / `MTD_GROWTH` / `MTD_COMPLETE` |
| Portal `DEFAULT_PACKAGES` display names | Updated to Simbian (codes/prices unchanged) |
| SIMBA UI / prompts / recommendations / preview | Removed Starter/Complete customer-facing labels |
| Unapproved features | Kept out of confident promises; cards do not attach inclusion bullets |
| Approval matrix | `SIX_PACKAGE_APPROVAL_MATRIX.md` — 21 VERIFIED · 46 REQUIRES APPROVAL · 8 UNKNOWN |

## Still unapproved

- All recovered feature descriptions/inclusions (REQUIRES APPROVAL)
- Exclusions (UNKNOWN)
- £99 consultation inclusions (UNKNOWN)
- Staging Stripe Checkout live amounts (Toxel)
- Calendly / register / dashboard E2E (Toxel)

## Tests / evidence

- Vitest **458/458**
- Live transcripts: `simbian_alignment_transcripts.json`
- Screenshots: `screenshots/03_desktop_simbian_packages.png`, `04_mobile_simbian_packages.png`
- Security suite: pass

## Staging readiness

**Controlled HTTPS staging preparation: YES**  
**Production-ready: NO**
