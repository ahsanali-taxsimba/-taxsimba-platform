/**
 * 150+ tax intelligence retrieval scenarios grounded in HMRC/GOV.UK corpus.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadFacts, reloadFacts } from "../src/knowledge/loader.js";
import { retrieve } from "../src/knowledge/retrieval.js";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(
    path.join(__dirname, "fixtures/tax_intelligence_150.json"),
    "utf-8",
  ),
) as {
  scenarios: Array<{
    id: string;
    query: string;
    tax_year: string;
    expected_fact_id: string;
    must_include_any: string[];
  }>;
};

describe("tax intelligence 150 scenarios", () => {
  beforeEach(() => reloadFacts());
  afterEach(() => reloadFacts());

  it("fixture_has_at_least_150_cases", () => {
    expect(fixture.scenarios.length).toBeGreaterThanOrEqual(150);
  });

  it("corpus_facts_are_gov_uk_sourced", () => {
    const facts = loadFacts();
    expect(facts.length).toBeGreaterThanOrEqual(45);
    for (const f of facts) {
      expect(f.source_url.startsWith("https://www.gov.uk")).toBe(true);
    }
  });

  it.each(fixture.scenarios.map((s) => [s.id, s] as const))(
    "retrieval_%s",
    (_id, s) => {
      const ranked = retrieve(s.query, s.tax_year, 8);
      expect(ranked.length).toBeGreaterThan(0);
      const ids = ranked.map((r) => r.fact.id);
      expect(ids).toContain(s.expected_fact_id);
      const hit = ranked.find((r) => r.fact.id === s.expected_fact_id)!;
      expect(hit.fact.source_url.startsWith("https://www.gov.uk")).toBe(true);
      const hay = (
        hit.fact.summary +
        " " +
        hit.fact.keywords.join(" ") +
        " " +
        hit.fact.title
      ).toLowerCase();
      const ok = s.must_include_any.some((bit) =>
        hay.includes(bit.toLowerCase()),
      );
      expect(ok).toBe(true);
    },
  );
});
