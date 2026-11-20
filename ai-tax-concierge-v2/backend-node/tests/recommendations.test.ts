import { describe, expect, it } from "vitest";
import {
  recommendForMessage,
  toPackageCards,
} from "../src/ai/recommendations.js";
import { packagesCatalog } from "../src/catalog/service.js";

describe("recommendations", () => {
  it("sa_package_prices_match_catalogue", () => {
    const cards = toPackageCards(["SA_SIMPLE", "SA_SMART", "SA_ELITE"]);
    expect(cards.map((c) => c.price_gbp)).toEqual([119.0, 149.0, 299.0]);
  });

  it("mtd_package_prices_vat_included", () => {
    const cards = toPackageCards(["MTD_STARTER", "MTD_GROWTH", "MTD_COMPLETE"]);
    expect(cards.map((c) => c.price_gbp)).toEqual([29.99, 59.99, 89.99]);
    expect(cards.every((c) => (c.vat_note || "").includes("VAT included"))).toBe(
      true,
    );
  });

  it("consultation_price", () => {
    const cards = toPackageCards(["ACCOUNTANT_CONSULT_99"]);
    expect(cards[0].price_gbp).toBe(99);
    expect(packagesCatalog().consultation[0].booking_status).toBe("stub");
    expect(packagesCatalog().consultation[0].duration_minutes).toBe(20);
    expect(packagesCatalog().consultation[1].price_gbp).toBe(149);
  });

  it("price_list_may_compare_family_without_inventing_inclusions", () => {
    const { packages, follow_ups } = recommendForMessage(
      "What do TaxSimba Self Assessment packages cost?",
      null,
      "https://www.taxsimba.com",
    );
    // Explicit price-list / comparison ask → up to 3 SA cards, not a silent dump on tax Qs.
    expect(packages.length).toBeGreaterThanOrEqual(1);
    expect(packages.length).toBeLessThanOrEqual(3);
    expect(packages.every((p) => String(p.family) === "self_assessment" || p.code.startsWith("SA_"))).toBe(
      true,
    );
    expect(
      packages.every(
        (p) =>
          p.inclusions_status === "requires_approval" ||
          p.inclusions_status === "pending_approval" ||
          p.inclusions_status ===
            "mixed_approved_subject_to_scope_and_pending" ||
          p.inclusions_status ===
            "mixed_approved_and_requires_clarification" ||
          p.inclusions_status ===
            "mixed_verified_from_website_and_requires_clarification" ||
          p.inclusions_status === "approved" ||
          p.inclusions_status === "unknown" ||
          p.inclusions_status === "missing_requires_approval" ||
          p.inclusions_status === "not_listed" ||
          p.inclusions_status === "approved",
      ),
    ).toBe(true);
    expect(packages.every((p) => p.name !== "MTD Starter")).toBe(true);
    expect(follow_ups.length).toBeGreaterThan(0);
  });

  it("recommendation_ask_returns_one_primary_package", () => {
    const { packages } = recommendForMessage(
      "I am a first time sole trader with simple income — which Self Assessment package do you recommend?",
      null,
      "https://www.taxsimba.co.uk",
    );
    expect(packages).toHaveLength(1);
    expect(packages[0]?.code).toBe("SA_SIMPLE");
    expect(packages[0]?.recommended).toBe(true);
  });

  it("ordinary_tax_question_does_not_attach_package_cards", () => {
    const { packages } = recommendForMessage(
      "Do I need to file a Self Assessment return if my employer already deducts PAYE?",
      null,
      "https://www.taxsimba.co.uk",
    );
    expect(packages).toEqual([]);
  });

  it("calculator_urls_are_live_verified_when_confirmed", () => {
    const { calculators } = recommendForMessage(
      "I am a CIS subcontractor",
      null,
      "https://www.taxsimba.co.uk",
    );
    expect(calculators.length).toBeGreaterThan(0);
    expect(calculators.every((c) => c.url_status === "live_verified")).toBe(true);
    expect(
      calculators.every((c) => c.url && c.url.includes("/calculators/")),
    ).toBe(true);
  });
});
