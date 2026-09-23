import { describe, expect, it } from "vitest";
import {
  CRAWLER_MASTER_DEFAULTS,
  CRAWLER_MASTER_MODULES,
  CRAWLER_MASTER_ENABLE,
  CRAWLER_MASTER_PROVIDERS,
  CRAWLER_MASTER_MODES,
  CRAWLER_MASTER_EXTRACT,
  CRAWLER_MASTER_QUEUES,
  CRAWLER_MASTER_WORKERS,
  CRAWLER_MASTER_DB_SCHEMA,
  CRAWLER_MASTER_QUEUE_WORKER_MAP,
  parseFrequencyHours,
  findTool,
  JOB_QUEUES,
} from "@taxotools/shared";

describe("seo.crawler.master.init", () => {
  it("matches CLI defaults", () => {
    expect([...CRAWLER_MASTER_ENABLE]).toEqual([
      "backlinks",
      "keywords",
      "serp",
      "competitors",
      "traffic",
    ]);
    expect([...CRAWLER_MASTER_MODULES]).toEqual([...CRAWLER_MASTER_ENABLE]);
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
    expect([...CRAWLER_MASTER_QUEUES]).toEqual([
      "crawl.urls",
      "crawl.api.backlinks",
      "crawl.api.serp",
      "crawl.api.index",
      "process.raw",
      "alerts.events",
    ]);
    expect([...CRAWLER_MASTER_WORKERS]).toEqual([
      "url_crawler",
      "backlink_api",
      "serp_api",
      "index_api",
      "processor",
      "alerts",
    ]);
    expect([...CRAWLER_MASTER_DB_SCHEMA]).toEqual([
      "projects",
      "crawler_configs",
      "crawl_jobs",
      "backlinks",
      "serp_snapshots",
      "raw_documents",
      "crawler_logs",
    ]);
    expect(CRAWLER_MASTER_DEFAULTS.frequency).toBe("6h");
    expect(CRAWLER_MASTER_DEFAULTS.maxDepth).toBe(12);
    expect(CRAWLER_MASTER_DEFAULTS.parallelThreads).toBe(32);
    expect(CRAWLER_MASTER_DEFAULTS.respectRobots).toBe(true);
    expect(CRAWLER_MASTER_DEFAULTS.storeFormat).toBe("jsonl");
    expect(CRAWLER_MASTER_DEFAULTS.autoClean).toBe(true);
    expect(CRAWLER_MASTER_DEFAULTS.errorRetry).toBe(3);
    expect(CRAWLER_MASTER_DEFAULTS.logLevel).toBe("verbose");
    expect(CRAWLER_MASTER_DEFAULTS.queues).toEqual([...CRAWLER_MASTER_QUEUES]);
    expect(CRAWLER_MASTER_DEFAULTS.workers).toEqual([...CRAWLER_MASTER_WORKERS]);
    expect(CRAWLER_MASTER_DEFAULTS.dbSchema).toEqual([...CRAWLER_MASTER_DB_SCHEMA]);
  });

  it("maps queues to workers", () => {
    expect(CRAWLER_MASTER_QUEUE_WORKER_MAP["crawl.urls"]).toBe("url_crawler");
    expect(CRAWLER_MASTER_QUEUE_WORKER_MAP["crawl.api.backlinks"]).toBe("backlink_api");
    expect(CRAWLER_MASTER_QUEUE_WORKER_MAP["crawl.api.serp"]).toBe("serp_api");
    expect(CRAWLER_MASTER_QUEUE_WORKER_MAP["crawl.api.index"]).toBe("index_api");
    expect(CRAWLER_MASTER_QUEUE_WORKER_MAP["process.raw"]).toBe("processor");
    expect(CRAWLER_MASTER_QUEUE_WORKER_MAP["alerts.events"]).toBe("alerts");
  });

  it("parses frequency hours", () => {
    expect(parseFrequencyHours("6h")).toBe(6);
    expect(parseFrequencyHours("24h")).toBe(24);
  });

  it("registers crawler master tools and queues", () => {
    expect(findTool("crawler-master")?.tool.name).toBe("Crawler Master");
    expect(findTool("deep-crawl")).toBeTruthy();
    expect(findTool("live-crawl")).toBeTruthy();
    expect(JOB_QUEUES.CRAWLER_MASTER).toBe("taxotools-crawler-master");
    expect(JOB_QUEUES.CRAWL_URLS).toBe("crawl.urls");
    expect(JOB_QUEUES.CRAWL_API_BACKLINKS).toBe("crawl.api.backlinks");
    expect(JOB_QUEUES.CRAWL_API_SERP).toBe("crawl.api.serp");
    expect(JOB_QUEUES.CRAWL_API_INDEX).toBe("crawl.api.index");
    expect(JOB_QUEUES.PROCESS_RAW).toBe("process.raw");
    expect(JOB_QUEUES.ALERTS_EVENTS).toBe("alerts.events");
  });
});
