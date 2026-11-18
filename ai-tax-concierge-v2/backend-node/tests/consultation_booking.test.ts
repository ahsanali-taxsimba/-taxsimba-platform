import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createSettings } from "../src/config/settings.js";
import {
  consultationOptionsReply,
  consultationSelectionReply,
  detectConsultationSelection,
} from "../src/knowledge/consultation_booking.js";

describe("consultation booking experience", () => {
  it("options_reply_asks_customer_to_choose_not_email_first", () => {
    const reply = consultationOptionsReply().toLowerCase();
    expect(reply).toContain("quick tax advice");
    expect(reply).toContain("extended tax consultation");
    expect(reply).toContain("calendly");
    expect(reply).toContain("stripe");
    expect(reply).toMatch(/which option/);
    // Email must not be presented as the primary booking instruction
    const emailIdx = reply.indexOf("info@taxsimba.co.uk");
    expect(emailIdx).toBe(-1);
  });

  it("selection_unavailable_uses_email_only_as_fallback", () => {
    const tier = detectConsultationSelection(
      "I'd like Quick Tax Advice (£99 / 20 minutes)",
    );
    expect(tier?.price_gbp).toBe(99);
    const reply = consultationSelectionReply(tier!, false, null).toLowerCase();
    expect(reply).toContain("not connected");
    expect(reply).toMatch(/can('|’)t open a live slot|confirm an appointment/);
    expect(reply).toContain("info@taxsimba.co.uk");
    expect(reply).toMatch(/not the normal booking method|enquiry while booking is unavailable/);
    expect(reply).not.toMatch(/email .* to arrange your consultation/);
  });

  it("selection_live_returns_booking_link_without_false_confirmation", () => {
    const tier = detectConsultationSelection(
      "I'd like the Extended Tax Consultation (£149 / 40 minutes)",
    );
    expect(tier?.price_gbp).toBe(149);
    const reply = consultationSelectionReply(
      tier!,
      true,
      "https://calendly.com/taxsimba/extended-149",
    ).toLowerCase();
    expect(reply).toContain("calendly.com/taxsimba/extended-149");
    expect(reply).toContain("stripe");
    expect(reply).toContain("google meet");
    expect(reply).not.toMatch(/booking confirmed|you are booked|payment successful/);
  });

  it("chat_api_options_then_selection", async () => {
    const app = createApp(
      createSettings({ CONCIERGE_FORCE_MOCK_LLM: true }),
    );
    const options = await request(app)
      .post("/api/v1/chat")
      .send({
        session_id: "consult-flow-1",
        message: "I want to speak to an accountant",
      })
      .expect(200);
    expect(options.body.reply.toLowerCase()).toContain("which option");
    expect(options.body.reply.toLowerCase()).not.toMatch(
      /email info@taxsimba\.co\.uk if you('|’)d like taxsimba to arrange/,
    );
    expect(
      options.body.packages.some((p: { code: string }) =>
        p.code.startsWith("ACCOUNTANT_CONSULT_"),
      ),
    ).toBe(true);

    const pick = await request(app)
      .post("/api/v1/chat")
      .send({
        session_id: "consult-flow-2",
        message: "I'd like Quick Tax Advice (£99 / 20 minutes)",
      })
      .expect(200);
    expect(pick.body.reply.toLowerCase()).toContain("quick tax advice");
    expect(pick.body.reply.toLowerCase()).toMatch(/not connected|not live|unavailable/);
    expect(pick.body.reply.toLowerCase()).not.toContain("calendly.com/example");
  });
});
