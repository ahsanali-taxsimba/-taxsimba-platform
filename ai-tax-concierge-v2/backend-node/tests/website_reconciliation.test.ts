import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  answerInclusionsQuestion,
  recommendForMessage,
} from "../src/ai/recommendations.js";
import { packagesCatalog } from "../src/catalog/service.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const REC = path.join(
  ROOT,
  "docs/verification/final_website_reconciliation",
);

describe("final website catalogue reconciliation", () => {
  it("live_api_snapshot_matches_approved_prices_and_xero_mapping", () => {
    const sa = JSON.parse(
      readFileSync(path.join(REC, "public_api_sa.json"), "utf-8"),
    ).data;
    const mtd = JSON.parse(
      readFileSync(path.join(REC, "public_api_mtd.json"), "utf-8"),
    ).data;
    expect(sa.map((p: any) => [p.code, p.price])).toEqual([
      ["SIMPLE", 119],
      ["SMART", 149],
      ["ELITE", 299],
    ]);
    expect(mtd.map((p: any) => [p.code, p.name, p.price])).toEqual([
      ["MTD_COMPLY", "Simbian Comply", 29.99],
      ["MTD_GROWTH", "Simbian Growth", 59.99],
      ["MTD_ELITE", "Simbian Elite", 89.99],
    ]);
    expect(mtd[0].features).toContain("Xero Simple subscription included");
    expect(mtd[1].features).toContain("Xero Ignite subscription included");
    expect(mtd[2].features).toContain("Xero Grow subscription included");
    // Website still lists removed premium claims — SIMBA must not auto-approve.
    expect(mtd[1].features).toContain("Quarterly business reviews");
    expect(mtd[2].features).toContain("Proactive tax planning advice");
  });

  it("simba_catalogue_preserves_owner_decisions_and_no_fixed_caps", () => {
    const cat = packagesCatalog();
    expect(cat.detailed_recommendations_status).toBe(
      "website_reconciled_owner_decisions_applied",
    );
    expect(cat.owner_decisions.xero_included_in_mtd_price).toBe("approved");
    expect(cat.owner_decisions.xero_mapping).toEqual({
      MTD_STARTER: "Xero Simple",
      MTD_GROWTH: "Xero Ignite",
      MTD_COMPLETE: "Xero Grow",
      source: "public API category=mtd recovered 2026-11-13",
    });
    expect(cat.owner_decisions.bookkeeping_transaction_limits).toBe(
      "NO_FIXED_MONTHLY_TRANSACTION_CAPS",
    );
    expect(cat.owner_decisions.mtd_quarterly_updates_included).toBe(
      "approved_subject_to_customer_responsibilities",
    );
    expect(cat.owner_decisions.telephone_onboarding).toBe(false);
    expect(cat.mtd.map((p: any) => p.price_gbp)).toEqual([29.99, 59.99, 89.99]);
  });

  it("inclusions_answer_states_xero_mapping_and_no_removed_premiums", () => {
    const reply = answerInclusionsQuestion(
      "What is included in Simbian packages — Xero, quarterly updates, priority support?",
    )!;
    const lower = reply.toLowerCase();
    expect(lower).toContain("xero simple");
    expect(lower).toContain("xero ignite");
    expect(lower).toContain("xero grow");
    expect(lower).toContain("do not pay separately");
    expect(lower).toContain("quarterly");
    expect(lower).toContain("customer responsibilities");
    expect(lower).toContain("no fixed monthly transaction caps");
    expect(lower).not.toContain("undecided");
    expect(lower).toContain("removed");
    expect(lower).not.toMatch(/includes quarterly business reviews/);
    expect(lower).not.toMatch(/includes proactive tax planning advice/);
  });

  it("recommendations_use_correct_links_and_lowest_suitable", () => {
    const sa = recommendForMessage(
      "I am a first time sole trader with simple income — which Self Assessment package?",
      null,
      "https://www.taxsimba.co.uk",
    );
    expect(sa.packages[0].code).toBe("SA_SIMPLE");
    expect(sa.packages[0].registration_path).toBe("/self-assessment");
    const mtd = recommendForMessage(
      "I am a landlord needing Making Tax Digital — lowest suitable plan?",
      null,
      "https://www.taxsimba.co.uk",
    );
    expect(mtd.packages[0].code).toBe("MTD_STARTER");
    expect(mtd.packages[0].name).toBe("Simbian Comply");
    expect(mtd.packages[0].registration_path).toBe("/making-tax-digital");
  });
});
