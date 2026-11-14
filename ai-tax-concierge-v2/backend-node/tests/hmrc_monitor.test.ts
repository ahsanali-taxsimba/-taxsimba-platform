import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  approveQuarantine,
  listQuarantine,
  rollbackPublishedOverlay,
  runHmrcMonitorCycle,
  stopHmrcScheduler,
} from "../src/knowledge/monitor/service.js";
import { loadFacts, reloadFacts } from "../src/knowledge/loader.js";

function htmlFor(url: string, tweak = ""): string {
  if (url.includes("making-tax-digital-for-income-tax") && !url.includes("qualifying")) {
    return `<html><head><title>Making Tax Digital for Income Tax - GOV.UK</title></head>
      <body>HMRC guidance ${tweak}. Start from 6 April 2026, 6 April 2027, 6 April 2028.
      Thresholds £50,000 £30,000 £20,000.</body></html>`;
  }
  if (url.includes("qualifying-income")) {
    return `<html><head><title>Work out your qualifying income for Making Tax Digital - GOV.UK</title></head>
      <body>Qualifying income is turnover before expenses ${tweak}.</body></html>`;
  }
  if (url.includes("vat-registration")) {
    return `<html><head><title>VAT registration thresholds - GOV.UK</title></head>
      <body>VAT threshold is £90,000 ${tweak}.</body></html>`;
  }
  if (url.includes("deadlines")) {
    return `<html><head><title>Self Assessment tax return deadlines - GOV.UK</title></head>
      <body>Online deadline 31 January. Paper deadline 31 October ${tweak}.</body></html>`;
  }
  if (url.includes("income-tax-rates")) {
    return `<html><head><title>Income Tax rates and Personal Allowance - GOV.UK</title></head>
      <body>Personal Allowance £12,570 ${tweak}.</body></html>`;
  }
  return `<html><head><title>GOV.UK</title></head><body>HMRC ${tweak}</body></html>`;
}

describe("hmrc knowledge monitor", () => {
  let runtimeDir: string;

  beforeEach(() => {
    runtimeDir = mkdtempSync(path.join(os.tmpdir(), "simba-hmrc-"));
    process.env.CONCIERGE_RUNTIME_DIR = runtimeDir;
    reloadFacts();
  });

  afterEach(() => {
    stopHmrcScheduler();
    delete process.env.CONCIERGE_RUNTIME_DIR;
    reloadFacts();
    rmSync(runtimeDir, { recursive: true, force: true });
  });

  it("quarantines_content_changes_and_does_not_publish_to_customers", async () => {
    let version = 1;
    const fetchPage = async (url: string) => ({
      status: 200,
      html: htmlFor(url, version === 1 ? "" : "CHANGED"),
      finalUrl: url,
    });

    const first = await runHmrcMonitorCycle({ fetchPage });
    expect(first.checked).toBeGreaterThan(0);
    expect(first.authenticity_failures).toBe(0);
    expect(first.quarantined).toBeGreaterThan(0);

    const before = loadFacts().find((f) => f.id === "mtd-threshold-30k-april-2027");
    expect(before?.review_status).not.toBe("accountant_approved_overlay");

    version = 2;
    const second = await runHmrcMonitorCycle({
      fetchPage,
      forceQuarantineWatchId: "mtd_if_and_when",
    });
    expect(second.quarantined).toBeGreaterThan(0);
    const open = listQuarantine("quarantined");
    const q = open.find((i) => i.watch_id === "mtd_if_and_when");
    expect(q).toBeTruthy();

    reloadFacts();
    const mid = loadFacts().find((f) => f.id === "mtd-threshold-30k-april-2027");
    expect(mid?.review_status).not.toBe("accountant_approved_overlay");

    const overlay = approveQuarantine(q!.id, {
      accountant_note: "Test approval — dates unchanged",
    });
    expect(overlay.facts.length).toBeGreaterThan(0);
    reloadFacts();
    const after = loadFacts().find((f) => f.id === "mtd-threshold-30k-april-2027");
    expect(after?.review_status).toBe("accountant_approved_overlay");

    const rb = rollbackPublishedOverlay();
    expect(rb.rolled_back).toBe(true);
    reloadFacts();
    const rolled = loadFacts().find((f) => f.id === "mtd-threshold-30k-april-2027");
    expect(rolled?.review_status).not.toBe("accountant_approved_overlay");
  });

  it("rejects_non_govuk_hosts", async () => {
    const fetchPage = async (url: string) => ({
      status: 200,
      html: htmlFor(url),
      finalUrl: "https://evil.example/phishing",
    });
    const result = await runHmrcMonitorCycle({ fetchPage });
    expect(result.authenticity_failures).toBeGreaterThan(0);
  });
});
