# Expanded workspace sidebar — evidence

**Date:** 2026-11-13 (Europe/London) · **PR #35**

## Audit result

| Item | Status before | Status now |
|------|---------------|------------|
| Left-hand desktop sidebar (6 options) | **MISSING** | **IMPLEMENTED** |
| Accountant-led info in sidebar | Missing | Implemented |
| Compact mobile navigation | Missing | Mobile pill nav + drawer |
| Floating launcher preserved | Present | Preserved (wider desktop panel) |

## Sidebar destinations

1. Chat with SIMBA  
2. Guided Help  
3. Tax Calculators (17 live_verified links)  
4. Our Packages (SA £119/£149/£299; MTD £29.99/£59.99/£89.99 VAT incl.)  
5. Book a Consultation (£99 · 30 min · Google Meet · booking stub)  
6. FAQs  

## PASS / FAIL / BLOCKED matrix

| Check | Status | Evidence |
|-------|--------|----------|
| Desktop sidebar visible | PASS | `simba-desktop-sidebar-welcome.png` |
| Six nav options work | PASS | Panel screenshots |
| Mobile compact nav + drawer | PASS | `simba-mobile-*.png` |
| Guided journeys SA/MTD/landlord/freelancer/CIS | PASS | API journey start |
| Helpful when declining paid services | PASS | API: packages `[]`, no consult hint |
| Existing client → dashboard messaging guidance | PASS | API reply references accountant/dashboard |
| Package prices accurate | PASS | Catalog tests |
| VAT £90k + rolling 12-month + 30-day forward look | PASS | Corpus + live chat check |
| 17 calculator links | PASS | `live_verified` catalogue |
| Checkout / Stripe E2E | BLOCKED | Stub only |
| Calendly booking E2E | BLOCKED | Stub only |
| Registration / email verify / dashboard auth E2E | BLOCKED | No staging credentials |
| Website staging embed | BLOCKED | Local preview only |

## Automated tests

`pytest -q` → **212 passed / 0 failed**

## Changed files

- `widget/index.html` — workspace shell + sidebar + panels  
- `widget/css/concierge.css` — sidebar / mobile nav styles  
- `widget/js/concierge.js` — panel routing + catalogues  
- `widget/embed.js` — wider desktop iframe for workspace  
- `backend/app/knowledge/corpus/hmrc_foundation.json` — VAT rolling/forward tests  
- `backend/tests/test_workspace_sidebar.py`  
- `backend/tests/test_accessibility_widget.py`  
- Screenshots under `docs/verification/screenshots/`

**Unrelated website pages:** not modified. No duplicate checkout/booking/auth systems.
