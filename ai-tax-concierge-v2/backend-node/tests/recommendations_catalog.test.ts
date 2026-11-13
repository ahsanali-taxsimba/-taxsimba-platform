import { beforeEach, describe, expect, it } from "vitest";
import {
  recommendForMessage,
  toPackageCards,
} from "../src/ai/recommendations.js";
import {
  calculatorsCatalog,
  packagesCatalog,
} from "../src/catalog/service.js";
import {
  calculatorCount,
  listRoutes,
  matchRoutes,
  clearRoutesCache,
} from "../src/routes_registry/service.js";

const WEBSITE = "https://www.taxsimba.co.uk";

const SA_PRICE_CASES = [
  ["SA_SIMPLE", 119.0],
  ["SA_SMART", 149.0],
  ["SA_ELITE", 299.0],
] as const;

const MTD_PRICE_CASES = [
  ["MTD_STARTER", 29.99],
  ["MTD_GROWTH", 59.99],
  ["MTD_COMPLETE", 89.99],
] as const;

describe("recommendations catalog", () => {
  beforeEach(() => {
    packagesCatalog.clearCache?.();
    calculatorsCatalog.clearCache?.();
    clearRoutesCache?.();
  });

  it.each(SA_PRICE_CASES)("sa_package_prices %s = %s", (code, price) => {
    const card = toPackageCards([code])[0];
    expect(card.price_gbp).toBe(price);
    expect(card.inclusions_status).toBe("not_specified_in_catalog");
  });

  it.each(MTD_PRICE_CASES)(
    "mtd_package_prices_vat_included %s = %s",
    (code, price) => {
      const card = toPackageCards([code])[0];
      expect(card.price_gbp).toBe(price);
      expect(card.vat_note || "").toContain("VAT included");
    },
  );

  it("consultation_catalogue_price_and_stub", () => {
    const card = toPackageCards(["ACCOUNTANT_CONSULT_99"])[0];
    expect(card.price_gbp).toBe(99);
    const cat = packagesCatalog();
    expect(cat.consultation.booking_status).toBe("stub");
  });

  it.each([
    "What do TaxSimba Self Assessment packages cost?",
    "MTD plan prices for landlords",
    "How much is the accountant consultation?",
  ])("recommendations_inclusions_status_not_invented: %s", (message) => {
    const { packages } = recommendForMessage(message, null, WEBSITE);
    expect(packages.length).toBeGreaterThan(0);
    expect(
      packages.every((p) => p.inclusions_status === "not_specified_in_catalog"),
    ).toBe(true);
  });

  it("calculator_recommendations_use_live_verified_paths", () => {
    const { calculators } = recommendForMessage(
      "CIS subcontractor quarterly income",
      null,
      WEBSITE,
    );
    expect(calculators.length).toBeGreaterThan(0);
    expect(calculators.every((c) => c.url_status === "live_verified")).toBe(true);
    expect(
      calculators.every((c) => c.url && c.url.includes("/calculators/")),
    ).toBe(true);
  });

  it("route_registry_has_seventeen_calculator_routes", () => {
    expect(calculatorCount()).toBeGreaterThanOrEqual(17);
    const calcRoutes = listRoutes().routes.filter(
      (r: { kind?: string }) => r.kind === "calculator",
    );
    expect(calcRoutes.length).toBeGreaterThanOrEqual(17);
  });

  it.each([
    ["I am a landlord with rental property income", "landlord"],
    ["mtd quarterly updates compatible software sole trader", "mtd"],
    ["Self Assessment packages and filing", "self assessment"],
  ] as const)("match_routes_for_landlord_and_mtd: %s", (message, topic) => {
    const routes = matchRoutes(message, 5, WEBSITE);
    expect(routes.length).toBeGreaterThan(0);
    const topicsHit = new Set(
      routes.flatMap((r: { topics?: string[] }) => r.topics || []),
    );
    expect(topicsHit.has(topic)).toBe(true);
    for (const r of routes) {
      if (r.status === "live_verified") {
        expect(r.url).toBeTruthy();
        expect(String(r.url).startsWith(WEBSITE)).toBe(true);
      } else if (r.status === "stub") {
        expect(r.url).toBeNull();
      } else {
        expect(r.note).toBeTruthy();
      }
    }
  });
});
