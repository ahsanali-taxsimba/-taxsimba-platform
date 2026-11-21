/** Non-pushy package / calculator / follow-up recommendations from config only. */

import {
  allPackagesFlat,
  calculatorsCatalog,
  matchCalculators,
  packagesCatalog,
} from "../catalog/service.js";
import type {
  CalculatorCard,
  JourneyState,
  PackageCard,
} from "../models/schemas.js";
import { selectPackagesForMessage } from "./package_selection.js";

const SA_PRICE = /\b(package|packages|pricing|price|cost|how much)\b/i;
const MTD_PRICE = /\bmtd\b|\bmaking tax digital\b/i;
const CONSULT =
  /\b(consult(?:ation)?s?|book (a |an )?(call|meeting|slot|consult)|speak to (an )?accountant|talk to (an )?accountant|accountant consultation|quick tax advice|extended tax consultation)\b/i;
const NO_BUY =
  /\b(don'?t want to buy|do not want to buy|not looking to buy|no sales|just information|information only|general information only|only want information|not interested in (a )?package|don'?t sell|do not sell|do not recommend (a )?package|don'?t recommend (a )?package|avoid (a )?checkout|no packages?|dont want packages?|don'?t want packages?|do not want packages?|no pressure|just asking|curious only|do not want (a |any )?(paid )?package|don'?t want (a |any )?(paid )?package|just the answer|no paid (package|service)|without (a )?package|refuse (packages?|to buy|paid)|i refuse packages?|no buy|no sell|explain without selling)\b/i;
const EXISTING_CLIENT =
  /\b(existing (taxsimba )?client|already (a )?taxsimba|logged ?in|my dashboard|message my (assigned )?accountant|my assigned accountant)\b/i;

const DEFAULT_PRESSURE_NOTE =
  "Optional support — only if useful. Approved: package names/prices; Xero included in each Simbian monthly price " +
  "(Comply→Xero Simple, Growth→Xero Ignite, Elite→Xero Grow; no separate Xero charge); quarterly MTD updates and year-end SA " +
  "subject to documented customer responsibilities; email + dashboard messaging (not phone onboarding). " +
  "No fixed monthly transaction caps on Simbian packages (not unlimited out-of-scope work). No priority support, quarterly business reviews or proactive tax planning.";

const PENDING_STATUSES = new Set([
  "pending_taxsimba_signoff",
  "requires_approval",
  "pending_approval",
  "blocked_pending_taxsimba_approval",
  "missing_requires_approval",
  "unknown",
  "conflict_pending_approval",
  "mixed_approved_subject_to_scope_and_pending",
]);

function circumstanceReason(code: string, message: string): string {
  const lower = (message || "").toLowerCase();
  if (code === "SA_SIMPLE") {
    return "Lowest Self Assessment price that usually fits straightforward / single simple income situations.";
  }
  if (code === "SA_SMART") {
    return "Mid Self Assessment price when several income sources or more review is likely.";
  }
  if (code === "SA_ELITE") {
    return "Highest Self Assessment price — only suggested when complexity clearly exceeds mid-tier needs (£299).";
  }
  if (code === "MTD_STARTER") {
    return "Lowest Simbian Comply (£29.99/mo VAT included, Xero Simple included in that price) when Making Tax Digital support is needed — quarterly updates and year-end SA included subject to customer responsibilities; no fixed monthly transaction caps (not unlimited out-of-scope work).";
  }
  if (code === "MTD_GROWTH") {
    return "Mid Simbian Growth (£59.99/mo VAT included, Xero Ignite included in that price) when more support is likely — quarterly updates and year-end SA included subject to customer responsibilities; no fixed monthly transaction caps (not unlimited out-of-scope work).";
  }
  if (code === "MTD_COMPLETE") {
    return "Highest Simbian Elite (£89.99/mo VAT included, Xero Grow included in that price) only if mid-tier is clearly insufficient — no priority/QBR/planning promises; no fixed monthly transaction caps (not unlimited out-of-scope work).";
  }
  if (code === "ACCOUNTANT_CONSULT_99") {
    return "Quick Tax Advice — £99 for 20 minutes via Google Meet (focused question; no filing, bookkeeping or written report). Select this option, then book via Calendly (pay within Calendly → Meet) when live.";
  }
  if (code === "ACCOUNTANT_CONSULT_149") {
    return "Extended Tax Consultation — £149 for 40 minutes via Google Meet (more complex situations; no filing, bookkeeping or written report). Select this option, then book via Calendly (pay within Calendly → Meet) when live.";
  }
  if (lower.includes("unsure") || lower.includes("not sure")) {
    return "Suggested as a cautious next option while we clarify your circumstances.";
  }
  return "Suggested from approved catalogue prices for your stated circumstances — confirm unresolved entitlements with TaxSimba before purchasing.";
}

export function toPackageCards(
  codes: string[],
  message = "",
): PackageCard[] {
  const flat = allPackagesFlat();
  const cards: PackageCard[] = [];
  let first = true;
  for (const code of codes) {
    const pkg = flat[code];
    if (!pkg) continue;
    const statuses = pkg.inclusion_item_statuses as
      | Record<string, string>
      | undefined;
    const rawInclusions = Array.isArray(pkg.inclusions)
      ? (pkg.inclusions as string[])
      : [];
    let inclusions: string[] | null = null;
    if (pkg.customer_facing_inclusions) {
      inclusions = rawInclusions;
    } else if (statuses) {
      const approved = rawInclusions.filter((line) => {
        const st = String(statuses[line] || "").toLowerCase();
        return st === "approved" || st.startsWith("approved_");
      });
      inclusions = approved.length ? approved : null;
    }
    const isConsult =
      String(pkg.family) === "consultation" ||
      String(pkg.code).startsWith("ACCOUNTANT_CONSULT_");
    const registration_path = isConsult
      ? null
      : pkg.registration_route_id === "sa_packages"
        ? "/self-assessment"
        : pkg.registration_route_id === "mtd_packages"
          ? "/making-tax-digital"
          : pkg.registration_route_id === "register"
            ? "/register"
            : null;
    const choose_url = registration_path
      ? `https://www.taxsimba.co.uk${registration_path}`
      : null;
    cards.push({
      code: String(pkg.code),
      name: String(pkg.name),
      price_gbp: Number(pkg.price_gbp),
      billing: String(pkg.billing),
      vat_note: String(pkg.vat_note || ""),
      family: String(pkg.family),
      // Public cards: no internal approval workflow statuses.
      inclusions_status: inclusions ? "approved" : "not_listed",
      pressure_free_note: DEFAULT_PRESSURE_NOTE,
      description: null,
      inclusions,
      recommendation_reason: circumstanceReason(String(pkg.code), message),
      recommended: first && !isConsult,
      name_status: undefined,
      price_status: undefined,
      registration_path,
      choose_url,
    });
    first = false;
  }
  return cards;
}

/** True when the customer is asking for packages, prices, or a recommendation. */
export function wantsServiceRecommendation(message: string): boolean {
  if (visitorDeclinesSales(message)) return false;
  const lower = (message || "").toLowerCase();
  // “Do I need a package?” is obligation guidance — not a catalogue request.
  if (
    /\bdo i (even )?need (a |the |any )?(taxsimba )?(package|plan|service|subscription)\b/.test(
      lower,
    )
  ) {
    return false;
  }
  // Educational “explain …” is never a package ask — even if the word package appears in a refusal.
  if (
    /\bexplain\b/.test(lower) &&
    !/\b(which|recommend|cheapest|suitable|best|sign up|buy)\b/.test(lower)
  ) {
    return false;
  }
  // Bare “packages” inside “don’t want packages” must not trigger SA_PRICE.
  const priceAsk =
    SA_PRICE.test(message) &&
    !/\b(don'?t|dont|do not|no)\b.{0,20}\bpackages?\b/.test(lower);
  return (
    priceAsk ||
    CONSULT.test(message) ||
    /\b(recommend|suggestion|which (package|plan|option)|suitable (package|plan)|best (package|plan)|sign up|ready to register|register (on|with) taxsimba|buy (a |the )?(package|plan|service)|cheapest|lowest.?priced)\b/i.test(
      lower,
    ) ||
    (MTD_PRICE.test(message) &&
      /\b(plan|price|cost|package|how much|recommend)\b/i.test(lower))
  );
}

/**
 * True when the customer explicitly wants a price list or side-by-side comparison.
 * Ordinary “which package do you recommend?” is NOT a full catalogue dump.
 */
export function wantsPackageComparison(message: string): boolean {
  if (visitorDeclinesSales(message)) return false;
  const lower = (message || "").toLowerCase();
  if (
    /\b(compare|comparison|side by side|all (three|3|the) packages|list (the )?packages|what packages|which packages (are|do)|packages (are )?available|price list|full (price|package) list)\b/.test(
      lower,
    ) ||
    /\bwhat\b[\s\S]{0,40}\bpackages?\b/.test(lower) ||
    /\bpackages?\b[\s\S]{0,40}\b(offer|available|cost|price)\b/.test(lower)
  ) {
    return true;
  }
  // “How much do SA/MTD packages cost?” → overview; “which package?” → primary only.
  if (
    /\b(how much|what (do|are|is)|pricing|prices)\b/.test(lower) &&
    /\b(package|packages|plan|plans|simbian)\b/.test(lower) &&
    !/\b(which|recommend|suitable|best|cheapest)\b/.test(lower)
  ) {
    return true;
  }
  return false;
}

/**
 * One primary card by default. Comparison lists (max 3) only when asked.
 * Consultation intents may show both £99 and £149 options.
 */
export function limitPackageCodes(codes: string[], message: string): string[] {
  const unique = [...new Set(codes.filter(Boolean))];
  if (!unique.length) return [];
  if (unique.every((c) => c.startsWith("ACCOUNTANT_CONSULT_"))) {
    return unique.slice(0, 2);
  }
  if (wantsPackageComparison(message)) return unique.slice(0, 3);
  return unique.slice(0, 1);
}

export function visitorDeclinesSales(message: string): boolean {
  return NO_BUY.test(message || "");
}

export function toCalculatorCards(
  items: Record<string, unknown>[],
  websiteBase: string,
): CalculatorCard[] {
  const cards: CalculatorCard[] = [];
  for (const item of items) {
    let url: string | null = null;
    let note: string | null = null;
    const status = String(item.url_status || "stub");
    if (status === "live_verified") {
      url = `${websiteBase.replace(/\/$/, "")}${item.path || ""}`;
      note = "Verified public calculator on taxsimba.co.uk";
    } else if (status === "soft_or_generic") {
      url = `${websiteBase.replace(/\/$/, "")}${item.path || ""}`;
      note = "Reachable path — confirm destination before relying in production.";
    } else {
      note =
        "Calculator path configured but not confirmed on the live website yet.";
    }
    cards.push({
      id: String(item.id),
      title: String(item.title),
      description: String(item.description),
      url_status: status,
      url,
      note,
    });
  }
  return cards;
}

export function recommendForMessage(
  message: string,
  journey: JourneyState | null,
  websiteBase: string,
): {
  packages: PackageCard[];
  calculators: CalculatorCard[];
  follow_ups: string[];
} {
  let packages: PackageCard[] = [];
  let followUps: string[] = [];
  const declineSales = visitorDeclinesSales(message);

  if (journey && journey.complete) {
    packages = declineSales
      ? []
      : toPackageCards(
          limitPackageCodes(journey.suggested_package_codes || [], message),
          message,
        );
    const calcIds = new Set(journey.suggested_calculator_ids || []);
    const calcItems = (
      calculatorsCatalog().items as Record<string, unknown>[]
    ).filter((c) => calcIds.has(String(c.id)));
    const calculators = toCalculatorCards(calcItems, websiteBase);
    followUps = [...(journey.follow_ups || [])];
    if (declineSales) {
      followUps = [
        "What Self Assessment deadlines should I know?",
        "Where can I check this on GOV.UK?",
        ...followUps.filter(
          (f) => !f.includes("£99") && !f.toLowerCase().includes("package"),
        ),
      ];
    }
    return {
      packages,
      calculators,
      follow_ups: followUps.slice(0, 4),
    };
  }

  const cat = packagesCatalog();
  const lower = message.toLowerCase();
  const existingClient = EXISTING_CLIENT.test(message);
  const circumstanceCodes =
    declineSales || existingClient ? [] : selectPackagesForMessage(message);
  const wantsRec = wantsServiceRecommendation(message);

  if (declineSales) {
    followUps = [
      "What Self Assessment deadlines should I know?",
      "How does Making Tax Digital work in plain English?",
      "Where should I check this on GOV.UK?",
    ];
  } else if (existingClient) {
    packages = [];
    followUps = [
      "How do I send a secure message to my accountant in the dashboard?",
      "Where do I check my return status?",
      "How do I upload documents to TaxSimba?",
    ];
  } else if (circumstanceCodes.length && wantsRec) {
    // One primary card unless the customer asked to compare.
    packages = toPackageCards(
      limitPackageCodes(circumstanceCodes, message),
      message,
    );
    if (circumstanceCodes.includes("ACCOUNTANT_CONSULT_99")) {
      followUps = [
        "What can an accountant consultation help with?",
        "What Self Assessment packages are available?",
      ];
    } else if (circumstanceCodes.some((c) => c.startsWith("MTD_"))) {
      followUps = [
        "What is Making Tax Digital for Income Tax?",
        "Would you like to compare Simbian plans?",
      ];
    } else {
      followUps = [
        "Would you like to compare Self Assessment packages?",
        "Where do I register on TaxSimba?",
        "What happens after I sign up?",
      ];
    }
  } else if (circumstanceCodes.length && !wantsRec) {
    // Answer-first: no automatic sales cards on general tax questions.
    packages = [];
    if (circumstanceCodes.some((c) => c.startsWith("MTD_"))) {
      followUps = [
        "Would you like the lowest suitable Simbian plan for your situation?",
        "What is Making Tax Digital for Income Tax?",
      ];
    } else {
      followUps = [
        "Would you like a package recommendation for your situation?",
        "Do I need Self Assessment this year?",
      ];
    }
  } else if (
    wantsRec &&
    SA_PRICE.test(message) &&
    !MTD_PRICE.test(message)
  ) {
    const saCodes = (cat.self_assessment as { code: string }[]).map(
      (p) => p.code,
    );
    packages = toPackageCards(limitPackageCodes(saCodes, message), message);
    followUps = [
      wantsPackageComparison(message)
        ? "Which Self Assessment package fits my situation?"
        : "Would you like to compare Self Assessment packages?",
      "Do I need Self Assessment this year?",
      "What happens after I sign up?",
    ];
  } else if (wantsRec && MTD_PRICE.test(message) && SA_PRICE.test(message)) {
    // Mixed SA+MTD price ask: never dump six cards — lead with one primary, or compare within family.
    const mixed = wantsPackageComparison(message)
      ? [
          ...(cat.self_assessment as { code: string }[]).map((p) => p.code),
          ...(cat.mtd as { code: string }[]).map((p) => p.code),
        ].slice(0, 3)
      : ["SA_SIMPLE"];
    packages = toPackageCards(limitPackageCodes(mixed, message), message);
    followUps = [
      "Who needs Making Tax Digital?",
      "How do MTD plans differ from Self Assessment packages?",
    ];
  } else if (
    wantsRec &&
    MTD_PRICE.test(message) &&
    (lower.includes("plan") ||
      lower.includes("price") ||
      lower.includes("cost") ||
      lower.includes("package"))
  ) {
    const mtdCodes = (cat.mtd as { code: string }[]).map((p) => p.code);
    packages = toPackageCards(limitPackageCodes(mtdCodes, message), message);
    followUps = [
      wantsPackageComparison(message)
        ? "Which Simbian plan fits my situation?"
        : "Would you like to compare Simbian plans?",
      "Do landlords need MTD?",
    ];
  } else if (wantsRec && CONSULT.test(message)) {
    const consultCodes = (
      Array.isArray(cat.consultation)
        ? (cat.consultation as { code: string }[])
        : cat.consultation
          ? [cat.consultation as { code: string }]
          : []
    ).map((p) => p.code);
    packages = toPackageCards(
      limitPackageCodes(
        consultCodes.length
          ? consultCodes
          : ["ACCOUNTANT_CONSULT_99", "ACCOUNTANT_CONSULT_149"],
        message,
      ),
      message,
    );
    followUps = [
      "What’s the difference between the £99 and £149 consultations?",
      "Can I email TaxSimba support instead?",
    ];
  }

  if (!followUps.length) {
    if (lower.includes("deadline")) {
      followUps = [
        "Do I need to send a Self Assessment tax return?",
        "What are payments on account?",
      ];
    } else if (lower.includes("landlord") || lower.includes("rental")) {
      followUps = [
        "Do landlords need Self Assessment?",
        "What is Making Tax Digital for landlords?",
      ];
    } else if (lower.includes("cis")) {
      followUps = [
        "Do CIS subcontractors need Self Assessment?",
        "What records should I keep under CIS?",
      ];
    } else if (
      lower.includes("freelancer") ||
      lower.includes("self-employed") ||
      lower.includes("self employed")
    ) {
      followUps = [
        "How do I register as self-employed?",
        "When is the Self Assessment deadline?",
      ];
    }
  }

  const calculators = toCalculatorCards(
    matchCalculators(message),
    websiteBase,
  );
  return { packages, calculators, follow_ups: followUps };
}

/** Build a safe inclusions answer from catalogue only (pending items clearly labelled). */
export function answerInclusionsQuestion(message: string): string | null {
  const lower = message.toLowerCase();
  if (
    !(
      lower.includes("included") ||
      lower.includes("inclusion") ||
      /\binclud(e|es|ing)\b/.test(lower) ||
      lower.includes("what do i get") ||
      lower.includes("what's included") ||
      lower.includes("whats included") ||
      lower.includes("difference between") ||
      lower.includes("how do they differ") ||
      lower.includes("compare package") ||
      lower.includes("compare the package") ||
      lower.includes("xero") ||
      lower.includes("helpline") ||
      lower.includes("24/7") ||
      lower.includes("phone support")
    )
  ) {
    return null;
  }

  const cat = packagesCatalog();
  const lines: string[] = [
    "Here is what SIMBA can state from approved catalogue decisions:",
    "",
    "Self Assessment (per tax year): Simple £119 · Smart £149 · Elite £299.",
    "Making Tax Digital (per month, VAT included): Simbian Comply £29.99 · Simbian Growth £59.99 · Simbian Elite £89.99.",
    "Accountant video consultations: Quick Tax Advice £99 for 20 minutes · Extended Tax Consultation £149 for 40 minutes " +
      "(Google Meet; no filing, bookkeeping or written report). No free callbacks. " +
      "Booking path: choose an option → Calendly event → pay within Calendly → Meet. Online booking may be unavailable here — email is only a fallback enquiry route.",
    "",
    "Self Assessment is usually a once-a-year tax return service. Making Tax Digital (Simbian) is an ongoing monthly service " +
      "for people who need digital records and MTD support.",
    "",
    "What is approved to say:",
    "- Xero software is included in each Simbian monthly price (£29.99 / £59.99 / £89.99 VAT included) — customers do not pay separately.",
    "- Simbian Comply includes Xero Simple; Growth includes Xero Ignite; Elite includes Xero Grow.",
    "- Support is via email and the client dashboard — not telephone onboarding.",
    "- Bookkeeping is within the agreed engagement scope with no fixed monthly transaction caps (not unlimited out-of-scope work).",
    "- Quarterly MTD updates and year-end Self Assessment are included in all three Simbian plans, subject to documented customer responsibilities.",
    "",
    "I will not invent priority support, quarterly business reviews, proactive tax planning, free callbacks, or extra charges.",
    "",
    "I can recommend the lowest suitable package for your circumstances. " +
      "Review packages at https://www.taxsimba.co.uk/self-assessment and https://www.taxsimba.co.uk/making-tax-digital, " +
      "or start registration at https://www.taxsimba.co.uk/register.",
  ];

  if (
    lower.includes("amendment") ||
    lower.includes("refund") ||
    lower.includes("penalty") ||
    lower.includes("investigation")
  ) {
    lines.push(
      "",
      "Amendments, refunds, penalties and investigations are not yet listed as standard package inclusions — TaxSimba must confirm those case by case. I will not invent coverage.",
    );
  }

  if (
    lower.includes("priority") ||
    lower.includes("quarterly business") ||
    lower.includes("tax planning") ||
    lower.includes("helpline") ||
    lower.includes("24/7")
  ) {
    lines.push(
      "",
      "I cannot promise priority support, quarterly business reviews, proactive tax planning or a phone helpline — those are not approved customer entitlements in SIMBA.",
    );
  }

  if (lower.includes("xero")) {
    lines.push(
      "",
      "Xero software is included in the Simbian monthly subscription price — customers do not pay separately. " +
        "Catalogue mapping: Comply includes Xero Simple, Growth includes Xero Ignite, Elite includes Xero Grow. " +
        "I will not invent “forever free”, unlimited seats, or a separate Xero charge.",
    );
  }

  if (
    lower.includes("bookkeep") ||
    lower.includes("unlimited") ||
    lower.includes("transaction")
  ) {
    lines.push(
      "",
      "Bookkeeping is accountant-maintained. There are no fixed monthly transaction caps on Simbian packages, but that is not a promise of unlimited out-of-scope work.",
    );
  }

  for (const p of cat.self_assessment as Record<string, any>[]) {
    lines.push(`- ${p.name}: £${p.price_gbp} (${p.billing})`);
  }
  for (const p of cat.mtd as Record<string, any>[]) {
    lines.push(
      `- ${p.name}: £${Number(p.price_gbp).toFixed(2)} (${p.billing}; VAT included)`,
    );
  }

  void PENDING_STATUSES;
  void cat;
  return lines.join("\n");
}
