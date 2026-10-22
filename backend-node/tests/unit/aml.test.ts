import { describe, expect, it } from "vitest";

import {
  AML_CASE_STATUSES,
  AML_DOC_TYPES,
  REQUIRED_PROOF_OF_ADDRESS,
  REVIEW_CHECKLIST_LABELS,
  defaultNextReviewDue,
} from "../../src/domain/aml";
import { computeAmlProgress } from "../../src/services/aml";

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

describe("computeAmlProgress — deferred live photo", () => {
  const baseCase = {
    date_of_birth: "1990-01-01",
    residential_address: "1 High St",
    live_photo_deferred: false,
  };

  it("is ready to submit without a selfie so signup can continue", () => {
    const progress = computeAmlProgress(baseCase, [
      { type: "PASSPORT" },
      { type: "PROOF_OF_ADDRESS" },
      { type: "PROOF_OF_ADDRESS" },
    ]);
    expect(progress.ready_to_submit).toBe(true);
    expect(progress.live_photo_captured).toBe(false);
    expect(progress.live_photo_required_for_submit).toBe(false);
  });

  it("marks live photo deferred when flagged and still missing", () => {
    const progress = computeAmlProgress(
      { ...baseCase, live_photo_deferred: true },
      [{ type: "PASSPORT" }, { type: "PROOF_OF_ADDRESS" }, { type: "PROOF_OF_ADDRESS" }],
    );
    expect(progress.live_photo_deferred).toBe(true);
    expect(progress.ready_to_submit).toBe(true);
  });

  it("clears deferred once selfie is uploaded", () => {
    const progress = computeAmlProgress(
      { ...baseCase, live_photo_deferred: true },
      [
        { type: "PASSPORT" },
        { type: "PROOF_OF_ADDRESS" },
        { type: "PROOF_OF_ADDRESS" },
        { type: "SELFIE" },
      ],
    );
    expect(progress.live_photo_captured).toBe(true);
    expect(progress.live_photo_deferred).toBe(false);
  });
});
