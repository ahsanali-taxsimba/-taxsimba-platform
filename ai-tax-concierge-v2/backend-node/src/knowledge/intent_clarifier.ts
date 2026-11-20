/**
 * Ambiguous customer questions — ask one clarifying question instead of guessing.
 * Used before eligibility/recommendation when key facts are missing.
 */

export type ClarifierResult = {
  handled: boolean;
  customer_reply: string;
  confidence: "high" | "medium" | "low";
};

export function answerAmbiguousIntent(message: string): ClarifierResult | null {
  const lower = (message || "").toLowerCase().trim();
  if (!lower) return null;

  // Guaranteed refund — refuse
  if (
    /guarantee.*(refund|tax back)|promise.*(refund|tax back)/i.test(lower)
  ) {
    return {
      handled: true,
      confidence: "high",
      customer_reply:
        "I can’t guarantee a tax refund. Refunds depend on your full circumstances and HMRC’s assessment. " +
        "I can explain how Self Assessment balancing payments and repayments usually work, or you can choose a paid accountant video consultation (Quick £99 / 20 minutes or Extended £149 / 40 minutes) if you want personalised advice.",
    };
  }

  // Existing accountant — but do not override a concrete MTD eligibility question with figures.
  if (
    /already have an accountant|existing accountant|my accountant handles/i.test(
      lower,
    ) &&
    !(
      /(mtd|making tax digital)/i.test(lower) &&
      /(£|qualifying income|turnover|\d{2},?\d{3}|2024-25|2025-26|2026-27)/i.test(
        lower,
      )
    )
  ) {
    return {
      handled: true,
      confidence: "high",
      customer_reply:
        "If you already have an accountant, they should lead your filings and MTD software setup. " +
        "I can still explain the HMRC rules in plain English. " +
        "If you’re a TaxSimba client, message your assigned accountant through your secure dashboard rather than booking a new public consultation unless you specifically need one. " +
        "What would you like clarified?",
    };
  }

  // Cheapest package
  if (/cheapest package|lowest (suitable )?package|cheapest (sa|self assessment)/i.test(lower)) {
    return {
      handled: true,
      confidence: "high",
      customer_reply:
        "For a straightforward first-time Self Assessment, the lowest approved TaxSimba package is Self Assessment Simple at £119 per tax year. " +
        "Smart (£149) or Elite (£299) only if your affairs are more complex. " +
        "Tell me briefly about your income types and I can confirm the lowest suitable option — or start at https://www.taxsimba.co.uk/self-assessment.",
    };
  }

  // Bare "I earn £X" without income-type context — do NOT fire when PAYE / trading / property already stated.
  const hasIncomeType =
    /(self-?employ|sole[- ]?trader|paye|salary|payroll|rental|property|profit|turnover|freelance|trading|company|crypto|dividend|qualifying income|handmade|casual)/i.test(
      lower,
    );
  if (
    !hasIncomeType &&
    (/^i (earn|make|get)\s*£?\s*[\d,]+k?\b/.test(lower) ||
      /i (earn|make)\s*£?\s*[\d,]+/.test(lower))
  ) {
    return {
      handled: true,
      confidence: "high",
      customer_reply:
        "Happy to help — I need a little more detail before I can give an accurate answer. " +
        "Is that figure PAYE employment salary, self-employment turnover, profit after expenses, rental income, or something else — and which tax year?",
    };
  }

  // Profit from online trading — clarify gross vs profit + activity
  if (
    /£?\s*[\d,]+\s*profit/.test(lower) &&
    /(online|trading|etsy|ebay|shopify|side)/i.test(lower)
  ) {
    return {
      handled: true,
      confidence: "high",
      customer_reply:
        "Thanks — a profit figure is useful, but for Self Assessment and Making Tax Digital HMRC usually needs turnover/gross (before expenses) as well as the nature of the activity. " +
        "Are you trading as a self-employed sole trader, or is this occasional personal selling? " +
        "And what was your turnover before expenses for the tax year?",
    };
  }

  // "My business makes £X" — company vs sole trader
  if (
    /my (business|company|ltd)\s+(makes|earns|turnover|turns over)/i.test(
      lower,
    ) ||
    (/business makes\s*£?\s*[\d,]+/i.test(lower) &&
      !/(sole trader|self-?employ)/i.test(lower))
  ) {
    return {
      handled: true,
      confidence: "high",
      customer_reply:
        "Just to avoid mixing rules up: is that a limited company, or you as a sole trader/self-employed? " +
        "Limited-company turnover doesn’t create individual Making Tax Digital for Income Tax obligations the same way sole-trader/landlord qualifying income does. " +
        "Which structure is it, and is the figure turnover or profit?",
    };
  }

  // Company + normal job
  if (
    /(company|ltd|limited).*(job|paye|employ|salary)|(job|paye|employ|salary).*(company|ltd|limited)/i.test(
      lower,
    )
  ) {
    return {
      handled: true,
      confidence: "high",
      customer_reply:
        "If you have a limited company and a PAYE job, we need to separate the pieces: employment salary (PAYE), any personal Self Assessment income (e.g. dividends, rental, freelance), and the company’s own Corporation Tax/accounts. " +
        "TaxSimba’s SIMBA chat covers individual Self Assessment / MTD guidance — not full company accounts unless separately approved. " +
        "Which part do you want help with first — your PAYE job, personal Self Assessment, or the company?",
    };
  }

  // Sell things online — trading vs personal
  if (
    /sell(ing)? things online|sell online|ebay|etsy|vinted|marketplace/i.test(
      lower,
    ) &&
    !/(turnover|profit|registered|sole trader|self-?employ)/i.test(lower)
  ) {
    return {
      handled: true,
      confidence: "high",
      customer_reply:
        "It depends whether you’re casually selling personal belongings or running a trade as a sole trader. " +
        "Occasional sales of personal items are often different from a regular online business that may need Self Assessment. " +
        "Are you selling your own used possessions, or buying/making goods to sell for profit — and roughly what was the income before expenses last tax year? " +
        "If it is a trade, TaxSimba’s Self Assessment Simple (£119) is often the lowest suitable starting package once we confirm the facts.",
    };
  }

  // Crypto without detail
  if (
    /\b(crypto|bitcoin|ethereum|nft)\b/i.test(lower) &&
    !/(gain|disposal|sold|trading|income|self assessment|cgt)/i.test(lower)
  ) {
    return {
      handled: true,
      confidence: "high",
      customer_reply:
        "Crypto can be taxed in different ways depending on what you did — for example Capital Gains Tax on disposals, or Income Tax if you’re trading crypto as a business. " +
        "I won’t guess your treatment. Did you dispose of crypto (sell/exchange), receive it as income, or trade frequently as a business activity?",
    };
  }

  // Rental income bare
  if (
    /^(i )?(have )?rental income\.?$|i have rental income\.?$/i.test(lower) ||
    (/\brental income\b/.test(lower) &&
      lower.length < 80 &&
      !/(£|mtd|self assessment|paye|amount|turnover)/i.test(lower))
  ) {
    return {
      handled: true,
      confidence: "high",
      customer_reply:
        "Rental income usually needs to be considered for Self Assessment, and may also count toward Making Tax Digital qualifying income (with any self-employment turnover) using gross rents before many expenses. " +
        "Roughly how much rental income (before expenses) did you have, and for which tax year? Also — is this a residential let, Rent a Room, or something else?",
    };
  }

  return null;
}
