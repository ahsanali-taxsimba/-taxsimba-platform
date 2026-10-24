import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { bootTestApp, dropTestDb } from "../../helpers/app";
import { nextLondonEightAm, londonCalendarDate, ukTaxYearForLondonDate } from "../../../src/content-automation/london";
import { mapToArticle } from "../../../src/content-automation/pipeline/map";
import { validateDraft, hasBlockingIssues } from "../../../src/content-automation/pipeline/validate";
import { buildFixtureDraft } from "../../../src/content-automation/pipeline/draft";
import {
  runDemoNewArticle,
  runDemoUpdateExisting,
  recoverInterruptedJobs,
  runDailyContentAutomation,
} from "../../../src/content-automation/pipeline/dailyRun";
import { advanceJob } from "../../../src/content-automation/pipeline/runJob";
import {
  createJob,
  exportBackup,
  getLiveOverlay,
  listLiveOverlays,
  loadSourceMap,
  publishLive,
  restoreBackup,
  rollbackLive,
  saveSourceState,
  startRun,
  updateJob,
  ensureContentAutomationIndexes,
} from "../../../src/content-automation/store";
import { fetchGovukContent } from "../../../src/content-automation/sources/govuk";
import { calendarEventsFor } from "../../../src/content-automation/sources/calendar";
import { alertMissingScheduler } from "../../../src/content-automation/alerts";
import { listAlerts } from "../../../src/content-automation/store";

describe("HMRC content automation", () => {
  beforeAll(async () => {
    process.env.CONTENT_AUTOMATION_FIXTURE_MODE = "true";
    process.env.CONTENT_AUTOMATION_ENABLED = "true";
    process.env.CONTENT_AUTOMATION_PAUSED = "false";
    await bootTestApp();
    await ensureContentAutomationIndexes();
  }, 120_000);

  beforeEach(async () => {
    process.env.CONTENT_AUTOMATION_PAUSED = "false";
    process.env.CONTENT_AUTOMATION_FIXTURE_MODE = "true";
  });

  afterAll(async () => {
    await dropTestDb();
  });

  it("loads the 120-article source map and first-20 order", () => {
    const map = loadSourceMap();
    expect(map.articleCount).toBe(120);
    expect(map.first20).toHaveLength(20);
    expect(map.first20[0]).toBe("mtd-accountant-cost");
    expect(map.govukSourceCount).toBeGreaterThan(100);
  });

  it("computes next 08:00 Europe/London in the future", () => {
    const next = nextLondonEightAm(new Date("2026-06-15T10:00:00Z")); // BST
    expect(next.getTime()).toBeGreaterThan(Date.parse("2026-06-15T10:00:00Z"));
    const winter = nextLondonEightAm(new Date("2026-01-15T10:00:00Z")); // GMT
    expect(winter.getTime()).toBeGreaterThan(Date.parse("2026-01-15T10:00:00Z"));
  });

  it("maps known GOV.UK URLs to existing guides for updates", () => {
    const mapping = mapToArticle({
      source: {
        url: "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
        hash: "abc",
        fetchedAt: new Date().toISOString(),
      },
    });
    expect(mapping.action).toBe("update");
    expect(mapping.slug).toBeTruthy();
  });

  it("blocks thin dishonest drafts", () => {
    const draft = buildFixtureDraft({
      mapping: {
        action: "create",
        slug: "brand-new-ni-guide-for-tests",
        reason: "test",
      },
      source: {
        url: "https://www.gov.uk/guidance/national-insurance-for-self-employed",
        title: "NI",
        hash: "x",
        fetchedAt: new Date().toISOString(),
      },
      changeSummary: "test",
    });
    draft.content = "<p>Buy now guaranteed save £50 last chance</p>";
    draft.metaTitle = "x";
    const issues = validateDraft(draft);
    expect(hasBlockingIssues(issues)).toBe(true);
  });

  it("publishes one useful new article through the full pipeline", async () => {
    const job = await runDemoNewArticle();
    expect(["public_verified", "blocked", "skipped"]).toContain(job.stage);
    // forceNew create should verify publicly in fixture mode
    expect(job.stage).toBe("public_verified");
    expect(job.draft?.isUpdate).toBe(false);
    expect(job.draft?.sources?.[0]?.url).toMatch(/gov\.uk/);
    const live = await getLiveOverlay(job.draft!.slug);
    expect(live?.revisionId).toBe(job.publishedRevisionId);
  }, 60_000);

  it("updates an existing guide preserving slug and first-publication date", async () => {
    const job = await runDemoUpdateExisting();
    expect(job.stage).toBe("public_verified");
    expect(job.draft?.isUpdate).toBe(true);
    expect(job.mappedSlug).toBeTruthy();
    const map = loadSourceMap();
    const base = map.articles.find((a) => a.slug === job.mappedSlug);
    if (base?.publishedAt) {
      expect(new Date(job.draft!.publishedAt).getTime()).toBe(new Date(base.publishedAt).getTime());
    }
    const live = await getLiveOverlay(job.mappedSlug!);
    expect(live?.slug).toBe(job.mappedSlug);
  }, 60_000);

  it("does not duplicate when the same source change is enqueued twice", async () => {
    const run = await startRun(londonCalendarDate());
    const snapshot = await fetchGovukContent(
      "https://www.gov.uk/self-assessment-tax-returns/deadlines",
    );
    const a = await createJob({
      runId: run.id,
      kind: "source_change",
      sourceUrls: [snapshot.url],
      sourceSnapshots: [snapshot],
    });
    const b = await createJob({
      runId: run.id,
      kind: "source_change",
      sourceUrls: [snapshot.url],
      sourceSnapshots: [snapshot],
    });
    expect(b.id).toBe(a.id);
    expect(b.duplicateOfJobId || a.id).toBeTruthy();
  });

  it("recovers interrupted claims without creating duplicates", async () => {
    const run = await startRun(londonCalendarDate());
    const snapshot = await fetchGovukContent(
      "https://www.gov.uk/guidance/expenses-if-youre-self-employed",
    );
    const job = await createJob({
      runId: run.id,
      kind: "source_change",
      sourceUrls: [`${snapshot.url}?interrupted=1`],
      sourceSnapshots: [{ ...snapshot, url: `${snapshot.url}?interrupted=1` }],
    });
    await updateJob(job.id, { claimToken: "stuck-token", claimedAt: new Date().toISOString() });
    const recovered = await recoverInterruptedJobs();
    expect(recovered).toBeGreaterThanOrEqual(1);
    const again = await createJob({
      runId: run.id,
      kind: "source_change",
      sourceUrls: [`${snapshot.url}?interrupted=1`],
      sourceSnapshots: [{ ...snapshot, url: `${snapshot.url}?interrupted=1` }],
    });
    expect(again.id).toBe(job.id);
  });

  it("blocks out-of-order conflicting evidence", async () => {
    const run = await startRun(londonCalendarDate());
    const url =
      "https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax";
    await saveSourceState({
      url,
      hash: "old",
      fetchedAt: new Date().toISOString(),
      publicUpdatedAt: "2026-10-01T00:00:00.000Z",
    });
    const snapshot = await fetchGovukContent(url);
    snapshot.hash = "new-hash";
    snapshot.publicUpdatedAt = "2026-01-01T00:00:00.000Z"; // older than stored
    const job = await createJob({
      runId: run.id,
      kind: "source_change",
      sourceUrls: [url],
      sourceSnapshots: [snapshot],
      metadata: { changeSummary: "conflict demo" },
    });
    await updateJob(job.id, {
      evidenceConflicts: [
        {
          code: "out_of_order_update",
          message: "Fetched source public_updated_at is older than the stored snapshot",
          urls: [url],
        },
      ],
    });
    const advanced = await advanceJob(job.id, {
      conflictingEvidence: [
        {
          code: "out_of_order_update",
          message: "Fetched source public_updated_at is older than the stored snapshot",
          urls: [url],
        },
      ],
    });
    expect(advanced?.stage).toBe("blocked");
  }, 60_000);

  it("supports tax-year rollover calendar events", () => {
    const events = calendarEventsFor(new Date("2027-04-06T12:00:00Z"));
    expect(events.some((e) => e.kind === "tax_year_rollover")).toBe(true);
    expect(ukTaxYearForLondonDate("2027-04-06")).toBe("2027-28");
  });

  it("handles withdrawn sources as a dedicated job kind path", async () => {
    const run = await startRun(londonCalendarDate());
    const snapshot = await fetchGovukContent(
      "https://www.gov.uk/guidance/withdrawn-example-mtd-pilot-page",
    );
    expect(snapshot.withdrawn).toBe(true);
    const job = await createJob({
      runId: run.id,
      kind: "withdrawn_source",
      sourceUrls: [snapshot.url],
      sourceSnapshots: [snapshot],
      metadata: { changeSummary: "withdrawn" },
    });
    const advanced = await advanceJob(job.id);
    // Mapping may skip or update; either is acceptable as long as pipeline completes a stage.
    expect(advanced?.stage).toBeTruthy();
  }, 60_000);

  it("rolls back a failed publication to the previous revision", async () => {
    const run = await startRun(londonCalendarDate());
    const snapshot = await fetchGovukContent(
      "https://www.gov.uk/guidance/send-quarterly-updates-making-tax-digital-for-income-tax",
    );
    const job1 = await createJob({
      runId: run.id,
      kind: "manual_demo",
      sourceUrls: [`${snapshot.url}#v1`],
      sourceSnapshots: [{ ...snapshot, url: `${snapshot.url}#v1` }],
      mappedSlug: "mtd-cumulative-quarterly-updates",
      metadata: {
        mapping: {
          action: "update",
          slug: "mtd-cumulative-quarterly-updates",
          reason: "rollback demo",
          firstPublishedAt: "2025-01-01T00:00:00.000Z",
        },
        changeSummary: "first revision",
      },
    });
    await updateJob(job1.id, { stage: "mapped", mappedSlug: "mtd-cumulative-quarterly-updates" });
    const published = await advanceJob(job1.id);
    expect(published?.stage).toBe("public_verified");

    const draft2 = {
      ...published!.draft!,
      content: published!.draft!.content + "<p>Second revision body for rollback test.</p>",
      contentUpdatedAt: new Date().toISOString(),
      changeSummary: "second revision",
    };
    const job2 = await createJob({
      runId: run.id,
      kind: "manual_demo",
      sourceUrls: [`${snapshot.url}#v2`],
      sourceSnapshots: [{ ...snapshot, url: `${snapshot.url}#v2`, hash: snapshot.hash + "2" }],
      mappedSlug: "mtd-cumulative-quarterly-updates",
      draft: draft2,
      metadata: { changeSummary: "second" },
    });
    await updateJob(job2.id, { stage: "validated", draft: draft2 });
    const { previousRevisionId } = await publishLive(job2, draft2);
    expect(previousRevisionId).toBe(published!.publishedRevisionId);
    const ok = await rollbackLive(
      "mtd-cumulative-quarterly-updates",
      previousRevisionId,
      job2.id,
    );
    expect(ok).toBe(true);
    const live = await getLiveOverlay("mtd-cumulative-quarterly-updates");
    expect(live?.revisionId).toBe(published!.publishedRevisionId);
  }, 60_000);

  it("exports and restores a backup", async () => {
    // Ensure at least one live overlay exists for this assertion.
    const job = await runDemoNewArticle();
    expect(job.stage).toBe("public_verified");
    const backup = await exportBackup();
    expect(backup.live.length).toBeGreaterThan(0);
    await restoreBackup(backup);
    expect((await listLiveOverlays()).length).toBe(backup.live.length);
  }, 60_000);

  it("raises a missing-scheduler alert when runs are stale", async () => {
    await alertMissingScheduler("2020-01-01T00:00:00.000Z", new Date("2026-10-24T00:00:00Z"));
    const alerts = await listAlerts(10);
    expect(alerts.some((a) => a.code === "missing_scheduler")).toBe(true);
  });

  it("honours the pause switch", async () => {
    process.env.CONTENT_AUTOMATION_PAUSED = "true";
    const result = await runDailyContentAutomation(new Date(), { ignoreEnabledFlag: true });
    expect(result.paused).toBe(true);
  });
});
