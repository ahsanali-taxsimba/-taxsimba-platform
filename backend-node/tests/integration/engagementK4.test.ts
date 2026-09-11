/**
 * K.4 engagement acceptance — final acceptance proofs.
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
  TestUser,
} from "../helpers/app";
import { FakePaymentProvider, WEBHOOK_SIGNATURE } from "../helpers/payments";

type Client = TestUser & { clientId: string };

describe("K.4 engagement acceptance", () => {
  let app: Express;
  let provider: FakePaymentProvider;
  const priorAgreementEnv = process.env.ENGAGEMENT_AGREEMENT_VERSION;

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

  async function activatePackage(client: Client, planId: string) {
    const checkout = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(client))
      .send({ planId, originUrl: "https://app.test.taxsimba.local" })
      .expect(200);
    await payAndConfirm(checkout.body.data.sessionId).expect(200);
    await request(app)
      .post("/api/compat/client/subscription/checkout-success")
      .set(bearer(client))
      .send({ sessionId: checkout.body.data.sessionId })
      .expect(200);
  }

  async function accept(client: Client, sig = "data:image/png;base64,c2ln") {
    return request(app)
      .post("/api/compat/client/accept-engagement-letter")
      .set(bearer(client))
      .send({ signature: sig, accepted: true });
  }

  beforeAll(async () => {
    delete process.env.ENGAGEMENT_AGREEMENT_VERSION;
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
    if (priorAgreementEnv === undefined) delete process.env.ENGAGEMENT_AGREEMENT_VERSION;
    else process.env.ENGAGEMENT_AGREEMENT_VERSION = priorAgreementEnv;
    const { setPaymentProvider } = await import("../../src/services/payments");
    setPaymentProvider(null);
    await dropTestDb();
    const mem = (globalThis as { __taxsimbaMemoryMongoK4?: { stop: () => Promise<boolean> } })
      .__taxsimbaMemoryMongoK4;
    if (mem) await mem.stop();
  });

  it("rejects engagement accept before ACTIVE entitlement (not before purchase)", async () => {
    const client = await makeClient("k4pre");
    const res = await accept(client);
    expect(res.status).toBe(400);
    expect(String(res.body.message)).toMatch(/active service/i);

    const status = await request(app)
      .get("/api/compat/client/engagement-letter-status")
      .set(bearer(client))
      .expect(200);
    expect(status.body.data.isEngagementLetterAccepted).toBe(false);

    // Purchase path still available (verify gate only — engagement must not block).
    const checkout = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(client))
      .send({ planId: "SIMPLE", originUrl: "https://app.test.taxsimba.local" })
      .expect(200);
    expect(checkout.body.data.checkoutUrl).toBeTruthy();
  });

  it("SA-only acceptance isolates to SA context and does not invent MTD", async () => {
    const client = await makeClient("k4sa");
    await activatePackage(client, "SIMPLE");
    const res = await accept(client, "data:image/png;base64,c2E=");
    expect(res.status).toBe(200);
    expect(res.body.data.serviceTypes).toEqual(["SELF_ASSESSMENT"]);
    expect(res.body.data.serviceTypes).not.toContain("MTD_INCOME_TAX");
    expect(Array.isArray(res.body.data.caseIds)).toBe(true);
    expect(res.body.data.caseIds.length).toBeGreaterThanOrEqual(1);

    const { col } = await import("../../src/db/mongo");
    const row = await col("engagement_acceptances").findOne({ user_id: client.id });
    expect(row?.service_types).toEqual(["SELF_ASSESSMENT"]);
    const mtd = await col("client_services").findOne({
      client_id: client.clientId,
      service_type: "MTD_INCOME_TAX",
    });
    expect(mtd?.status).toBe("NOT_ACTIVE");
    expect(await col("cases").countDocuments({
      client_id: client.clientId,
      service_type: "MTD_INCOME_TAX",
    })).toBe(0);
  });

  it("MTD-only acceptance isolates to MTD context and does not invent SA", async () => {
    const client = await makeClient("k4mtd");
    await activatePackage(client, "MTD_ESSENTIAL");
    const res = await accept(client, "data:image/png;base64,bXRk");
    expect(res.status).toBe(200);
    expect(res.body.data.serviceTypes).toEqual(["MTD_INCOME_TAX"]);
    expect(res.body.data.serviceTypes).not.toContain("SELF_ASSESSMENT");

    const { col } = await import("../../src/db/mongo");
    const row = await col("engagement_acceptances").findOne({ user_id: client.id });
    expect(row?.service_types).toEqual(["MTD_INCOME_TAX"]);
    const sa = await col("client_services").findOne({
      client_id: client.clientId,
      service_type: "SELF_ASSESSMENT",
    });
    expect(sa?.status).toBe("NOT_ACTIVE");
  });

  it("client-care-v1 acceptance covers later ACTIVE MTD under same version (account-level)", async () => {
    // Contract: client-care-v1 is account-level. service_types are audit-at-accept only.
    const client = await makeClient("k4dual");
    await activatePackage(client, "SIMPLE");
    expect((await accept(client, "data:image/png;base64,ZHVhbA==")).status).toBe(200);

    const { col } = await import("../../src/db/mongo");
    const before = await col("engagement_acceptances").findOne({ user_id: client.id });
    expect(before?.service_types).toEqual(["SELF_ASSESSMENT"]);

    await activatePackage(client, "MTD_ESSENTIAL");
    const status = await request(app)
      .get("/api/compat/client/engagement-letter-status")
      .set(bearer(client))
      .expect(200);
    // Still accepted under client-care-v1 — no silent per-service invention; same agreement covers.
    expect(status.body.data.isEngagementLetterAccepted).toBe(true);
    expect(status.body.data.requiredAgreementVersion).toBe("client-care-v1");
    expect(status.body.data.agreementVersion).toBe("client-care-v1");

    // Audit snapshot remains the original SA-only context (not rewritten by later MTD).
    const after = await col("engagement_acceptances").findOne({ user_id: client.id });
    expect(after?.service_types).toEqual(["SELF_ASSESSMENT"]);
    expect(after?.history ?? []).toEqual([]);
  });

  it("stale agreement version does not satisfy required version; re-accept archives audit", async () => {
    const client = await makeClient("k4ver");
    await activatePackage(client, "SMART");
    expect((await accept(client, "data:image/png;base64,djE=")).status).toBe(200);

    const { col } = await import("../../src/db/mongo");
    const v1 = await col("engagement_acceptances").findOne({ user_id: client.id });
    expect(v1?.agreement_version).toBe("client-care-v1");
    const v1Hash = v1?.signature_hash;
    const v1AcceptedAt = v1?.accepted_at;

    process.env.ENGAGEMENT_AGREEMENT_VERSION = "client-care-v2";
    try {
      const stale = await request(app)
        .get("/api/compat/client/engagement-letter-status")
        .set(bearer(client))
        .expect(200);
      expect(stale.body.data.isEngagementLetterAccepted).toBe(false);
      expect(stale.body.data.requiredAgreementVersion).toBe("client-care-v2");
      expect(stale.body.data.agreementVersion).toBe("client-care-v1");

      const account = await request(app)
        .post("/api/compat/auth/get-account-details")
        .set(bearer(client))
        .expect(200);
      expect(account.body.data.isEngagementLetterAccepted).toBe(false);
      expect(account.body.data.requiredAgreementVersion).toBe("client-care-v2");

      const re = await accept(client, "data:image/png;base64,djI=");
      expect(re.status).toBe(200);
      expect(re.body.data.agreementVersion).toBe("client-care-v2");
      expect(re.body.data.isEngagementLetterAccepted).toBe(true);

      const row = await col("engagement_acceptances").findOne({ user_id: client.id });
      expect(row?.agreement_version).toBe("client-care-v2");
      expect(row?.signature_hash).not.toBe(v1Hash);
      expect(Array.isArray(row?.history)).toBe(true);
      expect(row!.history).toHaveLength(1);
      const archived = (row!.history as Record<string, unknown>[])[0];
      expect(archived).toMatchObject({
        agreement_version: "client-care-v1",
        status: "ACCEPTED",
        accepted_at: v1AcceptedAt,
        signature_hash: v1Hash,
        reason: "superseded_by_new_version",
      });
      expect(archived.service_types).toEqual(["SELF_ASSESSMENT"]);
      expect(archived.signature).toBeTruthy();
      expect(archived.audit).toBeTruthy();
      expect(archived.case_ids).toBeTruthy();

      const ok = await request(app)
        .get("/api/compat/client/engagement-letter-status")
        .set(bearer(client))
        .expect(200);
      expect(ok.body.data.isEngagementLetterAccepted).toBe(true);
      expect(ok.body.data.agreementVersion).toBe("client-care-v2");
    } finally {
      delete process.env.ENGAGEMENT_AGREEMENT_VERSION;
    }
  });

  it("security: clients cannot read/write another client's engagement by forging ids", async () => {
    const alice = await makeClient("k4alice");
    const bob = await makeClient("k4bob");
    await activatePackage(alice, "SIMPLE");
    await activatePackage(bob, "ELITE");
    expect((await accept(alice, "data:image/png;base64,YWxpY2U=")).status).toBe(200);

    // Bob cannot see Alice as accepted via his own status.
    const bobStatus = await request(app)
      .get("/api/compat/client/engagement-letter-status")
      .set(bearer(bob))
      .expect(200);
    expect(bobStatus.body.data.isEngagementLetterAccepted).toBe(false);

    // Forged body fields must not bind acceptance to Alice.
    await request(app)
      .post("/api/compat/client/accept-engagement-letter")
      .set(bearer(bob))
      .send({
        signature: "data:image/png;base64,Ym9i",
        accepted: true,
        userId: alice.id,
        user_id: alice.id,
        clientId: alice.clientId,
      })
      .expect(200);

    const { col } = await import("../../src/db/mongo");
    const aliceRow = await col("engagement_acceptances").findOne({ user_id: alice.id });
    const bobRow = await col("engagement_acceptances").findOne({ user_id: bob.id });
    expect(aliceRow?.signature).toContain("YWxpY2U");
    expect(bobRow?.user_id).toBe(bob.id);
    expect(bobRow?.client_id).toBe(bob.clientId);
    expect(bobRow?.signature).toContain("Ym9i");

    const aliceAccount = await request(app)
      .post("/api/compat/auth/get-account-details")
      .set(bearer(alice))
      .expect(200);
    const bobAccount = await request(app)
      .post("/api/compat/auth/get-account-details")
      .set(bearer(bob))
      .expect(200);
    expect(aliceAccount.body.data.email).toBe(alice.email);
    expect(bobAccount.body.data.email).toBe(bob.email);
    expect(aliceAccount.body.data.isEngagementLetterAccepted).toBe(true);
    expect(bobAccount.body.data.isEngagementLetterAccepted).toBe(true);
  });

  it("acceptance has no entitlement/payment/case side effects beyond audit snapshot", async () => {
    const client = await makeClient("k4side");
    await activatePackage(client, "SIMPLE");
    const { col } = await import("../../src/db/mongo");
    const casesBefore = await col("cases").countDocuments({ client_id: client.clientId });
    const txBefore = await col("payment_transactions").countDocuments({ user_id: client.id });
    const saBefore = await col("client_services").findOne({
      client_id: client.clientId,
      service_type: "SELF_ASSESSMENT",
    });
    const mtdBefore = await col("client_services").findOne({
      client_id: client.clientId,
      service_type: "MTD_INCOME_TAX",
    });

    expect((await accept(client)).status).toBe(200);

    expect(await col("cases").countDocuments({ client_id: client.clientId })).toBe(casesBefore);
    expect(await col("payment_transactions").countDocuments({ user_id: client.id })).toBe(txBefore);
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

  it("middleware contract: ACTIVE missing acceptance gated; valid acceptance allows dashboard SoT", async () => {
    // FE middleware reads JWT flags from login/status — prove the server contract it depends on.
    const client = await makeClient("k4gate");
    await activatePackage(client, "SIMPLE");

    const missing = await request(app)
      .get("/api/compat/client/engagement-letter-status")
      .set(bearer(client))
      .expect(200);
    expect(missing.body.data.isEngagementLetterAccepted).toBe(false);
    // Equivalent to middleware: hasActiveService && !hasSignedLetter → /engagement-letter
    const accountMissing = await request(app)
      .post("/api/compat/auth/get-account-details")
      .set(bearer(client))
      .expect(200);
    expect(accountMissing.body.data.hasActiveService).toBe(true);
    expect(accountMissing.body.data.isEngagementLetterAccepted).toBe(false);

    expect((await accept(client)).status).toBe(200);
    const ok = await request(app)
      .get("/api/compat/client/engagement-letter-status")
      .set(bearer(client))
      .expect(200);
    expect(ok.body.data.isEngagementLetterAccepted).toBe(true);
    const accountOk = await request(app)
      .post("/api/compat/auth/get-account-details")
      .set(bearer(client))
      .expect(200);
    expect(accountOk.body.data.hasActiveService).toBe(true);
    expect(accountOk.body.data.isEngagementLetterAccepted).toBe(true);
  });

  it("persists acceptance and exposes it on login; same-version re-accept is idempotent", async () => {
    const email = `k4login.${randomUUID().slice(0, 8)}@example.com`;
    const password = "Tr0ubl3-Kettle-Marsh";
    const reg = await request(app)
      .post("/api/compat/auth/register")
      .send({ email, password, name: "K4", surname: "Login" })
      .expect(200);
    const token = reg.body.data.accessToken;
    const { col } = await import("../../src/db/mongo");
    await col("users").updateOne({ email }, { $set: { email_verified_at: new Date().toISOString() } });

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

    const user = await col("users").findOne({ email });
    const before = await col("engagement_acceptances").findOne({ user_id: user!.id });
    await request(app)
      .post("/api/compat/client/accept-engagement-letter")
      .set({ Authorization: `Bearer ${token}` })
      .send({ signature: "data:image/png;base64,ccc", accepted: true })
      .expect(200);
    const after = await col("engagement_acceptances").findOne({ user_id: user!.id });
    expect(after?.signature_hash).toBe(before?.signature_hash);
    expect(after?.history ?? []).toEqual([]);

    const login = await request(app)
      .post("/api/compat/auth/login")
      .send({ email, password })
      .expect(200);
    expect(login.body.data.isEngagementLetterAccepted).toBe(true);
    expect(login.body.data.user.isEngagementLetterAccepted).toBe(true);
  });

  it("rejects accept without signature or accepted=false", async () => {
    const client = await makeClient("k4bad");
    await activatePackage(client, "SIMPLE");
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
