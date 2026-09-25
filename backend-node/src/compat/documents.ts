import { createHash, randomUUID } from "crypto";

import { Router } from "express";
import multer from "multer";

import { APP_NAME } from "../config/env";
import { clean, cleanMany, col, Doc, scrubMany } from "../db/mongo";
import { getCase, ownedCaseIds } from "../domain/cases";
import { notifyAdmins } from "../domain/packages";
import {
  ALLOWED_TRANSITIONS,
  logActivity,
  notify,
  nowIso,
  transition,
} from "../domain/workflow";
import { handler, httpError } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import { mimeFromFilename, validateUpload } from "../middleware/protections";
import { getObject, putObject } from "../services/storage";
import { keysToCamel } from "./caseMap";
import { sendCompatSuccess } from "./envelope";
import { toCaseId } from "./ids";

export const compatDocumentsRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

export const DRAFT_REVIEW_AWAITING = "AWAITING_ADMIN_REVIEW";
export const DRAFT_REVIEW_APPROVED = "APPROVED";
export const DRAFT_REVIEW_RETURNED = "RETURNED";

/**
 * Move the case into READY_FOR_ADMIN_REVIEW when the workflow whitelist allows,
 * stepping through ACCOUNTANT_REVIEW when needed (e.g. from ASSIGNED).
 */
async function ensureReadyForAdminReview(kase: Doc, me: Doc): Promise<Doc> {
  let current = kase;
  const status = String(current.status);
  if (status === "READY_FOR_ADMIN_REVIEW" || status === "ADMIN_REVIEW") {
    return current;
  }
  if (status === "ASSIGNED") {
    if ((ALLOWED_TRANSITIONS[status] ?? []).includes("ACCOUNTANT_REVIEW")) {
      await transition(current, "ACCOUNTANT_REVIEW", me, "Draft preparation started");
      current = await getCase(String(current.id), me);
    }
  }
  const next = String(current.status);
  if ((ALLOWED_TRANSITIONS[next] ?? []).includes("READY_FOR_ADMIN_REVIEW")) {
    await transition(
      current,
      "READY_FOR_ADMIN_REVIEW",
      me,
      "Draft submitted for Admin review",
    );
    current = await getCase(String(current.id), me);
  }
  return current;
}

/** Release awaiting draft documents to the client after Admin approval. */
export async function releaseApprovedDraftDocuments(
  caseId: string,
  me: Doc,
): Promise<number> {
  const result = await col("documents").updateMany(
    {
      case_id: caseId,
      is_deleted: { $ne: true },
      $or: [{ is_draft: true }, { document_type: "Draft return" }],
      review_status: DRAFT_REVIEW_AWAITING,
    },
    {
      $set: {
        is_internal: false,
        review_status: DRAFT_REVIEW_APPROVED,
        status: "Accepted",
        admin_approved_at: nowIso(),
        admin_approved_by: me.id,
        admin_approved_by_name: me.name,
      },
    },
  );
  return result.modifiedCount ?? 0;
}

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

/**
 * D2 — staff request documents (maps onto native request-from-client / document_requests).
 * Calls getCase + same collections; does not invent a parallel request store.
 */
compatDocumentsRouter.post(
  "/accountant/tax-returns/:taxReturnId/request-documents",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = toCaseId(req.params.taxReturnId);
    const kase = await getCase(caseId, me);
    const { ALLOWED_TRANSITIONS, transition } = await import("../domain/workflow");
    const body = (req.body ?? {}) as Record<string, unknown>;
    const docs = Array.isArray(body.requiredDocuments)
      ? body.requiredDocuments
      : Array.isArray(body.required_documents)
        ? body.required_documents
        : [];
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const deadline =
      typeof body.deadline === "string" && body.deadline ? body.deadline : null;
    if (!docs.length) throw httpError(400, "requiredDocuments is required");

    if ((ALLOWED_TRANSITIONS[String(kase.status)] ?? []).includes("AWAITING_CLIENT")) {
      await transition(
        kase,
        "AWAITING_CLIENT",
        me,
        `Requested from client: ${docs.length} document(s)`,
        { waitingReason: message || "Documents requested" },
      );
    }

    const created = [];
    for (const raw of docs) {
      const d = (raw ?? {}) as Record<string, unknown>;
      const title = String(d.documentType ?? d.document_type ?? d.title ?? "").trim();
      if (!title) continue;
      const description = String(d.description ?? message ?? "").trim();
      const reqId = randomUUID();
      const taskId = randomUUID();
      await col("tasks").insertOne({
        id: taskId,
        case_id: caseId,
        case_ref: kase.case_ref,
        name: title,
        description,
        owner_role: "CLIENT",
        owner_id: kase.client_user_id,
        due_date: deadline,
        status: "OPEN",
        mandatory: true,
        created_by: me.id,
        created_by_name: me.name,
        created_at: nowIso(),
        completed_date: null,
        request_id: reqId,
      });
      await col("document_requests").insertOne({
        id: reqId,
        case_id: caseId,
        client_user_id: kase.client_user_id,
        title,
        description,
        task_id: taskId,
        status: "Requested",
        requested_by: me.id,
        requested_by_name: me.name,
        due_date: deadline,
        created_at: nowIso(),
      });
      const placeholder: Doc = {
        id: randomUUID(),
        case_id: caseId,
        client_user_id: kase.client_user_id,
        tax_year: kase.tax_year,
        document_type: title,
        name: title,
        status: "Requested",
        request_id: reqId,
        task_id: taskId,
        storage_path: null,
        uploader_id: null,
        uploader_name: null,
        content_type: null,
        size: 0,
        is_internal: false,
        is_deleted: false,
        created_at: nowIso(),
        upload_date: null,
      };
      await col("documents").insertOne({ ...placeholder });
      created.push(placeholder.id);
    }

    if (message) {
      await col("messages").insertOne({
        id: randomUUID(),
        case_id: caseId,
        sender_id: me.id,
        sender_name: me.name,
        sender_role: me.role,
        recipient_id: kase.client_user_id,
        body: message,
        is_read: false,
        created_at: nowIso(),
      });
    }
    await notify(
      kase.client_user_id as string,
      "Documents needed for your tax return",
      "Your TaxSimba accountant has requested the following:\n\n" +
        (message || `${created.length} document(s) requested`) +
        "\n\nPlease upload it securely through your TaxSimba account so we can keep your tax return moving.",
      caseId,
      "/documents",
      "DOCUMENT",
    );
    sendCompatSuccess(
      res,
      { ok: true, documentsRequested: created.length, documentIds: created },
      "Document request sent",
    );
  }),
);

/** D1 — staff draft / final certificate upload (same storage + documents collection). */
async function staffUpload(
  req: import("express").Request,
  res: import("express").Response,
  kind: "draft" | "final",
) {
  const me = authed(req);
  const caseId = toCaseId(req.params.taxReturnId);
  const f = req.file;
  if (!f) throw httpError(422, "file is required");
  const kase = await getCase(caseId, me);

  const inferredMime =
    mimeFromFilename(f.originalname) ||
    (f.mimetype || "").split(";")[0].trim() ||
    "application/octet-stream";
  const effectiveMime =
    !f.mimetype || f.mimetype === "application/octet-stream" ? inferredMime : f.mimetype;

  validateUpload(effectiveMime, f.size, f.originalname);
  const contentHash = createHash("sha256").update(f.buffer).digest("hex");

  // Idempotent draft retry: same content already awaiting Admin review → return it.
  if (kind === "draft") {
    const existing = (await col("documents").findOne({
      case_id: caseId,
      is_draft: true,
      is_deleted: { $ne: true },
      review_status: DRAFT_REVIEW_AWAITING,
      content_hash: contentHash,
    })) as Doc | null;
    if (existing) {
      sendCompatSuccess(
        res,
        {
          ...clean(existing),
          taxReturnId: caseId,
          caseId,
          duplicate: true,
          reviewStatus: DRAFT_REVIEW_AWAITING,
        },
        "Draft already submitted for Admin review",
      );
      return;
    }
  }

  const ext = f.originalname.includes(".") ? f.originalname.split(".").pop() : "bin";
  const path = `${APP_NAME}/uploads/${me.id}/${randomUUID()}.${ext}`;
  const stored = await putObject(path, f.buffer, effectiveMime);

  const notes =
    (typeof req.body?.explanationNotes === "string" && req.body.explanationNotes) ||
    (typeof req.body?.explanation_notes === "string" && req.body.explanation_notes) ||
    (typeof req.body?.notes === "string" && req.body.notes) ||
    null;
  const draftType =
    (typeof req.body?.draftType === "string" && req.body.draftType) ||
    (typeof req.body?.draft_type === "string" && req.body.draft_type) ||
    null;

  const record: Doc = {
    id: randomUUID(),
    case_id: caseId,
    client_user_id: kase.client_user_id,
    tax_year: kase.tax_year,
    document_type: kind === "final" ? "Final certificate" : "Draft return",
    name: f.originalname,
    status: kind === "draft" ? "Under Review" : "Uploaded",
    storage_path: stored.path,
    uploader_id: me.id,
    uploader_name: me.name,
    content_type: effectiveMime,
    size: stored.size ?? f.size,
    content_hash: contentHash,
    // Drafts stay internal until Admin approval — client must not see them early.
    is_internal: kind === "draft",
    is_draft: kind === "draft",
    is_final: kind === "final",
    review_status: kind === "draft" ? DRAFT_REVIEW_AWAITING : null,
    draft_type: kind === "draft" ? draftType : null,
    accountant_notes: kind === "draft" ? notes : null,
    is_deleted: false,
    upload_date: nowIso(),
    created_at: nowIso(),
    task_id: null,
    mtd_period_id: null,
  };
  await col("documents").insertOne({ ...record });
  await logActivity(
    caseId,
    kind === "final"
      ? `Final certificate uploaded: ${f.originalname}`
      : `Draft submitted for Admin review: ${f.originalname}`,
    me,
  );

  if (kind === "draft") {
    await ensureReadyForAdminReview(kase, me);
    await col("reviews").insertOne({
      id: randomUUID(),
      case_id: caseId,
      document_id: record.id,
      kind: "DRAFT_DOCUMENT",
      version: null,
      calculation_version_id: null,
      submitted_by: me.id,
      submitted_by_name: me.name,
      submitted_at: nowIso(),
      outcome: null,
      reviewer_id: null,
      reviewer_name: null,
      reason: null,
      instructions: null,
      accountant_note: notes,
      decided_at: null,
    });
    // Notify Admin only — never the client from accountant draft upload.
    await notifyAdmins(
      "Draft ready for Admin review",
      `${kase.client_name ?? "Client"} — ${kase.case_ref ?? caseId}: ${f.originalname} submitted by ${me.name}`,
      caseId,
      `/manage-tax/${caseId}`,
      "REVIEW",
    );
    sendCompatSuccess(
      res,
      {
        ...clean(record),
        taxReturnId: caseId,
        caseId,
        reviewStatus: DRAFT_REVIEW_AWAITING,
        clientNotified: false,
      },
      "Draft submitted for Admin review",
    );
    return;
  }

  await notify(
    kase.client_user_id as string,
    "Your final tax documents are ready",
    `Your final certificate is now available` +
      (kase.case_ref ? ` for ${kase.case_ref}` : "") +
      ".\n\nFor your security, please sign in to TaxSimba to download it.",
    caseId,
    "/documents",
    "DOCUMENT",
  );
  sendCompatSuccess(
    res,
    {
      ...clean(record),
      taxReturnId: caseId,
      caseId,
    },
    "Uploaded",
  );
}

const staffUploadMw = upload.fields([
  { name: "file", maxCount: 1 },
  { name: "draftReturnFile", maxCount: 1 },
  { name: "finalCertificateFile", maxCount: 1 },
  { name: "certificate", maxCount: 1 },
]);

function pickUploadedFile(
  req: import("express").Request,
): { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined {
  const files = req.files as
    | Record<string, Array<{ buffer: Buffer; originalname: string; mimetype: string; size: number }>>
    | undefined;
  if (!files) return req.file;
  return (
    files.file?.[0] ||
    files.draftReturnFile?.[0] ||
    files.finalCertificateFile?.[0] ||
    files.certificate?.[0]
  );
}

for (const prefix of ["/admin/assignments", "/accountant/assignments"] as const) {
  // Draft upload: ADMIN + assigned ACCOUNTANT only. SUPER_ADMIN is oversight, not an actor.
  compatDocumentsRouter.post(
    `${prefix}/:taxReturnId/upload-draft`,
    auth("ADMIN", "ACCOUNTANT"),
    staffUploadMw,
    handler(async (req, res) => {
      const f = pickUploadedFile(req);
      if (f) (req as { file?: typeof f }).file = f;
      await staffUpload(req, res, "draft");
    }),
  );
  compatDocumentsRouter.post(
    `${prefix}/:taxReturnId/upload-final-certificate`,
    auth("ADMIN", "ACCOUNTANT"),
    staffUploadMw,
    handler(async (req, res) => {
      const f = pickUploadedFile(req);
      if (f) (req as { file?: typeof f }).file = f;
      await staffUpload(req, res, "final");
    }),
  );
}

/**
 * Client draft review — thin maps onto case client-approve / MTD period client-approve.
 * Reject / request-changes notify staff via message (no invented workflow status).
 * Only Admin-approved drafts are visible to the client.
 */
async function draftDocumentsForCase(caseId: string, me: Doc): Promise<Doc[]> {
  const docs = (await col("documents")
    .find({
      case_id: caseId,
      is_deleted: { $ne: true },
      is_internal: false,
      $or: [{ is_draft: true }, { document_type: "Draft return" }],
      review_status: { $nin: [DRAFT_REVIEW_AWAITING, DRAFT_REVIEW_RETURNED] },
    })
    .sort({ created_at: -1 })
    .limit(50)
    .toArray()) as Doc[];
  return scrubMany(cleanMany(docs), me).map((d) => ({
    id: d.id,
    filename: d.name ?? "draft",
    fileSize: Number(d.size ?? 0),
    mimeType: d.content_type ?? "application/octet-stream",
    uploadedAt: d.upload_date ?? d.created_at ?? null,
    downloadUrl: `client/documents/${d.id}/download`,
    documentType: d.document_type,
    reviewStatus: d.review_status ?? DRAFT_REVIEW_APPROVED,
  }));
}

compatDocumentsRouter.get(
  "/client/drafts/:taxReturnId",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = toCaseId(req.params.taxReturnId);
    const kase = await getCase(caseId, me);
    const draftDocuments = await draftDocumentsForCase(caseId, me);
    const nameParts = String(kase.client_name ?? "").trim().split(/\s+/);
    sendCompatSuccess(
      res,
      {
        taxReturn: {
          id: kase.id,
          taxReturnId: kase.case_ref ?? kase.id,
          taxYear: kase.tax_year,
          status: kase.status,
          accountantNotes: kase.internal_instructions ?? null,
          client: { name: nameParts[0] || "", surname: nameParts.slice(1).join(" ") },
        },
        documents: { draftDocuments },
      },
      "OK",
    );
  }),
);

compatDocumentsRouter.post(
  "/client/drafts/:taxReturnId/approve",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = toCaseId(req.params.taxReturnId);
    const kase = await getCase(caseId, me);
    const notes =
      (typeof req.body?.approvalNotes === "string" && req.body.approvalNotes) ||
      (typeof req.body?.approval_notes === "string" && req.body.approval_notes) ||
      "";

    const { MTD, AWAITING_CLIENT, APPROVED, advance } = await import("../domain/mtd");
    const { notify, nowIso, transition, logActivity } = await import("../domain/workflow");
    const { notifyAdmins } = await import("../domain/packages");

    if (String(kase.service_type) === MTD) {
      const period = (await col("mtd_periods").findOne({
        case_id: caseId,
        status: AWAITING_CLIENT,
      })) as Doc | null;
      if (!period) throw httpError(400, "No MTD period is awaiting your approval");
      const out = await advance(period, kase, APPROVED, "approved by the client", me, {
        client_approved_at: nowIso(),
        approved_version: period.published_version,
        approved_snapshot: period.published,
        client_notes: notes || null,
      });
      for (const admin of await col("users")
        .find({ role: { $in: ["ADMIN", "SUPER_ADMIN"] }, is_active: true })
        .toArray()) {
        await notify(
          admin.id as string,
          "MTD period approved by client",
          `${kase.client_name} — ${kase.case_ref}`,
          caseId,
          `/admin/cases/${caseId}`,
          "SUBMISSION",
        );
      }
      sendCompatSuccess(res, keysToCamel(out as Doc), "Draft approved");
      return;
    }

    // SA — same gates as native POST /cases/:caseId/client-approve.
    if (!["ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL"].includes(String(kase.status))) {
      throw httpError(400, "Return is not ready for your approval");
    }
    const { randomUUID } = await import("crypto");
    const calc = await col("calculation_versions").findOne({ id: kase.approved_version_id });
    await col("client_approvals").insertOne({
      id: randomUUID(),
      case_id: caseId,
      client_user_id: me.id,
      client_name: me.name,
      calculation_version_id: kase.approved_version_id,
      version: calc ? calc.version : null,
      confirmation:
        "I confirm the information is complete and correct to the best of my knowledge.",
      notes: notes || null,
      approved_at: nowIso(),
    });
    await transition(kase, "CLIENT_APPROVED", me, `Client approved V${calc ? calc.version : ""}`, {
      extra: { client_approved_at: nowIso() },
      comments: notes || undefined,
    });
    const blocking = await col("tasks").countDocuments({ case_id: caseId, status: "OPEN" });
    if (!blocking) {
      await transition(kase, "READY_FOR_SUBMISSION", me, "Case ready for submission");
      await col("submission_records").insertOne({
        id: randomUUID(),
        case_id: caseId,
        status: "READY",
        calculation_version_id: kase.approved_version_id,
        reference: null,
        created_at: nowIso(),
      });
    }
    if (kase.assigned_accountant_id) {
      await notify(
        kase.assigned_accountant_id as string,
        "Client approved the return",
        `${kase.client_name} approved their tax return.`,
        caseId,
        `/work/cases/${caseId}`,
        "APPROVAL",
      );
    }
    await notifyAdmins(
      "Ready for submission",
      `${kase.client_name} — ${kase.case_ref}`,
      caseId,
      `/admin/cases/${caseId}`,
      "SUBMISSION",
    );
    await logActivity(caseId, "Client approved draft via compat", me);
    sendCompatSuccess(res, { ok: true, caseId, status: "CLIENT_APPROVED" }, "Draft approved");
  }),
);

async function clientDraftFeedback(
  req: import("express").Request,
  res: import("express").Response,
  kind: "reject" | "request_changes",
) {
  const me = authed(req);
  const caseId = toCaseId(req.params.taxReturnId);
  const kase = await getCase(caseId, me);
  const body = (req.body ?? {}) as Record<string, unknown>;
  let text = "";
  if (kind === "reject") {
    text = String(body.rejectionReason ?? body.rejection_reason ?? "").trim();
    if (!text) throw httpError(400, "A rejection reason is required");
  } else {
    const arr = body.changeRequests ?? body.change_requests;
    if (Array.isArray(arr)) text = arr.map((x) => String(x)).filter(Boolean).join("\n");
    else text = String(body.notes ?? body.message ?? "").trim();
    if (!text) throw httpError(400, "Please detail the changes requested");
  }
  const { randomUUID } = await import("crypto");
  const { notify, logActivity, nowIso } = await import("../domain/workflow");
  const recipient =
    (kase.assigned_accountant_id as string | null) ||
    (kase.admin_reviewer_id as string | null) ||
    null;
  await col("messages").insertOne({
    id: randomUUID(),
    case_id: caseId,
    sender_id: me.id,
    sender_name: me.name,
    sender_role: me.role,
    recipient_id: recipient,
    body: `[${kind === "reject" ? "Draft rejected" : "Changes requested"}]\n${text}`,
    is_read: false,
    created_at: nowIso(),
  });
  await logActivity(
    caseId,
    kind === "reject" ? `Client rejected draft: ${text}` : `Client requested draft changes: ${text}`,
    me,
  );
  if (recipient) {
    await notify(
      recipient,
      kind === "reject" ? "Client rejected draft" : "Client requested draft changes",
      text.slice(0, 200),
      caseId,
      `/work/cases/${caseId}`,
      "CHANGES",
    );
  }
  sendCompatSuccess(res, { ok: true, caseId, kind }, "Feedback sent");
}

compatDocumentsRouter.post(
  "/client/drafts/:taxReturnId/reject",
  auth("CLIENT"),
  handler(async (req, res) => clientDraftFeedback(req, res, "reject")),
);

compatDocumentsRouter.post(
  "/client/drafts/:taxReturnId/request-changes",
  auth("CLIENT"),
  handler(async (req, res) => clientDraftFeedback(req, res, "request_changes")),
);
