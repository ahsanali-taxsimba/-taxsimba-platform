import { describe, expect, it } from "vitest";
import { TOOLKIT_GROUPS, ALL_TOOL_IDS, findTool } from "@taxotools/shared";

describe("Semrush-parity toolkit catalog", () => {
  it("includes SEO, Content, Advertising, and AEO groups", () => {
    expect(TOOLKIT_GROUPS.map((g) => g.id)).toEqual([
      "seo",
      "content",
      "advertising",
      "aeo",
    ]);
  });

  it("covers core Semrush SEO tools", () => {
    const ids = ALL_TOOL_IDS;
    for (const id of [
      "keyword-research",
      "keyword-magic",
      "keyword-gap",
      "organic-research",
      "position-tracking",
      "serp-features",
      "backlink-analytics",
      "backlink-audit",
      "link-building",
      "site-audit",
      "on-page-checker",
      "seo-content-template",
      "seo-writing-assistant",
      "log-file-analyzer",
    ]) {
      expect(ids).toContain(id);
    }
  });

  it("covers advertising research and PLA", () => {
    expect(findTool("pla-research")?.tool.name).toBe("PLA Research");
    expect(findTool("advertising-research")).toBeTruthy();
    expect(findTool("keyword-cpc")).toBeTruthy();
  });

  it("exposes 30 tools", () => {
    expect(ALL_TOOL_IDS.length).toBe(30);
  });
});
