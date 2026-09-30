/**
 * Canonical CLIENT document DTO shared by My Documents, Tax Tracker and MTD overview.
 * Frontend consumers expect `filename` + authorised relative `downloadUrl`.
 */
import { Doc } from "../db/mongo";

export function clientDocumentDto(d: Doc, caseId?: string): Doc {
  const id = String(d.id ?? "");
  const cid = String(caseId ?? d.case_id ?? d.taxReturnId ?? "");
  const filename = String(d.name ?? d.filename ?? d.originalFileName ?? "document");
  const downloadUrl = id
    ? `/api/compat/client/documents/${encodeURIComponent(id)}/download`
    : null;
  return {
    ...d,
    id,
    filename,
    name: filename,
    originalFileName: filename,
    downloadUrl,
    previewUrl: downloadUrl,
    // Legacy FE fields — never expose raw storage to the browser as a download href.
    cloudinaryUrl: downloadUrl,
    taxReturnId: cid || null,
    tax_return_id: cid || null,
    caseId: cid || null,
    case_id: cid || null,
    documentType: d.document_type ?? d.documentType ?? "Other",
    uploadStatus:
      d.status === "Requested" || d.uploadStatus === "uploading" ? "uploading" : "completed",
    fileSize: d.size ?? d.fileSize ?? null,
    mimeType: d.content_type ?? d.mimeType ?? null,
  };
}

export function clientDocumentsPayload(docs: Doc[]): {
  files: { documents: Doc[] };
  documents: Doc[];
} {
  const mapped = docs.map((d) => clientDocumentDto(d));
  return {
    // Nested shape expected by MyDocuments.jsx (`data.files.documents`).
    files: { documents: mapped },
    // Flat alias for newer consumers.
    documents: mapped,
  };
}
