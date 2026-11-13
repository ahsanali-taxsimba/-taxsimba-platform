import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { loadFacts, reloadFacts } from "../src/knowledge/loader.js";
import { retrieve } from "../src/knowledge/retrieval.js";

type KnowledgeCase = [string, string, string, readonly string[]];

const KNOWLEDGE_CASES: KnowledgeCase[] = [
  [
    "MTD £50000 qualifying income threshold 6 April 2026",
    "2025-26",
    "mtd-threshold-50k-april-2026",
    ["50000", "april 2026"],
  ],
  [
    "Making Tax Digital £30000 threshold from 6 April 2027",
    "2026-27",
    "mtd-threshold-30k-april-2027",
    ["30000", "april 2027"],
  ],
  [
    "MTD income tax £20000 threshold April 2028",
    "2027-28",
    "mtd-threshold-20k-april-2028",
    ["20000", "april 2028"],
  ],
  [
    "When do I need to register for VAT taxable turnover threshold",
    "2025-26",
    "vat-threshold-overview",
    ["90000", "vat"],
  ],
  [
    "qualifying income turnover gross not profit expenses MTD",
    "2025-26",
    "mtd-qualifying-income-definition",
    ["turnover", "profit"],
  ],
  [
    "MTD digital records quarterly updates compatible software",
    "2026-27",
    "mtd-digital-records-quarterly",
    ["quarterly", "digital records"],
  ],
  [
    "When is the Self Assessment online filing deadline?",
    "2025-26",
    "sa-deadline-online",
    ["31 january", "online"],
  ],
  [
    "Self Assessment paper return deadline 31 October",
    "2025-26",
    "sa-paper-deadline",
    ["31 october", "paper"],
  ],
  [
    "Self Assessment penalties late filing payment",
    "2025-26",
    "sa-penalties-overview",
    ["penalt"],
  ],
  [
    "CIS construction industry scheme subcontractor deduction",
    "2025-26",
    "cis-overview",
    ["cis", "subcontract"],
  ],
  [
    "landlord UK property rental income Self Assessment",
    "2025-26",
    "property-income-overview",
    ["property", "rent"],
  ],
  [
    "Rent a Room allowance £7500 property",
    "2025-26",
    "rent-a-room",
    ["rent a room"],
  ],
  [
    "cryptoassets tax Self Assessment disposal gains",
    "2025-26",
    "cryptoassets-tax",
    ["crypto"],
  ],
  [
    "payments on account 31 July Self Assessment",
    "2025-26",
    "payment-on-account",
    ["31 july", "payments on account"],
  ],
  [
    "register for Self Assessment UTR sole trader",
    "2025-26",
    "register-self-assessment",
    ["register", "self assessment"],
  ],
  [
    "personal allowance 2025-26 income tax",
    "2025-26",
    "personal-allowance-2025-26",
    ["personal allowance"],
  ],
  [
    "Making Tax Digital income tax overview sole trader landlord",
    "2025-26",
    "mtd-income-tax-overview",
    ["making tax digital"],
  ],
  [
    "trading allowance £1000 self employment",
    "2025-26",
    "trading-allowance",
    ["trading allowance"],
  ],
  [
    "property allowance £1000 landlord",
    "2025-26",
    "property-allowance",
    ["property allowance"],
  ],
];

describe("knowledge accuracy", () => {
  beforeEach(() => {
    reloadFacts();
  });
  afterEach(() => {
    reloadFacts();
  });

  it("corpus_sources_are_gov_uk", () => {
    const facts = loadFacts();
    expect(facts.length).toBeGreaterThanOrEqual(20);
    for (const fact of facts) {
      expect(fact.source_url.startsWith("https://www.gov.uk")).toBe(true);
    }
  });

  it("mtd_facts_carry_review_status", () => {
    const facts = Object.fromEntries(loadFacts().map((f) => [f.id, f]));
    for (const mtdId of [
      "mtd-who-and-when",
      "mtd-threshold-50k-april-2026",
      "mtd-threshold-30k-april-2027",
      "mtd-threshold-20k-april-2028",
      "mtd-qualifying-income-definition",
      "mtd-digital-records-quarterly",
    ]) {
      const fact = facts[mtdId];
      expect(fact.review_status).toBeTruthy();
      expect(String(fact.review_status).toLowerCase()).toContain("govuk");
      expect(
        fact.tax_years.includes("2025-26") ||
          fact.tax_years.includes("2026-27"),
      ).toBe(true);
    }
  });

  it("vat_threshold_fact_is_90000_not_85000", () => {
    const facts = Object.fromEntries(loadFacts().map((f) => [f.id, f]));
    const vat = facts["vat-threshold-overview"];
    expect(vat.summary).toContain("£90,000");
    expect(vat.summary.toLowerCase()).toContain("outdated");
    expect(vat.summary).toContain("£85,000");
    expect(vat.summary.indexOf("£90,000")).toBeLessThan(
      vat.summary.indexOf("£85,000"),
    );
  });

  it.each(KNOWLEDGE_CASES)(
    "retrieval_returns_expected_fact: %s",
    (query, taxYear, expectedId, contentBits) => {
      const ranked = retrieve(query, taxYear, 5);
      expect(ranked.length).toBeGreaterThan(0);
      const ids = ranked.map((r) => r.fact.id);
      expect(ids).toContain(expectedId);
      const top = ranked.find((r) => r.fact.id === expectedId)!;
      expect(top.fact.source_url.startsWith("https://www.gov.uk")).toBe(true);
      const summary = top.fact.summary.toLowerCase();
      for (const bit of contentBits) {
        expect(
          summary.includes(bit.toLowerCase()) ||
            top.fact.keywords.some((k) =>
              k.toLowerCase().includes(bit.toLowerCase()),
            ),
        ).toBe(true);
      }
    },
  );

  it.each(["2025-26", "2026-27", "2027-28"])(
    "mtd_threshold_fact_year_applicability: %s",
    (taxYear) => {
      const ranked = retrieve(
        "Making Tax Digital threshold qualifying income",
        taxYear,
        3,
      );
      const mtdHits = ranked.filter((r) => r.fact.id === "mtd-who-and-when");
      expect(mtdHits.length).toBeGreaterThan(0);
      expect(mtdHits[0].year_match).toBe(true);
    },
  );

  it.each([
    ["£50,000", "2025-26", "mtd-threshold-50k-april-2026"],
    ["£30,000", "2026-27", "mtd-threshold-30k-april-2027"],
    ["£20,000", "2027-28", "mtd-threshold-20k-april-2028"],
  ] as const)("mtd_threshold_phrases_in_top_fact: %s", (phrase, year, expectedId) => {
    const ranked = retrieve(`MTD threshold ${phrase}`, year);
    const top = ranked[0];
    expect(top.fact.id).toBe(expectedId);
    expect(
      top.fact.summary.replace(/,/g, "").includes(phrase.replace(/,/g, "")),
    ).toBe(true);
  });
});
