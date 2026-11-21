/**
 * Deterministic Self Assessment registration / filing guidance when
 * trading (sole trader / freelance) income is known.
 *
 * Official rule (GOV.UK): you must usually send a Self Assessment tax return
 * if you were self-employed as a sole trader and earned more than £1,000
 * (before taking off anything you can claim tax relief on).
 *
 * The £1,000 trading allowance is NOT a “below this you never register” test
 * for income that already exceeds £1,000 — £8,000 is above the threshold.
 *
 * Source: https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
 * Trading allowance: https://www.gov.uk/tax-relief-for-businesses
 */

export const SA_WHO_MUST_URL =
  "https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return";
export const SA_REGISTER_URL =
  "https://www.gov.uk/register-for-self-assessment";
export const TRADING_ALLOWANCE_URL =
  "https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income";

/** Gross trading income above which sole traders usually must file SA. */
export const SA_TRADING_INCOME_THRESHOLD_GBP = 1_000;

export type SaEligibilityResult = {
  handled: boolean;
  needs_more_info: boolean;
  must_usually_file: boolean | null;
  trading_income_gbp: number | null;
  reason: string;
  clarifying_question: string | null;
  customer_reply: string;
  confidence: "high" | "medium" | "low";
};

function parsePoundAmount(text: string): number | null {
  const raw = text.toLowerCase();
  const pound =
    raw.match(/£\s*([\d,]+(?:\.\d+)?)\s*k\b/) ||
    raw.match(/£\s*([\d,]+(?:\.\d+)?)/);
  if (!pound) return null;
  let n = Number(pound[1]!.replace(/,/g, ""));
  if (pound[0]!.includes("k")) n *= 1000;
  if (Number.isFinite(n) && n >= 0 && n <= 10_000_000) return n;
  return null;
}

function parseTaggedAmount(text: string, re: RegExp): number | null {
  const m = text.match(re);
  if (!m?.[1]) return null;
  let n = Number(m[1].replace(/,/g, ""));
  if (m[0].toLowerCase().includes("k") && n < 1000) n *= 1000;
  if (Number.isFinite(n) && n >= 0 && n <= 10_000_000) return n;
  return null;
}

/** Combine current message with prior user turns for multi-turn context. */
export function conversationContextText(
  message: string,
  history?: Array<{ role: string; content: string }> | null,
): string {
  const prior = (history || [])
    .filter((h) => h.role === "user" && h.content?.trim())
    .map((h) => h.content)
    .join("\n");
  return prior ? `${prior}\n${message}` : message;
}

export function isSaEligibilityQuestion(message: string): boolean {
  const m = (message || "").toLowerCase();
  // Never treat VAT / corporation tax / PAYE-only registration questions as SA.
  if (/\b(vat|corporation tax|paye scheme|payroll)\b/i.test(m) && !/\bself assessment\b/i.test(m)) {
    return false;
  }
  if (
    /\b(mtd|making tax digital|qualifying income threshold|when do i (start|join) mtd)\b/i.test(
      m,
    ) &&
    !/\b(self assessment|tax return)\b/i.test(m)
  ) {
    return false;
  }
  // Explicit Self Assessment / tax-return framing (including shorthand “sa?”).
  if (
    /\b(need (to )?(register for|file|send) (a )?self assessment)\b/i.test(m) ||
    /\b(who must (send|file)|do i need (a )?self assessment|should i register for self assessment)\b/i.test(
      m,
    ) ||
    /\b(register for self assessment)\b/i.test(m) ||
    /\b(do i need to file)\b/i.test(m) ||
    /\b(must i (register|file|send).{0,40}(self assessment|tax return))\b/i.test(m) ||
    /\b(sa needed|need sa\b|need (a )?sa\b|do i need sa)\b/i.test(m) ||
    /(?:^|[—\-–,:]\s*|\.\s*)sa\s*\??\s*$/i.test(m.trim()) ||
    /\bsa\s*\?\s*$/i.test(m.trim())
  ) {
    return true;
  }
  // "Do I need to register/file/send" only when SA / tax return / sole-trader context is present.
  if (
    /\b(do i (need to|have to|still need to) (register|file|send|submit))\b/i.test(
      m,
    )
  ) {
    return /\b(self assessment|tax return|sole[- ]?trader|self-?employ|freelance)\b/i.test(
      m,
    );
  }
  return false;
}

/** Income-disclosure turn in an SA / freelancing conversation (no explicit “do I need…” yet). */
export function isTradingIncomeDisclosure(
  message: string,
  history?: Array<{ role: string; content: string }> | null,
): boolean {
  const m = (message || "").toLowerCase();
  // Landlord rent + SA ask is handled via explicit SA question + property amount.
  if (
    /(landlord|rental|\brent\b)/i.test(m) &&
    /(?:^|[—\-–,:]\s*|\.\s*)sa\s*\??\s*$/i.test(m.trim()) &&
    extractTradingIncomeGbp(message) == null
  ) {
    // Fall through — property SA uses evaluate path when isSaEligibilityQuestion is true.
  }
  if (
    !/(freelance|self-?employ|sole[- ]?trader|trading|contracting)/i.test(m)
  ) {
    return false;
  }
  if (extractTradingIncomeGbp(message) == null) return false;
  // Avoid stealing pure MTD threshold questions.
  if (
    /\b(mtd|making tax digital|qualifying income)\b/i.test(m) &&
    !/\b(self assessment|register|file)\b/i.test(m)
  ) {
    return false;
  }
  const ctx = conversationContextText(message, history).toLowerCase();
  return (
    /(freelance|self-?employ|sole[- ]?trader|self assessment|tax return|register)/i.test(
      ctx,
    ) && /(tax year|20\d{2}|paye|employ|expenses|turnover)/i.test(m)
  );
}

export function extractTradingIncomeGbp(text: string): number | null {
  const tradingTagged =
    parseTaggedAmount(
      text,
      /(?:freelance|self-?employ(?:ed|ment)?|sole[- ]?trader|trading|side (?:hustle|income)|turnover|contracting)[^£\d]{0,40}£\s*([\d,]+(?:\.\d+)?)\s*k?\b/i,
    ) ||
    parseTaggedAmount(
      text,
      /£\s*([\d,]+(?:\.\d+)?)\s*k?(?=\s*(?:was\s+)?(?:freelance|self-?employ|sole[- ]?trader|trading|turnover|before expenses|contracting))/i,
    ) ||
    parseTaggedAmount(
      text,
      /(?:landlord|rental|\brent\b)[^£\d]{0,24}£\s*([\d,]+(?:\.\d+)?)\s*k?\b/i,
    ) ||
    parseTaggedAmount(
      text,
      /£\s*([\d,]+(?:\.\d+)?)\s*k?(?=\s*(?:rent|rental|landlord))/i,
    );
  if (tradingTagged != null) return tradingTagged;

  // "Freelance turnover so far is about £8,000" / "contracting as X £4,760"
  const narrative = parseTaggedAmount(
    text,
    /(?:freelance|self-?employ|sole[- ]?trader|trading|turnover|contracting)[^\n£]{0,60}£\s*([\d,]+(?:\.\d+)?)\s*k?\b/i,
  );
  if (narrative != null) return narrative;

  const lower = text.toLowerCase();
  const hasTrading =
    /(freelance|self-?employ|sole[- ]?trader|trading income|side hustle|side income|contracting|landlord|rental|\brent\b)/i.test(
      lower,
    );
  if (!hasTrading) return null;
  // If salary/PAYE and freelance both appear, do not grab the first £ figure
  // (often the salary) — require a trading-tagged amount above.
  if (
    /(paye|salary|employment)/i.test(lower) &&
    /(freelance|self-?employ|sole[- ]?trader|trading)/i.test(lower)
  ) {
    return null;
  }
  return parsePoundAmount(text);
}

export function evaluateSaEligibility(opts: {
  message: string;
  tradingIncomeGbp: number | null;
  taxYearHint?: string | null;
  payeOnly?: boolean;
}): SaEligibilityResult {
  const { message, tradingIncomeGbp, taxYearHint, payeOnly } = opts;
  const yearNote = taxYearHint
    ? ` for ${taxYearHint}`
    : " for the tax year in question";

  if (payeOnly && tradingIncomeGbp == null) {
    return {
      handled: true,
      needs_more_info: false,
      must_usually_file: false,
      trading_income_gbp: null,
      reason: "PAYE-only with no other income stated",
      clarifying_question: null,
      confidence: "high",
      customer_reply:
        "If your only income is taxed under PAYE through your employer and you have no other untaxed income, you usually do not need to send a Self Assessment tax return for that reason alone. " +
        "Other GOV.UK triggers can still require a return (for example HMRC asking you to file, or certain high-income situations). " +
        `Check the full list: ${SA_WHO_MUST_URL}`,
    };
  }

  if (tradingIncomeGbp == null) {
    return {
      handled: true,
      needs_more_info: true,
      must_usually_file: null,
      trading_income_gbp: null,
      reason: "SA question without known trading income figure",
      clarifying_question:
        "Roughly how much did you earn from self-employment / freelancing before expenses, and for which tax year?",
      confidence: "medium",
      customer_reply:
        "Whether you need Self Assessment usually depends on your circumstances. " +
        "If you were self-employed as a sole trader and earned more than £1,000 before reliefs in a tax year, " +
        "you normally must register and send a tax return. " +
        "The £1,000 trading allowance is a relief you may claim — it is not a free pass to ignore Self Assessment when your trading income is already above £1,000.\n\n" +
        "Roughly how much did you earn from self-employment / freelancing before expenses, and for which tax year?\n\n" +
        `Official guidance: ${SA_WHO_MUST_URL}`,
    };
  }

  const amount = tradingIncomeGbp;
  const formatted = amount.toLocaleString("en-GB");

  if (amount > SA_TRADING_INCOME_THRESHOLD_GBP) {
    return {
      handled: true,
      needs_more_info: false,
      must_usually_file: true,
      trading_income_gbp: amount,
      reason: `Trading income £${formatted} is more than £1,000 — SA usually required`,
      clarifying_question: null,
      confidence: "high",
      customer_reply:
        `With freelance / self-employment income of £${formatted}${yearNote}, you are above the £1,000 sole-trader threshold, ` +
        `so you usually must register for Self Assessment and send a tax return. ` +
        `That £1,000 figure is the “more than £1,000” test on GOV.UK — £${formatted} is not below it. ` +
        `You may still be able to claim the trading allowance (up to £1,000) instead of actual expenses when you calculate taxable profit, ` +
        `but that relief does not remove the normal requirement to register and file when trading income is more than £1,000.\n\n` +
        `Register: ${SA_REGISTER_URL}\n` +
        `Who must send a return: ${SA_WHO_MUST_URL}\n` +
        `Trading allowance: ${TRADING_ALLOWANCE_URL}`,
    };
  }

  if (amount === SA_TRADING_INCOME_THRESHOLD_GBP) {
    return {
      handled: true,
      needs_more_info: true,
      must_usually_file: null,
      trading_income_gbp: amount,
      reason: "Exactly £1,000 — boundary; confirm other income / HMRC notice",
      clarifying_question:
        "Do you have any other untaxed income, or has HMRC asked you to file?",
      confidence: "medium",
      customer_reply:
        `GOV.UK uses “more than £1,000” for sole-trader Self Assessment. ` +
        `At exactly £1,000${yearNote} you are on the boundary — you may not be forced in by that sole-trader rule alone, ` +
        `but other reasons can still require a return (for example other untaxed income, or HMRC asking you to file). ` +
        `Check ${SA_WHO_MUST_URL}. Do you have any other untaxed income, or has HMRC asked you to file?`,
    };
  }

  // Below £1,000 trading income
  return {
    handled: true,
    needs_more_info: Boolean(
      /paye|salary|employ|property|rental|crypto|dividend/i.test(message),
    ),
    must_usually_file: false,
    trading_income_gbp: amount,
    reason: `Trading income £${formatted} is not more than £1,000`,
    clarifying_question:
      "Do you have any other untaxed income, or has HMRC asked you to send a return?",
    confidence: "high",
    customer_reply:
      `With self-employment / freelance income of £${formatted}${yearNote}, you are not above the £1,000 sole-trader threshold on GOV.UK, ` +
      `so that particular rule alone usually does not require Self Assessment. ` +
      `You can still need a return for other reasons (other untaxed income, high overall income, HMRC notice, etc.). ` +
      `Confirm against ${SA_WHO_MUST_URL}. Do you have any other untaxed income, or has HMRC asked you to file?`,
  };
}

export function answerSaEligibility(
  message: string,
  history?: Array<{ role: string; content: string }> | null,
): SaEligibilityResult | null {
  const m = (message || "").toLowerCase();
  // Let MTD handlers own QI-combine / band questions.
  if (
    /(combin|together|add (them|both)|qualifying income|which number matters|which amount counts|mortgage interest reduce)/i.test(
      m,
    ) &&
    /(rent|rental|property|turnover|profit|mtd|making tax digital)/i.test(m)
  ) {
    return null;
  }
  const explicit = isSaEligibilityQuestion(message);
  const disclosure = isTradingIncomeDisclosure(message, history);
  if (!explicit && !disclosure) return null;
  const ctx = conversationContextText(message, history);
  // Prefer the latest user message for amounts (supports corrections like
  // “sorry, £40k was salary and £18k was freelance”).
  const tradingIncomeGbp =
    extractTradingIncomeGbp(message) ?? extractTradingIncomeGbp(ctx);

  // Landlord / rental income — do not reuse the sole-trader £1,000 trading test wording.
  const isPropertyAsk =
    /(landlord|rental|\brent\b|property income)/i.test(m) &&
    !/(freelance|self-?employ|sole[- ]?trader|contracting|trading)/i.test(m);
  if (isPropertyAsk && tradingIncomeGbp != null && tradingIncomeGbp > 0) {
    const yearFromMessage = message.match(/\b(20\d{2})\s*[-–/]\s*(\d{2})\b/);
    const yearHint = yearFromMessage
      ? `${yearFromMessage[1]}-${yearFromMessage[2]}`
      : null;
    const yearNote = yearHint ? ` for ${yearHint}` : "";
    return {
      handled: true,
      needs_more_info: false,
      must_usually_file: true,
      trading_income_gbp: tradingIncomeGbp,
      reason: "Property rental income usually reported via Self Assessment",
      clarifying_question: null,
      confidence: "high",
      customer_reply:
        `Rental income of £${tradingIncomeGbp.toLocaleString("en-GB")}${yearNote} is untaxed income that usually needs to be reported on a Self Assessment tax return. ` +
        `PAYE on a job (if any) does not tax your rent. ` +
        `Confirm your full circumstances on GOV.UK: ${SA_WHO_MUST_URL}`,
    };
  }
  // For pure disclosure turns, require a parsed amount — otherwise let the LLM continue.
  if (disclosure && !explicit && tradingIncomeGbp == null) return null;
  const yearFromMessage = message.match(/\b(20\d{2})\s*[-–/]\s*(\d{2})\b/);
  const yearFromCtx = ctx.match(/\b(20\d{2})\s*[-–/]\s*(\d{2})\b/);
  const yearMatch = yearFromMessage || yearFromCtx;
  const taxYearHint = yearMatch
    ? `${yearMatch[1]}-${yearMatch[2]}`
    : null;
  // Strip “do not ask me whether I am self-employed” style instructions so they
  // are not mistaken for a self-employment disclosure (T303).
  const ctxForIncomeType = ctx
    .replace(
      /do not ask[^.?!]*(self-?employ|freelance|sole[- ]?trader)[^.?!]*[.?!]?/gi,
      " ",
    )
    .replace(
      /don'?t ask[^.?!]*(self-?employ|freelance|sole[- ]?trader)[^.?!]*[.?!]?/gi,
      " ",
    );
  const payeOnly =
    /\bpaye\b|\bpayroll\b|\bsalary\b/.test(ctxForIncomeType.toLowerCase()) &&
    /\bonly\b/.test(ctxForIncomeType.toLowerCase()) &&
    !/(freelance|self-?employ|sole[- ]?trader|property|rental|trading income)/i.test(
      ctxForIncomeType,
    );
  const uncertainAmount =
    /\b(maybe|perhaps|not sure|around|about|roughly|approx(?:imately)?)\b/i.test(
      message,
    ) && tradingIncomeGbp != null;
  const asksAccountant =
    /\b(accountant|do i need an accountant|should i get an accountant)\b/i.test(
      message,
    );
  // Uncertain amount and/or accountant ask without tax year → confirm facts first.
  if ((uncertainAmount || (asksAccountant && tradingIncomeGbp != null)) && !taxYearHint) {
    return {
      handled: true,
      needs_more_info: true,
      must_usually_file: null,
      trading_income_gbp: tradingIncomeGbp,
      reason: "Uncertain amount or accountant ask without confirmed tax year",
      clarifying_question:
        "Confirm the turnover before expenses for a specific tax year before deciding Self Assessment or an accountant.",
      confidence: "medium",
      customer_reply:
        `If that cash / freelance / side income is self-employment trading turnover of about £${tradingIncomeGbp.toLocaleString("en-GB")}, ` +
        `the usual GOV.UK test is whether it is more than £1,000 in a tax year — but I should not lock a final answer on a “maybe” figure without the tax year. ` +
        `What was the amount before expenses for which tax year (for example 2025-26)? ` +
        `If you want personalised help after that, TaxSimba offers paid accountant video consultations (£99 / £149) — I won’t push a package until the facts are clear.\n` +
        `Guidance: ${SA_WHO_MUST_URL}`,
    };
  }

  return evaluateSaEligibility({
    message: ctx,
    tradingIncomeGbp,
    taxYearHint,
    payeOnly,
  });
}
