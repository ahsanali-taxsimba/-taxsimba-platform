import { describe, expect, it } from "vitest";
import {
  decidePolicy,
  declinesPaidHelp,
  isEducationalAsk,
} from "../src/knowledge/decision_policy.js";
import { visitorDeclinesSales, recommendForMessage } from "../src/ai/recommendations.js";
import { answerSaEligibility } from "../src/knowledge/sa_eligibility.js";
import { answerMtdEligibility } from "../src/knowledge/mtd_eligibility.js";
import { answerAmbiguousIntent } from "../src/knowledge/intent_clarifier.js";

describe("decision_policy", () => {
  it("educates without packages on explain asks", () => {
    const p = decidePolicy("dont want packages. explain trading allowance");
    expect(p.mode).toBe("EDUCATE");
    expect(p.allowPackages).toBe(false);
    expect(declinesPaidHelp("dont want packages. explain trading allowance")).toBe(
      true,
    );
    expect(visitorDeclinesSales("dont want packages. explain trading allowance")).toBe(
      true,
    );
    expect(
      recommendForMessage(
        "dont want packages. explain trading allowance",
        null,
        "https://www.taxsimba.co.uk",
      ).packages,
    ).toEqual([]);
  });

  it("clarifies near-threshold side income instead of asserting SA", () => {
    const p = decidePolicy(
      "just started doing some photography on the side maybe £955 — hmrc?",
    );
    expect(p.mode).toBe("CLARIFY");
    expect(p.clarificationClass).toBe("casual_vs_trading_ambiguity");
  });

  it("clarifies tentative side photography above £1,500 before SA", () => {
    const p = decidePolicy(
      "just started doing some photography on the side maybe £3505 — hmrc?",
    );
    expect(p.mode).toBe("CLARIFY");
    expect(p.clarificationClass).toBe("casual_vs_trading_ambiguity");
  });

  it("clarifies mid-message amount corrections before treating figures as income", () => {
    const p = decidePolicy("i made 8k then actually wait 800 quid deliveries");
    expect(p.mode).toBe("CLARIFY");
    expect(p.clarificationClass).toBe("amount_correction_ambiguity");
    expect(p.facts.amountGbp).toBe(800);
  });

  it("clarifies marketplace personal-goods selling before SA conclusion", () => {
    const p = decidePolicy("sold my old clothes on depop am I in trouble");
    expect(p.mode).toBe("CLARIFY");
    expect(p.clarificationClass).toBe("marketplace_personal_vs_trade");
  });

  it("clarifies PAYE-only confirmation before inventing other income or SA", () => {
    const p = decidePolicy("my wages are under PAYE so nothing else matters yeah?");
    expect(p.mode).toBe("CLARIFY");
    expect(p.clarificationClass).toBe("employment_status_ambiguity");
  });

  it("treats thinking-of-starting as future intent, not a current SA duty", () => {
    const p = decidePolicy(
      "thinking of starting a window-cleaning round — first steps?",
    );
    expect(p.mode).toBe("CLARIFY");
    expect(p.clarificationClass).toBe("future_intent_not_current");
    expect(p.facts.futureIntent).toBe(true);
  });

  it("answers PAYE-only MTD asks without SA side-income interrogation", () => {
    const p = decidePolicy("paye only £40000. mtd?");
    expect(p.mode).toBe("ANSWER_OBLIGATION");
    expect(p.askType).toBe("MTD_QUESTION");
  });

  it("clarifies two PAYE jobs before asserting SA", () => {
    const p = decidePolicy("two PAYE jobs only — SA automatic?");
    expect(p.mode).toBe("CLARIFY");
    expect(p.clarificationClass).toBe("employment_status_ambiguity");
  });

  it("answers MTD when QI band facts are complete", () => {
    const r = answerMtdEligibility(
      "qi more than £50000 in 2024-25 — start when?",
    );
    expect(r?.handled).toBe(true);
    expect(r?.customer_reply).toMatch(/6 April 2026/);
  });

  it("answers SA for contracting turnover above £1,000", () => {
    const r = answerSaEligibility(
      "contracting as dev £4760 in 2025-26 before expenses. sa?",
    );
    expect(r?.handled).toBe(true);
    expect(r?.must_usually_file).toBe(true);
    expect(r?.customer_reply).toMatch(/more than £1,000|above the £1,000/);
  });

  it("answers SA for landlord rent with year", () => {
    const r = answerSaEligibility("landlord rent £36400 2024-25 — sa?");
    expect(r?.handled).toBe(true);
    expect(r?.customer_reply.toLowerCase()).toMatch(/rental income|self assessment/);
  });

  it("explains trading allowance without catalogue", () => {
    const r = answerAmbiguousIntent("dont want packages. explain trading allowance");
    expect(r?.handled).toBe(true);
    expect(r?.customer_reply).toMatch(/trading allowance/);
    expect(r?.customer_reply).not.toMatch(/£119|Simbian/);
  });

  it("treats educational what-is as educate", () => {
    expect(isEducationalAsk("What is Self Assessment?")).toBe(true);
    const p = decidePolicy("What is Self Assessment?");
    expect(p.mode).toBe("EDUCATE");
    expect(p.allowPackages).toBe(false);
  });
});
