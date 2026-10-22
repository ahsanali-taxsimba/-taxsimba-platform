/**
 * AML / KYC module — UK MLR 2017 Customer Due Diligence scaffolding.
 *
 * Design notes (not shown in client UI):
 * - CDD for individuals: verify full name, DOB, residential address via independent
 *   sources (ID + proofs of address and/or electronic verification).
 * - Retain AML records/evidence for at least 5 years after the business relationship ends.
 * - Internal controls: risk assessment, staff review, audit trail, ongoing monitoring.
 *
 * TODO(legal): Confirm retention schedule, privacy notices, and SAR escalation process
 * with MLRO / counsel before production go-live.
 * TODO(security): Restrict AML document download to authorised staff roles only (enforced
 * in routes); ensure object storage encryption at rest is enabled in the environment.
 */
import { randomUUID } from "crypto";

import { col, Doc } from "../db/mongo";
import { nowIso } from "./workflow";

export const AML_COLLECTIONS = {
  cases: "aml_cases",
  documents: "aml_documents",
  checks: "aml_checks",
  screening: "aml_screening_results",
  audit: "aml_audit_log",
} as const;

export const AML_CASE_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "SUBMITTED",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "REQUIRES_REUPLOAD",
] as const;
export type AmlCaseStatus = (typeof AML_CASE_STATUSES)[number];

export const AML_DOC_TYPES = [
  "PASSPORT",
  "DRIVING_LICENCE_FRONT",
  "DRIVING_LICENCE_BACK",
  "PROOF_OF_ADDRESS",
  "SELFIE",
] as const;
export type AmlDocType = (typeof AML_DOC_TYPES)[number];

export const AML_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type AmlRiskLevel = (typeof AML_RISK_LEVELS)[number];

export const CLIENT_TYPES = ["INDIVIDUAL", "COMPANY"] as const;

/**
 * Prisma-equivalent sketch:
 *
 *   model AMLCase {
 *     id                String
 *     clientId          String
 *     clientUserId      String?
 *     status            AmlCaseStatus
 *     riskLevel         AmlRiskLevel?
 *     clientType        Individual|Company
 *     dateOfBirth       String?
 *     residentialAddress String?
 *     countryOfResidence String?
 *     occupation        String?
 *     sourceOfFundsNote String?
 *     complexityNote    String?
 *     eddRequired       Boolean
 *     nextReviewDue     DateTime?
 *     submittedAt       DateTime?
 *     reviewedAt        DateTime?
 *     reviewerId        String?
 *     rejectionReason   String?
 *     documents         AMLDocument[]
 *     checks            AMLCheck[]
 *   }
 *
 *   model AMLDocument {
 *     id          String
 *     amlCaseId   String
 *     type        AmlDocType
 *     fileId      String   // storage path / object key
 *     fileName    String
 *     contentType String
 *     size        Int
 *     uploadedAt  DateTime
 *     notes       String?
 *   }
 *
 *   model AMLCheck {
 *     id            String
 *     amlCaseId     String
 *     checklist     Json   // structured review answers
 *     decision      APPROVED|REJECTED|REQUIRES_REUPLOAD
 *     riskLevel     AmlRiskLevel
 *     comments      String?
 *     reviewerId    String
 *     reviewedAt    DateTime
 *   }
 */

export interface AmlCase {
  id: string;
  client_id: string;
  client_user_id: string | null;
  status: AmlCaseStatus;
  risk_level: AmlRiskLevel | null;
  client_type: "INDIVIDUAL" | "COMPANY";
  full_name: string | null;
  date_of_birth: string | null;
  residential_address: string | null;
  country_of_residence: string | null;
  occupation: string | null;
  source_of_funds_note: string | null;
  complexity_note: string | null;
  services_complexity: string | null;
  edd_required: boolean;
  /** ISO date when periodic review is due (default +3 years from approval). */
  next_review_due: string | null;
  id_document_kind: "PASSPORT" | "DRIVING_LICENCE" | null;
  proof_of_address_count: number;
  has_selfie: boolean;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewer_id: string | null;
  reviewer_name: string | null;
  rejection_reason: string | null;
  reupload_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface AmlDocument {
  id: string;
  aml_case_id: string;
  client_id: string;
  type: AmlDocType;
  /** Object storage path — treat as file_id. */
  file_id: string;
  file_name: string;
  content_type: string;
  size: number;
  uploaded_at: string;
  uploaded_by: string;
  notes: string | null;
  /**
   * TODO(security): mark for secure deletion after retention window.
   * Retention: keep for ≥5 years after the end of the business relationship (MLR 2017).
   */
  retain_until: string | null;
}

export interface AmlCheck {
  id: string;
  aml_case_id: string;
  checklist: {
    id_matches_client: boolean;
    address_docs_valid_and_recent: boolean;
    selfie_matches_id: boolean;
    pep_sanctions_cleared: boolean | null;
  };
  decision: "APPROVED" | "REJECTED" | "REQUIRES_REUPLOAD";
  risk_level: AmlRiskLevel;
  comments: string | null;
  reviewer_id: string;
  reviewer_name: string;
  reviewed_at: string;
}

/** Minimum proofs of address required for individual CDD in this product. */
export const REQUIRED_PROOF_OF_ADDRESS = 2;

export const REVIEW_CHECKLIST_LABELS = {
  id_matches_client: "Identity document matches client name / DOB / photo",
  address_docs_valid_and_recent: "Both proofs of address are valid and sufficiently recent",
  selfie_matches_id: "Live photo reasonably matches the ID photograph",
  pep_sanctions_cleared: "PEP / sanctions screening cleared (or N/A pending integration)",
} as const;

export function isoPlusYears(years: number, from = new Date()): string {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString();
}

/** Default periodic review: 3 years from approval (high-risk may be shorter — TODO). */
export function defaultNextReviewDue(risk: AmlRiskLevel): string {
  const years = risk === "HIGH" ? 1 : risk === "MEDIUM" ? 2 : 3;
  return isoPlusYears(years);
}

export async function ensureAmlIndexes(): Promise<void> {
  const specs: [string, Doc, Doc?][] = [
    [AML_COLLECTIONS.cases, { client_id: 1 }],
    [AML_COLLECTIONS.cases, { client_user_id: 1 }],
    [AML_COLLECTIONS.cases, { status: 1, updated_at: -1 }],
    [AML_COLLECTIONS.cases, { next_review_due: 1 }],
    [AML_COLLECTIONS.documents, { aml_case_id: 1, type: 1 }],
    [AML_COLLECTIONS.documents, { client_id: 1 }],
    [AML_COLLECTIONS.checks, { aml_case_id: 1 }],
    [AML_COLLECTIONS.screening, { aml_case_id: 1, checked_at: -1 }],
    [AML_COLLECTIONS.audit, { aml_case_id: 1, created_at: -1 }],
    [AML_COLLECTIONS.audit, { client_id: 1 }],
  ];
  for (const [name, keys, opts] of specs) {
    try {
      await col(name).createIndex(keys, opts);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`aml index ${name} skipped: ${String(e)}`);
    }
  }
}

export async function logAmlAudit(params: {
  aml_case_id: string;
  client_id: string;
  actor: Doc | null;
  action: string;
  meta?: Doc;
}): Promise<void> {
  await col(AML_COLLECTIONS.audit).insertOne({
    id: randomUUID(),
    aml_case_id: params.aml_case_id,
    client_id: params.client_id,
    actor_id: params.actor?.id ?? null,
    actor_name: params.actor?.name ?? "System",
    actor_role: params.actor?.role ?? "SYSTEM",
    action: params.action,
    meta: params.meta ?? {},
    created_at: nowIso(),
  });
}

export { nowIso, randomUUID };
