# Prior locked blind 500 — 128 failures: root-cause classes

Source: `general_intelligence_blind600/FAIL128_ANALYSIS.json` + retests in this folder.

## Before (locked blind)

| Metric | Value |
|--------|------:|
| Exact | 298 |
| Acceptable | 74 |
| Fail | 128 |
| Pass (exact+acceptable) | 74.4% |
| Premature packages | 28 |
| Missed clarifications | 92 |
| Tax-error tags | 1 |
| Multi-turn memory defects | 0 |

## Root-cause tally (general classes, not test IDs)

| Class | Count (primary) | Meaning |
|-------|----------------:|---------|
| answered_general_instead_of_clarify | 64 | Gave educational copy when one fact was needed |
| premature_sa_without_facts | 27 | Asserted / routed SA before amount/year/type enough |
| missed_sa_when_facts_enough | 21 | Had enough facts but answered general / empty |
| missed_mtd_when_facts_enough | 14 | Had QI/year enough but missed MTD guidance |
| trading_allowance_sa_confusion | 43 (overlap) | Framed SA gate as “trading allowance threshold” |
| disposal_gain_ambiguity | 2 | Crypto/CGT without disposal facts |
| income_type_missing | 1 | Bare amount without PAYE vs trading vs rent |
| other | 2 | Edge scoring / service wording |

Transition view: `MORE_INFO_NEEDED→GENERAL_INFO` 64; `MORE_INFO_NEEDED→SA_ASSIST` 27; `SA_ASSIST→GENERAL_INFO` 21; `MTD_ASSIST→GENERAL_INFO` 14.

## Retest of the same 128 (not generalisation proof)

| Pass | Improved | Still fail | Tax errors | Premature packages | Missing clarifications |
|------|----------:|-----------:|-----------:|-------------------:|-----------------------:|
| Pass1 (after first decision-policy) | 86 | 42 | 0 | 0 | 41 |
| Pass2 (after landlord-year + amount parse) | 114 | 14 | 0 | 0 | 13 |

Pass2 residual (14): mostly tentative photography “just started… maybe £…” without casual-vs-trading clarify; one amount-correction dump; PAYE-only / Xero-Simbian wording edges. Further general classes (`casual_vs_trading_ambiguity`, `amount_correction_ambiguity`) added after Pass2 — see final retest if present.

## Tax-error (1)

See `TAX_ERROR_G066_INVESTIGATION.md` — SOURCE-VERIFIED GOV.UK distinction between sole-trader “more than £1,000” SA test and trading allowance relief.
