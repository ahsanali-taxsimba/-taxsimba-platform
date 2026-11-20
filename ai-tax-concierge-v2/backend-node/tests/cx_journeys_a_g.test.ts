/**
 * Customer journeys A–G (mock LLM + deterministic handlers).
 * Staging portal/Calendly/SMTP remain BLOCKED outside this suite.
 */
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createSettings } from "../src/config/settings.js";
import {
  consumeHandoff,
  createHandoff,
  resetHandoffsForTests,
} from "../src/sessions/handoff.js";
import { sessionStore } from "../src/sessions/store.js";

const settings = createSettings({ CONCIERGE_FORCE_MOCK_LLM: true });
const app = createApp(settings);

async function chat(
  session_id: string,
  message: string,
  history: Array<{ role: string; content: string }> = [],
) {
  const res = await request(app)
    .post("/api/v1/chat")
    .send({ session_id, message, history })
    .expect(200);
  return res.body as {
    reply: string;
    packages: Array<{ code: string; recommended?: boolean }>;
    session_id: string;
    llm_mode: string;
  };
}

describe("CX journeys A–G", () => {
  it("A_simple_SA_explains_then_one_primary_package_with_signup_path", async () => {
    const sid = "cx-a";
    const q1 = await chat(
      sid,
      "I am a first-time sole trader with simple freelance income of about £12,000. Do I need Self Assessment for 2025-26?",
    );
    expect(q1.packages).toEqual([]);
    expect(q1.reply.toLowerCase()).toMatch(/self assessment/);

    const q2 = await chat(
      sid,
      "Which Self Assessment package do you recommend for me?",
      [
        { role: "user", content: "I am a first-time sole trader with simple freelance income of about £12,000. Do I need Self Assessment for 2025-26?" },
        { role: "assistant", content: q1.reply },
      ],
    );
    expect(q2.packages).toHaveLength(1);
    expect(q2.packages[0]?.code).toBe("SA_SIMPLE");

    const q3 = await chat(sid, "What happens after I sign up?");
    expect(q3.packages).toEqual([]);
    expect(q3.reply.toLowerCase()).toMatch(/register|verify|dashboard|payment/);
    expect(q3.reply).toContain("https://www.taxsimba.co.uk/register");
  });

  it("B_mtd_landlord_one_primary_mtd_when_asked", async () => {
    const sid = "cx-b";
    const elig = await chat(
      sid,
      "I am a landlord with £55,000 rental income before expenses in 2024-25. Do I need Making Tax Digital?",
    );
    expect(elig.packages).toEqual([]);
    expect(elig.reply.toLowerCase()).toMatch(/making tax digital|mtd|qualifying/);

    const rec = await chat(
      sid,
      "Which MTD package do you recommend?",
      [
        { role: "user", content: "I am a landlord with £55,000 rental income before expenses in 2024-25. Do I need Making Tax Digital?" },
        { role: "assistant", content: elig.reply },
      ],
    );
    expect(rec.packages).toHaveLength(1);
    expect(rec.packages[0]?.code).toMatch(/^MTD_/);
  });

  it("C_complex_offers_consultation_not_fake_booking", async () => {
    const body = await chat(
      "cx-c",
      "My tax situation is complex with overseas income and HMRC letters — I need accountant advice.",
    );
    expect(body.reply.toLowerCase()).toMatch(/consult|accountant|£99|£149|google meet/);
    expect(body.reply.toLowerCase()).not.toMatch(/you are booked|payment successful/);
    expect(body.packages.length).toBeGreaterThanOrEqual(1);
    expect(body.packages.length).toBeLessThanOrEqual(2);
    expect(
      body.packages.every((p) => p.code.startsWith("ACCOUNTANT_CONSULT_")),
    ).toBe(true);
  });

  it("D_no_paid_service_needed_no_package_cards", async () => {
    const body = await chat(
      "cx-d",
      "I only have PAYE employment salary and no other income. Do I need a TaxSimba package?",
    );
    expect(body.packages).toEqual([]);
  });

  it("E_existing_customer_dashboard_not_new_sale", async () => {
    const body = await chat(
      "cx-e",
      "I am an existing TaxSimba client logged into my dashboard — how do I message my assigned accountant?",
    );
    expect(body.packages).toEqual([]);
    expect(body.reply.toLowerCase()).toMatch(/dashboard|assigned accountant|message/);
  });

  it("F_compact_to_workspace_handoff_preserves_history", () => {
    resetHandoffsForTests();
    const sid = "cx-f-handoff";
    sessionStore.getOrCreate(sid);
    sessionStore.appendTurn(sid, "user", "Do freelancers need Self Assessment?");
    sessionStore.appendTurn(
      sid,
      "assistant",
      "Many freelancers need Self Assessment when income is above the trading allowance.",
    );
    const created = createHandoff({ session_id: sid, draft: "Also CIS?" });
    expect("handoff_token" in created).toBe(true);
    if (!("handoff_token" in created)) return;
    const consumed = consumeHandoff(created.handoff_token);
    expect(consumed.ok).toBe(true);
    if (!consumed.ok) return;
    expect(consumed.data.session_id).toBe(sid);
    expect(consumed.data.history.length).toBe(2);
    expect(consumed.data.draft).toBe("Also CIS?");
    expect(consumeHandoff(created.handoff_token).ok).toBe(false);
  });

  it("G_customer_needs_help_email_support_path", async () => {
    const body = await chat(
      "cx-g",
      "How do I contact TaxSimba customer support?",
    );
    expect(body.packages).toEqual([]);
    expect(body.reply).toContain("info@taxsimba.co.uk");
    expect(body.reply.toLowerCase()).toMatch(/email/);
    expect(body.reply.toLowerCase()).not.toMatch(
      /call you back for free|you are booked|live phone support is available/,
    );
    expect(body.reply.toLowerCase()).toMatch(/does not offer phone support|email/);
  });
});
