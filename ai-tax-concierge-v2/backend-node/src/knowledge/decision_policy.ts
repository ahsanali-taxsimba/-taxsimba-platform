/**
 * General decision policy for SIMBA turns.
 * UNDERSTAND → ANSWER/CLARIFY → obligation (if relevant) → WHY → TaxSimba help → package gate.
 * Not test-ID specific.
 */

export type AskType =
  | "GENERAL_INFO"
  | "PERSONAL_OBLIGATION"
  | "SA_QUESTION"
  | "MTD_QUESTION"
  | "TAXSIMBA_SERVICE"
  | "SOFTWARE"
  | "DEADLINE_PROCESS"
  | "CALCULATION"
  | "PROFESSIONAL_ADVICE"
  | "UNCLEAR";

export type ClarificationClass =
  | "income_type_missing"
  | "amount_missing"
  | "tax_year_missing"
  | "gross_profit_ambiguity"
  | "combined_income_ambiguity"
  | "employment_status_ambiguity"
  | "disposal_gain_ambiguity"
  | "property_share_ambiguity"
  | "customer_intent_unclear"
  | "casual_vs_trading_ambiguity"
  | "amount_correction_ambiguity"
  | null;

export type CircumstanceFacts = {
  paye: boolean;
  selfEmployment: boolean;
  property: boolean;
  cis: boolean;
  gigOrSide: boolean;
  dividends: boolean;
  savings: boolean;
  crypto: boolean;
  amountGbp: number | null;
  amountBasis: "gross" | "profit" | "unclear" | null;
  taxYear: string | null;
  declinedPaidHelp: boolean;
  askedForPackage: boolean;
  educationalOnly: boolean;
  personalObligationAsk: boolean;
};

export type DecisionPolicyResult = {
  askType: AskType;
  facts: CircumstanceFacts;
  mode: "EDUCATE" | "CLARIFY" | "ANSWER_OBLIGATION" | "SERVICE" | "ADVICE";
  clarification: string | null;
  clarificationClass: ClarificationClass;
  /** Package cards only when this is true. */
  allowPackages: boolean;
  reason: string;
};

/** True when the customer mid-message corrects an earlier figure. */
export function hasAmountCorrection(text: string): boolean {
  const raw = (text || "").toLowerCase();
  return /(?:wait|actually|i mean|sorry|no it was|correction|not \d)/i.test(raw) &&
    /\d/.test(raw) &&
    (raw.match(/\d+(?:\.\d+)?\s*k?\b/g) || []).length >= 2;
}

function parseAmount(text: string): number | null {
  const raw = text.toLowerCase();
  // Prefer a correction clause (“wait / actually / I mean … 800”).
  // Scan all correction-like clauses and take the last numeric one.
  const correctionRe =
    /(?:wait|actually|i mean|sorry|no it was|correction)[^\d£]{0,32}(?:£\s*)?([\d,]+(?:\.\d+)?)\s*(k\b)?(?:\s*(?:quid|pounds?))?/gi;
  let correction: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = correctionRe.exec(raw)) !== null) correction = m;
  if (correction) {
    let n = Number(String(correction[1]).replace(/,/g, ""));
    if (correction[2] && n < 1000) n *= 1000;
    if (Number.isFinite(n) && n >= 50 && n <= 10_000_000) return n;
  }
  const quidCorrection = raw.match(
    /(?:wait|actually|i mean|sorry|no it was)[^\d£]{0,32}(\d+(?:\.\d+)?)\s*(?:quid|pounds?)\b/,
  );
  if (quidCorrection) {
    const n = Number(quidCorrection[1]);
    if (Number.isFinite(n) && n >= 50 && n <= 10_000_000) return n;
  }
  const k = raw.match(/£\s*([\d,]+(?:\.\d+)?)\s*k\b/) || raw.match(/\b(\d+(?:\.\d+)?)\s*k\b/);
  if (k) {
    let n = Number(String(k[1]).replace(/,/g, ""));
    if (n < 1000) n *= 1000;
    if (Number.isFinite(n) && n >= 100 && n <= 10_000_000) return n;
  }
  const pound = raw.match(/£\s*([\d,]+(?:\.\d+)?)/);
  if (pound) {
    const n = Number(pound[1]!.replace(/,/g, ""));
    if (Number.isFinite(n) && n >= 100 && n <= 10_000_000) return n;
  }
  // “800 quid”
  const quid = raw.match(/\b(\d+(?:\.\d+)?)\s*(?:quid|pounds?)\b/);
  if (quid) {
    const n = Number(quid[1]);
    if (Number.isFinite(n) && n >= 50 && n <= 10_000_000) return n;
  }
  return null;
}

function detectYear(text: string): string | null {
  const lower = text.toLowerCase();
  if (/2024\s*[-/]?\s*25|2024\s*[-/]\s*2025/.test(lower)) return "2024-25";
  if (/2025\s*[-/]?\s*26|2025\s*[-/]\s*2026/.test(lower)) return "2025-26";
  if (/2026\s*[-/]?\s*27|2026\s*[-/]\s*2027/.test(lower)) return "2026-27";
  return null;
}

export function declinesPaidHelp(message: string): boolean {
  return /\b(don'?t want (to buy|packages?|any (paid )?(package|service|help))|do not want (to buy|packages?|any (paid )?(package|service))|no packages?|refuse (packages?|to buy|paid)|dont sell|don'?t sell|no sell|no buy|just (info|information|explain)|information only|explain (without|no) (sell|package)|without (a |any )?package)\b/i.test(
    message || "",
  );
}

export function isEducationalAsk(message: string): boolean {
  const m = (message || "").toLowerCase().trim();
  if (
    /^(what is|what's|whats|explain|tell me about|difference between)\b/.test(m)
  ) {
    return true;
  }
  if (
    /\b(what is|what's|explain)\b.{0,40}\b(self assessment|mtd|making tax digital|trading allowance|dividend allowance|quarterly update|deadline|crypto|xero)\b/.test(
      m,
    )
  ) {
    return true;
  }
  // “dont want packages. explain X”
  if (/explain\b/.test(m) && !/\b(do i need|am i|for me|my (income|rent|turnover))\b/.test(m)) {
    return true;
  }
  return false;
}

export function isPersonalObligationAsk(message: string): boolean {
  const m = (message || "").toLowerCase();
  return (
    /\b(do i (need|have to|still need)|am i (required|supposed)|should i (register|file|submit)|sa\s*\?|mtd\s*\?|hmrc\??|return\??|report\??|automatic(ally)?\??|apply to me|for me)\b/i.test(
      m,
    ) ||
    /\b(need (sa|self assessment|mtd|making tax digital))\b/i.test(m)
  );
}

export function extractCircumstances(
  message: string,
  history?: Array<{ role: string; content: string }> | null,
): CircumstanceFacts {
  const prior = (history || [])
    .filter((h) => h.role === "user")
    .map((h) => h.content)
    .join("\n");
  const ctx = `${prior}\n${message}`.toLowerCase();
  const lower = (message || "").toLowerCase();

  const paye = /\bpaye\b|\bsalary\b|(?<!self-)employ(ed|ment)\b|\bjob\b|\bp45\b/.test(ctx);
  const selfEmployment =
    /(self-?employ|sole[- ]?trader|freelance|contracting|trading|side hustle|gig|deliver|uber|tiktok|etsy|photography|babysitting)/i.test(
      ctx,
    );
  const property =
    /(landlord|rental|\brent\b|property income|buy-?to-?let|let(ting)? (a |my )?(flat|house|property))/i.test(
      ctx,
    );
  const cis = /\bcis\b|construction|subcontract/i.test(ctx);
  const gigOrSide =
    /(side (hustle|cash|income)|on the side|gig|deliver|uber|tiktok|etsy|vinted|babysitting|dog walking|photography|cleaning|gardening|tutoring)/i.test(
      ctx,
    );
  const dividends = /dividend/i.test(ctx);
  const savings = /(bank interest|savings interest|pensioner)/i.test(ctx);
  const crypto = /\b(crypto|bitcoin|ethereum|\beth\b|nft)\b/i.test(ctx);

  let amountBasis: CircumstanceFacts["amountBasis"] = null;
  if (/\b(turnover|gross|before expenses|qualifying income)\b/i.test(lower)) {
    amountBasis = "gross";
  } else if (/\bprofit\b/i.test(lower) && !/\b(turnover|gross)\b/i.test(lower)) {
    amountBasis = "profit";
  } else if (parseAmount(message) != null) {
    amountBasis = "unclear";
  }

  const askedForPackage =
    /\b(which|recommend|cheapest|suitable|best)\b/i.test(lower) &&
    /\b(package|plan|service)\b/i.test(lower) &&
    !declinesPaidHelp(message);

  return {
    paye,
    selfEmployment,
    property,
    cis,
    gigOrSide,
    dividends,
    savings,
    crypto,
    amountGbp: parseAmount(message) ?? parseAmount(prior),
    amountBasis,
    taxYear: detectYear(message) ?? detectYear(prior),
    declinedPaidHelp:
      declinesPaidHelp(message) ||
      (history || []).some(
        (h) => h.role === "user" && declinesPaidHelp(h.content || ""),
      ),
    askedForPackage,
    educationalOnly: isEducationalAsk(message) && !isPersonalObligationAsk(message),
    personalObligationAsk: isPersonalObligationAsk(message),
  };
}

export function classifyAskType(
  message: string,
  facts: CircumstanceFacts,
): AskType {
  const m = (message || "").toLowerCase();
  if (
    /(investigation|penalty appeal|complex|personalised|calculate my (exact )?tax|how much (tax )?will i owe)/i.test(
      m,
    )
  ) {
    return "PROFESSIONAL_ADVICE";
  }
  if (
    /\b(xero|taxcalc|software|compatible software)\b/i.test(m) &&
    !facts.personalObligationAsk
  ) {
    return "SOFTWARE";
  }
  if (
    /\b(packages?|plans?|sign ?up|register on taxsimba|cheapest|consultation|£99|£149|taxsimba offer|prices?)\b/i.test(
      m,
    ) &&
    /\b(package|plan|taxsimba|simbian|self assessment|mtd|price|prices|cost)\b/i.test(
      m,
    ) &&
    !facts.declinedPaidHelp
  ) {
    return "TAXSIMBA_SERVICE";
  }
  // VAT registration threshold is a general process topic unless the customer
  // supplies their own turnover figure for a personal decision.
  if (
    /\bvat\b/i.test(m) &&
    /(register|threshold|when do i need)/i.test(m) &&
    facts.amountGbp == null
  ) {
    return "DEADLINE_PROCESS";
  }
  if (
    /\b(deadline|filing|payment deadline|quarterly update|final declaration|5 october|31 january)\b/i.test(
      m,
    ) &&
    (facts.educationalOnly || /difference between|what is|when is/i.test(m))
  ) {
    return "DEADLINE_PROCESS";
  }
  if (facts.educationalOnly) return "GENERAL_INFO";
  if (
    /\b(mtd|making tax digital|qualifying income|\bqi\b|digital tax)\b/i.test(m) ||
    (/\bstart when\b/i.test(m) && /\bqi\b|qualifying|£\s*\d/i.test(m))
  ) {
    return "MTD_QUESTION";
  }
  if (
    /\b(self assessment|\bsa\b|tax return|register for sa)\b/i.test(m) ||
    facts.personalObligationAsk
  ) {
    return "SA_QUESTION";
  }
  if (/(how much tax|calculate|owe|bill)/i.test(m)) return "CALCULATION";
  if (facts.personalObligationAsk) return "PERSONAL_OBLIGATION";
  return "UNCLEAR";
}

/**
 * Decide mode + whether packages are allowed.
 * Clarification is ONE high-value question when personal obligation is asked
 * but a critical fact is missing — not interrogation for educational asks.
 */
export function decidePolicy(
  message: string,
  history?: Array<{ role: string; content: string }> | null,
): DecisionPolicyResult {
  const facts = extractCircumstances(message, history);
  const askType = classifyAskType(message, facts);
  const m = (message || "").toLowerCase();

  // Package gate: all must be true later; default deny for educate/clarify.
  const baseAllow =
    !facts.declinedPaidHelp &&
    facts.askedForPackage &&
    !facts.educationalOnly;

  // EDUCATION — answer directly; never force eligibility or packages.
  if (
    askType === "GENERAL_INFO" ||
    askType === "DEADLINE_PROCESS" ||
    askType === "SOFTWARE" ||
    facts.educationalOnly
  ) {
    return {
      askType,
      facts,
      mode: "EDUCATE",
      clarification: null,
      clarificationClass: null,
      allowPackages: baseAllow,
      reason: "Educational / process question — answer directly without sales classification.",
    };
  }

  if (askType === "PROFESSIONAL_ADVICE" || askType === "CALCULATION") {
    return {
      askType,
      facts,
      mode: "ADVICE",
      clarification: null,
      clarificationClass: null,
      allowPackages: !facts.declinedPaidHelp && /consult|accountant|personalised/i.test(m),
      reason: "Fact-specific / calculation — escalate carefully; do not invent liability.",
    };
  }

  if (askType === "TAXSIMBA_SERVICE") {
    return {
      askType,
      facts,
      mode: "SERVICE",
      clarification: null,
      clarificationClass: null,
      allowPackages: !facts.declinedPaidHelp,
      reason: "Customer asked about TaxSimba service/package.",
    };
  }

  // PERSONAL / SA / MTD — only clarify when obligation is being asked and a key fact is missing.
  if (askType === "MTD_QUESTION" || askType === "SA_QUESTION" || askType === "PERSONAL_OBLIGATION") {
    // Bare total without income type (not savings/crypto-labelled amounts).
    // Skip for educational MTD threshold/band questions (“the £20,000 MTD threshold”).
    const mtdBandEducation =
      askType === "MTD_QUESTION" &&
      /(threshold|april 202[6-9]|start date|qualifying income|\bqi\b|mtd for income tax)/i.test(
        m,
      );
    if (
      facts.amountGbp != null &&
      !facts.selfEmployment &&
      !facts.property &&
      !facts.paye &&
      !facts.savings &&
      !facts.crypto &&
      !/\b(qualifying income|\bqi\b|turnover|gross)\b/i.test(m) &&
      !mtdBandEducation
    ) {
      return {
        askType,
        facts,
        mode: "CLARIFY",
        clarification:
          "Is that figure PAYE employment salary, self-employment turnover, property rent before expenses, or a mix — and which tax year?",
        clarificationClass: "income_type_missing",
        allowPackages: false,
        reason: "Amount without income type — do not guess SA/MTD.",
      };
    }

    // Gig/side without amount when asking what to do / HMRC / SA
    if (
      facts.gigOrSide &&
      facts.amountGbp == null &&
      facts.personalObligationAsk
    ) {
      return {
        askType,
        facts,
        mode: "CLARIFY",
        clarification:
          "Roughly how much did you earn from that activity before expenses, and for which UK tax year?",
        clarificationClass: "amount_missing",
        allowPackages: false,
        reason: "Side/gig activity without amount.",
      };
    }

    // Mid-message amount correction (“8k … wait 800”) — confirm the figure
    // before treating either number as trading income or expenses.
    if (
      hasAmountCorrection(m) &&
      (facts.gigOrSide || facts.selfEmployment || facts.property) &&
      !/(regular|every week|full.?time self-?employ)/i.test(m)
    ) {
      return {
        askType,
        facts,
        mode: "CLARIFY",
        clarification:
          facts.amountGbp != null
            ? `Just to confirm — is the correct gross figure about £${facts.amountGbp.toLocaleString("en-GB")} before expenses for one UK tax year, and is that self-employment / gig income (not a mix of salary and expenses)?`
            : "You mentioned more than one figure — which amount is the correct gross trading income for one UK tax year, before expenses?",
        clarificationClass: "amount_correction_ambiguity",
        allowPackages: false,
        reason: "Conflicting amounts in one message — confirm before SA/MTD.",
      };
    }

    // Tentative side activity (“just started… maybe… on the side”) — confirm
    // casual vs regular trading before asserting Self Assessment, even above £1,500.
    const tentativeSide =
      /(just started|thinking of starting|maybe|on the side|might be|not sure if)/i.test(m) &&
      (facts.gigOrSide || facts.selfEmployment);
    if (
      tentativeSide &&
      facts.amountGbp != null &&
      facts.amountGbp <= 12000 &&
      (facts.personalObligationAsk || /\bhmrc\b|\bregister\b|\btax\b|\bsa\b/i.test(m)) &&
      !/(regular|every week|full.?time self-?employ|established business)/i.test(m)
    ) {
      return {
        askType,
        facts,
        mode: "CLARIFY",
        clarification:
          "Was this casual occasional activity, or regular self-employment trading? GOV.UK’s usual sole-trader Self Assessment rule uses more than £1,000 of trading income in a tax year (before reliefs) — that is separate from using the trading allowance as tax relief when you do file.",
        clarificationClass: "casual_vs_trading_ambiguity",
        allowPackages: false,
        reason: "Tentative side activity needs casual vs trading before SA conclusion.",
      };
    }

    // Near-£1,000 side income — casual vs trading before asserting SA
    // Also catch “hmrc?” / “register?” style asks on small side amounts.
    if (
      (facts.gigOrSide || facts.selfEmployment) &&
      facts.amountGbp != null &&
      facts.amountGbp <= 1500 &&
      (facts.personalObligationAsk || /\bhmrc\b|\bregister\b|\btax\b/i.test(m)) &&
      !/(regular|every week|full.?time self-?employ)/i.test(m)
    ) {
      return {
        askType,
        facts,
        mode: "CLARIFY",
        clarification:
          "Was this casual occasional activity, or regular self-employment trading? GOV.UK’s usual sole-trader Self Assessment rule uses more than £1,000 of trading income in a tax year (before reliefs) — that is separate from using the trading allowance as tax relief when you do file.",
        clarificationClass: "casual_vs_trading_ambiguity",
        allowPackages: false,
        reason: "Near-threshold side income needs casual vs trading before SA conclusion.",
      };
    }

    // MTD-shaped ask without year when amount present — but not when the
    // customer is already discussing a published band/start date (e.g. April 2028).
    if (
      askType === "MTD_QUESTION" &&
      facts.amountGbp != null &&
      !facts.taxYear &&
      !/\bqi\b|qualifying income/i.test(m) &&
      !/april 202[6-9]|threshold|start date/i.test(m)
    ) {
      return {
        askType,
        facts,
        mode: "CLARIFY",
        clarification:
          "Which tax year is that qualifying income for — 2024-25, 2025-26 or 2026-27?",
        clarificationClass: "tax_year_missing",
        allowPackages: false,
        reason: "MTD band requires a basis tax year.",
      };
    }

    // Crypto disposal without enough event facts
    if (
      facts.crypto &&
      facts.personalObligationAsk &&
      !/(never sold|only (bought|holding)|hold)/i.test(m) &&
      facts.amountGbp == null
    ) {
      return {
        askType,
        facts,
        mode: "CLARIFY",
        clarification:
          "Have you disposed of crypto in a UK tax year (sold, exchanged, or spent), and roughly what gain — or are you only holding?",
        clarificationClass: "disposal_gain_ambiguity",
        allowPackages: false,
        reason: "Crypto tax depends on disposal/event facts.",
      };
    }

    // Property share / joint
    if (
      /(partner|spouse|joint|50\/50|50-50)/i.test(m) &&
      /(let|rent|property)/i.test(m) &&
      facts.personalObligationAsk
    ) {
      return {
        askType,
        facts,
        mode: "CLARIFY",
        clarification:
          "Are you joint beneficial owners of a let property (and in what shares), roughly how much rent before expenses, and for which tax year?",
        clarificationClass: "property_share_ambiguity",
        allowPackages: false,
        reason: "Joint property needs share/amount before filing conclusion.",
      };
    }

    // Two PAYE jobs / PAYE-only “automatic SA?” — clarify other income, don’t assert SA
    if (
      facts.paye &&
      !facts.selfEmployment &&
      !facts.property &&
      facts.personalObligationAsk &&
      /(two jobs|2 jobs|paye only|automatic|p45|left (my )?job)/i.test(m)
    ) {
      return {
        askType,
        facts,
        mode: "CLARIFY",
        clarification:
          "PAYE employment alone (including two PAYE jobs or a P45) does not automatically create a Self Assessment duty. Do you have any other untaxed income this tax year — for example self-employment, property rent, untaxed interest/dividends, or crypto disposals — or has HMRC asked you to file?",
        clarificationClass: "employment_status_ambiguity",
        allowPackages: false,
        reason: "PAYE-only / multi-PAYE needs confirmation of other income before SA conclusion.",
      };
    }

    // Savings/pensioner interest — other income may matter
    if (
      facts.savings &&
      facts.personalObligationAsk &&
      !/(only (state )?pension|no other income|paye only)/i.test(m)
    ) {
      return {
        askType,
        facts,
        mode: "CLARIFY",
        clarification:
          "Do you have any other untaxed income besides that interest (for example self-employment, property, or large untaxed amounts), and for which tax year?",
        clarificationClass: "employment_status_ambiguity",
        allowPackages: false,
        reason: "Savings interest alone rarely decides SA without other facts.",
      };
    }

    // CIS without turnover when asking SA
    if (facts.cis && facts.personalObligationAsk && facts.amountGbp == null) {
      return {
        askType,
        facts,
        mode: "CLARIFY",
        clarification:
          "CIS deductions do not replace Self Assessment. Roughly what was your sole-trader/CIS turnover before expenses, and for which tax year?",
        clarificationClass: "amount_missing",
        allowPackages: false,
        reason: "CIS needs turnover/year before SA/MTD conclusion.",
      };
    }

    // Starting business with no amount/structure
    if (
      /starting (a )?(small )?business|start(ing)? (up|my business)/i.test(m) &&
      facts.amountGbp == null
    ) {
      return {
        askType,
        facts,
        mode: "CLARIFY",
        clarification:
          "Are you planning to trade as a sole trader (or something else), and do you expect more than £1,000 of trading income in the first tax year?",
        clarificationClass: "customer_intent_unclear",
        allowPackages: false,
        reason: "Business start needs structure/expected income before obligations.",
      };
    }

    // Enough facts → answer obligation path (handlers / LLM may complete).
    return {
      askType,
      facts,
      mode: "ANSWER_OBLIGATION",
      clarification: null,
      clarificationClass: null,
      allowPackages: baseAllow,
      reason: "Enough circumstance for obligation guidance without a package dump.",
    };
  }

  // Circumstance dumps without an explicit “SA?” still need the same fact gates.
  if (
    hasAmountCorrection(m) &&
    (facts.gigOrSide || facts.selfEmployment || facts.property)
  ) {
    return {
      askType: askType === "UNCLEAR" ? "PERSONAL_OBLIGATION" : askType,
      facts,
      mode: "CLARIFY",
      clarification:
        facts.amountGbp != null
          ? `Just to confirm — is the correct gross figure about £${facts.amountGbp.toLocaleString("en-GB")} before expenses for one UK tax year, and is that self-employment / gig income (not a mix of salary and expenses)?`
          : "You mentioned more than one figure — which amount is the correct gross trading income for one UK tax year, before expenses?",
      clarificationClass: "amount_correction_ambiguity",
      allowPackages: false,
      reason: "Conflicting amounts without a clear ask — confirm before advising.",
    };
  }

  const tentativeSideFallback =
    /(just started|thinking of starting|maybe|on the side|might be|not sure if)/i.test(
      m,
    ) &&
    (facts.gigOrSide || facts.selfEmployment) &&
    facts.amountGbp != null &&
    facts.amountGbp <= 12000;
  if (tentativeSideFallback) {
    return {
      askType: askType === "UNCLEAR" ? "PERSONAL_OBLIGATION" : askType,
      facts,
      mode: "CLARIFY",
      clarification:
        "Was this casual occasional activity, or regular self-employment trading? GOV.UK’s usual sole-trader Self Assessment rule uses more than £1,000 of trading income in a tax year (before reliefs) — that is separate from using the trading allowance as tax relief when you do file.",
      clarificationClass: "casual_vs_trading_ambiguity",
      allowPackages: false,
      reason: "Tentative side income dump — confirm trading before SA conclusion.",
    };
  }

  // Unclear ask — one clarifying question only if they seem to want personal help.
  if (facts.personalObligationAsk) {
    return {
      askType: "UNCLEAR",
      facts,
      mode: "CLARIFY",
      clarification:
        "Happy to help — what income types are involved (PAYE, self-employment, property, etc.), roughly how much before expenses, and for which tax year?",
      clarificationClass: "customer_intent_unclear",
      allowPackages: false,
      reason: "Personal ask with unclear circumstances.",
    };
  }

  return {
    askType,
    facts,
    mode: "EDUCATE",
    clarification: null,
    clarificationClass: null,
    allowPackages: false,
    reason: "Default: help with information; no package without a clear ask.",
  };
}
