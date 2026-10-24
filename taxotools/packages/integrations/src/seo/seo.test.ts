import { describe, expect, it } from "vitest";
import {
  heuristicKeywordMetrics,
  suggestKeywords,
  phrasesFromCrawlPages,
  estimateRankFromCrawl,
  checkKeywordRank,
  generateSeoContent,
  scanAeoPrompt,
  listSeoProviderStatuses,
} from "../index";

describe("@taxotools/integrations seo", () => {
  it("heuristic keyword metrics are stable and positive", () => {
    const a = heuristicKeywordMetrics("seo tools");
    const b = heuristicKeywordMetrics("seo tools");
    expect(a.volume).toBe(b.volume);
    expect(a.volume).toBeGreaterThan(0);
    expect(a.difficulty).toBeGreaterThan(0);
    expect(a.mode).toBe("heuristic");
  });

  it("suggests keywords without API keys", async () => {
    const res = await suggestKeywords("accountancy");
    expect(res.suggestions.length).toBeGreaterThan(5);
    expect(res.mode).toBe("heuristic");
    expect(res.suggestions[0].keyword).toContain("accountancy");
  });

  it("extracts phrases from crawl pages", () => {
    const phrases = phrasesFromCrawlPages([
      { title: "VAT Returns Guide | Firm", path: "/vat-returns" },
      { title: "CIS Tax Advice", path: "/cis-tax" },
    ]);
    expect(phrases).toContain("vat returns guide");
    expect(phrases).toContain("cis tax advice");
  });

  it("estimates rank from crawl page relevance", () => {
    const rank = estimateRankFromCrawl("vat returns", "firm.co.uk", [
      {
        url: "https://firm.co.uk/vat-returns",
        title: "VAT Returns for UK Businesses",
        metaDescription: "File VAT returns with our accountants",
        path: "/vat-returns",
        wordCount: 900,
      },
    ]);
    expect(rank.mode).toBe("crawl-derived");
    expect(rank.position).not.toBeNull();
    expect(rank.url).toContain("vat-returns");
  });

  it("checkKeywordRank falls back without SERP key", async () => {
    const rank = await checkKeywordRank({
      phrase: "payroll services",
      domain: "firm.co.uk",
      pages: [
        {
          url: "https://firm.co.uk/payroll",
          title: "Payroll Services",
          wordCount: 500,
        },
      ],
    });
    expect(["crawl-derived", "heuristic"]).toContain(rank.mode);
  });

  it("generates stub content without OpenAI", async () => {
    const res = await generateSeoContent({ type: "ARTICLE", keyword: "seo audit" });
    expect(res.mode).toBe("heuristic");
    expect(res.output.bodyMarkdown || res.output.title).toBeTruthy();
  });

  it("scans AEO heuristically without OpenAI", async () => {
    const res = await scanAeoPrompt({
      prompt: "best UK accountant software",
      engineCode: "CHATGPT",
      brand: "TaxoFirm",
      domain: "taxofirm.co.uk",
    });
    expect(res.mode).toBe("heuristic");
    expect(res.rawAnswer.length).toBeGreaterThan(10);
  });

  it("lists SEO provider statuses", () => {
    const statuses = listSeoProviderStatuses();
    expect(statuses.map((s) => s.id)).toContain("serpapi");
    expect(statuses.map((s) => s.id)).toContain("keywords_everywhere");
  });
});
