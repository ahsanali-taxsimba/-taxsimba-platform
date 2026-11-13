import { describe, expect, it } from "vitest";
import { buildLlmAdapter, buildStubAdapters } from "../src/adapters/factory.js";
import { MockLLMAdapter } from "../src/adapters/llm_mock.js";
import { OpenAIAdapter } from "../src/adapters/llm_openai.js";
import { createSettings } from "../src/config/settings.js";

describe("adapters", () => {
  it("force_mock_llm_even_with_key", () => {
    const settings = createSettings({
      OPENAI_API_KEY: "sk-test-key",
      CONCIERGE_FORCE_MOCK_LLM: true,
    });
    const adapter = buildLlmAdapter(settings);
    expect(adapter).toBeInstanceOf(MockLLMAdapter);
    expect(adapter.mode).toBe("mock");
  });

  it("stub_adapters_phase1", () => {
    const settings = createSettings({
      WEBSITE_BASE_URL: "https://www.taxsimba.com",
      CONSULTATION_BOOKING_URL:
        "https://calendly.com/example/taxsimba-99-consultation",
    });
    const stubs = buildStubAdapters(settings);
    const nav = stubs.website.suggestPaths("self_assessment");
    expect(nav[0].url.startsWith("https://www.taxsimba.com")).toBe(true);
    expect(stubs.payment.createCheckout("SA_SMART").status).toBe("unavailable");
    const cal = stubs.calendly.consultationLink(99);
    expect(cal.price_gbp).toBe(99);
    expect(cal.booking_url).toContain("calendly.com");
    expect(stubs.client_portal.accountStatus(null).status).toBe("unavailable");
  });

  it("openai_adapter_requires_key", () => {
    expect(() => new OpenAIAdapter({ apiKey: "", model: "gpt-4o-mini" })).toThrow(
      /api.?key|key/i,
    );
  });
});
