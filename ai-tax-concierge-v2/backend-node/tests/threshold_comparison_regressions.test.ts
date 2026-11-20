/**
 * Regression: exclusive thresholds and trading-allowance vs SA filing trigger.
 * Guards against inverting “more than £X” / “below £1,000” comparisons.
 */
import { describe, expect, it } from "vitest";
import { ConversationalEngine } from "../src/ai/conversational_engine.js";
import { MockLLMAdapter } from "../src/adapters/llm_mock.js";
import {
  answerSaEligibility,
  extractTradingIncomeGbp,
} from "../src/knowledge/sa_eligibility.js";
import { answerMtdEligibility } from "../src/knowledge/mtd_eligibility.js";

describe("threshold comparison regressions", () => {
  it("£8,000 freelance is above £1,000 — not below trading allowance for SA filing", () => {
    const r = answerSaEligibility("Do I need to register for Self Assessment?", [
      {
        role: "user",
        content:
          "PAYE job plus freelance turnover about £8,000 before expenses for 2025-26.",
      },
      { role: "assistant", content: "Noted." },
    ]);
    expect(r?.must_usually_file).toBe(true);
    expect(r?.customer_reply).toMatch(/above the £1,000|more than £1,000/i);
    expect(r?.customer_reply.toLowerCase()).not.toMatch(
      /falls below the £1,000|below the £1,000 trading allowance/,
    );
  });

  it("engine path: income disclosure then SA question stays above-threshold", async () => {
    const engine = new ConversationalEngine({ llm: new MockLLMAdapter() });
    const session_id = "thr-8k";
    await engine.handle({
      session_id,
      message:
        "My employer pays me under PAYE. Freelance turnover so far is about £8,000 before expenses for 2025-26.",
    });
    const sa = await engine.handle({
      session_id,
      message: "Do I need to register for Self Assessment?",
      history: [
        {
          role: "user",
          content:
            "My employer pays me under PAYE. Freelance turnover so far is about £8,000 before expenses for 2025-26.",
        },
        { role: "assistant", content: "Noted." },
      ],
    });
    expect(sa.reply).toMatch(/above the £1,000|more than £1,000/i);
    expect(sa.reply.toLowerCase()).not.toMatch(
      /falls below the £1,000 trading allowance/,
    );
  });

  it("£950 trading income is not more than £1,000", () => {
    expect(
      extractTradingIncomeGbp("I earned £950 from casual freelance jobs."),
    ).toBe(950);
    const r = answerSaEligibility(
      "I earned £950 from casual freelance jobs. Do I need Self Assessment?",
    );
    expect(r?.must_usually_file).toBe(false);
    expect(r?.customer_reply).toMatch(/not above the £1,000/i);
  });

  it("exact £50,000 is not more than £50,000 for MTD", () => {
    const r = answerMtdEligibility(
      "Qualifying income was exactly £50,000 in 2024-25. Do I need MTD from 6 April 2026?",
    );
    expect(r?.handled).toBe(true);
    expect(r?.in_scope).toBe(false);
    expect(r?.customer_reply.toLowerCase()).toMatch(/not more than|more than/);
    expect(r?.customer_reply.toLowerCase()).not.toMatch(
      /you must start making tax digital from 6 april 2026 because you are over/,
    );
  });

  it("more than £50,000 in 2024-25 → 6 April 2026 (must not treat as exact £50k)", () => {
    const r = answerMtdEligibility(
      "Qualifying income was more than £50,000 in 2024-25. When do I start MTD?",
    );
    expect(r?.handled).toBe(true);
    expect(r?.in_scope).toBe(true);
    expect(r?.customer_reply).toMatch(/6 April 2026/);
    expect(r?.customer_reply.toLowerCase()).not.toMatch(
      /exactly £50,000.*does not bring you into/,
    );
  });

  it("remembers prior turnover when asking MTD follow-up", () => {
    const r = answerMtdEligibility("Do I need Making Tax Digital from April 2026?", [
      {
        role: "user",
        content: "For 2024-25 my turnover before expenses was about £52,000.",
      },
      { role: "assistant", content: "Noted." },
    ]);
    expect(r?.handled).toBe(true);
    expect(r?.in_scope).toBe(true);
    expect(r?.customer_reply).toMatch(/6 April 2026/);
  });

  it("more than £30,000 in 2025-26 → 6 April 2027 (not April 2026)", () => {
    const r = answerMtdEligibility(
      "Qualifying income was more than £30,000 in 2025-26. When do I start MTD for Income Tax?",
    );
    expect(r?.handled).toBe(true);
    expect(r?.customer_reply).toMatch(/6 April 2027/);
    expect(r?.customer_reply).not.toMatch(/6 April 2026/);
  });

  it("PAYE-only is out of scope for MTD", () => {
    const r = answerMtdEligibility(
      "I earn £70,000 through PAYE only. Do I need MTD Income Tax?",
    );
    expect(r?.handled).toBe(true);
    expect(r?.in_scope).toBe(false);
    expect(r?.customer_reply.toLowerCase()).toMatch(
      /paye|employment|does not apply|not qualifying/,
    );
  });

  it("does not treat the word freelance as a software/file exclusion", () => {
    const r = answerMtdEligibility(
      "I have a £50,000 PAYE salary and £1,000 freelance turnover. Do not add them for MTD.",
    );
    expect(r?.handled).toBe(true);
    expect(r?.customer_reply.toLowerCase()).toMatch(/paye|not (included|count)/);
    expect(r?.customer_reply.toLowerCase()).not.toMatch(
      /below the £1,000 trading allowance/,
    );
  });
});
