/**
 * Tax return document intake — create categories, upload, verify, completion gate.
 */
import { APP_NAME } from "../config/env";
import {
  CATEGORY_STATUSES,
  CategoryStatus,
  INTAKE_CATEGORY_DEFS,
  INTAKE_COLLECTIONS,
  hashFileBuffer,
  logIntakeAudit,
  nowIso,
  randomUUID,
} from "../domain/taxReturnIntake";
import { getCase } from "../domain/cases";
import { clean, cleanMany, col, Doc } from "../db/mongo";
import { httpError } from "../http/errors";
import { assertDownloadAllowed, scanAndRecord } from "./fileScan";
import { getObject, putObject } from "./storage";

function recomputeMasterStatus(categories: Doc[]): string {
  if (!categories.length) return "NOT_STARTED";
  const actionable = categories.filter((c) => c.status !== "NOT_APPLICABLE");
  if (!actionable.length) return "COMPLETE";
  const allDone = categories.every((c) =>
    ["VERIFIED", "NOT_APPLICABLE"].includes(c.status),
  );
  if (allDone) return "COMPLETE";
  const anyUploaded = categories.some((c) =>
    ["UPLOADED", "VERIFIED"].includes(c.status),
  );
  const awaiting = categories.some((c) => c.status === "UPLOADED");
  const doneOrNa = ["UPLOADED", "VERIFIED", "NOT_APPLICABLE"];
  if (awaiting && categories.every((c) => doneOrNa.includes(c.status))) {
    return "AWAITING_VERIFICATION";
  }
  if (anyUploaded || categories.some((c) => c.status === "AWAITING_REPLACEMENT")) {
    return "IN_PROGRESS";
  }
  return "NOT_STARTED";
}

function progressOf(categories: Doc[]): Doc {
  const total = categories.length;
  const done = categories.filter((c) =>
    ["UPLOADED", "VERIFIED", "NOT_APPLICABLE"].includes(c.status),
  ).length;
  const verified = categories.filter((c) => c.status === "VERIFIED").length;
  const mandatory = categories.filter((c) => c.mandatory);
  const mandatoryOk = mandatory.every((c) =>
    ["UPLOADED", "VERIFIED", "NOT_APPLICABLE"].includes(c.status),
  );
  const mandatoryVerified = mandatory.every((c) =>
    ["VERIFIED", "NOT_APPLICABLE"].includes(c.status),
  );
  return {
    total_categories: total,
    completed_categories: done,
    verified_categories: verified,
    percent: total ? Math.round((done / total) * 100) : 0,
    mandatory_satisfied: mandatoryOk,
    mandatory_verified: mandatoryVerified,
    missing_mandatory: mandatory
      .filter((c) => ["NOT_UPLOADED", "AWAITING_REPLACEMENT"].includes(c.status))
      .map((c) => c.category_name),
  };
}

/**
 * Auto-mapping: category → tax-return preparation section.
 * Used by the working-papers UI and future OCR/AI pipelines.
 */
export function mapCategoryToTaxSection(categoryKey: string): string {
  const def = INTAKE_CATEGORY_DEFS.find((d) => d.key === categoryKey);
  return def?.tax_section || "general";
}

export async function ensureTaxReturnIntake(params: {
  client: Doc;
  tax_year: string;
  case_id?: string | null;
  actor?: Doc | null;
}): Promise<Doc> {
  const caseId = params.case_id ?? null;
  const existing = (await col(INTAKE_COLLECTIONS.masters).findOne({
    client_id: params.client.id,
    tax_year: params.tax_year,
    case_id: caseId,
  })) as Doc | null;

  if (existing) {
    // Keep case link fresh if provided later.
    if (caseId && !existing.case_id) {
      await col(INTAKE_COLLECTIONS.masters).updateOne(
        { id: existing.id },
        {
          $set: {
            case_id: caseId,
            linked_to_tax_return_id: caseId,
            last_updated: nowIso(),
          },
        },
      );
      await col(INTAKE_COLLECTIONS.categories).updateMany(
        { intake_id: existing.id },
        { $set: { case_id: caseId } },
      );
    }
    return decorateIntake(existing.id);
  }

  // Prefer matching by case alone, or adopt an unlinked year intake for this client.
  if (caseId) {
    const byCase = (await col(INTAKE_COLLECTIONS.masters).findOne({
      case_id: caseId,
    })) as Doc | null;
    if (byCase) return decorateIntake(byCase.id);

    const orphan = (await col(INTAKE_COLLECTIONS.masters).findOne({
      client_id: params.client.id,
      tax_year: params.tax_year,
      case_id: null,
    })) as Doc | null;
    if (orphan) {
      await col(INTAKE_COLLECTIONS.masters).updateOne(
        { id: orphan.id },
        {
          $set: {
            case_id: caseId,
            linked_to_tax_return_id: caseId,
            last_updated: nowIso(),
          },
        },
      );
      await col(INTAKE_COLLECTIONS.categories).updateMany(
        { intake_id: orphan.id },
        { $set: { case_id: caseId } },
      );
      return decorateIntake(orphan.id);
    }
  }

  const now = nowIso();
  const intakeId = randomUUID();
  const master: Doc = {
    id: intakeId,
    client_id: params.client.id,
    client_user_id: params.client.user_id ?? null,
    case_id: caseId,
    tax_year: params.tax_year,
    completion_status: "NOT_STARTED",
    last_updated: now,
    linked_to_tax_return_id: caseId,
    created_at: now,
  };
  await col(INTAKE_COLLECTIONS.masters).insertOne({ ...master });

  const categories = INTAKE_CATEGORY_DEFS.map((def) => ({
    id: randomUUID(),
    intake_id: intakeId,
    client_id: params.client.id,
    client_user_id: params.client.user_id ?? null,
    case_id: caseId,
    tax_year: params.tax_year,
    category_key: def.key,
    category_name: def.name,
    description: def.description,
    file_ids: [] as string[],
    status: "NOT_UPLOADED" as CategoryStatus,
    accountant_notes: null,
    mandatory: def.mandatory,
    tax_section: def.tax_section,
    created_at: now,
    updated_at: now,
  }));
  await col(INTAKE_COLLECTIONS.categories).insertMany(categories);

  await logIntakeAudit({
    intake_id: intakeId,
    client_id: params.client.id,
    case_id: caseId,
    actor: params.actor ?? null,
    action: "INTAKE_CREATED",
    meta: { tax_year: params.tax_year, categories: categories.length },
  });

  return decorateIntake(intakeId);
}

/** Called when an SA case is created so categories exist immediately. */
export async function ensureIntakeForCase(kase: Doc, client: Doc, actor?: Doc | null): Promise<void> {
  if (kase.service_type && kase.service_type !== "SELF_ASSESSMENT") return;
  try {
    await ensureTaxReturnIntake({
      client,
      tax_year: kase.tax_year || "2025/26",
      case_id: kase.id,
      actor,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`tax return intake bootstrap skipped: ${String(e)}`);
  }
}

export async function decorateIntake(intakeId: string): Promise<Doc> {
  const master = (await col(INTAKE_COLLECTIONS.masters).findOne({ id: intakeId })) as Doc | null;
  if (!master) throw httpError(404, "Tax return intake not found");
  const categories = cleanMany(
    await col(INTAKE_COLLECTIONS.categories)
      .find({ intake_id: intakeId })
      .toArray(),
  );
  // Stable product order.
  const order = new Map(INTAKE_CATEGORY_DEFS.map((d, i) => [d.key, i]));
  categories.sort(
    (a, b) => (order.get(a.category_key) ?? 99) - (order.get(b.category_key) ?? 99),
  );

  const files = cleanMany(
    await col(INTAKE_COLLECTIONS.files)
      .find({ intake_id: intakeId, is_deleted: { $ne: true } })
      .sort({ uploaded_at: -1 })
      .toArray(),
  );
  const filesByCat: Record<string, Doc[]> = {};
  for (const f of files) {
    const key = f.category_id as string;
    if (!filesByCat[key]) filesByCat[key] = [];
    filesByCat[key].push({
      id: f.id,
      file_name: f.file_name,
      file_size: f.size,
      file_type: f.content_type,
      content_type: f.content_type,
      size: f.size,
      version: f.version,
      uploaded_at: f.uploaded_at,
      uploaded_by_name: f.uploaded_by_name,
      scan_status: f.scan_status || "pending",
      scan_timestamp: f.scan_timestamp || null,
      scanner_notes: f.scanner_notes || null,
      // storage_path never leaves the API for clients/staff list views.
    });
  }

  const cats = categories.map((c) => ({
    ...c,
    files: filesByCat[c.id] || [],
    tax_section_mapping: c.tax_section,
  }));

  return {
    ...clean(master),
    categories: cats,
    progress: progressOf(cats),
    section_mapping: Object.fromEntries(
      INTAKE_CATEGORY_DEFS.map((d) => [d.key, d.tax_section]),
    ),
  };
}

export async function getIntakeForCase(caseId: string, actor: Doc): Promise<Doc> {
  await getCase(caseId, actor);
  const master = (await col(INTAKE_COLLECTIONS.masters).findOne({
    case_id: caseId,
  })) as Doc | null;
  if (!master) {
    const kase = await getCase(caseId, actor);
    const client = (await col("clients").findOne({ id: kase.client_id })) as Doc | null;
    if (!client) throw httpError(404, "Client not found for case");
    return ensureTaxReturnIntake({
      client: clean(client) as Doc,
      tax_year: kase.tax_year,
      case_id: caseId,
      actor,
    });
  }
  return decorateIntake(master.id);
}

export async function uploadToCategory(params: {
  categoryId: string;
  actor: Doc;
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number };
}): Promise<Doc> {
  const category = (await col(INTAKE_COLLECTIONS.categories).findOne({
    id: params.categoryId,
  })) as Doc | null;
  if (!category) throw httpError(404, "Document category not found");

  if (params.actor.role === "CLIENT") {
    if (category.client_user_id !== params.actor.id) {
      throw httpError(403, "Not your document intake");
    }
  } else if (category.case_id) {
    await getCase(category.case_id, params.actor);
  }

  if (category.status === "NOT_APPLICABLE") {
    throw httpError(400, "This category is marked not applicable — clear that first to upload");
  }

  const contentHash = hashFileBuffer(params.file.buffer);
  // Duplicate detection within the same intake.
  const dup = (await col(INTAKE_COLLECTIONS.files).findOne({
    intake_id: category.intake_id,
    content_hash: contentHash,
    is_deleted: { $ne: true },
  })) as Doc | null;
  if (dup) {
    throw httpError(
      409,
      `This file appears to be a duplicate of "${dup.file_name}" already uploaded to this tax return intake`,
    );
  }

  const priorCount = await col(INTAKE_COLLECTIONS.files).countDocuments({
    category_id: category.id,
    is_deleted: { $ne: true },
  });
  const version = priorCount + 1;

  const ext = params.file.originalname.includes(".")
    ? params.file.originalname.split(".").pop()
    : "bin";
  const path = `${APP_NAME}/tax-intake/${category.client_id}/${category.tax_year}/${category.category_key.toLowerCase()}_${randomUUID()}.${ext}`;
  // TODO(security): ensure object storage bucket has encryption at rest enabled.
  const stored = await putObject(
    path,
    params.file.buffer,
    params.file.mimetype || "application/octet-stream",
  );

  const now = nowIso();
  const fileId = randomUUID();
  const scan = await scanAndRecord({
    file_id: fileId,
    source: "intake",
    buffer: params.file.buffer,
    file_name: params.file.originalname,
    file_type: params.file.mimetype,
    file_size: stored.size ?? params.file.size,
    client_id: category.client_id,
    case_id: category.case_id,
    category: category.category_key,
  });
  const fileDoc: Doc = {
    id: fileId,
    intake_id: category.intake_id,
    category_id: category.id,
    client_id: category.client_id,
    case_id: category.case_id,
    category: category.category_key,
    file_name: params.file.originalname,
    file_size: stored.size ?? params.file.size,
    file_type: params.file.mimetype,
    content_type: params.file.mimetype,
    size: stored.size ?? params.file.size,
    storage_path: stored.path,
    content_hash: contentHash,
    version,
    uploaded_by: params.actor.id,
    uploaded_by_name: params.actor.name,
    uploaded_at: now,
    scan_status: scan.scan_status,
    scan_timestamp: scan.scan_timestamp,
    scanner_notes: scan.scanner_notes,
    is_deleted: false,
    // TODO(ocr): enqueue OCR for BANK_STATEMENTS / EMPLOYMENT_RECORDS.
    // TODO(ai): enqueue expense categorisation for OTHER_EXPENSES.
    extraction: null,
  };
  await col(INTAKE_COLLECTIONS.files).insertOne({ ...fileDoc });

  const fileIds = [...(category.file_ids || []), fileDoc.id];
  await col(INTAKE_COLLECTIONS.categories).updateOne(
    { id: category.id },
    {
      $set: {
        file_ids: fileIds,
        status: "UPLOADED",
        updated_at: now,
      },
    },
  );

  await refreshMasterStatus(category.intake_id);
  await logIntakeAudit({
    intake_id: category.intake_id,
    client_id: category.client_id,
    case_id: category.case_id,
    actor: params.actor,
    action: "FILE_UPLOADED",
    meta: {
      category_key: category.category_key,
      file_id: fileDoc.id,
      tax_section: category.tax_section,
    },
  });

  // Also mirror into the general documents collection for case Documents tab visibility.
  if (category.case_id) {
    await col("documents").insertOne({
      id: randomUUID(),
      case_id: category.case_id,
      client_user_id: category.client_user_id,
      tax_year: category.tax_year,
      document_type: category.category_name,
      name: params.file.originalname,
      status: "Uploaded",
      storage_path: stored.path,
      uploader_id: params.actor.id,
      uploader_name: params.actor.name,
      content_type: params.file.mimetype,
      size: stored.size ?? params.file.size,
      is_internal: false,
      is_deleted: false,
      upload_date: now,
      created_at: now,
      intake_category_id: category.id,
      intake_file_id: fileDoc.id,
      tax_section: category.tax_section,
      scan_status: scan.scan_status,
      scan_timestamp: scan.scan_timestamp,
      scanner_notes: scan.scanner_notes,
    });
  }

  return decorateIntake(category.intake_id);
}

async function refreshMasterStatus(intakeId: string): Promise<void> {
  const categories = await col(INTAKE_COLLECTIONS.categories)
    .find({ intake_id: intakeId })
    .toArray();
  const status = recomputeMasterStatus(categories);
  await col(INTAKE_COLLECTIONS.masters).updateOne(
    { id: intakeId },
    { $set: { completion_status: status, last_updated: nowIso() } },
  );
}

export async function updateCategoryStatus(params: {
  categoryId: string;
  actor: Doc;
  status?: CategoryStatus;
  accountant_notes?: string | null;
}): Promise<Doc> {
  const category = (await col(INTAKE_COLLECTIONS.categories).findOne({
    id: params.categoryId,
  })) as Doc | null;
  if (!category) throw httpError(404, "Document category not found");

  if (params.actor.role === "CLIENT") {
    // Clients may only mark NOT_APPLICABLE / clear notes-less status to NOT_UPLOADED.
    if (params.status && !["NOT_APPLICABLE", "NOT_UPLOADED"].includes(params.status)) {
      throw httpError(403, "Only staff can verify uploads");
    }
    if (category.client_user_id !== params.actor.id) throw httpError(403, "Not your intake");
  } else if (category.case_id) {
    await getCase(category.case_id, params.actor);
  }
  if (params.status === "AWAITING_REPLACEMENT") {
    throw httpError(400, "Use Request Alternative Document to mark awaiting replacement");
  }

  if (params.status && !CATEGORY_STATUSES.includes(params.status)) {
    throw httpError(422, `Invalid status ${params.status}`);
  }
  if (params.status === "VERIFIED" && !(category.file_ids || []).length && category.status !== "NOT_APPLICABLE") {
    // Allow verify of N/A; otherwise need files unless already N/A→verified path
    if (params.status === "VERIFIED") {
      const hasFiles = await col(INTAKE_COLLECTIONS.files).countDocuments({
        category_id: category.id,
        is_deleted: { $ne: true },
      });
      if (!hasFiles) throw httpError(400, "Cannot verify a category with no uploaded files");
    }
  }

  const now = nowIso();
  const patch: Doc = { updated_at: now };
  if (params.status) {
    if (params.status === "NOT_APPLICABLE") {
      patch.status = "NOT_APPLICABLE";
    } else if (params.status === "NOT_UPLOADED") {
      patch.status = "NOT_UPLOADED";
    } else {
      patch.status = params.status;
    }
  }
  if (params.accountant_notes !== undefined) {
    if (params.actor.role === "CLIENT") {
      throw httpError(403, "Only staff can edit accountant notes");
    }
    patch.accountant_notes = params.accountant_notes;
  }

  await col(INTAKE_COLLECTIONS.categories).updateOne({ id: category.id }, { $set: patch });
  await refreshMasterStatus(category.intake_id);
  await logIntakeAudit({
    intake_id: category.intake_id,
    client_id: category.client_id,
    case_id: category.case_id,
    actor: params.actor,
    action: "CATEGORY_UPDATED",
    meta: patch,
  });

  // When all mandatory are verified/N/A, mark complete.
  const decorated = await decorateIntake(category.intake_id);
  if (decorated.progress?.mandatory_verified) {
    await col(INTAKE_COLLECTIONS.masters).updateOne(
      { id: category.intake_id },
      { $set: { completion_status: "COMPLETE", last_updated: nowIso() } },
    );
    decorated.completion_status = "COMPLETE";
  }
  return decorateIntake(category.intake_id);
}

export async function getIntakeFile(
  fileId: string,
  actor: Doc,
  options: { confirmRisk?: boolean } = {},
): Promise<{ data: Buffer; contentType: string; fileName: string; scan_status: string }> {
  const file = (await col(INTAKE_COLLECTIONS.files).findOne({
    id: fileId,
    is_deleted: { $ne: true },
  })) as Doc | null;
  if (!file) throw httpError(404, "File not found");
  if (actor.role === "CLIENT") {
    if (file.uploaded_by !== actor.id) {
      const cat = (await col(INTAKE_COLLECTIONS.categories).findOne({
        id: file.category_id,
      })) as Doc | null;
      if (!cat || cat.client_user_id !== actor.id) throw httpError(403, "Not your file");
    }
  } else if (file.case_id) {
    await getCase(file.case_id, actor);
  } else if (!["ADMIN", "SUPER_ADMIN", "ACCOUNTANT"].includes(actor.role)) {
    throw httpError(403, "Insufficient permissions");
  }
  await assertDownloadAllowed({
    file_id: fileId,
    source: "intake",
    scan_status: file.scan_status,
    actor,
    confirmRisk: options.confirmRisk,
  });
  const stored = await getObject(file.storage_path);
  await logIntakeAudit({
    intake_id: file.intake_id,
    client_id: file.client_id,
    case_id: file.case_id,
    actor,
    action: "FILE_VIEWED",
    meta: { file_id: fileId, scan_status: file.scan_status },
  });
  return {
    data: stored.data,
    contentType: stored.contentType,
    fileName: file.file_name,
    scan_status: (file.scan_status as string) || "pending",
  };
}

/**
 * Gate: admin review / HMRC submission requires mandatory categories
 * uploaded (or N/A). Full COMPLETE prefers accountant verification.
 */
export async function assertIntakeReadyForReview(caseId: string): Promise<void> {
  const master = (await col(INTAKE_COLLECTIONS.masters).findOne({
    case_id: caseId,
  })) as Doc | null;
  if (!master) {
    // No intake yet — create will happen on next GET; block until categories exist & satisfied.
    throw httpError(
      400,
      "Tax return document intake is not ready — open Document Intake and complete mandatory categories",
    );
  }
  const categories = await col(INTAKE_COLLECTIONS.categories)
    .find({ intake_id: master.id })
    .toArray();
  const missing = categories.filter(
    (c) => c.mandatory && c.status === "NOT_UPLOADED",
  );
  if (missing.length) {
    throw httpError(
      400,
      `Missing mandatory tax documents: ${missing.map((m) => m.category_name).join(", ")}. Upload them or mark Not applicable.`,
    );
  }
}

export async function assertIntakeVerified(caseId: string): Promise<void> {
  await assertIntakeReadyForReview(caseId);
  const master = (await col(INTAKE_COLLECTIONS.masters).findOne({
    case_id: caseId,
  })) as Doc | null;
  if (!master) return;
  const categories = await col(INTAKE_COLLECTIONS.categories)
    .find({ intake_id: master.id })
    .toArray();
  const unverified = categories.filter(
    (c) => c.mandatory && !["VERIFIED", "NOT_APPLICABLE"].includes(c.status),
  );
  if (unverified.length) {
    throw httpError(
      400,
      `Mandatory document categories awaiting accountant verification: ${unverified
        .map((u) => u.category_name)
        .join(", ")}`,
    );
  }
}

export async function intakeDashboard(actor: Doc): Promise<Doc> {
  const caseFilter: Doc = {};
  if (actor.role === "ACCOUNTANT") {
    const cases = await col("cases")
      .find(
        { assigned_accountant_id: actor.id, service_type: "SELF_ASSESSMENT" },
        { projection: { id: 1 } },
      )
      .toArray();
    caseFilter.case_id = { $in: cases.map((c) => c.id) };
  } else {
    caseFilter.case_id = { $ne: null };
  }

  const masters = await col(INTAKE_COLLECTIONS.masters)
    .find({ ...caseFilter, completion_status: { $ne: "COMPLETE" } })
    .sort({ last_updated: -1 })
    .limit(100)
    .toArray();

  const missingDocs: Doc[] = [];
  const blocked: Doc[] = [];

  for (const m of masters) {
    const cats = await col(INTAKE_COLLECTIONS.categories)
      .find({ intake_id: m.id })
      .toArray();
    const missing = cats.filter((c) => c.mandatory && c.status === "NOT_UPLOADED");
    const kase = m.case_id
      ? ((await col("cases").findOne({ id: m.case_id })) as Doc | null)
      : null;
    const client = (await col("clients").findOne({ id: m.client_id })) as Doc | null;
    const row = {
      intake_id: m.id,
      case_id: m.case_id,
      case_ref: kase?.case_ref ?? null,
      client_name: client?.name ?? kase?.client_name ?? null,
      tax_year: m.tax_year,
      completion_status: m.completion_status,
      missing_mandatory: missing.map((x) => x.category_name),
      case_status: kase?.status ?? null,
    };
    if (missing.length) missingDocs.push(row);
    if (
      missing.length &&
      kase &&
      ["IN_PREPARATION", "READY_FOR_ADMIN_REVIEW", "ADMIN_REVIEW"].includes(kase.status)
    ) {
      blocked.push(row);
    }
  }

  return {
    missing_documents: missingDocs,
    blocked_returns: blocked,
    counts: {
      missing_documents: missingDocs.length,
      blocked_returns: blocked.length,
      incomplete_intakes: masters.length,
    },
  };
}
