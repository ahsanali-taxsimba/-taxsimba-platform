import { describe, expect, it } from "vitest";
import { ConversationalEngine } from "../src/ai/conversational_engine.js";
import {
  recommendForMessage,
  visitorDeclinesSales,
} from "../src/ai/recommendations.js";
import { MockLLMAdapter } from "../src/adapters/llm_mock.js";

describe("helpful-first no pressure", () => {
  it("visitor_declines_sales_detector", () => {
    expect(
      visitorDeclinesSales("I don't want to buy anything, just explain MTD"),
    ).toBe(true);
    expect(visitorDeclinesSales("Just information only please")).toBe(true);
    expect(
      visitorDeclinesSales("What do Self Assessment packages cost?"),
    ).toBe(false);
  });

  it("recommendations_suppress_packages_when_declining_sales", () => {
    const { packages, follow_ups } = recommendForMessage(
      "I do not want to buy a package — just tell me the SA online deadline",
      null,
      "https://www.taxsimba.co.uk",
    );
    expect(packages).toEqual([]);
    expect(
      follow_ups.some(
        (f) => f.toLowerCase().includes("deadline") || f.toLowerCase().includes("gov.uk"),
      ),
    ).toBe(true);
  });

  it("engine_helps_without_selling_when_declined", async () => {
    const engine = new ConversationalEngine({ llm: new MockLLMAdapter() });
    const resp = await engine.handle({
      session_id: "no-buy-1",
      message:
        "I don't want to buy anything. Just explain who needs Self Assessment " +
        "if I'm employed under PAYE with freelance side income.",
      tax_year: "2025-26",
    });
    expect(resp.packages).toEqual([]);
    expect(resp.consultation_hint).toBeNull();
    expect(resp.reply).toBeTruthy();
    const lower = resp.reply.toLowerCase();
    expect(
      lower.includes("self assessment") ||
        lower.includes("paye") ||
        lower.includes("hmrc"),
    ).toBe(true);
  });

  it("live_verified_calculators_have_urls", () => {
    const { calculators } = recommendForMessage(
      "income tax calculator for freelancers",
      null,
      "https://www.taxsimba.co.uk",
    );
    expect(calculators.length).toBeGreaterThan(0);
    expect(calculators.every((c) => c.url_status === "live_verified")).toBe(true);
    expect(
      calculators.every(
        (c) =>
          c.url &&
          c.url.startsWith("https://www.taxsimba.co.uk/calculators/"),
      ),
    ).toBe(true);
  });
});
