import { describe, expect, it } from "vitest";
import { TOOLKIT_GROUPS, ALL_TOOL_IDS, findTool, PLAN_CODES, PLAN_PRICES_CENTS } from "@taxotools/shared";

describe("Semrush + Search Atlas advanced catalog", () => {
  it("includes Automation and Authority toolkits first", () => {
    expect(TOOLKIT_GROUPS.map((g) => g.id).slice(0, 3)).toEqual([
      "automation",
      "authority",
      "seo",
    ]);
  });

  it("covers Search Atlas advanced surfaces", () => {
    for (const id of [
      "taxo-agent",
      "auto-seo",
      "content-genius",
      "smart-ads",
      "deep-freeze",
      "instant-indexing",
      "agent-chat",
      "quest",
      "domain-power",
      "site-explorer",
      "topical-dominance",
      "wildfire",
      "hyperdrive",
      "press-releases",
      "cloud-stacks",
      "crawl-monitoring",
      "health-scoreboard",
      "knowledge-base",
      "content-planner",
      "meta-generator",
      "content-rewriter",
      "schema-generator",
      "bulk-url-analyzer",
      "gsc-insights",
      "ga4-insights",
      "citation-builder",
      "ai-report-summary",
      "email-alerts",
      "slack-webhooks",
      "orders-tasks",
    ]) {
      expect(ALL_TOOL_IDS).toContain(id);
    }
  });

  it("exposes 95+ competitive tools", () => {
    expect(ALL_TOOL_IDS.length).toBeGreaterThanOrEqual(95);
  });

  it("aligns pricing with Search Atlas try-now ladder", () => {
    expect(PLAN_CODES).toContain("GROWTH");
    expect(PLAN_PRICES_CENTS.STARTER).toBe(9900);
    expect(PLAN_PRICES_CENTS.AGENCY).toBe(99900);
  });

  it("resolves QUEST under Authority toolkit", () => {
    expect(findTool("quest")?.group.id).toBe("authority");
    expect(findTool("wildfire")?.tool.name).toContain("WILDFIRE");
  });
});
