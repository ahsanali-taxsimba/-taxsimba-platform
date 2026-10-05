/**
 * Toxel C-004 — same account can own both SA and MTD (API + entitlement contract).
 * Local integration only — not a staging PASS claim.
 * Payment path uses FakePaymentProvider (PAYMENT_PROVIDER simulation).
 */
import { randomUUID } from "crypto";

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  activateClientService,
  bearer,
  bootTestApp,
  dropTestDb,
  makeClient,
} from "../helpers/app";
import { FakePaymentProvider, WEBHOOK_SIGNATURE } from "../helpers/payments";
import { setPaymentProvider } from "../../src/services/payments";

async function buyAndFulfil(
  app: Express,
  client: { token: string },
  planId: string,
  fake: FakePaymentProvider,
) {
  const checkout = await request(app)
    .post("/api/compat/client/subscription/checkout-session")
    .set(bearer(client as any))
    .send({ planId, origin_url: "https://app.test.taxsimba.local" })
    .expect(200);
  const sessionId = checkout.body.data.sessionId || checkout.body.data.session_id;
  fake.pay(sessionId);
  await request(app)
    .post("/api/compat/client/subscription/checkout-success")
    .set(bearer(client as any))
    .send({ sessionId, session_id: sessionId })
    .expect(200);
  return sessionId as string;
}

describe("Toxel C-004 dual-service ownership", () => {
  let app: Express;
  let fake: FakePaymentProvider;

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    fake = new FakePaymentProvider();
    setPaymentProvider(fake);
  }, 120000);

  afterAll(async () => {
    setPaymentProvider(null);
    await dropTestDb();
  });

  it("C-004 SA→MTD: registration intent does not block second-service ACTIVE after payment", async () => {
    const client = await makeClient(`c004-sa-mtd-${randomUUID().slice(0, 6)}`);
    const { col } = await import("../../src/db/mongo");
    await col("clients").updateOne(
      { id: client.clientId },
      { $set: { onboarding_intent: "SELF_ASSESSMENT" } },
    );

    const saPlans = await request(app)
      .get("/api/compat/subscription-plans?category=taxSimba")
      .expect(200);
    const simple = (saPlans.body.data as { code: string; id: string }[]).find(
      (p) => p.code === "SIMPLE",
    )!;
    await buyAndFulfil(app, client, simple.id, fake);

    let mine = await request(app).get("/api/my-services").set(bearer(client)).expect(200);
    expect(mine.body.services.find((s: any) => s.service_type === "SELF_ASSESSMENT")?.status).toBe(
      "ACTIVE",
    );
    expect(mine.body.services.find((s: any) => s.service_type === "MTD_INCOME_TAX")?.status).toBe(
      "NOT_ACTIVE",
    );

    const mtdPlans = await request(app)
      .get("/api/compat/subscription-plans?category=mtd")
      .expect(200);
    const growth = (mtdPlans.body.data as { code: string; id: string }[]).find(
      (p) => p.code === "MTD_GROWTH",
    )!;
    await buyAndFulfil(app, client, growth.id, fake);

    mine = await request(app).get("/api/my-services").set(bearer(client)).expect(200);
    expect(mine.body.services.find((s: any) => s.service_type === "SELF_ASSESSMENT")?.status).toBe(
      "ACTIVE",
    );
    expect(mine.body.services.find((s: any) => s.service_type === "MTD_INCOME_TAX")?.status).toBe(
      "ACTIVE",
    );

    const details = await request(app)
      .post("/api/compat/auth/get-account-details")
      .set(bearer(client))
      .expect(200);
    expect(details.body.data.hasActiveSa).toBe(true);
    expect(details.body.data.hasActiveMtd).toBe(true);
    expect(details.body.data.ownership).toBe("both");
    // Intent may remain SA — must not clear the other entitlement.
    expect(details.body.data.onboardingIntent).toBe("SELF_ASSESSMENT");
  });

  it("C-004 MTD→SA: existing MTD client can purchase SA on same account", async () => {
    const client = await makeClient(`c004-mtd-sa-${randomUUID().slice(0, 6)}`);
    const { col } = await import("../../src/db/mongo");
    await col("clients").updateOne(
      { id: client.clientId },
      { $set: { onboarding_intent: "MTD_INCOME_TAX" } },
    );

    const mtdPlans = await request(app)
      .get("/api/compat/subscription-plans?category=mtd")
      .expect(200);
    const comply = (mtdPlans.body.data as { code: string; id: string }[]).find(
      (p) => p.code === "MTD_COMPLY",
    )!;
    await buyAndFulfil(app, client, comply.id, fake);

    const saPlans = await request(app)
      .get("/api/compat/subscription-plans?category=taxSimba")
      .expect(200);
    const smart = (saPlans.body.data as { code: string; id: string }[]).find(
      (p) => p.code === "SMART",
    )!;
    await buyAndFulfil(app, client, smart.id, fake);

    const details = await request(app)
      .post("/api/compat/auth/get-account-details")
      .set(bearer(client))
      .expect(200);
    expect(details.body.data.ownership).toBe("both");
    expect(details.body.data.hasActiveSa).toBe(true);
    expect(details.body.data.hasActiveMtd).toBe(true);
  });

  it("C-004 cancelled second-service checkout preserves first service and leaves second inactive", async () => {
    const client = await makeClient(`c004-cancel-${randomUUID().slice(0, 6)}`);
    await activateClientService(client, "SELF_ASSESSMENT", "SIMPLE");

    const mtdPlans = await request(app)
      .get("/api/compat/subscription-plans?category=mtd")
      .expect(200);
    const growth = (mtdPlans.body.data as { code: string; id: string }[]).find(
      (p) => p.code === "MTD_GROWTH",
    )!;
    const checkout = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(client))
      .send({ planId: growth.id, origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    const sessionId = checkout.body.data.sessionId || checkout.body.data.session_id;
    fake.expire(sessionId);

    await request(app)
      .post("/api/compat/client/subscription/checkout-success")
      .set(bearer(client))
      .send({ sessionId })
      .expect((res) => {
        expect([400, 402, 409]).toContain(res.status);
      });

    const mine = await request(app).get("/api/my-services").set(bearer(client)).expect(200);
    expect(mine.body.services.find((s: any) => s.service_type === "SELF_ASSESSMENT")?.status).toBe(
      "ACTIVE",
    );
    expect(mine.body.services.find((s: any) => s.service_type === "MTD_INCOME_TAX")?.status).toBe(
      "NOT_ACTIVE",
    );
  });

  it("C-004 replayed fulfilment does not duplicate services or cases", async () => {
    const client = await makeClient(`c004-replay-${randomUUID().slice(0, 6)}`);
    const saPlans = await request(app)
      .get("/api/compat/subscription-plans?category=taxSimba")
      .expect(200);
    const simple = (saPlans.body.data as { code: string; id: string }[]).find(
      (p) => p.code === "SIMPLE",
    )!;
    const sessionId = await buyAndFulfil(app, client, simple.id, fake);

    // Replay success + matching webhook.
    await request(app)
      .post("/api/compat/client/subscription/checkout-success")
      .set(bearer(client))
      .send({ sessionId })
      .expect(200);
    const event = {
      type: "checkout.session.completed",
      object: {
        id: sessionId,
        payment_status: "paid",
        metadata: fake.last().metadata,
      },
    };
    await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", WEBHOOK_SIGNATURE)
      .send(JSON.stringify(event))
      .expect(200);
    await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", WEBHOOK_SIGNATURE)
      .send(JSON.stringify(event))
      .expect(200);

    const { col } = await import("../../src/db/mongo");
    const saRows = await col("client_services")
      .find({ client_id: client.clientId, service_type: "SELF_ASSESSMENT", status: "ACTIVE" })
      .toArray();
    expect(saRows).toHaveLength(1);
    const cases = await col("cases")
      .find({ client_id: client.clientId, service_type: "SELF_ASSESSMENT" })
      .toArray();
    // Fulfilment may create at most one SA case for the activation.
    expect(cases.length).toBeLessThanOrEqual(1);
  });

  it("C-004 Client A cannot access Client B SA/MTD cases (isolation)", async () => {
    const a = await makeClient(`c004-iso-a-${randomUUID().slice(0, 6)}`);
    const b = await makeClient(`c004-iso-b-${randomUUID().slice(0, 6)}`);
    const { caseId: saCaseA } = await activateClientService(a, "SELF_ASSESSMENT", "SMART");
    const { caseId: mtdCaseA } = await activateClientService(a, "MTD_INCOME_TAX", "MTD_COMPLY");
    await activateClientService(b, "SELF_ASSESSMENT", "SIMPLE");
    await activateClientService(b, "MTD_INCOME_TAX", "MTD_GROWTH");

    await request(app)
      .get(`/api/cases/${saCaseA}`)
      .set(bearer(b))
      .expect((res) => {
        expect([403, 404]).toContain(res.status);
      });
    await request(app)
      .get(`/api/cases/${mtdCaseA}`)
      .set(bearer(b))
      .expect((res) => {
        expect([403, 404]).toContain(res.status);
      });

    const aMine = await request(app).get("/api/my-services").set(bearer(a)).expect(200);
    const bMine = await request(app).get("/api/my-services").set(bearer(b)).expect(200);
    expect(aMine.body.client_ref).not.toBe(bMine.body.client_ref);
  });

  it("C-004 unpaid / SA-only / MTD-only retain correct access flags; missing UTR does not block details", async () => {
    const unpaid = await makeClient(`c004-unpaid-${randomUUID().slice(0, 6)}`);
    const saOnly = await makeClient(`c004-saonly-${randomUUID().slice(0, 6)}`);
    const mtdOnly = await makeClient(`c004-mtdonly-${randomUUID().slice(0, 6)}`);
    await activateClientService(saOnly, "SELF_ASSESSMENT", "SIMPLE");
    await activateClientService(mtdOnly, "MTD_INCOME_TAX", "MTD_COMPLY");

    const { col } = await import("../../src/db/mongo");
    await col("clients").updateOne({ id: saOnly.clientId }, { $unset: { utr: "" } });
    await col("users").updateOne({ id: saOnly.id }, { $unset: { utr: "" } });

    const unpaidDetails = await request(app)
      .post("/api/compat/auth/get-account-details")
      .set(bearer(unpaid))
      .expect(200);
    expect(unpaidDetails.body.data.hasActiveService).toBe(false);
    expect(unpaidDetails.body.data.ownership).toBe("neither");

    const saDetails = await request(app)
      .post("/api/compat/auth/get-account-details")
      .set(bearer(saOnly))
      .expect(200);
    expect(saDetails.body.data.ownership).toBe("sa");
    expect(saDetails.body.data.hasActiveMtd).toBe(false);
    // Missing UTR must not error the account details / dashboard gate payload.
    expect(saDetails.status).toBe(200);

    const mtdDetails = await request(app)
      .post("/api/compat/auth/get-account-details")
      .set(bearer(mtdOnly))
      .expect(200);
    expect(mtdDetails.body.data.ownership).toBe("mtd");
    expect(mtdDetails.body.data.hasActiveSa).toBe(false);
  });
});
