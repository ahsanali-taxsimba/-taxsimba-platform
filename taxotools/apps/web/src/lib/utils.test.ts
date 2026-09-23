import { describe, expect, it } from "vitest";
import { PLAN_LIMITS, PLAN_CODES, isUnlimited, JOB_QUEUES } from "@taxotools/shared";

describe("shared plans & queues", () => {
  it("exposes Search Atlas–competitive plan ladder", () => {
    expect([...PLAN_CODES]).toEqual(["STARTER", "GROWTH", "PRO", "AGENCY", "ENTERPRISE"]);
    expect(isUnlimited(PLAN_LIMITS.ENTERPRISE.sites)).toBe(true);
    expect(PLAN_LIMITS.STARTER.apiAccess).toBe(false);
    expect(PLAN_LIMITS.STARTER.ottoProjects).toBe(1);
    expect(PLAN_LIMITS.GROWTH.smartAds).toBe(true);
    expect(PLAN_LIMITS.AGENCY.whiteLabel).toBe(true);
  });

  it("namespaces automation job queues", () => {
    expect(JOB_QUEUES.AUTO_SEO).toBe("taxotools-auto-seo");
    expect(JOB_QUEUES.CMS_PUBLISH).toBe("taxotools-cms-publish");
    expect(JOB_QUEUES.SMART_ADS).toBe("taxotools-smart-ads");
    expect(JOB_QUEUES.WILDFIRE).toBe("taxotools-wildfire");
    expect(JOB_QUEUES.QUEST).toBe("taxotools-quest");
    expect(JOB_QUEUES.INSTANT_INDEX).toBe("taxotools-instant-index");
  });
});
