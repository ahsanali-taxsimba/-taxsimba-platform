import { randomUUID } from "crypto";

import { Request, Router } from "express";
import multer from "multer";

import { APP_NAME } from "../config/env";
import { clean, cleanMany, col, Doc, scrubMany } from "../db/mongo";
import { getCase, ownedCaseIds } from "../domain/cases";
import { logActivity, notify, nowIso } from "../domain/workflow";
import { handler, httpError } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import { validateUpload } from "../middleware/protections";
import { getObject, putObject } from "../services/storage";
import { completeTask } from "../services/tasks";

export const documentsRouter = Router();

const upload = multer({ storage: multer.memoryStorage() });

const DOCUMENT_STATUSES = [
  "Requested",
  "Uploaded",
  "Under Review",
  "Accepted",
  "Replacement Required",
  "Final",
];
const FINAL_STAGES = ["READY_FOR_SUBMISSION", "SUBMITTED", "COMPLETED"];

function str(req: Request, name: string): string | undefined {
  const v = req.query[name];
  return typeof v === "string" && v.length ? v : undefined;
}

function field(req: Request, name: string): string | undefined {
  const v = (req.body as Record<string, unknown> | undefined)?.[name];
  return typeof v === "string" && v.length ? v : undefined;
}

function flag(req: Request, name: string): boolean {
  return ["1", "true", "on", "yes"].includes((field(req, name) ?? "").toLowerCase());
}

/** Case ids of automated-test cases, which never appear in operational document views. */
async function testCaseIds(): Promise<string[]> {
  const rows = await col("cases").find({ is_test: true }, { projection: { id: 1 } }).toArray();
  return rows.map((c) => c.id as string);
}

documentsRouter.get(
  "/documents",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = str(req, "case_id");
    const serviceType = str(req, "service_type");
    const mtdPeriodId = str(req, "mtd_period_id");
    const clientUserId = str(req, "client_user_id");
    const filter = str(req, "filter");
    const conditions: Doc[] = [];
    const query: Doc = {};

    if (me.role === "CLIENT") {
      // Scoped by owned CASES, not by the document's own client_user_id copy.
      query.case_id = { $in: await ownedCaseIds(me, serviceType) };
      query.is_internal = false;
    } else if (me.role === "ACCOUNTANT") {
      const rows = await col("cases")
        .find(
          serviceType
            ? { assigned_accountant_id: me.id, service_type: serviceType }
            : { assigned_accountant_id: me.id },
          { projection: { id: 1 } },
        )
        .toArray();
      query.case_id = { $in: rows.map((c) => c.id) };
    } else {
      // Security correction (documented in the Node migration rules): an admin listing is
      // never global. Every read must name the case, client or period it belongs to, so a
      // document can only be reached through an authorised operational scope.
      if (!caseId && !clientUserId && !mtdPeriodId) {
        throw httpError(400, "A case, client or period must be specified to list documents");
      }
      if (serviceType) {
        const rows = await col("cases")
          .find({ service_type: serviceType }, { projection: { id: 1 } })
          .toArray();
        query.case_id = { $in: rows.map((c) => c.id) };
      }
      if (clientUserId) query.client_user_id = clientUserId;
    }

    if (caseId) {
      await getCase(caseId, me);
      query.case_id = caseId;
    }
    if (mtdPeriodId) query.mtd_period_id = mtdPeriodId;

    if (filter === "requested") query.status = "Requested";
    else if (filter === "uploaded") {
      query.status = { $in: ["Uploaded", "Under Review", "Accepted", "Replacement Required"] };
    } else if (filter === "final") query.is_final = true;
    query.is_deleted = { $ne: true };

    // Automated-test documents stay in the database but never appear in operational views.
    if (!caseId) {
      const excluded = await testCaseIds();
      if (excluded.length) conditions.push({ case_id: { $nin: excluded } });
    }
    const finalQuery = conditions.length ? { $and: [query, ...conditions] } : query;
    const docs = (await col("documents")
      .find(finalQuery)
      .sort({ created_at: -1 })
      .limit(500)
      .toArray()) as Doc[];
    res.json(scrubMany(cleanMany(docs), me));
  }),
);

documentsRouter.post(
  "/documents/upload",
  auth(),
  upload.single("file"),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = field(req, "case_id");
    if (!caseId) throw httpError(422, [{ loc: ["body", "case_id"], msg: "field required", type: "missing" }]);
    const file = req.file;
    if (!file) throw httpError(422, [{ loc: ["body", "file"], msg: "field required", type: "missing" }]);
    const documentType = field(req, "document_type") ?? "Other";
    const documentId = field(req, "document_id");
    const taskId = field(req, "task_id");
    const mtdPeriodId = field(req, "mtd_period_id");
    const isInternal = flag(req, "is_internal");

    const kase = await getCase(caseId, me);
    if (isInternal && me.role === "CLIENT") {
      throw httpError(403, "Clients cannot upload internal documents");
    }
    const ext = file.originalname.includes(".") ? file.originalname.split(".").pop() : "bin";
    const path = `${APP_NAME}/uploads/${me.id}/${randomUUID()}.${ext}`;
    validateUpload(file.mimetype, file.size, file.originalname);
    const stored = await putObject(path, file.buffer, file.mimetype || "application/octet-stream");
    const record: Doc = {
      id: documentId || randomUUID(),
      case_id: caseId,
      client_user_id: kase.client_user_id,
      tax_year: kase.tax_year,
      document_type: documentType,
      name: file.originalname,
      status: isInternal ? "Final" : "Uploaded",
      storage_path: stored.path,
      uploader_id: me.id,
      uploader_name: me.name,
      content_type: file.mimetype,
      size: stored.size ?? file.size,
      is_internal: isInternal,
      is_deleted: false,
      upload_date: nowIso(),
      created_at: nowIso(),
      task_id: taskId ?? null,
      mtd_period_id: mtdPeriodId ?? null,
    };
    const existing = (await col("documents").findOne({ id: record.id })) as Doc | null;
    if (existing) {
      // A referenced document keeps its own case and MTD period — an upload can never
      // move a document (or a request) from one period or case to another.
      if (
        existing.case_id !== caseId ||
        (mtdPeriodId && existing.mtd_period_id && mtdPeriodId !== existing.mtd_period_id)
      ) {
        throw httpError(400, "This document belongs to a different case or period");
      }
      record.created_at = existing.created_at ?? nowIso();
      record.request_id = existing.request_id ?? null;
      record.task_id = taskId ?? existing.task_id ?? null;
      record.mtd_period_id = existing.mtd_period_id ?? mtdPeriodId ?? null;
      await col("documents").replaceOne({ id: record.id }, { ...record });
      if (existing.request_id) {
        await col("document_requests").updateOne(
          { id: existing.request_id },
          { $set: { status: "Uploaded" } },
        );
      }
    } else {
      await col("documents").insertOne({ ...record });
    }
    await logActivity(caseId, `Document uploaded: ${file.originalname}`, me);
    if (me.role === "CLIENT" && kase.assigned_accountant_id) {
      await notify(
        kase.assigned_accountant_id,
        "Client upload received",
        `${kase.client_name} uploaded ${file.originalname}`,
        caseId,
        `/work/cases/${caseId}`,
        "UPLOAD",
      );
      if (
        ["ASSIGNED", "ACCOUNTANT_REVIEW", "AWAITING_CLIENT", "CHANGES_REQUIRED"].includes(
          kase.status,
        )
      ) {
        await col("cases").updateOne(
          { id: caseId },
          {
            $set: {
              next_action_owner: "ACCOUNTANT",
              next_action: "Review the document the client uploaded",
              last_updated: nowIso(),
            },
          },
        );
      }
    }
    if (record.task_id) await completeTask(record.task_id, me);
    res.json(clean(record));
  }),
);

documentsRouter.patch(
  "/documents/:documentId/status",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const status = str(req, "status");
    if (!status) {
      throw httpError(422, [{ loc: ["query", "status"], msg: "field required", type: "missing" }]);
    }
    const doc = (await col("documents").findOne({ id: req.params.documentId })) as Doc | null;
    if (!doc) throw httpError(404, "Document not found");
    const kase = await getCase(doc.case_id, me);
    if (kase.status === "COMPLETED" && me.role === "ACCOUNTANT") {
      throw httpError(400, "This case is completed and locked");
    }
    if (!DOCUMENT_STATUSES.includes(status)) throw httpError(400, "Invalid status");
    await col("documents").updateOne({ id: req.params.documentId }, { $set: { status } });
    await logActivity(doc.case_id, `Document '${doc.name}' marked ${status}`, me);
    res.json({ ok: true });
  }),
);

documentsRouter.get(
  "/documents/:documentId/download",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const doc = (await col("documents").findOne({ id: req.params.documentId })) as Doc | null;
    if (!doc || !doc.storage_path) throw httpError(404, "File not found");
    if (me.role === "CLIENT" && doc.is_internal) throw httpError(403, "Not allowed");
    // Access is always proven against the parent case, not the document's copied fields —
    // for staff as well as clients, so no role can read a document out of scope.
    await getCase(doc.case_id, me);
    const { data, contentType } = await getObject(doc.storage_path);
    res.setHeader("Content-Type", doc.content_type || contentType);
    res.setHeader("Content-Disposition", `inline; filename="${doc.name}"`);
    res.send(data);
  }),
);

/**
 * Publishes the final client copy. Each publish is a new immutable version, so a case that
 * is reopened and re-completed keeps every earlier final document as evidence.
 */
documentsRouter.post(
  "/cases/:caseId/final-documents",
  auth("ADMIN", "SUPER_ADMIN"),
  upload.single("file"),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = req.params.caseId;
    const file = req.file;
    if (!file) throw httpError(422, [{ loc: ["body", "file"], msg: "field required", type: "missing" }]);
    const documentType = field(req, "document_type") ?? "Final tax return";
    const kase = await getCase(caseId, me);
    if (kase.service_type === "MTD_INCOME_TAX") {
      // MTD has its own workflow: the final client copy follows the submitted Final Declaration.
      const final = await col("mtd_periods").findOne({
        case_id: caseId,
        kind: "FINAL_DECLARATION",
      });
      if (!final || final.status !== "SUBMITTED") {
        throw httpError(
          400,
          "The Final Declaration must be submitted before the final client copy can be published",
        );
      }
    } else if (!FINAL_STAGES.includes(kase.status)) {
      throw httpError(
        400,
        "The final client copy can only be published once the return is approved and ready for submission",
      );
    }
    validateUpload(file.mimetype, file.size, file.originalname);
    const ext = file.originalname.includes(".") ? file.originalname.split(".").pop() : "bin";
    const stored = await putObject(
      `${APP_NAME}/final/${caseId}/${randomUUID()}.${ext}`,
      file.buffer,
      file.mimetype || "application/octet-stream",
    );
    const version = (await col("documents").countDocuments({ case_id: caseId, is_final: true })) + 1;
    const record: Doc = {
      id: randomUUID(),
      case_id: caseId,
      case_ref: kase.case_ref,
      client_user_id: kase.client_user_id,
      tax_year: kase.tax_year,
      document_type: documentType,
      name: file.originalname,
      status: "Final",
      storage_path: stored.path,
      uploader_id: me.id,
      uploader_name: me.name,
      content_type: file.mimetype,
      size: stored.size ?? file.size,
      is_internal: false,
      is_final: true,
      final_version: version,
      is_deleted: false,
      published_at: nowIso(),
      upload_date: nowIso(),
      created_at: nowIso(),
    };
    await col("documents").insertOne({ ...record });
    await logActivity(
      caseId,
      `Final client document published: ${file.originalname} (version ${version})`,
      me,
    );
    await notify(
      kase.client_user_id,
      "Your final documents are available",
      `${documentType} for ${kase.tax_year} is ready to download.`,
      caseId,
      "/documents",
      "INFO",
    );
    res.json(clean(record));
  }),
);

documentsRouter.get(
  "/cases/:caseId/final-documents",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    await getCase(req.params.caseId, me);
    const rows = (await col("documents")
      .find({ case_id: req.params.caseId, is_final: true, is_deleted: { $ne: true } })
      .sort({ final_version: -1 })
      .limit(100)
      .toArray()) as Doc[];
    res.json(scrubMany(cleanMany(rows), me));
  }),
);
