import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createSettings } from "../src/config/settings.js";
import { answerAmbiguousIntent } from "../src/knowledge/intent_clarifier.js";
import { answerSaEligibility } from "../src/knowledge/sa_eligibility.js";
import { answerMtdEligibility } from "../src/knowledge/mtd_eligibility.js";

const app = () =>
  createApp(createSettings({ CONCIERGE_FORCE_MOCK_LLM: true }));

describe("independent audit — known failure fixes", () => {
  it("does not clarifier-block clear PAYE-only SA questions", () => {
    const q =
      "I earn £48,000 PAYE only, taxed through payroll, with no other income. Do I need Self Assessment?";
    expect(answerAmbiguousIntent(q)).toBeNull();
    const sa = answerSaEligibility(q);
    expect(sa?.must_usually_file).toBe(false);
    expect(sa?.customer_reply.toLowerCase()).toMatch(/usually do not need/);
  });

  it("exact £50,000 threshold question is handled as MTD exclusive boundary", () => {
    const q = "I earn £50,000 exactly in 2024/25. Is that over the threshold?";
    const mtd = answerMtdEligibility(q);
    expect(mtd?.handled).toBe(true);
    expect(mtd?.in_scope).toBe(false);
    expect(mtd?.customer_reply.toLowerCase()).toMatch(/more than|exact/);
  });

  it("PAYE-only MTD is out of scope", () => {
    const q = "I earn £70,000 through PAYE only. Do I need MTD Income Tax?";
    expect(answerAmbiguousIntent(q)).toBeNull();
    const mtd = answerMtdEligibility(q);
    expect(mtd?.in_scope).toBe(false);
  });

  it("T329 freelance MTD does not invert trading allowance", () => {
    const q =
      "I have a £50,000 PAYE salary and £1,000 freelance turnover. Do not add them for MTD.";
    const mtd = answerMtdEligibility(q);
    expect(mtd?.handled).toBe(true);
    expect(mtd?.customer_reply.toLowerCase()).not.toMatch(
      /below the £1,000 trading allowance/,
    );
    expect(mtd?.customer_reply.toLowerCase()).toMatch(/paye|not included|does not count|qualifying/);
  });

  it("D10-style help request does not lock Simple on first turn", async () => {
    const res = await request(app())
      .post("/api/v1/chat")
      .send({
        session_id: "d10-fix",
        message: "I already know I need Self Assessment help.",
      })
      .expect(200);
    expect(res.body.reply.toLowerCase()).not.toMatch(
      /self assessment simple package for £119/,
    );
    expect(res.body.reply).toMatch(/register|self-assessment/i);
    expect(res.body.packages || []).toHaveLength(0);
  });

  it("D03-style MTD follow-up remembers prior £52k turnover", () => {
    const r = answerMtdEligibility("Do I need Making Tax Digital from April 2026?", [
      {
        role: "user",
        content: "For 2024-25 my turnover before expenses was about £52,000.",
      },
      { role: "assistant", content: "Noted." },
    ]);
    expect(r?.in_scope).toBe(true);
    expect(r?.customer_reply).toMatch(/6 April 2026/);
  });

  it("refuses packages when customer says they do not want a paid package", async () => {
    const history = [
      {
        role: "user",
        content:
          "PAYE job. Freelance turnover about £8,000 before expenses for 2025-26.",
      },
      {
        role: "assistant",
        content: "You usually need Self Assessment for £8,000 freelance.",
      },
      { role: "user", content: "Do I need Self Assessment then?" },
      {
        role: "assistant",
        content: "Yes — above the £1,000 threshold.",
      },
    ];
    const res = await request(app())
      .post("/api/v1/chat")
      .send({
        session_id: "no-buy-holdout",
        message: "I do not want a paid package — just the answer.",
        history,
      })
      .expect(200);
    expect(res.body.packages || []).toHaveLength(0);
  });

  it("T303 PAYE-only history + do-not-ask self-employed does not force trading probe", () => {
    const r = answerSaEligibility(
      "Do I need Self Assessment? Do not ask me whether I am self-employed.",
      [
        { role: "user", content: "I have only PAYE salary." },
        { role: "assistant", content: "Understood." },
      ],
    );
    expect(r?.must_usually_file).toBe(false);
    expect(r?.customer_reply.toLowerCase()).toMatch(/usually do not need/);
    expect(r?.customer_reply.toLowerCase()).not.toMatch(
      /how much did you earn from self-employment/,
    );
  });
});
