/**
 * Circumstance clarification — ask one useful question before guessing obligations.
 * Prefer this over SA/MTD handlers when key facts (income type, amount, tax year) are missing.
 */

export type ClarifierResult = {
  handled: boolean;
  customer_reply: string;
  confidence: "high" | "medium" | "low";
  /** When true, engine should prefer this over SA/MTD “needs_more_info” probes. */
  prefer_over_eligibility_probe?: boolean;
};

const SA_WHO =
  "https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return";
const MTD_IF =
  "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax";
const MTD_QI =
  "https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax";

function hasAmount(lower: string): boolean {
  return /£\s*[\d,]+|\b\d{1,3}\s*k\b|turnover|before expenses/i.test(lower);
}

function hasTaxYear(lower: string): boolean {
  return /20\d{2}\s*[-–/]\s*\d{2}|tax year|2024|2025|2026|2027/i.test(lower);
}

function hasIncomeType(lower: string): boolean {
  return /(self-?employ|sole[- ]?trader|paye|salary|payroll|rental|property|profit|turnover|freelance|trading|landlord|qualifying income|dividend|crypto)/i.test(
    lower,
  );
}

export function answerAmbiguousIntent(
  message: string,
  history?: Array<{ role: string; content: string }> | null,
): ClarifierResult | null {
  const lower = (message || "").toLowerCase().trim();
  if (!lower) return null;

  const priorUser = (history || [])
    .filter((h) => h.role === "user")
    .map((h) => h.content)
    .join("\n")
    .toLowerCase();
  const ctx = `${priorUser}\n${lower}`.trim();

  // Vague gig / slang / creator income without amount — clarify first (do not assert SA).
  if (
    /(deliver(y|ies|oo)|uber|bolt|just.?eat|tiktok|youtube|onlyfans|vinted|ebay|etsy|babysitting|dog walking|side hustle|made some money|earned a bit|cash.?in.?hand)/i.test(
      lower,
    ) &&
    !hasAmount(lower) &&
    (/(what do i need|hmrc|tax|register|sa\b|self assessment|accountant|owe|fine right)/i.test(
      lower,
    ) ||
      /^(i )?(earned a bit|made some money|do(ing)? (some )?deliveries)/i.test(lower) ||
      lower.length < 80)
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "Happy to help — I need one key fact before saying whether Self Assessment usually applies. " +
        "Roughly how much did you earn from that activity before expenses, and for which UK tax year (6 April–5 April)? " +
        "If it is self-employment trading and more than £1,000 in a tax year, you usually need Self Assessment — but I won’t decide from a vague “some money” figure alone. " +
        `Guidance: ${SA_WHO}`,
    };
  }

  // “Do I need an accountant?” without circumstances
  if (
    /(do i (actually )?need an accountant|should i get an accountant|accountant\?+)/i.test(
      lower,
    ) &&
    !hasAmount(lower) &&
    !/(investigation|letter|penalty|complex|partnership)/i.test(lower)
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "It depends on your circumstances — many people can DIY Self Assessment or Making Tax Digital with good records, while others prefer an accountant for complexity, letters, or peace of mind. " +
        "What income types do you have (PAYE, self-employment, property, investments), roughly how much before expenses, and for which tax year? " +
        "I can explain the rules first; a paid TaxSimba consultation is optional if you later want personalised advice.",
    };
  }

  // Bare “PAYE so I’m fine?” without confirming other income — clarify first
  if (
    /(boss pays|paye already|paid through paye|employer (already )?taxes).{0,40}(fine|sorted|ok|alright|all good)/i.test(
      lower,
    ) &&
    !hasAmount(lower) &&
    !/(freelance|self-?employ|rent|property|side)/i.test(lower)
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "PAYE usually covers tax on that employment income, but it does not automatically mean you have no Self Assessment duties. " +
        "Do you have any other income in the tax year — for example self-employment, property rent, untaxed interest, dividends, or crypto disposals? " +
        "If it is truly PAYE-only, you usually do not need Making Tax Digital for Income Tax either. " +
        `Guidance: ${SA_WHO}`,
    };
  }

  // PAYE + “I rent a flat” is ambiguous (tenant vs landlord) without more facts
  if (
    /(paye|job already tax|employer taxes|boss pays)/i.test(lower) &&
    /\brent(s|ing)? a (flat|house|property)\b|\bi rent\b/i.test(lower) &&
    !/(rent out|landlord|rental income|tenant pays me)/i.test(lower) &&
    !hasAmount(lower)
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "Just to check — are you renting a flat as a tenant (your rent is usually not taxable income), or do you receive rent from letting a property? " +
        "PAYE on employment does not cover rental income you receive as a landlord. " +
        "Which is it, and if you receive rent, roughly how much before expenses and for which tax year?",
    };
  }

  // Low babysitting / casual help with small stated amount — clarify trading vs casual before asserting SA
  if (
    /(babysitting|dog walking|gardening|tutoring|cash.?in.?hand)/i.test(lower) &&
    /£\s*([1-9]\d{0,2}|1,?000)\b/.test(lower) &&
    /(sa\b|self assessment|tax|register|hmrc)/i.test(lower)
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "Happy to help — I need one key fact: was this casual occasional help, or regular self-employment trading? " +
        "GOV.UK’s usual sole-trader Self Assessment rule uses more than £1,000 of trading income in a tax year (before reliefs). " +
        "At or under £1,000 you often may not need to tell HMRC for that trading income alone, but exceptions apply. " +
        "Which tax year is the figure for, and is it your only extra income? " +
        `Guidance: ${SA_WHO} · https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income`,
    };
  }

  // Educational: trading allowance (do not confuse with SA more-than-£1,000 test)
  if (
    /explain trading allowance|what is (the )?trading allowance|trading allowance\??$/i.test(
      lower,
    )
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "The trading allowance is a tax relief of up to £1,000 a year for trading/self-employment income (and there is a separate property allowance). " +
        "If your annual gross trading income is £1,000 or less you may not need to tell HMRC about that trading income (with exceptions). " +
        "If your trading income is more than £1,000 you usually still need Self Assessment — you can then use the allowance as partial relief instead of expenses, or claim actual expenses instead. " +
        "Do not confuse the trading allowance with the Self Assessment “more than £1,000” registration test. " +
        "https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income · " +
        "https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return",
    };
  }

  // Educational: what is the dividend allowance
  if (/what is the dividend allowance|dividend allowance\??$/i.test(lower)) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "The dividend allowance is £500 each tax year (current GOV.UK). " +
        "You only pay dividend tax on dividend income above that allowance (and after any unused Personal Allowance). " +
        "Whether you must send a Self Assessment return depends on your total income and other circumstances, not the allowance figure alone. " +
        "Official guidance: https://www.gov.uk/tax-on-dividends",
    };
  }

  // Guaranteed refund — refuse
  if (/guarantee.*(refund|tax back)|promise.*(refund|tax back)/i.test(lower)) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "I can’t guarantee a tax refund. Refunds depend on your full circumstances and HMRC’s assessment. " +
        "I can explain how Self Assessment balancing payments and repayments usually work, or you can choose a paid accountant video consultation (Quick £99 / 20 minutes or Extended £149 / 40 minutes) if you want personalised advice.",
    };
  }

  // Existing accountant
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
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "If you already have an accountant, they should lead your filings and MTD software setup. " +
        "I can still explain the HMRC rules in plain English. " +
        "If you’re a TaxSimba client, message your assigned accountant through your secure dashboard rather than booking a new public consultation unless you specifically need one. " +
        "What would you like clarified?",
    };
  }

  // Cheapest package — only when explicitly asking
  if (
    /cheapest package|lowest (suitable )?package|cheapest (sa|self assessment)/i.test(
      lower,
    )
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "For a straightforward first-time Self Assessment, the lowest approved TaxSimba package is Self Assessment Simple at £119 per tax year. " +
        "Smart (£149) or Elite (£299) only if your affairs are more complex. " +
        "Tell me briefly about your income types and I can confirm the lowest suitable option — or start at https://www.taxsimba.co.uk/self-assessment.",
    };
  }

  // --- Employment / PAYE uncertainty (do not assume self-employment) ---
  if (
    /\bp60\b/.test(lower) &&
    !/(self-?employ|freelance|rental|property|untaxed)/i.test(ctx)
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "A P60 summarises PAYE pay and tax deducted for a tax year — keep it for your records. " +
        "It does not automatically mean you must file a Self Assessment return. " +
        "Do you have any other income (freelance, property, untaxed interest, etc.), or has HMRC asked you to file? " +
        `Who must send a return: ${SA_WHO}`,
    };
  }

  if (
    /(two (paye )?jobs|2 (paye )?jobs|more than one (paye )?job)/i.test(lower) &&
    /(self assessment|tax return|file|must i)/i.test(lower) &&
    !/(freelance|self-?employ|rental|property|side)/i.test(lower)
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "Having two PAYE jobs does not automatically mean you must file a Self Assessment tax return. " +
        "You may still need one if tax was under-collected, you have other untaxed income, or another GOV.UK trigger applies. " +
        "Do either employer’s tax codes look wrong, or do you have any income outside PAYE? " +
        `Guidance: ${SA_WHO}`,
    };
  }

  if (
    /(left (my )?job|finished (my )?job|stopped working|mid-year)/i.test(lower) &&
    /(self assessment|\bsa\b|tax return|file)/i.test(lower) &&
    !/(freelance|self-?employ|rental|property|side|trading)/i.test(ctx)
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "Leaving a job mid-year does not by itself create a Self Assessment duty. " +
        "PAYE should usually settle employment tax; you may still need a return if you have other untaxed income or HMRC asks you to file. " +
        "Do you have any self-employment, property, or other untaxed income for that tax year? " +
        `Guidance: ${SA_WHO}`,
    };
  }

  if (
    /company car|benefit in kind|p11d/i.test(lower) &&
    /(self assessment|tax return|file)/i.test(lower)
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "Company car and many benefits are often reported by your employer (for example on a P11D) and taxed through PAYE adjustments — that is not the same as automatically needing Self Assessment. " +
        "You may still need a return for other reasons on GOV.UK. " +
        "Do you have any income outside employment, or has HMRC asked you to file? " +
        `Guidance: ${SA_WHO}`,
    };
  }

  if (
    /(employer).*(underpaid|under-paid|wrong tax)|underpaid my tax/i.test(lower)
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "If PAYE was underpaid, HMRC or your employer may correct it through a tax code, a P800 calculation, or sometimes Self Assessment — it depends on the figures. " +
        "I can’t safely say you need an accountant without more detail. " +
        "Has HMRC written to you (for example a P800), and do you have any income outside PAYE? " +
        "If you want personalised review of letters/figures, a paid TaxSimba consultation (£99 / £149) is available — otherwise check your Personal Tax Account on GOV.UK.",
    };
  }

  // Rent + PAYE without rental amount
  if (
    /(rent (out )?my|landlord|buy-?to-?let|rental|let(ting)? (a |my )?(flat|house|property))/i.test(
      lower,
    ) &&
    /(paye|employer|salary|job)/i.test(lower) &&
    !hasAmount(lower)
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "PAYE on your salary does not tax your rental income. Property income is usually reported through Self Assessment. " +
        "Roughly how much rent did you receive before expenses, and for which tax year? " +
        `Who must send a return: ${SA_WHO}`,
    };
  }

  // Two jobs + side business without amounts
  if (
    /(two jobs|2 jobs).*(side)|side business|side hustle/i.test(lower) &&
    !hasAmount(lower)
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "Your PAYE jobs and any side business need separating. " +
        "If the side activity is self-employment and turnover is more than £1,000 in a tax year, you usually need Self Assessment. " +
        "Roughly how much did the side business earn before expenses, and for which tax year? " +
        `Guidance: ${SA_WHO}`,
    };
  }

  // Room let / lodger / Airbnb without amount
  if (
    /(let a room|rent a room|lodger|spare room|airbnb)/i.test(lower) &&
    /(taxsimba|self assessment|\bsa\b|tax|need|paye|nurse|job)/i.test(lower) &&
    !hasAmount(lower)
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "Letting a room can fall under the Rent a Room Scheme or normal property income rules depending on the setup. " +
        "Roughly how much rent did you receive, is it furnished accommodation in your home, and for which tax year? " +
        "I won’t recommend a TaxSimba package until we know whether you actually need Self Assessment. " +
        "https://www.gov.uk/rent-room-in-your-home/the-rent-a-room-scheme",
    };
  }

  // Educational / vague MTD — explain + ask facts (do not invent eligibility).
  // Do not steal precise process questions (replace return / agent submit).
  if (
    /(what('?s| is) (this )?making tax digital|mtd thing|keep hearing about|special software for tax|what does quarterly update)/i.test(
      lower,
    ) &&
    !hasAmount(lower) &&
    !/replace|accountant submit|agent submit/i.test(lower)
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "Making Tax Digital for Income Tax is HMRC’s system for many sole traders and landlords who must keep digital records and send quarterly updates. " +
        "It uses qualifying income (self-employment and property turnover before expenses) — not PAYE salary. " +
        "Bands use exclusive “more than” thresholds (£50,000 / £30,000 / £20,000) with start dates from 6 April 2026 onwards depending on the tax year. " +
        "Do you have self-employment or property income, roughly how much before expenses, and for which tax year? " +
        `Guidance: ${MTD_IF} · ${MTD_QI}`,
    };
  }

  // Property/rent amount asked for MTD / “digital tax” without tax year
  if (
    /(property|rent|landlord|rental)/i.test(lower) &&
    /(mtd|making tax digital|digital tax)/i.test(lower) &&
    hasAmount(lower) &&
    !hasTaxYear(lower)
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "For Making Tax Digital I need the tax year that rent/turnover figure relates to, because each band uses a different year:\n" +
        "• more than £50,000 in 2024-25 → from 6 April 2026\n" +
        "• more than £30,000 in 2025-26 → from 6 April 2027\n" +
        "• more than £20,000 in 2026-27 → from 6 April 2028\n\n" +
        "Which tax year is your figure for? (Use turnover/gross rent before expenses — PAYE salary does not count.)\n" +
        `Guidance: ${MTD_IF}`,
    };
  }

  // Bare "I earn £X" without income-type
  if (
    !hasIncomeType(lower) &&
    (/^i (earn|make|get)\s*£?\s*[\d,]+k?\b/.test(lower) ||
      /i (earn|make)\s*£?\s*[\d,]+/.test(lower))
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "Happy to help — I need a little more detail before I can give an accurate answer. " +
        "Is that figure PAYE employment salary, self-employment turnover, profit after expenses, rental income, or something else — and which tax year? " +
        "I won’t infer Self Assessment or Making Tax Digital from a total income figure alone.",
    };
  }

  // Vague digital tax + earn £X
  if (
    (/(this new digital|digital tax thing|does this new digital)/i.test(lower) ||
      (/i earn\s*£?\s*[\d,]+k?/i.test(lower) &&
        /(digital tax|making tax digital|\bmtd\b)/i.test(lower))) &&
    !/(self-?employ|sole[- ]?trader|freelance|property|rental|landlord|paye|salary|payroll|turnover|qualifying|start date|remind me the year|threshold)/i.test(
      lower,
    )
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "Making Tax Digital for Income Tax depends on qualifying income (self-employment and property turnover before expenses) — not PAYE salary alone. " +
        "Is your £ figure PAYE employment, self-employment turnover, property rent, or a mix — and which tax year? " +
        `Official guidance: ${MTD_IF}`,
    };
  }

  // Informal gig / cash work — uncertain amount and/or premature accountant ask
  if (
    /(tiktok|youtube|instagram|onlyfans|uber|deliveroo|bolt|side hustle|side business|make money on|\bdj\b|cash-?in-?hand|cash weekend|weekend (work|bar)|bar work|not sure (of )?totals|not sure how much|marketplace selling|depop|vinted)/i.test(
      lower,
    ) &&
    /(hmrc|tax|tell|register|accountant|self assessment|\bsa\b|need)/i.test(
      lower,
    ) &&
    (!hasAmount(lower) ||
      /\b(maybe|perhaps|not sure|around|about|roughly|approx)\b/i.test(lower) ||
      /\baccountant\b/i.test(lower))
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "Happy to help — I need one key fact before saying whether you must tell HMRC or whether an accountant is useful. " +
        "Roughly how much did you earn from that activity before expenses, and for which tax year? " +
        "If it is self-employment / trading and more than £1,000 in a tax year, you usually need Self Assessment. " +
        `Official guidance: ${SA_WHO}`,
    };
  }

  // Profit from online trading — clarify gross vs profit
  if (
    /£?\s*[\d,]+\s*profit/.test(lower) &&
    /(online|trading|etsy|ebay|shopify|side)/i.test(lower)
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "Thanks — a profit figure is useful, but for Self Assessment and Making Tax Digital HMRC usually needs turnover/gross (before expenses) as well as the nature of the activity. " +
        "Are you trading as a self-employed sole trader, or is this occasional personal selling? " +
        "And what was your turnover before expenses for the tax year?",
    };
  }

  // Business makes £X — company vs sole trader
  if (
    /my (business|company|ltd)\s+(makes|earns|turnover|turns over)/i.test(
      lower,
    ) ||
    (/business makes\s*£?\s*[\d,]+/i.test(lower) &&
      !/(sole trader|self-?employ)/i.test(lower))
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "Just to avoid mixing rules up: is that a limited company, or you as a sole trader/self-employed? " +
        "Limited-company turnover doesn’t create individual Making Tax Digital for Income Tax obligations the same way sole-trader/landlord qualifying income does. " +
        "Which structure is it, and is the figure turnover or profit?",
    };
  }

  // Company + job
  if (
    /(company|ltd|limited).*(job|paye|employ|salary)|(job|paye|employ|salary).*(company|ltd|limited)/i.test(
      lower,
    )
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "If you have a limited company and a PAYE job, we need to separate the pieces: employment salary (PAYE), any personal Self Assessment income (e.g. dividends, rental, freelance), and the company’s own Corporation Tax/accounts. " +
        "TaxSimba’s SIMBA chat covers individual Self Assessment / MTD guidance — not full company accounts unless separately approved. " +
        "Which part do you want help with first — your PAYE job, personal Self Assessment, or the company?",
    };
  }

  // Sell things online
  if (
    /sell(ing)? things online|sell online|ebay|etsy|vinted|marketplace/i.test(
      lower,
    ) &&
    !/(turnover|profit|registered|sole trader|self-?employ)/i.test(lower)
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "It depends whether you’re casually selling personal belongings or running a trade as a sole trader. " +
        "Occasional sales of personal items are often different from a regular online business that may need Self Assessment. " +
        "Are you selling your own used possessions, or buying/making goods to sell for profit — and roughly what was the income before expenses last tax year?",
    };
  }

  // CIS unclear
  if (
    /\bcis\b|construction industry/i.test(lower) &&
    /(refund|invoice|app|sole trader)/i.test(lower) &&
    !/turnover|£\s*[\d,]+/i.test(lower)
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "CIS deductions on invoices do not automatically replace Self Assessment for subcontractors. " +
        "Are you a sole-trader subcontractor in construction, and roughly what was your turnover before expenses for the tax year? " +
        "I won’t promise a refund amount from chat. " +
        "https://www.gov.uk/what-is-the-construction-industry-scheme",
    };
  }

  // Personal one-off sale
  if (
    /(sold (my |a )?(personal )?(bike|sofa|laptop|phone|clothes)|one-?off sale|sold .* once)/i.test(
      lower,
    ) &&
    !/(business|trading|ebay shop|regularly)/i.test(lower)
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "A one-off sale of a personal possession is often not a trade — but regularly buying to sell, or selling as a business, can be different. " +
        "Was this a one-off sale of something you owned personally, or are you buying/making items to sell for profit? " +
        `Who must send a return: ${SA_WHO}`,
    };
  }

  // Joint property / partner share
  if (
    /(partner|spouse|joint|50\/50|50-50).{0,40}(let|rent|property|landlord)|(let|rent|property).{0,40}(partner|spouse|joint|50\/50)/i.test(
      lower,
    ) &&
    /(who files|self assessment|return|tax)/i.test(lower)
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "Joint property income is usually declared by each owner on their own Self Assessment return according to their beneficial share — unless you have a formal partnership return situation. " +
        "Are you joint beneficial owners of a let property (and in what shares), or trading as a partnership business? Also roughly how much rent before expenses and for which tax year? " +
        `Guidance: ${SA_WHO}`,
    };
  }

  // Dividend allowance / when SA might be needed
  if (
    /dividend/i.test(lower) &&
    /(allowance|how (much|are).*tax|tax on dividend|self assessment|tax return|file|return\?|when might)/i.test(
      lower,
    )
  ) {
    const needsOtherIncome =
      !/(paye|salary|total income|other income)/i.test(lower) &&
      /(self assessment|tax return|file|return\?|when might)/i.test(lower);
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "You also get a dividend allowance of £500 each year (current GOV.UK) — you only pay dividend tax on dividend income above that allowance (and after any unused Personal Allowance). " +
        "Whether you must send a Self Assessment return depends on your total income and other circumstances, not the dividend figure alone. " +
        (needsOtherIncome
          ? "What other income do you have (for example PAYE salary), and for which tax year? "
          : "") +
        `Official guidance: https://www.gov.uk/tax-on-dividends · Who must send a return: ${SA_WHO}`,
    };
  }

  // Educational: filing vs payment deadline — do not dump packages
  if (
    /difference between (filing|payment) deadline|filing deadline and payment|payment deadline and filing/i.test(
      lower,
    )
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "The filing deadline is when HMRC must receive your Self Assessment tax return; the payment deadline is when any tax you owe must be paid. " +
        "For online returns these are often both 31 January following the tax year, but paper filing is earlier — confirm the year pairing on GOV.UK. " +
        "https://www.gov.uk/self-assessment-tax-returns/deadlines",
    };
  }

  // Educational: landlord repairs vs improvements (capital)
  if (
    /difference between repairs? and improvements?|repairs?.{0,20}improvements?.{0,20}landlord|improvements?.{0,20}repairs?.{0,20}(landlord|rental|property)/i.test(
      lower,
    )
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "For property rental income, allowable expenses usually include maintenance and repairs that restore the property toward its original condition " +
        "(for example fixing a leak, replacing a broken boiler, or redecorating between tenants). " +
        "Improvements and other capital expenditure — work that adds something new, or alters/upgrades the property (for example an extension or a higher-specification kitchen) — " +
        "are generally not deductible against rental income (keep records; they may matter for Capital Gains Tax later). " +
        "Borderline cases can be fact-specific; use GOV.UK and consider an accountant for unusual works. " +
        "https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-working-out-your-rental-income",
    };
  }

  // Educational: what is SA / what is MTD — explain first (no personal filing conclusion).
  if (
    /^(what is|what's|whats|what even is) (self assessment|sa)\b|explain self assessment|what does self assessment mean|self assessment without the jargon/i.test(
      lower,
    )
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "Self Assessment is HMRC’s system for people who need to report income that isn’t fully taxed another way (for example through PAYE alone). " +
        "You report the relevant income, expenses, allowances and other information on your tax return, and your Self Assessment calculation determines the tax due. " +
        "Many sole traders, landlords and people with untaxed income must send a return — but whether that applies to you depends on your circumstances. " +
        "If you share your income types and a rough amount for a tax year, I can help you check. " +
        `Official guidance: ${SA_WHO}`,
    };
  }

  if (
    /^(what is|what's|whats) (mtd|making tax digital)\b|tell me about making tax digital|what is this digital tax|digital tax thing|explain making tax digital/i.test(
      lower,
    )
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "Making Tax Digital for Income Tax is HMRC’s way for many sole traders and landlords in Self Assessment to keep digital records and send quarterly updates of self-employment and property income. " +
        "MTD quarterly updates do not replace your annual tax return. If you’re within MTD, you’ll also submit your tax return through compatible software. " +
        "Whether you must use it depends on your qualifying income (self-employment + property turnover before expenses) for specific tax years. " +
        "PAYE salary alone does not count. " +
        `Official guidance: ${MTD_IF}`,
    };
  }

  // Crypto — clarify event type before asserting SA/CGT
  if (
    /\b(crypto|bitcoin|ethereum|nft|cryptoassets?)\b/i.test(lower) &&
    /(tax|self assessment|cgt|gain|return|buy|sell|disposal)/i.test(lower)
  ) {
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "Crypto tax usually depends on what you did: buying is not normally a taxable disposal by itself; tax more often arises when you dispose of crypto (sell, exchange, or certain other events), and frequent trading can be Income Tax instead of Capital Gains Tax. " +
        "I won’t invent your treatment. Have you already disposed of any crypto in a UK tax year, and was it investment-style holding or business-like trading? " +
        "https://www.gov.uk/guidance/check-if-you-need-to-pay-tax-when-you-sell-cryptoassets",
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
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply:
        "Rental income usually needs to be considered for Self Assessment, and may also count toward Making Tax Digital qualifying income (with any self-employment turnover) using gross rents before many expenses. " +
        "Roughly how much rental income (before expenses) did you have, and for which tax year? Also — is this a residential let, Rent a Room, or something else?",
    };
  }

  // VAT registration — state the current GOV.UK £90,000 overview threshold,
  // and explain the rolling 12-month / future-expectation tests.
  if (
    /\bvat\b/i.test(lower) &&
    /(register|threshold|£\s*[\d,]+|\d+\s*k\b)/i.test(lower) &&
    !/(already registered|vat return|how to file vat)/i.test(lower)
  ) {
    const personalFigure = /£\s*[\d,]+|\d+\s*k\b/.test(lower);
    return {
      handled: true,
      prefer_over_eligibility_probe: true,
      confidence: "high",
      customer_reply: personalFigure
        ? "VAT registration usually depends on your taxable turnover on a rolling 12-month basis (and sometimes on future expectations), not a single figure in isolation. " +
          "The current GOV.UK overview threshold is £90,000. " +
          "Tell me whether your £ figure is the last 12 months’ taxable supplies, expected next 30 days, or something else. " +
          "https://www.gov.uk/vat-registration-thresholds"
        : "You usually need to register for VAT if your VAT taxable turnover is more than £90,000 (current GOV.UK overview). " +
          "That test is normally on a rolling 12-month basis, and there is also a forward-looking test if you expect to exceed the threshold in the next 30 days. " +
          "https://www.gov.uk/vat-registration-thresholds",
    };
  }

  return null;
}
