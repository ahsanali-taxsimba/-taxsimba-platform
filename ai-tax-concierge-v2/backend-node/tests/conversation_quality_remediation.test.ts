import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createSettings } from "../src/config/settings.js";
import { selectPackagesForMessage } from "../src/ai/package_selection.js";
import { mockPackageReply } from "../src/ai/prompts.js";

describe("conversation quality and honesty remediation", () => {
  it("simbian_growth_question_recommends_mtd_not_only_sa", () => {
    const codes = selectPackagesForMessage(
      "Tell me about Simbian Growth package price and what is included",
    );
    expect(codes[0]).toBe("MTD_GROWTH");
  });

  it("does_not_advertise_live_booking_or_free_callback", async () => {
    const app = createApp(
      createSettings({ CONCIERGE_FORCE_MOCK_LLM: true }),
    );
    const booking = await request(app)
      .post("/api/v1/chat")
      .send({
        session_id: "consult-1",
        message: "Can I book a £99 accountant consultation right now?",
      })
      .expect(200);
    expect(booking.body.reply.toLowerCase()).toMatch(
      /not connected|not live|not available yet|not connected yet/,
    );
    expect(booking.body.reply.toLowerCase()).not.toContain("calendly.com/example");

    const callback = await request(app)
      .post("/api/v1/chat")
      .send({
        session_id: "callback-1",
        message: "Can I get a free accountant callback?",
      })
      .expect(200);
    expect(callback.body.reply.toLowerCase()).toMatch(/can('|’)t|cannot|not/);
    expect(callback.body.reply.toLowerCase()).not.toMatch(
      /i('ve| have) booked|callback is arranged|we will call you/,
    );
  });

  it("config_marks_booking_and_callback_unavailable", async () => {
    const app = createApp(
      createSettings({ CONCIERGE_FORCE_MOCK_LLM: true }),
    );
    const res = await request(app).get("/api/v1/config").expect(200);
    expect(res.body.consultation_booking_available).toBe(false);
    expect(res.body.free_callback_available).toBe(false);
    expect(res.body.payment_status).toBe("unavailable");
  });

  it("mock_package_reply_uses_approved_prices_only", () => {
    const reply = mockPackageReply("What do the packages cost?");
    expect(reply).toContain("119");
    expect(reply).toContain("29.99");
    expect(reply).toContain("59.99");
    expect(reply).toContain("89.99");
    expect(reply?.toLowerCase()).not.toContain("internal mapping");
    expect(reply?.toLowerCase()).not.toContain("mtd_starter");
  });

  it("multi_turn_preserves_session_and_stays_concise", async () => {
    const app = createApp(
      createSettings({ CONCIERGE_FORCE_MOCK_LLM: true }),
    );
    const sid = "multi-turn-remediation";
    const first = await request(app)
      .post("/api/v1/chat")
      .send({
        session_id: sid,
        message: "I am a sole trader. Do I need Making Tax Digital?",
      })
      .expect(200);
    expect(first.body.reply.length).toBeLessThan(1200);
    const second = await request(app)
      .post("/api/v1/chat")
      .send({
        session_id: sid,
        message: "My qualifying income was £55,000 in 2024-25.",
        history: [
          { role: "user", content: "I am a sole trader. Do I need Making Tax Digital?" },
          { role: "assistant", content: first.body.reply },
        ],
      })
      .expect(200);
    expect(second.body.reply).toMatch(/6 April 2026/);
  });
});
