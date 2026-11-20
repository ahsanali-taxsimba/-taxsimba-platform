import { describe, expect, it } from "vitest";
import {
  detectConsultationSelection,
  isConsultationIntent,
} from "../src/knowledge/consultation_booking.js";

describe("consultation price boundary", () => {
  it("does not treat £99000 PAYE as Quick £99 consultation", () => {
    expect(detectConsultationSelection("paye only £99000. mtd?")).toBeNull();
    expect(isConsultationIntent("paye only £99000. mtd?")).toBe(false);
  });

  it("still detects explicit £99 consultation choice", () => {
    expect(detectConsultationSelection("I'll take the £99 consultation")?.price_gbp).toBe(
      99,
    );
  });
});
