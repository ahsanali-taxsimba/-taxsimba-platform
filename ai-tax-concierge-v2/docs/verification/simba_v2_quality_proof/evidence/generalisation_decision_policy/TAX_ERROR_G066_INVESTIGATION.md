# Tax-error investigation — G066 (prior blind)

**Status:** SOURCE-VERIFIED underlying rules; engine defect fixed generally.

## Customer question
`just started doing some photography on the side maybe £955 — hmrc?`

## Prior SIMBA answer (incorrect framing)
Stated the £955 figure “falls below the £1,000 trading allowance threshold” as the reason they may not need Self Assessment / to tell HMRC.

## Why that is wrong
GOV.UK distinguishes two related but different concepts:

1. **Who must send a Self Assessment return (sole trader):**  
   https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return  
   Rule: self-employed as a sole trader and earned **more than £1,000** (before reliefs).

2. **Trading allowance (tax relief):**  
   https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income  
   Rule: up to £1,000 allowance; if annual gross trading income is **£1,000 or less** you may not need to tell HMRC about that trading income (with exceptions). If income is more than £1,000 you can use the allowance as partial relief instead of expenses.

Calling the SA registration test “the trading allowance threshold” is a **category error** that can mislead customers at/near £1,000 and for amounts above £1,000.

## Correct behaviour for this class
- If amount is near/under £1,000 and activity may be casual: **clarify casual vs regular trading** before asserting.
- Use “more than £1,000” language for the SA sole-trader test.
- Explain trading allowance separately as relief, not as the SA gate.

## General fix (not test-ID)
- `decision_policy.ts`: near-threshold side/gig clarify class `casual_vs_trading_ambiguity`
- `prompts.ts`: explicit instruction never to use “below the £1,000 trading allowance threshold” for SA registration
- `intent_clarifier.ts`: educational trading-allowance answer that separates the two rules
- `sa_eligibility.ts`: customer replies already distinguish the tests

## Retest
On retest of G066 after fix: policy returns CLARIFY (casual vs trading); factual_tax_error tag **0** on retest-128 set.
