import { describe, expect, it } from "vitest";
import {
  CRAWLER_MASTER_DEFAULTS,
  CRAWLER_MASTER_MODULES,
  CRAWLER_MASTER_PROVIDERS,
  CRAWLER_MASTER_MODES,
  CRAWLER_MASTER_EXTRACT,
  parseFrequencyHours,
  findTool,
  JOB_QUEUES,
} from "@taxotools/shared";

describe("seo.crawler.master.init", () => {
  it("matches CLI defaults", () => {
    expect([...CRAWLER_MASTER_MODULES]).toEqual([
      "backlinks",
      "keywords",
      "serp",
      "competitors",
      "traffic",
    ]);
    expect([...CRAWLER_MASTER_PROVIDERS]).toEqual([
      "ahrefs",
      "semrush",
      "majestic",
      "dataforseo",
      "serpapi",
      "google_index",
      "bing_index",
    ]);
    expect([...CRAWLER_MASTER_MODES]).toEqual(["live", "scheduled", "deep", "external"]);
    expect([...CRAWLER_MASTER_EXTRACT]).toEqual([
      "links",
      "anchors",
      "metadata",
      "schemas",
      "keywords",
      "geo",
      "language",
    ]);
    expect(CRAWLER_MASTER_DEFAULTS.frequency).toBe("6h");
    expect(CRAWLER_MASTER_DEFAULTS.maxDepth).toBe(12);
    expect(CRAWLER_MASTER_DEFAULTS.parallelThreads).toBe(32);
    expect(CRAWLER_MASTER_DEFAULTS.respectRobots).toBe(true);
    expect(CRAWLER_MASTER_DEFAULTS.storeFormat).toBe("jsonl");
    expect(CRAWLER_MASTER_DEFAULTS.autoClean).toBe(true);
    expect(CRAWLER_MASTER_DEFAULTS.errorRetry).toBe(3);
    expect(CRAWLER_MASTER_DEFAULTS.logLevel).toBe("verbose");
  });

  it("parses frequency hours", () => {
    expect(parseFrequencyHours("6h")).toBe(6);
    expect(parseFrequencyHours("24h")).toBe(24);
  });

  it("registers crawler master tools and queue", () => {
    expect(findTool("crawler-master")?.tool.name).toBe("Crawler Master");
    expect(findTool("deep-crawl")).toBeTruthy();
    expect(findTool("live-crawl")).toBeTruthy();
    expect(JOB_QUEUES.CRAWLER_MASTER).toBe("taxotools-crawler-master");
  });
});
