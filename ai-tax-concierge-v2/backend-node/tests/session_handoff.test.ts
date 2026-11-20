import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createSettings } from "../src/config/settings.js";
import {
  createHandoff,
  consumeHandoff,
  resetHandoffsForTests,
} from "../src/sessions/handoff.js";
import { sessionStore } from "../src/sessions/store.js";

describe("secure workspace handoff", () => {
  beforeEach(() => {
    resetHandoffsForTests();
  });

  it("creates_and_consumes_single_use_token_without_history_in_token", () => {
    const session = sessionStore.getOrCreate("handoff-s1");
    sessionStore.appendTurn(session.session_id, "user", "My salary is £32,000");
    sessionStore.appendTurn(
      session.session_id,
      "assistant",
      "Thanks — noted your £32,000 salary.",
    );

    const created = createHandoff({
      session_id: session.session_id,
      draft: "What about MTD?",
    });
    expect("handoff_token" in created).toBe(true);
    if (!("handoff_token" in created)) return;
    expect(created.handoff_token).toMatch(/^[a-f0-9]{64}$/);
    expect(created.handoff_token).not.toContain("32000");
    expect(created.handoff_token).not.toContain(session.session_id);

    const first = consumeHandoff(created.handoff_token);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.session_id).toBe(session.session_id);
    expect(first.data.history).toHaveLength(2);
    expect(first.data.history[0].content).toContain("£32,000");
    expect(first.data.draft).toBe("What about MTD?");
    expect(first.data.history.some((m) => m.content.includes("auto"))).toBe(
      false,
    );

    const second = consumeHandoff(created.handoff_token);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error).toBe("handoff_already_used");
  });

  it("rejects_unknown_session_and_garbage_tokens", () => {
    expect(createHandoff({ session_id: "missing-xyz" })).toEqual({
      error: "session_not_found",
    });
    expect(consumeHandoff("not-a-token").ok).toBe(false);
    expect(consumeHandoff("a".repeat(64)).ok).toBe(false);
  });

  it("http_api_handoff_roundtrip", async () => {
    const app = createApp(
      createSettings({ CONCIERGE_FORCE_MOCK_LLM: true }),
    );
    const chat = await request(app)
      .post("/api/v1/chat")
      .send({
        session_id: "handoff-http-1",
        message: "I am a sole trader with £28k turnover.",
      })
      .expect(200);
    expect(chat.body.reply).toBeTruthy();

    const created = await request(app)
      .post("/api/v1/sessions/handoff")
      .send({
        session_id: "handoff-http-1",
        draft: "Do I need MTD?",
      })
      .expect(201);
    expect(created.body.handoff_token).toMatch(/^[a-f0-9]{64}$/);

    const consumed = await request(app)
      .post("/api/v1/sessions/handoff/consume")
      .send({ handoff_token: created.body.handoff_token })
      .expect(200);
    expect(consumed.body.session_id).toBe("handoff-http-1");
    expect(consumed.body.auto_send).toBe(false);
    expect(consumed.body.history.length).toBeGreaterThanOrEqual(2);
    expect(consumed.body.draft).toBe("Do I need MTD?");

    await request(app)
      .post("/api/v1/sessions/handoff/consume")
      .send({ handoff_token: created.body.handoff_token })
      .expect(409);
  });
});
