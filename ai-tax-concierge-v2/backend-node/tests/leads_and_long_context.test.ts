import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createSettings } from "../src/config/settings.js";
import { packConversationHistory } from "../src/ai/conversation_context.js";
import type { ChatMessage } from "../src/models/schemas.js";

describe("leads and long conversation context", () => {
  it("packs older turns into memory instead of dropping them", () => {
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 30; i++) {
      messages.push({ role: "user", content: `Fact ${i}: I earn PAYE and trade online` });
      messages.push({ role: "assistant", content: `Acknowledged fact ${i}` });
    }
    const packed = packConversationHistory(messages);
    expect(packed[0]?.role).toBe("system");
    expect(packed[0]?.content || "").toMatch(/Earlier conversation memory|Customer said/);
    expect(packed.length).toBeLessThan(messages.length);
    expect(packed.length).toBeGreaterThan(10);
  });

  it("captures lead with permission and writes outbox", async () => {
    const app = createApp(
      createSettings({ CONCIERGE_FORCE_MOCK_LLM: true }),
    );
    const email = `alex.example.${Date.now()}@taxsimba.test`;
    const res = await request(app)
      .post("/api/v1/leads")
      .send({
        session_id: `lead-test-${Date.now()}`,
        name: "Alex Example",
        email,
        phone: null,
        service_interest: "Self Assessment",
        query: "Please email me about Self Assessment",
        conversation_summary: "Customer asked for SA help",
        follow_up_permission: true,
      })
      .expect(201);
    expect(res.body.lead_id).toBeTruthy();
    expect(["delivered", "queued", "failed"]).toContain(
      res.body.notification_status,
    );

    const dup = await request(app)
      .post("/api/v1/leads")
      .send({
        session_id: `lead-test-dup-${Date.now()}`,
        email,
        service_interest: "Self Assessment",
        follow_up_permission: true,
        query: "Please email me about Self Assessment",
      })
      .expect(200);
    expect(dup.body.duplicate).toBe(true);
  });

  it("rejects lead without permission or contact", async () => {
    const app = createApp(
      createSettings({ CONCIERGE_FORCE_MOCK_LLM: true }),
    );
    await request(app)
      .post("/api/v1/leads")
      .send({
        session_id: "lead-test-2",
        email: "x@y.com",
        follow_up_permission: false,
      })
      .expect(400);
    await request(app)
      .post("/api/v1/leads")
      .send({
        session_id: "lead-test-3",
        follow_up_permission: true,
      })
      .expect(400);
  });

  it("marks first package card as recommended", async () => {
    const app = createApp(
      createSettings({ CONCIERGE_FORCE_MOCK_LLM: true }),
    );
    const res = await request(app)
      .post("/api/v1/chat")
      .send({
        session_id: "pkg-rec-1",
        message: "Simple income, first time — cheapest suitable Self Assessment package?",
      })
      .expect(200);
    expect(res.body.packages?.length).toBeGreaterThan(0);
    expect(res.body.packages[0].recommended).toBe(true);
    expect(res.body.packages[0].choose_url || res.body.packages[0].registration_path).toBeTruthy();
  });
});
