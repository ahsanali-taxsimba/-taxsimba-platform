/**
 * 50 realistic package / sales journeys — circumstance-aware, not most-expensive-first.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  advanceJourney,
  startJourney,
} from "../src/journeys/engine.js";
import {
  answerInclusionsQuestion,
  recommendForMessage,
  toPackageCards,
} from "../src/ai/recommendations.js";
import { primaryRecommendationIsNotMostExpensive } from "../src/ai/package_selection.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(
    path.join(__dirname, "fixtures/package_journeys_50.json"),
    "utf-8",
  ),
) as {
  journeys: Array<{
    id: string;
    kind: "guided" | "message";
    journey_id?: string;
    path?: string[];
    message?: string;
    expect_any?: string[];
    expect_codes?: string[];
    forbid?: string[];
    forbid_only_most_expensive?: boolean;
    expect_inclusions_guard?: boolean;
    expect_price?: number;
    note?: string;
  }>;
};

const WEBSITE = "https://www.taxsimba.co.uk";

function runGuided(journeyId: string, optionPath: string[]) {
  let state = startJourney(journeyId);
  for (const opt of optionPath) {
    expect(state.complete).toBe(false);
    state = advanceJourney(state, opt);
  }
  expect(state.complete).toBe(true);
  return state;
}

describe("package recommendation journeys 50", () => {
  it("fixture_has_50_journeys", () => {
    expect(fixture.journeys.length).toBe(50);
  });

  it.each(fixture.journeys.map((j) => [j.id, j] as const))(
    "journey_%s",
    (_id, j) => {
      if (j.kind === "guided") {
        const state = runGuided(j.journey_id!, j.path || []);
        const codes = state.suggested_package_codes || [];
        if (j.expect_codes) {
          expect(codes).toEqual(j.expect_codes);
        }
        if (j.expect_any?.length) {
          expect(j.expect_any.some((c) => codes.includes(c))).toBe(true);
        }
        for (const bad of j.forbid || []) {
          expect(codes).not.toContain(bad);
        }
        expect(primaryRecommendationIsNotMostExpensive(codes)).toBe(true);
        for (const card of toPackageCards(codes)) {
          expect(card.inclusions_status).toBe("not_specified_in_catalog");
        }
        return;
      }

      // message journeys
      if (j.expect_inclusions_guard) {
        const guard = answerInclusionsQuestion(j.message!);
        expect(guard).toBeTruthy();
        expect(guard!.toLowerCase()).toContain("not invent");
        return;
      }

      const { packages } = recommendForMessage(j.message!, null, WEBSITE);
      const codes = packages.map((p) => p.code);
      if (j.expect_codes) {
        expect(codes).toEqual(j.expect_codes);
      }
      if (j.expect_any?.length) {
        expect(j.expect_any.some((c) => codes.includes(c))).toBe(true);
      }
      for (const bad of j.forbid || []) {
        expect(codes).not.toContain(bad);
      }
      if (j.forbid_only_most_expensive) {
        expect(primaryRecommendationIsNotMostExpensive(codes)).toBe(true);
      }
      if (j.expect_price != null) {
        expect(packages.some((p) => p.price_gbp === j.expect_price)).toBe(true);
      }
      expect(
        packages.every((p) => p.inclusions_status === "not_specified_in_catalog"),
      ).toBe(true);
    },
  );
});
