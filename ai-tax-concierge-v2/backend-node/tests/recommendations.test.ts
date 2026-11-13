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
    expect(packagesCatalog().consultation.booking_status).toBe("stub");
  });

  it("recommend_packages_without_inventing_inclusions", () => {
    const { packages, follow_ups } = recommendForMessage(
      "What do TaxSimba Self Assessment packages cost?",
      null,
      "https://www.taxsimba.com",
    );
    expect(packages).toHaveLength(3);
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
          p.inclusions_status === "missing_requires_approval",
      ),
    ).toBe(true);
    expect(packages.every((p) => p.name !== "MTD Starter")).toBe(true);
    expect(follow_ups.length).toBeGreaterThan(0);
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
