/**
 * K.2 acceptance: email verify/reset + VERIFY-BEFORE-PURCHASE + fulfil defence-in-depth.
 *
 * Primary rule: unverified users cannot create any paid Stripe Checkout Session.
 * fulfil email / payment_status guards are recovery/legacy/race defence only.
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
  makeUser,
  TestUser,
} from "../helpers/app";
import { FakePaymentProvider, WEBHOOK_SIGNATURE } from "../helpers/payments";

describe("K.2 acceptance — verify-before-purchase", () => {
  let app: Express;
  let provider: FakePaymentProvider;
  let admin: TestUser;

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

  async function seedActiveSaFor(client: TestUser & { clientId: string }) {
    const { col } = await import("../../src/db/mongo");
    const { nowIso } = await import("../../src/domain/workflow");
    await col("client_services").updateOne(
      { client_id: client.clientId, service_type: "SELF_ASSESSMENT" },
      {
        $set: {
          status: "ACTIVE",
          package_code: "SIMPLE",
          agreed_price: 99,
          updated_at: nowIso(),
        },
      },
    );
    const caseId = randomUUID();
    await col("cases").insertOne({
      id: caseId,
      client_id: client.clientId,
      client_user_id: client.id,
      client_name: client.name,
      service_type: "SELF_ASSESSMENT",
      status: "IN_PROGRESS",
      case_ref: `SA-K2-${caseId.slice(0, 4)}`,
      created_at: nowIso(),
    });
    return caseId;
  }

  beforeAll(async () => {
    if (!process.env.TEST_MONGO_URL) {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      const mongo = await MongoMemoryServer.create();
      process.env.TEST_MONGO_URL = mongo.getUri();
      (globalThis as { __taxsimbaMemoryMongoK2?: { stop: () => Promise<boolean> } }).__taxsimbaMemoryMongoK2 =
        mongo;
    }
    ({ app } = await bootTestApp());
    const { setPaymentProvider } = await import("../../src/services/payments");
    provider = new FakePaymentProvider();
    setPaymentProvider(provider);
    admin = await makeUser("ADMIN", "k2admin");
  });

  afterAll(async () => {
    const { setPaymentProvider } = await import("../../src/services/payments");
    setPaymentProvider(null);
    await dropTestDb();
    const mem = (globalThis as { __taxsimbaMemoryMongoK2?: { stop: () => Promise<boolean> } })
      .__taxsimbaMemoryMongoK2;
    if (mem) await mem.stop();
  });

  it("register → SA+MTD NOT_ACTIVE; verify-email does not activate either service", async () => {
    const email = `k2reg.${randomUUID().slice(0, 8)}@example.com`;
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email,
        password: "Tr0ubl3-Kettle-Marsh",
        name: "K2 Register",
        phone: "07700900111",
      })
      .expect(200);
    expect(res.body.user.email_verified_at).toBeNull();

    const { col } = await import("../../src/db/mongo");
    const client = await col("clients").findOne({ email });
    const before = await col("client_services").find({ client_id: client!.id }).toArray();
    expect(before.map((s) => s.service_type).sort()).toEqual([
      "MTD_INCOME_TAX",
      "SELF_ASSESSMENT",
    ]);
    expect(before.every((s) => s.status === "NOT_ACTIVE")).toBe(true);
    expect(before.every((s) => s.package_code == null)).toBe(true);

    const { issueEmailVerification } = await import("../../src/services/emailVerification");
    const user = await col("users").findOne({ email });
    const issued = await issueEmailVerification(user!);
    await request(app)
      .post(`/api/auth/verify-email?token=${encodeURIComponent(issued.token)}`)
      .expect(200);

    const afterUser = await col("users").findOne({ email });
    expect(afterUser?.email_verified_at).toBeTruthy();
    const after = await col("client_services").find({ client_id: client!.id }).toArray();
    expect(after.every((s) => s.status === "NOT_ACTIVE")).toBe(true);
    expect(await col("cases").countDocuments({ client_id: client!.id })).toBe(0);
  });

  it("compat verify / resend / forget / reset endpoints work with envelope", async () => {
    const email = `k2compat.${randomUUID().slice(0, 8)}@example.com`;
    await request(app)
      .post("/api/auth/register")
      .send({
        email,
        password: "Tr0ubl3-Kettle-Marsh",
        name: "Compat User",
      })
      .expect(200);

    const reverify = await request(app)
      .post("/api/compat/auth/re-verify-email")
      .send({ email })
      .expect(200);
    expect(reverify.body.success).toBe(true);

    const { col } = await import("../../src/db/mongo");
    const { issueEmailVerification } = await import("../../src/services/emailVerification");
    const user = await col("users").findOne({ email });
    const issued = await issueEmailVerification(user!);
    const verified = await request(app)
      .post("/api/compat/auth/verify-email")
      .send({ token: issued.token })
      .expect(200);
    expect(verified.body).toMatchObject({
      success: true,
      message: "Email verified",
    });
    expect(verified.body.data.emailVerifiedAt).toBeTruthy();

    const forgot = await request(app)
      .post("/api/compat/auth/forget-password")
      .send({ email })
      .expect(200);
    expect(forgot.body.success).toBe(true);

    const { issuePasswordReset } = await import("../../src/services/passwordReset");
    const reset = await issuePasswordReset(email);
    expect(reset.token).toBeTruthy();
    await request(app)
      .post("/api/compat/auth/reset-password")
      .send({
        token: reset.token,
        password: "N3w-Secure-Phrase!",
        confirmPassword: "N3w-Secure-Phrase!",
      })
      .expect(200);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "N3w-Secure-Phrase!" })
      .expect(200);
    expect(login.body.user.email).toBe(email);
  });

  it("unverified service-checkout → 403 and no Stripe Checkout Session", async () => {
    const client = await makeClient("unverified-svc", { emailVerified: false });
    const before = provider.checkouts.length;
    const { col } = await import("../../src/db/mongo");
    const txBefore = await col("payment_transactions").countDocuments({ user_id: client.id });

    const res = await request(app)
      .post("/api/payments/service-checkout")
      .set(bearer(client))
      .send({
        service_type: "SELF_ASSESSMENT",
        package_code: "SIMPLE",
        origin_url: "https://app.test.taxsimba.local",
      });
    expect(res.status).toBe(403);
    expect(res.body.detail).toMatch(/Email verification is required/i);
    expect(provider.checkouts.length).toBe(before);
    expect(await col("payment_transactions").countDocuments({ user_id: client.id })).toBe(txBefore);
  });

  it("unverified upgrade-checkout → 403 and no Stripe Checkout Session", async () => {
    const client = await makeClient("unverified-upg", { emailVerified: false });
    await seedActiveSaFor(client);
    const before = provider.checkouts.length;

    const res = await request(app)
      .post("/api/payments/upgrade-checkout")
      .set(bearer(client))
      .send({ package_code: "SMART", origin_url: "https://app.test.taxsimba.local" });
    expect(res.status).toBe(403);
    expect(provider.checkouts.length).toBe(before);
  });

  it("unverified offer-checkout → 403 and no Stripe Checkout Session", async () => {
    const client = await makeClient("unverified-offer", { emailVerified: false });
    const { col } = await import("../../src/db/mongo");
    const { nowIso } = await import("../../src/domain/workflow");
    const offerId = randomUUID();
    await col("offers").insertOne({
      id: offerId,
      client_id: client.clientId,
      client_user_id: client.id,
      service_type: "MTD_INCOME_TAX",
      package_code: "MTD_ESSENTIAL",
      package_name: "MTD Essential",
      amount_due: 240,
      status: "PENDING",
      created_at: nowIso(),
    });
    const before = provider.checkouts.length;

    const res = await request(app)
      .post("/api/payments/offer-checkout")
      .set(bearer(client))
      .send({ offer_id: offerId, origin_url: "https://app.test.taxsimba.local" });
    expect(res.status).toBe(403);
    expect(provider.checkouts.length).toBe(before);
  });

  it("unverified ADDITIONAL_WORK checkout → 403 and no Stripe Checkout Session", async () => {
    const client = await makeClient("unverified-aw", { emailVerified: false });
    const caseId = await seedActiveSaFor(client);
    const { col } = await import("../../src/db/mongo");
    const { nowIso } = await import("../../src/domain/workflow");
    const awId = randomUUID();
    await col("payment_transactions").insertOne({
      id: awId,
      kind: "ADDITIONAL_WORK",
      user_id: client.id,
      client_id: client.clientId,
      case_id: caseId,
      description: "Extra work",
      amount: 50,
      payment_status: "pending",
      request_status: "SENT",
      fulfilled: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    const before = provider.checkouts.length;

    const res = await request(app)
      .post(`/api/payment-requests/${awId}/checkout`)
      .set(bearer(client))
      .send({ origin_url: "https://app.test.taxsimba.local" });
    expect(res.status).toBe(403);
    expect(provider.checkouts.length).toBe(before);
    const row = await col("payment_transactions").findOne({ id: awId });
    expect(row?.session_id).toBeFalsy();
  });

  it("direct fulfil of unpaid/incomplete SERVICE_ACTIVATION NEVER activates", async () => {
    const client = await makeClient("unpaid-fulfil", { emailVerified: true });
    const { col } = await import("../../src/db/mongo");
    const { nowIso } = await import("../../src/domain/workflow");
    const { fulfil } = await import("../../src/routes/payments");

    for (const payment_status of ["pending", "unpaid", "expired", "initiated"]) {
      const tx = {
        id: randomUUID(),
        session_id: `cs_unpaid_${payment_status}_${randomUUID().slice(0, 6)}`,
        user_id: client.id,
        client_id: client.clientId,
        kind: "SERVICE_ACTIVATION",
        service_type: "SELF_ASSESSMENT",
        new_package: "SIMPLE",
        amount: 99,
        currency: "gbp",
        status: "initiated",
        payment_status,
        fulfilled: false,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      await col("payment_transactions").insertOne({ ...tx });
      await fulfil(tx);
      const svc = await col("client_services").findOne({
        client_id: client.clientId,
        service_type: "SELF_ASSESSMENT",
      });
      expect(svc?.status).toBe("NOT_ACTIVE");
      const stored = await col("payment_transactions").findOne({ session_id: tx.session_id });
      expect(stored?.fulfilled).toBe(false);
    }
  });

  it("paid SERVICE_ACTIVATION + unverified → NEVER activates; remains unfulfilled", async () => {
    const unverified = await makeClient("paid-unverified", { emailVerified: false });
    const { col } = await import("../../src/db/mongo");
    const { nowIso } = await import("../../src/domain/workflow");
    const { fulfil } = await import("../../src/routes/payments");

    const sessionId = `cs_paid_unverified_${randomUUID().slice(0, 8)}`;
    const tx = {
      id: randomUUID(),
      session_id: sessionId,
      user_id: unverified.id,
      client_id: unverified.clientId,
      kind: "SERVICE_ACTIVATION",
      service_type: "SELF_ASSESSMENT",
      new_package: "SIMPLE",
      amount: 99,
      currency: "gbp",
      status: "completed",
      payment_status: "paid",
      fulfilled: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await col("payment_transactions").insertOne({ ...tx });
    await fulfil(tx);

    const svc = await col("client_services").findOne({
      client_id: unverified.clientId,
      service_type: "SELF_ASSESSMENT",
    });
    expect(svc?.status).toBe("NOT_ACTIVE");
    const still = await col("payment_transactions").findOne({ session_id: sessionId });
    expect(still?.fulfilled).toBe(false);
    expect(await col("cases").countDocuments({ client_id: unverified.clientId })).toBe(0);
  });

  it("after verify, retry activates ONLY when transaction is genuinely paid", async () => {
    const user = await makeClient("retry-after-verify", { emailVerified: false });
    const { col } = await import("../../src/db/mongo");
    const { nowIso } = await import("../../src/domain/workflow");
    const { fulfil } = await import("../../src/routes/payments");

    const unpaid = {
      id: randomUUID(),
      session_id: `cs_retry_unpaid_${randomUUID().slice(0, 8)}`,
      user_id: user.id,
      client_id: user.clientId,
      kind: "SERVICE_ACTIVATION",
      service_type: "SELF_ASSESSMENT",
      new_package: "SIMPLE",
      amount: 99,
      currency: "gbp",
      status: "initiated",
      payment_status: "pending",
      fulfilled: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    const paid = {
      id: randomUUID(),
      session_id: `cs_retry_paid_${randomUUID().slice(0, 8)}`,
      user_id: user.id,
      client_id: user.clientId,
      kind: "SERVICE_ACTIVATION",
      service_type: "SELF_ASSESSMENT",
      new_package: "SIMPLE",
      amount: 99,
      currency: "gbp",
      status: "completed",
      payment_status: "paid",
      fulfilled: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await col("payment_transactions").insertOne({ ...unpaid });
    await col("payment_transactions").insertOne({ ...paid });

    await col("users").updateOne({ id: user.id }, { $set: { email_verified_at: nowIso() } });

    await fulfil(unpaid);
    let svc = await col("client_services").findOne({
      client_id: user.clientId,
      service_type: "SELF_ASSESSMENT",
    });
    expect(svc?.status).toBe("NOT_ACTIVE");
    expect((await col("payment_transactions").findOne({ id: unpaid.id }))?.fulfilled).toBe(false);

    await fulfil(paid);
    svc = await col("client_services").findOne({
      client_id: user.clientId,
      service_type: "SELF_ASSESSMENT",
    });
    expect(svc?.status).toBe("ACTIVE");
    expect(svc?.package_code).toBe("SIMPLE");
    expect((await col("payment_transactions").findOne({ id: paid.id }))?.fulfilled).toBe(true);
    expect(
      await col("cases").countDocuments({
        client_id: user.clientId,
        service_type: "SELF_ASSESSMENT",
      }),
    ).toBe(1);
  });

  it("ADDITIONAL_WORK fulfil never activates SA/MTD or creates/duplicates a service case", async () => {
    const client = await makeClient("aw-no-activate");
    const buy = await request(app)
      .post("/api/payments/service-checkout")
      .set(bearer(client))
      .send({
        service_type: "SELF_ASSESSMENT",
        package_code: "SIMPLE",
        origin_url: "https://app.test.taxsimba.local",
      })
      .expect(200);
    await payAndConfirm(buy.body.session_id).expect(200);

    const { col } = await import("../../src/db/mongo");
    const kase = await col("cases").findOne({
      client_id: client.clientId,
      service_type: "SELF_ASSESSMENT",
    });
    const caseCountBefore = await col("cases").countDocuments({ client_id: client.clientId });
    const saBefore = await col("client_services").findOne({
      client_id: client.clientId,
      service_type: "SELF_ASSESSMENT",
    });
    const mtdBefore = await col("client_services").findOne({
      client_id: client.clientId,
      service_type: "MTD_INCOME_TAX",
    });

    const aw = await request(app)
      .post("/api/payment-requests")
      .set(bearer(admin))
      .send({ case_id: kase!.id, description: "K2 AW", amount: 40 })
      .expect(200);
    const checkout = await request(app)
      .post(`/api/payment-requests/${aw.body.id}/checkout`)
      .set(bearer(client))
      .send({ origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    await payAndConfirm(checkout.body.session_id).expect(200);

    const paidAw = await col("payment_transactions").findOne({ id: aw.body.id });
    expect(paidAw).toMatchObject({
      kind: "ADDITIONAL_WORK",
      request_status: "PAID",
      fulfilled: true,
      payment_status: "paid",
    });
    expect(await col("cases").countDocuments({ client_id: client.clientId })).toBe(caseCountBefore);
    const saAfter = await col("client_services").findOne({
      client_id: client.clientId,
      service_type: "SELF_ASSESSMENT",
    });
    const mtdAfter = await col("client_services").findOne({
      client_id: client.clientId,
      service_type: "MTD_INCOME_TAX",
    });
    expect(saAfter?.status).toBe(saBefore?.status);
    expect(saAfter?.package_code).toBe(saBefore?.package_code);
    expect(mtdAfter?.status).toBe("NOT_ACTIVE");
    expect(mtdAfter?.status).toBe(mtdBefore?.status);
  });

  it("allows login while unverified", async () => {
    const email = `k2login.${randomUUID().slice(0, 8)}@example.com`;
    await request(app)
      .post("/api/auth/register")
      .send({ email, password: "Tr0ubl3-Kettle-Marsh", name: "Login Unverified" })
      .expect(200);
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "Tr0ubl3-Kettle-Marsh" })
      .expect(200);
    expect(login.body.user.email_verified_at).toBeNull();
  });
});
