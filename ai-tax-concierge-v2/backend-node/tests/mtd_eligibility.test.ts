import { describe, expect, it } from "vitest";
import {
  answerMtdEligibility,
  evaluateMtdEligibility,
  extractMtdEligibilityInput,
} from "../src/knowledge/mtd_eligibility.js";
import { createApp } from "../src/app.js";
import { createSettings } from "../src/config/settings.js";
import request from "supertest";

describe("deterministic MTD eligibility", () => {
  it("exact_50000_is_not_in_scope", () => {
    const r = evaluateMtdEligibility({
      qualifyingIncomeGbp: 50_000,
      basisTaxYear: "2024-25",
    });
    expect(r.in_scope).toBe(false);
    expect(r.customer_reply.toLowerCase()).toContain("exactly");
    expect(r.customer_reply).toMatch(/more than/i);
    expect(r.customer_reply).not.toMatch(/you need to use Making Tax Digital for Income Tax from 6 April 2026/i);
  });

  it("50001_2024_25_starts_april_2026", () => {
    const r = evaluateMtdEligibility({
      qualifyingIncomeGbp: 50_001,
      basisTaxYear: "2024-25",
    });
    expect(r.in_scope).toBe(true);
    expect(r.commencement).toBe("6 April 2026");
  });

  it("exact_30000_and_20000_exclusive", () => {
    expect(
      evaluateMtdEligibility({
        qualifyingIncomeGbp: 30_000,
        basisTaxYear: "2025-26",
      }).in_scope,
    ).toBe(false);
    expect(
      evaluateMtdEligibility({
        qualifyingIncomeGbp: 20_000,
        basisTaxYear: "2026-27",
      }).in_scope,
    ).toBe(false);
    expect(
      evaluateMtdEligibility({
        qualifyingIncomeGbp: 30_001,
        basisTaxYear: "2025-26",
      }).commencement,
    ).toBe("6 April 2027");
    expect(
      evaluateMtdEligibility({
        qualifyingIncomeGbp: 20_001,
        basisTaxYear: "2026-27",
      }).commencement,
    ).toBe("6 April 2028");
  });

  it("paye_only_out_of_scope", () => {
    const r = answerMtdEligibility(
      "I am employed earning £60k PAYE only. Do I need Making Tax Digital?",
    );
    expect(r?.handled).toBe(true);
    expect(r?.in_scope).toBe(false);
    expect(r?.customer_reply.toLowerCase()).toContain("paye");
  });

  it("limited_company_boundary", () => {
    const r = answerMtdEligibility(
      "I run a limited company. When do I need Making Tax Digital for Income Tax?",
    );
    expect(r?.handled).toBe(true);
    expect(r?.in_scope).toBe(false);
    expect(r?.customer_reply.toLowerCase()).toMatch(/limited company|companies/);
  });

  it("profit_asks_for_gross", () => {
    const r = answerMtdEligibility(
      "My profit is £55,000. Do I need MTD from April 2026?",
    );
    expect(r?.needs_more_info).toBe(true);
    expect(r?.customer_reply.toLowerCase()).toMatch(/before expenses|turnover|gross/);
  });

  it("30k_must_not_map_to_april_2026", () => {
    const r = evaluateMtdEligibility({
      qualifyingIncomeGbp: 35_000,
      basisTaxYear: "2025-26",
    });
    expect(r.commencement).toBe("6 April 2027");
    expect(r.customer_reply).not.toMatch(/from 6 April 2026/);
  });

  it("extracts_exact_amounts_from_natural_language", () => {
    expect(
      extractMtdEligibilityInput(
        "Qualifying income was exactly £50,000 in 2024-25 — am I in from April 2026?",
      ).qualifyingIncomeGbp,
    ).toBe(50_000);
    expect(
      extractMtdEligibilityInput(
        "My qualifying income was about £55,000 in 2024-25. When do I need MTD?",
      ).qualifyingIncomeGbp,
    ).toBe(55_000);
  });

  it("chat_endpoint_uses_deterministic_exact_threshold", async () => {
    const app = createApp(
      createSettings({ CONCIERGE_FORCE_MOCK_LLM: true }),
    );
    const res = await request(app)
      .post("/api/v1/chat")
      .send({
        session_id: "mtd-exact-50",
        message:
          "Qualifying income was exactly £50,000 in 2024-25. Do I need MTD from 6 April 2026?",
      })
      .expect(200);
    expect(res.body.reply.toLowerCase()).toMatch(/no|does not|not bring/);
    expect(res.body.reply).toMatch(/more than/i);
    expect(res.body.confidence).toBe("high");
  });

  it("chat_endpoint_55k_2024_25_april_2026", async () => {
    const app = createApp(
      createSettings({ CONCIERGE_FORCE_MOCK_LLM: true }),
    );
    const res = await request(app)
      .post("/api/v1/chat")
      .send({
        session_id: "mtd-55k",
        message:
          "My qualifying income was about £55,000 in 2024-25. When do I need to start Making Tax Digital for Income Tax?",
      })
      .expect(200);
    expect(res.body.reply).toMatch(/6 April 2026/);
    expect(res.body.reply).not.toMatch(/6 April 2027/);
  });
});
