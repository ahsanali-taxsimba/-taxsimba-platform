import { describe, expect, it } from "vitest";
import {
  advanceJourney,
  listJourneys,
  startJourney,
} from "../src/journeys/engine.js";
import { api, buildTestApp } from "./helpers.js";

const ALL_JOURNEY_IDS = listJourneys().map((j) => j.id);

function completeJourney(journeyId: string, pickFirst = true) {
  let state = startJourney(journeyId);
  while (!state.complete) {
    expect(state.current?.options?.length).toBeGreaterThan(0);
    const opts = state.current!.options;
    const optId = pickFirst ? opts[0].id : opts[opts.length - 1].id;
    state = advanceJourney(state, optId);
  }
  return state;
}

describe("full guided journeys", () => {
  it.each(ALL_JOURNEY_IDS)(
    "each_journey_starts_with_prompt: %s",
    (journeyId) => {
      const state = startJourney(journeyId);
      expect(state.journey_id).toBe(journeyId);
      expect(state.complete).toBe(false);
      expect(state.current).not.toBeNull();
      expect(state.current?.prompt).toBeTruthy();
      expect(state.current!.options.length).toBeGreaterThanOrEqual(2);
    },
  );

  it("freelancer_journey_completes_with_sa_packages", () => {
    const state = completeJourney("freelancer");
    expect(state.complete).toBe(true);
    expect(state.summary).toBeTruthy();
    expect(state.suggested_package_codes?.length).toBeGreaterThan(0);
    expect(state.suggested_package_codes!.some((c) => c.startsWith("SA_"))).toBe(
      true,
    );
    expect(state.follow_ups?.length).toBeGreaterThan(0);
  });

  it("consultation_journey_includes_accountant_package", () => {
    const state = completeJourney("consultation");
    expect(state.suggested_package_codes).toContain("ACCOUNTANT_CONSULT_99");
    expect(
      (state.summary || "").includes("£99") || (state.summary || "").includes("99"),
    ).toBe(true);
  });

  it("existing_client_does_not_suggest_paid_consultation", () => {
    const state = completeJourney("existing_client");
    expect(state.suggested_package_codes).not.toContain("ACCOUNTANT_CONSULT_99");
    expect(state.suggested_package_codes).toEqual([]);
  });

  it("missed_deadline_journey_completes", () => {
    const state = completeJourney("missed_deadline");
    expect(state.complete).toBe(true);
    expect(
      state.tags?.some((t) => t.includes("deadline")) ||
        state.tags?.includes("missed_deadline"),
    ).toBe(true);
  });

  it.each([
    "cis",
    "landlord",
    "mtd",
    "sole_trader",
    "self_employed",
    "multiple_income",
  ])("journey_completes_without_error: %s", (journeyId) => {
    const state = completeJourney(journeyId);
    expect(state.complete).toBe(true);
    expect(state.summary).toBeTruthy();
  });

  it("invalid_journey_option_returns_400", async () => {
    const app = buildTestApp();
    const start = await api(app)
      .post("/api/v1/journeys/start")
      .send({ journey_id: "cis", session_id: "journey-invalid" });
    expect(start.status).toBe(200);
    const state = start.body.journey;
    const bad = await api(app)
      .post("/api/v1/journeys/advance")
      .send({
        session_id: "journey-invalid",
        option_id: "definitely-not-valid",
        journey_state: state,
      });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("validation_error");
  });

  it("consultation_api_completion_packages", async () => {
    const app = buildTestApp();
    const sid = "consult-api";
    const start = await api(app)
      .post("/api/v1/journeys/start")
      .send({ journey_id: "consultation", session_id: sid });
    let state = start.body.journey;
    for (let i = 0; i < 4; i++) {
      if (state.complete) break;
      const opt = state.current.options[0].id;
      const adv = await api(app)
        .post("/api/v1/journeys/advance")
        .send({ session_id: sid, option_id: opt, journey_state: state });
      expect(adv.status).toBe(200);
      state = adv.body.journey;
    }
    const codes = state.suggested_package_codes || [];
    expect(codes).toContain("ACCOUNTANT_CONSULT_99");
  });
});
