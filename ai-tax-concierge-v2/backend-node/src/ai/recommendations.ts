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
const CONSULT = /\b(consult|accountant|book|speak to|talk to)\b/i;
const NO_BUY =
  /\b(don'?t want to buy|do not want to buy|not looking to buy|no sales|just information|information only|only want information|not interested in (a )?package|don'?t sell|do not sell|no pressure|just asking|curious only)\b/i;
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
    return "Lowest Self Assessment price that usually fits straightforward / single simple income situations (price approved; detailed inclusions pending confirmation).";
  }
  if (code === "SA_SMART") {
    return "Mid Self Assessment price when several income sources or more review is likely (price approved; detailed inclusions pending confirmation).";
  }
  if (code === "SA_ELITE") {
    return "Highest Self Assessment price — only suggested when complexity clearly exceeds mid-tier needs (price approved at £299; no priority/planning promises).";
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
    return "Quick Tax Advice — £99 for 20 minutes via Google Meet (focused question; no filing, bookkeeping or written report). Booking/payment not live until Stripe and Calendly are verified; email info@taxsimba.co.uk as an alternative.";
  }
  if (code === "ACCOUNTANT_CONSULT_149") {
    return "Extended Tax Consultation — £149 for 40 minutes via Google Meet (more complex situations; no filing, bookkeeping or written report). Booking/payment not live until Stripe and Calendly are verified; email info@taxsimba.co.uk as an alternative.";
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
      name_status: undefined,
      price_status: undefined,
      registration_path:
        pkg.registration_route_id === "sa_packages"
          ? "/self-assessment"
          : pkg.registration_route_id === "mtd_packages"
            ? "/making-tax-digital"
            : pkg.registration_route_id === "register"
              ? "/register"
              : null,
    });
  }
  return cards;
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
      : toPackageCards(journey.suggested_package_codes || [], message);
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
  } else if (circumstanceCodes.length) {
    packages = toPackageCards(circumstanceCodes, message);
    if (circumstanceCodes.includes("ACCOUNTANT_CONSULT_99")) {
      followUps = [
        "What can an accountant consultation help with?",
        "What Self Assessment packages are available?",
      ];
    } else if (circumstanceCodes.some((c) => c.startsWith("MTD_"))) {
      followUps = [
        "What is Making Tax Digital for Income Tax?",
        "Do landlords need MTD?",
        "Can you ask one question to narrow the plan?",
      ];
    } else {
      followUps = [
        "Can you ask one question to check which package fits?",
        "Do I need Self Assessment this year?",
        "Where do I register on TaxSimba?",
      ];
    }
  } else if (SA_PRICE.test(message) && !MTD_PRICE.test(message)) {
    packages = toPackageCards(
      (cat.self_assessment as { code: string }[]).map((p) => p.code),
      message,
    );
    followUps = [
      "What is published for each Self Assessment package?",
      "Do I need Self Assessment this year?",
      "What accountant consultations does TaxSimba offer?",
    ];
  } else if (MTD_PRICE.test(message) && SA_PRICE.test(message)) {
    packages = toPackageCards(
      [
        ...(cat.self_assessment as { code: string }[]).map((p) => p.code),
        ...(cat.mtd as { code: string }[]).map((p) => p.code),
      ],
      message,
    );
    followUps = [
      "Who needs Making Tax Digital?",
      "How do MTD plans differ from Self Assessment packages?",
    ];
  } else if (
    MTD_PRICE.test(message) &&
    (lower.includes("plan") ||
      lower.includes("price") ||
      lower.includes("cost"))
  ) {
    packages = toPackageCards(
      (cat.mtd as { code: string }[]).map((p) => p.code),
      message,
    );
    followUps = [
      "What is Making Tax Digital for Income Tax?",
      "Do landlords need MTD?",
    ];
  } else if (CONSULT.test(message)) {
    const consultCodes = (
      Array.isArray(cat.consultation)
        ? (cat.consultation as { code: string }[])
        : cat.consultation
          ? [cat.consultation as { code: string }]
          : []
    ).map((p) => p.code);
    packages = toPackageCards(
      consultCodes.length
        ? consultCodes
        : ["ACCOUNTANT_CONSULT_99", "ACCOUNTANT_CONSULT_149"],
      message,
    );
    followUps = [
      "What’s the difference between the £99 and £149 consultations?",
      "Can I email TaxSimba instead?",
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
      "Online booking/payment not connected yet — email info@taxsimba.co.uk.",
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
