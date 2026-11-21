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
  /** true/false known; null = must clarify; undefined = not asserted */
  hasSelfEmploymentOrProperty?: boolean | null;
  /** Customer said “more than / over / above £X” (not “exactly £X”). */
  amountStatedAsMoreThan?: boolean;
  /** Customer said “exactly £X”. */
  amountStatedAsExact?: boolean;
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
    [/2024\s*[-/–to]+\s*2025|2024\s*[-/]\s*25|\b24\s*[/]\s*25\b|tax year 2024/, "2024-25"],
    [/2025\s*[-/–to]+\s*2026|2025\s*[-/]\s*26|\b25\s*[/]\s*26\b|tax year 2025/, "2025-26"],
    [/2026\s*[-/–to]+\s*2027|2026\s*[-/]\s*27|\b26\s*[/]\s*27\b|tax year 2026/, "2026-27"],
  ];
  for (const [re, year] of patterns) {
    if (re.test(lower)) return year;
  }
  return null;
}

export function isMtdEligibilityQuestion(message: string): boolean {
  const lower = (message || "").toLowerCase();
  // Implicit MTD band questions: exact/over £50k/£30k/£20k + tax year + threshold wording.
  const implicitMtdBand =
    /(over|above|more than).{0,24}threshold|threshold.{0,24}(over|above)|exact(?:ly)?.{0,12}£?\s*(50|30|20),?000|£?\s*(50|30|20),?000.{0,20}exact/i.test(
      lower,
    ) &&
    /(2024\s*[-/]?\s*25|2025\s*[-/]?\s*26|2026\s*[-/]?\s*27|2024\/25|2025\/26)/i.test(
      lower,
    );
  // Rent + self-employment “are they combined?” is an MTD QI question even
  // without the letters MTD.
  const combinedQiAsk =
    /(rent|rental|property)/i.test(lower) &&
    /(self-?employ|freelance|sole[- ]?trader|trading|turnover)/i.test(lower) &&
    /(combin|together|add (them|both)|total)/i.test(lower);
  // Profit vs turnover / which figure counts — QI definition without needing “MTD”.
  const profitVsTurnoverAsk =
    /\bprofit\b/.test(lower) &&
    /\b(turnover|gross)\b/.test(lower) &&
    /(which (number|amount|figure) (matters|counts)|what (matters|counts)|qualifying)/i.test(
      lower,
    );
  // Two basis years + start-date ask (e.g. £55k in 2025/26 but £20k in 2024/25).
  const multiYearStartAsk =
    /(which start|start date|when (do|should) i (start|use)|assessed)/i.test(
      lower,
    ) &&
    /2024\s*[-/]?\s*25/.test(lower) &&
    /2025\s*[-/]?\s*26/.test(lower);
  // “qi more than £50,000 in 2024-25 — start when?” without spelling MTD.
  const qiBandAsk =
    /\b(qi|qualifying income)\b/.test(lower) &&
    /(more than|over|above|exactly)/i.test(lower) &&
    /(2024\s*[-/]?\s*25|2025\s*[-/]?\s*26|2026\s*[-/]?\s*27)/i.test(lower);
  if (
    !/(mtd|making tax digital|digital tax thing|digital tax)/i.test(lower) &&
    !implicitMtdBand &&
    !combinedQiAsk &&
    !profitVsTurnoverAsk &&
    !multiYearStartAsk &&
    !qiBandAsk
  ) {
    return false;
  }
  // Software / process / package questions are NOT eligibility calculations
  // (educational “what is MTD / quarterly updates” handled by clarifier).
  if (
    /(xero|software|year-?end|how (do|does|to)|what (is|are|does)|include|simbian|\bfile\b|\bsubmit\b|bookkeep)/i.test(
      lower,
    ) &&
    !/(paye|salary|£|turnover|qualifying|threshold|rent|property|freelance)/i.test(
      lower,
    )
  ) {
    return false;
  }
  if (
    /quarterly updates?|what does quarterly/i.test(lower) &&
    !/(£|paye|turnover|qualifying|threshold|rent|property)/i.test(lower)
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
  const intentVerb =
    /(need|eligib|when|start|from|apply|threshold|qualifying|do i|am i|required|have to|should i|subscription|plan|buy|do not add|don'?t add|count (them |it )?(toward|towards|for)|include.*(paye|salary)|paye only|making tax digital\?|\bmtd\?|which (number|amount|figure) (matters|counts)|are they combined|combine|mortgage interest reduce)/i.test(
      lower,
    );
  // Income figure + MTD/digital-tax mention is enough even without “do I need”
  const figurePlusMtd =
    /(£\s*[\d,]+|\b\d{2,3}\s*k\b|turnover|qualifying income|paye only)/i.test(
      lower,
    ) && /(mtd|making tax digital|digital tax)/i.test(lower);
  return intentVerb || figurePlusMtd;
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
    /(self-?employ|sole[- ]?trader|landlord|property income|freelance|rental income|\brental\b|\brent\b|trading income|side hustle|side income)/i.test(
      lower,
    ) && !/(limited company|ltd company|company turnover|corporation tax)/i.test(lower);
  // Do not treat “self-employment” as PAYE employment.
  const hasPaye =
    /\bpaye\b|\bsalary\b/.test(lower) ||
    /(?<!self-)\bemploy(ed|ment)\b/.test(lower);
  const payeOnly =
    hasPaye &&
    /\bonly\b/.test(lower) &&
    !hasTradingOrProperty;
  const limitedCompany =
    /(limited company|ltd company|\bltd\b|my company|we're a company|we are a company|limited co\b|company turnover|company director|\bdirector\b)/i.test(
      lower,
    ) && !hasTradingOrProperty;

  // Profit alone is not QI — but if turnover/gross is also stated, use that.
  const hasTurnoverOrGross = /\b(turnover|gross|qualifying income|before expenses)\b/.test(
    lower,
  );
  const incomeIsProfitNotGross = /\bprofit\b/.test(lower) && !hasTurnoverOrGross;

  // Prefer trading/property amounts when PAYE salary is also mentioned —
  // PAYE must not count toward MTD qualifying income.
  // Prefer amount-before-label (avoids capturing tax-year digits after the label).
  const seAmt =
    parseTaggedAmount(
      message,
      /£\s*([\d,]+(?:\.\d+)?)\s*k?(?=\s*(?:sole[- ]?trader|self-?employ|trading|turnover|freelance|qualifying|\bqi\b))/i,
    ) ||
    parseTaggedAmount(
      message,
      /(?:sole[- ]?trader|self-?employ(?:ed|ment)?|trading|turnover|freelance|side (?:hustle|income)|qualifying income|\bqi\b)[^£\d]{0,24}£\s*([\d,]+(?:\.\d+)?)\s*k?\b/i,
    ) ||
    // “qi more than £50000 in 2024-25”
    parseTaggedAmount(
      message,
      /(?:qi|qualifying income)[^£\d]{0,40}£?\s*([\d,]+(?:\.\d+)?)\s*k?\b/i,
    );

  const propertyAmt =
    parseTaggedAmount(
      message,
      /£\s*([\d,]+(?:\.\d+)?)\s*k?(?=\s*(?:property|rental|\brent\b|landlord))/i,
    ) ||
    parseTaggedAmount(
      message,
      /(?:property|rental|\brent\b|landlord)[^£\d]{0,24}£\s*([\d,]+(?:\.\d+)?)\s*k?\b/i,
    );

  const tradingAmt =
    seAmt != null && propertyAmt != null
      ? seAmt + propertyAmt
      : seAmt ?? propertyAmt;

  const payeAmt =
    parseTaggedAmount(
      message,
      /(?:paye|salary|employment)[^£\d]{0,48}£?\s*([\d,]+(?:\.\d+)?)\s*k?\b/i,
    ) ||
    parseTaggedAmount(
      message,
      /£?\s*([\d,]+(?:\.\d+)?)\s*k?(?=\s*(?:paye|salary|employment))/i,
    );

  // Prefer explicit turnover when both profit and turnover are stated.
  const turnoverOnly =
    parseTaggedAmount(
      message,
      /£\s*([\d,]+(?:\.\d+)?)\s*k?(?=\s*(?:turnover|gross|before expenses))/i,
    ) ||
    parseTaggedAmount(
      message,
      /(?:turnover|gross)[^£\d]{0,24}£\s*([\d,]+(?:\.\d+)?)\s*k?\b/i,
    );

  let amount = turnoverOnly ?? tradingAmt;
  // Never treat a bare “I earn £X” figure as MTD qualifying income unless
  // trading/property (or explicit qualifying income) is stated.
  const statedAsQualifying =
    /\b(qualifying income|\bqi\b|turnover|before expenses)\b/i.test(lower);
  // “I earn £50,000 exactly in 2024/25 — over the threshold?” is an MTD band
  // question, not an ambiguous bare total.
  const explicitBandQuestion =
    /\b(exact(?:ly)?|more than|over|above)\b/i.test(lower) &&
    /(threshold|mtd|making tax digital|2024\s*[-/]?\s*25|2025\s*[-/]?\s*26|2026\s*[-/]?\s*27)/i.test(
      lower,
    );
  const bareEarnOnly =
    /\bi earn\b/i.test(lower) &&
    !hasTradingOrProperty &&
    !statedAsQualifying &&
    !explicitBandQuestion;
  if (
    amount == null &&
    !(hasPaye && hasTradingOrProperty) &&
    !bareEarnOnly &&
    (hasTradingOrProperty || statedAsQualifying || explicitBandQuestion)
  ) {
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
  // Bare earnings + MTD question: clear any accidentally parsed amount.
  if (bareEarnOnly) {
    amount = null;
  }

  const basisTaxYear = detectBasisYear(message);

  // undefined = not asserted (evaluate may treat stated amount as QI);
  // null = explicitly unknown — must clarify before applying bands.
  let hasSelfEmploymentOrProperty: boolean | null | undefined = undefined;
  if (payeOnly) hasSelfEmploymentOrProperty = false;
  else if (hasTradingOrProperty || statedAsQualifying || explicitBandQuestion) {
    hasSelfEmploymentOrProperty = true;
  } else if (bareEarnOnly) {
    hasSelfEmploymentOrProperty = null;
  } else if (
    hasPaye &&
    !hasTradingOrProperty &&
    !statedAsQualifying &&
    /(mtd|making tax digital|digital tax)/i.test(lower) &&
    /(£|\d+\s*k\b)/i.test(lower)
  ) {
    // PAYE mentioned with a figure but no trading/property — ask.
    hasSelfEmploymentOrProperty = null;
  } else if (
    !hasPaye &&
    !hasTradingOrProperty &&
    !statedAsQualifying &&
    /(mtd|making tax digital|digital tax)/i.test(lower) &&
    /(£|\d+\s*k\b)/i.test(lower) &&
    amount == null
  ) {
    // Ambiguous total with no QI label — ask.
    hasSelfEmploymentOrProperty = null;
  }

  const amountStatedAsExact =
    /\b(exact(?:ly)?|precisely)\b/i.test(lower) && amount != null;
  const amountStatedAsMoreThan =
    amount != null &&
    !amountStatedAsExact &&
    /\b(more than|over|above|greater than)\s*£?\s*[\d,]+/i.test(message);

  return {
    qualifyingIncomeGbp: amount,
    incomeIsProfitNotGross,
    basisTaxYear,
    payeOnly,
    payeAlsoPresent: hasPaye && hasTradingOrProperty,
    limitedCompany,
    hasSelfEmploymentOrProperty,
    amountStatedAsMoreThan,
    amountStatedAsExact,
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

  // Explicitly unknown income type (e.g. “I earn £50k. MTD?”) — do not
  // treat a bare total as qualifying income. Direct evaluate() calls that omit
  // hasSelfEmploymentOrProperty (undefined) may proceed with the stated amount.
  if (input.hasSelfEmploymentOrProperty === null) {
    return {
      handled: true,
      needs_more_info: true,
      in_scope: null,
      commencement: null,
      band: null,
      reason: "Income type unknown — cannot treat figure as MTD qualifying income.",
      clarifying_question:
        "Is that figure PAYE salary, self-employment turnover, property rent, or a mix — and which tax year?",
      confidence: "high",
      customer_reply:
        "I can’t decide Making Tax Digital from a total income figure alone. " +
        "MTD for Income Tax uses qualifying income — self-employment and property turnover before expenses — and PAYE salary does not count. " +
        "Is your figure PAYE employment salary, self-employment turnover, property rent before expenses, or a mix — and which tax year?\n\n" +
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

  // Exact threshold: NOT "more than" — only when the customer did NOT say “more than/over/above £X”.
  // “more than £50,000” parses as 50000 but must NOT use the exclusive-boundary refusal.
  // Exact threshold answers require an explicit basis tax year — do not invent the year.
  if (!year && amount != null) {
    const nearBand = MTD_BANDS.find((b) => amount === b.threshold_gbp);
    if (nearBand || amount > 20_000) {
      return {
        handled: true,
        needs_more_info: true,
        in_scope: null,
        commencement: null,
        band: nearBand || inferBandFromAmount(amount),
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
  }

  const exactHit = MTD_BANDS.find((b) => amount === b.threshold_gbp);
  if (
    exactHit &&
    year === exactHit.basis_tax_year &&
    !input.amountStatedAsMoreThan
  ) {
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
    const inScope =
      amount > band.threshold_gbp ||
      (input.amountStatedAsMoreThan === true &&
        amount === band.threshold_gbp);
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
          `Qualifying income means self-employment and property income before expenses (turnover/gross), not profit. ` +
          `Property and self-employment income is also usually reported through Self Assessment — MTD does not replace that annual return.` +
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
        `Later bands use different tax years and thresholds (£30,000 → ${MTD_BANDS[1]!.commencement}; £20,000 → ${MTD_BANDS[2]!.commencement}). ` +
        `You may still need Self Assessment for property or trading income even when MTD does not yet apply.` +
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

function conversationContextText(
  message: string,
  history?: Array<{ role: string; content: string }> | null,
): string {
  const prior = (history || [])
    .filter((h) => h.role === "user" && h.content?.trim())
    .map((h) => h.content)
    .join("\n");
  return prior ? `${prior}\n${message}` : message;
}

/** Profit vs turnover — QI uses turnover/gross, not profit (and not the VAT test). */
function answerProfitVsTurnover(message: string): MtdEligibilityResult | null {
  const lower = (message || "").toLowerCase();
  if (
    !/\bprofit\b/.test(lower) ||
    !/\b(turnover|gross)\b/.test(lower) ||
    !/(which (number|amount|figure) (matters|counts)|what (matters|counts)|qualifying)/i.test(
      lower,
    )
  ) {
    return null;
  }
  const turnover =
    parseTaggedAmount(
      message,
      /£\s*([\d,]+(?:\.\d+)?)\s*k?(?=\s*(?:turnover|gross|before expenses))/i,
    ) ||
    parseTaggedAmount(
      message,
      /(?:turnover|gross)[^£\d]{0,24}£\s*([\d,]+(?:\.\d+)?)\s*k?\b/i,
    );
  const year = detectBasisYear(message);
  let bandNote = "";
  if (turnover != null && year) {
    const band = bandForYear(year);
    if (band) {
      const inScope = turnover > band.threshold_gbp;
      bandNote = inScope
        ? ` Using turnover of £${turnover.toLocaleString("en-GB")} for ${year}, that is more than £${band.threshold_gbp.toLocaleString("en-GB")}, so Making Tax Digital for Income Tax would usually start from ${band.commencement} (if you are a sole trader/landlord in Self Assessment).`
        : ` Using turnover of £${turnover.toLocaleString("en-GB")} for ${year}, that is not more than £${band.threshold_gbp.toLocaleString("en-GB")}, so that year’s MTD band would not bring you in.`;
    }
  } else if (turnover != null) {
    bandNote =
      ` Your stated turnover of £${turnover.toLocaleString("en-GB")} is the figure to map to the MTD bands once the basis tax year is confirmed.`;
  }
  return {
    handled: true,
    needs_more_info: false,
    in_scope: turnover != null && year
      ? turnover > (bandForYear(year)?.threshold_gbp ?? Infinity)
      : null,
    commencement:
      turnover != null && year && turnover > (bandForYear(year)?.threshold_gbp ?? Infinity)
        ? bandForYear(year)!.commencement
        : null,
    band: year ? bandForYear(year) : null,
    reason: "MTD QI uses turnover/gross, not profit",
    clarifying_question: null,
    confidence: "high",
    customer_reply:
      "For Making Tax Digital for Income Tax, qualifying income uses turnover/gross from self-employment and property before expenses — not profit after expenses. " +
      "So the turnover figure is the one that matters for the MTD threshold test (Self Assessment taxable profit is a different question)." +
      bandNote +
      " VAT is a separate regime with its own rolling 12-month taxable-turnover rules — do not treat the MTD test as the VAT test.\n\n" +
      `Official guidance: https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax`,
  };
}

/** Multi-year QI comparison: “£55k in 2025-26 but £20k in 2024-25 — which start date?” */
function answerMultiYearComparison(message: string): MtdEligibilityResult | null {
  const lower = (message || "").toLowerCase();
  if (
    !/(which start|which year|when (do|should) i start|start date|assessed)/i.test(
      lower,
    )
  ) {
    return null;
  }
  const yearAmounts: Array<{ year: string; amount: number }> = [];
  const patterns: Array<[RegExp, string]> = [
    [
      /£\s*([\d,]+)\s*k?\b[^.]{0,40}(?:in |for )?(?:the )?2024\s*[-/]?\s*25|2024\s*[-/]?\s*25[^£]{0,40}£\s*([\d,]+)\s*k?\b/i,
      "2024-25",
    ],
    [
      /£\s*([\d,]+)\s*k?\b[^.]{0,40}(?:in |for )?(?:the )?2025\s*[-/]?\s*26|2025\s*[-/]?\s*26[^£]{0,40}£\s*([\d,]+)\s*k?\b/i,
      "2025-26",
    ],
    [
      /£\s*([\d,]+)\s*k?\b[^.]{0,40}(?:in |for )?(?:the )?2026\s*[-/]?\s*27|2026\s*[-/]?\s*27[^£]{0,40}£\s*([\d,]+)\s*k?\b/i,
      "2026-27",
    ],
  ];
  // Simpler: "£55,000 in 2025/26" / "£20,000 in 2024/25"
  for (const m of message.matchAll(
    /£\s*([\d,]+(?:\.\d+)?)\s*k?\b[^\n.]{0,30}?(?:in |for )?(?:the )?(2024\s*[-/]?\s*25|2025\s*[-/]?\s*26|2026\s*[-/]?\s*27)/gi,
  )) {
    let n = Number(m[1]!.replace(/,/g, ""));
    if (/k/i.test(m[0]) && n < 1000) n *= 1000;
    const rawY = m[2]!.replace(/\s/g, "");
    const year = rawY.includes("2024")
      ? "2024-25"
      : rawY.includes("2025")
        ? "2025-26"
        : "2026-27";
    if (Number.isFinite(n)) yearAmounts.push({ year, amount: n });
  }
  // Also "only £20,000 in 2024/25"
  for (const m of message.matchAll(
    /(2024\s*[-/]?\s*25|2025\s*[-/]?\s*26|2026\s*[-/]?\s*27)[^\n£]{0,40}£\s*([\d,]+(?:\.\d+)?)\s*k?\b/gi,
  )) {
    let n = Number(m[2]!.replace(/,/g, ""));
    if (/k/i.test(m[0]) && n < 1000) n *= 1000;
    const rawY = m[1]!.replace(/\s/g, "");
    const year = rawY.includes("2024")
      ? "2024-25"
      : rawY.includes("2025")
        ? "2025-26"
        : "2026-27";
    if (Number.isFinite(n) && !yearAmounts.some((y) => y.year === year)) {
      yearAmounts.push({ year, amount: n });
    }
  }
  if (yearAmounts.length < 2) return null;

  const lines: string[] = [];
  for (const { year, amount } of yearAmounts) {
    const band = bandForYear(year);
    if (!band) continue;
    const inScope = amount > band.threshold_gbp;
    lines.push(
      `• ${year}: £${amount.toLocaleString("en-GB")} is ${inScope ? "more than" : "not more than"} £${band.threshold_gbp.toLocaleString("en-GB")} → ${inScope ? `start from ${band.commencement}` : `not brought in by that year’s band`}`,
    );
  }
  if (!lines.length) return null;
  return {
    handled: true,
    needs_more_info: false,
    in_scope: yearAmounts.some((y) => {
      const b = bandForYear(y.year);
      return b != null && y.amount > b.threshold_gbp;
    }),
    commencement: null,
    band: null,
    reason: "Multi-year QI comparison",
    clarifying_question: null,
    confidence: "high",
    customer_reply:
      "Making Tax Digital start dates depend on qualifying income for a specific basis tax year — you apply each year to its own band:\n" +
      lines.join("\n") +
      "\n\nQualifying income is self-employment and property turnover before expenses (combined), not PAYE salary.\n\n" +
      `Official guidance: ${MTD_SOURCE_URL}`,
  };
}

export function answerMtdEligibility(
  message: string,
  history?: Array<{ role: string; content: string }> | null,
): MtdEligibilityResult | null {
  if (!isMtdEligibilityQuestion(message)) return null;
  const lowerMsg = (message || "").toLowerCase();
  // Educational band / commencement questions (“what about the £20,000 MTD
  // threshold and April 2028?”) — explain published bands without treating the
  // threshold figure as the customer’s personal qualifying income.
  // Do NOT treat personal QI statements (“qualifying income was more than £X…”)
  // as educational — those must use the exclusive threshold calculation.
  const personalQiStatement =
    /(qualifying income|turnover|gross income).{0,48}(was|is|of)|was (more than|over|above)|i (earn|made|have|got)|my (qi|qualifying|turnover|income)/i.test(
      lowerMsg,
    );
  if (
    !personalQiStatement &&
    /(threshold|start date|remind me|what about the|when (do|does|did) .{0,40}start)/i.test(
      lowerMsg,
    ) &&
    /(april 202[6-9]|£\s*20,?000|£\s*30,?000|£\s*50,?000|20k|30k|50k)/i.test(
      lowerMsg,
    )
  ) {
    const lines = MTD_BANDS.map(
      (b) =>
        `• more than £${b.threshold_gbp.toLocaleString("en-GB")} in ${b.basis_tax_year} → from ${b.commencement}`,
    );
    return {
      handled: true,
      needs_more_info: false,
      in_scope: null,
      commencement: null,
      band: null,
      reason: "Educational MTD band / commencement explanation",
      clarifying_question: null,
      confidence: "high",
      customer_reply:
        "Making Tax Digital for Income Tax uses published bands of qualifying income (self-employment and property turnover before expenses, not PAYE salary):\n" +
        lines.join("\n") +
        "\n\nSo the £20,000 band uses basis year 2026-27 and starts from 6 April 2028; the £30,000 band starts 6 April 2027; the £50,000 band starts 6 April 2026.\n\n" +
        `Official guidance: ${MTD_SOURCE_URL}`,
    };
  }
  const profitTurnover = answerProfitVsTurnover(message);
  if (profitTurnover) return profitTurnover;
  const multi = answerMultiYearComparison(message);
  if (multi) return multi;
  // Prefer current message for “more than / exactly” flags; merge history for amount/year recall.
  const ctx = conversationContextText(message, history);
  const fromMessage = extractMtdEligibilityInput(message);
  const fromCtx = extractMtdEligibilityInput(ctx);
  // Latest user turn wins for amount/year; preserve known QI from history when
  // the latest turn is a bare amount follow-up (e.g. “I earn more than £50k”).
  const latestClearedBareEarn =
    fromMessage.hasSelfEmploymentOrProperty === null &&
    fromMessage.qualifyingIncomeGbp == null;
  const input: MtdEligibilityInput = {
    ...fromCtx,
    ...fromMessage,
    amountStatedAsMoreThan:
      fromMessage.amountStatedAsMoreThan || fromCtx.amountStatedAsMoreThan,
    amountStatedAsExact:
      fromMessage.amountStatedAsExact || fromCtx.amountStatedAsExact,
    qualifyingIncomeGbp:
      fromMessage.qualifyingIncomeGbp ?? fromCtx.qualifyingIncomeGbp,
    basisTaxYear: fromMessage.basisTaxYear ?? fromCtx.basisTaxYear,
    payeOnly: fromMessage.payeOnly || fromCtx.payeOnly,
    payeAlsoPresent: fromMessage.payeAlsoPresent || fromCtx.payeAlsoPresent,
    hasSelfEmploymentOrProperty: latestClearedBareEarn
      ? fromCtx.hasSelfEmploymentOrProperty === true
        ? true
        : fromMessage.hasSelfEmploymentOrProperty
      : fromMessage.hasSelfEmploymentOrProperty !== undefined
        ? fromMessage.hasSelfEmploymentOrProperty
        : fromCtx.hasSelfEmploymentOrProperty,
  };
  // If latest turn was bare “I earn £X” with no prior QI context, keep null ask.
  if (
    latestClearedBareEarn &&
    fromCtx.hasSelfEmploymentOrProperty !== true &&
    fromCtx.qualifyingIncomeGbp == null
  ) {
    input.hasSelfEmploymentOrProperty = null;
    input.qualifyingIncomeGbp = null;
  }
  return evaluateMtdEligibility(input);
}
