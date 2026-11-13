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
  "Optional support — only if useful. Verified items are prices (and SA names). " +
  "Feature inclusions are recovered from TaxSimba’s public plan API and still need TaxSimba confirmation before you rely on them.";

const PENDING_STATUSES = new Set([
  "pending_taxsimba_signoff",
  "blocked_pending_taxsimba_approval",
  "missing_requires_approval",
  "conflict_pending_approval",
]);

function circumstanceReason(code: string, message: string): string {
  const lower = (message || "").toLowerCase();
  if (code === "SA_SIMPLE") {
    return "Lowest Self Assessment price that usually fits straightforward / single simple income situations (price verified; inclusions pending confirmation).";
  }
  if (code === "SA_SMART") {
    return "Mid Self Assessment price when several income sources or more review is likely (price verified; inclusions pending confirmation).";
  }
  if (code === "SA_ELITE") {
    return "Highest Self Assessment price — only suggested when complexity clearly exceeds mid-tier needs (price verified at £299; inclusions pending confirmation).";
  }
  if (code === "MTD_STARTER") {
    return "Lowest MTD monthly price when Making Tax Digital support is needed (price verified VAT included; plan name/features pending confirmation).";
  }
  if (code === "MTD_GROWTH") {
    return "Mid MTD monthly price when more dedicated review is likely (price verified VAT included; features pending confirmation).";
  }
  if (code === "MTD_COMPLETE") {
    return "Highest MTD monthly price — only if mid-tier is clearly insufficient (price verified VAT included; name/features pending confirmation).";
  }
  if (code === "ACCOUNTANT_CONSULT_99") {
    return "£99 / 30-minute consultation when a human review is the safer next step (booking stub until Calendly is connected).";
  }
  if (lower.includes("unsure") || lower.includes("not sure")) {
    return "Suggested as a cautious next option while we clarify your circumstances.";
  }
  return "Suggested from verified catalogue prices for your stated circumstances — confirm inclusions with TaxSimba before purchasing.";
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
    const inclusions = Array.isArray(pkg.inclusions)
      ? (pkg.inclusions as string[])
      : null;
    cards.push({
      code: String(pkg.code),
      name: String(pkg.name),
      price_gbp: Number(pkg.price_gbp),
      billing: String(pkg.billing),
      vat_note: String(pkg.vat_note || ""),
      family: String(pkg.family),
      inclusions_status: String(
        pkg.inclusions_status || "pending_taxsimba_signoff",
      ),
      pressure_free_note: DEFAULT_PRESSURE_NOTE,
      description: pkg.description ? String(pkg.description) : null,
      inclusions,
      recommendation_reason: circumstanceReason(String(pkg.code), message),
      name_status: pkg.name_status ? String(pkg.name_status) : null,
      price_status: pkg.price_status ? String(pkg.price_status) : "verified",
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
      "Can I book a £99 accountant consultation instead?",
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
    packages = toPackageCards(
      [String((cat.consultation as { code: string }).code)],
      message,
    );
    followUps = [
      "What can an accountant consultation help with?",
      "What Self Assessment packages are available?",
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
    "Here is what is currently in the SIMBA catalogue (last reviewed 2026-11-13).",
    "",
    "VERIFIED: Self Assessment Simple £119, Smart £149, Elite £299 (per tax year); " +
      "MTD £29.99 / £59.99 / £89.99 per month (VAT included); consultation £99 / 30 minutes.",
    "",
    "Feature descriptions below were recovered from TaxSimba’s public subscription-plans API. " +
      "They are PENDING TaxSimba/accountant sign-off for SIMBA — please confirm with the TaxSimba team before purchasing. " +
      "I will not invent extra benefits.",
    "",
  ];

  for (const p of cat.self_assessment as Record<string, any>[]) {
    lines.push(`${p.name} — £${p.price_gbp} (${p.billing}) [price VERIFIED]`);
    if (p.description) {
      lines.push(`  Published description (PENDING APPROVAL): ${p.description}`);
    }
    if (Array.isArray(p.inclusions) && p.inclusions.length) {
      lines.push(
        `  Published inclusions (PENDING APPROVAL): ${p.inclusions.join("; ")}`,
      );
    }
  }
  lines.push("");
  for (const p of cat.mtd as Record<string, any>[]) {
    const conflict =
      p.name_status === "conflict_pending_approval"
        ? ` [name conflict vs public “${p.public_api_name}” — PENDING APPROVAL]`
        : "";
    lines.push(
      `${p.name} — £${Number(p.price_gbp).toFixed(2)} (${p.billing}; VAT included) [price VERIFIED]${conflict}`,
    );
    if (p.description) {
      lines.push(`  Published description (PENDING APPROVAL): ${p.description}`);
    }
    if (Array.isArray(p.inclusions) && p.inclusions.length) {
      lines.push(
        `  Published inclusions (PENDING APPROVAL): ${p.inclusions.join("; ")}`,
      );
    }
  }
  lines.push("");
  lines.push(
    "Explicit exclusions are MISSING and also require TaxSimba approval. " +
      "If your choice depends on a pending inclusion (for example a named Xero plan or priority support), " +
      "I must treat that as unconfirmed and recommend asking TaxSimba to confirm — " +
      "or book a £99 consultation when booking is connected. " +
      "You can review packages at https://www.taxsimba.co.uk/self-assessment and https://www.taxsimba.co.uk/making-tax-digital, " +
      "or start registration at https://www.taxsimba.co.uk/register (registration path status: soft/generic until staging verifies).",
  );

  // Keep unused helper referenced for clarity in audits
  void PENDING_STATUSES;
  return lines.join("\n");
}
