/** Deterministic answers for MTD software / process questions (not eligibility). */

export function answerMtdOperationsQuestion(message: string): string | null {
  const lower = (message || "").toLowerCase();
  if (!/(mtd|making tax digital|simbian|xero)/i.test(lower)) return null;

  if (/xero|software|which software|do i need xero/i.test(lower)) {
    return (
      "For Making Tax Digital for Income Tax, you need compatible software and digital records. " +
      "TaxSimba’s Simbian plans include a Xero subscription in the monthly price " +
      "(Comply→Xero Simple, Growth→Xero Ignite, Elite→Xero Grow) — customers do not pay separately for that mapped licence. " +
      "Quarterly updates and year-end Self Assessment are included subject to documented customer responsibilities. " +
      "SIMBA itself does not submit your quarterly updates or returns to HMRC — a TaxSimba accountant leads those workflows using Xero. " +
      "Prices (VAT included): Simbian Comply £29.99, Growth £59.99, Elite £89.99 per month. " +
      "Review https://www.taxsimba.co.uk/making-tax-digital — or tell me your qualifying income and tax year if you’re checking eligibility."
    );
  }

  if (/quarterly|quarter(ly)? update|year-?end/i.test(lower)) {
    return (
      "Under Making Tax Digital for Income Tax, in-scope sole traders and landlords keep digital records and usually submit quarterly updates, " +
      "then a year-end/final declaration. TaxSimba Simbian plans include quarterly MTD updates and year-end Self Assessment prepared through accountant-led Xero workflows, " +
      "subject to documented customer responsibilities. SIMBA chat cannot file or submit to HMRC for you. " +
      "Official overview: https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax"
    );
  }

  if (/can (you|simba) (file|submit)|submit.*(hmrc|quarterly)/i.test(lower)) {
    return (
      "No — SIMBA cannot file returns or submit Making Tax Digital updates to HMRC. " +
      "TaxSimba uses accountant-led workflows (Xero for MTD; TaxCalc for Self Assessment filing arrangements). " +
      "I can explain the rules and help you choose an approved package, but submission is not done inside this chat."
    );
  }

  return null;
}
