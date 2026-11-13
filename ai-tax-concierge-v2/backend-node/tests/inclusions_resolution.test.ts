import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  answerInclusionsQuestion,
  recommendForMessage,
  toPackageCards,
} from "../src/ai/recommendations.js";
import {
  packagesCatalog,
  packageCatalogText,
} from "../src/catalog/service.js";
import { primaryRecommendationIsNotMostExpensive } from "../src/ai/package_selection.js";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const WEBSITE = "https://www.taxsimba.co.uk";

describe("inclusions resolution — Simbian names + owner decisions", () => {
  it("versioned_catalogue_exists_with_statuses", () => {
    const raw = readFileSync(
      path.join(
        ROOT,
        "data/catalog/packages_inclusions_catalogue.v2026-11-13.json",
      ),
      "utf-8",
    );
    const cat = JSON.parse(raw);
    expect(cat.last_reviewed).toBe("2026-11-13");
    expect(cat.status_summary.prices).toBe("VERIFIED");
    expect(cat.self_assessment[2].price_gbp.value).toBe(299);
  });

  it("runtime_packages_use_simbian_names_and_verified_prices", () => {
    const cat = packagesCatalog();
    expect(cat.detailed_recommendations_status).toBe(
      "owner_decisions_applied_remaining_scope_pending",
    );
    expect(cat.self_assessment.map((p: { price_gbp: number }) => p.price_gbp)).toEqual([
      119, 149, 299,
    ]);
    expect(cat.mtd.map((p: { name: string; price_gbp: number }) => [p.name, p.price_gbp])).toEqual([
      ["Simbian Comply", 29.99],
      ["Simbian Growth", 59.99],
      ["Simbian Elite", 89.99],
    ]);
    expect(cat.mtd.map((p: { code: string }) => p.code)).toEqual([
      "MTD_STARTER",
      "MTD_GROWTH",
      "MTD_COMPLETE",
    ]);
  });

  it("inclusions_answer_uses_verified_names_without_promising_features", () => {
    const reply = answerInclusionsQuestion(
      "What is included in each package and how do they differ?",
    );
    expect(reply).toBeTruthy();
    const lower = reply!.toLowerCase();
    expect(lower).toMatch(/approved|subject to/);
    expect(lower).toContain("simbian comply");
    expect(lower).toContain("simbian elite");
    expect(lower).toContain("£119");
    expect(lower).toContain("29.99");
    expect(lower).toMatch(/not invent|will not invent|must confirm/);
    expect(lower).not.toContain("mtd starter");
    expect(lower).not.toContain("mtd complete");
    // Must not invent exact named Xero plan as unconditional.
    expect(lower).not.toContain("xero grow subscription included");
    expect(lower).toContain("xero software licence is included");
  });

  it("lowest_suitable_simple_sa_not_elite", () => {
    const { packages } = recommendForMessage(
      "I am a first time sole trader with simple income — which Self Assessment package?",
      null,
      WEBSITE,
    );
    const codes = packages.map((p) => p.code);
    expect(codes[0]).toBe("SA_SIMPLE");
    expect(primaryRecommendationIsNotMostExpensive(codes)).toBe(true);
  });

  it("complex_sa_still_not_elite_only", () => {
    const { packages } = recommendForMessage(
      "I have multiple complex income sources and need a Self Assessment package",
      null,
      WEBSITE,
    );
    const codes = packages.map((p) => p.code);
    expect(codes).toContain("SA_SMART");
    expect(primaryRecommendationIsNotMostExpensive(codes)).toBe(true);
  });

  it("existing_client_no_upsell_packages", () => {
    const { packages } = recommendForMessage(
      "I am an existing TaxSimba client — message my assigned accountant",
      null,
      WEBSITE,
    );
    expect(packages).toEqual([]);
  });

  it("catalogue_text_forbids_starter_complete_labels", () => {
    const text = packageCatalogText().toLowerCase();
    expect(text).toContain("simbian comply");
    expect(text).toContain("never invent");
    expect(text).not.toContain("mtd starter");
    expect(text).not.toContain("mtd complete");
  });

  it("package_cards_expose_registration_paths_without_inclusions", () => {
    const cards = toPackageCards(["SA_SIMPLE", "MTD_STARTER"]);
    expect(cards[0].registration_path).toBe("/self-assessment");
    expect(cards[1].name).toBe("Simbian Comply");
    expect(cards[1].registration_path).toBe("/making-tax-digital");
    expect(cards[1].inclusions).toBeNull();
  });
});
