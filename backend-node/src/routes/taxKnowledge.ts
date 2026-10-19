/**
 * Tax Knowledge Library API (staff only).
 *
 *   GET    /tax-knowledge/meta
 *   GET    /tax-knowledge?category=&tag=&q=&recently=1&bookmarked=1&archived=1
 *   POST   /tax-knowledge
 *   GET    /tax-knowledge/:id
 *   PATCH  /tax-knowledge/:id
 *   POST   /tax-knowledge/:id/notes
 *   POST   /tax-knowledge/:id/files          (multipart)
 *   GET    /tax-knowledge/files/:fileId/download?confirm_risk=1
 *   POST   /tax-knowledge/:id/bookmark
 *   DELETE /tax-knowledge/:id/bookmark
 */
import { Router } from "express";
import { z } from "zod";

import { ensureTaxKnowledgeIndexes } from "../domain/taxKnowledge";
import { handler, httpError, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import { uploadMiddleware, validateUpload } from "../middleware/protections";
import {
  addKnowledgeNote,
  createKnowledgeItem,
  downloadKnowledgeFile,
  getKnowledgeItem,
  knowledgeMeta,
  listKnowledgeItems,
  setBookmark,
  updateKnowledgeItem,
  uploadKnowledgeFile,
} from "../services/taxKnowledge";

export const taxKnowledgeRouter = Router();

const upload = uploadMiddleware();
const STAFF = ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"] as const;

let ready = false;
async function boot(): Promise<void> {
  if (ready) return;
  await ensureTaxKnowledgeIndexes();
  ready = true;
}

const LinkIn = z.object({
  label: z.string().optional(),
  url: z.string().url(),
});

const CreateIn = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
  tags: z.array(z.string()).optional(),
  external_links: z.array(LinkIn).optional(),
});

const PatchIn = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  external_links: z.array(LinkIn).optional(),
  is_archived: z.boolean().optional(),
  ai_summary: z.string().nullish(),
});

const NoteIn = z.object({
  note_text: z.string().min(1),
});

taxKnowledgeRouter.get(
  "/tax-knowledge/meta",
  auth(...STAFF),
  handler(async (_req, res) => {
    await boot();
    res.json(knowledgeMeta());
  }),
);

taxKnowledgeRouter.get(
  "/tax-knowledge",
  auth(...STAFF),
  handler(async (req, res) => {
    await boot();
    const str = (k: string) =>
      typeof req.query[k] === "string" && req.query[k] ? String(req.query[k]) : undefined;
    res.json(
      await listKnowledgeItems(authed(req), {
        category: str("category"),
        tag: str("tag"),
        q: str("q"),
        include_archived: req.query.archived === "1",
        recently: req.query.recently === "1",
        bookmarked_only: req.query.bookmarked === "1",
        limit: str("limit") ? Number(str("limit")) : undefined,
      }),
    );
  }),
);

taxKnowledgeRouter.post(
  "/tax-knowledge",
  auth(...STAFF),
  handler(async (req, res) => {
    await boot();
    const body = parseBody(CreateIn, req.body);
    res.status(201).json(await createKnowledgeItem(authed(req), body));
  }),
);

// Static path segments must be registered before /:id.
taxKnowledgeRouter.get(
  "/tax-knowledge/files/:fileId/download",
  auth(...STAFF),
  handler(async (req, res) => {
    await boot();
    const confirmRisk =
      req.query.confirm_risk === "1" ||
      req.query.confirm_risk === "true" ||
      req.query.confirmRisk === "1";
    const file = await downloadKnowledgeFile({
      actor: authed(req),
      file_id: req.params.fileId,
      confirmRisk,
    });
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    res.send(file.data);
  }),
);

taxKnowledgeRouter.get(
  "/tax-knowledge/:id",
  auth(...STAFF),
  handler(async (req, res) => {
    await boot();
    res.json(await getKnowledgeItem(authed(req), req.params.id));
  }),
);

taxKnowledgeRouter.patch(
  "/tax-knowledge/:id",
  auth(...STAFF),
  handler(async (req, res) => {
    await boot();
    const body = parseBody(PatchIn, req.body);
    res.json(await updateKnowledgeItem(authed(req), req.params.id, body));
  }),
);

taxKnowledgeRouter.post(
  "/tax-knowledge/:id/notes",
  auth(...STAFF),
  handler(async (req, res) => {
    await boot();
    const body = parseBody(NoteIn, req.body);
    res.status(201).json(await addKnowledgeNote(authed(req), req.params.id, body.note_text));
  }),
);

taxKnowledgeRouter.post(
  "/tax-knowledge/:id/files",
  auth(...STAFF),
  upload.single("file"),
  handler(async (req, res) => {
    await boot();
    const file = req.file;
    if (!file) throw httpError(422, [{ loc: ["body", "file"], msg: "field required", type: "missing" }]);
    validateUpload(file.mimetype, file.size, file.originalname);
    res.status(201).json(
      await uploadKnowledgeFile({
        actor: authed(req),
        knowledge_item_id: req.params.id,
        file,
      }),
    );
  }),
);

taxKnowledgeRouter.post(
  "/tax-knowledge/:id/bookmark",
  auth(...STAFF),
  handler(async (req, res) => {
    await boot();
    res.json(await setBookmark(authed(req), req.params.id, true));
  }),
);

taxKnowledgeRouter.delete(
  "/tax-knowledge/:id/bookmark",
  auth(...STAFF),
  handler(async (req, res) => {
    await boot();
    res.json(await setBookmark(authed(req), req.params.id, false));
  }),
);
