# Surgical memory + wording evidence

Generated: 2026-11-21T15:19:14.799Z
**Mode: LIVE OpenAI**

## Before / after — memory defect (`sa?`)

**Before (from blind_v3 VJ006 evidence):** after establishing £1,675 / 2025-26, `sa?` re-asked amount and tax year.

**After (deterministic SA handler):**

```
With freelance / self-employment income of £1,675 for 2025-26, you are above the £1,000 sole-trader threshold, so you usually must register for Self Assessment and send a tax return. That £1,000 figure is the “more than £1,000” test on GOV.UK — £1,675 is not below it. You may still be able to claim the trading allowance (up to £1,000) instead of actual expenses when you calculate taxable profit, but that relief does not remove the normal requirement to register and file when trading income is more than £1,000.

Register: https://www.gov.uk/register-for-self-assessment
Who must send a return: https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
Trading allowance: https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income
```

needs_more_info=false trading_income_gbp=1675 must_usually_file=true

## General Self Assessment answer (after)

```
Self Assessment is HMRC’s system for people who need to report income that isn’t fully taxed another way (for example through PAYE alone). You report the relevant income, expenses, allowances and other information on your tax return, and your Self Assessment calculation determines the tax due. Many sole traders, landlords and people with untaxed income must send a return — but whether that applies to you depends on your circumstances. If you share your income types and a rough amount for a tax year, I can help you check. Official guidance: https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
```

## MTD annual-return wording (after)

### Operations question
```
No — MTD quarterly updates do not replace your annual tax return. They are summaries of self-employment and property income and expenses sent through compatible software. If you’re within MTD, you’ll also submit your tax return through compatible software (and pay any tax due by the usual deadline). Official guidance: https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/using-making-tax-digital-for-income-tax-for-the-first-time
```

### Educational MTD
```
Making Tax Digital for Income Tax is HMRC’s way for many sole traders and landlords in Self Assessment to keep digital records and send quarterly updates of self-employment and property income. MTD quarterly updates do not replace your annual tax return. If you’re within MTD, you’ll also submit your tax return through compatible software. Whether you must use it depends on your qualifying income (self-employment + property turnover before expenses) for specific tax years. PAYE salary alone does not count. Official guidance: https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
```

## Live/mock journeys (unedited)

### J01 — PAYE + side → SA → MTD

**USER:**
hi I work as a roofer

**ASSISTANT:**
Hello! As a roofer, if you're self-employed, you may need to register for Self Assessment if your trading income exceeds £1,000 in a tax year. This allows you to report your income and expenses to HMRC. 

Have you started earning income from your roofing work?

**USER:**
also a bit of side cash

**ASSISTANT:**
If your total self-employed trading income, including your side cash, is more than £1,000 in the tax year, you'll need to register for Self Assessment and file a tax return. 

Do you have a rough idea of your total income from both roofing and side activities?

**USER:**
main job PAYE around 32k

**ASSISTANT:**
Since you have a PAYE job earning around £32,000, your additional self-employed income from roofing and side cash will determine if you need to register for Self Assessment. If your total self-employed income exceeds £1,000, you'll need to file a return.

Could you estimate how much you earn from your roofing and side cash combined?

**USER:**
side maybe £1675

**ASSISTANT:**
Happy to help — I need one key fact before deciding. Was this casual occasional activity, or regular self-employment trading? GOV.UK’s usual sole-trader Self Assessment rule uses more than £1,000 of trading income in a tax year (before reliefs) — that is separate from using the trading allowance as tax relief when you do file. Official who-must-send guidance: https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return

**USER:**
regular trading — side was 2025-26 before expenses

**ASSISTANT:**
Since your self-employed income from roofing and side cash is around £1,675 for the 2025-26 tax year, which exceeds the £1,000 threshold, you'll need to register for Self Assessment and file a tax return for that year.

Would you like information on how to register for Self Assessment?

**USER:**
sa?

**ASSISTANT:**
With freelance / self-employment income of £1,675 for 2025-26, you are above the £1,000 sole-trader threshold, so you usually must register for Self Assessment and send a tax return. That £1,000 figure is the “more than £1,000” test on GOV.UK — £1,675 is not below it. You may still be able to claim the trading allowance (up to £1,000) instead of actual expenses when you calculate taxable profit, but that relief does not remove the normal requirement to register and file when trading income is more than £1,000.

Register: https://www.gov.uk/register-for-self-assessment
Who must send a return: https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
Trading allowance: https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income

**USER:**
mtd?

**ASSISTANT:**
Based on qualifying income of £1,675 for 2025-26, you are not brought into Making Tax Digital by the £30,000 / 6 April 2027 band, because that band needs income of more than £30,000. Later bands use different tax years and thresholds (£30,000 → 6 April 2027; £20,000 → 6 April 2028). You may still need Self Assessment for property or trading income even when MTD does not yet apply.

Official guidance: https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax

### J02 — property + freelance QI

**USER:**
rent £12,400 + freelance £19,800 2025-26 before expenses. qi for mtd?

**ASSISTANT:**
Yes — if your qualifying income was more than £30,000 for 2025-26, you need to use Making Tax Digital for Income Tax from 6 April 2027. Qualifying income means self-employment and property income before expenses (turnover/gross), not profit. Property and self-employment income is also usually reported through Self Assessment — MTD quarterly updates do not replace your annual tax return. If you’re within MTD, you’ll also submit your tax return through compatible software.

Official guidance: https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax

### J03 — customer changes income amount

**USER:**
freelance £2,000 2025-26 before expenses — sa?

**ASSISTANT:**
With freelance / self-employment income of £2,000 for 2025-26, you are above the £1,000 sole-trader threshold, so you usually must register for Self Assessment and send a tax return. That £1,000 figure is the “more than £1,000” test on GOV.UK — £2,000 is not below it. You may still be able to claim the trading allowance (up to £1,000) instead of actual expenses when you calculate taxable profit, but that relief does not remove the normal requirement to register and file when trading income is more than £1,000.

Register: https://www.gov.uk/register-for-self-assessment
Who must send a return: https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
Trading allowance: https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income

**USER:**
sorry — freelance was actually £900 before expenses 2025-26

**ASSISTANT:**
Happy to help — I need one key fact before deciding. Just to confirm — is the correct gross figure about £900 before expenses for one UK tax year, and what kind of income is that (self-employment, gig, property, or something else)?

**USER:**
sa?

**ASSISTANT:**
With self-employment / freelance income of £900 for 2025-26, you are not above the £1,000 sole-trader threshold on GOV.UK, so that particular rule alone usually does not require Self Assessment. You can still need a return for other reasons (other untaxed income, high overall income, HMRC notice, etc.). Confirm against https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return. Do you have any other untaxed income, or has HMRC asked you to file?

### J04 — customer corrects tax year

**USER:**
qualifying income £55,000 turnover before expenses 2024-25 — mtd?

**ASSISTANT:**
Yes — if your qualifying income was more than £50,000 for 2024-25, you need to use Making Tax Digital for Income Tax from 6 April 2026. Qualifying income means self-employment and property income before expenses (turnover/gross), not profit. Property and self-employment income is also usually reported through Self Assessment — MTD quarterly updates do not replace your annual tax return. If you’re within MTD, you’ll also submit your tax return through compatible software.

Official guidance: https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax

**USER:**
actually that £55,000 was for 2025-26 not 2024-25

**ASSISTANT:**
Happy to help — I need one key fact before deciding. Just to confirm — is the correct gross figure about £55,000 before expenses for one UK tax year, and what kind of income is that (self-employment, gig, property, or something else)?

**USER:**
mtd?

**ASSISTANT:**
Happy to help — I need one key fact before deciding. Is that figure PAYE employment salary, self-employment turnover, property rent before expenses, or a mix — and which tax year?

### J05 — second income source later

**USER:**
freelance £19,800 before expenses 2025-26

**ASSISTANT:**
For the 2025-26 tax year, if your freelance income is £19,800 before expenses, you will need to register for Self Assessment, as your income exceeds the £1,000 threshold for trading income. 

You will report your income and any allowable expenses on your Self Assessment tax return. If you have any specific questions about the process or need assistance, feel free to ask!

**USER:**
also rent £12,400 before expenses same year — qi for mtd?

**ASSISTANT:**
Based on qualifying income of £12,400 for 2025-26, you are not brought into Making Tax Digital by the £30,000 / 6 April 2027 band, because that band needs income of more than £30,000. Later bands use different tax years and thresholds (£30,000 → 6 April 2027; £20,000 → 6 April 2028). You may still need Self Assessment for property or trading income even when MTD does not yet apply.

Official guidance: https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax

### J06 — PAYE-only MTD

**USER:**
PAYE-only £46k — making tax digital?

**ASSISTANT:**
If your only income is PAYE employment, Making Tax Digital for Income Tax does not apply to you. MTD for Income Tax is aimed at sole traders and landlords in Self Assessment with qualifying income above the thresholds. Employment (PAYE) does not count towards qualifying income.

Official guidance: https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax

### J07 — marketplace personal possessions

**USER:**
sold random stuff on depop from the cupboard — in trouble?

**ASSISTANT:**
Happy to help — I need one key fact before deciding. Were you mainly selling your own personal possessions (for example clearing a wardrobe), or buying/making items to sell as a trade? Self Assessment trader registration is not automatic from a marketplace sale alone — if it is trading, roughly how much did you take in before expenses in one UK tax year?

### J08 — future business intention

**USER:**
thinking of starting garage clear-outs — do I need sa before I begin?

**ASSISTANT:**
Happy to help — I need one key fact before deciding. Has this activity actually started and earned income in a UK tax year yet, or is it still only planned? If it has started, roughly how much trading income before expenses do you expect (or have you earned) in the first tax year?

### J09 — what is Self Assessment?

**USER:**
what even is self assessment without the jargon

**ASSISTANT:**
Self Assessment is HMRC’s system for people who need to report income that isn’t fully taxed another way (for example through PAYE alone). You report the relevant income, expenses, allowances and other information on your tax return, and your Self Assessment calculation determines the tax due. Many sole traders, landlords and people with untaxed income must send a return — but whether that applies to you depends on your circumstances. If you share your income types and a rough amount for a tax year, I can help you check. Official guidance: https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return

### J10 — what is MTD?

**USER:**
tell me about making tax digital for income tax please

**ASSISTANT:**
Making Tax Digital for Income Tax is HMRC’s way for many sole traders and landlords in Self Assessment to keep digital records and send quarterly updates of self-employment and property income. MTD quarterly updates do not replace your annual tax return. If you’re within MTD, you’ll also submit your tax return through compatible software. Whether you must use it depends on your qualifying income (self-employment + property turnover before expenses) for specific tax years. PAYE salary alone does not count. Official guidance: https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax

### J11 — no package recommendation

**USER:**
I refuse packages. contracting £3,050 2025-26 before expenses — sa?

**ASSISTANT:**
With freelance / self-employment income of £3,050 for 2025-26, you are above the £1,000 sole-trader threshold, so you usually must register for Self Assessment and send a tax return. That £1,000 figure is the “more than £1,000” test on GOV.UK — £3,050 is not below it. You may still be able to claim the trading allowance (up to £1,000) instead of actual expenses when you calculate taxable profit, but that relief does not remove the normal requirement to register and file when trading income is more than £1,000.

Register: https://www.gov.uk/register-for-self-assessment
Who must send a return: https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
Trading allowance: https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income

### J12 — later asks cheapest SA package

**USER:**
dont sell me anything — sole trader £6,800 before expenses 2024-25 — file?

**ASSISTANT:**
As a sole trader with £6,800 in gross trading income for the 2024-25 tax year, you do not need to register for Self Assessment or file a tax return, as your income is below the £1,000 threshold for Self Assessment. However, if you have other income sources or if your situation changes, you may need to reconsider. 

Do you have any other sources of income or plans to increase your trading activity?

**USER:**
ok what's the cheapest sa package

**ASSISTANT:**
For a straightforward first-time Self Assessment, the lowest approved TaxSimba package is Self Assessment Simple at £119 per tax year. Smart (£149) or Elite (£299) only if your affairs are more complex. Tell me briefly about your income types and I can confirm the lowest suitable option — or start at https://www.taxsimba.co.uk/self-assessment.

### J13 — TaxSimba service vs independent software

**USER:**
does simbian monthly already include xero or separate?

**ASSISTANT:**
For Making Tax Digital for Income Tax, HMRC requires compatible software and digital records. With TaxSimba’s accountant-led Simbian plans, Xero is included in the monthly price (Comply→Xero Simple, Growth→Xero Ignite, Elite→Xero Grow) — you do not buy Xero separately through TaxSimba. Quarterly updates and year-end Self Assessment are included subject to documented customer responsibilities. SIMBA chat and the customer portal do not file directly to HMRC — TaxSimba accountants lead those workflows. Prices (VAT included): Simbian Comply £29.99, Growth £59.99, Elite £89.99 per month. Review https://www.taxsimba.co.uk/making-tax-digital — or tell me your qualifying income and tax year if you’re checking eligibility.

**USER:**
what if I just want independent xero myself

**ASSISTANT:**
For independent DIY use, HMRC publishes a list of Making Tax Digital compatible software on GOV.UK, and you can choose a product that fits your situation. TaxSimba is an accountant-led service: for customers on Simbian plans, Xero is included in the monthly price for the accountant-led MTD workflow (you do not buy Xero separately through TaxSimba). For Self Assessment filing workflows TaxSimba’s accountants use TaxCalc — that is internal to the service, not a product TaxSimba sells you to run alone. SIMBA will not invent that TaxSimba is mandatory or HMRC-endorsed. If you prefer full accountant-led support instead of DIY software, say whether you need Self Assessment, Making Tax Digital, or both.

### J14 — compact→full continuity (session history)

**USER:**
PAYE job plus freelance about £8,000 before expenses for 2025-26

**ASSISTANT:**
Since your freelance income is more than £1,000 before expenses for the 2025-26 tax year, you will need to register for Self Assessment and submit a tax return. Your PAYE job does not exempt you from this obligation, as additional untaxed income requires reporting.

Would you like to know more about the Self Assessment process or available packages for assistance?

**USER:**
Do I need to register for Self Assessment?

**ASSISTANT:**
With freelance / self-employment income of £8,000 for 2025-26, you are above the £1,000 sole-trader threshold, so you usually must register for Self Assessment and send a tax return. That £1,000 figure is the “more than £1,000” test on GOV.UK — £8,000 is not below it. You may still be able to claim the trading allowance (up to £1,000) instead of actual expenses when you calculate taxable profit, but that relief does not remove the normal requirement to register and file when trading income is more than £1,000.

Register: https://www.gov.uk/register-for-self-assessment
Who must send a return: https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
Trading allowance: https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income

### J15 — long then short sa?/mtd?

**USER:**
landlord rent £15,200 2025-26

**ASSISTANT:**
If you receive rental income of £15,200 in the 2025-26 tax year, you will need to declare this income to HMRC, typically through Self Assessment. Ensure you keep accurate records of the rent received and any allowable expenses related to your property. 

Would you like to know more about the Self Assessment process or any specific deductions you might be able to claim?

**USER:**
also a bit of freelance on the side maybe £2,200 before expenses same year

**ASSISTANT:**
Happy to help — I need one key fact before deciding. Was this casual occasional activity, or regular self-employment trading? GOV.UK’s usual sole-trader Self Assessment rule uses more than £1,000 of trading income in a tax year (before reliefs) — that is separate from using the trading allowance as tax relief when you do file. Official who-must-send guidance: https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return

**USER:**
regular trading

**ASSISTANT:**
Since you have regular trading income of £2,200 from freelance work in addition to your rental income of £15,200 for the 2025-26 tax year, you will need to register for Self Assessment and submit a tax return. Your total income exceeds the £1,000 threshold for Self Assessment, so you'll report both your rental income and freelance earnings.

Would you like more information on the Self Assessment process or assistance with choosing a package for filing?

**USER:**
sa?

**ASSISTANT:**
With freelance / self-employment income of £2,200 for 2025-26, you are above the £1,000 sole-trader threshold, so you usually must register for Self Assessment and send a tax return. That £1,000 figure is the “more than £1,000” test on GOV.UK — £2,200 is not below it. You may still be able to claim the trading allowance (up to £1,000) instead of actual expenses when you calculate taxable profit, but that relief does not remove the normal requirement to register and file when trading income is more than £1,000.

Register: https://www.gov.uk/register-for-self-assessment
Who must send a return: https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
Trading allowance: https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income

**USER:**
mtd?

**ASSISTANT:**
Based on qualifying income of £2,200 for 2025-26, you are not brought into Making Tax Digital by the £30,000 / 6 April 2027 band, because that band needs income of more than £30,000. Later bands use different tax years and thresholds (£30,000 → 6 April 2027; £20,000 → 6 April 2028). You may still need Self Assessment for property or trading income even when MTD does not yet apply.

Official guidance: https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax