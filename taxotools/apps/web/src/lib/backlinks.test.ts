import { describe, expect, it } from "vitest";
import {
  BACKLINK_ENGINE_DEFAULTS,
  BACKLINK_SOURCE_APIS,
  BACKLINK_LIVE_PROVIDERS,
  computeBacklinkScore,
  classifyBacklink,
  findTool,
} from "@taxotools/shared";

describe("seo.backlinks.init engine", () => {
  it("matches CLI defaults with free providers first", () => {
    expect([...BACKLINK_LIVE_PROVIDERS]).toEqual(["crawlgraph", "openpagerank"]);
    expect([...BACKLINK_SOURCE_APIS]).toEqual([
      "crawlgraph",
      "openpagerank",
      "ahrefs",
      "semrush",
      "majestic",
    ]);
    expect(BACKLINK_ENGINE_DEFAULTS.sourceApis).toEqual(["crawlgraph", "openpagerank"]);
    expect(BACKLINK_ENGINE_DEFAULTS.crawlMode).toBe("external");
    expect(BACKLINK_ENGINE_DEFAULTS.refreshInterval).toBe("24h");
    expect(BACKLINK_ENGINE_DEFAULTS.scoreFormula).toBe("(authority*relevance)-(spam*risk)");
    expect(BACKLINK_ENGINE_DEFAULTS.toxic.spamGt).toBe(70);
    expect(BACKLINK_ENGINE_DEFAULTS.toxic.riskGt).toBe(0.6);
    expect(BACKLINK_ENGINE_DEFAULTS.highValue.authorityGt).toBe(40);
    expect(BACKLINK_ENGINE_DEFAULTS.highValue.relevanceGt).toBe(0.7);
    expect(BACKLINK_ENGINE_DEFAULTS.alerts.velocitySpikePct).toBe(30);
    expect(BACKLINK_ENGINE_DEFAULTS.alerts.anchorRepeatPct).toBe(20);
    expect(BACKLINK_ENGINE_DEFAULTS.enableDisavow).toBe(true);
    expect(BACKLINK_ENGINE_DEFAULTS.enableCompetitorMonitoring).toBe(true);
  });

  it("scores with (authority*relevance)-(spam*risk)", () => {
    // spam normalized /100 inside compute: 50*0.8 - (10/100)*0.2*100 = 40 - 2 = 38
    expect(computeBacklinkScore({ authority: 50, relevance: 0.8, spam: 10, risk: 0.2 })).toBeCloseTo(
      38,
      5,
    );
  });

  it("classifies toxic and high-value", () => {
    expect(
      classifyBacklink({ authority: 20, relevance: 0.1, spam: 88, risk: 0.2 }),
    ).toBe("toxic");
    expect(
      classifyBacklink({ authority: 20, relevance: 0.1, spam: 10, risk: 0.7 }),
    ).toBe("toxic");
    expect(
      classifyBacklink({ authority: 55, relevance: 0.85, spam: 5, risk: 0.1 }),
    ).toBe("high_value");
    expect(
      classifyBacklink({ authority: 30, relevance: 0.5, spam: 20, risk: 0.2 }),
    ).toBe("normal");
  });

  it("registers backlink engine tools", () => {
    expect(findTool("backlink-engine")?.tool.name).toBe("Backlink Engine");
    expect(findTool("disavow-manager")).toBeTruthy();
    expect(findTool("competitor-backlinks")).toBeTruthy();
  });
});
