import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { ConversationalEngine } from "../src/ai/conversational_engine.js";
import { buildSystemPrompt } from "../src/ai/prompts.js";
import { MockLLMAdapter } from "../src/adapters/llm_mock.js";
import {
  MAX_FACT_EXCERPT_CHARS,
  applyGroundingGuard,
  factExcerpt,
} from "../src/knowledge/grounding.js";
import { reloadFacts } from "../src/knowledge/loader.js";
import { retrieve } from "../src/knowledge/retrieval.js";
import { verifyRanked } from "../src/knowledge/verification.js";
import type { SourceReference } from "../src/models/schemas.js";

describe("grounding accuracy fixes (VAT 90k + MTD 30k→April 2027)", () => {
  beforeEach(() => {
    reloadFacts();
  });
  afterEach(() => {
    reloadFacts();
  });

  it("excerpt_preserves_mtd_30k_april_2027_dates", () => {
    const ranked = retrieve(
      "What MTD Income Tax start date applies if qualifying income is over £30,000 in 2025-26?",
      "2026-27",
      3,
    );
    const sources = verifyRanked(ranked);
    const joined = sources.map((s) => s.excerpt || "").join(" ");
    expect(joined.includes("30,000") || joined.includes("£30,000")).toBe(true);
    expect(joined).toContain("2027");
    expect(sources.some((s) => s.id === "mtd-threshold-30k-april-2027")).toBe(
      true,
    );
    expect(MAX_FACT_EXCERPT_CHARS).toBeGreaterThanOrEqual(800);
    expect(factExcerpt(ranked[0].fact.summary).length).toBeGreaterThan(280);
  });

  it("prompt_includes_full_mtd_30k_guidance", () => {
    const ranked = retrieve(
      "qualifying income over £30,000 in 2025-26 MTD start date",
      "2026-27",
      3,
    );
    const sources = verifyRanked(ranked);
    const prompt = buildSystemPrompt("2026-27", sources, "openai");
    expect(
      prompt.includes("6 April 2027") ||
        prompt.toLowerCase().includes("april 2027"),
    ).toBe(true);
    expect(prompt.includes("£30,000") || prompt.includes("30,000")).toBe(true);
    expect(
      prompt.includes("NOT April 2026") ||
        prompt.toLowerCase().includes("not april 2026") ||
        prompt.includes("6 April 2027"),
    ).toBe(true);
    expect(prompt.includes("£90,000") || prompt.includes("GROUNDING RULES")).toBe(
      true,
    );
  });

  it("vat_retrieval_and_prompt_use_90000", () => {
    const ranked = retrieve("When do I need to register for VAT?", "2025-26", 5);
    expect(ranked.some((r) => r.fact.id === "vat-threshold-overview")).toBe(true);
    const sources = verifyRanked(ranked);
    const vat = sources.find((s) => s.id === "vat-threshold-overview")!;
    expect(
      (vat.excerpt || "").includes("90,000") ||
        (vat.excerpt || "").includes("£90,000"),
    ).toBe(true);
    const prompt = buildSystemPrompt("2025-26", sources, "openai");
    expect(prompt).toContain("90,000");
    expect(
      prompt.toLowerCase().includes("do not use a remembered £85,000") ||
        prompt.toLowerCase().includes("not £85,000"),
    ).toBe(true);
  });

  it("grounding_guard_fixes_stale_vat_85000", () => {
    const sources: SourceReference[] = [
      {
        id: "vat-threshold-overview",
        title: "VAT registration threshold",
        publisher: "GOV.UK / HMRC",
        url: "https://www.gov.uk/vat-registration-thresholds",
        tax_years: ["2025-26"],
        verified: true,
        excerpt:
          "Businesses must register for VAT if turnover is more than £90,000.",
      },
    ];
    const reply = "The VAT registration threshold is £85,000 for 2025-26.";
    const [fixed, flags] = applyGroundingGuard(
      reply,
      "When do I need to register for VAT?",
      sources,
    );
    expect(fixed.replace(/ /g, "")).not.toContain("85,000");
    expect(fixed).toContain("90,000");
    expect(flags.some((f) => f.includes("vat"))).toBe(true);
  });

  it("grounding_guard_fixes_mtd_30k_wrong_april_2026", () => {
    const sources: SourceReference[] = [
      {
        id: "mtd-threshold-30k-april-2027",
        title: "MTD Income Tax £30,000 threshold starts 6 April 2027",
        publisher: "GOV.UK / HMRC",
        url: "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
        tax_years: ["2025-26", "2026-27"],
        verified: true,
        excerpt:
          "If your qualifying income is more than £30,000 for the 2025-26 tax year, " +
          "you need to use Making Tax Digital for Income Tax from 6 April 2027. " +
          "This is not April 2026.",
      },
    ];
    const reply =
      "If your qualifying income is over £30,000 in 2025-26, you start MTD from April 2026.";
    const [fixed, flags] = applyGroundingGuard(
      reply,
      "What MTD start date applies if qualifying income is over £30,000 in 2025-26?",
      sources,
    );
    expect(fixed).toContain("2027");
    expect(flags.some((f) => f.includes("mtd_30k"))).toBe(true);
    expect(
      fixed.includes("6 April 2027") ||
        fixed.toLowerCase().includes("april 2027"),
    ).toBe(true);
  });

  it("grounding_guard_does_not_rewrite_legitimate_50k_april_2026", () => {
    const sources: SourceReference[] = [
      {
        id: "mtd-threshold-50k-april-2026",
        title: "MTD Income Tax £50,000 threshold starts 6 April 2026",
        publisher: "GOV.UK / HMRC",
        url: "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
        tax_years: ["2026-27"],
        verified: true,
        excerpt: "More than £50,000 for 2024-25 means from 6 April 2026.",
      },
    ];
    const reply =
      "With qualifying income over £50,000 in 2024-25 you start from 6 April 2026.";
    const [fixed, flags] = applyGroundingGuard(
      reply,
      "If my qualifying income was over £50,000 in 2024-25, when do I start MTD?",
      sources,
    );
    expect(fixed).toBe(reply);
    expect(flags).toEqual([]);
  });

  it("engine_answers_mtd_30k_with_april_2027", async () => {
    const engine = new ConversationalEngine({ llm: new MockLLMAdapter() });
    const resp = await engine.handle({
      session_id: "reg-mtd-30k",
      message:
        "What MTD Income Tax start date applies if qualifying income " +
        "is over £30,000 in 2025-26?",
      tax_year: "2026-27",
    });
    const reply = resp.reply.toLowerCase().replace(/,/g, "");
    expect(reply).toContain("2027");
    expect(
      resp.sources.some((s) => s.id === "mtd-threshold-30k-april-2027"),
    ).toBe(true);
    expect(reply.includes("30000") || resp.reply.includes("30,000")).toBe(true);
  });

  it("engine_answers_vat_with_90000_not_85000", async () => {
    const engine = new ConversationalEngine({ llm: new MockLLMAdapter() });
    const resp = await engine.handle({
      session_id: "reg-vat-90k",
      message: "When do I need to register for VAT?",
      tax_year: "2025-26",
    });
    const compact = resp.reply.replace(/,/g, "").replace(/ /g, "").toLowerCase();
    expect(compact.includes("90000") || compact.includes("£90000")).toBe(true);
    expect(compact).not.toContain("85000");
    expect(resp.sources.some((s) => s.id === "vat-threshold-overview")).toBe(
      true,
    );
  });

  it("related_mtd_bands_remain_distinct", async () => {
    const engine = new ConversationalEngine({ llm: new MockLLMAdapter() });
    const fifty = await engine.handle({
      session_id: "reg-mtd-50k",
      message:
        "If my qualifying income was over £50,000 in 2024-25, " +
        "when do I need to start MTD for Income Tax?",
      tax_year: "2026-27",
    });
    const twenty = await engine.handle({
      session_id: "reg-mtd-20k",
      message: "What about the £20,000 MTD threshold and April 2028?",
      tax_year: "2027-28",
    });
    expect(fifty.reply).toContain("2026");
    expect(twenty.reply).toContain("2028");
    expect(
      fifty.sources.some(
        (s) =>
          s.id.includes("50k") ||
          (s.excerpt || "").includes("50000") ||
          (s.excerpt || "").includes("50,000"),
      ),
    ).toBe(true);
  });
});
