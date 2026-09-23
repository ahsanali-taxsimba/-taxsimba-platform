import { describe, expect, it } from "vitest";
import { TOOLKIT_GROUPS, ALL_TOOL_IDS, findTool, PLAN_CODES, PLAN_PRICES_CENTS } from "@taxotools/shared";

describe("Semrush + Search Atlas toolkit catalog", () => {
  it("leads with Automation (Taxo Agent) then Semrush groups", () => {
    expect(TOOLKIT_GROUPS.map((g) => g.id)).toEqual([
      "automation",
      "seo",
      "aeo",
      "traffic-market",
      "content",
      "local",
      "social",
      "advertising",
      "ai-pr",
      "reports",
    ]);
  });

  it("covers Search Atlas flagship surfaces", () => {
    for (const id of [
      "taxo-agent",
      "auto-seo",
      "taxo-pixel",
      "cms-publishing",
      "website-studio",
      "content-genius",
      "smart-ads",
      "overnight-repair",
      "approval-mode",
      "gbp-galactic",
    ]) {
      expect(ALL_TOOL_IDS).toContain(id);
    }
  });

  it("covers core Semrush SEO tools", () => {
    for (const id of [
      "domain-overview",
      "keyword-research",
      "keyword-magic",
      "position-tracking",
      "backlink-analytics",
      "site-audit",
    ]) {
      expect(ALL_TOOL_IDS).toContain(id);
    }
  });

  it("exposes 70+ competitive tools", () => {
    expect(ALL_TOOL_IDS.length).toBeGreaterThanOrEqual(70);
  });

  it("aligns pricing with Search Atlas try-now ladder", () => {
    expect(PLAN_CODES).toContain("GROWTH");
    expect(PLAN_PRICES_CENTS.STARTER).toBe(9900);
    expect(PLAN_PRICES_CENTS.GROWTH).toBe(19900);
    expect(PLAN_PRICES_CENTS.PRO).toBe(39900);
    expect(PLAN_PRICES_CENTS.AGENCY).toBe(99900);
  });

  it("resolves Content Genius and Smart Ads", () => {
    expect(findTool("content-genius")?.group.id).toBe("automation");
    expect(findTool("google-ad-studio")?.tool.name).toBe("Google Ad Studio");
  });
});
