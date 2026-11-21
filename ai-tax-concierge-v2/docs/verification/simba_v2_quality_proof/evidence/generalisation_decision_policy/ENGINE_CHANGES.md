# Exact general-engine changes (decision-policy pass)

No architecture rebuild. No test-ID hardcoding. No deploy.

## New module
- `backend-node/src/knowledge/decision_policy.ts`
  - `extractCircumstances` — income types, amount (with mid-message correction), year, no-buy, educational vs personal
  - `classifyAskType` — GENERAL_INFO / SA / MTD / SOFTWARE / SERVICE / CALCULATION / PROFESSIONAL / UNCLEAR
  - `decidePolicy` — UNDERSTAND → EDUCATE | CLARIFY (one high-value question) | ANSWER_OBLIGATION | SERVICE
  - Clarification classes: `income_type_missing`, `amount_missing`, `tax_year_missing`, `gross_profit_ambiguity`, `combined_income_ambiguity`, `employment_status_ambiguity`, `disposal_gain_ambiguity`, `property_share_ambiguity`, `casual_vs_trading_ambiguity`, `amount_correction_ambiguity`, `customer_intent_unclear`
  - Package gate: `allowPackages` only when customer asked for a package and has not declined paid help; educate/clarify never dump packages

## Wired into existing engine
- `conversational_engine.ts` — run `decidePolicy` before SA/MTD/recommend; honour CLARIFY / EDUCATE; suppress packages when `allowPackages` false
- `recommendations.ts` — respect no-buy / explain-only
- `sa_eligibility.ts` — landlord rent without tax year → clarify year; keep trading-allowance wording separate from SA “more than £1,000” test
- `mtd_eligibility.ts` — income-type / year gates (no PAYE→MTD from £55k alone)
- `intent_clarifier.ts` — educational trading-allowance answer separates relief vs SA registration
- `prompts.ts` — forbid “below/exceeds the £1,000 trading allowance threshold” for SA registration framing; hedge “maybe / just started / on the side” → confirm trading before locking SA

## Evaluation harness (evidence only)
- `scripts/retestFail128.ts` — before/after on prior 128 fails
- `scripts/generalisationBlindV2.ts` — lock NEW unseen 500+100+score20 after fixes; resume/checkpoint for multi

## Not done
- No merge/deploy of PR #43 / #45
- No phrase-by-phrase patches for blind IDs
- No scoring manipulation
