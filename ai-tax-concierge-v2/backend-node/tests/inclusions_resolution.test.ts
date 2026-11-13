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

describe("inclusions resolution — public API recovery", () => {
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
    expect(cat.status_summary.feature_inclusions).toBe("REQUIRES_APPROVAL");
    expect(cat.self_assessment[2].price_gbp.value).toBe(299);
    expect(cat.mtd[0].name.status).toBe("REQUIRES_APPROVAL");
    expect(cat.unresolved_approval_items.length).toBeGreaterThan(0);
  });

  it("runtime_packages_match_verified_prices", () => {
    const cat = packagesCatalog();
    expect(cat.detailed_recommendations_status).toBe(
      "partial_recovered_public_api_pending_signoff",
    );
    expect(cat.self_assessment.map((p: { price_gbp: number }) => p.price_gbp)).toEqual([
      119, 149, 299,
    ]);
    expect(cat.mtd.map((p: { price_gbp: number }) => p.price_gbp)).toEqual([
      29.99, 59.99, 89.99,
    ]);
  });

  it("inclusions_answer_labels_pending_and_does_not_invent", () => {
    const reply = answerInclusionsQuestion(
      "What is included in each package and how do they differ?",
    );
    expect(reply).toBeTruthy();
    const lower = reply!.toLowerCase();
    expect(lower).toContain("verified");
    expect(lower).toContain("pending");
    expect(lower).toContain("£119");
    expect(lower).toContain("29.99");
    expect(lower).toContain("will not invent");
    expect(lower).toContain("xero"); // recovered public API — labelled pending
    expect(lower).not.toContain("24/7 phone helpline");
    expect(lower).toContain("self-assessment");
    expect(lower).toContain("register");
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
    expect(packages[0].recommendation_reason || "").toMatch(/Lowest/i);
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

  it("catalogue_text_mentions_pending_signoff", () => {
    const text = packageCatalogText().toLowerCase();
    expect(text).toContain("pending");
    expect(text).toContain("119");
    expect(text).toContain("never invent");
  });

  it("package_cards_expose_registration_paths", () => {
    const cards = toPackageCards(["SA_SIMPLE", "MTD_STARTER"]);
    expect(cards[0].registration_path).toBe("/self-assessment");
    expect(cards[1].registration_path).toBe("/making-tax-digital");
  });
});
