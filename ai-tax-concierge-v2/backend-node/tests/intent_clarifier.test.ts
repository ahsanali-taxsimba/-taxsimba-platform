import { describe, expect, it } from "vitest";
import { answerAmbiguousIntent } from "../src/knowledge/intent_clarifier.js";
import { answerMtdOperationsQuestion } from "../src/knowledge/mtd_operations.js";
import { isMtdEligibilityQuestion } from "../src/knowledge/mtd_eligibility.js";
import { ConversationalEngine } from "../src/ai/conversational_engine.js";
import { buildLlmAdapter } from "../src/adapters/factory.js";
import { createSettings } from "../src/config/settings.js";

describe("conversation intelligence — clarifiers and MTD ops", () => {
  it("does_not_treat_xero_software_as_eligibility", () => {
    expect(isMtdEligibilityQuestion("Do I need Xero for MTD?")).toBe(false);
    const reply = answerMtdOperationsQuestion("Do I need Xero for MTD?");
    expect(reply?.toLowerCase()).toContain("xero");
    expect(reply?.toLowerCase()).toContain("simbian");
  });

  it("clarifies_bare_earn_amount", () => {
    const r = answerAmbiguousIntent("I earn £60,000.");
    expect(r?.handled).toBe(true);
    expect(r?.customer_reply.toLowerCase()).toMatch(/paye|self-employment|which/);
  });

  it("clarifies_business_makes_amount", () => {
    const r = answerAmbiguousIntent("My business makes £100,000.");
    expect(r?.handled).toBe(true);
    expect(r?.customer_reply.toLowerCase()).toMatch(/limited company|sole trader/);
  });

  it("refuses_guaranteed_refund", () => {
    const r = answerAmbiguousIntent("Can you guarantee a tax refund?");
    expect(r?.handled).toBe(true);
    expect(r?.customer_reply.toLowerCase()).toContain("can’t guarantee");
  });

  it("engine_paye_employer_deducts_mentions_self_assessment", async () => {
    const settings = createSettings({ CONCIERGE_FORCE_MOCK_LLM: true });
    const engine = new ConversationalEngine({
      llm: buildLlmAdapter(settings),
      settings,
    });
    const res = await engine.handle({
      session_id: "paye-file",
      message: "My employer deducts tax. Do I still need to file?",
      tax_year: "2025-26",
    });
    const lower = res.reply.toLowerCase();
    expect(lower).toMatch(/self assessment|paye/);
    expect(lower).not.toContain("cryptoassets");
  });

  it("engine_crypto_gains_mentions_crypto_not_paper_deadline", async () => {
    const settings = createSettings({ CONCIERGE_FORCE_MOCK_LLM: true });
    const engine = new ConversationalEngine({
      llm: buildLlmAdapter(settings),
      settings,
    });
    const res = await engine.handle({
      session_id: "crypto-sa",
      message: "Crypto gains Self Assessment",
      tax_year: "2025-26",
    });
    const lower = res.reply.toLowerCase();
    expect(lower).toMatch(/crypto|capital gains/);
    expect(lower).not.toContain("31 october");
  });
});
