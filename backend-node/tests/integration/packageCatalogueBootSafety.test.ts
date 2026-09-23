/**
 * Catalogue mutation safety: production/staging boots must not auto-reconcile packages.
 * Explicit reconcilePackages corrects stale staging data without duplicates.
 */
import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bootTestApp, dropTestDb } from "../helpers/app";

describe("Package catalogue boot mutation safety", () => {
  beforeAll(async () => {
    await bootTestApp();
  }, 60000);

  afterAll(async () => {
    await dropTestDb();
  });

  it("shouldMutatePackageCatalogueOnBoot is false for production and staging-like env", async () => {
    const { shouldMutatePackageCatalogueOnBoot } = await import("../../src/domain/packages");
    expect(
      shouldMutatePackageCatalogueOnBoot({
        NODE_ENV: "production",
        SEED_DEMO_DATA: "false",
      }),
    ).toBe(false);
    expect(
      shouldMutatePackageCatalogueOnBoot({
        NODE_ENV: "production",
        SEED_DEMO_DATA: "false",
        ALLOW_PACKAGE_CATALOGUE_MUTATION: "true",
      }),
    ).toBe(false);
    expect(
      shouldMutatePackageCatalogueOnBoot({
        NODE_ENV: "production",
        ALLOW_PACKAGE_CATALOGUE_MUTATION: "true",
        FORCE_PACKAGE_CATALOGUE_MUTATION_IN_PRODUCTION: "true",
      }),
    ).toBe(true);
    expect(shouldMutatePackageCatalogueOnBoot({ NODE_ENV: "test" })).toBe(true);
    expect(
      shouldMutatePackageCatalogueOnBoot({
        NODE_ENV: "development",
        ALLOW_PACKAGE_CATALOGUE_MUTATION: "true",
      }),
    ).toBe(true);
    expect(
      shouldMutatePackageCatalogueOnBoot({
        NODE_ENV: "development",
        SEED_DEMO_DATA: "false",
      }),
    ).toBe(false);
  });

  it("production-mode ensurePhase1bData does not modify catalogue prices/rows", async () => {
    const { col } = await import("../../src/db/mongo");
    const {
      ensurePhase1bData,
      reconcilePackageCatalogue,
    } = await import("../../src/domain/packages");

    // Establish known catalogue via explicit reconcile (operator path).
    await reconcilePackageCatalogue();
    await col("packages").updateOne(
      { code: "SIMPLE", service_type: "SELF_ASSESSMENT", is_active: true },
      { $set: { price: 0, name: "STALE Simple" } },
    );
    const before = await col("packages")
      .find({ service_type: "SELF_ASSESSMENT" })
      .toArray();
    const beforeSnap = before.map((p) => ({
      id: p.id,
      code: p.code,
      price: p.price,
      name: p.name,
      is_active: p.is_active,
    }));

    const prevNodeEnv = process.env.NODE_ENV;
    const prevAllow = process.env.ALLOW_PACKAGE_CATALOGUE_MUTATION;
    const prevForce = process.env.FORCE_PACKAGE_CATALOGUE_MUTATION_IN_PRODUCTION;
    const prevSeed = process.env.SEED_DEMO_DATA;
    try {
      process.env.NODE_ENV = "production";
      process.env.SEED_DEMO_DATA = "false";
      delete process.env.ALLOW_PACKAGE_CATALOGUE_MUTATION;
      delete process.env.FORCE_PACKAGE_CATALOGUE_MUTATION_IN_PRODUCTION;
      await ensurePhase1bData();
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      if (prevAllow === undefined) delete process.env.ALLOW_PACKAGE_CATALOGUE_MUTATION;
      else process.env.ALLOW_PACKAGE_CATALOGUE_MUTATION = prevAllow;
      if (prevForce === undefined) delete process.env.FORCE_PACKAGE_CATALOGUE_MUTATION_IN_PRODUCTION;
      else process.env.FORCE_PACKAGE_CATALOGUE_MUTATION_IN_PRODUCTION = prevForce;
      if (prevSeed === undefined) delete process.env.SEED_DEMO_DATA;
      else process.env.SEED_DEMO_DATA = prevSeed;
    }

    const after = await col("packages")
      .find({ service_type: "SELF_ASSESSMENT" })
      .toArray();
    const afterSnap = after.map((p) => ({
      id: p.id,
      code: p.code,
      price: p.price,
      name: p.name,
      is_active: p.is_active,
    }));
    expect(afterSnap).toEqual(beforeSnap);
    expect(after.find((p) => p.code === "SIMPLE")?.price).toBe(0);
  });

  it("explicit reconcilePackageCatalogue corrects stale staging £0 and duplicates", async () => {
    const { col } = await import("../../src/db/mongo");
    const { reconcilePackageCatalogue } = await import("../../src/domain/packages");

    await col("packages").updateOne(
      { code: "SIMPLE", service_type: "SELF_ASSESSMENT" },
      { $set: { price: 0, is_active: true, original_price: null, save_percentage: null } },
    );
    await col("packages").insertOne({
      id: randomUUID(),
      service_type: "SELF_ASSESSMENT",
      code: "SMART",
      name: "Dup Smart",
      price: 1,
      rank: 2,
      billing_frequency: "Per tax year",
      billing_type: "ONE_OFF",
      vat_treatment: "INCLUSIVE",
      is_active: true,
      created_at: new Date().toISOString(),
    });

    const dry = await reconcilePackageCatalogue({ dryRun: true });
    expect(dry.dryRun).toBe(true);
    expect(dry.realigned).toBeGreaterThanOrEqual(1);
    expect(
      Number(
        (
          await col("packages").findOne({
            code: "SIMPLE",
            service_type: "SELF_ASSESSMENT",
            is_active: true,
          })
        )?.price,
      ),
    ).toBe(0);

    const result = await reconcilePackageCatalogue({ dryRun: false });
    expect(result.dryRun).toBe(false);
    expect(result.realigned + result.deactivatedDuplicates).toBeGreaterThanOrEqual(1);
    expect(result.presentationUpdated).toBeGreaterThanOrEqual(1);

    const simple = await col("packages").findOne({
      code: "SIMPLE",
      service_type: "SELF_ASSESSMENT",
      is_active: true,
    });
    expect(simple?.price).toBe(119);
    expect(simple?.original_price).toBe(199);
    expect(simple?.save_percentage).toBe(40);

    const smartActive = await col("packages")
      .find({ code: "SMART", service_type: "SELF_ASSESSMENT", is_active: true })
      .toArray();
    expect(smartActive).toHaveLength(1);
    expect(smartActive[0].price).toBe(149);
    expect(smartActive[0].original_price).toBe(229);
    expect(smartActive[0].save_percentage).toBe(35);
  });
});
