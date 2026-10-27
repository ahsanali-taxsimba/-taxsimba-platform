import { randomUUID } from "crypto";

import { col, Doc } from "../db/mongo";
import { PLATFORM_IDS, type PlatformId } from "./config";
import { buildTemplateLibrary } from "./templates";
import type { MarketingDraft, PlatformConnection, PublishStage } from "./types";

export const COLLECTIONS = {
  drafts: "marketing_drafts",
  connections: "marketing_connections",
  publishJobs: "marketing_publish_jobs",
  audit: "marketing_audit",
  settings: "marketing_settings",
  templatesMeta: "marketing_templates_meta",
} as const;

export async function ensureMarketingIndexes(): Promise<void> {
  await col(COLLECTIONS.drafts).createIndex({ stage: 1, createdAt: -1 });
  await col(COLLECTIONS.drafts).createIndex({ publishIdempotencyKey: 1 }, { unique: true, sparse: true });
  await col(COLLECTIONS.publishJobs).createIndex({ draftId: 1, createdAt: -1 });
  await col(COLLECTIONS.publishJobs).createIndex({ idempotencyKey: 1 }, { unique: true });
  await col(COLLECTIONS.connections).createIndex({ platform: 1 }, { unique: true });
  await col(COLLECTIONS.audit).createIndex({ at: -1 });
  await col(COLLECTIONS.settings).createIndex({ key: 1 }, { unique: true });
}

export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const row = (await col(COLLECTIONS.settings).findOne({ key })) as Doc | null;
  return row ? ((row.value as T) ?? null) : null;
}

export async function setSetting(key: string, value: unknown, actor: string): Promise<void> {
  await col(COLLECTIONS.settings).updateOne(
    { key },
    { $set: { key, value, updatedAt: new Date().toISOString(), updatedBy: actor } },
    { upsert: true },
  );
}

/** Env pause OR durable Mongo emergency pause. */
export async function isMarketingPaused(): Promise<boolean> {
  const { marketingHubPausedEnv } = await import("./config");
  if (marketingHubPausedEnv()) return true;
  const durable = await getSetting<boolean>("emergency_pause");
  return durable === true;
}

export async function appendAudit(actor: string, action: string, detail?: string): Promise<void> {
  await col(COLLECTIONS.audit).insertOne({
    id: randomUUID(),
    at: new Date().toISOString(),
    actor,
    action,
    detail: detail ?? null,
  });
}

export function defaultConnections(): PlatformConnection[] {
  return PLATFORM_IDS.map((platform) => {
    if (platform === "tiktok_manual") {
      return {
        platform,
        status: "manual_only",
        displayName: "TikTok (manual posting packs)",
        hasCredentials: false,
      };
    }
    return {
      platform,
      status: "not_connected",
      hasCredentials: false,
    };
  });
}

export async function listConnections(): Promise<PlatformConnection[]> {
  const rows = (await col(COLLECTIONS.connections).find({}).toArray()) as Doc[];
  if (!rows.length) return defaultConnections();
  const byPlatform = new Map(rows.map((r) => [r.platform as PlatformId, r]));
  return defaultConnections().map((d) => {
    const row = byPlatform.get(d.platform);
    if (!row) return d;
    return {
      platform: d.platform,
      status: (row.status as PlatformConnection["status"]) ?? d.status,
      displayName: (row.displayName as string) ?? d.displayName,
      lastSyncAt: row.lastSyncAt as string | undefined,
      lastError: row.lastError as string | undefined,
      scopes: row.scopes as string[] | undefined,
      hasCredentials: Boolean(row.hasCredentials),
    };
  });
}

export async function upsertConnection(
  platform: PlatformId,
  patch: Partial<PlatformConnection> & { credentialRef?: string },
): Promise<PlatformConnection> {
  const existing = (await col(COLLECTIONS.connections).findOne({ platform })) as Doc | null;
  const next = {
    platform,
    status: patch.status ?? existing?.status ?? "not_connected",
    displayName: patch.displayName ?? existing?.displayName ?? null,
    lastSyncAt: patch.lastSyncAt ?? existing?.lastSyncAt ?? null,
    lastError: patch.lastError ?? existing?.lastError ?? null,
    scopes: patch.scopes ?? existing?.scopes ?? [],
    hasCredentials:
      patch.hasCredentials ??
      (Boolean(patch.credentialRef) ||
        Boolean(existing?.hasCredentials) ||
        Boolean(existing?.credentialRef)),
    credentialRef: patch.credentialRef ?? existing?.credentialRef ?? null,
    updatedAt: new Date().toISOString(),
  };
  await col(COLLECTIONS.connections).updateOne({ platform }, { $set: next }, { upsert: true });
  const { credentialRef: _c, ...safe } = next;
  return {
    platform: safe.platform as PlatformId,
    status: safe.status as PlatformConnection["status"],
    displayName: safe.displayName ?? undefined,
    lastSyncAt: safe.lastSyncAt ?? undefined,
    lastError: safe.lastError ?? undefined,
    scopes: safe.scopes as string[],
    hasCredentials: Boolean(safe.hasCredentials),
  };
}

export async function insertDraft(draft: MarketingDraft): Promise<MarketingDraft> {
  await col(COLLECTIONS.drafts).insertOne({ ...draft });
  return draft;
}

export async function getDraft(id: string): Promise<MarketingDraft | null> {
  return (await col(COLLECTIONS.drafts).findOne({ id })) as MarketingDraft | null;
}

export async function updateDraftStage(
  id: string,
  stage: PublishStage,
  actor: string,
  detail?: string,
  extra: Partial<MarketingDraft> = {},
): Promise<MarketingDraft | null> {
  const draft = await getDraft(id);
  if (!draft) return null;
  const audit = [
    ...draft.audit,
    { at: new Date().toISOString(), actor, action: `stage:${stage}`, detail },
  ];
  const next = { ...draft, ...extra, stage, updatedAt: new Date().toISOString(), audit };
  await col(COLLECTIONS.drafts).updateOne({ id }, { $set: next });
  return next;
}

export async function listDrafts(limit = 50): Promise<MarketingDraft[]> {
  return (await col(COLLECTIONS.drafts)
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()) as unknown as MarketingDraft[];
}

export function getTemplateLibrary() {
  return buildTemplateLibrary();
}
