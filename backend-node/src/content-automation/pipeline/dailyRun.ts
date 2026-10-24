import {
  contentAutomationApiBudget,
  contentAutomationDailyJobLimit,
  contentAutomationEnabled,
  contentAutomationPaused,
  MONITORED_TOPICS,
} from "../config";
import { londonCalendarDate } from "../london";
import { calendarEventsFor } from "../sources/calendar";
import { discoverCompetitorTopicIdeas } from "../sources/competitors";
import { discoverGovukTopics, fetchGovukContent } from "../sources/govuk";
import {
  consumeApiBudget,
  createJob,
  finishRun,
  getSourceState,
  listOpenJobs,
  loadSourceMap,
  recordAlert,
  saveSourceState,
  startRun,
  updateJob,
} from "../store";
import { advanceJob } from "./runJob";
import { AutomationJob, EvidenceConflict } from "../types";

export type DailyRunResult = {
  runId: string;
  londonDate: string;
  status: string;
  jobs: AutomationJob[];
  paused?: boolean;
};

export async function recoverInterruptedJobs(): Promise<number> {
  const open = await listOpenJobs();
  let n = 0;
  for (const job of open) {
    if (job.claimToken) {
      await updateJob(job.id, { claimToken: null, claimedAt: null });
      n += 1;
    }
  }
  return n;
}

export async function runDailyContentAutomation(
  now = new Date(),
  opts: { ignoreEnabledFlag?: boolean } = {},
): Promise<DailyRunResult> {
  const londonDate = londonCalendarDate(now);

  if (!opts.ignoreEnabledFlag && !contentAutomationEnabled()) {
    await recordAlert({
      severity: "warning",
      code: "scheduler_disabled",
      message:
        "CONTENT_AUTOMATION_ENABLED is not true — daily HMRC content automation did not run",
    });
    return {
      runId: "disabled",
      londonDate,
      status: "paused",
      jobs: [],
      paused: true,
    };
  }

  if (contentAutomationPaused()) {
    await recordAlert({
      severity: "warning",
      code: "automation_paused",
      message: "CONTENT_AUTOMATION_PAUSED=true — run skipped",
    });
    return {
      runId: "paused",
      londonDate,
      status: "paused",
      jobs: [],
      paused: true,
    };
  }

  await recoverInterruptedJobs();
  const run = await startRun(londonDate);
  const jobs: AutomationJob[] = [];
  const limit = contentAutomationDailyJobLimit();
  const budgetLimit = contentAutomationApiBudget();
  let created = 0;

  try {
    const map = loadSourceMap();

    // 1) Detect changes / withdrawals on mapped official sources (bounded).
    for (const url of map.govukSources.slice(0, Math.min(40, map.govukSources.length))) {
      if (created >= limit) break;
      const okBudget = await consumeApiBudget(londonDate, 1, budgetLimit);
      if (!okBudget) {
        await recordAlert({
          severity: "warning",
          code: "api_budget",
          message: "API budget exhausted for London day; remaining source checks deferred",
          runId: run.id,
        });
        break;
      }
      const snapshot = await fetchGovukContent(url);
      const prev = await getSourceState(url);

      if (snapshot.withdrawn) {
        const job = await createJob({
          runId: run.id,
          kind: "withdrawn_source",
          sourceUrls: [url],
          sourceSnapshots: [snapshot],
          metadata: {
            changeSummary: "Official GOV.UK source appears withdrawn or removed",
          },
        });
        if (!job.duplicateOfJobId) {
          created += 1;
          jobs.push(job);
        }
        await saveSourceState(snapshot);
        continue;
      }

      if (prev && prev.hash !== snapshot.hash) {
        // Out-of-order / conflicting evidence: newer public_updated_at should win;
        // if timestamps go backwards, record conflict and block that job.
        const conflicts: EvidenceConflict[] = [];
        if (
          prev.publicUpdatedAt &&
          snapshot.publicUpdatedAt &&
          new Date(snapshot.publicUpdatedAt).getTime() <
            new Date(prev.publicUpdatedAt).getTime()
        ) {
          conflicts.push({
            code: "out_of_order_update",
            message:
              "Fetched source public_updated_at is older than the stored snapshot — conflicting evidence",
            urls: [url],
          });
        }
        const job = await createJob({
          runId: run.id,
          kind: "source_change",
          sourceUrls: [url],
          sourceSnapshots: [snapshot],
          metadata: {
            changeSummary: `GOV.UK content hash changed for ${url}`,
            previousHash: prev.hash,
          },
        });
        if (!job.duplicateOfJobId) {
          if (conflicts.length) {
            await updateJob(job.id, { evidenceConflicts: conflicts });
          }
          created += 1;
          jobs.push(await getUpdated(job.id));
        }
      }
      await saveSourceState(snapshot);
    }

    // 2) Discover new official topics.
    if (created < limit) {
      const discovered = await discoverGovukTopics([...MONITORED_TOPICS]);
      for (const item of discovered) {
        if (created >= limit) break;
        const alreadyMapped = map.articles.some((a) =>
          a.sources.some((s) => s.url === item.link),
        );
        if (alreadyMapped) continue;
        const snapshot = await fetchGovukContent(item.link);
        const job = await createJob({
          runId: run.id,
          kind: "new_topic",
          sourceUrls: [item.link],
          sourceSnapshots: [snapshot],
          metadata: {
            topicTitle: item.title,
            changeSummary: `New relevant GOV.UK topic candidate: ${item.title}`,
            forceNew: false,
          },
        });
        if (!job.duplicateOfJobId) {
          created += 1;
          jobs.push(job);
        }
      }
    }

    // 3) Competitor ideas (ideas only — still require GOV.UK mapping later).
    if (created < limit) {
      const ideas = await discoverCompetitorTopicIdeas();
      for (const idea of ideas.slice(0, 2)) {
        if (created >= limit) break;
        // Bind idea to a monitored GOV.UK discovery sample / search hit rather than competitor HTML.
        const gov = await discoverGovukTopics([idea.question]);
        const link = gov[0]?.link;
        if (!link) continue;
        const snapshot = await fetchGovukContent(link);
        const job = await createJob({
          runId: run.id,
          kind: "new_topic",
          sourceUrls: [link],
          sourceSnapshots: [snapshot],
          metadata: {
            topicTitle: idea.question,
            changeSummary: `Competitor listing suggested a reader question; drafting only from GOV.UK ${link}`,
            competitorIdeaSource: idea.sourceUrl,
            ideaOnly: true,
          },
        });
        if (!job.duplicateOfJobId) {
          created += 1;
          jobs.push(job);
        }
      }
    }

    // 4) Calendar-driven maintenance.
    for (const event of calendarEventsFor(now)) {
      if (created >= limit) break;
      const slug = event.relatedSlugs[0];
      if (!slug) continue;
      const article = map.articles.find((a) => a.slug === slug);
      const sourceUrl = article?.sources[0]?.url;
      if (!sourceUrl) continue;
      const snapshot = await fetchGovukContent(sourceUrl);
      const job = await createJob({
        runId: run.id,
        kind: "calendar_rollover",
        sourceUrls: [sourceUrl],
        sourceSnapshots: [snapshot],
        mappedSlug: slug,
        metadata: {
          topicTitle: article?.title,
          changeSummary: `${event.title}. ${event.notes}`,
          calendarEventId: event.id,
          mapping: {
            action: "update",
            slug,
            reason: "calendar maintenance",
            firstPublishedAt: article?.publishedAt,
            existingTitle: article?.title,
          },
        },
      });
      if (!job.duplicateOfJobId) {
        // Calendar jobs start already mapped.
        await updateJob(job.id, {
          stage: "mapped",
          mappedSlug: slug,
        });
        created += 1;
        jobs.push(await getUpdated(job.id));
      }
    }

    // Advance every job created in this run (and any recovered open jobs).
    const toAdvance = [...jobs, ...(await listOpenJobs(run.id))];
    const seen = new Set<string>();
    let completed = 0;
    let blocked = 0;
    let skipped = 0;
    for (const job of toAdvance) {
      if (seen.has(job.id)) continue;
      seen.add(job.id);
      const conflicts = job.evidenceConflicts;
      const advanced = await advanceJob(job.id, { conflictingEvidence: conflicts });
      if (!advanced) continue;
      if (advanced.stage === "public_verified") completed += 1;
      else if (advanced.stage === "blocked") blocked += 1;
      else if (advanced.stage === "skipped") skipped += 1;
      jobs.push(advanced);
    }

    const status =
      blocked > 0 && completed > 0 ? "partial" : blocked > 0 && completed === 0 ? "failed" : "completed";
    await finishRun(run.id, {
      status,
      jobsCompleted: completed,
      jobsBlocked: blocked,
      jobsSkipped: skipped,
    });

    return { runId: run.id, londonDate, status, jobs: dedupeJobs(jobs) };
  } catch (e) {
    const message = String((e as Error).message || e);
    await finishRun(run.id, { status: "failed", error: message });
    await recordAlert({
      severity: "critical",
      code: "run_failed",
      message,
      runId: run.id,
    });
    throw e;
  }
}

async function getUpdated(id: string): Promise<AutomationJob> {
  const { getJob } = await import("../store");
  return (await getJob(id))!;
}

function dedupeJobs(jobs: AutomationJob[]): AutomationJob[] {
  const map = new Map<string, AutomationJob>();
  for (const j of jobs) map.set(j.id, j);
  return [...map.values()];
}

/** Demo helpers used by tests / staging rehearsal. */
export async function runDemoNewArticle(): Promise<AutomationJob> {
  const run = await startRun(londonCalendarDate());
  const snapshot = await fetchGovukContent(
    "https://www.gov.uk/guidance/national-insurance-for-self-employed",
  );
  const job = await createJob({
    runId: run.id,
    kind: "manual_demo",
    sourceUrls: [snapshot.url],
    sourceSnapshots: [snapshot],
    metadata: {
      topicTitle: "National Insurance for the self-employed: what to check this tax year",
      changeSummary:
        "Readers need a practical TaxSimba explanation of self-employed National Insurance using current GOV.UK guidance.",
      forceNew: true,
      mapping: undefined,
    },
  });
  // Force create path
  await updateJob(job.id, {
    metadata: {
      ...job.metadata,
      forceNew: true,
      topicTitle: "National Insurance for the self-employed: what to check this tax year",
      changeSummary:
        "Readers need a practical TaxSimba explanation of self-employed National Insurance using current GOV.UK guidance.",
    },
  });
  return (await advanceUntilDone(job.id))!;
}

export async function runDemoUpdateExisting(): Promise<AutomationJob> {
  const run = await startRun(londonCalendarDate());
  const url =
    "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax";
  const snapshot = await fetchGovukContent(url);
  // Mutate hash to simulate substantive change.
  snapshot.hash = `${snapshot.hash}-demo-change`;
  snapshot.publicUpdatedAt = new Date().toISOString();
  const map = loadSourceMap();
  const existing = map.articles.find((a) => a.sources.some((s) => s.url === url));
  const job = await createJob({
    runId: run.id,
    kind: "manual_demo",
    sourceUrls: [url],
    sourceSnapshots: [snapshot],
    mappedSlug: existing?.slug || "hmrc-signed-me-up-for-making-tax-digital",
    metadata: {
      changeSummary:
        "GOV.UK eligibility wording changed; refreshing the existing TaxSimba guide while preserving its URL and first-publication date.",
      mapping: {
        action: "update",
        slug: existing?.slug || "hmrc-signed-me-up-for-making-tax-digital",
        reason: "demo update",
        firstPublishedAt: existing?.publishedAt,
        existingTitle: existing?.title,
      },
    },
  });
  await updateJob(job.id, { stage: "mapped", mappedSlug: job.mappedSlug });
  return (await advanceUntilDone(job.id))!;
}

async function advanceUntilDone(jobId: string): Promise<AutomationJob | null> {
  let job = await advanceJob(jobId);
  // Pipeline advances through multiple stages in one call; return final.
  return job;
}
