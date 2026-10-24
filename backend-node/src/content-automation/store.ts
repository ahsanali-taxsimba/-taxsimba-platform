import { createHash, randomUUID } from "crypto";
import { readFileSync } from "fs";
import path from "path";

import { col, Doc } from "../db/mongo";
import {
  ArticleDraft,
  ArticleRevision,
  AutomationAlert,
  AutomationJob,
  AutomationRun,
  LiveArticleOverlay,
  PipelineStage,
  SourceSnapshot,
} from "./types";

const JOBS = "content_automation_jobs";
const RUNS = "content_automation_runs";
const REVISIONS = "content_article_revisions";
const LIVE = "content_article_live";
const SOURCE_STATE = "content_source_state";
const ALERTS = "content_automation_alerts";
const BUDGET = "content_automation_budget";

export type SourceMapFixture = {
  generatedAt: string;
  articleCount: number;
  first20: string[];
  govukSourceCount: number;
  govukSources: string[];
  articles: Array<{
    slug: string;
    title: string;
    category: string;
    audience?: string;
    status: string;
    publishedAt?: string | null;
    releaseRank?: number;
    priorityRank?: number | null;
    curated?: boolean;
    sources: { label: string; url: string }[];
    relatedSlugs?: string[];
    ctaType?: string;
  }>;
};

let cachedSourceMap: SourceMapFixture | null = null;

export function loadSourceMap(): SourceMapFixture {
  if (cachedSourceMap) return cachedSourceMap;
  const file = path.join(__dirname, "fixtures", "source-map.json");
  cachedSourceMap = JSON.parse(readFileSync(file, "utf8")) as SourceMapFixture;
  return cachedSourceMap;
}

export function contentHash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function ensureContentAutomationIndexes(): Promise<void> {
  await col(JOBS).createIndex({ id: 1 }, { unique: true });
  await col(JOBS).createIndex({ runId: 1, stage: 1 });
  await col(JOBS).createIndex(
    { kind: 1, "sourceUrls.0": 1, mappedSlug: 1 },
    { name: "dedupe_lookup" },
  );
  await col(JOBS).createIndex({ claimToken: 1 }, { sparse: true });
  await col(RUNS).createIndex({ id: 1 }, { unique: true });
  await col(RUNS).createIndex({ londonDate: 1 });
  await col(REVISIONS).createIndex({ id: 1 }, { unique: true });
  await col(REVISIONS).createIndex({ slug: 1, revision: -1 }, { unique: true });
  await col(LIVE).createIndex({ slug: 1 }, { unique: true });
  await col(SOURCE_STATE).createIndex({ url: 1 }, { unique: true });
  await col(ALERTS).createIndex({ id: 1 }, { unique: true });
  await col(ALERTS).createIndex({ createdAt: -1 });
  await col(BUDGET).createIndex({ londonDate: 1 }, { unique: true });
}

export async function startRun(londonDate: string): Promise<AutomationRun> {
  const run: AutomationRun = {
    id: randomUUID(),
    startedAt: new Date().toISOString(),
    status: "running",
    jobsCreated: 0,
    jobsCompleted: 0,
    jobsBlocked: 0,
    jobsSkipped: 0,
    londonDate,
  };
  await col(RUNS).insertOne({ ...run } as Doc);
  return run;
}

export async function finishRun(
  runId: string,
  patch: Partial<AutomationRun>,
): Promise<void> {
  await col(RUNS).updateOne(
    { id: runId },
    { $set: { ...patch, finishedAt: new Date().toISOString() } },
  );
}

export async function getRunForLondonDate(londonDate: string): Promise<AutomationRun | null> {
  return (await col(RUNS).findOne({ londonDate, status: { $in: ["running", "completed", "partial"] } })) as
    | AutomationRun
    | null;
}

export async function createJob(
  partial: Omit<AutomationJob, "id" | "createdAt" | "updatedAt" | "attempts" | "maxAttempts" | "stage"> & {
    stage?: PipelineStage;
    maxAttempts?: number;
  },
): Promise<AutomationJob> {
  // Duplicate prevention: same kind + primary source + mapped slug in open stages.
  const primary = partial.sourceUrls[0] || "";
  const existing = (await col(JOBS).findOne({
    kind: partial.kind,
    "sourceUrls.0": primary,
    mappedSlug: partial.mappedSlug ?? null,
    stage: {
      $in: [
        "detected",
        "researched",
        "mapped",
        "drafted",
        "validated",
        "published",
      ],
    },
  })) as AutomationJob | null;
  if (existing) {
    return { ...existing, duplicateOfJobId: existing.id };
  }

  const job: AutomationJob = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attempts: 0,
    maxAttempts: partial.maxAttempts ?? 3,
    stage: partial.stage || "detected",
    kind: partial.kind,
    runId: partial.runId,
    sourceUrls: partial.sourceUrls,
    sourceSnapshots: partial.sourceSnapshots || [],
    mappedSlug: partial.mappedSlug ?? null,
    draft: partial.draft ?? null,
    metadata: partial.metadata || {},
  };
  await col(JOBS).insertOne({ ...job } as Doc);
  await col(RUNS).updateOne({ id: partial.runId }, { $inc: { jobsCreated: 1 } });
  return job;
}

export async function updateJob(
  jobId: string,
  patch: Partial<AutomationJob>,
): Promise<AutomationJob | null> {
  const res = await col(JOBS).findOneAndUpdate(
    { id: jobId },
    { $set: { ...patch, updatedAt: new Date().toISOString() } },
    { returnDocument: "after" },
  );
  return (res as AutomationJob | null) || null;
}

export async function claimJob(jobId: string): Promise<AutomationJob | null> {
  const token = randomUUID();
  const res = await col(JOBS).findOneAndUpdate(
    {
      id: jobId,
      $or: [{ claimToken: null }, { claimToken: { $exists: false } }, { claimToken: "" }],
    },
    {
      $set: {
        claimToken: token,
        claimedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      $inc: { attempts: 1 },
    },
    { returnDocument: "after" },
  );
  return (res as AutomationJob | null) || null;
}

export async function releaseClaim(jobId: string): Promise<void> {
  await col(JOBS).updateOne(
    { id: jobId },
    { $set: { claimToken: null, claimedAt: null, updatedAt: new Date().toISOString() } },
  );
}

export async function listOpenJobs(runId?: string): Promise<AutomationJob[]> {
  const q: Record<string, unknown> = {
    stage: {
      $in: ["detected", "researched", "mapped", "drafted", "validated", "published"],
    },
  };
  if (runId) q.runId = runId;
  return (await col(JOBS).find(q).sort({ createdAt: 1 }).toArray()) as unknown as AutomationJob[];
}

export async function getJob(jobId: string): Promise<AutomationJob | null> {
  return (await col(JOBS).findOne({ id: jobId })) as AutomationJob | null;
}

export async function getSourceState(url: string): Promise<SourceSnapshot | null> {
  const row = (await col(SOURCE_STATE).findOne({ url })) as
    | (SourceSnapshot & { url: string })
    | null;
  return row;
}

export async function saveSourceState(snapshot: SourceSnapshot): Promise<void> {
  await col(SOURCE_STATE).updateOne(
    { url: snapshot.url },
    { $set: { ...snapshot } },
    { upsert: true },
  );
}

export async function nextRevisionNumber(slug: string): Promise<number> {
  const last = (await col(REVISIONS)
    .find({ slug })
    .sort({ revision: -1 })
    .limit(1)
    .toArray()) as unknown as ArticleRevision[];
  return (last[0]?.revision || 0) + 1;
}

export async function saveRevision(
  job: AutomationJob,
  draft: ArticleDraft,
  status: ArticleRevision["status"] = "draft",
): Promise<ArticleRevision> {
  const revision = await nextRevisionNumber(draft.slug);
  const row: ArticleRevision = {
    id: randomUUID(),
    slug: draft.slug,
    revision,
    status,
    article: draft,
    jobId: job.id,
    createdAt: new Date().toISOString(),
    publishedAt: status === "published" ? new Date().toISOString() : null,
    contentHash: contentHash(JSON.stringify(draft)),
  };
  await col(REVISIONS).insertOne({ ...row } as Doc);
  return row;
}

/**
 * Atomic publication: mark previous live revision superseded, write new live overlay.
 * Returns previous revision id for rollback.
 */
export async function publishLive(
  job: AutomationJob,
  draft: ArticleDraft,
): Promise<{ revision: ArticleRevision; previousRevisionId: string | null }> {
  const previous = (await col(LIVE).findOne({ slug: draft.slug })) as LiveArticleOverlay | null;
  const revision = await saveRevision(job, draft, "published");
  if (previous?.revisionId) {
    await col(REVISIONS).updateOne(
      { id: previous.revisionId },
      { $set: { status: "superseded" } },
    );
  }
  const firstPublishedAt =
    previous?.firstPublishedAt ||
    draft.publishedAt ||
    revision.publishedAt ||
    new Date().toISOString();
  const live: LiveArticleOverlay = {
    slug: draft.slug,
    revisionId: revision.id,
    article: { ...draft, publishedAt: firstPublishedAt },
    publishedAt: revision.publishedAt || new Date().toISOString(),
    firstPublishedAt,
    updatedAt: new Date().toISOString(),
    jobId: job.id,
    curated: Boolean(draft.curatedBaseSlug || draft.isUpdate),
  };
  await col(LIVE).updateOne({ slug: draft.slug }, { $set: { ...live } }, { upsert: true });
  return { revision, previousRevisionId: previous?.revisionId || null };
}

export async function rollbackLive(
  slug: string,
  previousRevisionId: string | null,
  jobId: string,
): Promise<boolean> {
  const current = (await col(LIVE).findOne({ slug })) as LiveArticleOverlay | null;
  if (!current) return false;
  await col(REVISIONS).updateOne(
    { id: current.revisionId },
    { $set: { status: "rolled_back", rolledBackAt: new Date().toISOString() } },
  );
  if (!previousRevisionId) {
    await col(LIVE).deleteOne({ slug });
    await updateJob(jobId, { stage: "rolled_back" });
    return true;
  }
  const prev = (await col(REVISIONS).findOne({ id: previousRevisionId })) as ArticleRevision | null;
  if (!prev) {
    await col(LIVE).deleteOne({ slug });
    await updateJob(jobId, { stage: "rolled_back" });
    return true;
  }
  await col(REVISIONS).updateOne({ id: prev.id }, { $set: { status: "published" } });
  const live: LiveArticleOverlay = {
    slug,
    revisionId: prev.id,
    article: prev.article,
    publishedAt: prev.publishedAt || prev.createdAt,
    firstPublishedAt: prev.article.publishedAt || prev.createdAt,
    updatedAt: new Date().toISOString(),
    jobId,
    curated: Boolean(prev.article.isUpdate),
  };
  await col(LIVE).updateOne({ slug }, { $set: { ...live } }, { upsert: true });
  await updateJob(jobId, { stage: "rolled_back", publishedRevisionId: prev.id });
  return true;
}

export async function getLiveOverlay(slug: string): Promise<LiveArticleOverlay | null> {
  return (await col(LIVE).findOne({ slug })) as LiveArticleOverlay | null;
}

export async function listLiveOverlays(): Promise<LiveArticleOverlay[]> {
  return (await col(LIVE).find({}).sort({ publishedAt: -1 }).toArray()) as unknown as LiveArticleOverlay[];
}

export async function recordAlert(
  alert: Omit<AutomationAlert, "id" | "createdAt">,
): Promise<AutomationAlert> {
  const row: AutomationAlert = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...alert,
  };
  await col(ALERTS).insertOne({ ...row } as Doc);
  return row;
}

export async function listAlerts(limit = 50): Promise<AutomationAlert[]> {
  return (await col(ALERTS).find({}).sort({ createdAt: -1 }).limit(limit).toArray()) as unknown as AutomationAlert[];
}

export async function consumeApiBudget(
  londonDate: string,
  units: number,
  limit: number,
): Promise<boolean> {
  const row = (await col(BUDGET).findOne({ londonDate })) as
    | { londonDate: string; used: number }
    | null;
  const used = row?.used || 0;
  if (used + units > limit) return false;
  await col(BUDGET).updateOne(
    { londonDate },
    { $setOnInsert: { londonDate }, $inc: { used: units } },
    { upsert: true },
  );
  return true;
}

export async function exportBackup(): Promise<{
  exportedAt: string;
  jobs: AutomationJob[];
  live: LiveArticleOverlay[];
  revisions: ArticleRevision[];
  sources: SourceSnapshot[];
  runs: AutomationRun[];
}> {
  return {
    exportedAt: new Date().toISOString(),
    jobs: (await col(JOBS).find({}).toArray()) as unknown as AutomationJob[],
    live: (await col(LIVE).find({}).toArray()) as unknown as LiveArticleOverlay[],
    revisions: (await col(REVISIONS).find({}).toArray()) as unknown as ArticleRevision[],
    sources: (await col(SOURCE_STATE).find({}).toArray()) as unknown as SourceSnapshot[],
    runs: (await col(RUNS).find({}).toArray()) as unknown as AutomationRun[],
  };
}

export async function restoreBackup(payload: {
  jobs?: AutomationJob[];
  live?: LiveArticleOverlay[];
  revisions?: ArticleRevision[];
  sources?: SourceSnapshot[];
  runs?: AutomationRun[];
}): Promise<void> {
  if (payload.jobs) {
    for (const j of payload.jobs) {
      await col(JOBS).updateOne({ id: j.id }, { $set: { ...j } }, { upsert: true });
    }
  }
  if (payload.live) {
    for (const l of payload.live) {
      await col(LIVE).updateOne({ slug: l.slug }, { $set: { ...l } }, { upsert: true });
    }
  }
  if (payload.revisions) {
    for (const r of payload.revisions) {
      await col(REVISIONS).updateOne({ id: r.id }, { $set: { ...r } }, { upsert: true });
    }
  }
  if (payload.sources) {
    for (const s of payload.sources) {
      await col(SOURCE_STATE).updateOne({ url: s.url }, { $set: { ...s } }, { upsert: true });
    }
  }
  if (payload.runs) {
    for (const r of payload.runs) {
      await col(RUNS).updateOne({ id: r.id }, { $set: { ...r } }, { upsert: true });
    }
  }
}
