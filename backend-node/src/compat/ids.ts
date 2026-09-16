/**
 * Stable taxReturnId ↔ caseId mapping for Toxel compatibility.
 *
 * Deterministic identity: the TaxSimba case `id` IS the taxReturnId exposed to Toxel.
 * No parallel ID store — adapters may decorate payloads with `taxReturnId` without
 * inventing a second case system.
 */

import { httpError } from "../http/errors";

/** Map a Toxel taxReturnId to the Node case id (identity). */
export function toCaseId(taxReturnId: string | null | undefined): string {
  const id = (taxReturnId ?? "").trim();
  if (!id) throw httpError(400, "taxReturnId is required");
  return id;
}

/** Map a Node case id to the Toxel taxReturnId (identity). */
export function toTaxReturnId(caseId: string | null | undefined): string {
  const id = (caseId ?? "").trim();
  if (!id) throw httpError(400, "caseId is required");
  return id;
}

/** True when both identifiers refer to the same underlying case. */
export function idsReferToSameCase(taxReturnId: string, caseId: string): boolean {
  return toCaseId(taxReturnId) === toCaseId(caseId);
}

/**
 * Decorate a case-shaped object with `taxReturnId` (= `id` / `caseId`) for Toxel responses.
 * Does not mutate domain collections — response shaping only.
 */
export function withTaxReturnId<T extends Record<string, unknown>>(doc: T): T & {
  taxReturnId: string;
} {
  const caseId = String(doc.id ?? doc.caseId ?? doc.case_id ?? "");
  if (!caseId) throw httpError(500, "Cannot derive taxReturnId without a case id");
  return { ...doc, taxReturnId: toTaxReturnId(caseId) };
}
