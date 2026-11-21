/**
 * Surgical regressions: multi-turn fact memory + short follow-ups (“sa?” / “mtd?”).
 * A remembered facts · B correction · C tax-year change · D new income source · E genuine clarify.
 */
import { describe, expect, it } from "vitest";
import { ConversationalEngine } from "../src/ai/conversational_engine.js";
import { MockLLMAdapter } from "../src/adapters/llm_mock.js";
import {
  answerSaEligibility,
  extractTradingIncomeGbp,
} from "../src/knowledge/sa_eligibility.js";
import { answerMtdEligibility } from "../src/knowledge/mtd_eligibility.js";
import { answerAmbiguousIntent } from "../src/knowledge/intent_clarifier.js";
import { answerMtdOperationsQuestion } from "../src/knowledge/mtd_operations.js";

const payeSideHistory = [
  { role: "user", content: "hi I work as a roofer" },
  { role: "assistant", content: "Happy to help with roofing / tax questions." },
  { role: "user", content: "also a bit of side cash" },
  {
    role: "assistant",
    content: "Is that side income self-employed trading?",
  },
  { role: "user", content: "main job PAYE around 32k" },
  { role: "assistant", content: "Noted — PAYE main job." },
  { role: "user", content: "side maybe £1675" },
  {
    role: "assistant",
    content:
      "Was this casual occasional activity, or regular self-employment trading?",
  },
  { role: "user", content: "side was 2025-26 before expenses" },
  {
    role: "assistant",
    content:
      "Since your side income of £1,675 from roofing in the 2025-26 tax year exceeds the £1,000 threshold, you will need to register for Self Assessment.",
  },
] as const;

describe("conversation memory regressions", () => {
  it("A: extracts side maybe £1675 as trading income", () => {
    expect(extractTradingIncomeGbp("side maybe £1675")).toBe(1675);
  });

  it("A: remembered facts — sa? reuses £1,675 / 2025-26 (does not re-ask amount/year)", () => {
    const r = answerSaEligibility("sa?", [...payeSideHistory]);
    expect(r?.handled).toBe(true);
    expect(r?.needs_more_info).toBe(false);
    expect(r?.must_usually_file).toBe(true);
    expect(r?.trading_income_gbp).toBe(1675);
    expect(r?.customer_reply).toMatch(/£1,675/);
    expect(r?.customer_reply).toMatch(/2025-26/);
    expect(r?.customer_reply.toLowerCase()).not.toMatch(
      /roughly how much did you earn from self-employment/,
    );
  });

  it("A: remembered facts — mtd? still uses £1,675 / 2025-26", () => {
    const r = answerMtdEligibility("mtd?", [...payeSideHistory]);
    expect(r?.handled).toBe(true);
    expect(r?.needs_more_info).toBe(false);
    expect(r?.in_scope).toBe(false);
    expect(r?.customer_reply).toMatch(/£1,675/);
    expect(r?.customer_reply).toMatch(/2025-26/);
  });

  it("A: engine path — sa? after established side facts does not re-ask", async () => {
    const engine = new ConversationalEngine({ llm: new MockLLMAdapter() });
    const sid = "mem-sa-followup";
    for (const turn of payeSideHistory) {
      if (turn.role !== "user") continue;
      await engine.handle({
        session_id: sid,
        message: turn.content,
        history: [],
      });
    }
    const sa = await engine.handle({
      session_id: sid,
      message: "sa?",
      history: [...payeSideHistory],
    });
    expect(sa.reply).toMatch(/£1,675/);
    expect(sa.reply).toMatch(/2025-26/);
    expect(sa.reply.toLowerCase()).not.toMatch(
      /roughly how much did you earn from self-employment/,
    );
    expect(sa.packages || []).toHaveLength(0);
  });

  it("B: customer correction of amount wins over earlier figure", () => {
    const history = [
      { role: "user", content: "freelance £2,000 2025-26 before expenses" },
      { role: "assistant", content: "Noted £2,000." },
      {
        role: "user",
        content: "sorry — freelance was actually £900 before expenses 2025-26",
      },
      { role: "assistant", content: "Thanks for correcting." },
    ];
    const r = answerSaEligibility("sa?", history);
    expect(r?.trading_income_gbp).toBe(900);
    expect(r?.must_usually_file).toBe(false);
    expect(r?.customer_reply).toMatch(/£900/);
  });

  it("C: change of tax year — later year used for MTD band", () => {
    const history = [
      {
        role: "user",
        content: "qualifying income £55,000 turnover before expenses 2024-25",
      },
      { role: "assistant", content: "Noted for 2024-25." },
      {
        role: "user",
        content: "actually that £55,000 was for 2025-26 not 2024-25",
      },
      { role: "assistant", content: "Thanks — using 2025-26." },
    ];
    const r = answerMtdEligibility("mtd?", history);
    expect(r?.handled).toBe(true);
    expect(r?.customer_reply).toMatch(/2025-26/);
    expect(r?.customer_reply).toMatch(/6 April 2027/);
    expect(r?.customer_reply).not.toMatch(
      /you need to use Making Tax Digital for Income Tax from 6 April 2026/,
    );
  });

  it("D: new income source later — property + freelance QI for MTD", () => {
    const r2 = answerMtdEligibility(
      "rent £12,400 + freelance £19,800 2025-26 before expenses. qi for mtd?",
    );
    expect(r2?.handled).toBe(true);
    expect(r2?.in_scope).toBe(true);
    expect(r2?.customer_reply).toMatch(/6 April 2027/);
    expect(r2?.customer_reply.toLowerCase()).toMatch(
      /quarterly updates do not replace your annual tax return|compatible software/,
    );
  });

  it("E: ambiguous new circumstance still clarifies (bare total)", async () => {
    const engine = new ConversationalEngine({ llm: new MockLLMAdapter() });
    const r = await engine.handle({
      session_id: "mem-bare",
      message: "I earn £58k. mtd??",
    });
    expect(r.reply.toLowerCase()).toMatch(/paye|self-employment|tax year|mix/);
    expect(r.reply.toLowerCase()).not.toMatch(
      /you need to use making tax digital for income tax from 6 april/,
    );
  });

  it("preserves PAYE-only is not MTD QI", () => {
    const r = answerMtdEligibility("PAYE-only £46k — making tax digital?");
    expect(r?.in_scope).toBe(false);
    expect(r?.customer_reply.toLowerCase()).toMatch(/paye|does not apply|not count/);
  });

  it("educational SA wording — calculation not “HMRC calculates for you”", () => {
    const r = answerAmbiguousIntent(
      "what even is self assessment without the jargon",
    );
    expect(r?.handled).toBe(true);
    expect(r?.customer_reply.toLowerCase()).toMatch(
      /self assessment calculation determines the tax due|report the relevant income/,
    );
    expect(r?.customer_reply.toLowerCase()).not.toMatch(
      /hmrc calculates how much tax you need to pay/,
    );
    // Must not invent a personal filing duty.
    expect(r?.customer_reply.toLowerCase()).not.toMatch(
      /you will need to register for self assessment/,
    );
  });

  it("educational MTD wording — quarterly updates vs annual return", () => {
    const r = answerAmbiguousIntent(
      "tell me about making tax digital for income tax please",
    );
    expect(r?.handled).toBe(true);
    expect(r?.customer_reply.toLowerCase()).toMatch(
      /quarterly updates do not replace your annual tax return/,
    );
    expect(r?.customer_reply.toLowerCase()).toMatch(/compatible software/);
  });

  it("MTD operations — quarterly vs annual return wording", () => {
    const reply = answerMtdOperationsQuestion(
      "do quarterly updates replace the tax return under MTD?",
    );
    expect(reply).toBeTruthy();
    expect(reply!.toLowerCase()).toMatch(
      /quarterly updates do not replace your annual tax return/,
    );
    expect(reply!.toLowerCase()).toMatch(/compatible software/);
  });
});
