/**
 * Privacy helpers for compat responses — always reuse Node maskContactMany.
 * Compat MUST NOT unmask email/phone for ADMIN or ACCOUNTANT.
 */

import { Doc, maskContact, maskContactMany } from "../db/mongo";

/** Apply the same contact-masking rules used by native admin list endpoints. */
export function maskContactsForViewer(docs: Doc[], viewer: Doc): Doc[] {
  return maskContactMany(docs.map((d) => ({ ...d })), viewer);
}

export function maskContactForViewer(doc: Doc | null, viewer: Doc): Doc | null {
  if (!doc) return null;
  return maskContact({ ...doc }, viewer);
}
