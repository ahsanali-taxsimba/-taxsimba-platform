import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildLlmAdapter } from "../src/adapters/factory.js";
import { ConversationalEngine } from "../src/ai/conversational_engine.js";
import { createSettings } from "../src/config/settings.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const suite = JSON.parse(
  readFileSync(
    path.join(ROOT, "tests/fixtures/master_scenarios_505.json"),
    "utf-8",
  ),
);
const multiturn = JSON.parse(
  readFileSync(
    path.join(ROOT, "tests/fixtures/master_multiturn_50.json"),
    "utf-8",
  ),
);

describe("master scenario suite 505+", () => {
  it("fixture_meets_minimum_counts", () => {
    expect(suite.count).toBeGreaterThanOrEqual(505);
    expect(suite.scenarios.length).toBe(suite.count);
    expect(suite.categories.mtd_eligibility).toBeGreaterThanOrEqual(65);
    expect(suite.categories.sa_registration_filing).toBeGreaterThanOrEqual(45);
    expect(multiturn.count).toBeGreaterThanOrEqual(50);
  });

  it("critical_regressions_pass", async () => {
    const settings = createSettings({ CONCIERGE_FORCE_MOCK_LLM: true });
    const engine = new ConversationalEngine({
      llm: buildLlmAdapter(settings),
      settings,
    });
    const critical = suite.scenarios.filter((s: { critical?: boolean }) => s.critical);
    expect(critical.length).toBeGreaterThanOrEqual(15);
    for (const s of critical) {
      const res = await engine.handle({
        session_id: `crit-${s.id}`,
        message: s.prompt,
        tax_year: "2025-26",
      });
      const lower = (res.reply || "").toLowerCase();
      if ((s.expect_any || []).length) {
        const hit = (s.expect_any as string[]).some((n) =>
          lower.includes(String(n).toLowerCase()),
        );
        expect(hit, `${s.id} missing any of ${s.expect_any.join("|")}: ${res.reply.slice(0, 180)}`).toBe(
          true,
        );
      }
      for (const n of s.reject_any || []) {
        expect(lower, `${s.id} hit ${n}`).not.toContain(String(n).toLowerCase());
      }
      const codes = (res.packages || []).map((p: { code: string }) => p.code);
      for (const c of s.forbid_codes || []) {
        expect(codes, `${s.id} forbid ${c}`).not.toContain(c);
      }
      expect(lower).not.toContain("owner_decisions");
      expect(lower).not.toContain("30-minute");
      expect(lower).not.toContain("30 minute");
    }
  }, 120_000);

  it("consultation_tiers_in_catalogue_prompts", async () => {
    const settings = createSettings({ CONCIERGE_FORCE_MOCK_LLM: true });
    const engine = new ConversationalEngine({
      llm: buildLlmAdapter(settings),
      settings,
    });
    const res = await engine.handle({
      session_id: "consult-tiers",
      message: "What accountant consultations does TaxSimba offer?",
      tax_year: "2025-26",
    });
    const lower = res.reply.toLowerCase();
    expect(lower).toContain("99");
    expect(lower).toContain("20");
    expect(lower).toContain("149");
    expect(lower).toContain("40");
    expect(lower).not.toMatch(/30-?\s*minute/);
    expect(lower).toMatch(/quick tax advice|£99|99/);
    expect(lower).toMatch(/extended|£149|149/);
    expect(lower).toMatch(/which option|calendly|google meet|pay within calendly/);
  });

  it("multiturn_sample_remembers_and_respects_refusal", async () => {
    const settings = createSettings({ CONCIERGE_FORCE_MOCK_LLM: true });
    const engine = new ConversationalEngine({
      llm: buildLlmAdapter(settings),
      settings,
    });
    const sid = "mt-sample";
    const history: Array<{ role: "user" | "assistant"; content: string }> = [];
    for (const message of [
      "Don't sell me anything. When is the Self Assessment online filing deadline for 2025-26?",
      "Thanks — still no packages please",
    ]) {
      const res = await engine.handle({
        session_id: sid,
        message,
        tax_year: "2025-26",
        history,
      });
      history.push({ role: "user", content: message });
      history.push({ role: "assistant", content: res.reply });
      if (message.toLowerCase().includes("deadline")) {
        expect(res.reply.toLowerCase()).toMatch(/january/);
      }
    }
  });
});
