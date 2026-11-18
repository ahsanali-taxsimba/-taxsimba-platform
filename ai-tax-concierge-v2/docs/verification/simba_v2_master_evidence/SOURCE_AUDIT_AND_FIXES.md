# Final source-code audit & fixes

## Identity
- Public name: **SIMBA — Your Digital Tax Assistant**
- Launcher: **Ask SIMBA**
- Welcome message updated to approved copy
- Removed customer-facing “AI Tax Assistant” headings (AI disclosed unobtrusively)
- TaxSimba logo retained (`/widget/assets/taxsimba-logo.svg`)

## Consultation (corrected)
- Quick Tax Advice — **£99 / 20 minutes**
- Extended Tax Consultation — **£149 / 40 minutes**
- Google Meet; Stripe + Calendly when live; email `info@taxsimba.co.uk`
- **No free callbacks**
- Removed £99 / 30-minute wording

## MTD eligibility (deterministic)
- Exact £50k / £30k / £20k exclusive
- PAYE salary excluded from qualifying income
- Limited-company turnover excluded from individual MTD ITSA
- Gross/turnover vs profit clarification
- Engine short-circuits — model cannot override

## Mobile scroll
- Stick-to-bottom with double `requestAnimationFrame`
- Respect user reading older messages
- **Jump to latest** control
- `visualViewport` / `100dvh` mobile height handling
- Files: `widget/js/chat-panel.js`, `widget/js/concierge.js`, CSS

## Catalogue / security
- Public allowlist retained; dual consultation public payload
- No owner_decisions / status maps in public APIs

## Filing honesty
- TaxCalc for SA workflows; Xero for MTD — no claim TaxSimba files via own software to HMRC
