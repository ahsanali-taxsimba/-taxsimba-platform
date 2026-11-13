/**
 * Conversion handoff honesty, conversation quality guards, branding, pricing.
 */
import { describe, expect, it } from "vitest";
import { api, buildTestApp, buildTestSettings } from "./helpers.js";
import { packagesCatalog } from "../src/catalog/service.js";
import { recommendForMessage } from "../src/ai/recommendations.js";
import { DISCLAIMER, buildSystemPrompt } from "../src/ai/prompts.js";
import { RateLimiter } from "../src/security/ratelimit.js";
import { ConciergeError } from "../src/core/errors.js";

const WEBSITE = "https://www.taxsimba.co.uk";

describe("conversion quality and readiness audit", () => {
  it("catalogue_prices_match_approved_amounts", () => {
    const cat = packagesCatalog();
    const sa = Object.fromEntries(
      (cat.self_assessment as { code: string; price_gbp: number }[]).map((p) => [
        p.code,
        p.price_gbp,
      ]),
    );
    const mtd = Object.fromEntries(
      (cat.mtd as { code: string; price_gbp: number; vat_note: string }[]).map(
        (p) => [p.code, p],
      ),
    );
    expect(sa.SA_SIMPLE).toBe(119);
    expect(sa.SA_SMART).toBe(149);
    expect(sa.SA_ELITE).toBe(299);
    expect(mtd.MTD_STARTER.price_gbp).toBe(29.99);
    expect(mtd.MTD_GROWTH.price_gbp).toBe(59.99);
    expect(mtd.MTD_COMPLETE.price_gbp).toBe(89.99);
    expect(mtd.MTD_STARTER.vat_note).toContain("VAT included");
    expect(cat.consultation.price_gbp).toBe(99);
    expect(cat.consultation.duration_minutes).toBe(30);
  });

  it("customer_facing_name_is_tax_assistant_not_concierge", async () => {
    const app = buildTestApp();
    const boot = await api(app).get("/api/v1/bootstrap");
    expect(boot.status).toBe(200);
    expect(boot.body.product).toBe("SIMBA AI");
    expect(String(boot.body.subtitle)).toMatch(/Tax Assistant/i);
    expect(String(boot.body.subtitle).toLowerCase()).not.toContain("concierge");
    const prompt = buildSystemPrompt("2026-27", [], "mock", "");
    expect(prompt).toContain("SIMBA AI Tax Assistant");
    expect(prompt.toLowerCase()).toContain("never call yourself a concierge");
  });

  it("conversion_handoff_does_not_claim_purchase_success", async () => {
    const app = buildTestApp();
    const sid = "conv-audit-1";
    const chat = await api(app)
      .post("/api/v1/chat")
      .send({
        session_id: sid,
        message: "What do Self Assessment packages cost?",
      });
    expect(chat.status).toBe(200);
    const reply = String(chat.body.reply || "").toLowerCase();
    expect(reply).not.toMatch(/payment (was )?successful|purchase complete|you have paid|booking confirmed/);
    const bad = await api(app)
      .post("/api/v1/analytics/track")
      .send({
        session_id: sid,
        event: "purchase_completed",
        meta: {},
      });
    expect(bad.status).toBe(200);
    expect(bad.body.accepted).toBe(false);
    const ok = await api(app)
      .post("/api/v1/analytics/track")
      .send({
        session_id: sid,
        event: "package_click",
        meta: { code: "SA_SIMPLE" },
      });
    expect(ok.body.accepted).toBe(true);
    expect(String(ok.body.note || "").toLowerCase()).toContain("not a verified");
  });

  it("existing_client_chat_points_to_dashboard_not_upsell", async () => {
    const app = buildTestApp();
    const sid = "existing-audit";
    let start = await api(app)
      .post("/api/v1/journeys/start")
      .send({ journey_id: "existing_client", session_id: sid });
    let state = start.body.journey;
    while (!state.complete) {
      const opt = state.current.options[0].id;
      const adv = await api(app)
        .post("/api/v1/journeys/advance")
        .send({ session_id: sid, option_id: opt, journey_state: state });
      state = adv.body.journey;
    }
    expect(state.suggested_package_codes || []).toEqual([]);
    expect(String(state.summary || "").toLowerCase()).toContain("dashboard");
  });

  it("uncertainty_and_disclaimer_present", () => {
    expect(DISCLAIMER.toLowerCase()).toContain("not");
    expect(DISCLAIMER.toLowerCase()).toContain("advice");
    const empty = buildSystemPrompt("2026-27", [], "mock", "");
    expect(empty).toContain("No verified corpus match");
  });

  it("multi_turn_session_memory", async () => {
    const app = buildTestApp();
    const sid = "multi-audit";
    const r1 = await api(app)
      .post("/api/v1/chat")
      .send({
        session_id: sid,
        message: "I am a landlord with UK rental income",
      });
    expect(r1.status).toBe(200);
    const r2 = await api(app)
      .post("/api/v1/chat")
      .send({
        session_id: sid,
        message: "When does MTD start if my qualifying income is over £30,000?",
      });
    expect(r2.status).toBe(200);
    const reply = String(r2.body.reply || "");
    expect(reply.includes("2027") || reply.toLowerCase().includes("april 2027")).toBe(
      true,
    );
  });

  it("refusal_of_sales_suppresses_packages", () => {
    const { packages } = recommendForMessage(
      "Just information only — I do not want to buy a package",
      null,
      WEBSITE,
    );
    expect(packages).toEqual([]);
  });

  it("rate_limiter_blocks_burst", () => {
    const limiter = new RateLimiter(3, 60.0);
    limiter.check("burst-ip");
    limiter.check("burst-ip");
    limiter.check("burst-ip");
    try {
      limiter.check("burst-ip");
      expect.fail("expected rate limit");
    } catch (err) {
      expect(err).toBeInstanceOf(ConciergeError);
      expect((err as ConciergeError).statusCode).toBe(429);
    }
  });

  it("openai_key_not_exposed_in_bootstrap", async () => {
    const app = buildTestApp(
      buildTestSettings({
        OPENAI_API_KEY: "sk-test-should-never-leak",
        CONCIERGE_FORCE_MOCK_LLM: true,
      }),
    );
    const boot = await api(app).get("/api/v1/bootstrap");
    const raw = JSON.stringify(boot.body);
    expect(raw).not.toContain("sk-test-should-never-leak");
    expect(raw.toLowerCase()).not.toContain("openai_api_key");
  });

  it("session_isolation_between_visitors", async () => {
    const app = buildTestApp();
    await api(app)
      .post("/api/v1/chat")
      .send({ session_id: "iso-a", message: "VAT threshold please" });
    await api(app)
      .post("/api/v1/chat")
      .send({ session_id: "iso-b", message: "MTD £30k start date" });
    const del = await api(app)
      .post("/api/v1/sessions/delete")
      .send({ session_id: "iso-a" });
    expect(del.body.deleted).toBe(true);
    const b = await api(app)
      .post("/api/v1/chat")
      .send({ session_id: "iso-b", message: "Remind me the year for £30k MTD" });
    expect(b.status).toBe(200);
    expect(String(b.body.reply || "")).toMatch(/2027/);
  });
});
