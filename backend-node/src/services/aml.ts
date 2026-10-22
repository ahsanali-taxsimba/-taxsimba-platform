/**
 * AML / KYC business logic: case lifecycle, uploads, review, activation gate.
 */
import {
  AML_COLLECTIONS,
  AML_DOC_TYPES,
  AML_RISK_LEVELS,
  AmlCaseStatus,
  AmlDocType,
  AmlRiskLevel,
  REQUIRED_PROOF_OF_ADDRESS,
  defaultNextReviewDue,
  isoPlusYears,
  logAmlAudit,
  nowIso,
  randomUUID,
} from "../domain/aml";
import { APP_NAME } from "../config/env";
import { clean, cleanMany, col, Doc } from "../db/mongo";
import { httpError } from "../http/errors";
import { notify } from "../domain/workflow";
import { assertDownloadAllowed, scanAndRecord } from "./fileScan";
import { getObject, putObject } from "./storage";

/** Pure progress helper — live photo is optional so signup can continue without it. */
export function computeAmlProgress(
  amlCase: Doc,
  documents: Doc[],
): {
  id_uploaded: boolean;
  proof_of_address_uploaded: boolean;
  proof_of_address_count: number;
  proof_of_address_required: number;
  live_photo_captured: boolean;
  live_photo_deferred: boolean;
  live_photo_required_for_submit: boolean;
  profile_complete: boolean;
  ready_to_submit: boolean;
} {
  const poa = documents.filter((d) => d.type === "PROOF_OF_ADDRESS");
  const hasPassport = documents.some((d) => d.type === "PASSPORT");
  const hasLicenceFront = documents.some((d) => d.type === "DRIVING_LICENCE_FRONT");
  const hasLicenceBack = documents.some((d) => d.type === "DRIVING_LICENCE_BACK");
  const hasSelfie = documents.some((d) => d.type === "SELFIE");
  const idComplete = hasPassport || (hasLicenceFront && hasLicenceBack);
  const addressComplete = poa.length >= REQUIRED_PROOF_OF_ADDRESS;
  return {
    id_uploaded: idComplete,
    proof_of_address_uploaded: addressComplete,
    proof_of_address_count: poa.length,
    proof_of_address_required: REQUIRED_PROOF_OF_ADDRESS,
    live_photo_captured: hasSelfie,
    live_photo_deferred: Boolean(amlCase.live_photo_deferred) && !hasSelfie,
    live_photo_required_for_submit: false,
    profile_complete: Boolean(amlCase.date_of_birth && amlCase.residential_address),
    ready_to_submit: idComplete && addressComplete && Boolean(amlCase.date_of_birth),
  };
}

// ---------------------------------------------------------------------------
// Case lifecycle
// ---------------------------------------------------------------------------

export async function createAmlCase(
  client: Doc,
  opts: { actor?: Doc | null; force?: boolean } = {},
): Promise<Doc> {
  const existing = (await col(AML_COLLECTIONS.cases).findOne(
    {
      client_id: client.id,
      status: { $nin: ["REJECTED"] },
    },
    { sort: { created_at: -1 } },
  )) as Doc | null;

  if (existing && !opts.force) {
    if (["APPROVED", "IN_PROGRESS", "SUBMITTED", "IN_REVIEW", "REQUIRES_REUPLOAD", "NOT_STARTED"].includes(existing.status)) {
      return decorateAmlCase(existing.id);
    }
  }

  if (existing && opts.force && existing.status !== "APPROVED") {
    await col(AML_COLLECTIONS.cases).updateOne(
      { id: existing.id },
      { $set: { status: "REJECTED", updated_at: nowIso(), rejection_reason: "Superseded by new case" } },
    );
  }

  const now = nowIso();
  const amlCase: Doc = {
    id: randomUUID(),
    client_id: client.id,
    client_user_id: client.user_id ?? null,
    status: "NOT_STARTED" as AmlCaseStatus,
    risk_level: null,
    client_type: "INDIVIDUAL",
    full_name: client.name ?? null,
    date_of_birth: client.date_of_birth ?? null,
    residential_address: client.address ?? null,
    country_of_residence: client.country_of_residence ?? "United Kingdom",
    occupation: client.occupation ?? null,
    source_of_funds_note: null,
    complexity_note: null,
    services_complexity: null,
    edd_required: false,
    next_review_due: null,
    id_document_kind: null,
    proof_of_address_count: 0,
    has_selfie: false,
    live_photo_deferred: false,
    submitted_at: null,
    reviewed_at: null,
    reviewer_id: null,
    reviewer_name: null,
    rejection_reason: null,
    reupload_message: null,
    created_at: now,
    updated_at: now,
  };

  await col(AML_COLLECTIONS.cases).insertOne({ ...amlCase });
  await col("clients").updateOne(
    { id: client.id },
    {
      $set: {
        aml_status: "REQUIRED",
        aml_case_id: amlCase.id,
        updated_at: now,
      },
    },
  );
  await logAmlAudit({
    aml_case_id: amlCase.id,
    client_id: client.id,
    actor: opts.actor ?? null,
    action: "CASE_CREATED",
    meta: { note: "AML/KYC check required for new client" },
  });

  return decorateAmlCase(amlCase.id);
}

/** Ensure every client has an open AML case (idempotent). */
export async function ensureAmlCase(client: Doc, actor?: Doc | null): Promise<Doc> {
  const approved = (await col(AML_COLLECTIONS.cases).findOne({
    client_id: client.id,
    status: "APPROVED",
  })) as Doc | null;
  if (approved) return decorateAmlCase(approved.id);

  const open = (await col(AML_COLLECTIONS.cases).findOne(
    {
      client_id: client.id,
      status: {
        $in: ["NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "IN_REVIEW", "REQUIRES_REUPLOAD"],
      },
    },
    { sort: { created_at: -1 } },
  )) as Doc | null;
  if (open) return decorateAmlCase(open.id);
  return createAmlCase(client, { actor });
}

export async function getAmlCase(id: string): Promise<Doc> {
  const row = (await col(AML_COLLECTIONS.cases).findOne({ id })) as Doc | null;
  if (!row) throw httpError(404, "AML case not found");
  return clean(row) as Doc;
}

export async function decorateAmlCase(id: string): Promise<Doc> {
  const amlCase = await getAmlCase(id);
  const documents = cleanMany(
    await col(AML_COLLECTIONS.documents)
      .find({ aml_case_id: id })
      .sort({ uploaded_at: 1 })
      .toArray(),
  );
  // Never return storage paths to CLIENT role via this helper when scrubbing — staff need file_id for download.
  const checks = cleanMany(
    await col(AML_COLLECTIONS.checks)
      .find({ aml_case_id: id })
      .sort({ reviewed_at: -1 })
      .toArray(),
  );
  const screening = cleanMany(
    await col(AML_COLLECTIONS.screening)
      .find({ aml_case_id: id })
      .sort({ checked_at: -1 })
      .limit(5)
      .toArray(),
  );

  const progress = computeAmlProgress(amlCase, documents);

  return {
    ...amlCase,
    documents: documents.map((d) => ({
      id: d.id,
      type: d.type,
      file_name: d.file_name,
      file_size: d.size,
      file_type: d.content_type,
      content_type: d.content_type,
      size: d.size,
      uploaded_at: d.uploaded_at,
      notes: d.notes,
      scan_status: d.scan_status || "pending",
      scan_timestamp: d.scan_timestamp || null,
      scanner_notes: d.scanner_notes || null,
      replacement_requested: Boolean(d.replacement_requested),
      // Clients never receive the raw storage key — download via /aml/documents/:id/file.
      has_file: true,
    })),
    // Staff download uses dedicated endpoint with file_id lookup by document id.
    _documents_internal: documents,
    checks,
    screening,
    progress,
  };
}

/** Staff-facing decorate that includes downloadable document ids (not storage keys). */
export async function decorateAmlCaseForStaff(id: string): Promise<Doc> {
  const decorated = await decorateAmlCase(id);
  const docs = decorated._documents_internal as Doc[];
  delete decorated._documents_internal;
  decorated.documents = docs.map((d) => ({
    id: d.id,
    type: d.type,
    file_name: d.file_name,
    file_size: d.size,
    file_type: d.content_type,
    content_type: d.content_type,
    size: d.size,
    uploaded_at: d.uploaded_at,
    notes: d.notes,
    scan_status: d.scan_status || "pending",
    scan_timestamp: d.scan_timestamp || null,
    scanner_notes: d.scanner_notes || null,
    replacement_requested: Boolean(d.replacement_requested),
  }));
  const client = (await col("clients").findOne({ id: decorated.client_id })) as Doc | null;
  decorated.client = client
    ? {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        address: client.address,
        client_ref: client.client_ref,
        date_of_birth: client.date_of_birth ?? decorated.date_of_birth,
      }
    : null;
  return decorated;
}

export async function updateAmlProfile(
  caseId: string,
  client: Doc,
  input: {
    date_of_birth?: string | null;
    residential_address?: string | null;
    country_of_residence?: string | null;
    occupation?: string | null;
    source_of_funds_note?: string | null;
    complexity_note?: string | null;
    client_type?: "INDIVIDUAL" | "COMPANY";
    id_document_kind?: "PASSPORT" | "DRIVING_LICENCE" | null;
  },
  actor: Doc,
): Promise<Doc> {
  const amlCase = await getAmlCase(caseId);
  if (amlCase.client_id !== client.id) throw httpError(403, "Not your AML case");
  if (["APPROVED", "SUBMITTED", "IN_REVIEW"].includes(amlCase.status)) {
    throw httpError(400, "AML case cannot be edited in its current status");
  }

  const now = nowIso();
  const patch: Doc = {
    updated_at: now,
    status: amlCase.status === "NOT_STARTED" ? "IN_PROGRESS" : amlCase.status,
  };
  for (const key of [
    "date_of_birth",
    "residential_address",
    "country_of_residence",
    "occupation",
    "source_of_funds_note",
    "complexity_note",
    "client_type",
    "id_document_kind",
  ] as const) {
    if (input[key] !== undefined) patch[key] = input[key];
  }
  if (input.residential_address) {
    await col("clients").updateOne(
      { id: client.id },
      { $set: { address: input.residential_address, date_of_birth: input.date_of_birth ?? client.date_of_birth, updated_at: now } },
    );
  } else if (input.date_of_birth) {
    await col("clients").updateOne(
      { id: client.id },
      { $set: { date_of_birth: input.date_of_birth, updated_at: now } },
    );
  }

  await col(AML_COLLECTIONS.cases).updateOne({ id: caseId }, { $set: patch });
  await logAmlAudit({
    aml_case_id: caseId,
    client_id: client.id,
    actor,
    action: "PROFILE_UPDATED",
    meta: patch,
  });
  return decorateAmlCase(caseId);
}

// ---------------------------------------------------------------------------
// Document upload
// ---------------------------------------------------------------------------

export async function uploadAmlDocument(params: {
  caseId: string;
  client: Doc;
  actor: Doc;
  type: AmlDocType;
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number };
  notes?: string | null;
}): Promise<Doc> {
  if (!AML_DOC_TYPES.includes(params.type)) {
    throw httpError(422, `Unknown AML document type ${params.type}`);
  }
  const amlCase = await getAmlCase(params.caseId);
  if (amlCase.client_id !== params.client.id && params.actor.role === "CLIENT") {
    throw httpError(403, "Not your AML case");
  }
  // Selfie / live photo may be uploaded later (during review or after approval) so signup can continue.
  const deferSelfieUpload =
    params.type === "SELFIE" &&
    ["SUBMITTED", "IN_REVIEW", "APPROVED"].includes(amlCase.status);
  if (
    ["APPROVED", "SUBMITTED", "IN_REVIEW"].includes(amlCase.status) &&
    params.actor.role === "CLIENT" &&
    !deferSelfieUpload
  ) {
    throw httpError(400, "Cannot upload documents while the case is under review or approved");
  }
  if (amlCase.status === "REJECTED") {
    throw httpError(400, "This AML case was rejected — start a new case or await re-upload request");
  }

  // Proof of address: allow multiple; ID types: replace prior of same type.
  if (params.type !== "PROOF_OF_ADDRESS") {
    const prior = await col(AML_COLLECTIONS.documents)
      .find({ aml_case_id: params.caseId, type: params.type })
      .toArray();
    for (const p of prior) {
      await col(AML_COLLECTIONS.documents).deleteOne({ id: p.id });
      // TODO(security): securely delete prior object from storage after retention rules allow.
    }
  } else {
    const poaCount = await col(AML_COLLECTIONS.documents).countDocuments({
      aml_case_id: params.caseId,
      type: "PROOF_OF_ADDRESS",
    });
    if (poaCount >= 5) {
      throw httpError(400, "Maximum number of proof-of-address documents reached");
    }
  }

  const ext = params.file.originalname.includes(".")
    ? params.file.originalname.split(".").pop()
    : "bin";
  const path = `${APP_NAME}/aml/${params.client.id}/${params.type.toLowerCase()}_${randomUUID()}.${ext}`;
  const stored = await putObject(
    path,
    params.file.buffer,
    params.file.mimetype || "application/octet-stream",
  );

  const now = nowIso();
  const docId = randomUUID();
  const scan = await scanAndRecord({
    file_id: docId,
    source: "aml",
    buffer: params.file.buffer,
    file_name: params.file.originalname,
    file_type: params.file.mimetype,
    file_size: stored.size ?? params.file.size,
    client_id: params.client.id,
    case_id: null,
    category: params.type,
  });
  const doc: Doc = {
    id: docId,
    aml_case_id: params.caseId,
    client_id: params.client.id,
    category: params.type,
    type: params.type,
    file_id: stored.path,
    file_name: params.file.originalname,
    file_size: stored.size ?? params.file.size,
    file_type: params.file.mimetype,
    content_type: params.file.mimetype,
    size: stored.size ?? params.file.size,
    uploaded_at: now,
    uploaded_by: params.actor.id,
    notes: params.notes ?? null,
    scan_status: scan.scan_status,
    scan_timestamp: scan.scan_timestamp,
    scanner_notes: scan.scanner_notes,
    replacement_requested: false,
    // Placeholder retention mark — MLRO should confirm from relationship end date.
    retain_until: isoPlusYears(5),
  };
  await col(AML_COLLECTIONS.documents).insertOne({ ...doc });

  const poaCount = await col(AML_COLLECTIONS.documents).countDocuments({
    aml_case_id: params.caseId,
    type: "PROOF_OF_ADDRESS",
  });
  const hasSelfie = Boolean(
    await col(AML_COLLECTIONS.documents).findOne({ aml_case_id: params.caseId, type: "SELFIE" }),
  );

  await col(AML_COLLECTIONS.cases).updateOne(
    { id: params.caseId },
    {
      $set: {
        proof_of_address_count: poaCount,
        has_selfie: hasSelfie,
        ...(hasSelfie ? { live_photo_deferred: false } : {}),
        status:
          amlCase.status === "NOT_STARTED" || amlCase.status === "REQUIRES_REUPLOAD"
            ? "IN_PROGRESS"
            : amlCase.status,
        updated_at: now,
        ...(params.type === "PASSPORT" ? { id_document_kind: "PASSPORT" } : {}),
        ...(params.type.startsWith("DRIVING_LICENCE")
          ? { id_document_kind: "DRIVING_LICENCE" }
          : {}),
      },
    },
  );

  if (deferSelfieUpload && params.type === "SELFIE") {
    for (const admin of await col("users")
      .find({ role: { $in: ["ADMIN", "SUPER_ADMIN", "ACCOUNTANT"] }, is_active: true })
      .limit(20)
      .toArray()) {
      await notify(
        admin.id as string,
        "AML live photo uploaded",
        `${params.client.name || "Client"} uploaded their live photo / selfie after deferring it.`,
        null,
        admin.role === "ACCOUNTANT" ? `/work/aml/${params.caseId}` : `/admin/aml/${params.caseId}`,
        "REVIEW",
      );
    }
  }

  await logAmlAudit({
    aml_case_id: params.caseId,
    client_id: params.client.id,
    actor: params.actor,
    action: "DOCUMENT_UPLOADED",
    meta: { type: params.type, document_id: doc.id },
  });

  return decorateAmlCase(params.caseId);
}

export async function getAmlDocumentFile(
  documentId: string,
  actor: Doc,
  options: { confirmRisk?: boolean } = {},
): Promise<{ data: Buffer; contentType: string; fileName: string; scan_status: string }> {
  if (!["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"].includes(actor.role)) {
    // Clients may fetch their own selfie/ID for preview during onboarding only.
    if (actor.role !== "CLIENT") throw httpError(403, "Insufficient permissions");
  }
  const doc = (await col(AML_COLLECTIONS.documents).findOne({ id: documentId })) as Doc | null;
  if (!doc) throw httpError(404, "AML document not found");
  if (actor.role === "CLIENT" && doc.uploaded_by !== actor.id) {
    const amlCase = await getAmlCase(doc.aml_case_id);
    if (amlCase.client_user_id !== actor.id) throw httpError(403, "Not your document");
  }
  await assertDownloadAllowed({
    file_id: documentId,
    source: "aml",
    scan_status: doc.scan_status,
    actor,
    confirmRisk: options.confirmRisk,
  });
  const stored = await getObject(doc.file_id);
  await logAmlAudit({
    aml_case_id: doc.aml_case_id,
    client_id: doc.client_id,
    actor,
    action: "DOCUMENT_VIEWED",
    meta: { document_id: documentId, type: doc.type, scan_status: doc.scan_status },
  });
  return {
    data: stored.data,
    contentType: stored.contentType,
    fileName: doc.file_name,
    scan_status: (doc.scan_status as string) || "pending",
  };
}

// ---------------------------------------------------------------------------
// Submit for review / staff decision
// ---------------------------------------------------------------------------

export async function submitAmlCase(caseId: string, client: Doc, actor: Doc): Promise<Doc> {
  const decorated = await decorateAmlCase(caseId);
  if (decorated.client_id !== client.id) throw httpError(403, "Not your AML case");
  if (!decorated.progress?.ready_to_submit) {
    throw httpError(
      400,
      "Please complete identity document, two proofs of address, and date of birth before submitting. Live photo can be uploaded later.",
    );
  }
  if (!["IN_PROGRESS", "REQUIRES_REUPLOAD", "NOT_STARTED"].includes(decorated.status)) {
    throw httpError(400, `Cannot submit AML case in status ${decorated.status}`);
  }

  const now = nowIso();
  const hasSelfie = Boolean(decorated.progress?.live_photo_captured);
  await col(AML_COLLECTIONS.cases).updateOne(
    { id: caseId },
    {
      $set: {
        status: "SUBMITTED",
        submitted_at: now,
        updated_at: now,
        live_photo_deferred: !hasSelfie,
        has_selfie: hasSelfie,
      },
    },
  );
  await col("clients").updateOne(
    { id: client.id },
    { $set: { aml_status: "PENDING_REVIEW", updated_at: now } },
  );
  await logAmlAudit({
    aml_case_id: caseId,
    client_id: client.id,
    actor,
    action: "CASE_SUBMITTED",
  });

  // Notify staff.
  for (const admin of await col("users")
    .find({ role: { $in: ["ADMIN", "SUPER_ADMIN", "ACCOUNTANT"] }, is_active: true })
    .limit(20)
    .toArray()) {
    await notify(
      admin.id as string,
      "AML case pending review",
      `${client.name || "Client"} has submitted identity documents for AML review.`,
      null,
      admin.role === "ACCOUNTANT" ? "/work/aml" : "/admin/aml",
      "REVIEW",
    );
  }

  // TODO(pep): trigger async PEP/sanctions screening job here.
  await recordScreeningStub(caseId, client.id, actor);

  return decorateAmlCase(caseId);
}

/**
 * Stub PEP/sanctions screening — stores a placeholder result.
 * TODO(pep): integrate ComplyAdvantage / Dow Jones / World-Check (or FCA-approved provider).
 */
export async function recordScreeningStub(
  caseId: string,
  clientId: string,
  actor: Doc | null,
): Promise<Doc> {
  const now = nowIso();
  const row: Doc = {
    id: randomUUID(),
    aml_case_id: caseId,
    client_id: clientId,
    provider: "STUB",
    check_type: "PEP_SANCTIONS",
    status: "NOT_RUN",
    result: "PENDING_INTEGRATION",
    matched: false,
    raw: { note: "External PEP/sanctions API not configured" },
    checked_at: now,
    checked_by: actor?.id ?? null,
  };
  await col(AML_COLLECTIONS.screening).insertOne({ ...row });
  await logAmlAudit({
    aml_case_id: caseId,
    client_id: clientId,
    actor,
    action: "SCREENING_STUB_RECORDED",
  });
  return clean(row) as Doc;
}

export async function reviewAmlCase(
  caseId: string,
  reviewer: Doc,
  input: {
    decision: "APPROVED" | "REJECTED" | "REQUIRES_REUPLOAD";
    risk_level: AmlRiskLevel;
    comments?: string | null;
    checklist: {
      id_matches_client: boolean;
      address_docs_valid_and_recent: boolean;
      selfie_matches_id: boolean;
      pep_sanctions_cleared?: boolean | null;
    };
    edd_required?: boolean;
    reupload_message?: string | null;
  },
): Promise<Doc> {
  if (!["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"].includes(reviewer.role)) {
    throw httpError(403, "Only authorised staff can review AML cases");
  }
  if (!AML_RISK_LEVELS.includes(input.risk_level)) {
    throw httpError(422, "Invalid risk_level");
  }

  const amlCase = await getAmlCase(caseId);
  if (!["SUBMITTED", "IN_REVIEW"].includes(amlCase.status)) {
    // Allow moving SUBMITTED → IN_REVIEW implicitly on first open; also accept direct review.
    if (amlCase.status !== "IN_PROGRESS") {
      // Still allow review of SUBMITTED
    }
  }
  if (!["SUBMITTED", "IN_REVIEW", "IN_PROGRESS"].includes(amlCase.status)) {
    throw httpError(400, `Cannot review AML case in status ${amlCase.status}`);
  }

  if (input.decision === "APPROVED") {
    const { checklist } = input;
    if (!checklist.id_matches_client || !checklist.address_docs_valid_and_recent) {
      throw httpError(400, "Identity and address checklist items must be confirmed to approve");
    }
    const hasSelfie = Boolean(
      await col(AML_COLLECTIONS.documents).findOne({ aml_case_id: caseId, type: "SELFIE" }),
    );
    // Live photo check is required only when a selfie is already on file.
    if (hasSelfie && !checklist.selfie_matches_id) {
      throw httpError(400, "Confirm the live photo matches the ID photograph before approving");
    }
  }

  const now = nowIso();
  const check: Doc = {
    id: randomUUID(),
    aml_case_id: caseId,
    checklist: {
      id_matches_client: input.checklist.id_matches_client,
      address_docs_valid_and_recent: input.checklist.address_docs_valid_and_recent,
      selfie_matches_id: input.checklist.selfie_matches_id,
      pep_sanctions_cleared: input.checklist.pep_sanctions_cleared ?? null,
    },
    decision: input.decision,
    risk_level: input.risk_level,
    comments: input.comments ?? null,
    reviewer_id: reviewer.id,
    reviewer_name: reviewer.name,
    reviewed_at: now,
  };
  await col(AML_COLLECTIONS.checks).insertOne({ ...check });

  const edd = Boolean(input.edd_required) || input.risk_level === "HIGH";
  const casePatch: Doc = {
    status: input.decision === "REQUIRES_REUPLOAD" ? "REQUIRES_REUPLOAD" : input.decision,
    risk_level: input.risk_level,
    edd_required: edd,
    reviewed_at: now,
    reviewer_id: reviewer.id,
    reviewer_name: reviewer.name,
    rejection_reason: input.decision === "REJECTED" ? input.comments ?? "Rejected" : null,
    reupload_message:
      input.decision === "REQUIRES_REUPLOAD" ? input.reupload_message || input.comments : null,
    updated_at: now,
  };
  if (input.decision === "APPROVED") {
    casePatch.next_review_due = defaultNextReviewDue(input.risk_level);
  }
  await col(AML_COLLECTIONS.cases).updateOne({ id: caseId }, { $set: casePatch });

  const clientAmlStatus =
    input.decision === "APPROVED"
      ? "COMPLIANT"
      : input.decision === "REQUIRES_REUPLOAD"
        ? "REQUIRES_REUPLOAD"
        : "REJECTED";
  await col("clients").updateOne(
    { id: amlCase.client_id },
    {
      $set: {
        aml_status: clientAmlStatus,
        aml_risk_level: input.risk_level,
        aml_case_id: caseId,
        aml_reviewed_at: now,
        updated_at: now,
      },
    },
  );

  await logAmlAudit({
    aml_case_id: caseId,
    client_id: amlCase.client_id,
    actor: reviewer,
    action: `CASE_${input.decision}`,
    meta: { risk_level: input.risk_level, edd_required: edd, check_id: check.id },
  });

  if (amlCase.client_user_id) {
    const title =
      input.decision === "APPROVED"
        ? "Identity verification approved"
        : input.decision === "REQUIRES_REUPLOAD"
          ? "Additional identity documents required"
          : "Identity verification not approved";
    const body =
      input.decision === "APPROVED"
        ? "Your AML/KYC check is complete. You can now activate services."
        : input.comments || "Please contact us or re-submit documents from the AML page.";
    await notify(
      amlCase.client_user_id,
      title,
      body,
      null,
      "/aml",
      input.decision === "APPROVED" ? "INFO" : "CHANGES",
    );
  }

  return decorateAmlCaseForStaff(caseId);
}

// ---------------------------------------------------------------------------
// Lists / dashboard / gate
// ---------------------------------------------------------------------------

export async function listAmlCases(filters: {
  status?: string;
  pending?: boolean;
  overdue?: boolean;
}): Promise<Doc[]> {
  const q: Doc = {};
  if (filters.pending) {
    q.status = { $in: ["SUBMITTED", "IN_REVIEW"] };
  } else if (filters.status) {
    q.status = filters.status;
  }
  if (filters.overdue) {
    q.status = "APPROVED";
    q.next_review_due = { $lte: nowIso() };
  }

  const rows = await col(AML_COLLECTIONS.cases)
    .find(q)
    .sort({ updated_at: -1 })
    .limit(100)
    .toArray();

  const out: Doc[] = [];
  for (const row of rows) {
    const client = (await col("clients").findOne({ id: row.client_id })) as Doc | null;
    out.push({
      ...clean(row),
      client_name: client?.name ?? null,
      client_ref: client?.client_ref ?? null,
      client_email: client?.email ?? null,
    });
  }
  return out;
}

export async function amlDashboard(): Promise<Doc> {
  const pending = await listAmlCases({ pending: true });
  const overdue = await listAmlCases({ overdue: true });
  const approved = await col(AML_COLLECTIONS.cases).countDocuments({ status: "APPROVED" });
  const rejected = await col(AML_COLLECTIONS.cases).countDocuments({ status: "REJECTED" });
  const inProgress = await col(AML_COLLECTIONS.cases).countDocuments({
    status: { $in: ["NOT_STARTED", "IN_PROGRESS", "REQUIRES_REUPLOAD"] },
  });
  return {
    pending_review: pending,
    overdue_reviews: overdue,
    counts: {
      pending_review: pending.length,
      overdue_reviews: overdue.length,
      approved,
      rejected,
      in_progress_client: inProgress,
    },
  };
}

/**
 * Gate used by service activation / checkout / engagement.
 * Returns ok when the client has an APPROVED AML case (or no case required — never for new clients).
 */
export async function amlGate(client: Doc): Promise<{
  ok: boolean;
  reason: string | null;
  status: string | null;
  aml_case_id: string | null;
  aml_status: string | null;
}> {
  const approved = (await col(AML_COLLECTIONS.cases).findOne({
    client_id: client.id,
    status: "APPROVED",
  })) as Doc | null;
  if (approved) {
    return {
      ok: true,
      reason: null,
      status: "APPROVED",
      aml_case_id: approved.id,
      aml_status: "COMPLIANT",
    };
  }

  // Ensure a case exists so the UI can deep-link.
  const open = await ensureAmlCase(client);
  return {
    ok: false,
    reason: "AML/KYC check required before services can be activated",
    status: open.status,
    aml_case_id: open.id,
    aml_status: client.aml_status || "REQUIRED",
  };
}

export async function assertAmlApproved(client: Doc): Promise<void> {
  const gate = await amlGate(client);
  if (!gate.ok) {
    throw httpError(403, gate.reason || "AML/KYC check required");
  }
}

/** Seed/fixture helper — mark AML approved without document uploads. */
export async function seedMarkAmlApproved(client: Doc): Promise<void> {
  const amlCase = await ensureAmlCase(client);
  if (amlCase.status === "APPROVED") return;
  const now = nowIso();
  await col(AML_COLLECTIONS.cases).updateOne(
    { id: amlCase.id },
    {
      $set: {
        status: "APPROVED",
        risk_level: "LOW",
        reviewed_at: now,
        reviewer_name: "Seed",
        next_review_due: defaultNextReviewDue("LOW"),
        date_of_birth: client.date_of_birth || "1990-01-01",
        residential_address: client.address || "1 Seed Street, London, E1 1AA",
        updated_at: now,
        has_selfie: true,
        proof_of_address_count: 2,
        id_document_kind: "PASSPORT",
      },
    },
  );
  await col("clients").updateOne(
    { id: client.id },
    {
      $set: {
        aml_status: "COMPLIANT",
        aml_risk_level: "LOW",
        aml_case_id: amlCase.id,
        aml_reviewed_at: now,
        updated_at: now,
      },
    },
  );
  await logAmlAudit({
    aml_case_id: amlCase.id,
    client_id: client.id,
    actor: null,
    action: "SEED_APPROVED",
  });
}

export async function exportAmlAudit(caseId: string): Promise<Doc[]> {
  return cleanMany(
    await col(AML_COLLECTIONS.audit)
      .find({ aml_case_id: caseId })
      .sort({ created_at: 1 })
      .toArray(),
  );
}
