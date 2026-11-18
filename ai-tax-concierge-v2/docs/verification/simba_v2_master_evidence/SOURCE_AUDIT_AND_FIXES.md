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
- File: `src/knowledge/mtd_eligibility.ts`

## MTD operations vs eligibility (33-failure theme)
- “Do I need Xero for MTD?” no longer misrouted as eligibility-band maths
- New: `src/knowledge/mtd_operations.ts`
- Eligibility matcher excludes software/Xero/CIS-without-figures prompts

## Intent clarifier / conversation intelligence
- New: `src/knowledge/intent_clarifier.ts`
- Ambiguous income, online selling, crypto, rental, existing accountant, refund guarantees, cheapest package
- Clarifier does **not** override concrete MTD + figures
- Tests: `tests/intent_clarifier.test.ts`
- Evidence: `evidence/ambiguous_intent_live.json`

## PAYE / crypto / rent-a-room / CIS fast paths
- Engine handlers in `conversational_engine.ts` before generic eligibility
- Retrieval scoring updates in `retrieval.ts`, `llm_mock.ts`, `hmrc_extended.json`
- Closed original 33 FAIL scenarios without softening expects

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

## Live evidence tooling
- `scripts/liveOpenAIJourneys20.ts` — 20 real OpenAI multi-turn journeys; whole-transcript scoring
- `scripts/ambiguousIntentEvidence.ts` — ambiguous customer questions
