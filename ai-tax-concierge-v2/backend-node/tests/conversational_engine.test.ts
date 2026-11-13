import { describe, expect, it } from "vitest";
import { MockLLMAdapter } from "../src/adapters/llm_mock.js";
import { ConversationalEngine } from "../src/ai/conversational_engine.js";
import { AnalyticsRecorder } from "../src/analytics/events.js";

describe("conversational engine", () => {
  it("engine_grounded_reply_includes_sources", async () => {
    const analytics = new AnalyticsRecorder();
    const engine = new ConversationalEngine({
      llm: new MockLLMAdapter(),
      analytics,
    });
    const response = await engine.handle({
      session_id: "sess-1",
      message: "When is the Self Assessment online filing deadline?",
      tax_year: "2025-26",
    });
    expect(response.llm_mode).toBe("mock");
    expect(response.tax_year).toBe("2025-26");
    expect(response.sources.length).toBeGreaterThan(0);
    expect(response.sources.every((s) => s.verified)).toBe(true);
    expect(
      response.reply.includes("HMRC") ||
        response.reply.includes("GOV.UK") ||
        response.reply.toLowerCase().includes("verified"),
    ).toBe(true);
    expect(response.disclaimer).toBeTruthy();
    const events = analytics.all();
    expect(events).toHaveLength(1);
    expect(events[0].payload.source_ids).toBeTruthy();
  });

  it("engine_low_confidence_offers_consultation", async () => {
    const engine = new ConversationalEngine({ llm: new MockLLMAdapter() });
    await engine.handle({
      session_id: "sess-2",
      message: "What is the capital gains tax rate on my yacht in outer space?",
      tax_year: "2025-26",
    });
    const response2 = await engine.handle({
      session_id: "sess-3",
      message: "I want to speak to an accountant about my tax",
      tax_year: "2025-26",
    });
    expect(response2.consultation_hint).not.toBeNull();
    expect(response2.consultation_hint).toContain("£99");
  });

  it("analytics_redacts_pii", async () => {
    const analytics = new AnalyticsRecorder();
    const engine = new ConversationalEngine({
      llm: new MockLLMAdapter(),
      analytics,
    });
    await engine.handle({
      session_id: "sess-pii",
      message:
        "My email is secret@example.com and UTR 1234567890 — SA deadline?",
      tax_year: "2025-26",
    });
    const payload = analytics.all()[0].payload;
    expect(payload.message_redacted).not.toContain("secret@example.com");
    expect(payload.message_redacted).not.toContain("1234567890");
    expect(payload.pii_flags.email).toBe(true);
  });
});
