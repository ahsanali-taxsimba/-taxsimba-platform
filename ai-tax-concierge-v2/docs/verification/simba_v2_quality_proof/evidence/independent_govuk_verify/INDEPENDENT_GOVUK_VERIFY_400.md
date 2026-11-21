# Independent GOV.UK verification — T001–T400

**Method:** VERIFIED only when official GOV.UK/HMRC guidance establishes the claim. Professional approval: NOT OBTAINED.

## Counts

| Status | Count |
|---|---:|
| VERIFIED | 9 |
| INCORRECT | 5 |
| INCOMPLETE | 3 |
| AMBIGUOUS_NEEDS_CLARIFICATION | 26 |
| REQUIRES_PROFESSIONAL_ADVICE | 1 |
| NO_AUTHORITATIVE_SOURCE_FOUND | 356 |
| REAL_MODEL_EXECUTED | 400 |
| PROFESSIONAL_APPROVAL_OBTAINED | 0 |
| TAX_CATEGORY_ROWS | 200 |
| NON_TAX_CATEGORY_ROWS | 200 |

## INCORRECT (5)
### T006
- **Q:** I receive dividends from shares. When might Self Assessment be required?
- **Why:** Stated dividend allowance £2,000 contradicts current GOV.UK (£500).
- **Sources:** https://www.gov.uk/tax-on-dividends

### T046
- **Q:** I have £15,000 rent and £18,000 self-employment turnover in 2025/26. Are they combined?
- **Why:** Incorrectly says rent and self-employment are separate for MTD QI; GOV.UK combines them.
- **Sources:** https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax

### T048
- **Q:** I made £70,000 profit but £90,000 turnover in 2024/25. Which number matters?
- **Why:** MTD profit-vs-turnover question answered as VAT registration — wrong regime.
- **Sources:** https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax

### T050
- **Q:** I earned £55,000 in 2025/26 but only £20,000 in 2024/25. Which start date should be assessed?
- **Why:** Wrong basis year: 2025-26 QI maps to the £30k / April 2027 band, not April 2026.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax

### T066
- **Q:** Can my accountant submit my MTD updates for me?
- **Why:** Contradicts GOV.UK agent permissions — authorised agents can submit quarterly updates.
- **Sources:** https://www.gov.uk/guidance/choose-agents-for-making-tax-digital-for-income-tax

## INCOMPLETE (3)
- **T038**: Did not answer the educational tax question; dumped commercial catalogue instead.
- **T063**: Did not answer the educational tax question; dumped commercial catalogue instead.
- **T089**: Did not answer the educational tax question; dumped commercial catalogue instead.

## VERIFIED sample
- **T008**: 5 October registration/notify timing consistent with GOV.UK.
- **T011**: Correctly avoids automatic SA from PAYE-only / multi-job PAYE facts stated.
- **T014**: Correctly avoids automatic SA from PAYE-only / multi-job PAYE facts stated.
- **T023**: 5 October registration/notify timing consistent with GOV.UK.
- **T037**: 5 October registration/notify timing consistent with GOV.UK.
- **T044**: Correct exclusive-boundary treatment of exact MTD threshold amount.
- **T051**: Correct that QI is before expenses such as mortgage interest.
- **T056**: Correct that VAT registration alone does not force MTD for Income Tax.
- **T062**: Correct that quarterly updates do not replace the year-end return.

## Remaining without unique source establishment
NO_AUTHORITATIVE_SOURCE_FOUND: 356 (includes commercial/CX rows and tax rows without unique match)
AMBIGUOUS_NEEDS_CLARIFICATION: 26

Full JSON: `INDEPENDENT_GOVUK_VERIFY_400.json`