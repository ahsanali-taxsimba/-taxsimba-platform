import { describe, expect, it } from "vitest";

import {
  ALLOWED_TRANSITIONS,
  clientStatus,
  deadlineForTaxYear,
  journey,
  paymentDeadlineLabel,
  STATUSES,
  STATUS_META,
} from "../../src/domain/workflow";

describe("workflow constants", () => {
  it("keeps the 18 Self Assessment statuses and their metadata", () => {
    expect(STATUSES).toHaveLength(18);
    for (const status of STATUSES) expect(STATUS_META[status]).toHaveLength(3);
  });

  it("never allows a stage to be skipped", () => {
    expect(ALLOWED_TRANSITIONS.AWAITING_ASSIGNMENT).toEqual(["ASSIGNED"]);
    expect(ALLOWED_TRANSITIONS.ADMIN_APPROVED).toEqual(["AWAITING_CLIENT_APPROVAL"]);
    expect(ALLOWED_TRANSITIONS.CLIENT_APPROVED).toEqual(["READY_FOR_SUBMISSION"]);
    expect(ALLOWED_TRANSITIONS.NEW).not.toContain("SUBMITTED");
    // Completed cases are locked apart from an audited admin reopen.
    expect(ALLOWED_TRANSITIONS.COMPLETED).toEqual(["ACCOUNTANT_REVIEW", "ASSIGNED"]);
  });

  it("only ever targets known statuses", () => {
    for (const targets of Object.values(ALLOWED_TRANSITIONS)) {
      for (const target of targets) expect(STATUSES).toContain(target);
    }
  });
});

describe("deadlines", () => {
  it("uses 31 January following the end of the tax year", () => {
    expect(deadlineForTaxYear("2024/25")).toBe("2026-01-31T23:59:00+00:00");
    expect(deadlineForTaxYear("2025/26")).toBe("2027-01-31T23:59:00+00:00");
    expect(deadlineForTaxYear("nonsense")).toBeNull();
    expect(paymentDeadlineLabel("2024/25")).toBe("31 January 2026");
  });
});

describe("client-facing wording", () => {
  it("never exposes an internal enum", () => {
    expect(clientStatus("AWAITING_CLIENT")).toBe("Waiting for you");
    expect(clientStatus("SOMETHING_NEW")).toBe("Something new");
  });

  it("derives the five-step journey from status", () => {
    const steps = journey("AWAITING_CLIENT").map((s) => s.step);
    expect(steps).toEqual([
      "Information",
      "Documents",
      "Accountant Review",
      "Your Approval",
      "HMRC Submission",
    ]);
    expect(journey("AWAITING_CLIENT")[1].state).toBe("Documents Required");
    expect(journey("SUBMITTED", true)[4].state).toBe("Submitted Successfully");
    expect(journey("SUBMISSION_ISSUE")[4].state).toBe("Submission Failed");
    expect(journey("CLIENT_APPROVED")[3].state).toBe("Approved");
  });
});
