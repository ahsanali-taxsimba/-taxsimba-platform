/**
 * Tax Return Document Intake — structured category uploads mapped to SA preparation.
 *
 * Each Self Assessment tax year gets a TaxReturnMasterIntake with fixed categories.
 * Documents map to preparation sections (employment, investments, expenses, etc.).
 *
 * TODO(ocr): bank statement / payslip OCR extraction.
 * TODO(ai): expense auto-categorisation.
 * TODO(compliance): confirm UK tax record retention (typically ≥5 years after the
 *   31 January filing deadline of the relevant year) with MLRO / counsel.
 */
import { createHash, randomUUID } from "crypto";

import { col, Doc } from "../db/mongo";
import { nowIso } from "./workflow";

export const INTAKE_COLLECTIONS = {
  masters: "tax_return_master_intakes",
  categories: "tax_return_document_categories",
  files: "tax_return_intake_files",
  audit: "tax_return_intake_audit",
} as const;

export const INTAKE_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "AWAITING_VERIFICATION",
  "COMPLETE",
] as const;
export type IntakeStatus = (typeof INTAKE_STATUSES)[number];

export const CATEGORY_STATUSES = [
  "NOT_UPLOADED",
  "UPLOADED",
  "VERIFIED",
  "NOT_APPLICABLE",
] as const;
export type CategoryStatus = (typeof CATEGORY_STATUSES)[number];

/**
 * Prisma-equivalent sketch:
 *
 *   model TaxReturnMasterIntake {
 *     id                   String
 *     clientId             String
 *     clientUserId         String?
 *     caseId               String?   // linked tax return / case
 *     taxYear              String
 *     completionStatus     IntakeStatus
 *     lastUpdated          DateTime
 *     linkedToTaxReturnId  String?
 *     categories           TaxReturnDocumentCategory[]
 *   }
 *
 *   model TaxReturnDocumentCategory {
 *     id               String
 *     intakeId         String
 *     clientId         String
 *     taxYear          String
 *     categoryKey      String
 *     categoryName     String
 *     description      String
 *     fileIds          String[]
 *     status           CategoryStatus
 *     accountantNotes  String?
 *     mandatory        Boolean
 *     taxSectionMapping String   // employment | investment | expenses | ...
 *   }
 */

/** Canonical categories — legal/product order; do not rename keys without a migration. */
export const INTAKE_CATEGORY_DEFS: {
  key: string;
  name: string;
  description: string;
  /** Tax-return preparation section this category feeds. */
  tax_section: string;
  /** When true, must be UPLOADED/VERIFIED or NOT_APPLICABLE before admin review. */
  mandatory: boolean;
}[] = [
  {
    key: "BANK_STATEMENTS",
    name: "Bank Statements",
    description: "Personal and business bank statements covering the full tax year.",
    tax_section: "bank_analysis",
    mandatory: true,
  },
  {
    key: "FINANCIAL_STATEMENTS",
    name: "Financial Statements",
    description: "Accounts, profit & loss, and balance sheet (if applicable).",
    tax_section: "self_employment_accounts",
    mandatory: false,
  },
  {
    key: "PENSION_DOCUMENTS",
    name: "Pension Documents",
    description: "P60, P45, and pension contribution / annual statements.",
    tax_section: "pensions",
    mandatory: false,
  },
  {
    key: "EMPLOYMENT_RECORDS",
    name: "Employment Records",
    description: "P60, P45, and payslips for employment income.",
    tax_section: "employment_income",
    mandatory: true,
  },
  {
    key: "DIVIDENDS_INTEREST",
    name: "Dividends / Interest Records",
    description: "Dividend vouchers, interest certificates, and investment income statements.",
    tax_section: "investment_income",
    mandatory: false,
  },
  {
    key: "HMRC_LETTERS",
    name: "HMRC Letters",
    description: "Correspondence from HMRC relevant to this tax year.",
    tax_section: "compliance",
    mandatory: false,
  },
  {
    key: "OTHER_INCOME",
    name: "Other Income Records",
    description: "Rental, foreign income, crypto, self-employment, and other income evidence.",
    tax_section: "other_income_schedules",
    mandatory: false,
  },
  {
    key: "OTHER_EXPENSES",
    name: "Other Expenses Records",
    description: "Allowable expenses and receipts supporting deductions.",
    tax_section: "allowable_expenses",
    mandatory: false,
  },
  {
    key: "ANY_OTHER",
    name: "Any Other Information",
    description: "Anything else that helps prepare the return (free-form uploads).",
    tax_section: "general",
    mandatory: false,
  },
];

export interface TaxReturnMasterIntake {
  id: string;
  client_id: string;
  client_user_id: string | null;
  case_id: string | null;
  tax_year: string;
  completion_status: IntakeStatus;
  last_updated: string;
  linked_to_tax_return_id: string | null;
  created_at: string;
}

export interface TaxReturnDocumentCategory {
  id: string;
  intake_id: string;
  client_id: string;
  client_user_id: string | null;
  case_id: string | null;
  tax_year: string;
  category_key: string;
  category_name: string;
  description: string;
  file_ids: string[];
  status: CategoryStatus;
  accountant_notes: string | null;
  mandatory: boolean;
  tax_section: string;
  created_at: string;
  updated_at: string;
}

export interface TaxReturnIntakeFile {
  id: string;
  intake_id: string;
  category_id: string;
  client_id: string;
  case_id: string | null;
  file_name: string;
  content_type: string;
  size: number;
  storage_path: string;
  /** SHA-256 of file bytes — used for duplicate detection. */
  content_hash: string;
  version: number;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
  is_deleted: boolean;
  /**
   * TODO(ocr): extracted fields from bank/payslip OCR.
   * TODO(ai): suggested expense categories.
   */
  extraction: Doc | null;
}

export function hashFileBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export async function ensureIntakeIndexes(): Promise<void> {
  const specs: [string, Doc][] = [
    [INTAKE_COLLECTIONS.masters, { client_id: 1, tax_year: 1 }],
    [INTAKE_COLLECTIONS.masters, { case_id: 1 }],
    [INTAKE_COLLECTIONS.masters, { completion_status: 1 }],
    [INTAKE_COLLECTIONS.categories, { intake_id: 1 }],
    [INTAKE_COLLECTIONS.categories, { client_id: 1, tax_year: 1 }],
    [INTAKE_COLLECTIONS.categories, { case_id: 1, category_key: 1 }],
    [INTAKE_COLLECTIONS.files, { category_id: 1 }],
    [INTAKE_COLLECTIONS.files, { intake_id: 1, content_hash: 1 }],
    [INTAKE_COLLECTIONS.audit, { intake_id: 1, created_at: -1 }],
  ];
  for (const [name, keys] of specs) {
    try {
      await col(name).createIndex(keys);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`intake index ${name} skipped: ${String(e)}`);
    }
  }
  try {
    await col(INTAKE_COLLECTIONS.masters).createIndex(
      { client_id: 1, tax_year: 1, case_id: 1 },
      { unique: true },
    );
  } catch {
    /* exists */
  }
}

export async function logIntakeAudit(params: {
  intake_id: string;
  client_id: string;
  case_id?: string | null;
  actor: Doc | null;
  action: string;
  meta?: Doc;
}): Promise<void> {
  await col(INTAKE_COLLECTIONS.audit).insertOne({
    id: randomUUID(),
    intake_id: params.intake_id,
    client_id: params.client_id,
    case_id: params.case_id ?? null,
    actor_id: params.actor?.id ?? null,
    actor_name: params.actor?.name ?? "System",
    actor_role: params.actor?.role ?? "SYSTEM",
    action: params.action,
    meta: params.meta ?? {},
    created_at: nowIso(),
  });
}

export { nowIso, randomUUID };
