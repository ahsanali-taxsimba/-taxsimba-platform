# SA eligibility

| ID | Review status | Verification basis |
|----|---------------|--------------------|
| T001 | AWAITING_ACCOUNTANT_REVIEW | deterministic_rule |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** deterministic_rule
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Deterministic expectation exists but reply did not clearly match pass/fail patterns — escalate to Asim.

**Customer question**

> I earn £48,000 PAYE only, taxed through payroll, with no other income. Do I need Self Assessment?

**Expected conclusion (for challenge)**

PAYE-only with no other income usually does not require Self Assessment; confirm against GOV.UK who-must-send (other triggers can still apply).

**Expected / supporting sources**

- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return

**Actual SIMBA response (unedited)**

Happy to help — I need a little more detail before I can give an accurate answer. Is that figure PAYE employment salary, self-employment turnover, profit after expenses, rental income, or something else — and which tax year?

**Sources returned with reply**

- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return

---

| T002 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** 2025-26
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I earned £8,000 freelance turnover in 2025/26 alongside my job. Must I file a return?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

Yes, you will need to file a Self Assessment tax return for the 2025-26 tax year. Since you earned £8,000 in freelance turnover, which is considered untaxed income, this triggers the requirement to file, even if you are also employed. 

If you have any further questions about the process or need assistance with filing, feel free to ask!

**Sources returned with reply**

- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return

---

| T003 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** 2025-26
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I made £700 gross from occasional freelance work in 2025/26. Do I need to register?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

For the 2025-26 tax year, if your gross income from freelance work is £700, you do not need to register for Self Assessment. You only need to register if your income exceeds £1,000, which is the trading allowance. Since your income is below this threshold, registration is not required. 

Do you have any other questions about your tax obligations?

**Sources returned with reply**

- https://www.gov.uk/register-for-self-assessment
- https://www.gov.uk/set-up-sole-trader
- https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax

---

| T004 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I sold my old sofa and laptop online for £2,000. Does this automatically require Self Assessment?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

Selling personal items like a sofa or laptop typically doesn't require you to file a Self Assessment tax return, as long as the sales are considered personal and not part of a trade. If you made a profit from selling these items, it may still be tax-free under the "chattels" exemption, provided the total gains are below the annual exempt amount. However, if you regularly sell items for profit, you may need to register for Self Assessment. 

If you're unsure, it might be helpful to consult with a tax professional. Would you like more information on Self Assessment requirements?

**Sources returned with reply**

- https://www.gov.uk/self-assessment-tax-returns/deadlines
- https://www.gov.uk/self-assessment-tax-returns/deadlines
- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return

---

| T005 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** 2026-27
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I received £3,500 in bank interest. Does that mean I must file a return?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

Whether you need to file a Self Assessment tax return depends on your overall tax situation. If your only income is the £3,500 in bank interest and you fall within the Personal Savings Allowance limits, you may not need to file. However, if you have other untaxed income or meet any other criteria for filing, you might still be required to submit a return.

For the 2026-27 tax year, the Personal Savings Allowance is £1,000 for basic-rate taxpayers and £500 for higher-rate taxpayers. If your interest exceeds these amounts, you would need to file.

Do you have any other sources of income?

**Sources returned with reply**

- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/apply-tax-free-interest-on-savings

---

| T006 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** 2026-27
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I receive dividends from shares. When might Self Assessment be required?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

You may need to complete a Self Assessment tax return if you receive dividends and your total income exceeds the tax-free Dividend Allowance, which is £2,000 for the 2026-27 tax year. Additionally, if you have other untaxed income or if HMRC has notified you to file a return, you will also need to submit one. 

If you have further questions about your specific situation, feel free to ask!

**Sources returned with reply**

- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/self-assessment-tax-returns/deadlines

---

| T007 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I have PAYE wages and £5,000 gross rent from a spare room. Do I need to file?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

Since you have PAYE wages and additional income from renting out a spare room, you may need to file a Self Assessment tax return. Generally, if your total income exceeds £1,000 from property (which includes your £5,000 gross rent), you must declare it. However, if your total income is below the personal allowance threshold, you may not owe any tax. It's advisable to check the specific rules on GOV.UK regarding who must send a tax return. 

Would you like more information on how to file a Self Assessment return?

**Sources returned with reply**

- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax
- https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-working-out-your-rental-income

---

| T008 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** 2025-26
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I started self-employment in February 2026. What are my registration and filing steps?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

Since you started self-employment in February 2026, you need to register for Self Assessment with HMRC by 5 October 2026. After registering, you'll need to file your first Self Assessment tax return for the 2025-26 tax year by 31 January 2027. 

Make sure to keep accurate records of your income and expenses from your self-employment. Would you like to know more about the registration process or filing your tax return?

**Sources returned with reply**

- https://www.gov.uk/self-assessment-tax-returns/deadlines
- https://www.gov.uk/tax-relief-for-employees
- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return

---

| T009 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I am a company director but have only PAYE salary. Must all directors file?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

If your employer deducts tax under PAYE, you may still need to send a Self Assessment tax return — for example if you have untaxed income, self-employment, property income, or other reasons listed on GOV.UK. PAYE alone does not automatically remove a filing duty. Check https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return — or tell me what other income you have and I can help narrow it down.

**Sources returned with reply**

- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/income-tax

---

| T010 | AWAITING_ACCOUNTANT_REVIEW | deterministic_rule |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** deterministic_rule
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Deterministic expectation exists but reply did not clearly match pass/fail patterns — escalate to Asim.

**Customer question**

> I earned £1,200 from selling handmade goods. How does the trading allowance work?

**Expected conclusion (for challenge)**

£1,200 exceeds £1,000: trading allowance may reduce taxable profit by up to £1,000, but income above £1,000 usually still engages Self Assessment filing/registration rules.

**Expected / supporting sources**

- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income

**Actual SIMBA response (unedited)**

The trading allowance allows individuals with trading income from self-employment to earn up to £1,000 tax-free in a tax year. Since you earned £1,200, you would exceed this threshold. You would need to declare the full amount to HMRC and pay tax on the profit after allowable expenses. 

If your trading income was £1,000 or less, you might not have needed to inform HMRC, but since you exceeded it, you must report it. Would you like to know more about allowable expenses?

**Sources returned with reply**

- https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income
- https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income
- https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-working-out-your-rental-income

---

| T011 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I have two jobs with PAYE deductions. Do I automatically need a tax return?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

Having two jobs with PAYE deductions does not automatically mean you need to file a Self Assessment tax return. You typically need to submit a return if you have additional untaxed income, are self-employed, or have received a notice from HMRC to file. It's best to check the criteria on GOV.UK to see if you meet any of the conditions that require a tax return. Would you like more information on specific criteria?

**Sources returned with reply**

- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/income-tax

---

| T012 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I received overseas rental income while living in the UK. What should I check?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

Rental income usually needs to be considered for Self Assessment, and may also count toward Making Tax Digital qualifying income (with any self-employment turnover) using gross rents before many expenses. Roughly how much rental income (before expenses) did you have, and for which tax year? Also — is this a residential let, Rent a Room, or something else?

**Sources returned with reply**

- https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-working-out-your-rental-income
- https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income
- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return

---

| T013 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I am retired and receive a State Pension and private pension. Do I need Self Assessment?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

If your only income is from your State Pension and private pension, you typically do not need to file a Self Assessment tax return, as these pensions are usually taxed at source. However, if you have other untaxed income, such as rental income or dividends, or if HMRC has specifically requested you to file a return, you may need to do so. 

If you're unsure about your specific situation, it might be helpful to consult with a tax professional. Would you like more information on how to proceed?

**Sources returned with reply**

- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/register-for-self-assessment
- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return

---

| T014 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I received a one-off bonus through PAYE. Does that trigger a return?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

Receiving a one-off bonus through PAYE does not automatically trigger a Self Assessment tax return. However, if you have additional untaxed income, such as self-employment earnings or property income, you may still need to file a return. It's best to check the criteria on GOV.UK to confirm if you fall into the category of those required to submit a Self Assessment. Would you like more information on the specific criteria?

**Sources returned with reply**

- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/income-tax
- https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax

---

| T015 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I have crypto gains but no self-employment. What determines whether I need to report them?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

Cryptoassets can create Self Assessment reporting needs. HMRC may treat disposals under Capital Gains Tax, and frequent trading can be Income Tax instead — it depends on your activity. Keep detailed records. I won’t invent your tax figure. Official guidance: https://www.gov.uk/guidance/tax-on-cryptoassets — were your crypto disposals investment-style gains, or more like a trading business?

**Sources returned with reply**

- https://www.gov.uk/guidance/tax-on-cryptoassets
- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/repaying-your-student-loan

---

| T016 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** 2026-27
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I am an Uber driver earning £18,000 turnover. Do I need Self Assessment?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

As an Uber driver with a turnover of £18,000, you will need to send a Self Assessment tax return for the 2026-27 tax year. Since your income is from self-employment, you are required to report it, regardless of whether you have other sources of income. 

If you haven't registered for Self Assessment yet, you'll need to do so by 5 October following the end of the tax year in which you started driving. 

Would you like more information on how to register?

**Sources returned with reply**

- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/register-for-self-assessment
- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return

---

| T017 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I have a partnership share of profits. How do I report it?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

If you have a partnership share of profits, you need to report it through a Self Assessment tax return. You'll include your share of the profits from the partnership in the "Partnership" section of the return. Ensure you keep accurate records of your share of the profits and any allowable expenses related to the partnership.

If you need assistance with filing your Self Assessment, I can recommend a suitable package. Would you like more information on that?

**Sources returned with reply**

- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax
- https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-working-out-your-rental-income

---

| T018 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** 2026-27
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I received Child Benefit and have a high income. How do I check the tax implications?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

If you or your partner have an individual income over £60,000, you may be subject to the High Income Child Benefit Charge for the 2026-27 tax year. This charge can reduce or completely remove your Child Benefit. To check the specific tax implications, you should review your income and consult the official guidance on GOV.UK regarding the High Income Child Benefit Charge. 

Would you like more information on how to calculate the charge or any specific aspects of it?

**Sources returned with reply**

- https://www.gov.uk/child-benefit-tax-charge
- https://www.gov.uk/scottish-income-tax
- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return

---

| T019 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I received a letter from HMRC asking for a return but think I owe no tax. Can I ignore it?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

You should not ignore the letter from HMRC. If you've received a notice to file a Self Assessment tax return, it's important to respond, even if you believe you owe no tax. Failing to submit the return can lead to penalties and interest charges. You can complete the return and indicate that you owe no tax, or contact HMRC for clarification on your situation. Would you like more information on how to complete a Self Assessment return?

**Sources returned with reply**

- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-working-out-your-rental-income
- https://www.gov.uk/guidance/tax-on-cryptoassets

---

| T020 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I am unsure if I need Self Assessment. What single question would you ask first?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

Have you been self-employed, a partner in a partnership, or received untaxed income during the tax year?

**Sources returned with reply**

- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/register-for-self-assessment
- https://www.gov.uk/self-assessment-tax-returns/deadlines

---
