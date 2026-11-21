/**
 * Source-backed UK general-information facts used by deterministic handlers.
 * A claim is only safe to assert when it matches these official rules.
 * Do NOT invent figures not listed here.
 */

export type OfficialFact = {
  id: string;
  claim: string;
  url: string;
  title: string;
  /** Tax years / effective dates the claim is pinned to */
  applicability: string;
  fetched_note: string;
};

export const DIVIDEND_ALLOWANCE_GBP = 500;
export const DIVIDEND_SOURCE: OfficialFact = {
  id: "dividend_allowance",
  claim: "Dividend allowance is £500 each year (current GOV.UK).",
  url: "https://www.gov.uk/tax-on-dividends",
  title: "Tax on dividends",
  applicability: "Current GOV.UK page (rates table shown for 2026-27; allowance £500)",
  fetched_note: "Verified via GOV.UK fetch 2026-11-20",
};

export const HICBC_THRESHOLD: OfficialFact = {
  id: "hicbc_threshold",
  claim:
    "High Income Child Benefit Charge threshold is over £60,000 for tax years from 2024-25 (was £50,000 up to 2023-24).",
  url: "https://www.gov.uk/child-benefit-tax-charge",
  title: "High Income Child Benefit Charge",
  applicability: "From 2024-25: £60,000; up to 2023-24: £50,000",
  fetched_note: "Verified via GOV.UK fetch 2026-11-20",
};

export const SA_SOLE_TRADER_MORE_THAN_1000: OfficialFact = {
  id: "sa_sole_trader_1000",
  claim:
    "You must send a tax return if self-employed as a sole trader and earned more than £1,000 (before reliefs).",
  url: "https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return",
  title: "Who must send a tax return",
  applicability: "Current GOV.UK who-must-send wording",
  fetched_note: "Verified via GOV.UK fetch 2026-11-20",
};

export const TRADING_ALLOWANCE: OfficialFact = {
  id: "trading_allowance",
  claim:
    "Trading allowance up to £1,000; if annual gross trading income is £1,000 or less you may not need to tell HMRC (with exceptions). If more than £1,000 you can use the allowance as partial relief instead of expenses.",
  url: "https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income",
  title: "Tax-free allowances on property and trading income",
  applicability: "Allowance from 6 April 2017; current GOV.UK guidance",
  fetched_note: "Verified via GOV.UK fetch 2026-11-20",
};

export const MTD_BANDS_FACT: OfficialFact = {
  id: "mtd_bands",
  claim:
    "MTD for Income Tax when qualifying income is more than £50,000 (2024-25) → from 6 April 2026; more than £30,000 (2025-26) → from 6 April 2027; more than £20,000 (2026-27) → from 6 April 2028. QI = SE + property turnover before expenses; PAYE excluded.",
  url: "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
  title: "Find out if and when you need to use Making Tax Digital for Income Tax",
  applicability: "Basis years 2024-25 / 2025-26 / 2026-27; starts 6 Apr 2026/2027/2028",
  fetched_note: "Verified via GOV.UK fetch 2026-11-20; QI detail also on work-out-your-qualifying-income page",
};

export const MTD_QI_COMBINES: OfficialFact = {
  id: "mtd_qi_combines",
  claim:
    "Qualifying income is total self-employment and property income before expenses; multiple SE/property sources are added together. PAYE/employment does not count.",
  url: "https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax",
  title: "Work out your qualifying income for Making Tax Digital for Income Tax",
  applicability: "Current GOV.UK QI guidance",
  fetched_note: "Verified via GOV.UK fetch 2026-11-20",
};

export const MTD_QUARTERLY_NOT_RETURN: OfficialFact = {
  id: "mtd_quarterly_not_return",
  claim:
    "Quarterly updates are summaries of income and expenses, not tax returns. You still submit a Self Assessment tax return each year.",
  url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/using-making-tax-digital-for-income-tax-for-the-first-time",
  title: "Using Making Tax Digital for Income Tax for the first time",
  applicability: "Current GOV.UK MTD first-time guidance",
  fetched_note: "Verified via GOV.UK / web search synthesis 2026-11-20",
};

export const MTD_AGENT_CAN_SUBMIT: OfficialFact = {
  id: "mtd_agent_submit",
  claim:
    "Authorised main or supporting agents can complete and submit a client’s quarterly sole-trader and property income and expenses updates using compatible software.",
  url: "https://www.gov.uk/guidance/choose-agents-for-making-tax-digital-for-income-tax",
  title: "Choose agents for Making Tax Digital for Income Tax",
  applicability: "Current GOV.UK agent permissions table",
  fetched_note: "Verified via GOV.UK / web search 2026-11-20",
};

export const VAT_THRESHOLD: OfficialFact = {
  id: "vat_threshold",
  claim: "Businesses must register for VAT if VAT taxable turnover is more than £90,000 (current GOV.UK overview).",
  url: "https://www.gov.uk/vat-registration-thresholds",
  title: "VAT / How VAT works overview (registration threshold)",
  applicability: "Current GOV.UK threshold £90,000 — verify live page before asserting",
  fetched_note: "Verified via GOV.UK fetch 2026-11-20",
};

export const SA_DEADLINES_ONLINE: OfficialFact = {
  id: "sa_deadlines_online",
  claim:
    "Online Self Assessment return and payment deadlines are typically 31 January following the tax year (paper earlier). Confirm the year pairing on GOV.UK deadlines page.",
  url: "https://www.gov.uk/self-assessment-tax-returns/deadlines",
  title: "Self Assessment deadlines",
  applicability: "Current GOV.UK deadlines page (example dates pinned to latest year on page)",
  fetched_note: "Verified via GOV.UK fetch 2026-11-20",
};

export const CRYPTO_DISPOSAL: OfficialFact = {
  id: "crypto_disposal",
  claim:
    "You may need to pay Capital Gains Tax when you dispose of cryptoassets (sell, exchange, pay for goods/services, gift — with exceptions). Buying alone is not listed as a disposal.",
  url: "https://www.gov.uk/guidance/check-if-you-need-to-pay-tax-when-you-sell-cryptoassets",
  title: "Check if you need to pay tax when you sell cryptoassets",
  applicability: "Current GOV.UK crypto disposal guidance",
  fetched_note: "Verified via GOV.UK fetch 2026-11-20",
};

export const LANDLORD_REPAIRS_VS_IMPROVEMENTS: OfficialFact = {
  id: "landlord_repairs_vs_improvements",
  claim:
    "Allowable property expenses include maintenance and repairs that restore the property; capital improvements/enhancements are generally not deductible against rental income (keep records for possible CGT).",
  url: "https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-working-out-your-rental-income",
  title: "Work out your rental income when you let property",
  applicability: "Current GOV.UK property rental income guidance",
  fetched_note: "Verified via GOV.UK/web search synthesis 2026-11-20",
};

export const ALL_OFFICIAL_FACTS: OfficialFact[] = [
  DIVIDEND_SOURCE,
  HICBC_THRESHOLD,
  SA_SOLE_TRADER_MORE_THAN_1000,
  TRADING_ALLOWANCE,
  MTD_BANDS_FACT,
  MTD_QI_COMBINES,
  MTD_QUARTERLY_NOT_RETURN,
  MTD_AGENT_CAN_SUBMIT,
  VAT_THRESHOLD,
  SA_DEADLINES_ONLINE,
  CRYPTO_DISPOSAL,
  LANDLORD_REPAIRS_VS_IMPROVEMENTS,
];
