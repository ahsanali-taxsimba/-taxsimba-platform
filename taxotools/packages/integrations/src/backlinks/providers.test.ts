import { describe, expect, it } from "vitest";
import {
  oprToAuthority,
  stubBacklinks,
  createCrawlGraphProvider,
  createOpenPageRankProvider,
  listBacklinkProviderStatuses,
  fetchBacklinksFromProviders,
} from "../index";

describe("@taxotools/integrations backlink providers", () => {
  it("maps Open PageRank 0-10 to 0-100 authority", () => {
    expect(oprToAuthority(9.67)).toBe(97);
    expect(oprToAuthority(0)).toBe(0);
    expect(oprToAuthority(null)).toBe(30);
  });

  it("returns stub backlinks without API keys", async () => {
    const cg = createCrawlGraphProvider();
    const opr = createOpenPageRankProvider();
    expect(cg.isConfigured()).toBe(false);
    expect(opr.isConfigured()).toBe(false);

    const a = await cg.fetchBacklinks({
      domain: "example.com",
      siteUrl: "https://example.com",
    });
    expect(a.mode).toBe("stub");
    expect(a.links.length).toBeGreaterThan(0);
    expect(a.links[0].sourceApi).toBe("crawlgraph");

    const b = stubBacklinks("openpagerank", {
      domain: "example.com",
      siteUrl: "https://example.com",
      competitors: ["ahrefs.com"],
    });
    expect(b.mode).toBe("stub");
    expect(b.links.some((l) => l.competitorDomain === "ahrefs.com")).toBe(true);
  });

  it("lists crawlgraph and openpagerank in registry", () => {
    const statuses = listBacklinkProviderStatuses();
    const ids = statuses.map((s) => s.id);
    expect(ids).toContain("crawlgraph");
    expect(ids).toContain("openpagerank");
    expect(ids).toContain("ahrefs");
  });

  it("merges multi-provider fetch in stub mode", async () => {
    const { links, results } = await fetchBacklinksFromProviders(
      ["crawlgraph", "openpagerank"],
      { domain: "example.com", siteUrl: "https://example.com" },
    );
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(links.length).toBeGreaterThan(0);
    expect(new Set(links.map((l) => l.sourceApi))).toEqual(
      new Set(["crawlgraph", "openpagerank"]),
    );
  });
});
