import { describe, expect, it } from "vitest";
import {
  answerSaEligibility,
  extractTradingIncomeGbp,
  isSaEligibilityQuestion,
} from "../src/knowledge/sa_eligibility.js";

describe("sa_eligibility", () => {
  it("detects SA registration questions", () => {
    expect(isSaEligibilityQuestion("Do I need to register for Self Assessment?")).toBe(
      true,
    );
    expect(isSaEligibilityQuestion("Do I need to file a tax return?")).toBe(true);
    expect(
      isSaEligibilityQuestion("When do I start MTD with qualifying income threshold?"),
    ).toBe(false);
    expect(isSaEligibilityQuestion("When do I need to register for VAT?")).toBe(false);
  });

  it("extracts freelance turnover of £8,000", () => {
    expect(
      extractTradingIncomeGbp(
        "My employer pays me under PAYE. Freelance turnover so far is about £8,000 before expenses for 2025-26.",
      ),
    ).toBe(8000);
  });

  it("treats £8,000 as above £1,000 — SA usually required (not below trading allowance)", () => {
    const r = answerSaEligibility("Do I need to register for Self Assessment?", [
      {
        role: "user",
        content:
          "My employer pays me under PAYE. Freelance turnover so far is about £8,000 before expenses for 2025-26.",
      },
      {
        role: "assistant",
        content: "Thanks — noted.",
      },
    ]);
    expect(r?.handled).toBe(true);
    expect(r?.must_usually_file).toBe(true);
    expect(r?.trading_income_gbp).toBe(8000);
    expect(r?.customer_reply.toLowerCase()).toMatch(/above the £1,000|more than £1,000/);
    expect(r?.customer_reply.toLowerCase()).not.toMatch(
      /falls below the £1,000 trading allowance/,
    );
    expect(r?.customer_reply).toMatch(/register/i);
  });

  it("treats £400 trading income as usually not required by that sole-trader rule alone", () => {
    const r = answerSaEligibility(
      "Do I need Self Assessment? My freelance income was £400 in 2025-26.",
    );
    expect(r?.must_usually_file).toBe(false);
    expect(r?.customer_reply).toMatch(/not above the £1,000/i);
  });

  it("asks for income when unknown", () => {
    const r = answerSaEligibility("Do I need to register for Self Assessment?");
    expect(r?.needs_more_info).toBe(true);
    expect(r?.must_usually_file).toBeNull();
  });

  it("handles freelance income disclosure turns without an explicit register question", () => {
    const r = answerSaEligibility(
      "My employer pays me under PAYE. Freelance turnover so far is about £8,000 before expenses for 2025-26.",
      [
        {
          role: "user",
          content: "Hi — I just started freelancing this year alongside my job.",
        },
        {
          role: "assistant",
          content: "Do you know your expected freelance income?",
        },
      ],
    );
    expect(r?.handled).toBe(true);
    expect(r?.must_usually_file).toBe(true);
    expect(r?.customer_reply).toMatch(/above the £1,000/i);
    expect(r?.customer_reply.toLowerCase()).not.toMatch(
      /below the £1,000 trading allowance/,
    );
  });

  it("prefers latest freelance amount after salary/freelance correction", () => {
    const r = answerSaEligibility(
      "sorry, £40k was salary and £18k was freelance for 2024-25 before expenses — do I need Self Assessment?",
      [
        { role: "user", content: "I earned £40k last year" },
        { role: "assistant", content: "Need income type." },
      ],
    );
    expect(r?.handled).toBe(true);
    expect(r?.trading_income_gbp).toBe(18_000);
    expect(r?.must_usually_file).toBe(true);
  });
});

