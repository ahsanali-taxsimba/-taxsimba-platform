/**
 * K.3 compat: packages, entitlements, Checkout Session adapters.
 */
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  bearer,
  bootTestApp,
  dropTestDb,
  makeClient,
} from "../helpers/app";
import { FakePaymentProvider, WEBHOOK_SIGNATURE } from "../helpers/payments";

describe("K.3 compat entitlements + checkout adapters", () => {
  let app: Express;
  let provider: FakePaymentProvider;

  function webhook(type: string, object: Record<string, unknown>) {
    return request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", WEBHOOK_SIGNATURE)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ type, object }));
  }

  function payAndConfirm(sessionId: string) {
    const paid = provider.pay(sessionId);
    return webhook("checkout.session.completed", {
      id: sessionId,
      payment_status: paid.payment_status,
      payment_intent: paid.payment_intent,
    });
  }

  beforeAll(async () => {
    if (!process.env.TEST_MONGO_URL) {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      const mongo = await MongoMemoryServer.create();
      process.env.TEST_MONGO_URL = mongo.getUri();
      (globalThis as { __taxsimbaMemoryMongoK3?: { stop: () => Promise<boolean> } }).__taxsimbaMemoryMongoK3 =
        mongo;
    }
    ({ app } = await bootTestApp());
    const { setPaymentProvider } = await import("../../src/services/payments");
    provider = new FakePaymentProvider();
    setPaymentProvider(provider);
  });

  afterAll(async () => {
    const { setPaymentProvider } = await import("../../src/services/payments");
    setPaymentProvider(null);
    await dropTestDb();
    const mem = (globalThis as { __taxsimbaMemoryMongoK3?: { stop: () => Promise<boolean> } })
      .__taxsimbaMemoryMongoK3;
    if (mem) await mem.stop();
  });

  it("lists subscription-plans mapped from packages (ACTIVE catalogue only)", async () => {
    const client = await makeClient("k3plans");
    const res = await request(app)
      .get("/api/compat/subscription-plans?category=taxSimba")
      .set(bearer(client))
      .expect(200);
    expect(res.body.success).toBe(true);
    const codes = res.body.data.map((p: { code: string }) => p.code);
    expect(codes).toEqual(expect.arrayContaining(["SIMPLE", "SMART", "ELITE"]));
    expect(res.body.data[0].category).toBe("taxSimba");
  });

  it("active subscription list is empty before purchase and populated after paid fulfil", async () => {
    const client = await makeClient("k3subs");
    const empty = await request(app)
      .get("/api/compat/client/active/subscription/list")
      .set(bearer(client))
      .expect(200);
    expect(empty.body.data.hasActiveService).toBe(false);
    expect(empty.body.data.ownership).toBe("neither");
    expect(empty.body.data.subscriptions).toEqual([]);

    const checkout = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(client))
      .send({ planId: "SIMPLE", originUrl: "https://app.test.taxsimba.local" })
      .expect(200);
    expect(checkout.body.data.checkoutUrl).toMatch(/^https:\/\//);
    await payAndConfirm(checkout.body.data.sessionId).expect(200);

    const success = await request(app)
      .post("/api/compat/client/subscription/checkout-success")
      .set(bearer(client))
      .send({ sessionId: checkout.body.data.sessionId })
      .expect(200);
    expect(success.body.data.paymentStatus).toBe("paid");
    expect(success.body.data.fulfilled).toBe(true);

    const active = await request(app)
      .get("/api/compat/client/active/subscription/list")
      .set(bearer(client))
      .expect(200);
    expect(active.body.data.hasActiveSa).toBe(true);
    expect(active.body.data.ownership).toBe("sa");
    expect(active.body.data.subscriptions[0].plan.code).toBe("SIMPLE");
  });

  it("rejects Elements subscription/create and blocks unverified checkout-session", async () => {
    const verified = await makeClient("k3elements");
    const elements = await request(app)
      .post("/api/compat/client/subscription/create")
      .set(bearer(verified))
      .send({ planId: "SIMPLE", paymentMethodId: "pm_x", priceId: "price_x" });
    expect(elements.status).toBe(400);
    expect(elements.body.message).toMatch(/Checkout Session/i);

    const unverified = await makeClient("k3unverified", { emailVerified: false });
    const before = provider.checkouts.length;
    const blocked = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(unverified))
      .send({ planId: "SIMPLE", originUrl: "https://app.test.taxsimba.local" });
    expect(blocked.status).toBe(403);
    expect(provider.checkouts.length).toBe(before);
  });

  it("compat login exposes ownership flags and never invents isSubscriptionBuy true", async () => {
    const email = `k3login.${Date.now()}@example.com`;
    const password = "Tr0ubl3-Kettle-Marsh";
    await request(app)
      .post("/api/compat/auth/register")
      .send({ email, password, name: "K3", surname: "Login", mobile: "07700900222" })
      .expect(200);

    const login = await request(app)
      .post("/api/compat/auth/login")
      .send({ email, password })
      .expect(200);
    expect(login.body.data.isSubscriptionBuy).toBe(false);
    expect(login.body.data.hasActiveService).toBe(false);
    expect(login.body.data.ownership).toBe("neither");
    expect(login.body.data.user.hasActiveService).toBe(false);

    const account = await request(app)
      .post("/api/compat/auth/get-account-details")
      .set({ Authorization: `Bearer ${login.body.data.accessToken}` })
      .expect(200);
    expect(account.body.data.isSubscriptionBuy).toBe(false);
    expect(account.body.data.hasActiveService).toBe(false);
  });

  it("checkout-success does not fulfil unpaid sessions", async () => {
    const client = await makeClient("k3unpaid");
    const checkout = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(client))
      .send({ planId: "SMART", originUrl: "https://app.test.taxsimba.local" })
      .expect(200);
    const fail = await request(app)
      .post("/api/compat/client/subscription/checkout-success")
      .set(bearer(client))
      .send({ sessionId: checkout.body.data.sessionId });
    expect(fail.status).toBe(400);
    const list = await request(app)
      .get("/api/compat/client/active/subscription/list")
      .set(bearer(client))
      .expect(200);
    expect(list.body.data.hasActiveService).toBe(false);
  });
});
