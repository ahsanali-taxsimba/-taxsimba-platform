/** Load product catalogue, starters and calculators from config. */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { CATALOG_DIR } from "../paths.js";
import { runtimePaths } from "../ops/runtime_paths.js";
import { publicPackagesCatalogue } from "./public.js";

type CatalogFn<T> = (() => T) & { clearCache?: () => void };

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(path.join(CATALOG_DIR, name), "utf-8"),
  ) as Record<string, unknown>;
}

/** Prefer runtime live overlay when present (auto-synced; no redeploy). */
function readPackagesCatalog(): Record<string, unknown> {
  const live = runtimePaths.catalogLive();
  if (existsSync(live)) {
    try {
      return JSON.parse(readFileSync(live, "utf-8")) as Record<string, unknown>;
    } catch {
      // fall through to baseline
    }
  }
  return readJson("packages.json");
}

function cachedLoader<T>(loader: () => T): CatalogFn<T> {
  let cache: T | null = null;
  const fn = (() => {
    if (cache === null) cache = loader();
    return cache;
  }) as CatalogFn<T>;
  fn.clearCache = () => {
    cache = null;
  };
  return fn;
}

export const packagesCatalog: CatalogFn<Record<string, any>> = cachedLoader(
  () => readPackagesCatalog(),
);

export const calculatorsCatalog: CatalogFn<Record<string, any>> = cachedLoader(
  () => readJson("calculators.json"),
);

export const startersCatalog: CatalogFn<Record<string, any>> = cachedLoader(
  () => readJson("starters.json"),
);

export function allPackagesFlat(): Record<string, Record<string, unknown>> {
  const cat = packagesCatalog();
  const out: Record<string, Record<string, unknown>> = {};
  for (const item of cat.self_assessment as Record<string, unknown>[]) {
    out[String(item.code)] = { ...item, family: "self_assessment" };
  }
  for (const item of cat.mtd as Record<string, unknown>[]) {
    out[String(item.code)] = { ...item, family: "mtd" };
  }
  const consultRaw = cat.consultation;
  const consultList = Array.isArray(consultRaw)
    ? (consultRaw as Record<string, unknown>[])
    : consultRaw
      ? [consultRaw as Record<string, unknown>]
      : [];
  for (const consult of consultList) {
    out[String(consult.code)] = { ...consult, family: "consultation" };
  }
  return out;
}

export function formatPackageLine(pkg: Record<string, unknown>): string {
  const price = pkg.price_gbp as number;
  const priceStr =
    typeof price === "number" && !Number.isInteger(price)
      ? `£${price.toFixed(2)}`
      : `£${price}`;
  return `${pkg.name}: ${priceStr} (${pkg.billing}; ${pkg.vat_note || ""})`.trim();
}

/**
 * Customer-safe catalogue text for the LLM — no internal codes, docs, or raw disclaimers.
 */
export function packageCatalogText(): string {
  const cat = packagesCatalog();
  const lines = [
    "Approved customer-facing TaxSimba packages (do not invent other prices or benefits):",
    "Self Assessment (per tax year):",
  ];
  for (const p of cat.self_assessment as Record<string, unknown>[]) {
    lines.push(`- ${formatPackageLine(p)}`);
  }
  lines.push("Making Tax Digital / Simbian (per month, VAT included):");
  for (const p of cat.mtd as Record<string, unknown>[]) {
    const xero =
      p.code === "MTD_STARTER"
        ? "Xero Simple"
        : p.code === "MTD_GROWTH"
          ? "Xero Ignite"
          : "Xero Grow";
    lines.push(`- ${formatPackageLine(p)} — includes ${xero} in the monthly price`);
  }
  const consultRaw = cat.consultation;
  const consultList = Array.isArray(consultRaw)
    ? (consultRaw as Record<string, unknown>[])
    : consultRaw
      ? [consultRaw as Record<string, unknown>]
      : [];
  const bookingLive = consultList.some((c) => c.booking_status === "live");
  lines.push("Private accountant video consultations (Google Meet; Stripe + Calendly when live):");
  for (const c of consultList) {
    const mins = c.duration_minutes ?? "?";
    lines.push(
      `- ${formatPackageLine(c)} — ${mins}-minute accountant advice only ` +
        `(no filing, bookkeeping or written report).`,
    );
  }
  lines.push(
    bookingLive
      ? "Online booking/payment is available when Stripe and Calendly confirm."
      : "Online booking/payment is not connected yet — do not claim a live booking, Stripe payment or free callback. Email alternative: info@taxsimba.co.uk.",
  );
  lines.push(
    "Approved facts only: Xero is included in each Simbian monthly price (no separate customer Xero charge). " +
      "Quarterly MTD updates and year-end Self Assessment are included subject to documented customer responsibilities. " +
      "Bookkeeping is within the agreed engagement scope with no fixed monthly transaction caps " +
      "(not unlimited historical reconstruction or out-of-scope work). " +
      "Support is email and client-dashboard messaging — not telephone onboarding. " +
      "Never promise priority support, quarterly business reviews or proactive tax planning. " +
      "Never invent inclusions. Recommend the lowest suitable package. " +
      "Use only the names Simbian Comply, Simbian Growth and Simbian Elite for MTD. " +
      "Links: https://www.taxsimba.co.uk/self-assessment · https://www.taxsimba.co.uk/making-tax-digital · https://www.taxsimba.co.uk/register",
  );
  return lines.join("\n");
}

export function matchCalculators(
  message: string,
  limit = 2,
): Record<string, unknown>[] {
  const text = message.toLowerCase();
  const scored: Array<[number, Record<string, unknown>]> = [];
  for (const item of calculatorsCatalog().items as Record<string, unknown>[]) {
    const topics = item.topics as string[];
    const score = topics.reduce((n, t) => n + (text.includes(t) ? 1 : 0), 0);
    if (score) scored.push([score, item]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.slice(0, limit).map(([, i]) => i);
}

export function resolvePackages(
  codes: string[],
): Record<string, unknown>[] {
  const flat = allPackagesFlat();
  return codes.filter((c) => c in flat).map((c) => flat[c]!);
}

export function publicCatalogPayload(websiteBaseUrl: string): Record<string, unknown> {
  const calc = calculatorsCatalog();
  const items = [];
  for (const item of calc.items as Record<string, unknown>[]) {
    const entry: Record<string, unknown> = {
      id: item.id,
      title: item.title,
      description: item.description,
      topics: item.topics,
    };
    const status = String(item.url_status || "stub");
    if (status === "live_verified" || status === "soft_or_generic") {
      entry.url = `${websiteBaseUrl.replace(/\/$/, "")}${item.path || ""}`;
    } else {
      entry.url = null;
    }
    items.push(entry);
  }
  return {
    packages: publicPackagesCatalogue(packagesCatalog()),
    calculators: { items },
    starters: (startersCatalog() as { starters: unknown }).starters,
  };
}
