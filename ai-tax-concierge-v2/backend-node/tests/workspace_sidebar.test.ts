import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  calculatorsCatalog,
  packagesCatalog,
} from "../src/catalog/service.js";
import { loadFacts, reloadFacts } from "../src/knowledge/loader.js";
import { retrieve } from "../src/knowledge/retrieval.js";

const WIDGET = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../widget",
);

describe("workspace sidebar + VAT rolling-period knowledge", () => {
  it("sidebar_nav_options_present", () => {
    const html = readFileSync(path.join(WIDGET, "index.html"), "utf-8");
    for (const label of [
      "Chat with SIMBA",
      "Guided Help",
      "Tax Calculators",
      "Our Packages",
      "Book a Consultation",
      "FAQs",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("Accountant-led service");
    expect(html).toContain("ts-sidebar");
    expect(html).toContain("ts-mobile-nav");
  });

  it("workspace_css_tokens", () => {
    const css = readFileSync(
      path.join(WIDGET, "css/concierge.css"),
      "utf-8",
    ).toLowerCase();
    expect(css).toContain(".ts-sidebar");
    expect(css).toContain(".ts-workspace");
    expect(css).toContain("#006b3c");
    expect(css).not.toContain("#c6a75e");
  });

  it("seventeen_live_calculators", () => {
    const items = calculatorsCatalog().items;
    expect(items).toHaveLength(17);
    expect(items.every((i: { url_status?: string }) => i.url_status === "live_verified")).toBe(
      true,
    );
  });

  it("package_prices", () => {
    const cat = packagesCatalog();
    expect(cat.self_assessment.map((p: { price_gbp: number }) => p.price_gbp)).toEqual([
      119, 149, 299,
    ]);
    expect(cat.mtd.map((p: { price_gbp: number }) => p.price_gbp)).toEqual([
      29.99, 59.99, 89.99,
    ]);
    expect(
      cat.mtd.every((p: { vat_note?: string }) =>
        (p.vat_note || "").includes("VAT included"),
      ),
    ).toBe(true);
    expect(cat.consultation.price_gbp).toBe(99);
    expect(cat.consultation.duration_minutes).toBe(30);
  });

  it("vat_corpus_includes_rolling_and_forward_look", () => {
    reloadFacts();
    const facts = Object.fromEntries(loadFacts().map((f) => [f.id, f]));
    expect(facts).toHaveProperty("vat-registration-timing-tests");
    const summary = facts["vat-registration-timing-tests"].summary.toLowerCase();
    expect(summary.includes("12 months") || summary.includes("12-month")).toBe(
      true,
    );
    expect(summary.includes("30 day") || summary.includes("30-day")).toBe(true);
    const ranked = retrieve(
      "VAT registration rolling 12 months and forward looking 30 days £90000",
      "2025-26",
      5,
    );
    const blob = ranked
      .map((r) => `${r.fact.id} ${r.fact.title} ${r.fact.summary}`.toLowerCase())
      .join(" ");
    expect(blob).toContain("vat");
  });
});
