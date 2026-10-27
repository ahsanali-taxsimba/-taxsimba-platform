/** Marketing assets TS-001 … TS-120 — uploads, validation, approval, bulk import. */

import { randomUUID } from "crypto";
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

export interface MarketingAsset {
  id: string; // TS-001 … TS-120
  slot: number;
  originalFilename: string | null;
  storedPath: string | null;
  contentType: string | null;
  byteSize: number | null;
  width: number | null;
  height: number | null;
  approvalStatus: AssetApproval;
  approvedBy?: string;
  approvedAt?: string;
  version: number;
  uploadedAt?: string;
  notes?: string;
  /** Never true for placeholders */
  isFinishedArtwork: boolean;
}

const ASSET_COLLECTION = "marketing_assets";

export function assetIdForSlot(slot: number): string {
  if (slot < 1 || slot > 120) throw new Error("Asset slot must be 1–120");
  return `TS-${String(slot).padStart(3, "0")}`;
}

export function emptyAssetSlot(slot: number): MarketingAsset {
  return {
    id: assetIdForSlot(slot),
    slot,
    originalFilename: null,
    storedPath: null,
    contentType: null,
    byteSize: null,
    width: null,
    height: null,
    approvalStatus: "unuploaded",
    version: 0,
    isFinishedArtwork: false,
  };
}

export async function ensureAssetIndexes(): Promise<void> {
  await col(ASSET_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await col(ASSET_COLLECTION).createIndex({ slot: 1 }, { unique: true });
  await col(ASSET_COLLECTION).createIndex({ approvalStatus: 1 });
}

export async function listAssets(): Promise<MarketingAsset[]> {
  const rows = (await col(ASSET_COLLECTION).find({}).toArray()) as Doc[];
  const bySlot = new Map(rows.map((r) => [Number(r.slot), r]));
  const out: MarketingAsset[] = [];
  for (let slot = 1; slot <= 120; slot += 1) {
    const row = bySlot.get(slot);
    out.push(row ? docToAsset(row) : emptyAssetSlot(slot));
  }
  return out;
}

function docToAsset(row: Doc): MarketingAsset {
  const approval = (row.approvalStatus as AssetApproval) || "unuploaded";
  const hasFile = Boolean(row.storedPath);
  return {
    id: String(row.id),
    slot: Number(row.slot),
    originalFilename: (row.originalFilename as string) ?? null,
    storedPath: (row.storedPath as string) ?? null,
    contentType: (row.contentType as string) ?? null,
    byteSize: (row.byteSize as number) ?? null,
    width: (row.width as number) ?? null,
    height: (row.height as number) ?? null,
    approvalStatus: approval,
    approvedBy: row.approvedBy as string | undefined,
    approvedAt: row.approvedAt as string | undefined,
    version: Number(row.version ?? 0),
    uploadedAt: row.uploadedAt as string | undefined,
    notes: row.notes as string | undefined,
    isFinishedArtwork: hasFile && approval === "approved",
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

export async function uploadAsset(opts: {
  slot: number;
  file: { buffer: Buffer; mimetype: string; originalname: string; size: number };
  actor: string;
  notes?: string;
}): Promise<MarketingAsset> {
  const id = assetIdForSlot(opts.slot);
  const check = validateAssetFile(opts.file);
  if (!check.ok) throw new Error(check.error);

  const ext = path.extname(opts.file.originalname).replace(/[^\w.]/g, "") || ".bin";
  const storedPath = `${APP_NAME}/marketing-assets/${id}/v${Date.now()}_${randomUUID()}${ext}`;
  // Preserve original filename in metadata; binary stored with stable path.
  await storage().put(storedPath, opts.file.buffer, opts.file.mimetype);

  const existing = (await col(ASSET_COLLECTION).findOne({ id })) as Doc | null;
  const version = Number(existing?.version ?? 0) + 1;
  const next: Doc = {
    id,
    slot: opts.slot,
    originalFilename: opts.file.originalname,
    storedPath,
    contentType: opts.file.mimetype,
    byteSize: opts.file.size,
    width: check.width,
    height: check.height,
    approvalStatus: "pending_review",
    version,
    uploadedAt: new Date().toISOString(),
    notes: opts.notes ?? null,
    updatedAt: new Date().toISOString(),
    // Explicitly not finished until approved
    isFinishedArtwork: false,
  };
  await col(ASSET_COLLECTION).updateOne({ id }, { $set: next }, { upsert: true });
  await appendAudit(opts.actor, "asset_upload", `${id} v${version} ${opts.file.originalname}`);
  return docToAsset(next);
}

export async function approveAsset(id: string, actor: string, approve: boolean): Promise<MarketingAsset> {
  const row = (await col(ASSET_COLLECTION).findOne({ id })) as Doc | null;
  if (!row || !row.storedPath) throw new Error("Cannot approve — no uploaded file for this slot.");
  const approvalStatus: AssetApproval = approve ? "approved" : "rejected";
  const patch = {
    approvalStatus,
    approvedBy: actor,
    approvedAt: new Date().toISOString(),
    isFinishedArtwork: approve,
    updatedAt: new Date().toISOString(),
  };
  await col(ASSET_COLLECTION).updateOne({ id }, { $set: patch });
  await appendAudit(actor, approve ? "asset_approved" : "asset_rejected", id);
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

export async function readAssetBinary(id: string): Promise<{ data: Buffer; contentType: string; filename: string } | null> {
  const row = (await col(ASSET_COLLECTION).findOne({ id })) as Doc | null;
  if (!row?.storedPath) return null;
  const obj = await storage().get(String(row.storedPath));
  return {
    data: obj.data,
    contentType: obj.contentType || String(row.contentType || "application/octet-stream"),
    filename: String(row.originalFilename || `${id}.bin`),
  };
}

/** Bulk import: array of { slot, file }. Partial success reported per slot. */
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
  note: string;
}> {
  const assets = await listAssets();
  return {
    totalSlots: 120,
    uploaded: assets.filter((a) => a.storedPath).length,
    pendingReview: assets.filter((a) => a.approvalStatus === "pending_review").length,
    approved: assets.filter((a) => a.approvalStatus === "approved").length,
    unuploaded: assets.filter((a) => a.approvalStatus === "unuploaded").length,
    note: "Placeholder template slots are never marked as finished artwork until an approved upload exists.",
  };
}

export { ASSET_COLLECTION };
