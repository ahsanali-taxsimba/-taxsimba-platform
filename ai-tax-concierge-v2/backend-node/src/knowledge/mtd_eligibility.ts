/**
 * Deterministic Making Tax Digital for Income Tax eligibility.
 * Model output must not override these calculations when inputs are known.
 *
 * Official threshold wording uses "more than" (exclusive of the exact amount).
 * Source: GOV.UK — find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
 */

export type MtdBand = {
  id: "band_50k" | "band_30k" | "band_20k";
  threshold_gbp: number;
  basis_tax_year: string;
  commencement: string; // e.g. 6 April 2026
  commencement_iso: string;
};

export const MTD_BANDS: MtdBand[] = [
  {
    id: "band_50k",
    threshold_gbp: 50_000,
    basis_tax_year: "2024-25",
    commencement: "6 April 2026",
    commencement_iso: "2026-04-06",
  },
  {
    id: "band_30k",
    threshold_gbp: 30_000,
    basis_tax_year: "2025-26",
    commencement: "6 April 2027",
    commencement_iso: "2027-04-06",
  },
  {
    id: "band_20k",
    threshold_gbp: 20_000,
    basis_tax_year: "2026-27",
    commencement: "6 April 2028",
    commencement_iso: "2028-04-06",
  },
];

export const MTD_SOURCE_URL =
  "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax";

export type MtdEligibilityInput = {
  qualifyingIncomeGbp?: number | null;
  incomeIsProfitNotGross?: boolean;
  basisTaxYear?: string | null;
  payeOnly?: boolean;
  /** True when employment salary is also present but trading/property income exists. */
  payeAlsoPresent?: boolean;
  limitedCompany?: boolean;
  hasSelfEmploymentOrProperty?: boolean | null;
};

export type MtdEligibilityResult = {
  handled: boolean;
  needs_more_info: boolean;
  in_scope: boolean | null;
  commencement: string | null;
  band: MtdBand | null;
  reason: string;
  clarifying_question: string | null;
  customer_reply: string;
  confidence: "high" | "medium" | "low";
};

function parseAmount(text: string): number | null {
  const raw = text.toLowerCase();
  // Prefer explicit £ amounts first (with or without commas).
  const pound =
    raw.match(/£\s*([\d,]+(?:\.\d+)?)\s*k\b/) ||
    raw.match(/£\s*([\d,]+(?:\.\d+)?)/);
  if (pound) {
    let n = Number(pound[1]!.replace(/,/g, ""));
    if (pound[0]!.includes("k")) n *= 1000;
    if (Number.isFinite(n) && n >= 1000 && n <= 10_000_000) return n;
  }
  const kForm = raw.match(
    /\b(\d+(?:\.\d+)?)\s*k\b(?:\s*(?:qualifying income|turnover|income|profit))?/,
  );
  if (kForm) {
    const n = Number(kForm[1]) * 1000;
    if (Number.isFinite(n) && n >= 1000 && n <= 10_000_000) return n;
  }
  const plain = raw.match(
    /(?:qualifying income|turnover|gross(?: income)?|income(?: was| is| of)?)\D{0,20}([\d,]+(?:\.\d+)?)/,
  );
  if (plain) {
    let n = Number(plain[1]!.replace(/,/g, ""));
    if (n < 1000 && /thousand/.test(raw)) n *= 1000;
    if (Number.isFinite(n) && n >= 1000 && n <= 10_000_000) return n;
  }
  return null;
}

function detectBasisYear(text: string): string | null {
  const lower = text.toLowerCase();
  const patterns: Array<[RegExp, string]> = [
    [/2024\s*[-/–to]+\s*2025|2024-25|tax year 2024/, "2024-25"],
    [/2025\s*[-/–to]+\s*2026|2025-26|tax year 2025/, "2025-26"],
    [/2026\s*[-/–to]+\s*2027|2026-27|tax year 2026/, "2026-27"],
  ];
  for (const [re, year] of patterns) {
    if (re.test(lower)) return year;
  }
  return null;
}

export function isMtdEligibilityQuestion(message: string): boolean {
  const lower = (message || "").toLowerCase();
  if (!/(mtd|making tax digital)/i.test(lower)) return false;
  // Software / process / package questions are NOT eligibility calculations.
  if (
    /(xero|software|quarterly update|year-?end|how (do|does|to)|what (is|are|does)|include|simbian|file|submit|bookkeep)/i.test(
      lower,
    )
  ) {
    return false;
  }
  // CIS / construction package framing — handle via recommendations, not bare eligibility ask.
  if (
    /(cis|construction|subcontract)/i.test(lower) &&
    !/(£|qualifying income|turnover|threshold|\d{2},?\d{3})/i.test(lower)
  ) {
    return false;
  }
  return /(need|eligib|when|start|from|apply|threshold|qualifying|do i|am i|required|have to|should i|subscription|plan|buy)/i.test(
    lower,
  );
}

function parseTaggedAmount(message: string, tagRe: RegExp): number | null {
  const m = message.toLowerCase().match(tagRe);
  if (!m) return null;
  let n = Number(String(m[1]).replace(/,/g, ""));
  if (m[0].includes("k") && n < 1000) n *= 1000;
  // Reject tax-year fragments mistaken for money (e.g. 2025 from 2025-26).
  if (n >= 1900 && n <= 2100) return null;
  if (Number.isFinite(n) && n >= 1000 && n <= 10_000_000) return n;
  return null;
}

export function extractMtdEligibilityInput(
  message: string,
): MtdEligibilityInput {
  const lower = (message || "").toLowerCase();
  const hasTradingOrProperty =
    /(self-?employ|sole[- ]?trader|landlord|property income|freelance|rental income|\brental\b|trading income|side hustle|side income)/i.test(
      lower,
    ) && !/(limited company|ltd company|company turnover|corporation tax)/i.test(lower);
  const hasPaye = /\bpaye\b|\bsalary\b|\bemploy(ed|ment)\b/.test(lower);
  const payeOnly =
    hasPaye &&
    /\bonly\b/.test(lower) &&
    !hasTradingOrProperty;
  const limitedCompany =
    /(limited company|ltd company|\bltd\b|my company|we're a company|we are a company|limited co\b|company turnover|company director|\bdirector\b)/i.test(
      lower,
    ) && !hasTradingOrProperty;

  const incomeIsProfitNotGross =
    /\bprofit\b/.test(lower) &&
    !/\b(turnover|gross|qualifying income|before expenses)\b/.test(lower);

  // Prefer trading/property amounts when PAYE salary is also mentioned —
  // PAYE must not count toward MTD qualifying income.
  // Prefer amount-before-label (avoids capturing tax-year digits after the label).
  const tradingAmt =
    parseTaggedAmount(
      message,
      /£\s*([\d,]+(?:\.\d+)?)\s*k?(?=\s*(?:sole[- ]?trader|self-?employ|trading|turnover|freelance|property|rental|qualifying|landlord))/i,
    ) ||
    parseTaggedAmount(
      message,
      /(?:sole[- ]?trader|self-?employ(?:ed|ment)?|trading|turnover|freelance|side (?:hustle|income)|property|rental|landlord)[^£\d]{0,24}£\s*([\d,]+(?:\.\d+)?)\s*k?\b/i,
    );

  const payeAmt =
    parseTaggedAmount(
      message,
      /(?:paye|salary|employment)[^£\d]{0,48}£?\s*([\d,]+(?:\.\d+)?)\s*k?\b/i,
    ) ||
    parseTaggedAmount(
      message,
      /£?\s*([\d,]+(?:\.\d+)?)\s*k?(?=\s*(?:paye|salary|employment))/i,
    );

  let amount = tradingAmt;
  if (amount == null && !(hasPaye && hasTradingOrProperty)) {
    amount = parseAmount(message);
  }
  // If both PAYE and trading present but only one amount parsed as generic, avoid
  // treating a lone PAYE figure as qualifying income.
  if (
    amount == null &&
    hasPaye &&
    hasTradingOrProperty &&
    payeAmt != null &&
    tradingAmt == null
  ) {
    amount = null;
  }

  const basisTaxYear = detectBasisYear(message);

  let hasSelfEmploymentOrProperty: boolean | null = null;
  if (payeOnly) hasSelfEmploymentOrProperty = false;
  else if (hasTradingOrProperty) hasSelfEmploymentOrProperty = true;

  return {
    qualifyingIncomeGbp: amount,
    incomeIsProfitNotGross,
    basisTaxYear,
    payeOnly,
    payeAlsoPresent: hasPaye && hasTradingOrProperty,
    limitedCompany,
    hasSelfEmploymentOrProperty,
  };
}

function payeExclusionNote(input: MtdEligibilityInput): string {
  return input.payeAlsoPresent
    ? " Your PAYE/employment salary is not included in qualifying income for MTD for Income Tax."
    : "";
}

function bandForYear(basisTaxYear: string): MtdBand | null {
  return MTD_BANDS.find((b) => b.basis_tax_year === basisTaxYear) || null;
}

function inferBandFromAmount(amount: number): MtdBand | null {
  // Without a stated basis year, map amount to the band it would trigger,
  // but require year confirmation for a definitive start date when ambiguous.
  if (amount > 50_000) return MTD_BANDS[0]!;
  if (amount > 30_000) return MTD_BANDS[1]!;
  if (amount > 20_000) return MTD_BANDS[2]!;
  return null;
}

export function evaluateMtdEligibility(
  input: MtdEligibilityInput,
): MtdEligibilityResult {
  if (input.payeOnly) {
    return {
      handled: true,
      needs_more_info: false,
      in_scope: false,
      commencement: null,
      band: null,
      reason: "PAYE-only employment income is not qualifying income for MTD for Income Tax.",
      clarifying_question: null,
      confidence: "high",
      customer_reply:
        "If your only income is PAYE employment, Making Tax Digital for Income Tax does not apply to you. " +
        "MTD for Income Tax is aimed at sole traders and landlords in Self Assessment with qualifying income above the thresholds. " +
        "Employment (PAYE) does not count towards qualifying income.\n\n" +
        `Official guidance: ${MTD_SOURCE_URL}`,
    };
  }

  if (input.limitedCompany) {
    return {
      handled: true,
      needs_more_info: false,
      in_scope: false,
      commencement: null,
      band: null,
      reason: "Limited companies are outside MTD for Income Tax (ITSA) sole trader/landlord rules.",
      clarifying_question:
        "Are you asking about your company, or about self-employment or property income in Self Assessment?",
      confidence: "high",
      customer_reply:
        "Making Tax Digital for Income Tax (for individuals) applies to sole traders and landlords in Self Assessment, not to limited companies as companies. " +
        "Company filing and MTD for VAT/Corporation Tax are separate. " +
        "If you also have self-employment or property income personally, tell me that qualifying turnover and tax year and I can check the individual MTD rules.\n\n" +
        `Official guidance: ${MTD_SOURCE_URL}`,
    };
  }

  if (input.incomeIsProfitNotGross && input.qualifyingIncomeGbp != null) {
    return {
      handled: true,
      needs_more_info: true,
      in_scope: null,
      commencement: null,
      band: null,
      reason: "Profit is not qualifying income; need gross/turnover.",
      clarifying_question:
        "What was your total self-employment and property income before expenses (turnover/gross) for the relevant tax year?",
      confidence: "high",
      customer_reply:
        "For Making Tax Digital, HMRC uses qualifying income — that is turnover/gross from self-employment and property before expenses, not profit after expenses. " +
        "I shouldn’t decide your start date from a profit figure alone.\n\n" +
        "What was your total self-employment and property income before expenses for the relevant tax year?",
    };
  }

  if (input.qualifyingIncomeGbp == null) {
    return {
      handled: true,
      needs_more_info: true,
      in_scope: null,
      commencement: null,
      band: null,
      reason: "Missing qualifying income amount.",
      clarifying_question:
        "What was your qualifying income (self-employment and property turnover before expenses) and for which tax year?",
      confidence: "medium",
      customer_reply: input.payeAlsoPresent
        ? "For Making Tax Digital for Income Tax, PAYE/employment salary does not count. " +
          "I need your self-employment and/or property income before expenses (turnover/gross) for a specific tax year.\n\n" +
          "What was that trading/property turnover, and which tax year was it for?"
        : "I can work out your Making Tax Digital start date once I know your qualifying income. " +
          "That’s total self-employment and property income before expenses for a specific tax year — not profit, and not PAYE salary.\n\n" +
          "What was that amount, and which tax year was it for (for example 2024-25)?",
    };
  }

  const amount = input.qualifyingIncomeGbp;
  const year = input.basisTaxYear;

  // Exact threshold: NOT "more than"
  const exactHit = MTD_BANDS.find((b) => amount === b.threshold_gbp);
  if (exactHit && (!year || year === exactHit.basis_tax_year)) {
    return {
      handled: true,
      needs_more_info: false,
      in_scope: false,
      commencement: null,
      band: exactHit,
      reason: `Exact £${amount.toLocaleString("en-GB")} is not more than the £${exactHit.threshold_gbp.toLocaleString("en-GB")} threshold.`,
      clarifying_question: null,
      confidence: "high",
      customer_reply:
        `No — qualifying income of exactly £${amount.toLocaleString("en-GB")} for ${exactHit.basis_tax_year} does not bring you into Making Tax Digital under that band. ` +
        `HMRC’s wording is “more than £${exactHit.threshold_gbp.toLocaleString("en-GB")}”, so the threshold is exclusive of the exact amount. ` +
        `The ${exactHit.commencement} start date applies only if qualifying income was more than £${exactHit.threshold_gbp.toLocaleString("en-GB")} for ${exactHit.basis_tax_year}.` +
        `${payeExclusionNote(input)}\n\n` +
        `Official guidance: ${MTD_SOURCE_URL}`,
    };
  }

  if (year) {
    const band = bandForYear(year);
    if (!band) {
      return {
        handled: true,
        needs_more_info: true,
        in_scope: null,
        commencement: null,
        band: null,
        reason: "Unrecognised tax year for MTD bands.",
        clarifying_question: "Which tax year should we use for qualifying income?",
        confidence: "medium",
        customer_reply:
          "Please confirm the tax year for your qualifying income (2024-25, 2025-26 or 2026-27) so I can apply the correct Making Tax Digital band.",
      };
    }
    const inScope = amount > band.threshold_gbp;
    if (inScope) {
      return {
        handled: true,
        needs_more_info: false,
        in_scope: true,
        commencement: band.commencement,
        band,
        reason: `>£${band.threshold_gbp} in ${band.basis_tax_year}`,
        clarifying_question: null,
        confidence: "high",
        customer_reply:
          `Yes — if your qualifying income was more than £${band.threshold_gbp.toLocaleString("en-GB")} for ${band.basis_tax_year}, ` +
          `you need to use Making Tax Digital for Income Tax from ${band.commencement}. ` +
          `Qualifying income means self-employment and property income before expenses (turnover/gross), not profit.` +
          `${payeExclusionNote(input)}\n\n` +
          `Official guidance: ${MTD_SOURCE_URL}`,
      };
    }
    // Below this year's band — check if a later band could still apply
    return {
      handled: true,
      needs_more_info: false,
      in_scope: false,
      commencement: null,
      band,
      reason: `£${amount} is not more than £${band.threshold_gbp} for ${band.basis_tax_year}`,
      clarifying_question: null,
      confidence: "high",
      customer_reply:
        `Based on qualifying income of £${amount.toLocaleString("en-GB")} for ${band.basis_tax_year}, ` +
        `you are not brought into Making Tax Digital by the £${band.threshold_gbp.toLocaleString("en-GB")} / ${band.commencement} band, ` +
        `because that band needs income of more than £${band.threshold_gbp.toLocaleString("en-GB")}. ` +
        `Later bands use different tax years and thresholds (£30,000 → ${MTD_BANDS[1]!.commencement}; £20,000 → ${MTD_BANDS[2]!.commencement}).` +
        `${payeExclusionNote(input)}\n\n` +
        `Official guidance: ${MTD_SOURCE_URL}`,
    };
  }

  // Amount known, year unknown
  if (amount <= 20_000) {
    return {
      handled: true,
      needs_more_info: false,
      in_scope: false,
      commencement: null,
      band: null,
      reason: "At or below £20,000 — not more than any current MTD ITSA band threshold.",
      clarifying_question: null,
      confidence: "high",
      customer_reply:
        `With qualifying income of £${amount.toLocaleString("en-GB")}, you are not above the current Making Tax Digital Income Tax thresholds that use “more than £20,000 / £30,000 / £50,000”. ` +
        `Confirm the tax year if your income changes, and remember the test uses turnover/gross before expenses.` +
        `${payeExclusionNote(input)}\n\n` +
        `Official guidance: ${MTD_SOURCE_URL}`,
    };
  }

  const inferred = inferBandFromAmount(amount);
  return {
    handled: true,
    needs_more_info: true,
    in_scope: null,
    commencement: inferred?.commencement ?? null,
    band: inferred,
    reason: "Amount known but basis tax year missing.",
    clarifying_question:
      "Which tax year is that qualifying income for — 2024-25, 2025-26 or 2026-27?",
    confidence: "medium",
    customer_reply:
      `Thanks — £${amount.toLocaleString("en-GB")} is useful. ` +
      `To give the correct Making Tax Digital start date I need the tax year that figure relates to, because each band uses a different year:\n` +
      `• more than £50,000 in 2024-25 → from 6 April 2026\n` +
      `• more than £30,000 in 2025-26 → from 6 April 2027\n` +
      `• more than £20,000 in 2026-27 → from 6 April 2028\n\n` +
      `Which tax year is your figure for?`,
  };
}

export function answerMtdEligibility(message: string): MtdEligibilityResult | null {
  if (!isMtdEligibilityQuestion(message)) return null;
  const input = extractMtdEligibilityInput(message);
  return evaluateMtdEligibility(input);
}
