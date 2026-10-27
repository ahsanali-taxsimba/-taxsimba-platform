/** Marketing Content Library assets TS-001 … TS-120 — permanent originals, checksums, idempotent import. */

import { createHash, randomUUID } from "crypto";
import path from "path";

import { APP_NAME } from "../config/env";
import { col, Doc } from "../db/mongo";
import { storage } from "../services/storage";
import {
  ALLOWED_ASSET_MIME,
  MAX_ASSET_BYTES,
  MIN_LONG_EDGE,
  readImageDimensions,
} from "./imageDims";
import { appendAudit } from "./store";

export type AssetApproval = "unuploaded" | "pending_review" | "approved" | "rejected";

/** Publication workflow for library creatives (independent of artwork pixel lock). */
export type AssetPublicationStatus =
  | "draft_awaiting_qa"
  | "approved"
  | "scheduled"
  | "published";

export interface MarketingAsset {
  id: string; // TS-001 … TS-120
  slot: number;
  title: string | null;
  category: string | null;
  altText: string | null;
  originalFilename: string | null;
  storedPath: string | null;
  contentType: string | null;
  byteSize: number | null;
  width: number | null;
  height: number | null;
  sha256: string | null;
  approvalStatus: AssetApproval;
  publicationStatus: AssetPublicationStatus;
  approvedBy?: string;
  approvedAt?: string;
  version: number;
  uploadedAt?: string;
  notes?: string;
  batchId?: string | null;
  /** True only when artwork is library-approved AND publication allows use — never for placeholders */
  isFinishedArtwork: boolean;
  databaseId?: string;
}

const ASSET_COLLECTION = "marketing_assets";

export function assetIdForSlot(slot: number): string {
  if (slot < 1 || slot > 120) throw new Error("Asset slot must be 1–120");
  return `TS-${String(slot).padStart(3, "0")}`;
}

export function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function emptyAssetSlot(slot: number): MarketingAsset {
  return {
    id: assetIdForSlot(slot),
    slot,
    title: null,
    category: null,
    altText: null,
    originalFilename: null,
    storedPath: null,
    contentType: null,
    byteSize: null,
    width: null,
    height: null,
    sha256: null,
    approvalStatus: "unuploaded",
    publicationStatus: "draft_awaiting_qa",
    version: 0,
    isFinishedArtwork: false,
    batchId: null,
  };
}

export async function ensureAssetIndexes(): Promise<void> {
  await col(ASSET_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await col(ASSET_COLLECTION).createIndex({ slot: 1 }, { unique: true });
  await col(ASSET_COLLECTION).createIndex({ approvalStatus: 1 });
  await col(ASSET_COLLECTION).createIndex({ publicationStatus: 1 });
  await col(ASSET_COLLECTION).createIndex({ category: 1 });
  await col(ASSET_COLLECTION).createIndex({ sha256: 1 }, { sparse: true });
}

export async function listAssets(filter?: {
  q?: string;
  category?: string;
  publicationStatus?: string;
  uploadedOnly?: boolean;
}): Promise<MarketingAsset[]> {
  const rows = (await col(ASSET_COLLECTION).find({}).toArray()) as Doc[];
  const bySlot = new Map(rows.map((r) => [Number(r.slot), r]));
  let out: MarketingAsset[] = [];
  for (let slot = 1; slot <= 120; slot += 1) {
    const row = bySlot.get(slot);
    out.push(row ? docToAsset(row) : emptyAssetSlot(slot));
  }
  if (filter?.uploadedOnly) out = out.filter((a) => Boolean(a.storedPath));
  if (filter?.category) {
    const c = filter.category.toLowerCase();
    out = out.filter((a) => (a.category || "").toLowerCase() === c);
  }
  if (filter?.publicationStatus) {
    out = out.filter((a) => a.publicationStatus === filter.publicationStatus);
  }
  if (filter?.q) {
    const q = filter.q.toLowerCase();
    out = out.filter(
      (a) =>
        a.id.toLowerCase().includes(q) ||
        (a.title || "").toLowerCase().includes(q) ||
        (a.category || "").toLowerCase().includes(q) ||
        (a.originalFilename || "").toLowerCase().includes(q) ||
        (a.altText || "").toLowerCase().includes(q),
    );
  }
  return out;
}

function docToAsset(row: Doc): MarketingAsset {
  const approval = (row.approvalStatus as AssetApproval) || "unuploaded";
  const hasFile = Boolean(row.storedPath);
  const publicationStatus = (row.publicationStatus as AssetPublicationStatus) || "draft_awaiting_qa";
  return {
    id: String(row.id),
    slot: Number(row.slot),
    title: (row.title as string) ?? null,
    category: (row.category as string) ?? null,
    altText: (row.altText as string) ?? null,
    originalFilename: (row.originalFilename as string) ?? null,
    storedPath: (row.storedPath as string) ?? null,
    contentType: (row.contentType as string) ?? null,
    byteSize: (row.byteSize as number) ?? null,
    width: (row.width as number) ?? null,
    height: (row.height as number) ?? null,
    sha256: (row.sha256 as string) ?? null,
    approvalStatus: approval,
    publicationStatus,
    approvedBy: row.approvedBy as string | undefined,
    approvedAt: row.approvedAt as string | undefined,
    version: Number(row.version ?? 0),
    uploadedAt: row.uploadedAt as string | undefined,
    notes: row.notes as string | undefined,
    batchId: (row.batchId as string) ?? null,
    isFinishedArtwork: hasFile && approval === "approved",
    // Prefer stable library UUID (survives approved artwork replacement); fall back to Mongo _id.
    databaseId: row.databaseId ? String(row.databaseId) : row._id ? String(row._id) : String(row.id),
  };
}

export function validateAssetFile(file: {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}): { ok: true; width: number; height: number } | { ok: false; error: string } {
  if (!ALLOWED_ASSET_MIME.has(file.mimetype)) {
    return { ok: false, error: `Unsupported type ${file.mimetype}. Use PNG, JPEG, WebP or GIF.` };
  }
  if (file.size <= 0 || file.size > MAX_ASSET_BYTES) {
    return { ok: false, error: `File must be between 1 byte and ${MAX_ASSET_BYTES} bytes.` };
  }
  const dims = readImageDimensions(file.buffer);
  if (!dims.width || !dims.height) {
    return { ok: false, error: "Could not read image dimensions — file may be corrupt." };
  }
  const longEdge = Math.max(dims.width, dims.height);
  if (longEdge < MIN_LONG_EDGE) {
    return {
      ok: false,
      error: `High-resolution required: longest edge must be ≥ ${MIN_LONG_EDGE}px (got ${longEdge}px).`,
    };
  }
  return { ok: true, width: dims.width, height: dims.height };
}

/** Stable path for locked originals — one object per TS id (idempotent overwrite of same bytes only). */
export function originalStoragePath(id: string, originalFilename: string): string {
  const safe = path.basename(originalFilename).replace(/[^\w.\-]/g, "_") || `${id}.png`;
  return `${APP_NAME}/marketing-library/${id}/original/${safe}`;
}

export type ImportResult = {
  asset: MarketingAsset;
  action: "created" | "unchanged" | "replaced";
  sourceSha256: string;
  storedSha256: string;
  checksumMatch: boolean;
};

/**
 * Idempotent permanent import:
 * - same id + same sha256 → no duplicate, return existing
 * - same id + different sha256 → conflict unless allowApprovedReplacement
 * - new → store exact bytes, draft_awaiting_qa
 *
 * Approved replacement (allowApprovedReplacement=true):
 * - overwrites stored bytes + checksum/dimensions
 * - preserves id, databaseId, title, category, publicationStatus, batchId
 * - remains draft_awaiting_qa / not finished artwork
 */
export async function importOriginalAsset(opts: {
  id: string;
  file: { buffer: Buffer; mimetype: string; originalname: string; size: number };
  actor: string;
  title: string;
  category: string;
  altText?: string;
  batchId?: string;
  expectedSha256?: string;
  notes?: string;
  /** Explicit owner-approved artwork swap — never silent. Preserves library id/metadata. */
  allowApprovedReplacement?: boolean;
}): Promise<ImportResult> {
  const m = /^TS-(\d{3})$/.exec(opts.id);
  if (!m) throw new Error("Asset id must be TS-001 … TS-120");
  const slot = Number(m[1]);
  const check = validateAssetFile(opts.file);
  if (!check.ok) throw new Error(check.error);

  const sourceSha256 = sha256Buffer(opts.file.buffer);
  if (opts.expectedSha256 && opts.expectedSha256 !== sourceSha256) {
    throw new Error(
      `Source SHA-256 mismatch for ${opts.id}: expected ${opts.expectedSha256}, got ${sourceSha256}`,
    );
  }

  const existing = (await col(ASSET_COLLECTION).findOne({ id: opts.id })) as Doc | null;
  if (existing?.sha256 && existing.storedPath) {
    if (String(existing.sha256) === sourceSha256) {
      // Verify stored bytes still match
      const stored = await storage().get(String(existing.storedPath));
      const storedSha = sha256Buffer(stored.data);
      if (storedSha !== sourceSha256) {
        throw new Error(`Stored bytes drift for ${opts.id}: db sha ${existing.sha256} vs storage ${storedSha}`);
      }
      const asset = docToAsset(existing);
      await appendAudit(opts.actor, "asset_import_idempotent", opts.id);
      return {
        asset,
        action: "unchanged",
        sourceSha256,
        storedSha256: storedSha,
        checksumMatch: true,
      };
    }
    if (!opts.allowApprovedReplacement) {
      throw new Error(
        `Hash conflict for ${opts.id}: library has ${existing.sha256}, import offers ${sourceSha256}. Refusing overwrite of locked artwork.`,
      );
    }
  }

  const storedPath = originalStoragePath(opts.id, opts.file.originalname);
  // Exact original bytes — no recompression
  await storage().put(storedPath, opts.file.buffer, opts.file.mimetype);
  const verify = await storage().get(storedPath);
  const storedSha256 = sha256Buffer(verify.data);
  if (storedSha256 !== sourceSha256) {
    throw new Error(`Post-write checksum failed for ${opts.id}`);
  }

  const isReplacement = Boolean(existing?.sha256 && existing.storedPath && String(existing.sha256) !== sourceSha256);
  const version = Number(existing?.version ?? 0) + 1;
  const databaseId = existing?.databaseId ? String(existing.databaseId) : randomUUID();
  const next: Doc = {
    id: opts.id,
    slot,
    databaseId,
    title: isReplacement ? (existing!.title ?? opts.title) : opts.title,
    category: isReplacement ? (existing!.category ?? opts.category) : opts.category,
    altText:
      (isReplacement ? existing!.altText : null) ||
      opts.altText ||
      `${opts.title} — TaxSimba marketing creative`,
    originalFilename: opts.file.originalname,
    storedPath,
    contentType: opts.file.mimetype,
    byteSize: opts.file.size,
    width: check.width,
    height: check.height,
    sha256: sourceSha256,
    approvalStatus: "pending_review",
    publicationStatus: "draft_awaiting_qa",
    version,
    uploadedAt: isReplacement
      ? (existing!.uploadedAt ?? new Date().toISOString())
      : new Date().toISOString(),
    replacedAt: isReplacement ? new Date().toISOString() : undefined,
    notes:
      opts.notes ??
      (isReplacement
        ? "Approved artwork replacement — Draft / Awaiting Final QA. Auto-publish disabled."
        : "Batch import — Draft / Awaiting Final QA. Auto-publish disabled."),
    batchId: isReplacement ? (existing!.batchId ?? opts.batchId ?? null) : (opts.batchId ?? null),
    updatedAt: new Date().toISOString(),
    isFinishedArtwork: false,
    visualStatus: "LOCKED",
  };
  await col(ASSET_COLLECTION).updateOne({ id: opts.id }, { $set: next }, { upsert: true });
  await appendAudit(
    opts.actor,
    isReplacement ? "asset_approved_replacement" : "asset_import",
    `${opts.id} sha=${sourceSha256}`,
  );
  return {
    asset: docToAsset(next),
    action: isReplacement ? "replaced" : "created",
    sourceSha256,
    storedSha256,
    checksumMatch: true,
  };
}

export async function uploadAsset(opts: {
  slot: number;
  file: { buffer: Buffer; mimetype: string; originalname: string; size: number };
  actor: string;
  notes?: string;
  title?: string;
  category?: string;
}): Promise<MarketingAsset> {
  const id = assetIdForSlot(opts.slot);
  const result = await importOriginalAsset({
    id,
    file: opts.file,
    actor: opts.actor,
    title: opts.title || id,
    category: opts.category || "Uncategorised",
    notes: opts.notes,
  });
  return result.asset;
}

export async function approveAsset(id: string, actor: string, approve: boolean): Promise<MarketingAsset> {
  const row = (await col(ASSET_COLLECTION).findOne({ id })) as Doc | null;
  if (!row || !row.storedPath) throw new Error("Cannot approve — no uploaded file for this slot.");
  const approvalStatus: AssetApproval = approve ? "approved" : "rejected";
  const patch: Doc = {
    approvalStatus,
    approvedBy: actor,
    approvedAt: new Date().toISOString(),
    isFinishedArtwork: approve,
    updatedAt: new Date().toISOString(),
    // Artwork library approval ≠ public publish
    publicationStatus: approve ? row.publicationStatus || "draft_awaiting_qa" : "draft_awaiting_qa",
  };
  await col(ASSET_COLLECTION).updateOne({ id }, { $set: patch });
  await appendAudit(actor, approve ? "asset_approved" : "asset_rejected", id);
  return docToAsset({ ...row, ...patch });
}

export async function setPublicationStatus(
  id: string,
  status: AssetPublicationStatus,
  actor: string,
): Promise<MarketingAsset> {
  const row = (await col(ASSET_COLLECTION).findOne({ id })) as Doc | null;
  if (!row || !row.storedPath) throw new Error("Asset not found or not uploaded");
  if (status === "published") {
    throw new Error(
      "Automatic publishing is disabled. Publication status cannot be set to published until Toxel authorises live publishing.",
    );
  }
  const patch = { publicationStatus: status, updatedAt: new Date().toISOString() };
  await col(ASSET_COLLECTION).updateOne({ id }, { $set: patch });
  await appendAudit(actor, `asset_publication:${status}`, id);
  return docToAsset({ ...row, ...patch });
}

export async function getAsset(id: string): Promise<MarketingAsset | null> {
  const m = /^TS-(\d{3})$/.exec(id);
  if (!m) return null;
  const slot = Number(m[1]);
  if (slot < 1 || slot > 120) return null;
  const row = (await col(ASSET_COLLECTION).findOne({ id })) as Doc | null;
  return row ? docToAsset(row) : emptyAssetSlot(slot);
}

export async function readAssetBinary(
  id: string,
): Promise<{ data: Buffer; contentType: string; filename: string; sha256: string } | null> {
  const row = (await col(ASSET_COLLECTION).findOne({ id })) as Doc | null;
  if (!row?.storedPath) return null;
  const obj = await storage().get(String(row.storedPath));
  const sha = sha256Buffer(obj.data);
  return {
    data: obj.data,
    contentType: obj.contentType || String(row.contentType || "application/octet-stream"),
    filename: String(row.originalFilename || `${id}.bin`),
    sha256: sha,
  };
}

export async function verifyStoredChecksum(id: string): Promise<{
  ok: boolean;
  sourceSha256: string | null;
  storedSha256: string | null;
}> {
  const row = (await col(ASSET_COLLECTION).findOne({ id })) as Doc | null;
  if (!row?.storedPath || !row.sha256) return { ok: false, sourceSha256: null, storedSha256: null };
  const obj = await storage().get(String(row.storedPath));
  const storedSha256 = sha256Buffer(obj.data);
  return {
    ok: storedSha256 === String(row.sha256),
    sourceSha256: String(row.sha256),
    storedSha256,
  };
}

export async function bulkImportAssets(
  items: Array<{ slot: number; file: { buffer: Buffer; mimetype: string; originalname: string; size: number } }>,
  actor: string,
): Promise<{ ok: MarketingAsset[]; failed: Array<{ slot: number; error: string }> }> {
  const ok: MarketingAsset[] = [];
  const failed: Array<{ slot: number; error: string }> = [];
  for (const item of items) {
    try {
      ok.push(await uploadAsset({ slot: item.slot, file: item.file, actor }));
    } catch (e) {
      failed.push({ slot: item.slot, error: e instanceof Error ? e.message : String(e) });
    }
  }
  await appendAudit(actor, "asset_bulk_import", `ok=${ok.length} failed=${failed.length}`);
  return { ok, failed };
}

export async function assetSummary(): Promise<{
  totalSlots: 120;
  uploaded: number;
  pendingReview: number;
  approved: number;
  unuploaded: number;
  draftAwaitingQa: number;
  note: string;
}> {
  const assets = await listAssets();
  return {
    totalSlots: 120,
    uploaded: assets.filter((a) => a.storedPath).length,
    pendingReview: assets.filter((a) => a.approvalStatus === "pending_review").length,
    approved: assets.filter((a) => a.approvalStatus === "approved").length,
    unuploaded: assets.filter((a) => a.approvalStatus === "unuploaded").length,
    draftAwaitingQa: assets.filter((a) => a.publicationStatus === "draft_awaiting_qa" && a.storedPath).length,
    note: "Imported Batch 01 assets remain Draft / Awaiting Final QA. Placeholders are never finished artwork.",
  };
}

export { ASSET_COLLECTION };
