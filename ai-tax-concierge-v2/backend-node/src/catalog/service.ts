/** Load product catalogue, starters and calculators from config. */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { CATALOG_DIR } from "../paths.js";
import { runtimePaths } from "../ops/runtime_paths.js";

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
  const consult = cat.consultation as Record<string, unknown>;
  out[String(consult.code)] = { ...consult, family: "consultation" };
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

export function packageCatalogText(): string {
  const cat = packagesCatalog();
  const lines = [
    "Self Assessment packages (names + prices APPROVED):",
  ];
  for (const p of cat.self_assessment as Record<string, unknown>[]) {
    lines.push(`- ${formatPackageLine(p)}`);
  }
  lines.push(
    "MTD / Simbian plans (names + prices APPROVED; VAT included):",
  );
  for (const p of cat.mtd as Record<string, unknown>[]) {
    lines.push(`- ${formatPackageLine(p)}`);
    if (p.internal_code_note) {
      lines.push(`  Internal mapping: ${String(p.internal_code_note)}`);
    }
  }
  const c = cat.consultation as Record<string, unknown>;
  lines.push(
    `Consultation: ${formatPackageLine(c)} (booking status: ${c.booking_status || "unknown"})`,
  );
  const facts = (cat.approved_customer_facts || []) as Array<{
    status?: string;
    text?: string;
  }>;
  if (facts.length) {
    lines.push("Approved customer facts (use exact conditional wording; never upgrade to unconditional guarantees):");
    for (const fact of facts) {
      lines.push(`- [${String(fact.status || "approved")}] ${String(fact.text || "")}`);
    }
  }
  const removed = (cat.removed_customer_claims || []) as string[];
  if (removed.length) {
    lines.push(
      `REMOVED — never promise: ${removed.join("; ")}.`,
    );
  }
  lines.push(
    "CRITICAL: Never invent fixed monthly transaction caps or unlimited out-of-scope work. " +
      "Owner approved: no fixed monthly transaction caps on Simbian packages. " +
      "Never invent response-time SLAs, tax-planning packages, " +
      "quarterly business reviews, priority support, telephone onboarding, or extra charges. " +
      "Xero-in-price is approved with website mapping Comply→Simple, Growth→Ignite, Elite→Grow. " +
      "Items requiring clarification need TaxSimba confirmation — do not auto-approve website bullets. " +
      "Recommend the lowest suitable package; explain SA vs MTD; ask one clarifying question at a time; " +
      "give https://www.taxsimba.co.uk/self-assessment, https://www.taxsimba.co.uk/making-tax-digital, " +
      "or https://www.taxsimba.co.uk/register as appropriate. " +
      "Note: the public /making-tax-digital marketing page SEO currently mismatches the Simbian catalogue API — " +
      "prefer verified API catalogue facts. Use only Simbian Comply / Growth / Elite for MTD names. " +
      `Catalogue note: ${cat.disclaimer}`,
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
    const entry = { ...item };
    const status = String(item.url_status || "stub");
    if (status === "live_verified") {
      entry.url = `${websiteBaseUrl.replace(/\/$/, "")}${item.path || ""}`;
      entry.note =
        "Public calculator page title verified on taxsimba.co.uk";
    } else if (status === "soft_or_generic") {
      entry.url = `${websiteBaseUrl.replace(/\/$/, "")}${item.path || ""}`;
      entry.note = "Reachable but not fully confirmed";
      entry.configured_path = item.path;
    } else {
      entry.url = null;
      entry.note = "URL not confirmed against live website yet";
      entry.configured_path = item.path;
    }
    items.push(entry);
  }
  return {
    packages: packagesCatalog(),
    calculators: { ...calc, items },
    starters: (startersCatalog() as { starters: unknown }).starters,
  };
}
