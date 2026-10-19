import { describe, expect, it } from "vitest";

import {
  AML_CASE_STATUSES,
  AML_DOC_TYPES,
  REQUIRED_PROOF_OF_ADDRESS,
  REVIEW_CHECKLIST_LABELS,
  defaultNextReviewDue,
} from "../../src/domain/aml";

describe("AML domain constants", () => {
  it("requires two proofs of address for individual CDD", () => {
    expect(REQUIRED_PROOF_OF_ADDRESS).toBe(2);
    expect(AML_DOC_TYPES).toContain("PASSPORT");
    expect(AML_DOC_TYPES).toContain("PROOF_OF_ADDRESS");
    expect(AML_DOC_TYPES).toContain("SELFIE");
    expect(AML_CASE_STATUSES).toContain("APPROVED");
  });

  it("includes structured review checklist labels", () => {
    expect(REVIEW_CHECKLIST_LABELS.id_matches_client).toMatch(/Identity/i);
    expect(REVIEW_CHECKLIST_LABELS.selfie_matches_id).toMatch(/Live photo/i);
  });

  it("sets shorter review cycles for higher risk", () => {
    const low = new Date(defaultNextReviewDue("LOW")).getFullYear();
    const high = new Date(defaultNextReviewDue("HIGH")).getFullYear();
    expect(low - high).toBeGreaterThanOrEqual(1);
  });
});
