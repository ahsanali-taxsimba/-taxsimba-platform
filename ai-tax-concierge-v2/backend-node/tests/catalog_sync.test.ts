import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  packagesCatalog,
} from "../src/catalog/service.js";
import {
  rollbackCatalogueOverlay,
  stopCatalogueScheduler,
  syncCatalogueFromUpstream,
} from "../src/catalog/sync/service.js";
import type { UpstreamCataloguePayload } from "../src/catalog/sync/types.js";

function payload(
  plans: Array<Record<string, unknown>>,
): UpstreamCataloguePayload {
  return { success: true, data: plans as any };
}

describe("taxsimba catalogue sync", () => {
  let runtimeDir: string;

  beforeEach(() => {
    runtimeDir = mkdtempSync(path.join(os.tmpdir(), "simba-cat-"));
    process.env.CONCIERGE_RUNTIME_DIR = runtimeDir;
    packagesCatalog.clearCache?.();
  });

  afterEach(() => {
    stopCatalogueScheduler();
    delete process.env.CONCIERGE_RUNTIME_DIR;
    packagesCatalog.clearCache?.();
    rmSync(runtimeDir, { recursive: true, force: true });
  });

  it("syncs_published_prices_without_redeploy_and_preserves_stable_ids", async () => {
    const sa = payload([
      {
        code: "SIMPLE",
        name: "Tax Simba Simple",
        price: 119,
        priceAvailable: true,
        billingFrequency: "Per tax year",
        vatTreatment: "INCLUSIVE",
        description: "Simple SA",
        features: ["Self Assessment prepared by an accountant"],
      },
      {
        code: "SMART",
        name: "Tax Simba Smart",
        price: 149,
        priceAvailable: true,
        billingFrequency: "Per tax year",
        features: ["Priority accountant messaging", "Expenses check"],
      },
      {
        code: "ELITE",
        name: "Tax Simba Elite",
        price: 299,
        priceAvailable: true,
        billingFrequency: "Per tax year",
        features: ["Proactive tax planning advice"],
      },
    ]);
    const mtd = payload([
      {
        code: "MTD_COMPLY",
        name: "Simbian Comply",
        price: 29.99,
        priceAvailable: true,
        billingFrequency: "Monthly",
        vatTreatment: "INCLUSIVE",
        description: "Comply plan",
        features: [
          "Xero Simple subscription included",
          "Quarterly business reviews",
        ],
      },
      {
        code: "MTD_GROWTH",
        name: "Simbian Growth",
        price: 59.99,
        priceAvailable: true,
        billingFrequency: "Monthly",
        vatTreatment: "INCLUSIVE",
        features: ["Xero Ignite subscription included"],
      },
      {
        code: "MTD_ELITE",
        name: "Simbian Elite",
        price: 89.99,
        priceAvailable: true,
        billingFrequency: "Monthly",
        vatTreatment: "INCLUSIVE",
        features: ["Xero Grow subscription included"],
      },
    ]);

    const fetchCatalogue = async (url: string) =>
      url.includes("mtd") ? mtd : sa;

    const result = await syncCatalogueFromUpstream({ fetchCatalogue });
    expect(result.applied).toBe(true);
    expect(result.stable_codes_preserved).toEqual(
      expect.arrayContaining([
        "SA_SIMPLE",
        "SA_SMART",
        "SA_ELITE",
        "MTD_STARTER",
        "MTD_GROWTH",
        "MTD_COMPLETE",
      ]),
    );
    expect(result.removed_claims_stripped.join(" ")).toMatch(/Priority accountant messaging|Quarterly business reviews|Proactive tax planning/i);

    const cat = packagesCatalog();
    expect(cat.mtd.map((p: any) => p.code)).toEqual([
      "MTD_STARTER",
      "MTD_GROWTH",
      "MTD_COMPLETE",
    ]);
    expect(cat.mtd[0].price_gbp).toBe(29.99);
    expect(cat.owner_decisions.bookkeeping_transaction_limits).toBe(
      "NO_FIXED_MONTHLY_TRANSACTION_CAPS",
    );
  });

  it("staging_price_change_and_reversion_without_redeploy", async () => {
    const make = (elitePrice: number) => {
      const sa = payload([
        { code: "SIMPLE", name: "Tax Simba Simple", price: 119, priceAvailable: true },
        { code: "SMART", name: "Tax Simba Smart", price: 149, priceAvailable: true },
        {
          code: "ELITE",
          name: "Tax Simba Elite",
          price: elitePrice,
          priceAvailable: true,
        },
      ]);
      const mtd = payload([
        {
          code: "MTD_COMPLY",
          name: "Simbian Comply",
          price: 29.99,
          priceAvailable: true,
          vatTreatment: "INCLUSIVE",
        },
        {
          code: "MTD_GROWTH",
          name: "Simbian Growth",
          price: 59.99,
          priceAvailable: true,
          vatTreatment: "INCLUSIVE",
        },
        {
          code: "MTD_ELITE",
          name: "Simbian Elite",
          price: 89.99,
          priceAvailable: true,
          vatTreatment: "INCLUSIVE",
        },
      ]);
      return async (url: string) => (url.includes("mtd") ? mtd : sa);
    };

    await syncCatalogueFromUpstream({ fetchCatalogue: make(299) });
    expect(
      packagesCatalog().self_assessment.find((p: any) => p.code === "SA_ELITE")
        .price_gbp,
    ).toBe(299);

    const staging = await syncCatalogueFromUpstream({
      fetchCatalogue: make(311),
    });
    expect(staging.applied).toBe(true);
    expect(
      staging.price_changes.some((c) => c.code === "SA_ELITE" && c.to === 311),
    ).toBe(true);
    expect(
      packagesCatalog().self_assessment.find((p: any) => p.code === "SA_ELITE")
        .price_gbp,
    ).toBe(311);

    // Revert by syncing published price again (no redeploy)
    await syncCatalogueFromUpstream({ fetchCatalogue: make(299) });
    expect(
      packagesCatalog().self_assessment.find((p: any) => p.code === "SA_ELITE")
        .price_gbp,
    ).toBe(299);

    const rb = rollbackCatalogueOverlay();
    expect(rb.rolled_back).toBe(true);
  });

  it("skips_unpublished_prices", async () => {
    const sa = payload([
      { code: "SIMPLE", name: "Tax Simba Simple", price: 119, priceAvailable: true },
      { code: "SMART", name: "Tax Simba Smart", price: 149, priceAvailable: false },
      { code: "ELITE", name: "Tax Simba Elite", price: 299, priceAvailable: true },
    ]);
    const mtd = payload([
      {
        code: "MTD_COMPLY",
        name: "Simbian Comply",
        price: 29.99,
        priceAvailable: true,
      },
      {
        code: "MTD_GROWTH",
        name: "Simbian Growth",
        price: 59.99,
        priceAvailable: true,
      },
      {
        code: "MTD_ELITE",
        name: "Simbian Elite",
        price: 89.99,
        priceAvailable: true,
      },
    ]);
    const result = await syncCatalogueFromUpstream({
      fetchCatalogue: async (url) => (url.includes("mtd") ? mtd : sa),
    });
    expect(result.skipped_unpublished.join(" ")).toMatch(/SA_SMART:unpublished/);
  });
});
