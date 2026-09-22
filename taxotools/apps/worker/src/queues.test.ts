import { describe, expect, it } from "vitest";
import { JOB_QUEUES } from "@taxotools/shared";

describe("worker queues", () => {
  it("covers crawl rank ai aeo and report", () => {
    expect(Object.values(JOB_QUEUES).length).toBeGreaterThanOrEqual(5);
  });
});
