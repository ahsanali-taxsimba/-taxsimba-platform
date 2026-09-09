/**
 * K.4 engagement acceptance — persistence + post-purchase gate behaviour.
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

describe("K.4 engagement acceptance", () => {
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

  async function activateSa(client: { id: string; token: string }) {
    const checkout = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(client as never))
      .send({ planId: "SIMPLE", originUrl: "https://app.test.taxsimba.local" })
      .expect(200);
    await payAndConfirm(checkout.body.data.sessionId).expect(200);
    await request(app)
      .post("/api/compat/client/subscription/checkout-success")
      .set(bearer(client as never))
      .send({ sessionId: checkout.body.data.sessionId })
      .expect(200);
  }

  beforeAll(async () => {
    if (!process.env.TEST_MONGO_URL) {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      const mongo = await MongoMemoryServer.create();
      process.env.TEST_MONGO_URL = mongo.getUri();
      (globalThis as { __taxsimbaMemoryMongoK4?: { stop: () => Promise<boolean> } }).__taxsimbaMemoryMongoK4 =
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
    const mem = (globalThis as { __taxsimbaMemoryMongoK4?: { stop: () => Promise<boolean> } })
      .__taxsimbaMemoryMongoK4;
    if (mem) await mem.stop();
  });

  it("rejects engagement accept before ACTIVE entitlement (not before purchase)", async () => {
    const client = await makeClient("k4pre");
    const res = await request(app)
      .post("/api/compat/client/accept-engagement-letter")
      .set(bearer(client))
      .send({ signature: "data:image/png;base64,aaa", accepted: true });
    expect(res.status).toBe(400);
    expect(String(res.body.message)).toMatch(/active service/i);

    const status = await request(app)
      .get("/api/compat/client/engagement-letter-status")
      .set(bearer(client))
      .expect(200);
    expect(status.body.data.isEngagementLetterAccepted).toBe(false);
  });

  it("persists acceptance after purchase and exposes it on status/account/login", async () => {
    const client = await makeClient("k4accept");
    await activateSa(client);

    const before = await request(app)
      .get("/api/compat/client/engagement-letter-status")
      .set(bearer(client))
      .expect(200);
    expect(before.body.data.isEngagementLetterAccepted).toBe(false);

    const accept = await request(app)
      .post("/api/compat/client/accept-engagement-letter")
      .set(bearer(client))
      .send({
        signature: "data:image/png;base64,ZmFrZV9zaWduYXR1cmU=",
        accepted: true,
      })
      .expect(200);
    expect(accept.body.success).toBe(true);
    expect(accept.body.data.isEngagementLetterAccepted).toBe(true);
    expect(accept.body.data.acceptedAt).toBeTruthy();
    expect(accept.body.data.agreementVersion).toBe("client-care-v1");
    expect(accept.body.data.serviceTypes).toContain("SELF_ASSESSMENT");

    const { col } = await import("../../src/db/mongo");
    const row = await col("engagement_acceptances").findOne({ user_id: client.id });
    expect(row).toMatchObject({
      status: "ACCEPTED",
      agreement_version: "client-care-v1",
    });
    expect(row?.signature_hash).toBeTruthy();
    expect(row?.signature).toBeTruthy();

    // Idempotent re-accept
    await request(app)
      .post("/api/compat/client/accept-engagement-letter")
      .set(bearer(client))
      .send({ signature: "data:image/png;base64,ZmFrZV9zaWduYXR1cmU=", accepted: true })
      .expect(200);
    expect(await col("engagement_acceptances").countDocuments({ user_id: client.id })).toBe(1);

    const status = await request(app)
      .get("/api/compat/client/engagement-letter-status")
      .set(bearer(client))
      .expect(200);
    expect(status.body.data.isEngagementLetterAccepted).toBe(true);

    const account = await request(app)
      .post("/api/compat/auth/get-account-details")
      .set(bearer(client))
      .expect(200);
    expect(account.body.data.isEngagementLetterAccepted).toBe(true);
    expect(account.body.data.engagementAcceptedAt).toBeTruthy();

    // Login payload includes engagement flag for NextAuth JWT hydration
    const { col: col2 } = await import("../../src/db/mongo");
    const email = `k4login.${randomUUID().slice(0, 8)}@example.com`;
    const password = "Tr0ubl3-Kettle-Marsh";
    const reg = await request(app)
      .post("/api/compat/auth/register")
      .send({ email, password, name: "K4", surname: "Login" })
      .expect(200);
    const token = reg.body.data.accessToken;
    await col2("users").updateOne(
      { email },
      { $set: { email_verified_at: new Date().toISOString() } },
    );
    const checkout = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set({ Authorization: `Bearer ${token}` })
      .send({ planId: "SIMPLE", originUrl: "https://app.test.taxsimba.local" })
      .expect(200);
    await payAndConfirm(checkout.body.data.sessionId).expect(200);
    await request(app)
      .post("/api/compat/client/subscription/checkout-success")
      .set({ Authorization: `Bearer ${token}` })
      .send({ sessionId: checkout.body.data.sessionId })
      .expect(200);
    await request(app)
      .post("/api/compat/client/accept-engagement-letter")
      .set({ Authorization: `Bearer ${token}` })
      .send({ signature: "data:image/png;base64,bbb", accepted: true })
      .expect(200);

    const login = await request(app)
      .post("/api/compat/auth/login")
      .send({ email, password })
      .expect(200);
    expect(login.body.data.isEngagementLetterAccepted).toBe(true);
    expect(login.body.data.user.isEngagementLetterAccepted).toBe(true);
    expect(login.body.data.hasActiveService).toBe(true);
  });

  it("does not invent ACTIVE services when accepting engagement", async () => {
    const client = await makeClient("k4noact");
    await activateSa(client);
    const { col } = await import("../../src/db/mongo");
    const mtdBefore = await col("client_services").findOne({
      client_id: client.clientId,
      service_type: "MTD_INCOME_TAX",
    });
    expect(mtdBefore?.status).toBe("NOT_ACTIVE");

    await request(app)
      .post("/api/compat/client/accept-engagement-letter")
      .set(bearer(client))
      .send({ signature: "data:image/png;base64,ccc", accepted: true })
      .expect(200);

    const mtdAfter = await col("client_services").findOne({
      client_id: client.clientId,
      service_type: "MTD_INCOME_TAX",
    });
    expect(mtdAfter?.status).toBe("NOT_ACTIVE");
    const sa = await col("client_services").findOne({
      client_id: client.clientId,
      service_type: "SELF_ASSESSMENT",
    });
    expect(sa?.status).toBe("ACTIVE");
  });

  it("rejects accept without signature or accepted=false", async () => {
    const client = await makeClient("k4bad");
    await activateSa(client);
    await request(app)
      .post("/api/compat/client/accept-engagement-letter")
      .set(bearer(client))
      .send({ signature: "", accepted: true })
      .expect(422);
    const res = await request(app)
      .post("/api/compat/client/accept-engagement-letter")
      .set(bearer(client))
      .send({ signature: "data:image/png;base64,ddd", accepted: false });
    expect(res.status).toBe(400);
  });
});
