/**
 * Tax Knowledge Library — CRUD, notes, uploads + AV scan, search, bookmarks.
 * Clients have zero access; junior staff are notes-only when that role exists.
 */
import { randomUUID } from "crypto";

import { APP_NAME } from "../config/env";
import { clean, cleanMany, col, Doc, update } from "../db/mongo";
import {
  SUGGESTED_TAGS,
  TAX_KNOWLEDGE_CATEGORIES,
  TAX_KNOWLEDGE_COLLECTIONS,
  TaxKnowledgeCategory,
  canEditKnowledge,
  canViewKnowledge,
  nowIso,
} from "../domain/taxKnowledge";
import { httpError } from "../http/errors";
import { assertDownloadAllowed, scanAndRecord } from "./fileScan";
import { getObject, putObject } from "./storage";

function assertViewer(actor: Doc): void {
  if (!canViewKnowledge(actor.role) || actor.role === "CLIENT") {
    throw httpError(403, "Tax Knowledge Library is only available to authorised staff");
  }
}

function assertEditor(actor: Doc): void {
  assertViewer(actor);
  if (!canEditKnowledge(actor.role)) {
    throw httpError(403, "Your role can view and add notes only");
  }
}

function asCategory(raw: string | undefined | null): TaxKnowledgeCategory {
  if (!raw || !(TAX_KNOWLEDGE_CATEGORIES as readonly string[]).includes(raw)) {
    throw httpError(400, `category must be one of: ${TAX_KNOWLEDGE_CATEGORIES.join(", ")}`);
  }
  return raw as TaxKnowledgeCategory;
}

function normaliseTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tags) {
    const s = String(t ?? "")
      .trim()
      .slice(0, 80);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out.slice(0, 40);
}

function normaliseLinks(links: unknown): { label: string; url: string }[] {
  if (!Array.isArray(links)) return [];
  return links
    .map((l) => {
      const row = (l || {}) as Doc;
      const url = String(row.url || "").trim();
      const label = String(row.label || url).trim().slice(0, 120);
      return { label, url };
    })
    .filter((l) => /^https?:\/\//i.test(l.url))
    .slice(0, 30);
}

async function getItemOrThrow(id: string, includeArchived = false): Promise<Doc> {
  const row = (await col(TAX_KNOWLEDGE_COLLECTIONS.items).findOne({ id })) as Doc | null;
  if (!row) throw httpError(404, "Knowledge item not found");
  if (row.is_archived && !includeArchived) throw httpError(404, "Knowledge item not found");
  return row;
}

async function attachExtras(item: Doc, actorId?: string): Promise<Doc> {
  const files = cleanMany(
    await col(TAX_KNOWLEDGE_COLLECTIONS.files)
      .find({ knowledge_item_id: item.id, is_deleted: { $ne: true } })
      .sort({ created_at: -1 })
      .toArray(),
  );
  const notes = cleanMany(
    await col(TAX_KNOWLEDGE_COLLECTIONS.notes)
      .find({ knowledge_item_id: item.id })
      .sort({ created_at: -1 })
      .limit(100)
      .toArray(),
  );
  let bookmarked = false;
  if (actorId) {
    const bm = await col(TAX_KNOWLEDGE_COLLECTIONS.bookmarks).findOne({
      staff_id: actorId,
      knowledge_item_id: item.id,
    });
    bookmarked = Boolean(bm);
  }
  return {
    ...(clean(item) as Doc),
    files,
    notes,
    note_count: notes.length,
    bookmarked,
  };
}

export async function listKnowledgeItems(
  actor: Doc,
  filters: {
    category?: string;
    tag?: string;
    q?: string;
    include_archived?: boolean;
    recently?: boolean;
    bookmarked_only?: boolean;
    limit?: number;
  } = {},
): Promise<Doc[]> {
  assertViewer(actor);
  const q: Doc = {};
  if (!filters.include_archived) q.is_archived = { $ne: true };
  if (filters.category) q.category = asCategory(filters.category);
  if (filters.tag) q.tags = filters.tag;

  let bookmarkIds: string[] | null = null;
  if (filters.bookmarked_only) {
    const bms = await col(TAX_KNOWLEDGE_COLLECTIONS.bookmarks)
      .find({ staff_id: actor.id })
      .toArray();
    bookmarkIds = bms.map((b) => b.knowledge_item_id as string);
    if (!bookmarkIds.length) return [];
    q.id = { $in: bookmarkIds };
  }

  const search = (filters.q || "").trim();
  if (search) {
    const esc = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = { $regex: esc, $options: "i" };
    // Full-text across titles/descriptions/tags plus notes and file names.
    const noteHits = await col(TAX_KNOWLEDGE_COLLECTIONS.notes)
      .find({ note_text: rx })
      .project({ knowledge_item_id: 1 })
      .limit(200)
      .toArray();
    const fileHits = await col(TAX_KNOWLEDGE_COLLECTIONS.files)
      .find({ is_deleted: { $ne: true }, file_name: rx })
      .project({ knowledge_item_id: 1 })
      .limit(200)
      .toArray();
    const relatedIds = [
      ...new Set([
        ...noteHits.map((n) => n.knowledge_item_id as string),
        ...fileHits.map((f) => f.knowledge_item_id as string),
      ]),
    ];
    q.$or = [
      { title: rx },
      { description: rx },
      { tags: rx },
      ...(relatedIds.length ? [{ id: { $in: relatedIds } }] : []),
    ];
  }

  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 200);
  const sort: Doc = filters.recently ? { created_at: -1 } : { updated_at: -1 };
  const rows = await col(TAX_KNOWLEDGE_COLLECTIONS.items).find(q).sort(sort).limit(limit).toArray();

  const bmSet = new Set(
    (
      await col(TAX_KNOWLEDGE_COLLECTIONS.bookmarks)
        .find({ staff_id: actor.id, knowledge_item_id: { $in: rows.map((r) => r.id) } })
        .toArray()
    ).map((b) => b.knowledge_item_id as string),
  );

  const fileCounts = new Map<string, number>();
  const noteCounts = new Map<string, number>();
  if (rows.length) {
    const ids = rows.map((r) => r.id);
    const files = await col(TAX_KNOWLEDGE_COLLECTIONS.files)
      .aggregate([
        { $match: { knowledge_item_id: { $in: ids }, is_deleted: { $ne: true } } },
        { $group: { _id: "$knowledge_item_id", n: { $sum: 1 } } },
      ])
      .toArray();
    for (const f of files) fileCounts.set(f._id as string, f.n as number);
    const notes = await col(TAX_KNOWLEDGE_COLLECTIONS.notes)
      .aggregate([
        { $match: { knowledge_item_id: { $in: ids } } },
        { $group: { _id: "$knowledge_item_id", n: { $sum: 1 } } },
      ])
      .toArray();
    for (const n of notes) noteCounts.set(n._id as string, n.n as number);
  }

  return rows.map((r) => ({
    ...(clean(r) as Doc),
    bookmarked: bmSet.has(r.id as string),
    file_count: fileCounts.get(r.id as string) || 0,
    note_count: noteCounts.get(r.id as string) || 0,
  }));
}

export async function getKnowledgeItem(actor: Doc, id: string): Promise<Doc> {
  assertViewer(actor);
  const item = await getItemOrThrow(id, true);
  return attachExtras(item, actor.id);
}

export async function createKnowledgeItem(
  actor: Doc,
  input: {
    title: string;
    description?: string;
    category: string;
    tags?: string[];
    external_links?: { label?: string; url: string }[];
  },
): Promise<Doc> {
  assertEditor(actor);
  const now = nowIso();
  const id = randomUUID();
  const row: Doc = {
    id,
    title: String(input.title || "").trim().slice(0, 200),
    description: String(input.description || "").trim().slice(0, 10000),
    category: asCategory(input.category),
    tags: normaliseTags(input.tags),
    file_ids: [],
    external_links: normaliseLinks(input.external_links),
    created_by: actor.id,
    created_by_name: actor.name,
    created_at: now,
    updated_at: now,
    version_history: [
      {
        version: 1,
        edited_by: actor.id,
        edited_by_name: actor.name,
        edited_at: now,
        summary: "Created",
      },
    ],
    is_archived: false,
    ai_summary: null,
  };
  if (!row.title) throw httpError(400, "title is required");
  await col(TAX_KNOWLEDGE_COLLECTIONS.items).insertOne({ ...row });
  return attachExtras(row, actor.id);
}

export async function updateKnowledgeItem(
  actor: Doc,
  id: string,
  patch: {
    title?: string;
    description?: string;
    category?: string;
    tags?: string[];
    external_links?: { label?: string; url: string }[];
    is_archived?: boolean;
    ai_summary?: string | null;
  },
): Promise<Doc> {
  assertEditor(actor);
  const existing = await getItemOrThrow(id, true);
  const set: Doc = { updated_at: nowIso() };
  const changes: string[] = [];
  if (patch.title !== undefined) {
    set.title = String(patch.title).trim().slice(0, 200);
    if (!set.title) throw httpError(400, "title is required");
    changes.push("title");
  }
  if (patch.description !== undefined) {
    set.description = String(patch.description).trim().slice(0, 10000);
    changes.push("description");
  }
  if (patch.category !== undefined) {
    set.category = asCategory(patch.category);
    changes.push("category");
  }
  if (patch.tags !== undefined) {
    set.tags = normaliseTags(patch.tags);
    changes.push("tags");
  }
  if (patch.external_links !== undefined) {
    set.external_links = normaliseLinks(patch.external_links);
    changes.push("links");
  }
  if (patch.is_archived !== undefined) {
    set.is_archived = Boolean(patch.is_archived);
    changes.push(set.is_archived ? "archived" : "restored");
  }
  if (patch.ai_summary !== undefined) {
    set.ai_summary = patch.ai_summary ? String(patch.ai_summary).slice(0, 5000) : null;
    changes.push("ai_summary");
  }

  const history = Array.isArray(existing.version_history) ? [...existing.version_history] : [];
  const nextVersion = (history[history.length - 1]?.version || 0) + 1;
  history.push({
    version: nextVersion,
    edited_by: actor.id,
    edited_by_name: actor.name,
    edited_at: set.updated_at,
    summary: changes.length ? changes.join(", ") : "Updated",
  });
  set.version_history = history.slice(-50);

  await col(TAX_KNOWLEDGE_COLLECTIONS.items).updateOne({ id }, { $set: set });
  return getKnowledgeItem(actor, id);
}

export async function addKnowledgeNote(
  actor: Doc,
  knowledgeItemId: string,
  noteText: string,
): Promise<Doc> {
  assertViewer(actor);
  await getItemOrThrow(knowledgeItemId, true);
  const text = String(noteText || "").trim().slice(0, 5000);
  if (!text) throw httpError(400, "note_text is required");
  const now = nowIso();
  const note: Doc = {
    id: randomUUID(),
    knowledge_item_id: knowledgeItemId,
    staff_id: actor.id,
    staff_name: actor.name,
    staff_role: actor.role,
    note_text: text,
    created_at: now,
  };
  await col(TAX_KNOWLEDGE_COLLECTIONS.notes).insertOne({ ...note });
  await col(TAX_KNOWLEDGE_COLLECTIONS.items).updateOne(
    { id: knowledgeItemId },
    { $set: { updated_at: now } },
  );
  return clean(note) as Doc;
}

export async function uploadKnowledgeFile(params: {
  actor: Doc;
  knowledge_item_id: string;
  file: Express.Multer.File;
}): Promise<Doc> {
  assertEditor(params.actor);
  const item = await getItemOrThrow(params.knowledge_item_id);
  const file = params.file;
  const ext = file.originalname.includes(".") ? file.originalname.split(".").pop() : "bin";
  const path = `${APP_NAME}/knowledge/${params.actor.id}/${randomUUID()}.${ext}`;
  const stored = await putObject(path, file.buffer, file.mimetype || "application/octet-stream");
  const fileId = randomUUID();
  const scan = await scanAndRecord({
    file_id: fileId,
    source: "knowledge",
    buffer: file.buffer,
    file_name: file.originalname,
    file_type: file.mimetype,
    file_size: stored.size ?? file.size,
    category: item.category,
  });
  const now = nowIso();
  const row: Doc = {
    id: fileId,
    knowledge_item_id: item.id,
    file_name: file.originalname,
    file_type: file.mimetype,
    file_size: stored.size ?? file.size,
    storage_path: stored.path,
    content_type: file.mimetype,
    uploaded_by: params.actor.id,
    uploaded_by_name: params.actor.name,
    scan_status: scan.scan_status,
    scan_timestamp: scan.scan_timestamp,
    scanner_notes: scan.scanner_notes,
    is_deleted: false,
    created_at: now,
  };
  await col(TAX_KNOWLEDGE_COLLECTIONS.files).insertOne({ ...row });
  await col(TAX_KNOWLEDGE_COLLECTIONS.items).updateOne(
    { id: item.id },
    update({
      $addToSet: { file_ids: fileId },
      $set: { updated_at: now },
      $push: {
        version_history: {
          version: (item.version_history?.length || 0) + 1,
          edited_by: params.actor.id,
          edited_by_name: params.actor.name,
          edited_at: now,
          summary: `Uploaded file ${file.originalname}`,
        },
      },
    }),
  );
  return clean(row) as Doc;
}

export async function downloadKnowledgeFile(params: {
  actor: Doc;
  file_id: string;
  confirmRisk?: boolean;
}): Promise<{ data: Buffer; contentType: string; fileName: string }> {
  assertViewer(params.actor);
  const file = (await col(TAX_KNOWLEDGE_COLLECTIONS.files).findOne({
    id: params.file_id,
    is_deleted: { $ne: true },
  })) as Doc | null;
  if (!file) throw httpError(404, "File not found");
  await assertDownloadAllowed({
    file_id: file.id,
    source: "knowledge",
    scan_status: file.scan_status,
    actor: params.actor,
    confirmRisk: params.confirmRisk,
  });
  const { data, contentType } = await getObject(file.storage_path);
  return {
    data,
    contentType: file.content_type || contentType,
    fileName: file.file_name || "file",
  };
}

export async function setBookmark(
  actor: Doc,
  knowledgeItemId: string,
  bookmarked: boolean,
): Promise<Doc> {
  assertViewer(actor);
  await getItemOrThrow(knowledgeItemId, true);
  if (bookmarked) {
    await col(TAX_KNOWLEDGE_COLLECTIONS.bookmarks).updateOne(
      { staff_id: actor.id, knowledge_item_id: knowledgeItemId },
      {
        $setOnInsert: {
          id: randomUUID(),
          staff_id: actor.id,
          knowledge_item_id: knowledgeItemId,
          created_at: nowIso(),
        },
      },
      { upsert: true },
    );
  } else {
    await col(TAX_KNOWLEDGE_COLLECTIONS.bookmarks).deleteOne({
      staff_id: actor.id,
      knowledge_item_id: knowledgeItemId,
    });
  }
  return { ok: true, bookmarked };
}

export function knowledgeMeta(): Doc {
  return {
    categories: [...TAX_KNOWLEDGE_CATEGORIES],
    suggested_tags: [...SUGGESTED_TAGS],
  };
}

export type { TaxKnowledgeCategory };
