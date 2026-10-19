/**
 * Tax Knowledge Library — staff-only knowledge base for Taxsimba Group Ltd.
 *
 * Role mapping (current platform roles):
 *   EDITORS  = ACCOUNTANT | ADMIN | SUPER_ADMIN  → full CRUD, upload, archive
 *   VIEWERS  = JUNIOR_ACCOUNTANT (future)        → view + notes only
 *   Clients  = no access
 *
 * TODO(ai): document summaries / junior explanations.
 * TODO(alerts): HMRC rule-change update alerts.
 */
import { randomUUID } from "crypto";

import { col, Doc } from "../db/mongo";
import { nowIso } from "./workflow";

export const TAX_KNOWLEDGE_COLLECTIONS = {
  items: "tax_knowledge_items",
  notes: "tax_knowledge_notes",
  files: "tax_knowledge_files",
  bookmarks: "tax_knowledge_bookmarks",
} as const;

export const TAX_KNOWLEDGE_CATEGORIES = [
  "SA",
  "CT",
  "VAT",
  "PAYE",
  "CIS",
  "MTD",
  "AML",
  "General",
] as const;
export type TaxKnowledgeCategory = (typeof TAX_KNOWLEDGE_CATEGORIES)[number];

export const SUGGESTED_TAGS = [
  "HMRC Manual",
  "Director Rules",
  "VAT Flat Rate",
  "Payroll",
  "CIS",
  "MTD ITSA",
] as const;

export const KNOWLEDGE_EDITOR_ROLES = ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"] as const;
export const KNOWLEDGE_VIEWER_ROLES = [
  "ACCOUNTANT",
  "ADMIN",
  "SUPER_ADMIN",
  "JUNIOR_ACCOUNTANT",
  "MANAGER",
  "SENIOR_ACCOUNTANT",
] as const;

export interface TaxKnowledgeItem {
  id: string;
  title: string;
  description: string;
  category: TaxKnowledgeCategory;
  tags: string[];
  file_ids: string[];
  external_links: { label: string; url: string }[];
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  version_history: {
    version: number;
    edited_by: string;
    edited_by_name: string;
    edited_at: string;
    summary: string;
  }[];
  is_archived: boolean;
  /** Optional AI summary placeholder. */
  ai_summary: string | null;
}

export function canViewKnowledge(role: string): boolean {
  return (KNOWLEDGE_VIEWER_ROLES as readonly string[]).includes(role);
}

export function canEditKnowledge(role: string): boolean {
  // Junior staff: notes only. Platform does not yet seed JUNIOR_ACCOUNTANT —
  // treat known editor roles as full editors; junior/manager aliases ready.
  if (role === "JUNIOR_ACCOUNTANT") return false;
  return (KNOWLEDGE_EDITOR_ROLES as readonly string[]).includes(role) || role === "MANAGER" || role === "SENIOR_ACCOUNTANT";
}

export async function ensureTaxKnowledgeIndexes(): Promise<void> {
  const specs: [string, Doc, Doc?][] = [
    [TAX_KNOWLEDGE_COLLECTIONS.items, { category: 1, is_archived: 1, updated_at: -1 }],
    [TAX_KNOWLEDGE_COLLECTIONS.items, { tags: 1 }],
    [TAX_KNOWLEDGE_COLLECTIONS.items, { title: "text", description: "text", tags: "text" }],
    [TAX_KNOWLEDGE_COLLECTIONS.notes, { knowledge_item_id: 1, created_at: -1 }],
    [TAX_KNOWLEDGE_COLLECTIONS.files, { knowledge_item_id: 1 }],
    [TAX_KNOWLEDGE_COLLECTIONS.bookmarks, { staff_id: 1, knowledge_item_id: 1 }, { unique: true }],
  ];
  for (const [name, keys, opts] of specs) {
    try {
      await col(name).createIndex(keys, opts);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`tax knowledge index ${name} skipped: ${String(e)}`);
    }
  }
}

export { nowIso, randomUUID };
export type { Doc };
