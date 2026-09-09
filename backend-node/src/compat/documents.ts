/**
 * Documents compat adapters (P0 K.5 / baseline D1–D3).
 * Thin maps onto existing getCase + storage domain (putObject/getObject).
 */
import { randomUUID } from "crypto";

import { Router } from "express";
import multer from "multer";

import { APP_NAME } from "../config/env";
import { clean, cleanMany, col, Doc, scrubMany } from "../db/mongo";
import { getCase, ownedCaseIds } from "../domain/cases";
import { logActivity, notify, nowIso } from "../domain/workflow";
import { handler, httpError } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import { validateUpload } from "../middleware/protections";
import { getObject, putObject } from "../services/storage";
import { keysToCamel } from "./caseMap";
import { sendCompatSuccess } from "./envelope";
import { toCaseId } from "./ids";

export const compatDocumentsRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

compatDocumentsRouter.post(
  "/client/my-files",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const owned = await ownedCaseIds(me);
    const accessible: string[] = [];
    for (const id of owned) {
      try {
        await getCase(id, me);
        accessible.push(id);
      } catch {
        // Skip cases without ACTIVE entitlement.
      }
    }
    if (!accessible.length) {
      sendCompatSuccess(res, { files: [], documents: [] }, "OK");
      return;
    }
    const docs = (await col("documents")
      .find({
        case_id: { $in: accessible },
        is_internal: false,
        is_deleted: { $ne: true },
      })
      .sort({ created_at: -1 })
      .limit(500)
      .toArray()) as Doc[];
    const cleaned = scrubMany(cleanMany(docs), me).map((d) => ({
      ...d,
      taxReturnId: d.case_id,
      tax_return_id: d.case_id,
      caseId: d.case_id,
    }));
    sendCompatSuccess(res, { files: cleaned, documents: cleaned }, "OK");
  }),
);

compatDocumentsRouter.post(
  "/client/tax-returns/:taxReturnId/upload-documents",
  auth("CLIENT"),
  upload.single("file"),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = toCaseId(req.params.taxReturnId);
    const f = req.file;
    if (!f) throw httpError(422, "file is required");

    const kase = await getCase(caseId, me);
    const documentType =
      (typeof req.body?.document_type === "string" && req.body.document_type) ||
      (typeof req.body?.documentType === "string" && req.body.documentType) ||
      "Other";
    const ext = f.originalname.includes(".") ? f.originalname.split(".").pop() : "bin";
    const path = `${APP_NAME}/uploads/${me.id}/${randomUUID()}.${ext}`;
    validateUpload(f.mimetype, f.size, f.originalname);
    const stored = await putObject(path, f.buffer, f.mimetype || "application/octet-stream");
    const record: Doc = {
      id: randomUUID(),
      case_id: caseId,
      client_user_id: kase.client_user_id,
      tax_year: kase.tax_year,
      document_type: documentType,
      name: f.originalname,
      status: "Uploaded",
      storage_path: stored.path,
      uploader_id: me.id,
      uploader_name: me.name,
      content_type: f.mimetype,
      size: stored.size ?? f.size,
      is_internal: false,
      is_deleted: false,
      upload_date: nowIso(),
      created_at: nowIso(),
      task_id: null,
      mtd_period_id: null,
    };
    await col("documents").insertOne({ ...record });
    await logActivity(caseId, `Document uploaded: ${f.originalname}`, me);
    if (kase.assigned_accountant_id) {
      await notify(
        kase.assigned_accountant_id as string,
        "Client upload received",
        `${kase.client_name} uploaded ${f.originalname}`,
        caseId,
        `/work/cases/${caseId}`,
        "UPLOAD",
      );
    }
    sendCompatSuccess(
      res,
      {
        ...clean(record),
        tax_return_id: caseId,
        case_id: caseId,
        taxReturnId: caseId,
        caseId,
      },
      "Uploaded",
    );
  }),
);

compatDocumentsRouter.get(
  "/client/tax-returns/:taxReturnId/final-certificate",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = toCaseId(req.params.taxReturnId);
    await getCase(caseId, me);
    const docs = (await col("documents")
      .find({
        case_id: caseId,
        is_final: true,
        is_deleted: { $ne: true },
        is_internal: false,
      })
      .sort({ created_at: -1 })
      .limit(50)
      .toArray()) as Doc[];
    sendCompatSuccess(
      res,
      {
        caseId,
        taxReturnId: caseId,
        documents: keysToCamel(scrubMany(cleanMany(docs), me)),
      },
      "OK",
    );
  }),
);

/** Download — enforces getCase ownership/entitlement before streaming. */
compatDocumentsRouter.get(
  "/client/documents/:documentId/download",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const doc = (await col("documents").findOne({
      id: req.params.documentId,
      is_deleted: { $ne: true },
    })) as Doc | null;
    if (!doc) throw httpError(404, "Document not found");
    await getCase(String(doc.case_id), me);
    if (me.role === "CLIENT" && doc.is_internal) {
      throw httpError(403, "Not allowed");
    }
    if (!doc.storage_path) throw httpError(404, "Document file not available");
    const { data, contentType } = await getObject(String(doc.storage_path));
    res.setHeader("Content-Type", String(doc.content_type ?? contentType ?? "application/octet-stream"));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${String(doc.name ?? "document").replace(/"/g, "")}"`,
    );
    res.send(data);
  }),
);
