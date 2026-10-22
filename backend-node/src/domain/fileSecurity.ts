/**
 * Platform-wide upload security: size limits, allowed types, antivirus scan statuses.
 *
 * TODO(security): wire SCANNER_DRIVER=clamav|cloudmersive|virustotal for production.
 * TODO(security): confirm object-storage encryption-at-rest is enabled for all buckets.
 */
import { col, Doc } from "../db/mongo";
import { nowIso } from "./workflow";

export const FILE_SCAN_COLLECTION = "file_scan_results";
export const FILE_DOWNLOAD_AUDIT = "file_download_audit";

export const SCAN_STATUSES = ["pending", "clean", "suspicious", "infected", "corrupt"] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

/** Hard product rule: 20MB per file (overridable only via MAX_UPLOAD_MB for emergency). */
export const DEFAULT_MAX_UPLOAD_MB = 20;

export const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "doc",
  "docx",
  "xls",
  "xlsx",
]);

/**
 * MIME allow-list aligned with ALLOWED_EXTENSIONS.
 * Clients see: PDF, JPG/JPEG, PNG, Word, Excel.
 */
export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export interface FileScanResult {
  id: string;
  file_id: string;
  /** documents | intake | aml */
  source: string;
  client_id: string | null;
  case_id: string | null;
  file_name: string;
  file_size: number;
  file_type: string;
  scan_status: ScanStatus;
  scan_timestamp: string;
  scanner_notes: string | null;
  scanner_driver: string;
  created_at: string;
}

export async function ensureFileSecurityIndexes(): Promise<void> {
  try {
    await col(FILE_SCAN_COLLECTION).createIndex({ file_id: 1, source: 1 });
    await col(FILE_SCAN_COLLECTION).createIndex({ scan_status: 1, scan_timestamp: -1 });
    await col(FILE_DOWNLOAD_AUDIT).createIndex({ file_id: 1, created_at: -1 });
    await col(FILE_DOWNLOAD_AUDIT).createIndex({ actor_id: 1, created_at: -1 });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`file security indexes skipped: ${String(e)}`);
  }
}

export { nowIso };
export type { Doc };
