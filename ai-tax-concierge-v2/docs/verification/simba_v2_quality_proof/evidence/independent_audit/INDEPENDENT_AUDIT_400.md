# Independent tax-information audit — T001–T400

**Method:** Official HMRC/GOV.UK rules + deterministic checks on frozen live OpenAI transcripts.
**Not:** Asim sign-off · AI-as-sole-proof · invented citations.
**Professional approval:** NOT OBTAINED for all rows.

## Summary counts

| Status | Count |
|---|---:|
| VERIFIED | 5 |
| INCORRECT | 2 |
| INCOMPLETE | 4 |
| AMBIGUOUS | 379 |
| REQUIRES_PROFESSIONAL_ADVICE | 10 |
| BLOCKED | 0 |
| REAL_MODEL_EXECUTED | 400 |
| PROFESSIONAL_APPROVAL_OBTAINED | 0 |

> Generating 400 model answers does **not** mean 400 independently verified answers.

## INCORRECT

### T303

- **Error:** False SA requirement for PAYE-only
- **Q:** Turn 1: I have only PAYE salary. Turn 2: Do I need Self Assessment? Do not ask me whether I am self-employed.
- **SIMBA:** Whether you need Self Assessment usually depends on your circumstances. If you were self-employed as a sole trader and earned more than £1,000 before reliefs in a tax year, you normally must register and send a tax return. The £1,000 trading allowance is a relief you may claim — it is not a free pass to ignore Self Assessment when your trading income is already above £1,000.

Roughly how much did you earn from self-employment / freelancing before expenses, and for which tax year?

Official guida
- **Expected:** PAYE-only with no other income usually does not require Self Assessment; other GOV.UK triggers can still apply.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return

### T329

- **Error:** T329-class threshold/trading-allowance error
- **Q:** I have a £50,000 PAYE salary and £1,000 freelance turnover. Do not add them for MTD.
- **SIMBA:** Since your PAYE salary is not included in the qualifying income for Making Tax Digital (MTD), only your freelance turnover of £1,000 is relevant. However, as your freelance income is below the £1,000 trading allowance, you do not need to register for Self Assessment or MTD. 

If you have any further questions about your tax situation or need assistance with something else, feel free to ask!
- **Expected:** Do not add PAYE to MTD qualifying income. £1,000 freelance alone is not more than MTD bands. Do not say freelance is “below the £1,000 trading allowance” (exact £1,000 is the boundary for SA “more than £1,000”).
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax, https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax, https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return, https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income

## INCOMPLETE

- **T001**: Unnecessary clarification — question already stated PAYE-only with no other income.
- **T057**: Should apply exclusive MTD threshold rule (or ask only whether figure is qualifying income) — not a generic income-type probe that blocks the answer.
- **T121**: Unnecessary clarification — question already stated PAYE-only with no other income.
- **T352**: PAYE-only pattern; reply neither clearly excludes nor incorrectly forces SA.

## VERIFIED (machine / source-backed)

- **T010**: Recognises £1,200 exceeds £1,000; trading-allowance explanation acceptable if not denying SA trigger.
- **T114**: Correctly places £950 at/under the £1,000 trading-income band.
- **T182**: Correctly rejects ‘high expenses ⇒ no SA’.
- **T305**: Zero packages on information-only path.
- **T320**: Zero packages on information-only path.

## Full register

See `INDEPENDENT_AUDIT_400.csv` and `.json` for every question, unedited answer, expected conclusion, sources, and columned statuses.
