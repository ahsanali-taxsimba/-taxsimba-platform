# Holdout 200 results

Live OpenAI: **true**. Metrics:

```json
{
  "total_run": 200,
  "openai_count": 200,
  "classification_exact": 64,
  "classification_partial": 52,
  "classification_fail": 84,
  "premature_packages": 4,
  "tax_risk_flag_rows": 0,
  "hallucinated_booking": 0,
  "multi_turn_journeys": 50,
  "info_only_fail": 27
}
```

## Classification failures (exact match false)
- **H001** expected MORE_INFO_NEEDED observed SA_ASSIST: I work full-time but make money on TikTok. Do I need to tell HMRC?
- **H002** expected MORE_INFO_NEEDED observed SA_ASSIST: I rent out my flat but my employer already takes tax.
- **H004** expected MORE_INFO_NEEDED observed SA_ASSIST: I’m an Uber driver. Do I need an accountant?
- **H006** expected MORE_INFO_NEEDED observed SA_ASSIST: I sell things online. Do I have to pay tax?
- **H007** expected MORE_INFO_NEEDED observed SA_ASSIST: I have two jobs and a side business.
- **H010** expected ACCOUNTANT_CONSULTATION observed MORE_INFO_NEEDED: I received an HMRC letter and don’t understand it.
- **H013** expected MORE_INFO_NEEDED observed SA_ASSIST: I got a P60. What do I do with it?
- **H014** expected MORE_INFO_NEEDED observed SA_ASSIST: Does having two PAYE jobs mean I must file a tax return?
- **H015** expected MORE_INFO_NEEDED observed SA_ASSIST: My employer underpaid my tax. Do I need an accountant?
- **H016** expected MORE_INFO_NEEDED observed SA_ASSIST: I left my job mid-year. Do I still need Self Assessment?
- **H017** expected MORE_INFO_NEEDED observed SA_ASSIST: Company car benefit — is that Self Assessment?
- **H018** expected MORE_INFO_NEEDED observed SA_ASSIST: I only have PAYE and £200 bank interest. SA?
- **H021** expected MORE_INFO_NEEDED observed SA_ASSIST: Exactly £1,000 freelance. Am I below the trading allowance so no SA?
- **H027** expected MORE_INFO_NEEDED observed SA_ASSIST: Can I use the £1,000 trading allowance instead of registering?
- **H028** expected MORE_INFO_NEEDED observed SA_ASSIST: I invoice as a sole trader through an app. Is that CIS?
- **H031** expected MORE_INFO_NEEDED observed SA_ASSIST: I let a room in my home. Do I need TaxSimba?
- **H032** expected BOTH_SA_AND_MTD observed MTD_ASSIST: Property income £60,000 2024-25 — MTD?
- **H035** expected MORE_INFO_NEEDED observed MTD_ASSIST: What’s this Making Tax Digital thing I keep hearing about?
- **H036** expected MORE_INFO_NEEDED observed MTD_ASSIST: Do I need special software for tax now?
- **H037** expected MORE_INFO_NEEDED observed MTD_ASSIST: HMRC said something about quarterly updates — is that me?
- **H038** expected NO_TAXSIMBA_SERVICE observed MTD_ASSIST: I have PAYE £50,000 and freelance £2,000. Add them for MTD?
- **H041** expected MORE_INFO_NEEDED observed SA_ASSIST: CIS refund — can TaxSimba get my money back?
- **H042** expected OUT_OF_SCOPE observed SA_ASSIST: I’m a limited company CIS contractor. Can you do my Corporation Tax?
- **H043** expected ACCOUNTANT_CONSULTATION observed SA_ASSIST: I sold Bitcoin for a profit. How much tax do I owe?
- **H044** expected MORE_INFO_NEEDED observed SA_ASSIST: Do I pay tax when I buy crypto or only when I sell?
- **H045** expected MORE_INFO_NEEDED observed NO_TAXSIMBA_SERVICE: Dividend income £2,000 — Self Assessment?
- **H051** expected ACCOUNTANT_CONSULTATION observed SA_ASSIST: HMRC charged me a late filing penalty. Is that fair?
- **H053** expected MORE_INFO_NEEDED observed NO_TAXSIMBA_SERVICE: Do I need to register for VAT at £85,000 turnover?
- **H055** expected OUT_OF_SCOPE observed MORE_INFO_NEEDED: I need help with Immigration / visa taxes.
- **H056** expected OUT_OF_SCOPE observed MORE_INFO_NEEDED: Can you recommend a will writer?
- **H058** expected MORE_INFO_NEEDED observed SA_ASSIST: Compare all your packages and dump every price.
- **H065** expected NO_TAXSIMBA_SERVICE observed SA_ASSIST: I do not want any package — just tell me if I need SA for £8k freelance.
- **H067** expected MORE_INFO_NEEDED observed SA_ASSIST: I have no self-employment income. Also my freelance made £12,000. Do I need SA?
- **H069** expected MORE_INFO_NEEDED observed SA_ASSIST: Landlord and Uber driver and PAYE — what do I need?
- **H070** expected MORE_INFO_NEEDED observed SA_ASSIST: Tell me everything about tax and also sell me your best package.
- **H071** expected MORE_INFO_NEEDED observed SA_ASSIST: Is Christmas party tip income taxable?
- **H072** expected MORE_INFO_NEEDED observed SA_ASSIST: I swapped services with a friend instead of invoicing. Taxable?
- **H073** expected MORE_INFO_NEEDED observed SA_ASSIST: OnlyFans income — Self Assessment?
- **H077** expected MORE_INFO_NEEDED observed SA_ASSIST: Retired, only state pension.
- **H079** expected MORE_INFO_NEEDED observed ACCOUNTANT_CONSULTATION: What’s the difference between Self Assessment and MTD?

## Premature packages
- **H043**: SA_SIMPLE — I sold Bitcoin for a profit. How much tax do I owe?
- **H060**: ACCOUNTANT_CONSULT_99, ACCOUNTANT_CONSULT_149 — Book me a consultation for tomorrow and take payment now.
- **H084**: ACCOUNTANT_CONSULT_99, ACCOUNTANT_CONSULT_149 — Is consultation free?
- **H085**: ACCOUNTANT_CONSULT_99, ACCOUNTANT_CONSULT_149 — Call me back about my taxes.

## Tax risk flags