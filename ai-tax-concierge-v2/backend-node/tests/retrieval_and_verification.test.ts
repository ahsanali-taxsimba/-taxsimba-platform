import { describe, expect, it } from "vitest";
import { loadFacts } from "../src/knowledge/loader.js";
import { retrieve, type RankedFact } from "../src/knowledge/retrieval.js";
import {
  confidenceFromSources,
  verifyRanked,
} from "../src/knowledge/verification.js";
import type { KnowledgeFact } from "../src/models/schemas.js";

describe("retrieval and verification", () => {
  it("corpus_loads_and_has_govuk_sources", () => {
    const facts = loadFacts();
    expect(facts.length).toBeGreaterThanOrEqual(8);
    expect(facts.every((f) => f.source_url.startsWith("https://www.gov.uk"))).toBe(
      true,
    );
  });

  it("retrieve_self_assessment_deadline", () => {
    const ranked = retrieve(
      "When is the Self Assessment online filing deadline?",
      "2025-26",
    );
    expect(ranked.length).toBeGreaterThan(0);
    expect(
      ranked.some(
        (r) =>
          r.fact.id.includes("deadline") ||
          r.fact.title.toLowerCase().includes("deadline"),
      ),
    ).toBe(true);
    expect(ranked[0].year_match).toBe(true);
  });

  it("retrieve_personal_allowance_year_aware", () => {
    const ranked = retrieve("What is the personal allowance?", "2025-26");
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].fact.tax_years).toContain("2025-26");
  });

  it("verify_accepts_govuk_rejects_unknown_host", () => {
    const good = retrieve("Making Tax Digital quarterly updates", "2025-26");
    const sources = verifyRanked(good);
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((s) => s.verified)).toBe(true);
    expect(sources.every((s) => s.url.includes("gov.uk"))).toBe(true);

    const evil: KnowledgeFact = {
      id: "evil",
      title: "Fake",
      summary: "bad",
      keywords: ["fake"],
      tax_years: ["2025-26"],
      source_url: "https://evil.example.com/tax",
      publisher: "Not HMRC",
      category: "general",
      last_verified: "2026-01-01",
    };
    const rankedEvil: RankedFact[] = [
      { fact: evil, score: 10.0, year_match: true },
    ];
    const verified = verifyRanked(rankedEvil);
    expect(verified).toEqual([]);
  });

  it("confidence_levels", () => {
    const ranked = retrieve(
      "Self Assessment payments on account 31 July",
      "2025-26",
    );
    const sources = verifyRanked(ranked);
    const yearMatches = ranked.filter((r) => r.year_match).length;
    const level = confidenceFromSources(sources, yearMatches);
    expect(["high", "medium", "low"]).toContain(level);
    expect(confidenceFromSources([], 0)).toBe("low");
  });
});
