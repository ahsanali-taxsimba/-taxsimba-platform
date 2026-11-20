import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createSettings } from "../src/config/settings.js";
import { answerTaxsimbaServiceModel } from "../src/knowledge/taxsimba_service_model.js";

const app = createApp(createSettings({ CONCIERGE_FORCE_MOCK_LLM: true }));

async function chat(message: string) {
  const res = await request(app)
    .post("/api/v1/chat")
    .send({ session_id: `svc-${Date.now()}-${Math.random()}`, message })
    .expect(200);
  return res.body as { reply: string; packages: unknown[] };
}

describe("TaxSimba service model positioning", () => {
  it("buy_xero_does_not_send_customer_to_purchase_separately", async () => {
    const direct = answerTaxsimbaServiceModel(
      "Do I need to buy Xero separately for Making Tax Digital?",
    );
    expect(direct?.topic).toBe("buy_xero");
    expect(direct?.customer_reply.toLowerCase()).toMatch(/do not need to buy xero separately|included in the simbian/);
    expect(direct?.customer_reply.toLowerCase()).not.toMatch(
      /you must buy xero from xero\.com|go and purchase xero yourself first/,
    );

    const body = await chat(
      "Do I need to buy Xero separately for Making Tax Digital?",
    );
    expect(body.packages).toEqual([]);
    expect(body.reply.toLowerCase()).toMatch(/included|do not need to buy xero separately/);
  });

  it("taxcalc_is_internal_accountant_tool", async () => {
    const body = await chat("What is TaxCalc used for at TaxSimba?");
    expect(body.reply.toLowerCase()).toMatch(/taxcalc/);
    expect(body.reply.toLowerCase()).toMatch(/accountant/);
    expect(body.reply.toLowerCase()).not.toMatch(
      /you must buy taxcalc|purchase taxcalc yourself/,
    );
    expect(body.packages).toEqual([]);
  });

  it("portal_does_not_file_directly_to_hmrc", async () => {
    const body = await chat(
      "Does the TaxSimba portal file directly to HMRC?",
    );
    expect(body.reply.toLowerCase()).toMatch(
      /not.*(direct|itself).*hmrc|not itself a direct hmrc/,
    );
    expect(body.packages).toEqual([]);
  });

  it("independent_software_request_answered_fairly", async () => {
    const body = await chat(
      "I want independent DIY software options without TaxSimba — which software can I use?",
    );
    expect(body.reply.toLowerCase()).toMatch(/gov\.uk|compatible software|independent|diy/);
    expect(body.reply.toLowerCase()).not.toMatch(
      /you must buy a taxsimba package/,
    );
  });

  it("taxsimba_handles_filing_via_accountants_not_chat", async () => {
    const body = await chat("Does TaxSimba handle filing my Self Assessment?");
    expect(body.reply.toLowerCase()).toMatch(/accountant/);
    expect(body.reply.toLowerCase()).toMatch(/not.*simba chat|not filing inside this simba chat/);
  });
});
