/**
 * K.3 compat: packages, entitlements, Checkout Session adapters.
 * Includes final acceptance proofs for ownership isolation and register NOT_ACTIVE.
 */
import { randomUUID } from "crypto";

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

  it("Toxel register creates SA+MTD NOT_ACTIVE and does not activate either service", async () => {
    const email = `k3reg.${randomUUID().slice(0, 8)}@example.com`;
    const res = await request(app)
      .post("/api/compat/auth/register")
      .send({
        email,
        password: "Tr0ubl3-Kettle-Marsh",
        name: "K3",
        surname: "Register",
        mobile: "07700900333",
      })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isSubscriptionBuy).toBe(false);
    expect(res.body.data.hasActiveService).toBe(false);
    expect(res.body.data.ownership).toBe("neither");

    const { col } = await import("../../src/db/mongo");
    const user = await col("users").findOne({ email });
    expect(user?.email_verified_at).toBeNull();
    const client = await col("clients").findOne({ user_id: user!.id });
    const services = await col("client_services").find({ client_id: client!.id }).toArray();
    expect(services.map((s) => s.service_type).sort()).toEqual([
      "MTD_INCOME_TAX",
      "SELF_ASSESSMENT",
    ]);
    expect(services.every((s) => s.status === "NOT_ACTIVE")).toBe(true);
    expect(services.every((s) => s.package_code == null)).toBe(true);
    expect(await col("cases").countDocuments({ client_id: client!.id })).toBe(0);
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

  it("verified user creates Checkout Session for the selected mapped package", async () => {
    const client = await makeClient("k3mapped");
    const { col } = await import("../../src/db/mongo");
    const pkg = await col("packages").findOne({
      service_type: "SELF_ASSESSMENT",
      code: "ELITE",
      is_active: true,
    });
    expect(pkg).toBeTruthy();

    const before = provider.checkouts.length;
    const checkout = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(client))
      .send({ planId: pkg!.id, originUrl: "https://app.test.taxsimba.local" })
      .expect(200);
    expect(checkout.body.data.checkoutUrl).toMatch(/^https:\/\//);
    expect(checkout.body.data.sessionId).toBeTruthy();
    expect(checkout.body.data.amount).toBe(pkg!.price);
    expect(provider.checkouts.length).toBe(before + 1);
    expect(provider.last().metadata).toMatchObject({
      kind: "SERVICE_ACTIVATION",
      service_type: "SELF_ASSESSMENT",
      to_package: "ELITE",
      user_id: client.id,
    });

    const tx = await col("payment_transactions").findOne({
      session_id: checkout.body.data.sessionId,
    });
    expect(tx).toMatchObject({
      user_id: client.id,
      kind: "SERVICE_ACTIVATION",
      service_type: "SELF_ASSESSMENT",
      new_package: "ELITE",
      payment_status: "pending",
      fulfilled: false,
    });
  });

  it("unverified Toxel user cannot create a Checkout Session", async () => {
    const unverified = await makeClient("k3unverified", { emailVerified: false });
    const before = provider.checkouts.length;
    const { col } = await import("../../src/db/mongo");
    const txBefore = await col("payment_transactions").countDocuments({ user_id: unverified.id });

    const blocked = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(unverified))
      .send({ planId: "SIMPLE", originUrl: "https://app.test.taxsimba.local" });
    expect(blocked.status).toBe(403);
    expect(String(blocked.body.message || blocked.body.detail)).toMatch(
      /Email verification is required/i,
    );
    expect(provider.checkouts.length).toBe(before);
    expect(await col("payment_transactions").countDocuments({ user_id: unverified.id })).toBe(
      txBefore,
    );
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
    expect(success.body.data.plan.code).toBe("SIMPLE");

    const active = await request(app)
      .get("/api/compat/client/active/subscription/list")
      .set(bearer(client))
      .expect(200);
    expect(active.body.data.hasActiveSa).toBe(true);
    expect(active.body.data.ownership).toBe("sa");
    expect(active.body.data.subscriptions[0].plan.code).toBe("SIMPLE");
  });

  it("checkout-success cannot activate unpaid/incomplete; only fulfils paid", async () => {
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
    expect(String(fail.body.message)).toMatch(/not complete/i);

    const { col } = await import("../../src/db/mongo");
    let svc = await col("client_services").findOne({
      client_id: client.clientId,
      service_type: "SELF_ASSESSMENT",
    });
    expect(svc?.status).toBe("NOT_ACTIVE");
    let tx = await col("payment_transactions").findOne({
      session_id: checkout.body.data.sessionId,
    });
    expect(tx?.fulfilled).toBe(false);
    expect(tx?.payment_status).toBe("pending");

    await payAndConfirm(checkout.body.data.sessionId).expect(200);
    const ok = await request(app)
      .post("/api/compat/client/subscription/checkout-success")
      .set(bearer(client))
      .send({ sessionId: checkout.body.data.sessionId })
      .expect(200);
    expect(ok.body.data.fulfilled).toBe(true);
    expect(ok.body.data.paymentStatus).toBe("paid");

    svc = await col("client_services").findOne({
      client_id: client.clientId,
      service_type: "SELF_ASSESSMENT",
    });
    expect(svc?.status).toBe("ACTIVE");
    expect(svc?.package_code).toBe("SMART");
    tx = await col("payment_transactions").findOne({
      session_id: checkout.body.data.sessionId,
    });
    expect(tx?.fulfilled).toBe(true);
  });

  it("subscription-list returns only the authenticated user's ACTIVE services", async () => {
    const alice = await makeClient("k3alice");
    const bob = await makeClient("k3bob");

    const buyAlice = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(alice))
      .send({ planId: "SIMPLE", originUrl: "https://app.test.taxsimba.local" })
      .expect(200);
    await payAndConfirm(buyAlice.body.data.sessionId).expect(200);
    await request(app)
      .post("/api/compat/client/subscription/checkout-success")
      .set(bearer(alice))
      .send({ sessionId: buyAlice.body.data.sessionId })
      .expect(200);

    const buyBob = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(bob))
      .send({ planId: "MTD_ESSENTIAL", originUrl: "https://app.test.taxsimba.local" })
      .expect(200);
    await payAndConfirm(buyBob.body.data.sessionId).expect(200);
    await request(app)
      .post("/api/compat/client/subscription/checkout-success")
      .set(bearer(bob))
      .send({ sessionId: buyBob.body.data.sessionId })
      .expect(200);

    const aliceList = await request(app)
      .get("/api/compat/client/active/subscription/list")
      .set(bearer(alice))
      .expect(200);
    expect(aliceList.body.data.ownership).toBe("sa");
    expect(aliceList.body.data.hasActiveSa).toBe(true);
    expect(aliceList.body.data.hasActiveMtd).toBe(false);
    expect(aliceList.body.data.subscriptions).toHaveLength(1);
    expect(aliceList.body.data.subscriptions[0].plan.code).toBe("SIMPLE");
    expect(
      aliceList.body.data.subscriptions.every(
        (s: { plan: { code: string } }) => s.plan.code !== "MTD_ESSENTIAL",
      ),
    ).toBe(true);

    const bobList = await request(app)
      .get("/api/compat/client/active/subscription/list")
      .set(bearer(bob))
      .expect(200);
    expect(bobList.body.data.ownership).toBe("mtd");
    expect(bobList.body.data.hasActiveMtd).toBe(true);
    expect(bobList.body.data.hasActiveSa).toBe(false);
    expect(bobList.body.data.subscriptions).toHaveLength(1);
    expect(bobList.body.data.subscriptions[0].plan.code).toBe("MTD_ESSENTIAL");
    expect(
      bobList.body.data.subscriptions.every(
        (s: { plan: { code: string } }) => s.plan.code !== "SIMPLE",
      ),
    ).toBe(true);
  });

  it("get-account-details cannot expose another user's ownership/subscription", async () => {
    const owner = await makeClient("k3owner");
    const stranger = await makeClient("k3stranger");

    const buy = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(owner))
      .send({ planId: "SMART", originUrl: "https://app.test.taxsimba.local" })
      .expect(200);
    await payAndConfirm(buy.body.data.sessionId).expect(200);
    await request(app)
      .post("/api/compat/client/subscription/checkout-success")
      .set(bearer(owner))
      .send({ sessionId: buy.body.data.sessionId })
      .expect(200);

    const ownerAccount = await request(app)
      .post("/api/compat/auth/get-account-details")
      .set(bearer(owner))
      .expect(200);
    expect(ownerAccount.body.data.email).toBe(owner.email);
    expect(ownerAccount.body.data.hasActiveService).toBe(true);
    expect(ownerAccount.body.data.ownership).toBe("sa");
    expect(ownerAccount.body.data.subscription?.plan?.code).toBe("SMART");

    const strangerAccount = await request(app)
      .post("/api/compat/auth/get-account-details")
      .set(bearer(stranger))
      .expect(200);
    expect(strangerAccount.body.data.email).toBe(stranger.email);
    expect(strangerAccount.body.data.email).not.toBe(owner.email);
    expect(strangerAccount.body.data.hasActiveService).toBe(false);
    expect(strangerAccount.body.data.ownership).toBe("neither");
    expect(strangerAccount.body.data.subscription).toBeNull();
    expect(strangerAccount.body.data.subscriptions).toEqual([]);
  });

  it("rejects Elements subscription/create (Checkout-only)", async () => {
    const verified = await makeClient("k3elements");
    const elements = await request(app)
      .post("/api/compat/client/subscription/create")
      .set(bearer(verified))
      .send({ planId: "SIMPLE", paymentMethodId: "pm_x", priceId: "price_x" });
    expect(elements.status).toBe(400);
    expect(elements.body.message).toMatch(/Checkout Session/i);
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
});
