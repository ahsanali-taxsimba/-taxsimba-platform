/**
 * MTD aggregate adapters (P0 K.6 / baseline T1–T4).
 * Thin maps over ACTIVE MTD case + existing ensurePeriods / documents / onboarding.
 * No HMRC. Does not rewrite domain/mtd.ts. start-next-quarter is HIDE (405).
 */
import { randomUUID } from "crypto";

import { Router } from "express";
import multer from "multer";

import { APP_NAME } from "../config/env";
import { clean, cleanMany, col, Doc, scrubMany } from "../db/mongo";
import {
  assertClientCanAccessService,
  preferExistingServiceCase,
} from "../domain/caseEntitlement";
import { getCase } from "../domain/cases";
import {
  AWAITING_CLIENT,
  APPROVED,
  ADMIN_REVIEW,
  ensurePeriods,
  IN_PROGRESS,
  MTD,
  NOT_STARTED,
  SUBMITTED,
} from "../domain/mtd";
import { logActivity, notify, nowIso } from "../domain/workflow";
import { handler, httpError } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import { validateUpload } from "../middleware/protections";
import { putObject } from "../services/storage";
import { sendCompatSuccess } from "./envelope";
import { withTaxReturnId } from "./ids";

export const compatMtdRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

/** Resolve the CLIENT's ACTIVE MTD case (fulfil/activation preferred). */
async function activeMtdCase(user: Doc): Promise<Doc> {
  await assertClientCanAccessService(user, MTD);
  const existing = await preferExistingServiceCase(user, MTD);
  if (!existing) {
    throw httpError(400, "No MTD case found. Complete MTD purchase activation first.");
  }
  const kase = await getCase(String(existing.id), user);
  if (kase.service_type !== MTD) throw httpError(403, "Not an MTD case");
  return kase;
}

async function periodsForCase(kase: Doc): Promise<Doc[]> {
  // Existing domain path: ensurePeriods is idempotent (activation + list already use it).
  await ensurePeriods(kase);
  const rows = (await col("mtd_periods")
    .find({ case_id: kase.id })
    .limit(20)
    .toArray()) as Doc[];
  rows.sort(
    (a, b) =>
      Number(a.kind === "FINAL_DECLARATION") - Number(b.kind === "FINAL_DECLARATION") ||
      Number(a.quarter ?? 0) - Number(b.quarter ?? 0),
  );
  return rows;
}

function quarterLabel(row: Doc | null | undefined): string | null {
  if (!row) return null;
  if (row.kind === "FINAL_DECLARATION") return "Final Declaration";
  if (row.label) return String(row.label);
  if (row.quarter) return `Q${row.quarter}`;
  return null;
}

/** Map Node period + case state → Toxel taxReturnStatus (no HMRC invention). */
function mapTaxReturnStatus(kase: Doc, current: Doc | null): string {
  if (kase.status === "COMPLETED") return "completed";
  if (!kase.assigned_accountant_id) return "pending_assignment";
  if (!current) return "assigned";
  switch (String(current.status)) {
    case NOT_STARTED:
      return "assigned";
    case IN_PROGRESS:
    case ADMIN_REVIEW:
      return "preparation_started";
    case AWAITING_CLIENT:
      return "draft_ready";
    case APPROVED:
      return "approved";
    case SUBMITTED:
      return current.kind === "FINAL_DECLARATION" ? "final_submitted" : "submitted";
    default:
      return "assigned";
  }
}

function mapComplianceStatus(kase: Doc, current: Doc | null, hasUploaded: boolean): string {
  if (kase.status === "COMPLETED") return "Completed";
  if (!current) return "Incomplete";
  if (current.status === SUBMITTED) {
    return current.kind === "FINAL_DECLARATION" ? "Completed" : "Filed";
  }
  if (current.status === AWAITING_CLIENT || current.status === APPROVED || current.status === ADMIN_REVIEW) {
    return "Under Review";
  }
  if (current.status === IN_PROGRESS || hasUploaded) return "Documents Submitted";
  return "Incomplete";
}

function mapDocStatus(status: string): string {
  if (status === "Accepted" || status === "Final") return "Approved";
  if (status === "Requested") return "Pending";
  if (status === "Under Review" || status === "Uploaded" || status === "Replacement Required") {
    return status === "Uploaded" ? "Uploaded" : status === "Under Review" ? "Under Review" : "Pending";
  }
  return status || "Uploaded";
}

async function accountantPayload(kase: Doc): Promise<Doc | null> {
  if (!kase.assigned_accountant_id) return null;
  const acc = (await col("users").findOne(
    { id: kase.assigned_accountant_id },
    { projection: { id: 1, name: 1, email: 1 } },
  )) as Doc | null;
  if (!acc) {
    return {
      name: kase.assigned_accountant_name ?? "Accountant",
      surname: "",
      email: null,
    };
  }
  const parts = String(acc.name ?? "").trim().split(/\s+/);
  return {
    id: acc.id,
    name: parts[0] || String(acc.name ?? ""),
    surname: parts.slice(1).join(" "),
    email: acc.email ?? null,
  };
}

async function caseDocuments(caseId: string, me: Doc): Promise<Doc[]> {
  const docs = (await col("documents")
    .find({
      case_id: caseId,
      is_deleted: { $ne: true },
      is_internal: false,
    })
    .sort({ created_at: -1 })
    .limit(500)
    .toArray()) as Doc[];
  return scrubMany(cleanMany(docs), me);
}

function toOverviewDocuments(docs: Doc[]): Doc[] {
  return docs.map((d) => {
    const requested = d.status === "Requested";
    return {
      id: d.id,
      documentType: d.document_type ?? "Other",
      uploadStatus: requested ? "uploading" : "completed",
      isRequired: requested || Boolean(d.request_id),
      priority: d.priority ?? null,
      deadline: d.due_date ?? null,
      message: d.name ?? null,
      uploadedBy: d.uploader_id ?? null,
      originalFileName: d.name ?? null,
      fileSize: d.size ?? null,
      mimeType: d.content_type ?? null,
      cloudinaryUrl: null,
      mtdPeriodId: d.mtd_period_id ?? null,
    };
  });
}

compatMtdRouter.get(
  "/mtd/dashboard-overview",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const kase = await activeMtdCase(me);
    const periods = await periodsForCase(kase);
    const quarters = periods.filter((p) => p.kind === "QUARTER");
    const current =
      quarters.find((p) => p.status !== SUBMITTED) ??
      periods.find((p) => p.kind === "FINAL_DECLARATION" && p.status !== SUBMITTED) ??
      periods[periods.length - 1] ??
      null;
    const previous =
      [...quarters].reverse().find((p) => p.status === SUBMITTED) ?? null;
    const docs = await caseDocuments(String(kase.id), me);
    const accountant = await accountantPayload(kase);

    sendCompatSuccess(
      res,
      {
        taxReturnStatus: mapTaxReturnStatus(kase, current),
        taxReturn: withTaxReturnId({
          id: kase.id,
          tax_year: kase.tax_year,
          priority: kase.priority ?? null,
          mtd_quarter: quarterLabel(current),
          mtd_quarter_due_date: current?.deadline ?? null,
          service_type: MTD,
          status: kase.status,
        }),
        accountant,
        documents: toOverviewDocuments(docs),
        previousTaxReturn: previous
          ? { mtdQuarter: quarterLabel(previous), taxReturnId: kase.id }
          : null,
        // T3 HIDE: never surface nextQuarter so Start Next Quarter UI stays off.
        nextQuarter: null,
        periods: periods.map((p) => ({
          id: p.id,
          kind: p.kind,
          quarter: p.quarter,
          label: p.label,
          status: p.status,
          deadline: p.deadline,
        })),
      },
      "OK",
    );
  }),
);

compatMtdRouter.get(
  "/mtd/compliance",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const kase = await activeMtdCase(me);
    const periods = await periodsForCase(kase);
    const docs = await caseDocuments(String(kase.id), me);
    const hasUploaded = docs.some((d) => d.status !== "Requested");
    const current =
      periods.find((p) => p.kind === "QUARTER" && p.status !== SUBMITTED) ??
      periods.find((p) => p.kind === "FINAL_DECLARATION") ??
      null;
    const taxYearHead = String(kase.tax_year ?? "").split("/")[0];
    const records = [
      {
        id: kase.id,
        taxReturnId: kase.id,
        status: mapComplianceStatus(kase, current, hasUploaded),
        taxYear: taxYearHead ? Number(taxYearHead) || taxYearHead : kase.tax_year,
        submissionDate:
          current?.status === SUBMITTED ? (current.submission_date ?? current.updated_at ?? null) : null,
        mtdQuarter: quarterLabel(current),
      },
    ];
    sendCompatSuccess(res, records, "OK");
  }),
);

compatMtdRouter.get(
  "/mtd/documents",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const kase = await activeMtdCase(me);
    const docs = await caseDocuments(String(kase.id), me);
    const uploadedDocuments = docs
      .filter((d) => d.status !== "Requested")
      .map((d) => ({
        id: d.id,
        documentType: d.document_type ?? "Other",
        originalFileName: d.name ?? null,
        fileSize: d.size ?? null,
        mimeType: d.content_type ?? null,
        status: mapDocStatus(String(d.status ?? "Uploaded")),
        createdAt: d.created_at ?? d.upload_date ?? null,
        cloudinaryUrl: null,
        mtdPeriodId: d.mtd_period_id ?? null,
        taxReturnId: kase.id,
      }));
    const requestedDocuments = docs
      .filter((d) => d.status === "Requested")
      .map((d) => ({
        id: d.id,
        documentType: d.document_type ?? "Other",
        priority: d.priority ?? null,
        deadline: d.due_date ?? null,
        message: d.name ?? null,
        taxReturnId: kase.id,
      }));
    sendCompatSuccess(res, { uploadedDocuments, requestedDocuments }, "OK");
  }),
);

compatMtdRouter.post(
  "/mtd/documents/upload",
  auth("CLIENT"),
  upload.array("documents", 20),
  handler(async (req, res) => {
    const me = authed(req);
    const kase = await activeMtdCase(me);
    const files = (req.files as { originalname: string; mimetype: string; size: number; buffer: Buffer }[] | undefined) ?? [];
    if (!files.length) throw httpError(422, "documents are required");
    const documentType =
      (typeof req.body?.documentType === "string" && req.body.documentType) ||
      (typeof req.body?.document_type === "string" && req.body.document_type) ||
      "general";
    const requestId =
      (typeof req.body?.requestId === "string" && req.body.requestId) ||
      (typeof req.body?.request_id === "string" && req.body.request_id) ||
      null;

    const periods = await periodsForCase(kase);
    const currentPeriod =
      periods.find((p) => p.kind === "QUARTER" && p.status !== SUBMITTED) ??
      periods.find((p) => p.status !== SUBMITTED) ??
      null;

    const uploaded: Doc[] = [];
    for (const file of files) {
      const ext = file.originalname.includes(".") ? file.originalname.split(".").pop() : "bin";
      const path = `${APP_NAME}/uploads/${me.id}/${randomUUID()}.${ext}`;
      validateUpload(file.mimetype, file.size, file.originalname);
      const stored = await putObject(path, file.buffer, file.mimetype || "application/octet-stream");

      let documentId: string = randomUUID();
      let taskId: string | null = null;
      let mtdPeriodId: string | null = currentPeriod?.id ? String(currentPeriod.id) : null;
      if (requestId) {
        const existing = (await col("documents").findOne({ id: requestId })) as Doc | null;
        if (existing) {
          if (existing.case_id !== kase.id) {
            throw httpError(403, "Document request is not on your MTD case");
          }
          documentId = String(existing.id);
          taskId = existing.task_id ? String(existing.task_id) : null;
          mtdPeriodId = existing.mtd_period_id
            ? String(existing.mtd_period_id)
            : mtdPeriodId;
          if (existing.request_id) {
            await col("document_requests").updateOne(
              { id: existing.request_id },
              { $set: { status: "Uploaded" } },
            );
          }
        }
      }

      const record: Doc = {
        id: documentId,
        case_id: kase.id,
        client_user_id: kase.client_user_id,
        tax_year: kase.tax_year,
        document_type: documentType,
        name: file.originalname,
        status: "Uploaded",
        storage_path: stored.path,
        uploader_id: me.id,
        uploader_name: me.name,
        content_type: file.mimetype,
        size: stored.size ?? file.size,
        is_internal: false,
        is_deleted: false,
        upload_date: nowIso(),
        created_at: nowIso(),
        task_id: taskId,
        mtd_period_id: mtdPeriodId,
        request_id: requestId && requestId !== documentId ? requestId : null,
      };
      await col("documents").replaceOne({ id: documentId }, { ...record }, { upsert: true });
      uploaded.push(record);
    }

    await logActivity(String(kase.id), `MTD document(s) uploaded (${uploaded.length})`, me);
    if (kase.assigned_accountant_id) {
      await notify(
        String(kase.assigned_accountant_id),
        "Client upload received",
        `${kase.client_name} uploaded ${uploaded.length} MTD document(s)`,
        String(kase.id),
        `/work/cases/${kase.id}`,
        "UPLOAD",
      );
    }

    sendCompatSuccess(
      res,
      {
        ok: true,
        taxReturnId: kase.id,
        documents: uploaded.map((d) => ({
          id: d.id,
          documentType: d.document_type,
          originalFileName: d.name,
          status: "Uploaded",
        })),
      },
      "Uploaded",
    );
  }),
);

/**
 * T3 HIDE/DEFER — periods are created on activation via ensurePeriods.
 * Do not invent HMRC or a parallel period-creation API.
 */
compatMtdRouter.post(
  "/mtd/start-next-quarter",
  auth("CLIENT"),
  handler(async () => {
    throw httpError(405, "Start next quarter is not available in P0 — periods are created on activation");
  }),
);

/**
 * T4 / G3 — map Toxel tax-info FormData onto MTD case docs + best-effort onboarding answers.
 * Never activates SA/MTD or creates entitlements.
 */
compatMtdRouter.post(
  "/client/submit-tax-info",
  auth("CLIENT"),
  upload.any(),
  handler(async (req, res) => {
    const me = authed(req);
    await assertClientCanAccessService(me, MTD);
    const kase = await activeMtdCase(me);
    const body = (req.body ?? {}) as Record<string, string>;
    const files = (req.files as { fieldname?: string; originalname: string; mimetype: string; size: number; buffer: Buffer }[] | undefined) ?? [];

    // Persist questionnaire snapshot (no activation / no new case).
    const snapshot: Doc = {
      ...body,
      submitted_at: nowIso(),
      case_id: kase.id,
    };
    await col("users").updateOne(
      { id: me.id },
      {
        $set: {
          mtd_tax_info_submitted_at: nowIso(),
          mtd_tax_info: snapshot,
          updated_at: nowIso(),
        },
      },
    );

    // Best-effort onboarding map from submittedQuarters JSON.
    let submittedQuarters: string[] = [];
    try {
      const raw = body.submittedQuarters ?? body.submitted_quarters;
      if (raw) submittedQuarters = JSON.parse(String(raw));
    } catch {
      submittedQuarters = [];
    }
    if (Array.isArray(submittedQuarters) && submittedQuarters.length) {
      const periods = await periodsForCase(kase);
      const joined = String(kase.mtd_joined_on ?? kase.created_at ?? nowIso()).slice(0, 10);
      const answers: Doc[] = [];
      for (const q of submittedQuarters) {
        const num = Number(String(q).replace(/\D/g, ""));
        if (!num || num < 1 || num > 4) continue;
        const row = periods.find((p) => p.kind === "QUARTER" && Number(p.quarter) === num);
        if (!row || String(row.period_end) >= joined || row.status === SUBMITTED) continue;
        answers.push({
          quarter: num,
          period_id: row.id,
          status: "SUBMITTED_ELSEWHERE",
          previous_provider: body.whoSubmittedQuarters || body.previousMTDSoftware || "Previous provider",
          submission_date: null,
          submission_reference: null,
          income: null,
          expenses: null,
          document_id: null,
          note: "Mapped from client/submit-tax-info",
          answered_by_name: me.name,
          answered_by_role: me.role,
          answered_at: nowIso(),
          staff_review_status: "PENDING_REVIEW",
        });
      }
      if (answers.length) {
        const existing = (await col("mtd_onboarding").findOne({ case_id: kase.id })) as Doc | null;
        const prior = ((existing?.answers ?? []) as Doc[]).filter(
          (a) => !answers.some((n) => Number(n.quarter) === Number(a.quarter)),
        );
        await col("mtd_onboarding").updateOne(
          { case_id: kase.id },
          {
            $set: {
              answers: [...prior, ...answers].sort((a, b) => Number(a.quarter) - Number(b.quarter)),
              completed_at: nowIso(),
              completed_by_name: me.name,
              updated_at: nowIso(),
            },
            $setOnInsert: {
              case_id: kase.id,
              case_ref: kase.case_ref,
              client_user_id: kase.client_user_id,
              created_at: nowIso(),
            },
          },
          { upsert: true },
        );
      }
    }

    // Upload accompanying documents onto the MTD case.
    const typesRaw = files.map((_, i) => {
      const arr = req.body?.documentTypes;
      if (Array.isArray(arr)) return String(arr[i] ?? "Other");
      if (typeof arr === "string") return arr;
      return "Other";
    });
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.originalname && !file.buffer) continue;
      // Skip non-document fields if multer captured text as files (shouldn't with .any + memory).
      const ext = file.originalname?.includes(".")
        ? file.originalname.split(".").pop()
        : "bin";
      const path = `${APP_NAME}/uploads/${me.id}/${randomUUID()}.${ext}`;
      try {
        validateUpload(file.mimetype || "application/octet-stream", file.size, file.originalname || "doc");
      } catch {
        continue;
      }
      const stored = await putObject(
        path,
        file.buffer,
        file.mimetype || "application/octet-stream",
      );
      await col("documents").insertOne({
        id: randomUUID(),
        case_id: kase.id,
        client_user_id: kase.client_user_id,
        tax_year: kase.tax_year,
        document_type: typesRaw[i] || "Other",
        name: file.originalname || "document",
        status: "Uploaded",
        storage_path: stored.path,
        uploader_id: me.id,
        uploader_name: me.name,
        content_type: file.mimetype,
        size: stored.size ?? file.size,
        is_internal: false,
        is_deleted: false,
        upload_date: nowIso(),
        created_at: nowIso(),
        mtd_period_id: null,
      });
    }

    await logActivity(String(kase.id), "MTD tax info submitted", me);
    sendCompatSuccess(
      res,
      {
        ok: true,
        isTaxInfoSubmitted: true,
        taxReturnId: kase.id,
        caseId: kase.id,
      },
      "Tax information submitted",
    );
  }),
);
