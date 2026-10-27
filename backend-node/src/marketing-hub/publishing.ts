/**
 * Publishing workflow:
 * Draft → Review → Approved → Scheduled → Published | Failed
 *
 * Live publishing remains disabled unless ORGANIC_PUBLISH_AUTHORISED and real platform confirmation.
 */

import { randomUUID } from "crypto";

import { col } from "../db/mongo";
import { organicPublishAuthorised, type PlatformId } from "./config";
import { assertPublishableCopy, scanDraftClaims } from "./claims";
import {
  appendAudit,
  COLLECTIONS,
  getDraft,
  isMarketingPaused,
  listConnections,
  setSetting,
  updateDraftStage,
} from "./store";
import type { MarketingDraft, PublishStage } from "./types";
import { WORKFLOW_LABELS } from "./types";

const FORWARD: PublishStage[] = [
  "ai_draft",
  "content_qa",
  "approval",
  "scheduled",
  "platform_publishing",
  "confirmed_published",
];

export function assertTransition(from: PublishStage, to: PublishStage): void {
  if (to === "failed" || to === "paused") return;
  if (from === "failed" && (to === "ai_draft" || to === "scheduled")) return;
  if (from === "paused" && (to === "scheduled" || to === "ai_draft" || to === "content_qa")) return;
  const fi = FORWARD.indexOf(from);
  const ti = FORWARD.indexOf(to);
  if (fi < 0 || ti < 0 || ti !== fi + 1) {
    throw new Error(`Illegal stage transition ${from} → ${to}`);
  }
}

export function workflowLabel(stage: PublishStage): string {
  return WORKFLOW_LABELS[stage] || stage;
}

export async function advanceDraft(
  draftId: string,
  to: PublishStage,
  actor: string,
  detail?: string,
): Promise<MarketingDraft> {
  if (await isMarketingPaused()) {
    if (to === "platform_publishing" || to === "scheduled" || to === "confirmed_published") {
      throw new Error("Marketing Hub is paused — cannot schedule or publish.");
    }
  }
  const draft = await getDraft(draftId);
  if (!draft) throw new Error("Draft not found");
  assertTransition(draft.stage, to);

  // Content QA / approval / schedule: block unsupported claims
  if (to === "content_qa" || to === "approval" || to === "scheduled") {
    const issues = scanDraftClaims(draft);
    if (issues.length && (to === "approval" || to === "scheduled")) {
      throw new Error(issues.map((i) => i.message).join(" "));
    }
  }
  if (to === "scheduled") {
    assertPublishableCopy(draft);
    if (draft.stage !== "approval") throw new Error("Draft must be Approved before scheduling");
  }
  // Live publish still gated — even advancing into platform_publishing requires auth flag
  if (to === "platform_publishing" || to === "confirmed_published") {
    if (!organicPublishAuthorised()) {
      throw new Error(
        "Live publishing is disabled. MARKETING_HUB_ORGANIC_PUBLISH_AUTHORISED must remain false until staging verifies real platform confirmations.",
      );
    }
  }

  const extra: Partial<MarketingDraft> = {
    workflowLabel: workflowLabel(to),
  };
  if (to === "approval") {
    extra.approvedBy = actor;
    extra.approvedAt = new Date().toISOString();
  }
  if (to === "scheduled" && !draft.scheduledFor) {
    extra.scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  }

  const next = await updateDraftStage(draftId, to, actor, detail, extra);
  if (!next) throw new Error("Draft update failed");
  await appendAudit(actor, `advance:${to}`, `${draftId} (${workflowLabel(to)})`);
  return next;
}

/**
 * Attempts platform publish. Live publishing stays disabled by default.
 * Never marks Published without an external confirmation id.
 */
export async function attemptPlatformPublish(
  draftId: string,
  actor: string,
  platforms: PlatformId[],
): Promise<MarketingDraft> {
  if (await isMarketingPaused()) throw new Error("Marketing Hub is paused");
  if (!organicPublishAuthorised()) {
    throw new Error("Live publishing is disabled (ORGANIC_PUBLISH_AUTHORISED=false).");
  }

  let draft = await getDraft(draftId);
  if (!draft) throw new Error("Draft not found");
  assertPublishableCopy(draft);
  if (draft.stage !== "scheduled" && draft.stage !== "platform_publishing" && draft.stage !== "failed") {
    throw new Error(`Draft must be Scheduled before publishing (current: ${workflowLabel(draft.stage)})`);
  }

  // From failed → retry back through platform_publishing
  if (draft.stage === "failed") {
    draft = (await updateDraftStage(
      draftId,
      "scheduled",
      actor,
      "retry_requeue",
      { retryCount: (draft.retryCount ?? 0) + 1, workflowLabel: "Scheduled" },
    ))!;
  }

  draft = (await updateDraftStage(draftId, "platform_publishing", actor, "publish_attempt", {
    workflowLabel: "Publishing",
  }))!;

  const connections = await listConnections();
  const idempotencyKey = draft.publishIdempotencyKey ?? `pub-${draft.id}`;

  const existingJob = await col(COLLECTIONS.publishJobs).findOne({ idempotencyKey });
  if (existingJob && existingJob.status === "confirmed_published") {
    // Duplicate prevention — already published
    return (await getDraft(draftId))!;
  }

  await col(COLLECTIONS.publishJobs).updateOne(
    { idempotencyKey },
    {
      $setOnInsert: {
        id: randomUUID(),
        draftId,
        idempotencyKey,
        createdAt: new Date().toISOString(),
      },
      $set: {
        status: "platform_publishing",
        updatedAt: new Date().toISOString(),
        actor,
        attempt: Number(existingJob?.attempt || 0) + 1,
      },
    },
    { upsert: true },
  );

  const results: MarketingDraft["platformResults"] = [];

  for (const platform of platforms) {
    if (platform === "tiktok_manual") {
      results.push({
        platform,
        status: "skipped",
        error: "TikTok is manual-only. Use the downloadable posting pack.",
      });
      continue;
    }
    if (platform === "google_ads") {
      results.push({
        platform,
        status: "skipped",
        error: "Google Ads campaigns, bids and budgets remain owner-controlled. No unauthorised spending.",
      });
      continue;
    }
    const conn = connections.find((c) => c.platform === platform);
    if (!conn || conn.status !== "connected" || !conn.hasCredentials) {
      results.push({
        platform,
        status: "failed",
        error: "Platform not connected or credentials missing.",
      });
      continue;
    }
    results.push({
      platform,
      status: "failed",
      error:
        "Live publisher adapter not confirmed. Staging must verify a real platform response before production.",
    });
  }

  const anyConfirmed = results.some((r) => r.status === "published" && r.externalId);
  const nextStage: PublishStage = anyConfirmed ? "confirmed_published" : "failed";
  const next = await updateDraftStage(draftId, nextStage, actor, "publish_result", {
    platformResults: results,
    workflowLabel: workflowLabel(nextStage),
  });

  await col(COLLECTIONS.publishJobs).updateOne(
    { idempotencyKey },
    {
      $set: {
        status: nextStage,
        results,
        updatedAt: new Date().toISOString(),
      },
    },
  );

  return next!;
}

export async function emergencyPause(actor: string, paused: boolean): Promise<{ paused: boolean }> {
  await setSetting("emergency_pause", paused, actor);
  await appendAudit(actor, paused ? "emergency_pause_on" : "emergency_pause_off", "durable");
  return { paused };
}

export async function listAudit(limit = 100): Promise<unknown[]> {
  return col(COLLECTIONS.audit).find({}).sort({ at: -1 }).limit(limit).toArray();
}
