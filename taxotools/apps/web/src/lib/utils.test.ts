import { describe, expect, it } from "vitest";
import { PLAN_LIMITS, isUnlimited, JOB_QUEUES } from "@taxotools/shared";
import { currentUsagePeriod, domainFromUrl, slugify } from "./utils";

describe("taxotools shared plan model", () => {
  it("defines four tiers with extensible limits", () => {
    expect(Object.keys(PLAN_LIMITS)).toEqual(["STARTER", "PRO", "AGENCY", "ENTERPRISE"]);
    expect(isUnlimited(PLAN_LIMITS.ENTERPRISE.sites)).toBe(true);
    expect(PLAN_LIMITS.STARTER.apiAccess).toBe(false);
    expect(PLAN_LIMITS.AGENCY.whiteLabel).toBe(true);
  });

  it("uses isolated queue names", () => {
    expect(JOB_QUEUES.AEO_SCAN).toContain("taxotools");
  });
});

describe("utils", () => {
  it("slugifies account names", () => {
    expect(slugify("Acme Marketing!")).toBe("acme-marketing");
  });

  it("extracts domains", () => {
    expect(domainFromUrl("https://www.Example.com/path")).toBe("example.com");
  });

  it("formats usage period", () => {
    expect(currentUsagePeriod(new Date("2026-09-22T12:00:00Z"))).toBe("2026-09");
  });
});
