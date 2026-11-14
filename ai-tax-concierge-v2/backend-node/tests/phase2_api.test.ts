import { describe, expect, it } from "vitest";
import { api, buildTestApp } from "./helpers.js";

describe("phase2 / phase3 API", () => {
  const app = buildTestApp();

  it("bootstrap", async () => {
    const res = await api(app).get("/api/v1/bootstrap");
    expect(res.status).toBe(200);
    const body = res.body;
    expect(body.phase).toBe(3);
    expect(body.product).toBe("SIMBA AI");
    expect(body.llm_mode).toBe("mock");
    expect(body.starters.length).toBeGreaterThanOrEqual(5);
    expect(body.journeys).toHaveLength(12);
    expect(body.packages.self_assessment[0].price_gbp).toBe(119);
    expect(body.integrations.payment).toBe("mock_unavailable");
    expect(JSON.stringify(body).toLowerCase()).not.toContain("api_key");
    expect(String(body.brand.primary).toUpperCase()).toBe("#006B3C");
  });

  it("health_phase2", async () => {
    const res = await api(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.phase).toBe(3);
    expect(res.body.product).toBe("SIMBA AI");
  });

  it("chat_returns_sources_and_follow_ups", async () => {
    const res = await api(app)
      .post("/api/v1/chat")
      .send({
        message: "When is the Self Assessment online filing deadline?",
        tax_year: "2025-26",
      });
    expect(res.status).toBe(200);
    const body = res.body;
    expect(body.sources.length).toBeGreaterThan(0);
    expect(body.sources.every((s: { url: string }) => s.url.includes("gov.uk"))).toBe(
      true,
    );
    expect(body.follow_ups.length).toBeGreaterThan(0);
  });

  it("chat_package_recommendation", async () => {
    const res = await api(app)
      .post("/api/v1/chat")
      .send({
        message: "What Self Assessment packages does TaxSimba offer?",
      });
    expect(res.status).toBe(200);
    const body = res.body;
    expect(body.packages).toHaveLength(3);
    expect(body.reply.includes("£119") || body.reply.includes("119")).toBe(true);
    const lower = body.reply.toLowerCase();
    expect(
      !lower.includes("inclusion") ||
        lower.includes("not invent") ||
        lower.includes("don't invent") ||
        lower.includes("do not invent") ||
        body.reply.includes("I don't invent") ||
        lower.includes("catalogue") ||
        lower.includes("configured prices"),
    ).toBe(true);
  });

  it("chat_does_not_invent_inclusions", async () => {
    const res = await api(app)
      .post("/api/v1/chat")
      .send({ message: "What is included in the Elite package?" });
    expect(res.status).toBe(200);
    const lower = res.body.reply.toLowerCase();
    expect(
      lower.includes("invent") ||
        lower.includes("not invent") ||
        lower.includes("don't invent") ||
        lower.includes("will not invent") ||
        lower.includes("pending"),
    ).toBe(true);
    expect(lower.includes("299") || lower.includes("£299")).toBe(true);
    // Must not invent benefits outside the recovered catalogue (e.g. fake phone SLA).
    expect(lower.includes("24/7 phone")).toBe(false);
  });

  it("journey_api_flow", async () => {
    const start = await api(app)
      .post("/api/v1/journeys/start")
      .send({ journey_id: "landlord", session_id: "j1" });
    expect(start.status).toBe(200);
    const state = start.body.journey;
    expect(state.complete).toBe(false);
    expect(state.current.options.length).toBeGreaterThan(0);

    const opt = state.current.options[0];
    const advance = await api(app)
      .post("/api/v1/journeys/advance")
      .send({ session_id: "j1", option_id: opt.id, journey_state: state });
    expect(advance.status).toBe(200);
    expect(
      advance.body.journey.current || advance.body.journey.complete,
    ).toBeTruthy();
  });

  it("journey_unknown", async () => {
    const res = await api(app)
      .post("/api/v1/journeys/start")
      .send({ journey_id: "spaceship" });
    expect(res.status).toBe(400);
  });

  it("widget_assets_served", async () => {
    for (const path of [
      "/widget/index.html",
      "/widget/preview.html",
      "/widget/embed.js",
      "/widget/chat.html",
      "/widget/css/concierge.css",
      "/widget/css/chat-panel.css",
      "/widget/js/concierge.js",
      "/widget/js/chat-panel.js",
    ]) {
      const res = await api(app).get(path);
      expect(res.status).toBe(200);
    }
  });

  it("widget_allows_embedding", async () => {
    const res = await api(app).get("/widget/index.html");
    expect(
      (res.headers["content-security-policy"] || "").includes("frame-ancestors"),
    ).toBe(true);
  });

  it("root_points_to_preview", async () => {
    const res = await api(app).get("/");
    expect(res.body.phase).toBe("master-completion");
    expect(res.body.preview).toContain("/widget/preview.html");
  });

  it("validation_error_shape", async () => {
    const res = await api(app).post("/api/v1/chat").send({ message: "" });
    expect(res.status).toBe(422);
  });
});
