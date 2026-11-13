import { describe, expect, it } from "vitest";
import { api, buildTestApp } from "./helpers.js";

const WIDGET_ASSET_PATHS = [
  "/widget/index.html",
  "/widget/preview.html",
  "/widget/embed.js",
  "/widget/css/concierge.css",
  "/widget/js/concierge.js",
  "/widget/assets/taxsimba-logo.svg",
];

describe("API regression — bootstrap, health, widget, sessions", () => {
  const app = buildTestApp();

  it("bootstrap_simba_branding", async () => {
    const res = await api(app).get("/api/v1/bootstrap");
    expect(res.status).toBe(200);
    const body = res.body;
    expect(body.product).toBe("SIMBA AI");
    expect(body.assistant_name).toBe("SIMBA AI");
    expect(body.phase).toBe(3);
    expect(String(body.brand.primary).toUpperCase()).toBe("#006B3C");
    expect(String(body.brand.primary_action).toUpperCase()).toBe("#078A4B");
    expect(String(body.brand.logo_status).toLowerCase()).toContain("official");
    expect(body.brand.logo).toContain("taxsimba-logo.svg");
    expect(body.calculator_registry_count).toBeGreaterThanOrEqual(17);
  });

  it("welcome_endpoint", async () => {
    const res = await api(app)
      .get("/api/v1/welcome")
      .query({ session_id: "welcome-reg" });
    expect(res.status).toBe(200);
    const body = res.body;
    expect(body.session_id).toBe("welcome-reg");
    expect(body.reply).toBeTruthy();
    expect(body.llm_mode).toBe("mock");
    expect(body.disclaimer).toBeTruthy();
  });

  it("health_phase_three_mock_notice", async () => {
    const res = await api(app).get("/api/v1/health");
    const body = res.body;
    expect(body.phase).toBe(3);
    expect(body.product).toBe("SIMBA AI");
    expect(body.llm_mode).toBe("mock");
    expect(body.mock_notice).toBeTruthy();
    expect(body).toHaveProperty("current_tax_year");
  });

  it.each(WIDGET_ASSET_PATHS)("widget asset served: %s", async (path) => {
    const res = await api(app).get(path);
    expect(res.status).toBe(200);
  });

  it("official_taxsimba_logo_served", async () => {
    const res = await api(app).get("/widget/assets/taxsimba-logo.svg");
    expect(res.status).toBe(200);
    const text = String(res.text).toLowerCase();
    expect(text).toContain("<svg");
    expect(text).not.toContain("lion");
    expect(text).not.toContain("placeholder");
  });

  it("analytics_summary_shape", async () => {
    await api(app)
      .post("/api/v1/chat")
      .send({
        session_id: "an-sum",
        message: "When is Self Assessment deadline?",
        tax_year: "2025-26",
      });
    const res = await api(app).get("/api/v1/analytics/summary");
    const body = res.body;
    expect(body).toHaveProperty("conversation_volume");
    expect(body.conversation_volume).toBeGreaterThanOrEqual(1);
    expect(String(body.privacy).toLowerCase()).toContain("redacted");
  });

  it("sessions_delete_endpoint", async () => {
    const sid = "sess-delete-reg";
    await api(app).post("/api/v1/chat").send({ session_id: sid, message: "Hello" });
    const deleted = await api(app)
      .post("/api/v1/sessions/delete")
      .send({ session_id: sid });
    expect(deleted.body.deleted).toBe(true);
    const gone = await api(app).get(`/api/v1/sessions/${sid}`);
    expect(gone.body.found).toBe(false);
  });

  it.each([
    [{ message: "" }, 422],
    [{ message: "   " }, 422],
    [{ message: "ok", tax_year: "bogus" }, 422],
  ] as const)("chat_validation_errors %j → %i", async (payload, status) => {
    const res = await api(app).post("/api/v1/chat").send(payload);
    expect(res.status).toBe(status);
  });

  it("journeys_list_length_twelve", async () => {
    const res = await api(app).get("/api/v1/journeys");
    const journeys = res.body.journeys;
    expect(journeys).toHaveLength(12);
    const titles = new Set(journeys.map((j: { title: string }) => j.title));
    expect(titles.has("Accountant consultation (£99)")).toBe(true);
  });
});
