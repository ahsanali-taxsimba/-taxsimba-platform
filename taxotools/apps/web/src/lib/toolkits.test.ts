import { describe, expect, it } from "vitest";
import { TOOLKIT_GROUPS, ALL_TOOL_IDS, findTool } from "@taxotools/shared";

describe("Semrush-parity toolkit catalog", () => {
  it("includes all Semrush toolkit groups", () => {
    expect(TOOLKIT_GROUPS.map((g) => g.id)).toEqual([
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

  it("covers core Semrush SEO tools", () => {
    const ids = ALL_TOOL_IDS;
    for (const id of [
      "domain-overview",
      "keyword-research",
      "keyword-magic",
      "keyword-strategy-builder",
      "keyword-gap",
      "organic-research",
      "position-tracking",
      "backlink-analytics",
      "backlink-gap",
      "site-audit",
      "log-file-analyzer",
    ]) {
      expect(ids).toContain(id);
    }
  });

  it("covers local, social, traffic, and AI PR", () => {
    expect(findTool("map-rank-tracker")).toBeTruthy();
    expect(findTool("social-poster")).toBeTruthy();
    expect(findTool("traffic-analytics")).toBeTruthy();
    expect(findTool("media-monitoring")).toBeTruthy();
    expect(findTool("pla-research")?.tool.name).toBe("PLA Research");
  });

  it("exposes 60+ Semrush-parity tools", () => {
    expect(ALL_TOOL_IDS.length).toBeGreaterThanOrEqual(60);
  });
});
