import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createSettings } from "../src/config/settings.js";
import {
  assertNoInternalCatalogueLeak,
  publicPackagesCatalogue,
} from "../src/catalog/public.js";
import { packagesCatalog, publicCatalogPayload } from "../src/catalog/service.js";
import { toPackageCards } from "../src/ai/recommendations.js";
import { packageCatalogText } from "../src/catalog/service.js";

const FORBIDDEN = [
  "owner_decisions",
  "approval_matrix_doc",
  "remaining_decisions_doc",
  "proposed_copy_doc",
  "inclusions_supply_doc",
  "inclusions_resolution_doc",
  "inclusion_item_statuses",
  "internal_code_note",
  "customer_facing_inclusions",
  "removed_customer_claims",
  "disclaimer",
  "requires_clarification",
];

describe("public catalogue allowlist — no internal metadata", () => {
  it("publicPackagesCatalogue_strips_internal_keys", () => {
    const pub = publicPackagesCatalogue(packagesCatalog());
    const leaks = assertNoInternalCatalogueLeak(pub);
    expect(leaks).toEqual([]);
    for (const key of FORBIDDEN) {
      expect(pub).not.toHaveProperty(key);
    }
    expect(pub.self_assessment).toHaveLength(3);
    expect(pub.mtd).toHaveLength(3);
    expect((pub.mtd as any[])[0].name).toBe("Simbian Comply");
    expect((pub.mtd as any[])[0].price_gbp).toBe(29.99);
    expect((pub.mtd as any[])[0].xero_plan).toBe("Xero Simple");
    expect((pub.mtd as any[])[0].internal_code_note).toBeUndefined();
  });

  it("catalog_packages_and_bootstrap_endpoints_are_clean", async () => {
    const app = createApp(
      createSettings({ CONCIERGE_FORCE_MOCK_LLM: true }),
    );
    const packages = await request(app).get("/api/v1/catalog/packages").expect(200);
    const bootstrap = await request(app).get("/api/v1/bootstrap").expect(200);
    for (const body of [packages.body, bootstrap.body.packages]) {
      const blob = JSON.stringify(body);
      for (const key of FORBIDDEN) {
        expect(blob.includes(key)).toBe(false);
      }
      expect(blob.toLowerCase()).not.toContain("owner_decisions");
      expect(blob.toLowerCase()).not.toContain("inclusion_item_statuses");
    }
    expect(bootstrap.body.brand.logo).toContain("taxsimba-logo");
    expect(bootstrap.body.consultation.booking_available).toBe(false);
    expect(bootstrap.body.integrations.calendly).toBe("not_connected");
    expect(bootstrap.body.brand.source).toBeUndefined();
    expect(bootstrap.body.calculator_registry_count).toBeUndefined();
  });

  it("package_cards_omit_internal_status_fields", () => {
    const cards = toPackageCards(["MTD_GROWTH", "SA_SIMPLE"]);
    for (const card of cards) {
      expect(card.name_status).toBeUndefined();
      expect(card.price_status).toBeUndefined();
      expect(["approved", "not_listed"]).toContain(card.inclusions_status);
      expect(JSON.stringify(card)).not.toMatch(/requires_clarification|pending_taxsimba/);
    }
  });

  it("llm_catalogue_text_has_no_internal_mapping_or_raw_disclaimer", () => {
    const text = packageCatalogText();
    expect(text.toLowerCase()).not.toContain("internal mapping");
    expect(text.toLowerCase()).not.toContain("mtd_starter");
    expect(text.toLowerCase()).not.toContain("approval_matrix");
    expect(text.toLowerCase()).not.toContain("owner_decisions");
    expect(text).toContain("Simbian Comply");
    expect(text).toContain("29.99");
    expect(text).toContain("Xero Simple");
  });

  it("publicCatalogPayload_packages_are_allowlisted", () => {
    const payload = publicCatalogPayload("https://www.taxsimba.co.uk");
    expect(assertNoInternalCatalogueLeak(payload.packages)).toEqual([]);
  });
});
