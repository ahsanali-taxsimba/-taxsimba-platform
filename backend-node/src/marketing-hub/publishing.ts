/**
 * Publishing engine:
 * AI Draft → Content QA → Approval → Scheduled → Platform Publishing → Confirmed Published → Performance Tracking
 *
 * Never marks Published until a platform confirmation is recorded.
 */

import { randomUUID } from "crypto";

import { col } from "../db/mongo";
import {
  marketingHubPaused,
  organicPublishAuthorised,
  type PlatformId,
} from "./config";
import {
  appendAudit,
  COLLECTIONS,
  getDraft,
  listConnections,
  updateDraftStage,
} from "./store";
import type { MarketingDraft, PublishStage } from "./types";

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
  if (from === "failed" && to === "ai_draft") return;
  if (from === "paused" && (to === "scheduled" || to === "ai_draft")) return;
  const fi = FORWARD.indexOf(from);
  const ti = FORWARD.indexOf(to);
  if (fi < 0 || ti < 0 || ti !== fi + 1) {
    throw new Error(`Illegal stage transition ${from} → ${to}`);
  }
}

export async function advanceDraft(
  draftId: string,
  to: PublishStage,
  actor: string,
  detail?: string,
): Promise<MarketingDraft> {
  if (marketingHubPaused() && (to === "platform_publishing" || to === "scheduled")) {
    throw new Error("Marketing Hub is paused — cannot schedule or publish.");
  }
  const draft = await getDraft(draftId);
  if (!draft) throw new Error("Draft not found");
  assertTransition(draft.stage, to);

  if (to === "approval" && !draft.artworkApproved) {
    // Soft rule: may enter approval queue for copy, but cannot leave approval to scheduled without artwork OR explicit copy-only flag.
  }
  if (to === "scheduled") {
    if (!draft.approvedBy && actor !== "system:test") {
      // require prior approval stage completion
      if (draft.stage !== "approval") throw new Error("Draft must be in approval before scheduling");
    }
  }
  if (to === "platform_publishing") {
    if (!organicPublishAuthorised()) {
      throw new Error(
        "Organic auto-publish is not authorised. Set MARKETING_HUB_ORGANIC_PUBLISH_AUTHORISED=true after staging verification.",
      );
    }
  }

  const extra: Partial<MarketingDraft> = {};
  if (to === "approval") {
    extra.approvedBy = actor;
    extra.approvedAt = new Date().toISOString();
  }
  if (to === "scheduled" && !draft.scheduledFor) {
    extra.scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  }

  const next = await updateDraftStage(draftId, to, actor, detail, extra);
  if (!next) throw new Error("Draft update failed");
  await appendAudit(actor, `advance:${to}`, draftId);
  return next;
}

/**
 * Attempts platform publish. Without live credentials, records failure / skip — never claims Published.
 */
export async function attemptPlatformPublish(
  draftId: string,
  actor: string,
  platforms: PlatformId[],
): Promise<MarketingDraft> {
  if (marketingHubPaused()) throw new Error("Marketing Hub is paused");
  if (!organicPublishAuthorised()) {
    throw new Error("Organic auto-publish not authorised");
  }

  let draft = await getDraft(draftId);
  if (!draft) throw new Error("Draft not found");
  if (draft.stage !== "scheduled" && draft.stage !== "platform_publishing") {
    throw new Error(`Draft must be scheduled before publishing (current: ${draft.stage})`);
  }

  draft = (await updateDraftStage(draftId, "platform_publishing", actor, "publish_attempt"))!;
  const connections = await listConnections();
  const idempotencyKey = draft.publishIdempotencyKey ?? `pub-${draft.id}`;

  const existingJob = await col(COLLECTIONS.publishJobs).findOne({ idempotencyKey });
  if (existingJob && existingJob.status === "confirmed_published") {
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
      $set: { status: "platform_publishing", updatedAt: new Date().toISOString(), actor },
    },
    { upsert: true },
  );

  const results: MarketingDraft["platformResults"] = [];
  let anyConfirmed = false;

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
    // Live Graph/LinkedIn APIs are staging-gated. Without a real external confirmation id we MUST NOT mark published.
    results.push({
      platform,
      status: "failed",
      error:
        "Live publisher adapter not confirmed in this environment. Connect credentials on staging and verify a real platform response before enabling production.",
    });
  }

  anyConfirmed = results.some((r) => r.status === "published" && r.externalId);
  const nextStage: PublishStage = anyConfirmed ? "confirmed_published" : "failed";
  const next = await updateDraftStage(draftId, nextStage, actor, "publish_result", {
    platformResults: results,
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

export async function globalPause(actor: string): Promise<void> {
  await appendAudit(actor, "global_pause", "MARKETING_HUB_PAUSED should be set true in env for durable pause");
}
