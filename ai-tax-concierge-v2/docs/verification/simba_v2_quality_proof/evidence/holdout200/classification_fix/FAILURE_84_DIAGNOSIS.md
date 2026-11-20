# Diagnosis of 84 holdout classification failures

Source: original `HOLDOUT_200_RESULTS.json` (not rewritten).

## Root-cause counts (a failure may have multiple causes)

| Cause | Count |
|-------|------:|
| missing_clarification | 58 |
| classification_matcher_mismatch | 12 |
| missing_escalation | 6 |
| misunderstood_income_type | 3 |
| incorrect_package_selection | 3 |
| other_evidenced | 2 |
| incorrect_mtd_or_sa_obligation | 2 |
| premature_selling | 2 |
| failure_to_respect_user_intent | 1 |

## Expected → observed

| Pair | Count |
|------|------:|
| MORE_INFO_NEEDED→MTD_ASSIST | 40 |
| MORE_INFO_NEEDED→SA_ASSIST | 26 |
| ACCOUNTANT_CONSULTATION→MORE_INFO_NEEDED | 3 |
| ACCOUNTANT_CONSULTATION→SA_ASSIST | 3 |
| MORE_INFO_NEEDED→NO_TAXSIMBA_SERVICE | 3 |
| OUT_OF_SCOPE→MORE_INFO_NEEDED | 2 |
| MORE_INFO_NEEDED→ACCOUNTANT_CONSULTATION | 2 |
| BOTH_SA_AND_MTD→MTD_ASSIST | 1 |
| NO_TAXSIMBA_SERVICE→MTD_ASSIST | 1 |
| OUT_OF_SCOPE→SA_ASSIST | 1 |
| NO_TAXSIMBA_SERVICE→SA_ASSIST | 1 |
| NO_TAXSIMBA_SERVICE→MORE_INFO_NEEDED | 1 |

## Per-failure

### H001
- **Q:** I work full-time but make money on TikTok. Do I need to tell HMRC?
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need turnover amount/tax year; if self-employment >£1,000 usually SA.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return | https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income
- **SIMBA (excerpt):** Yes, if your income from TikTok exceeds £1,000 in a tax year, you need to register for Self Assessment and report this income to HMRC. This applies even if you also have a full-time job. Keep detailed records of your ear…

### H002
- **Q:** I rent out my flat but my employer already takes tax.
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** missing_clarification
- **Notes:** PAYE does not tax rental; property income usually needs SA. Ask rent amount/year.
- **Sources:** https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-working-out-your-rental-income | https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- **SIMBA (excerpt):** Even if your employer deducts tax through PAYE, you still need to declare your rental income to HMRC. Rental income is typically reported through Self Assessment, especially if it exceeds the tax-free allowance. It's imp…

### H004
- **Q:** I’m an Uber driver. Do I need an accountant?
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** missing_clarification
- **Notes:** Likely self-employed; SA if >£1,000. Accountant optional — TaxSimba SA possible; don’t force Elite.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- **SIMBA (excerpt):** As an Uber driver, you may benefit from having an accountant, especially if your income is above the trading allowance of £1,000. You’ll likely need to register for Self Assessment and file a tax return, which can be com…

### H006
- **Q:** I sell things online. Do I have to pay tax?
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** classification_matcher_mismatch
- **Notes:** Depends if trading vs hobby and amounts; >£1,000 trading usually SA.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return | https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income
- **SIMBA (excerpt):** It depends whether you’re casually selling personal belongings or running a trade as a sole trader. Occasional sales of personal items are often different from a regular online business that may need Self Assessment. Are…

### H007
- **Q:** I have two jobs and a side business.
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need side-business turnover; PAYE jobs alone may not need SA.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- **SIMBA (excerpt):** Having two jobs and a side business means you may have multiple sources of income, which can affect your tax obligations. If your side business generates more than £1,000 in trading income (before reliefs) in the tax yea…

### H010
- **Q:** I received an HMRC letter and don’t understand it.
- **Expected:** ACCOUNTANT_CONSULTATION · **Observed:** MORE_INFO_NEEDED
- **Causes:** missing_escalation
- **Notes:** Cannot interpret personal HMRC letter contents safely — escalate consultation/support.
- **Sources:** 
- **SIMBA (excerpt):** I can help clarify the contents of the letter. Could you provide a brief summary of what the letter states or the specific points you're unsure about? This will help me assist you better.…

### H013
- **Q:** I got a P60. What do I do with it?
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** missing_clarification
- **Notes:** P60 is employment summary; SA only if other triggers.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return | https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** A P60 is an important document summarising your earnings and the tax you've paid for the tax year. You should keep it for your records, as it may be needed for various purposes, such as completing your Self Assessment ta…

### H014
- **Q:** Does having two PAYE jobs mean I must file a tax return?
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** missing_clarification, misunderstood_income_type
- **Notes:** Not automatically; undertaxed PAYE / other income can trigger SA.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return | https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Having two PAYE jobs does not automatically mean you must file a Self Assessment tax return. You typically need to file if you have additional untaxed income, are self-employed, or have received a notice from HMRC to do …

### H015
- **Q:** My employer underpaid my tax. Do I need an accountant?
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** missing_clarification
- **Notes:** May be PAYE reconciliation; not automatically TaxSimba SA.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return | https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** If your employer underpaid your tax, you may need to address this with HMRC directly, especially if it affects your tax return or if you have additional income that requires reporting. An accountant can help you navigate…

### H016
- **Q:** I left my job mid-year. Do I still need Self Assessment?
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** missing_clarification, misunderstood_income_type
- **Notes:** Leaving job alone ≠ SA; ask other income.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return | https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** If you were self-employed and your trading income was more than £1,000 in the tax year, you will need to register for Self Assessment and file a tax return, even if you left your job. If you were only employed and your i…

### H017
- **Q:** Company car benefit — is that Self Assessment?
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** missing_clarification
- **Notes:** Often via PAYE/P11D; confirm other income.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return | https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Yes, if you receive a company car as a benefit, you typically need to report this on your Self Assessment tax return. The value of the benefit is added to your taxable income, and you'll need to pay tax on it. This appli…

### H018
- **Q:** I only have PAYE and £200 bank interest. SA?
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** classification_matcher_mismatch
- **Notes:** Small interest often covered; check GOV.UK who-must-send.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return | https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** If your only income is from PAYE employment and you have £200 in bank interest, you may not need to file a Self Assessment tax return. However, if your total taxable income exceeds the Personal Savings Allowance (which i…

### H021
- **Q:** Exactly £1,000 freelance. Am I below the trading allowance so no SA?
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** missing_clarification
- **Notes:** Exact £1,000 is boundary for ‘more than £1,000’; don’t say below allowance.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return | https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income | https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax | https://www.gov.uk/register-for-self-assessment
- **SIMBA (excerpt):** If your freelance income is exactly £1,000, you are at the threshold of the trading allowance for the 2026-27 tax year. However, since your income is exactly £1,000, you would still need to register for Self Assessment a…

### H027
- **Q:** Can I use the £1,000 trading allowance instead of registering?
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** classification_matcher_mismatch
- **Notes:** Allowance is relief; if earned >£1,000 usually still register.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return | https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income | https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax | https://www.gov.uk/register-for-self-assessment
- **SIMBA (excerpt):** If your annual gross trading income is £1,000 or less for the 2026-27 tax year, you may not need to register for Self Assessment and can use the trading allowance instead. However, if your trading income exceeds £1,000, …

### H028
- **Q:** I invoice as a sole trader through an app. Is that CIS?
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** missing_clarification
- **Notes:** CIS is construction-specific — clarify trade.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return | https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income | https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax | https://www.gov.uk/register-for-self-assessment
- **SIMBA (excerpt):** If you are invoicing for construction work as a sole trader, you may be operating under the Construction Industry Scheme (CIS). CIS applies when contractors deduct money from subcontractors' payments and pay it to HMRC. …

### H031
- **Q:** I let a room in my home. Do I need TaxSimba?
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** missing_clarification
- **Notes:** Rent-a-room / amounts matter.
- **Sources:** https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-working-out-your-rental-income | https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return | https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** If you let a room in your home, you may need to declare the rental income to HMRC, especially if it exceeds the property allowance of £1,000 for the 2026-27 tax year. If your gross rental income is £1,000 or less, you mi…

### H032
- **Q:** Property income £60,000 2024-25 — MTD?
- **Expected:** BOTH_SA_AND_MTD · **Observed:** MTD_ASSIST
- **Causes:** other_evidenced
- **Notes:** SA yes; QI >£50k → MTD Apr 2026.
- **Sources:** https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-working-out-your-rental-income | https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return | https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Yes, if your qualifying income from property is £60,000 for the 2024-25 tax year, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. The £50,000 threshold applies to qualifying incom…

### H035
- **Q:** What’s this Making Tax Digital thing I keep hearing about?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Explain MTD ITSA high-level; ask income type/amount/year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Making Tax Digital (MTD) is a UK government initiative aimed at modernising the tax system. It requires eligible self-employed individuals and landlords to maintain digital records and submit quarterly updates to HMRC, r…

### H036
- **Q:** Do I need special software for tax now?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** May refer to MTD; ask if self-emp/property and QI.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Yes, if your qualifying income exceeds £30,000 in the 2025-26 tax year, you'll need to use compatible software for Making Tax Digital (MTD) for Income Tax. This involves creating and storing digital records of your busin…

### H037
- **Q:** HMRC said something about quarterly updates — is that me?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Quarterly updates = MTD ITSA if in scope.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Whether you need to submit quarterly updates depends on your income. If you're self-employed or a landlord with qualifying income over £30,000 in the 2025-26 tax year, you'll need to use Making Tax Digital (MTD) for Inco…

### H038
- **Q:** I have PAYE £50,000 and freelance £2,000. Add them for MTD?
- **Expected:** NO_TAXSIMBA_SERVICE · **Observed:** MTD_ASSIST
- **Causes:** incorrect_mtd_or_sa_obligation
- **Notes:** Do not add PAYE to QI; £2k alone not MTD bands.
- **Sources:** https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** For Making Tax Digital (MTD) purposes, only your qualifying income from self-employment and property is considered. In your case, the £2,000 from freelance work counts as qualifying income, but your PAYE income does not.…

### H041
- **Q:** CIS refund — can TaxSimba get my money back?
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** missing_clarification
- **Notes:** May be SA; don’t promise refund amounts.
- **Sources:** https://www.gov.uk/what-is-the-construction-industry-scheme
- **SIMBA (excerpt):** TaxSimba cannot directly process CIS refunds for you, as we do not file returns or submit claims to HMRC. However, we can assist you in understanding the process and what documentation you need to claim a refund. Typical…

### H042
- **Q:** I’m a limited company CIS contractor. Can you do my Corporation Tax?
- **Expected:** OUT_OF_SCOPE · **Observed:** SA_ASSIST
- **Causes:** incorrect_package_selection
- **Notes:** Corp tax/limited company accounts not TaxSimba catalogue default.
- **Sources:** 
- **SIMBA (excerpt):** I can't assist with Corporation Tax filing directly. However, I can provide information about Corporation Tax obligations for limited companies. As a CIS contractor, your company will need to pay Corporation Tax on its p…

### H043
- **Q:** I sold Bitcoin for a profit. How much tax do I owe?
- **Expected:** ACCOUNTANT_CONSULTATION · **Observed:** SA_ASSIST
- **Causes:** premature_selling, missing_escalation
- **Notes:** Need disposal history/costs; don’t invent liability.
- **Sources:** https://www.gov.uk/guidance/check-if-you-need-to-pay-tax-when-you-sell-cryptoassets
- **SIMBA (excerpt):** Cryptoassets can create Self Assessment reporting needs. HMRC may treat disposals under Capital Gains Tax, and frequent trading can be Income Tax instead — it depends on your activity. Keep detailed records. I won’t inve…

### H044
- **Q:** Do I pay tax when I buy crypto or only when I sell?
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** missing_clarification
- **Notes:** Usually disposal events; check GOV.UK crypto guidance.
- **Sources:** https://www.gov.uk/guidance/check-if-you-need-to-pay-tax-when-you-sell-cryptoassets
- **SIMBA (excerpt):** Cryptoassets can create Self Assessment reporting needs. HMRC may treat disposals under Capital Gains Tax, and frequent trading can be Income Tax instead — it depends on your activity. Keep detailed records. I won’t inve…

### H045
- **Q:** Dividend income £2,000 — Self Assessment?
- **Expected:** MORE_INFO_NEEDED · **Observed:** NO_TAXSIMBA_SERVICE
- **Causes:** missing_clarification
- **Notes:** Depends on total income/other factors — who-must-send.
- **Sources:** https://www.gov.uk/tax-on-dividends | https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- **SIMBA (excerpt):** If your only income is £2,000 from dividends, you typically do not need to send a Self Assessment tax return for the 2026-27 tax year, as the dividend allowance is £2,000. This means you can receive up to £2,000 in divid…

### H051
- **Q:** HMRC charged me a late filing penalty. Is that fair?
- **Expected:** ACCOUNTANT_CONSULTATION · **Observed:** SA_ASSIST
- **Causes:** missing_escalation
- **Notes:** Appeal/facts — escalate.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/penalties
- **SIMBA (excerpt):** HMRC imposes late filing penalties for Self Assessment tax returns if you miss the deadlines. The penalties are designed to encourage timely submissions. If you filed after the deadline, it is generally considered fair f…

### H053
- **Q:** Do I need to register for VAT at £85,000 turnover?
- **Expected:** MORE_INFO_NEEDED · **Observed:** NO_TAXSIMBA_SERVICE
- **Causes:** missing_clarification
- **Notes:** Check current VAT threshold on GOV.UK (historically £90k) — verify page.
- **Sources:** https://www.gov.uk/vat-registration-thresholds
- **SIMBA (excerpt):** You must register for VAT if your total taxable turnover exceeds £90,000 in the last 12 months or if you expect it to exceed £90,000 in the next 30 days. The previous threshold of £90,000 is outdated. If your turnover is…

### H055
- **Q:** I need help with Immigration / visa taxes.
- **Expected:** OUT_OF_SCOPE · **Observed:** MORE_INFO_NEEDED
- **Causes:** incorrect_package_selection
- **Notes:** Outside TaxSimba SA/MTD services.
- **Sources:** 
- **SIMBA (excerpt):** I can assist with general tax-related queries, but for specific immigration or visa tax issues, it's best to consult a specialist in that area. If you have questions about your tax obligations in the UK, such as Self Ass…

### H056
- **Q:** Can you recommend a will writer?
- **Expected:** OUT_OF_SCOPE · **Observed:** MORE_INFO_NEEDED
- **Causes:** incorrect_package_selection
- **Notes:** Outside scope.
- **Sources:** 
- **SIMBA (excerpt):** I can't recommend specific will writers, but I suggest looking for a qualified solicitor or a professional will writing service. It's important to ensure they are reputable and experienced in drafting wills. You might al…

### H058
- **Q:** Compare all your packages and dump every price.
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** missing_clarification
- **Notes:** Prefer not full dump unless asked; if asked, catalogue only.
- **Sources:** 
- **SIMBA (excerpt):** I can provide a brief overview of our packages, but I recommend focusing on the one that best suits your needs.   1. **Self Assessment Simple**: £119 per tax year. 2. **Self Assessment Smart**: £149 per tax year. 3. **Se…

### H065
- **Q:** I do not want any package — just tell me if I need SA for £8k freelance.
- **Expected:** NO_TAXSIMBA_SERVICE · **Observed:** SA_ASSIST
- **Causes:** failure_to_respect_user_intent, incorrect_mtd_or_sa_obligation
- **Notes:** Answer SA yes; zero packages.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- **SIMBA (excerpt):** If your freelance trading income is £8,000 in a tax year, you will need to register for Self Assessment and submit a tax return. The threshold for needing to register is if your trading income exceeds £1,000. Since £8,00…

### H067
- **Q:** I have no self-employment income. Also my freelance made £12,000. Do I need SA?
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** missing_clarification
- **Notes:** Contradiction — clarify which is true before concluding.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- **SIMBA (excerpt):** With freelance / self-employment income of £12,000 for the tax year in question, you are above the £1,000 sole-trader threshold, so you usually must register for Self Assessment and send a tax return. That £1,000 figure …

### H069
- **Q:** Landlord and Uber driver and PAYE — what do I need?
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** missing_clarification, misunderstood_income_type
- **Notes:** Need amounts per stream and years for SA/MTD.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return | https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** As a landlord and Uber driver with PAYE income, you may need to file a Self Assessment tax return if your additional income exceeds certain thresholds. For the 2026-27 tax year, if your self-employed income (from Uber dr…

### H070
- **Q:** Tell me everything about tax and also sell me your best package.
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** missing_clarification
- **Notes:** Don’t dump catalogue; ask primary need.
- **Sources:** 
- **SIMBA (excerpt):** I can provide you with useful information about tax, but it would be more effective to focus on specific areas of interest, such as Self Assessment, Making Tax Digital, or tax reliefs.   For tailored support, I recommend…

### H071
- **Q:** Is Christmas party tip income taxable?
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** missing_clarification
- **Notes:** Tips can be taxable — facts needed.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- **SIMBA (excerpt):** Yes, tips received during a Christmas party are generally considered taxable income. This includes any cash tips or gifts that are given to you as part of your employment. You must report this income on your Self Assessm…

### H072
- **Q:** I swapped services with a friend instead of invoicing. Taxable?
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** missing_clarification
- **Notes:** Barter can be taxable trading.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- **SIMBA (excerpt):** Yes, swapping services with a friend can still be considered taxable. HMRC views this as a barter transaction, meaning you may need to report the value of the services you provided as income, even if no money changed han…

### H073
- **Q:** OnlyFans income — Self Assessment?
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** missing_clarification
- **Notes:** Likely self-employment if >£1,000.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- **SIMBA (excerpt):** Yes, if you earn income from OnlyFans, you typically need to complete a Self Assessment tax return. This applies if your income exceeds £1,000 in a tax year, as you would be considered self-employed. You'll need to repor…

### H077
- **Q:** Retired, only state pension.
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** missing_clarification
- **Notes:** Often no SA; check other income.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- **SIMBA (excerpt):** If you're retired and only receiving a state pension, you typically won't need to file a Self Assessment tax return unless your income exceeds certain thresholds or you have other taxable income. The state pension is tax…

### H079
- **Q:** What’s the difference between Self Assessment and MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** ACCOUNTANT_CONSULTATION
- **Causes:** missing_clarification
- **Notes:** Explain both at high level.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax | https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- **SIMBA (excerpt):** Here is what SIMBA can state from approved catalogue decisions:  Self Assessment (per tax year): Simple £119 · Smart £149 · Elite £299. Making Tax Digital (per month, VAT included): Simbian Comply £29.99 · Simbian Growth…

### H082
- **Q:** How do I appeal a penalty?
- **Expected:** ACCOUNTANT_CONSULTATION · **Observed:** MORE_INFO_NEEDED
- **Causes:** missing_escalation
- **Notes:** Process on GOV.UK; complex → consult.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/penalties
- **SIMBA (excerpt):** To appeal a penalty from HMRC, you need to follow these steps:  1. **Check the Penalty Notice**: Review the notice to understand why the penalty was issued and the specific details.  2. **Gather Evidence**: Collect any r…

### H085
- **Q:** Call me back about my taxes.
- **Expected:** MORE_INFO_NEEDED · **Observed:** ACCOUNTANT_CONSULTATION
- **Causes:** premature_selling
- **Notes:** No phone onboarding promise; email/consult links.
- **Sources:** 
- **SIMBA (excerpt):** I can’t arrange a free phone callback. You can choose a paid video consultation instead: Quick Tax Advice (£99 / 20 minutes) or Extended Tax Consultation (£149 / 40 minutes) on Google Meet. Online booking isn’t connected…

### H086
- **Q:** I’m PAYE but got £600 interest from peer-to-peer lending.
- **Expected:** MORE_INFO_NEEDED · **Observed:** SA_ASSIST
- **Causes:** missing_clarification
- **Notes:** May need SA depending on totals.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- **SIMBA (excerpt):** Even if you're taxed under PAYE, the £600 interest from peer-to-peer lending is considered additional income. This means you may need to file a Self Assessment tax return, as HMRC requires individuals with untaxed income…

### H087
- **Q:** High Income Child Benefit Charge — help?
- **Expected:** ACCOUNTANT_CONSULTATION · **Observed:** SA_ASSIST
- **Causes:** missing_escalation
- **Notes:** HICBC often via SA — fact specific.
- **Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- **SIMBA (excerpt):** The High Income Child Benefit Charge applies if you or your partner have an individual income over £60,000 in the tax year. If your income exceeds this threshold, you may have to pay back some or all of your Child Benefi…

### H088
- **Q:** I transferred a property to my spouse. CGT?
- **Expected:** ACCOUNTANT_CONSULTATION · **Observed:** MORE_INFO_NEEDED
- **Causes:** missing_escalation
- **Notes:** CGT/spouse rules — advice.
- **Sources:** 
- **SIMBA (excerpt):** When you transfer a property to your spouse, it is generally treated as a "no gain, no loss" transaction for Capital Gains Tax (CGT) purposes. This means that you won't have to pay CGT at the time of the transfer, and yo…

### H089
- **Q:** Do you guarantee no HMRC enquiry?
- **Expected:** NO_TAXSIMBA_SERVICE · **Observed:** MORE_INFO_NEEDED
- **Causes:** other_evidenced
- **Notes:** Must not guarantee.
- **Sources:** 
- **SIMBA (excerpt):** I cannot guarantee that there will be no HMRC enquiry. Enquiries can occur for various reasons, including random checks or discrepancies in submitted information. However, ensuring accurate and complete records, along wi…

### H092
- **Q:** Property rent roughly £15000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** For the 2026-27 tax year, if your total qualifying income from property rent is more than £20,000, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2028. Since your property rent is £15,…

### H095
- **Q:** Property rent roughly £20000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** classification_matcher_mismatch
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** For the 2026-27 tax year, if your qualifying income from property rent is more than £20,000, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2028. Qualifying income is your total rental…

### H098
- **Q:** Property rent roughly £25000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** NO_TAXSIMBA_SERVICE
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Since your property rental income is £25,000, you do not need to use Making Tax Digital (MTD) for Income Tax yet. The threshold for MTD starts at £20,000 for the 2026-27 tax year, which begins on 6 April 2027. Therefore,…

### H101
- **Q:** Property rent roughly £30000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** If your qualifying income from property rent is more than £30,000 for the 2025-26 tax year, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2027. This means you'll need to keep digital …

### H104
- **Q:** Property rent roughly £35000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Since your property rental income is approximately £35,000, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2027, as this threshold applies to qualifying income over £30,000 for the 202…

### H107
- **Q:** Property rent roughly £40000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Since your property rental income is £40,000, you will not need to use Making Tax Digital (MTD) for Income Tax until your qualifying income exceeds £50,000 for the 2024-25 tax year. This means you will need to comply wit…

### H110
- **Q:** Property rent roughly £45000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Since your property rental income is approximately £45,000, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026, as your qualifying income exceeds the £50,000 threshold for the 2024-25…

### H113
- **Q:** Property rent roughly £50000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** If your qualifying property income was more than £50,000 for the 2024-25 tax year, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. Qualifying income is your total rental income be…

### H116
- **Q:** Property rent roughly £55000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** classification_matcher_mismatch
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Since your property rental income is roughly £55,000, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. This requirement applies if your qualifying income exceeds £50,000 for the 20…

### H119
- **Q:** Property rent roughly £60000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** classification_matcher_mismatch
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Since your property rental income is roughly £60,000, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. This requirement applies if your qualifying income exceeds £50,000 for the 20…

### H122
- **Q:** Property rent roughly £65000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** classification_matcher_mismatch
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Since your property rental income is roughly £65,000, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. This requirement applies because your qualifying income exceeds the £50,000 t…

### H125
- **Q:** Property rent roughly £70000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** classification_matcher_mismatch
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Since your property rental income is roughly £70,000, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. This is because your qualifying income exceeds the £50,000 threshold for the …

### H128
- **Q:** Property rent roughly £75000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Since your property rental income is £75,000, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. This requirement applies if your qualifying income exceeds £50,000 for the 2024-25 ta…

### H131
- **Q:** Property rent roughly £80000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Since your property rental income is £80,000, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026, as this exceeds the £50,000 qualifying income threshold for the 2024-25 tax year.   W…

### H134
- **Q:** Property rent roughly £85000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** If your qualifying income from property rent is £85,000 for the 2025-26 tax year (which runs from 6 April 2025 to 5 April 2026), you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2027. Th…

### H137
- **Q:** Property rent roughly £90000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** If your total property income exceeds £50,000 for the 2024-25 tax year (which runs from 6 April 2024 to 5 April 2025), you will need to use Making Tax Digital (MTD) for Income Tax from 6 April 2026. Since your property r…

### H140
- **Q:** Property rent roughly £95000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Since your property rental income is £95,000, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. This is because your qualifying income exceeds the £50,000 threshold for the 2024-25 …

### H143
- **Q:** Property rent roughly £100000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** If your gross property income is £100,000 for the 2024-25 tax year, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. This is because your qualifying income exceeds the £50,000 thre…

### H146
- **Q:** Property rent roughly £105000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Since your property rental income is approximately £105,000, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. This requirement applies if your qualifying income exceeds £50,000 for…

### H149
- **Q:** Property rent roughly £110000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** If your gross property income is £110,000 for the 2024-25 tax year, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. The threshold for MTD is more than £50,000 in qualifying income…

### H150
- **Q:** I earn £50k — am I a higher-rate taxpayer and does that change MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** MTD uses QI not PAYE tax band alone.
- **Sources:** https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** No — qualifying income of exactly £50,000 for 2024-25 does not bring you into Making Tax Digital under that band. HMRC’s wording is “more than £50,000”, so the threshold is exclusive of the exact amount. The 6 April 2026…

### H152
- **Q:** Property rent roughly £115000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** classification_matcher_mismatch
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Since your property rental income is roughly £115,000, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. This is because your qualifying income exceeds the £50,000 threshold for the…

### H155
- **Q:** Property rent roughly £120000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Since your property rental income is £120,000, which exceeds the £20,000 threshold for the 2026-27 tax year, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2028. This means you'll be r…

### H158
- **Q:** Property rent roughly £125000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Yes, if your total property income for the 2024-25 tax year exceeds £50,000, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. Since your property rent is £125,000, it qualifies as …

### H161
- **Q:** Property rent roughly £130000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** classification_matcher_mismatch
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Yes, if your property rental income is roughly £130,000, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2027. This is because your qualifying income exceeds the £50,000 threshold for t…

### H164
- **Q:** Property rent roughly £135000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** If your qualifying income from property rent is more than £50,000 for the 2024-25 tax year, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. Since your rental income exceeds this t…

### H167
- **Q:** Property rent roughly £140000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** classification_matcher_mismatch
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Yes, if your property rental income is roughly £140,000 for the 2024-25 tax year, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. This is because your qualifying income exceeds th…

### H170
- **Q:** Property rent roughly £145000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Since your property rental income is approximately £145,000, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. This is because your qualifying income exceeds the £50,000 threshold f…

### H173
- **Q:** Property rent roughly £150000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Yes, if your property rental income is £150,000, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. This is because your qualifying income exceeds the £50,000 threshold for the 2024-…

### H176
- **Q:** Property rent roughly £155000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Since your property rental income is approximately £155,000, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. This is because your qualifying income exceeds the £50,000 threshold f…

### H179
- **Q:** Property rent roughly £160000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Since your property rental income is approximately £160,000, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. This is because your qualifying income exceeds the £50,000 threshold f…

### H182
- **Q:** Property rent roughly £165000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** classification_matcher_mismatch
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Since your property rental income is roughly £165,000, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. This is because your qualifying income exceeds the £50,000 threshold for the…

### H185
- **Q:** Property rent roughly £170000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Since your property rental income is £170,000, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. This is because your qualifying income exceeds the £50,000 threshold for the 2024-25…

### H188
- **Q:** Property rent roughly £175000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Since your property rental income is approximately £175,000, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. This is because your qualifying income exceeds the £50,000 threshold f…

### H191
- **Q:** Property rent roughly £180000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** If your qualifying income from property rent is £180,000 for the 2024-25 tax year, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. The £50,000 threshold applies to qualifying inco…

### H194
- **Q:** Property rent roughly £185000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** If your property rental income is £185,000 for the 2024-25 tax year, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. This is because your qualifying income exceeds the £50,000 thr…

### H197
- **Q:** Property rent roughly £190000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** If your property rental income exceeds £50,000 for the 2024-25 tax year (which runs from 6 April 2024 to 5 April 2025), you will need to use Making Tax Digital for Income Tax starting from 6 April 2026. Since your rental…

### H200
- **Q:** Property rent roughly £195000 — MTD?
- **Expected:** MORE_INFO_NEEDED · **Observed:** MTD_ASSIST
- **Causes:** missing_clarification
- **Notes:** Need tax year for band; ask year.
- **Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- **SIMBA (excerpt):** Since your property rental income is approximately £195,000, you will need to use Making Tax Digital (MTD) for Income Tax starting from 6 April 2026. This is because your qualifying income exceeds the £50,000 threshold f…
