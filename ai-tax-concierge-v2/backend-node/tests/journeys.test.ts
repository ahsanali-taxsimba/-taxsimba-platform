import { describe, expect, it } from "vitest";
import {
  advanceJourney,
  listJourneys,
  startJourney,
} from "../src/journeys/engine.js";

describe("journeys", () => {
  it("list_journeys_covers_required_personas", () => {
    const ids = new Set(listJourneys().map((j) => j.id));
    expect(ids.size).toBe(12);
    for (const required of [
      "first_time",
      "freelancer",
      "landlord",
      "cis",
      "mtd",
      "consultation",
      "existing_client",
      "missed_deadline",
    ]) {
      expect(ids.has(required)).toBe(true);
    }
  });

  it("journey_asks_one_question_at_a_time", () => {
    const state = startJourney("freelancer");
    expect(state.complete).toBe(false);
    expect(state.current).not.toBeNull();
    expect(state.current?.prompt).toBeTruthy();
    expect(state.current!.options.length).toBeGreaterThanOrEqual(2);
  });

  it("freelancer_journey_completes_with_recommendations", () => {
    let state = startJourney("freelancer");
    state = advanceJourney(state, state.current!.options[0].id);
    expect(state.complete).toBe(false);
    state = advanceJourney(state, state.current!.options[0].id);
    expect(state.complete).toBe(true);
    expect(state.summary).toBeTruthy();
    expect(state.suggested_package_codes?.length).toBeGreaterThan(0);
    expect(state.follow_ups?.length).toBeGreaterThan(0);
  });

  it("invalid_option_raises", () => {
    const state = startJourney("cis");
    expect(() => advanceJourney(state, "not-a-real-option")).toThrow();
  });
});
