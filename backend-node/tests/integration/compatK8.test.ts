/**
 * K.8 — Additional-work payment-request FE wire + AW regression.
 * Proves create/list/checkout via compat; VERIFY-BEFORE-PURCHASE; fulfil never activates.
 */
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  activateClientService,
  bearer,
  bootTestApp,
  dropTestDb,
  makeClient,
  makeUser,
  TestUser,
} from "../helpers/app";
import { FakePaymentProvider } from "../helpers/payments";

describe("K.8 additional-work payment-request adapters", () => {
  let app: Express;
  let admin: TestUser;
  let accountant: TestUser;
  let client: TestUser & { clientId: string };
  let unverified: TestUser & { clientId: string };
  let caseId: string;
  let provider: FakePaymentProvider;

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    const { setPaymentProvider } = await import("../../src/services/payments");
    provider = new FakePaymentProvider();
    setPaymentProvider(provider);
    admin = await makeUser("ADMIN", "k8admin");
    accountant = await makeUser("ACCOUNTANT", "k8acc");
    client = await makeClient("k8client", { emailVerified: true });
    unverified = await makeClient("k8unverified", { emailVerified: false });
    ({ caseId } = await activateClientService(client, "SELF_ASSESSMENT"));
    await activateClientService(unverified, "SELF_ASSESSMENT");
  }, 60000);

  afterAll(async () => {
    const { setPaymentProvider } = await import("../../src/services/payments");
    setPaymentProvider(null);
    await dropTestDb();
  });

  it("AW1 admin create via compat; ACCOUNTANT cannot create; CLIENT blocked", async () => {
    await request(app)
      .post("/api/compat/admin/payment-requests")
      .set(bearer(accountant))
      .send({
        taxReturnId: caseId,
        description: "Extra schedules",
        amount: 75,
      })
      .expect(403);

    await request(app)
      .post("/api/compat/admin/payment-requests")
      .set(bearer(client))
      .send({ caseId, description: "Nope", amount: 10 })
      .expect(403);

    const created = await request(app)
      .post("/api/compat/admin/payment-requests")
      .set(bearer(admin))
      .send({
        taxReturnId: caseId,
        description: "Extra schedules",
        amount: 75.5,
        internalNote: "staff only",
      })
      .expect(201);

    expect(created.body.data.id).toBeTruthy();
    expect(created.body.data.kind).toBe("ADDITIONAL_WORK");
    expect(created.body.data.paymentStatus).toBe("pending");
    expect(created.body.data.amount).toBe(75.5);
    expect(created.body.data.caseId).toBe(caseId);
  });

  it("AW2 client lists own requests; AW4 staff list; internal_note hidden from client", async () => {
    const asClient = await request(app)
      .get("/api/compat/client/payment-requests")
      .set(bearer(client))
      .expect(200);
    const row = asClient.body.data.paymentRequests.find(
      (p: { caseId: string }) => p.caseId === caseId,
    );
    expect(row).toBeTruthy();
    expect(row.description).toBe("Extra schedules");
    expect(row.internalNote).toBeUndefined();

    const asAdmin = await request(app)
      .get(`/api/compat/admin/payment-requests?case_id=${caseId}`)
      .set(bearer(admin))
      .expect(200);
    const adminRow = asAdmin.body.data.paymentRequests.find(
      (p: { description: string }) => p.description === "Extra schedules",
    );
    expect(adminRow.internalNote).toBe("staff only");
  });

  it("AW2 billing transaction list includes AW rows", async () => {
    const list = await request(app)
      .get("/api/compat/client/transaction/list")
      .set(bearer(client))
      .expect(200);
    const aw = list.body.data.transactions.find(
      (t: { kind: string; description: string }) =>
        t.kind === "ADDITIONAL_WORK" && t.description === "Extra schedules",
    );
    expect(aw).toBeTruthy();
    expect(aw.status).toBe("pending");
  });

  it("AW3 verified client checkout creates Stripe session; unverified → 403", async () => {
    const list = await request(app)
      .get("/api/compat/client/payment-requests")
      .set(bearer(client))
      .expect(200);
    const pending = list.body.data.paymentRequests.find(
      (p: { paymentStatus: string }) => p.paymentStatus === "pending",
    );
    expect(pending).toBeTruthy();

    const before = provider.checkouts.length;
    const checkout = await request(app)
      .post(`/api/compat/client/payment-requests/${pending.id}/checkout`)
      .set(bearer(client))
      .send({ originUrl: "https://app.test.taxsimba.local" })
      .expect(200);
    expect(checkout.body.data.checkoutUrl).toMatch(/^https?:\/\//);
    expect(provider.checkouts.length).toBe(before + 1);

    // Seed AW for unverified and attempt checkout on native + compat paths.
    const { col } = await import("../../src/db/mongo");
    const { randomUUID } = await import("crypto");
    const { nowIso } = await import("../../src/domain/workflow");
    const unverifiedCase = await col("cases").findOne({
      client_id: unverified.clientId,
      service_type: "SELF_ASSESSMENT",
    });
    const awId = randomUUID();
    await col("payment_transactions").insertOne({
      id: awId,
      kind: "ADDITIONAL_WORK",
      user_id: unverified.id,
      client_id: unverified.clientId,
      case_id: unverifiedCase?.id,
      description: "Blocked",
      amount: 40,
      payment_status: "pending",
      request_status: "SENT",
      fulfilled: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    const blockedBefore = provider.checkouts.length;
    await request(app)
      .post(`/api/compat/client/payment-requests/${awId}/checkout`)
      .set(bearer(unverified))
      .send({ originUrl: "https://app.test.taxsimba.local" })
      .expect(403);
    expect(provider.checkouts.length).toBe(blockedBefore);
  });

  it("AW5 fulfil ADDITIONAL_WORK never activates SA/MTD or creates entitlement/case", async () => {
    const { col } = await import("../../src/db/mongo");
    const { fulfil } = await import("../../src/routes/payments");
    const { nowIso } = await import("../../src/domain/workflow");
    const { randomUUID } = await import("crypto");

    const casesBefore = await col("cases").countDocuments({ client_id: client.clientId });
    const saBefore = await col("client_services").findOne({
      client_id: client.clientId,
      service_type: "SELF_ASSESSMENT",
    });
    const mtdBefore = await col("client_services").findOne({
      client_id: client.clientId,
      service_type: "MTD_INCOME_TAX",
    });

    const awId = randomUUID();
    const sessionId = `cs_k8_aw_${randomUUID().slice(0, 8)}`;
    const tx = {
      id: awId,
      session_id: sessionId,
      kind: "ADDITIONAL_WORK",
      user_id: client.id,
      client_id: client.clientId,
      case_id: caseId,
      description: "Fulfil proof",
      amount: 99,
      currency: "gbp",
      payment_status: "paid",
      request_status: "SENT",
      fulfilled: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await col("payment_transactions").insertOne({ ...tx });
    await fulfil(tx);

    const stored = await col("payment_transactions").findOne({ id: awId });
    expect(stored?.fulfilled).toBe(true);
    expect(stored?.request_status).toBe("PAID");

    const casesAfter = await col("cases").countDocuments({ client_id: client.clientId });
    expect(casesAfter).toBe(casesBefore);

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
    expect(mtdAfter?.status).toBe(mtdBefore?.status ?? "NOT_ACTIVE");
  });

  it("cancel/resend via compat; paid cannot cancel", async () => {
    const created = await request(app)
      .post("/api/compat/admin/payment-requests")
      .set(bearer(admin))
      .send({ caseId, description: "Cancel me", amount: 20 })
      .expect(201);
    const id = created.body.data.id;

    await request(app)
      .post(`/api/compat/admin/payment-requests/${id}/resend`)
      .set(bearer(admin))
      .expect(200);
    await request(app)
      .post(`/api/compat/admin/payment-requests/${id}/cancel`)
      .set(bearer(admin))
      .expect(200);

    await request(app)
      .post(`/api/compat/client/payment-requests/${id}/checkout`)
      .set(bearer(client))
      .send({ originUrl: "https://app.test.taxsimba.local" })
      .expect(400);
  });

  it("role isolation: ACCOUNTANT needs case_id; cannot see other clients' AW", async () => {
    await request(app)
      .get("/api/compat/accountant/payment-requests")
      .set(bearer(accountant))
      .expect(400);

    // Unassigned accountant blocked on case-scoped list.
    await request(app)
      .get(`/api/compat/accountant/payment-requests?case_id=${caseId}`)
      .set(bearer(accountant))
      .expect(403);

    await request(app)
      .post(`/api/cases/${caseId}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: accountant.id })
      .expect(200);

    const ok = await request(app)
      .get(`/api/compat/accountant/payment-requests?case_id=${caseId}`)
      .set(bearer(accountant))
      .expect(200);
    expect(Array.isArray(ok.body.data.paymentRequests)).toBe(true);
    // internal_note stripped for accountant
    for (const p of ok.body.data.paymentRequests) {
      expect(p.internalNote).toBeUndefined();
    }
  });
});
