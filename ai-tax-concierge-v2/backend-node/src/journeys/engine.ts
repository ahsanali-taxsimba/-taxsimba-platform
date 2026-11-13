/** Guided journey engine — one question at a time with retained context. */

import { readFileSync } from "node:fs";
import { JOURNEYS_DEFINITIONS } from "../paths.js";
import { resolvePackages } from "../catalog/service.js";
import type { JourneyState, JourneyStepView } from "../models/schemas.js";

let cache: Record<string, any> | null = null;

function raw(): Record<string, any> {
  if (!cache) {
    cache = JSON.parse(readFileSync(JOURNEYS_DEFINITIONS, "utf-8"));
  }
  return cache!;
}

export function listJourneys(): Array<{
  id: string;
  title: string;
  description: string;
}> {
  return (raw().journeys as Record<string, any>[]).map((j) => ({
    id: j.id,
    title: j.title,
    description: j.description,
  }));
}

export function getJourney(journeyId: string): Record<string, any> | null {
  for (const j of raw().journeys as Record<string, any>[]) {
    if (j.id === journeyId) return j;
  }
  return null;
}

function stepMap(journey: Record<string, any>): Record<string, any> {
  const map: Record<string, any> = {};
  for (const s of journey.steps as Record<string, any>[]) {
    map[s.id] = s;
  }
  return map;
}

export function startJourney(journeyId: string): JourneyState {
  const journey = getJourney(journeyId);
  if (!journey) throw new Error(`Unknown journey: ${journeyId}`);
  const first = (journey.steps as Record<string, any>[])[0]!;
  const current: JourneyStepView = {
    step_id: first.id,
    prompt: first.prompt,
    options: ((first.options || []) as Record<string, any>[]).map((o) => ({
      id: o.id,
      label: o.label,
    })),
  };
  return {
    journey_id: journeyId,
    journey_title: journey.title,
    step_id: first.id,
    complete: false,
    answers: {},
    tags: [],
    current,
  };
}

export function advanceJourney(
  state: JourneyState,
  optionId: string,
): JourneyState {
  const journey = getJourney(state.journey_id);
  if (!journey) throw new Error("Unknown journey");
  const steps = stepMap(journey);
  const current = steps[state.step_id];
  if (!current) throw new Error("Unknown journey step");
  const options: Record<string, any> = {};
  for (const o of (current.options || []) as Record<string, any>[]) {
    options[o.id] = o;
  }
  if (!(optionId in options)) {
    throw new Error("Invalid option for current step");
  }

  const chosen = options[optionId]!;
  const answers = { ...state.answers, [state.step_id]: optionId };
  const tags = [
    ...new Set([...(state.tags || []), ...((chosen.tags || []) as string[])]),
  ];

  const nextId = chosen.next as string | undefined;
  const nextStep = nextId ? steps[nextId] : null;
  if (!nextStep) throw new Error("Journey graph error: missing next step");

  if (nextStep.prompt === null || nextStep.prompt === undefined) {
    const packages = resolvePackages(
      (nextStep.suggest_packages || []) as string[],
    );
    return {
      journey_id: state.journey_id,
      journey_title: journey.title,
      step_id: nextStep.id,
      complete: true,
      answers,
      tags,
      current: null,
      summary: nextStep.summary_template ?? null,
      suggested_package_codes: packages.map((p) => String(p.code)),
      suggested_calculator_ids: [
        ...((nextStep.suggest_calculators || []) as string[]),
      ],
      follow_ups: [...((nextStep.follow_ups || []) as string[])],
    };
  }

  return {
    journey_id: state.journey_id,
    journey_title: journey.title,
    step_id: nextStep.id,
    complete: false,
    answers,
    tags,
    current: {
      step_id: nextStep.id,
      prompt: nextStep.prompt,
      options: ((nextStep.options || []) as Record<string, any>[]).map(
        (o) => ({
          id: o.id,
          label: o.label,
        }),
      ),
    },
  };
}

export function journeyContextBlurb(state?: JourneyState | null): string {
  if (!state) return "";
  const bits = [
    `Active guided journey: ${state.journey_title} (${state.journey_id}).`,
  ];
  if (state.answers && Object.keys(state.answers).length) {
    bits.push(`Answers so far: ${JSON.stringify(state.answers)}.`);
  }
  if (state.tags?.length) {
    bits.push(`Tags: ${state.tags.join(", ")}.`);
  }
  if (state.complete && state.summary) {
    bits.push(`Journey complete summary: ${state.summary}`);
  }
  return bits.join(" ");
}
