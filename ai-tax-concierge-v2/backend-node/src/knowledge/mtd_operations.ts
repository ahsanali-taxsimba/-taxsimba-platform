/** Deterministic answers for MTD software / process questions (not eligibility). */

import {
  MTD_AGENT_CAN_SUBMIT,
  MTD_QUARTERLY_NOT_RETURN,
} from "./uk_tax_facts.js";

export function answerMtdOperationsQuestion(message: string): string | null {
  const lower = (message || "").toLowerCase();
  if (
    !/(mtd|making tax digital|simbian|xero|quarterly update|digital records)/i.test(
      lower,
    )
  ) {
    return null;
  }

  // Agent / accountant submission — official: authorised agents CAN submit quarterly updates
  if (
    /(accountant|agent|bookkeeper).{0,40}(submit|send|file).{0,40}(mtd|quarterly|update)|(can (my |an )?(accountant|agent).{0,30}(submit|send))/i.test(
      lower,
    )
  ) {
    return (
      "Yes — if you authorise an agent (main or supporting) for Making Tax Digital for Income Tax, " +
      "they can complete and submit your quarterly sole-trader and property income-and-expenses updates using compatible software. " +
      "Main agents can also finalise and submit the year-end tax return; supporting agents have more limited permissions. " +
      `Official guidance: ${MTD_AGENT_CAN_SUBMIT.url}`
    );
  }

  // Do quarterly updates replace the return?
  if (
    /quarterly updates?.{0,40}replace|replace.{0,40}(year-?end|tax return|self assessment)|do quarterly.{0,20}(replace|instead)/i.test(
      lower,
    )
  ) {
    return (
      "No — MTD quarterly updates do not replace your annual tax return. " +
      "They are summaries of self-employment and property income and expenses sent through compatible software. " +
      "If you’re within MTD, you’ll also submit your tax return through compatible software (and pay any tax due by the usual deadline). " +
      `Official guidance: ${MTD_QUARTERLY_NOT_RETURN.url}`
    );
  }

  if (/what (are|is) quarterly|quarterly updates? under mtd|what does quarterly/i.test(lower)) {
    return (
      "Under Making Tax Digital for Income Tax, quarterly updates are short summaries of your self-employment and/or property income and expenses for each 3-month period, sent through HMRC-compatible software. " +
      "They are not tax returns. You still keep digital records and still submit a year-end Self Assessment tax return. " +
      `Official guidance: ${MTD_QUARTERLY_NOT_RETURN.url}`
    );
  }

  if (/xero|software|which software|do i need xero/i.test(lower)) {
    return (
      "For Making Tax Digital for Income Tax, HMRC requires compatible software and digital records. " +
      "With TaxSimba’s accountant-led Simbian plans, Xero is included in the monthly price " +
      "(Comply→Xero Simple, Growth→Xero Ignite, Elite→Xero Grow) — you do not buy Xero separately through TaxSimba. " +
      "Quarterly updates and year-end Self Assessment are included subject to documented customer responsibilities. " +
      "SIMBA chat and the customer portal do not file directly to HMRC — TaxSimba accountants lead those workflows. " +
      "Prices (VAT included): Simbian Comply £29.99, Growth £59.99, Elite £89.99 per month. " +
      "Review https://www.taxsimba.co.uk/making-tax-digital — or tell me your qualifying income and tax year if you’re checking eligibility."
    );
  }

  // Educational: quarterly updates vs final declaration / year-end return
  if (
    /difference between quarterly|quarterly updates?.{0,40}final declaration|final declaration.{0,40}quarterly/i.test(
      lower,
    )
  ) {
    return (
      "Quarterly updates are short summaries of your self-employment and/or property income and expenses for each 3-month period, sent through HMRC-compatible software. " +
      "They are not tax returns and do not replace your year-end Self Assessment tax return (sometimes called a final declaration / year-end submission). " +
      "You still submit one tax return for the tax year and pay any tax due by the usual deadline. " +
      `Official guidance: ${MTD_QUARTERLY_NOT_RETURN.url}`
    );
  }

  if (/quarterly|quarter(ly)? update|year-?end|final declaration/i.test(lower)) {
    return (
      "Under Making Tax Digital for Income Tax, in-scope sole traders and landlords keep digital records and usually submit quarterly updates. " +
      "MTD quarterly updates do not replace your annual tax return. If you’re within MTD, you’ll also submit your tax return through compatible software. " +
      "SIMBA chat cannot file or submit to HMRC for you — TaxSimba’s accountant-led Simbian plans can support quarterly updates and year-end Self Assessment if you want a paid service (Xero for MTD workflows; TaxCalc for Self Assessment filing — the TaxSimba portal itself is not a direct HMRC filing integration). " +
      `Official overview: ${MTD_QUARTERLY_NOT_RETURN.url}`
    );
  }

  if (/can (you|simba) (file|submit)|submit.*(hmrc|quarterly)/i.test(lower)) {
    return (
      "No — SIMBA cannot file returns or submit Making Tax Digital updates to HMRC. " +
      "TaxSimba uses accountant-led workflows (Xero for MTD; TaxCalc for Self Assessment filing arrangements). " +
      "An authorised accountant/agent can submit quarterly updates and returns using compatible software. " +
      "I can explain the rules and help you choose an approved package, but submission is not done inside this chat."
    );
  }

  return null;
}
