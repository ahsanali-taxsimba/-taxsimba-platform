# PAYE and employment

| ID | Review status | Verification basis |
|----|---------------|--------------------|
| T121 | AWAITING_ACCOUNTANT_REVIEW | deterministic_rule |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** deterministic_rule
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Deterministic expectation exists but reply did not clearly match pass/fail patterns — escalate to Asim.

**Customer question**

> I earn £70,000 through PAYE only. Do I need MTD Income Tax?

**Expected conclusion (for challenge)**

PAYE-only with no other income usually does not require Self Assessment; confirm against GOV.UK who-must-send (other triggers can still apply).

**Expected / supporting sources**

- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return

**Actual SIMBA response (unedited)**

Happy to help — I need a little more detail before I can give an accurate answer. Is that figure PAYE employment salary, self-employment turnover, profit after expenses, rental income, or something else — and which tax year?

**Sources returned with reply**

- https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax

---

| T122 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> My tax code changed. Can SIMBA explain what the letters mean?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

Your tax code is made up of numbers and letters, which indicate how much tax-free income you can earn and any adjustments that may apply. The numbers represent your personal allowance divided by 10 (e.g., a code of 1257L means you can earn £12,570 tax-free). 

The letters indicate your tax situation: 

- **L**: Standard personal allowance.
- **M**: Marriage allowance transferred from your partner.
- **N**: Marriage allowance you’ve transferred to your partner.
- **T**: Other adjustments may apply.
- **K**: Your allowances are less than your deductions.

If you have more specific questions about your tax code, feel free to ask!

**Sources returned with reply**

- https://www.gov.uk/income-tax
- https://www.gov.uk/guidance/tax-on-cryptoassets
- https://www.gov.uk/capital-gains-tax/report-and-pay-capital-gains-tax

---

| T123 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I have two PAYE jobs. How do I check if my tax codes are correct?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

To check if your tax codes are correct for your two PAYE jobs, you can follow these steps:

1. **Check Your P60 or Payslips**: Your tax code should be listed on your P60 (issued at the end of the tax year) or on your payslips. 

2. **Visit the HMRC Website**: You can log into your personal tax account on the HMRC website to view your tax code and any updates.

3. **Contact HMRC**: If you believe your tax code is incorrect, you can contact HMRC directly for clarification. They can provide details on how your tax code was calculated.

4. **Review Your Personal Allowance**: Ensure that your personal allowance is being applied correctly across both jobs.

If you need further assistance with your tax situation, feel free to ask!

**Sources returned with reply**

- https://www.gov.uk/income-tax
- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/corporation-tax

---

| T124 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I received a P60. What is it used for?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

A P60 is an annual tax document provided by your employer that summarises your total pay and the tax deducted from your earnings for the tax year (6 April to 5 April). It is essential for completing your Self Assessment tax return, if required, and for checking your tax records. You may also need it when applying for loans or mortgages, as it provides proof of income. If you have any specific questions about how to use it, feel free to ask!

**Sources returned with reply**

- https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-working-out-your-rental-income
- https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income
- https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income

---

| T125 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I left a job and got a P45. What does it mean?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

A P45 is a document issued by your employer when you leave a job. It details your earnings and the tax you've paid during the tax year up to your leaving date. The P45 has several parts: one for you to keep, one for your new employer, and one for HMRC. You'll need to provide the relevant part to your new employer to ensure your tax code is correct and that you're taxed appropriately in your new job. If you have any further questions about your P45 or tax implications, feel free to ask!

**Sources returned with reply**

- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income
- https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income

---

| T126 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** 2026-27
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I have company benefits on a P11D. When might I need to report them?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

If you receive company benefits reported on a P11D, you may need to complete a Self Assessment tax return. This is typically required if you are a company director or if your total income, including the benefits, exceeds certain thresholds. For the 2026-27 tax year, you must file your Self Assessment by 31 January 2028 if you have untaxed income, such as benefits in kind. 

Would you like more information on how to file a Self Assessment return?

**Sources returned with reply**

- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-working-out-your-rental-income

---

| T127 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I have an employer pension. Does that automatically require Self Assessment?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

Having an employer pension does not automatically require you to file a Self Assessment tax return. You typically need to send a Self Assessment return if you have additional untaxed income, are self-employed, or have received a notice from HMRC to file. If your only income is from your employer pension and PAYE, you may not need to file. 

You can check your specific situation on GOV.UK to confirm if you need to file a return. Would you like more information on how to check your requirements?

**Sources returned with reply**

- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/self-assessment-tax-returns/deadlines
- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return

---

| T128 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I work from home. Can I claim tax relief for expenses?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

Yes, you can claim tax relief on certain unreimbursed job expenses if you work from home. This includes costs that are necessary for your work and not covered by your employer. Common claims may include a portion of your utility bills, internet costs, and office supplies. However, the rules are strict, so it's essential to check the specific qualifying criteria on GOV.UK. 

Would you like more information on what specific expenses you can claim?

**Sources returned with reply**

- https://www.gov.uk/tax-relief-for-employees
- https://www.gov.uk/tax-on-your-private-pension/pension-tax-relief
- https://www.gov.uk/expenses-and-benefits-business-travel-mileage/rules-for-tax

---

| T129 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I am employed and earn £1,500 from freelance work. What should I check?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

Since you are employed and also earning £1,500 from freelance work, you should check if you need to file a Self Assessment tax return. Generally, if your additional income exceeds £1,000, you must register for Self Assessment and declare this income to HMRC. 

You should also keep records of your freelance income and any allowable expenses. If you have any further questions about your situation or need assistance with registration, feel free to ask!

**Sources returned with reply**

- https://www.gov.uk/self-employed-records
- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-working-out-your-rental-income

---

| T130 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** 2024-25
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I was paid an employment bonus. Is it part of MTD qualifying income?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

I can work out your Making Tax Digital start date once I know your qualifying income. That’s total self-employment and property income before expenses for a specific tax year — not profit, and not PAYE salary.

What was that amount, and which tax year was it for (for example 2024-25)?

**Sources returned with reply**

- https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax
- https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax

---

| T131 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I earn £45,000 PAYE and £32,000 rental income. Which counts for MTD?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

Happy to help — I need a little more detail before I can give an accurate answer. Is that figure PAYE employment salary, self-employment turnover, profit after expenses, rental income, or something else — and which tax year?

**Sources returned with reply**

- https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax
- https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax

---

| T132 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I had an emergency tax code. How do I ask HMRC for a refund?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

To request a refund from HMRC for overpaid tax due to an emergency tax code, you can follow these steps:

1. **Check your tax code**: Ensure that your current tax code is correct and that you have indeed overpaid tax.
2. **Contact HMRC**: You can call HMRC at 0300 200 3300 or use their online services through your personal tax account.
3. **Provide necessary information**: Be ready to provide your National Insurance number, details of your income, and any relevant tax codes.

If you need further assistance with your tax situation, consider consulting a tax professional. Would you like to know more about how to manage your tax affairs?

**Sources returned with reply**

- https://www.gov.uk/income-tax
- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/guidance/tax-on-cryptoassets

---

| T133 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> Can TaxSimba correct my employer payroll?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

TaxSimba does not provide payroll correction services. Our focus is on Self Assessment and Making Tax Digital solutions. If you need assistance with payroll issues, it may be best to consult a payroll specialist or your employer's HR department. If you have questions about your tax obligations or need help with your Self Assessment, feel free to ask!

**Sources returned with reply**

- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/guidance/understanding-off-payroll-working-ir35
- https://www.gov.uk/corporation-tax

---

| T134 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> Can SIMBA access my HMRC PAYE record?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

No, SIMBA cannot access your HMRC PAYE record. As your digital tax assistant, I can provide information and guidance, but I don't have the capability to access personal tax records or interact directly with HMRC. If you need to view your PAYE record, you can do so by logging into your personal tax account on the HMRC website. If you have any other questions about PAYE or tax matters, feel free to ask!

**Sources returned with reply**

- https://www.gov.uk/income-tax
- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax

---

| T135 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** 2026-27
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> What is the personal allowance and can it change?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

The Personal Allowance for the tax year 2026-27 is £12,570. This is the amount you can earn before you start paying income tax. The Personal Allowance can change from year to year, typically announced during the annual Budget. It's important to check for updates each tax year on GOV.UK to confirm the current allowance.

Would you like to know how the Personal Allowance might affect your tax situation?

**Sources returned with reply**

- https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income
- https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income
- https://www.gov.uk/marriage-allowance

---

| T136 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I have student loan deductions from PAYE. How do they affect my return?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

If you have student loan deductions from your PAYE income, these repayments are typically collected automatically and won't directly affect your Self Assessment tax return. However, if your income exceeds the relevant repayment threshold for your specific student loan plan, you may need to ensure that your repayments are correctly reflected in your return.

If you have additional untaxed income or other circumstances that require you to file a Self Assessment return, you must report your total income, including any PAYE income. It's essential to check the thresholds for your specific student loan plan on GOV.UK.

Do you have any additional income that might require you to file a Self Assessment return?

**Sources returned with reply**

- https://www.gov.uk/repaying-your-student-loan
- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/income-tax

---

| T137 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** 2026-27
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I received redundancy pay. Is it all taxable?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

Redundancy pay can be partially tax-free, depending on the amount you receive. For the tax year 2026-27, the first £30,000 of redundancy pay is tax-free. Any amount above this threshold is subject to Income Tax. 

It's important to keep records of your redundancy pay and any other income, as you may need to report this in your Self Assessment if you're required to file one. If you have further questions about your specific situation, feel free to ask!

**Sources returned with reply**

- https://www.gov.uk/what-is-the-construction-industry-scheme
- https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-working-out-your-rental-income
- https://www.gov.uk/child-benefit-tax-charge

---

| T138 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I am on maternity leave and freelancing. What should I consider?

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

While freelancing on maternity leave, consider the following:

1. **Income Reporting**: Ensure you report your freelance income accurately for tax purposes. This income may affect your maternity pay or benefits.

2. **Self Assessment**: If your freelance income exceeds the tax threshold, you’ll need to complete a Self Assessment tax return for the relevant tax year.

3. **Record Keeping**: Maintain detailed records of your income and expenses, as this is crucial for your tax return.

4. **Maternity Pay**: Check how your freelance earnings might impact any statutory maternity pay or benefits you receive.

Would you like more information on Self Assessment or record-keeping?

**Sources returned with reply**

- https://www.gov.uk/self-employed-records
- https://www.gov.uk/guidance/tax-on-cryptoassets
- https://www.gov.uk/what-is-the-construction-industry-scheme

---

| T139 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> Explain PAYE versus Self Assessment in two sentences.

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

PAYE (Pay As You Earn) is a system where employers deduct income tax and National Insurance contributions from employees' wages before they are paid, simplifying tax payments for those in regular employment. In contrast, Self Assessment is a method for individuals, such as the self-employed or those with additional untaxed income, to report their earnings and calculate their tax liability directly to HMRC, typically through an annual tax return.

**Sources returned with reply**

- https://www.gov.uk/self-assessment-tax-returns/deadlines
- https://www.gov.uk/self-assessment-tax-returns/deadlines
- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return

---

| T140 | AWAITING_ACCOUNTANT_REVIEW | professional_judgement |

- **Review status:** AWAITING_ACCOUNTANT_REVIEW
- **Verification basis:** professional_judgement
- **Tax-year context:** Not explicitly pinned — treat as current GOV.UK guidance unless stated
- **Model / mode:** openai (live pack)
- **Packages shown:** none
- **Independent reason:** Requires Asim judgement — not solely machine-verifiable from the question facts.

**Customer question**

> I already said I only have PAYE wages. Please do not ask whether I am self-employed again.

**Expected conclusion (for challenge)**

Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.

**Expected / supporting sources**

- (none pre-assigned — Asim to cite)

**Actual SIMBA response (unedited)**

Understood! If you only have PAYE wages, you typically won't need to file a Self Assessment tax return unless you have additional untaxed income or meet other criteria. It's important to check the HMRC guidelines on who must send a tax return to confirm your specific situation. If you have any other questions about your tax obligations, feel free to ask!

**Sources returned with reply**

- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
- https://www.gov.uk/self-employed-records
- https://www.gov.uk/set-up-sole-trader

---
