/**
 * K.2: email verify/reset + VERIFY-BEFORE-PURCHASE + fulfil defence-in-depth.
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

type Client = TestUser & { clientId: string };

describe("K.2 verify / reset / checkout guards", () => {
  let app: Express;
  let provider: FakePaymentProvider;
  let admin: TestUser;
  let memoryUri: string | null = null;

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
      memoryUri = mongo.getUri();
      process.env.TEST_MONGO_URL = memoryUri;
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

  it("register leaves email unverified and issues a consumable verify token", async () => {
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
    const tokenRow = await col("email_verify_tokens").findOne({ email });
    expect(tokenRow).toBeTruthy();
    expect(tokenRow?.used_at).toBeNull();

    // Pull raw token via re-issue helper for consume (stored only hashed).
    const { issueEmailVerification } = await import("../../src/services/emailVerification");
    const user = await col("users").findOne({ email });
    // Prior token still unused — issueEmailVerification revokes it and returns a fresh one.
    const issued = await issueEmailVerification(user!);
    await request(app)
      .post(`/api/auth/verify-email?token=${encodeURIComponent(issued.token)}`)
      .expect(200);

    const after = await col("users").findOne({ email });
    expect(after?.email_verified_at).toBeTruthy();
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

  it("blocks all paid checkout starts for unverified clients", async () => {
    const client = await makeClient("unverified-checkout", { emailVerified: false });

    const service = await request(app)
      .post("/api/payments/service-checkout")
      .set(bearer(client))
      .send({
        service_type: "SELF_ASSESSMENT",
        package_code: "SIMPLE",
        origin_url: "https://app.test.taxsimba.local",
      });
    expect(service.status).toBe(403);
    expect(service.body.detail).toMatch(/Email verification is required/i);

    // Seed an ACTIVE SA for upgrade/offer/AW paths that need an existing case.
    const verified = await makeClient("verified-for-seed");
    const buy = await request(app)
      .post("/api/payments/service-checkout")
      .set(bearer(verified))
      .send({
        service_type: "SELF_ASSESSMENT",
        package_code: "SIMPLE",
        origin_url: "https://app.test.taxsimba.local",
      })
      .expect(200);
    await payAndConfirm(buy.body.session_id).expect(200);

    // Give unverified client an ACTIVE service row + case directly (bypass purchase).
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

    const upgrade = await request(app)
      .post("/api/payments/upgrade-checkout")
      .set(bearer(client))
      .send({ package_code: "SMART", origin_url: "https://app.test.taxsimba.local" });
    expect(upgrade.status).toBe(403);

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
    const offer = await request(app)
      .post("/api/payments/offer-checkout")
      .set(bearer(client))
      .send({ offer_id: offerId, origin_url: "https://app.test.taxsimba.local" });
    expect(offer.status).toBe(403);

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
    const aw = await request(app)
      .post(`/api/payment-requests/${awId}/checkout`)
      .set(bearer(client))
      .send({ origin_url: "https://app.test.taxsimba.local" });
    expect(aw.status).toBe(403);
  });

  it("fulfil refuses activateService for unverified users but still pays AW without activation", async () => {
    const unverified = await makeClient("fulfil-unverified", { emailVerified: false });
    const { col } = await import("../../src/db/mongo");
    const { nowIso } = await import("../../src/domain/workflow");
    const { fulfil } = await import("../../src/routes/payments");

    const sessionId = `cs_test_unverified_${randomUUID().slice(0, 8)}`;
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

    // After verify, fulfil activates via existing spine.
    await col("users").updateOne(
      { id: unverified.id },
      { $set: { email_verified_at: nowIso() } },
    );
    await fulfil(still!);
    const active = await col("client_services").findOne({
      client_id: unverified.clientId,
      service_type: "SELF_ASSESSMENT",
    });
    expect(active?.status).toBe("ACTIVE");
    expect(active?.package_code).toBe("SIMPLE");
    const cases = await col("cases")
      .find({ client_id: unverified.clientId, service_type: "SELF_ASSESSMENT" })
      .toArray();
    expect(cases.length).toBeGreaterThanOrEqual(1);

    // ADDITIONAL_WORK: mark paid without activateService / new entitlement / new case count bump.
    const verifiedAw = await makeClient("aw-verified");
    await request(app)
      .post("/api/payments/service-checkout")
      .set(bearer(verifiedAw))
      .send({
        service_type: "SELF_ASSESSMENT",
        package_code: "SIMPLE",
        origin_url: "https://app.test.taxsimba.local",
      })
      .expect(200)
      .then(async (r) => payAndConfirm(r.body.session_id).expect(200));

    const kase = await col("cases").findOne({
      client_id: verifiedAw.clientId,
      service_type: "SELF_ASSESSMENT",
    });
    const caseCountBefore = await col("cases").countDocuments({ client_id: verifiedAw.clientId });
    const mtdBefore = await col("client_services").findOne({
      client_id: verifiedAw.clientId,
      service_type: "MTD_INCOME_TAX",
    });

    const aw = await request(app)
      .post("/api/payment-requests")
      .set(bearer(admin))
      .send({ case_id: kase!.id, description: "K2 AW", amount: 40 })
      .expect(200);
    const checkout = await request(app)
      .post(`/api/payment-requests/${aw.body.id}/checkout`)
      .set(bearer(verifiedAw))
      .send({ origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    await payAndConfirm(checkout.body.session_id).expect(200);

    const paidAw = await col("payment_transactions").findOne({ id: aw.body.id });
    expect(paidAw).toMatchObject({
      kind: "ADDITIONAL_WORK",
      request_status: "PAID",
      fulfilled: true,
    });
    const caseCountAfter = await col("cases").countDocuments({ client_id: verifiedAw.clientId });
    expect(caseCountAfter).toBe(caseCountBefore);
    const mtdAfter = await col("client_services").findOne({
      client_id: verifiedAw.clientId,
      service_type: "MTD_INCOME_TAX",
    });
    expect(mtdAfter?.status).toBe(mtdBefore?.status);
    expect(mtdAfter?.status).toBe("NOT_ACTIVE");
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
