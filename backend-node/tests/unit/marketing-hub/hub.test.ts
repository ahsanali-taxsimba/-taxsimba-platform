import { describe, expect, it } from "vitest";

import { assertTransition } from "../../../src/marketing-hub/publishing";
import {
  assertNoFalseApprovals,
  buildTemplateLibrary,
  templatesByBatch,
} from "../../../src/marketing-hub/templates";
import { loadArticleInventory } from "../../../src/marketing-hub/seo";
import { PROPOSED_STARTING_PRICES, BRAND } from "../../../src/marketing-hub/config";

describe("marketing hub templates", () => {
  it("builds 120 templates in 12 batches of 10 with stable ids", () => {
    const templates = buildTemplateLibrary("2026-10-27T00:00:00.000Z");
    expect(templates).toHaveLength(120);
    expect(templates[0].id).toBe("tmpl-001");
    expect(templates[119].id).toBe("tmpl-120");
    const batches = templatesByBatch(templates);
    expect(Object.keys(batches)).toHaveLength(12);
    for (let b = 1; b <= 12; b += 1) {
      expect(batches[b]).toHaveLength(10);
    }
  });

  it("never marks unfinished artwork as approved", () => {
    const templates = buildTemplateLibrary();
    expect(templates.every((t) => t.status !== "approved")).toBe(true);
    expect(templates.every((t) => t.artworkStatus === "missing")).toBe(true);
    expect(() => assertNoFalseApprovals(templates)).not.toThrow();
    const bad = { ...templates[0], status: "approved" as const };
    expect(() => assertNoFalseApprovals([bad])).toThrow(/cannot be approved/);
  });
});

describe("publishing transitions", () => {
  it("allows forward workflow only", () => {
    expect(() => assertTransition("ai_draft", "content_qa")).not.toThrow();
    expect(() => assertTransition("content_qa", "approval")).not.toThrow();
    expect(() => assertTransition("ai_draft", "confirmed_published")).toThrow();
    expect(() => assertTransition("scheduled", "failed")).not.toThrow();
  });
});

describe("brand and pricing guards", () => {
  it("exposes approved palette and proposed prices with disclaimer", () => {
    expect(BRAND.forest).toBe("#031f18");
    expect(BRAND.green).toBe("#37A267");
    expect(BRAND.mint).toBe("#EAF6F0");
    expect(BRAND.lime).toBe("#B3ED97");
    expect(PROPOSED_STARTING_PRICES.selfAssessmentGbp).toBe(119);
    expect(PROPOSED_STARTING_PRICES.mtdGbp).toBe(29.99);
    expect(PROPOSED_STARTING_PRICES.disclaimer.toLowerCase()).toContain("verified");
  });
});

describe("article inventory preservation", () => {
  it("loads 120 inventory rows when CSV is present", () => {
    const inv = loadArticleInventory();
    expect(inv.ok).toBe(true);
    expect(inv.count).toBe(120);
  });
});
