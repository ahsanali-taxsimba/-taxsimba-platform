import { describe, expect, it } from "vitest";
import { createSettings } from "../src/config/settings.js";
import { api, buildTestApp } from "./helpers.js";

describe("API basics", () => {
  const app = buildTestApp();

  it("health", async () => {
    const res = await api(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.llm_mode).toBe("mock");
    expect(res.body).toHaveProperty("current_tax_year");
  });

  it("public_config_hides_secrets", async () => {
    const res = await api(app).get("/api/v1/config");
    expect(res.status).toBe(200);
    const body = res.body;
    const asStr = JSON.stringify(body);
    expect(body).not.toHaveProperty("api_key");
    expect(asStr).not.toContain("OPENAI");
    expect(body.consultation_price_gbp).toBe(99);
    expect(body.llm_mode).toBe("mock");
  });

  it("chat_happy_path", async () => {
    const res = await api(app)
      .post("/api/v1/chat")
      .send({
        session_id: "api-sess-1",
        message: "Do I need to register for Self Assessment as a sole trader?",
        tax_year: "2025-26",
      });
    expect(res.status).toBe(200);
    const body = res.body;
    expect(body.session_id).toBe("api-sess-1");
    expect(body.reply).toBeTruthy();
    expect(body.tax_year).toBe("2025-26");
    expect(Array.isArray(body.sources)).toBe(true);
    expect(body.disclaimer).toBeTruthy();
    expect(body.llm_mode).toBe("mock");
  });

  it("chat_validation_blank_message", async () => {
    const res = await api(app).post("/api/v1/chat").send({ message: "   " });
    expect(res.status).toBe(422);
  });

  it("chat_invalid_tax_year", async () => {
    const res = await api(app)
      .post("/api/v1/chat")
      .send({ message: "What is personal allowance?", tax_year: "not-a-year" });
    expect(res.status).toBe(422);
  });

  it("root", async () => {
    const res = await api(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.phase).toBe("master-completion");
    expect(res.body.product).toBe("SIMBA AI");
  });

  it("settings_never_expose_key_in_safe_config", () => {
    const settings = createSettings({
      OPENAI_API_KEY: "sk-super-secret-key-1234",
      CONCIERGE_FORCE_MOCK_LLM: false,
    });
    const pub = settings.safePublicConfig();
    expect(JSON.stringify(pub)).not.toContain("sk-super-secret");
    expect(pub.llm_mode).toBe("openai");
  });
});
