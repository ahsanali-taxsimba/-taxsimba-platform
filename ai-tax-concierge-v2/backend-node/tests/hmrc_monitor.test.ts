import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getBlockedFactIds,
  listQuarantine,
  rollbackPublishedOverlay,
  runHmrcMonitorCycle,
  stopHmrcScheduler,
} from "../src/knowledge/monitor/service.js";
import { loadFacts, reloadFacts } from "../src/knowledge/loader.js";
import type { FetchContentApiFn } from "../src/knowledge/monitor/types.js";

function contentItem(opts: {
  title: string;
  body: string;
  base_path: string;
  public_updated_at?: string;
  withdrawn?: boolean;
}): Record<string, unknown> {
  return {
    title: opts.title,
    base_path: opts.base_path,
    content_id: "00000000-0000-4000-8000-000000000001",
    document_type: "detailed_guide",
    schema_name: "detailed_guide",
    public_updated_at: opts.public_updated_at || "2026-03-26T12:00:00Z",
    first_published_at: "2021-09-23T00:00:00Z",
    publishing_app: "whitehall",
    withdrawn_notice: opts.withdrawn
      ? { withdrawn_at: "2026-01-01T00:00:00Z", explanation: "Withdrawn for test" }
      : {},
    details: {
      body: `<div class="govspeak"><p>${opts.body}</p></div>`,
    },
  };
}

function apiFor(map: Record<string, Record<string, unknown>>): FetchContentApiFn {
  return async (basePath) => {
    const json = map[basePath];
    if (!json) return { status: 404, json: null, finalPath: basePath };
    return { status: 200, json, finalPath: String(json.base_path || basePath) };
  };
}

const MTD_BODY =
  "Making Tax Digital for Income Tax. Sole trader or landlord. " +
  "More than £50,000 starts 6 April 2026. More than £30,000 starts 6 April 2027. " +
  "More than £20,000 starts 6 April 2028. Qualifying income before expenses.";

describe("hmrc knowledge monitor — risk-based auto-publish", () => {
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

  it("auto_publishes_verified_mtd_sa_vat_and_future_dated_rules_without_manual_approval", async () => {
    const fetchContentApi = apiFor({
      "/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax":
        contentItem({
          title: "Making Tax Digital for Income Tax - GOV.UK",
          base_path:
            "/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
          body: MTD_BODY,
        }),
      "/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax":
        contentItem({
          title: "qualifying income Making Tax Digital - GOV.UK",
          base_path:
            "/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax",
          body: "Qualifying income is turnover before expenses, not profit. PAYE excluded.",
        }),
      "/register-for-vat": contentItem({
        title: "Register for VAT - GOV.UK",
        base_path: "/register-for-vat",
        body: "You must register if taxable turnover goes over £90,000.",
      }),
      "/self-assessment-tax-returns/deadlines": contentItem({
        title: "Self Assessment tax returns - GOV.UK",
        base_path: "/self-assessment-tax-returns/deadlines",
        body: "Online deadline 31 January. Paper deadline 31 October.",
      }),
      "/income-tax-rates": contentItem({
        title: "Income Tax rates and Personal Allowance - GOV.UK",
        base_path: "/income-tax-rates",
        body: "Income Tax rates and Personal Allowance guidance. The Personal Allowance is £12,570 for most people.",
      }),
    });

    const result = await runHmrcMonitorCycle({ fetchContentApi });
    expect(result.authenticity_failures).toBe(0);
    expect(result.auto_published).toBeGreaterThanOrEqual(4);
    expect(result.errors).toBe(0);

    reloadFacts();
    const mtd30 = loadFacts().find((f) => f.id === "mtd-threshold-30k-april-2027");
    expect(mtd30?.review_status).toBe("auto_published_verified_official");
    expect(mtd30?.effective_date).toBe("2027-04-06");
    expect(mtd30?.summary).toMatch(/6 April 2027/);

    const vat = loadFacts().find((f) => f.id === "vat-threshold-overview");
    expect(vat?.review_status).toBe("auto_published_verified_official");

    // Future-dated 2028 band preserved
    const mtd20 = loadFacts().find((f) => f.id === "mtd-threshold-20k-april-2028");
    expect(mtd20?.effective_date).toBe("2028-04-06");
    expect(mtd20?.tax_years).toContain("2027-28");
  });

  it("quarantines_only_affected_facts_on_conflict_and_keeps_other_knowledge", async () => {
    const fetchContentApi = apiFor({
      "/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax":
        contentItem({
          title: "Making Tax Digital for Income Tax - GOV.UK",
          base_path:
            "/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
          body: MTD_BODY,
        }),
      "/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax":
        contentItem({
          title: "qualifying income Making Tax Digital - GOV.UK",
          base_path:
            "/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax",
          body: "Qualifying income is turnover before expenses, not profit.",
        }),
      "/register-for-vat": contentItem({
        title: "Register for VAT - GOV.UK",
        base_path: "/register-for-vat",
        body: "You must register if taxable turnover goes over £90,000.",
      }),
      "/self-assessment-tax-returns/deadlines": contentItem({
        title: "Self Assessment tax returns - GOV.UK",
        base_path: "/self-assessment-tax-returns/deadlines",
        body: "Online deadline 31 January. Paper deadline 31 October.",
      }),
      "/income-tax-rates": contentItem({
        title: "Income Tax rates and Personal Allowance - GOV.UK",
        base_path: "/income-tax-rates",
        body: "Income Tax rates and Personal Allowance guidance. The Personal Allowance is £12,570 for most people.",
      }),
    });

    await runHmrcMonitorCycle({ fetchContentApi });
    // Second cycle with injected conflict on VAT
    const result = await runHmrcMonitorCycle({
      fetchContentApi,
      conflictUpdates: [
        {
          fact_id: "vat-threshold-overview",
          source_url: "https://www.gov.uk/register-for-vat",
          tax_years: ["2025-26"],
          effective_date: "2024-04-01",
          publication_date: "2026-01-01",
          applicable_conditions: null,
          summary: "Register for VAT if turnover exceeds £85,000.",
          confidence: "high",
          validation_notes: ["conflict fixture"],
        },
      ],
    });
    expect(result.blocked_fact_ids).toContain("vat-threshold-overview");

    expect(result.quarantined).toBeGreaterThan(0);
    const open = listQuarantine("quarantined");
    expect(open.some((q) => q.affected_fact_ids.includes("vat-threshold-overview"))).toBe(
      true,
    );
    expect(getBlockedFactIds()).toContain("vat-threshold-overview");

    reloadFacts();
    // Affected VAT fact omitted from customer-facing corpus
    expect(loadFacts().find((f) => f.id === "vat-threshold-overview")).toBeFalsy();
    // Unaffected MTD knowledge remains
    expect(loadFacts().find((f) => f.id === "mtd-threshold-30k-april-2027")).toBeTruthy();
  });

  it("handles_withdrawn_outage_malformed_and_rollback", async () => {
    const good = apiFor({
      "/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax":
        contentItem({
          title: "Making Tax Digital for Income Tax - GOV.UK",
          base_path:
            "/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
          body: MTD_BODY,
        }),
      "/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax":
        contentItem({
          title: "qualifying income Making Tax Digital - GOV.UK",
          base_path:
            "/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax",
          body: "Qualifying income is turnover before expenses, not profit.",
        }),
      "/register-for-vat": contentItem({
        title: "Register for VAT - GOV.UK",
        base_path: "/register-for-vat",
        body: "You must register if taxable turnover goes over £90,000.",
      }),
      "/self-assessment-tax-returns/deadlines": contentItem({
        title: "Self Assessment tax returns - GOV.UK",
        base_path: "/self-assessment-tax-returns/deadlines",
        body: "Online deadline 31 January. Paper deadline 31 October.",
      }),
      "/income-tax-rates": contentItem({
        title: "Income Tax rates and Personal Allowance - GOV.UK",
        base_path: "/income-tax-rates",
        body: "Income Tax rates and Personal Allowance guidance. The Personal Allowance is £12,570 for most people.",
      }),
    });
    await runHmrcMonitorCycle({ fetchContentApi: good });
    reloadFacts();
    expect(
      loadFacts().find((f) => f.id === "mtd-threshold-30k-april-2027")?.review_status,
    ).toBe("auto_published_verified_official");

    // Withdrawn VAT document
    const withdrawn = apiFor({
      "/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax":
        contentItem({
          title: "Making Tax Digital for Income Tax - GOV.UK",
          base_path:
            "/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
          body: MTD_BODY,
          public_updated_at: "2026-04-01T00:00:00Z",
        }),
      "/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax":
        contentItem({
          title: "qualifying income Making Tax Digital - GOV.UK",
          base_path:
            "/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax",
          body: "Qualifying income is turnover before expenses, not profit.",
          public_updated_at: "2026-04-01T00:00:00Z",
        }),
      "/register-for-vat": contentItem({
        title: "Register for VAT - GOV.UK",
        base_path: "/register-for-vat",
        body: "You must register if taxable turnover goes over £90,000.",
        withdrawn: true,
      }),
      "/self-assessment-tax-returns/deadlines": contentItem({
        title: "Self Assessment tax returns - GOV.UK",
        base_path: "/self-assessment-tax-returns/deadlines",
        body: "Online deadline 31 January. Paper deadline 31 October.",
        public_updated_at: "2026-04-01T00:00:00Z",
      }),
      "/income-tax-rates": contentItem({
        title: "Income Tax rates and Personal Allowance - GOV.UK",
        base_path: "/income-tax-rates",
        body: "Income Tax rates and Personal Allowance guidance. The Personal Allowance is £12,570 for most people.",
        public_updated_at: "2026-04-01T00:00:00Z",
      }),
    });
    const w = await runHmrcMonitorCycle({ fetchContentApi: withdrawn });
    expect(w.quarantined).toBeGreaterThan(0);

    // Source outage — all 404; previous knowledge retained
    const outage: FetchContentApiFn = async (basePath) => ({
      status: 503,
      json: null,
      finalPath: basePath,
    });
    const o = await runHmrcMonitorCycle({ fetchContentApi: outage });
    expect(o.errors).toBeGreaterThan(0);
    reloadFacts();
    expect(loadFacts().find((f) => f.id === "mtd-threshold-50k-april-2026")).toBeTruthy();

    // Malformed VAT (missing threshold phrase)
    const malformed = apiFor({
      "/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax":
        contentItem({
          title: "Making Tax Digital for Income Tax - GOV.UK",
          base_path:
            "/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
          body: MTD_BODY,
          public_updated_at: "2026-05-01T00:00:00Z",
        }),
      "/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax":
        contentItem({
          title: "qualifying income Making Tax Digital - GOV.UK",
          base_path:
            "/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax",
          body: "Qualifying income is turnover before expenses, not profit.",
          public_updated_at: "2026-05-01T00:00:00Z",
        }),
      "/register-for-vat": contentItem({
        title: "Register for VAT - GOV.UK",
        base_path: "/register-for-vat",
        body: "VAT registration rules exist but the threshold figure is missing here.",
        public_updated_at: "2026-05-01T00:00:00Z",
      }),
      "/self-assessment-tax-returns/deadlines": contentItem({
        title: "Self Assessment tax returns - GOV.UK",
        base_path: "/self-assessment-tax-returns/deadlines",
        body: "Online deadline 31 January. Paper deadline 31 October.",
        public_updated_at: "2026-05-01T00:00:00Z",
      }),
      "/income-tax-rates": contentItem({
        title: "Income Tax rates and Personal Allowance - GOV.UK",
        base_path: "/income-tax-rates",
        body: "Income Tax rates and Personal Allowance guidance. The Personal Allowance is £12,570 for most people.",
        public_updated_at: "2026-05-01T00:00:00Z",
      }),
    });
    const m = await runHmrcMonitorCycle({ fetchContentApi: malformed });
    expect(m.quarantined + m.authenticity_failures).toBeGreaterThan(0);

    const rb = rollbackPublishedOverlay();
    expect(rb.rolled_back).toBe(true);
  });
});
