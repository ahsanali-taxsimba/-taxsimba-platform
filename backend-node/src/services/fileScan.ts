/**
 * Antivirus / malware scanning pipeline for all platform uploads.
 *
 * Drivers:
 *   SCANNER_DRIVER=stub (default) — heuristic checks + EICAR detection
 *   SCANNER_DRIVER=clamav         — TODO: clamd TCP
 *   SCANNER_DRIVER=http           — TODO: enterprise HTTP API (Cloudmersive / OPSWAT)
 *
 * Statuses: clean | suspicious | infected | corrupt | pending
 */
import { createHash, randomUUID } from "crypto";

import { env } from "../config/env";
import {
  FILE_DOWNLOAD_AUDIT,
  FILE_SCAN_COLLECTION,
  FileScanResult,
  ScanStatus,
  nowIso,
} from "../domain/fileSecurity";
import { col, Doc } from "../db/mongo";
import { httpError } from "../http/errors";
import { logActivity, notify, nowIso as wfNow } from "../domain/workflow";
import { queueEmail } from "./email";

export interface ScanInput {
  file_id: string;
  source: "documents" | "intake" | "aml" | "knowledge";
  buffer: Buffer;
  file_name: string;
  file_type: string;
  file_size: number;
  client_id?: string | null;
  case_id?: string | null;
  category?: string | null;
}

export interface ScanOutcome {
  scan_status: ScanStatus;
  scanner_notes: string;
  scanner_driver: string;
  scan_timestamp: string;
}

function driverName(): string {
  return (env("SCANNER_DRIVER") || "stub").toLowerCase();
}

/**
 * Heuristic stub scanner. Safe for CI/dev; replace with ClamAV/enterprise API in prod.
 * Detects the industry-standard EICAR test string as infected.
 */
export function stubScan(buffer: Buffer, fileName: string, contentType: string): ScanOutcome {
  const notes: string[] = [];
  const lower = fileName.toLowerCase();
  const head = buffer.subarray(0, Math.min(buffer.length, 16)).toString("latin1");
  const asText = buffer.subarray(0, Math.min(buffer.length, 4096)).toString("utf8");

  if (!buffer.length) {
    return {
      scan_status: "corrupt",
      scanner_notes: "File is empty",
      scanner_driver: "stub",
      scan_timestamp: nowIso(),
    };
  }

  // EICAR standard antivirus test file → treat as infected.
  if (asText.includes("EICAR-STANDARD-ANTIVIRUS-TEST-FILE") || asText.includes("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR")) {
    return {
      scan_status: "infected",
      scanner_notes: "EICAR test signature detected (malware test pattern)",
      scanner_driver: "stub",
      scan_timestamp: nowIso(),
    };
  }

  // Truncated / mismatched magic bytes.
  if (contentType.includes("pdf") || lower.endsWith(".pdf")) {
    if (!head.startsWith("%PDF")) {
      notes.push("PDF content-type/extension but missing %PDF header");
      return {
        scan_status: "corrupt",
        scanner_notes: notes.join("; "),
        scanner_driver: "stub",
        scan_timestamp: nowIso(),
      };
    }
  }
  if (contentType.includes("jpeg") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
      notes.push("JPEG magic bytes missing");
      return {
        scan_status: "corrupt",
        scanner_notes: notes.join("; "),
        scanner_driver: "stub",
        scan_timestamp: nowIso(),
      };
    }
  }
  if (contentType.includes("png") || lower.endsWith(".png")) {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    if (!buffer.subarray(0, 4).equals(png)) {
      notes.push("PNG magic bytes missing");
      return {
        scan_status: "corrupt",
        scanner_notes: notes.join("; "),
        scanner_driver: "stub",
        scan_timestamp: nowIso(),
      };
    }
  }

  // Office docs are ZIP-based — flag tiny or non-ZIP payloads as suspicious.
  if (/\.(docx|xlsx)$/i.test(lower) || contentType.includes("openxmlformats")) {
    if (head.slice(0, 2) !== "PK") {
      return {
        scan_status: "suspicious",
        scanner_notes: "Office Open XML file missing ZIP signature",
        scanner_driver: "stub",
        scan_timestamp: nowIso(),
      };
    }
  }

  // Double extension / executable masquerade.
  if (/\.(exe|bat|cmd|js|vbs|scr|dll|msi)(\.|$)/i.test(lower) || /\.(pdf|docx)\.exe$/i.test(lower)) {
    return {
      scan_status: "infected",
      scanner_notes: "Disallowed executable or double-extension pattern",
      scanner_driver: "stub",
      scan_timestamp: nowIso(),
    };
  }

  // Extremely small "documents" claiming to be PDFs/Office.
  if (buffer.length < 32 && (lower.endsWith(".pdf") || lower.endsWith(".docx"))) {
    return {
      scan_status: "corrupt",
      scanner_notes: "File too small to be a valid document",
      scanner_driver: "stub",
      scan_timestamp: nowIso(),
    };
  }

  return {
    scan_status: "clean",
    scanner_notes: "Stub scanner: no threats detected (heuristic)",
    scanner_driver: "stub",
    scan_timestamp: nowIso(),
  };
}

async function runScanner(buffer: Buffer, fileName: string, contentType: string): Promise<ScanOutcome> {
  const driver = driverName();
  if (driver === "stub" || driver === "none" || driver === "log") {
    return stubScan(buffer, fileName, contentType);
  }
  // TODO(security): implement ClamAV (SCANNER_DRIVER=clamav, CLAMD_HOST/PORT)
  // TODO(security): implement HTTP scanner (SCANNER_URL + API key)
  const fallback = stubScan(buffer, fileName, contentType);
  fallback.scanner_notes = `${fallback.scanner_notes}; unknown driver '${driver}' fell back to stub`;
  fallback.scanner_driver = `stub(fallback:${driver})`;
  return fallback;
}

/** Scan buffer, persist FileScanResult, return outcome for denormalising onto the file row. */
export async function scanAndRecord(input: ScanInput): Promise<ScanOutcome & { scan_id: string }> {
  const outcome = await runScanner(input.buffer, input.file_name, input.file_type);
  const id = randomUUID();
  const row: FileScanResult = {
    id,
    file_id: input.file_id,
    source: input.source,
    client_id: input.client_id ?? null,
    case_id: input.case_id ?? null,
    file_name: input.file_name,
    file_size: input.file_size,
    file_type: input.file_type,
    scan_status: outcome.scan_status,
    scan_timestamp: outcome.scan_timestamp,
    scanner_notes: outcome.scanner_notes,
    scanner_driver: outcome.scanner_driver,
    created_at: nowIso(),
  };
  await col(FILE_SCAN_COLLECTION).insertOne({ ...row, category: input.category ?? null });
  return { ...outcome, scan_id: id };
}

export async function latestScan(fileId: string, source?: string): Promise<Doc | null> {
  const q: Doc = { file_id: fileId };
  if (source) q.source = source;
  return (await col(FILE_SCAN_COLLECTION).findOne(q, { sort: { scan_timestamp: -1 } })) as Doc | null;
}

export async function logDownloadAttempt(params: {
  file_id: string;
  source: string;
  actor: Doc;
  scan_status: string | null;
  allowed: boolean;
  confirmed_risk?: boolean;
  reason?: string;
}): Promise<void> {
  await col(FILE_DOWNLOAD_AUDIT).insertOne({
    id: randomUUID(),
    file_id: params.file_id,
    source: params.source,
    actor_id: params.actor.id,
    actor_name: params.actor.name,
    actor_role: params.actor.role,
    scan_status: params.scan_status,
    allowed: params.allowed,
    confirmed_risk: Boolean(params.confirmed_risk),
    reason: params.reason ?? null,
    created_at: nowIso(),
  });
}

/**
 * Staff download gate.
 * - infected → always blocked (403)
 * - suspicious/corrupt → require confirmRisk=true (409 otherwise with payload for modal)
 * - clean/pending → allow (pending treated cautiously as suspicious for staff)
 */
export async function assertDownloadAllowed(params: {
  file_id: string;
  source: string;
  scan_status: ScanStatus | string | null | undefined;
  actor: Doc;
  confirmRisk?: boolean;
}): Promise<void> {
  const status = (params.scan_status || "pending") as ScanStatus;
  const staff = ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"].includes(params.actor.role);

  if (!staff) {
    // Clients may re-download their own uploads even if later marked infected (they already had it);
    // still block infected to avoid spreading from portal.
    if (status === "infected") {
      await logDownloadAttempt({
        file_id: params.file_id,
        source: params.source,
        actor: params.actor,
        scan_status: status,
        allowed: false,
        reason: "infected",
      });
      throw httpError(
        403,
        "This file contains malware and cannot be downloaded. Please upload a replacement document.",
      );
    }
    await logDownloadAttempt({
      file_id: params.file_id,
      source: params.source,
      actor: params.actor,
      scan_status: status,
      allowed: true,
    });
    return;
  }

  if (status === "infected") {
    await logDownloadAttempt({
      file_id: params.file_id,
      source: params.source,
      actor: params.actor,
      scan_status: status,
      allowed: false,
      reason: "infected_blocked",
    });
    throw httpError(
      403,
      "This file contains malware and cannot be downloaded. Please request a replacement from the client.",
    );
  }

  if (status === "suspicious" || status === "corrupt" || status === "pending") {
    if (!params.confirmRisk) {
      await logDownloadAttempt({
        file_id: params.file_id,
        source: params.source,
        actor: params.actor,
        scan_status: status,
        allowed: false,
        reason: "confirmation_required",
      });
      throw httpError(409, {
        code: "RISKY_FILE_CONFIRMATION_REQUIRED",
        scan_status: status,
        message:
          "This file appears suspicious or corrupt. Download at your own risk. We recommend requesting an alternative document from the client.",
        recommend_alternative: true,
      });
    }
  }

  await logDownloadAttempt({
    file_id: params.file_id,
    source: params.source,
    actor: params.actor,
    scan_status: status,
    allowed: true,
    confirmed_risk: Boolean(params.confirmRisk),
  });
}

/**
 * Request alternative / replacement document from the client.
 * Works for intake categories and case documents.
 */
export async function requestAlternativeDocument(params: {
  actor: Doc;
  case_id?: string | null;
  client_user_id: string;
  client_id?: string | null;
  category_label: string;
  category_id?: string | null;
  file_id?: string | null;
  source: "intake" | "documents" | "aml";
  message?: string | null;
}): Promise<Doc> {
  if (!["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"].includes(params.actor.role)) {
    throw httpError(403, "Only staff can request alternative documents");
  }

  const taskId = randomUUID();
  const title = `Please upload a replacement document for ${params.category_label}`;
  const body =
    params.message?.trim() ||
    `Your previous upload for “${params.category_label}” could not be accepted (scan failed or file unreadable). Please upload a clean replacement (max 20MB: PDF, JPG, PNG, Word or Excel).`;
  const portalLink =
    params.source === "aml"
      ? "/aml"
      : params.source === "intake"
        ? "/document-intake"
        : "/documents";

  await col("tasks").insertOne({
    id: taskId,
    case_id: params.case_id ?? null,
    client_user_id: params.client_user_id,
    name: title,
    description: body,
    status: "OPEN",
    owner_id: params.client_user_id,
    owner_role: "CLIENT",
    created_by: params.actor.id,
    created_by_name: params.actor.name,
    created_at: wfNow(),
    due_date: null,
    intake_category_id: params.category_id ?? null,
    replacement_for_file_id: params.file_id ?? null,
    kind: "DOCUMENT_REPLACEMENT",
  });

  if (params.source === "intake" && params.category_id) {
    await col("tax_return_document_categories").updateOne(
      { id: params.category_id },
      {
        $set: {
          status: "AWAITING_REPLACEMENT",
          updated_at: wfNow(),
          accountant_notes:
            params.message ||
            `Replacement requested by ${params.actor.name} on ${wfNow()}`,
        },
      },
    );
  }

  if (params.source === "documents" && params.file_id) {
    await col("documents").updateOne(
      { id: params.file_id },
      {
        $set: {
          status: "Replacement Required",
          replacement_requested_at: wfNow(),
          replacement_requested_by: params.actor.id,
        },
      },
    );
  }

  if (params.source === "aml" && params.file_id) {
    await col("aml_documents").updateOne(
      { id: params.file_id },
      {
        $set: {
          replacement_requested: true,
          notes: `Replacement requested by ${params.actor.name}`,
        },
      },
    );
  }

  await notify(
    params.client_user_id,
    "Replacement document required",
    body,
    params.case_id ?? null,
    portalLink,
    "DOCUMENT",
  );

  const user = (await col("users").findOne({ id: params.client_user_id })) as Doc | null;
  if (user?.email) {
    await queueEmail({
      to: user.email,
      recipientName: user.name,
      kind: "DOCUMENT_REPLACEMENT",
      title: "Please upload a replacement document",
      body,
      link: portalLink,
      callToAction: "Upload replacement",
      dedupeKey: `doc-replacement:${taskId}`,
      userId: user.id,
      caseId: params.case_id ?? null,
    });
  }

  if (params.case_id) {
    await logActivity(
      params.case_id,
      `Requested alternative document: ${params.category_label}`,
      params.actor,
      {
        task_id: taskId,
        file_id: params.file_id,
        source: params.source,
      },
    );
  }

  return { task_id: taskId, category_id: params.category_id, status: "AWAITING_REPLACEMENT" };
}

/** Content hash helper shared with intake duplicate detection. */
export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}
