import { describe, expect, it } from "vitest";
import { JOB_QUEUES, CRAWLER_MASTER_QUEUES, CRAWLER_MASTER_QUEUE_WORKER_MAP } from "@taxotools/shared";

describe("worker queues", () => {
  it("covers crawl rank ai aeo and report", () => {
    expect(Object.values(JOB_QUEUES).length).toBeGreaterThanOrEqual(5);
  });

  it("registers crawler master pipeline queues", () => {
    expect(JOB_QUEUES.CRAWL_URLS).toBe("crawl.urls");
    expect(JOB_QUEUES.CRAWL_API_BACKLINKS).toBe("crawl.api.backlinks");
    expect(JOB_QUEUES.CRAWL_API_SERP).toBe("crawl.api.serp");
    expect(JOB_QUEUES.CRAWL_API_INDEX).toBe("crawl.api.index");
    expect(JOB_QUEUES.PROCESS_RAW).toBe("process.raw");
    expect(JOB_QUEUES.ALERTS_EVENTS).toBe("alerts.events");
    expect([...CRAWLER_MASTER_QUEUES]).toEqual([
      JOB_QUEUES.CRAWL_URLS,
      JOB_QUEUES.CRAWL_API_BACKLINKS,
      JOB_QUEUES.CRAWL_API_SERP,
      JOB_QUEUES.CRAWL_API_INDEX,
      JOB_QUEUES.PROCESS_RAW,
      JOB_QUEUES.ALERTS_EVENTS,
    ]);
    expect(Object.keys(CRAWLER_MASTER_QUEUE_WORKER_MAP)).toHaveLength(6);
  });
});
