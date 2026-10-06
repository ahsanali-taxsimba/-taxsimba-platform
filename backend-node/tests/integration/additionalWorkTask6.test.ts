/**
 * Task 6 — Additional Work payment requests (D-006–D-010 / M-005).
 * SIMULATED FakePaymentProvider only — not Stripe TEST proof.
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
import { FakePaymentProvider, WEBHOOK_SIGNATURE } from "../helpers/payments";

describe("Task 6 additional-work payment requests", () => {
  let app: Express;
  let admin: TestUser;
  let superAdmin: TestUser;
  let clientA: TestUser & { clientId: string };
  let clientB: TestUser & { clientId: string };
  let caseA: string;
  let provider: FakePaymentProvider;
  let recording: { sent: { to: string; subject: string; text: string }[]; name: string; send: (m: any) => Promise<void> };

  function webhook(type: string, object: Record<string, unknown>) {
    return request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", WEBHOOK_SIGNATURE)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ type, object }));
  }

  async function payAndConfirm(sessionId: string) {
    const paid = provider.pay(sessionId);
    await webhook("checkout.session.completed", {
      id: sessionId,
      payment_status: paid.payment_status,
      payment_intent: paid.payment_intent,
    }).expect(200);
  }

  beforeAll(async () => {
    process.env.EMAIL_DRIVER = "smtp";
    ({ app } = await bootTestApp());
    const { setPaymentProvider } = await import("../../src/services/payments");
    const { setEmailProvider } = await import("../../src/services/email");
    provider = new FakePaymentProvider();
    setPaymentProvider(provider);
    recording = {
      name: "recording",
      sent: [],
      async send(m) {
        recording.sent.push(m);
      },
    };
    setEmailProvider(recording as any);
    admin = await makeUser("ADMIN", "t6admin");
    superAdmin = await makeUser("SUPER_ADMIN", "t6super");
    clientA = await makeClient("t6clienta", { emailVerified: true });
    clientB = await makeClient("t6clientb", { emailVerified: true });
    ({ caseId: caseA } = await activateClientService(clientA, "SELF_ASSESSMENT"));
    await activateClientService(clientB, "SELF_ASSESSMENT");
  }, 60000);

  afterAll(async () => {
    const { setPaymentProvider } = await import("../../src/services/payments");
    const { setEmailProvider } = await import("../../src/services/email");
    setPaymentProvider(null);
    setEmailProvider(null);
    delete process.env.EMAIL_DRIVER;
    await dropTestDb();
  });

  it("D-006 admin/super-admin create with amount+currency; deep link billing-history; client notified", async () => {
    recording.sent.length = 0;
    const created = await request(app)
      .post("/api/compat/admin/payment-requests")
      .set(bearer(admin))
      .send({
        taxReturnId: caseA,
        description: "Task6 CGT schedules",
        amount: 85.5,
        internalNote: "quoted on call",
      })
      .expect(201);

    expect(created.body.data).toMatchObject({
      kind: "ADDITIONAL_WORK",
      amount: 85.5,
      currency: "gbp",
      paymentStatus: "pending",
      caseId: caseA,
    });

    const asSuper = await request(app)
      .post("/api/compat/admin/payment-requests")
      .set(bearer(superAdmin))
      .send({ caseId: caseA, description: "SuperAdmin AW", amount: 10 })
      .expect(201);
    expect(asSuper.body.data.createdByRole || asSuper.body.data.created_by_role).toBeTruthy();

    const { col } = await import("../../src/db/mongo");
    const note = await col("notifications").findOne({
      user_id: clientA.id,
      title: "Action required: additional work for your TaxSimba service",
    });
    expect(note?.link).toBe("/dashboard/billing-history");

    // Wait briefly for async email attempt
    for (let i = 0; i < 50 && recording.sent.length === 0; i += 1) {
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(recording.sent.some((m) => /additional work/i.test(m.subject || m.text || ""))).toBe(
      true,
    );

    const list = await request(app)
      .get("/api/compat/client/payment-requests")
      .set(bearer(clientA))
      .expect(200);
    const row = list.body.data.paymentRequests.find(
      (p: { description: string }) => p.description === "Task6 CGT schedules",
    );
    expect(row.amount).toBe(85.5);
    expect(row.internalNote).toBeUndefined();
  });

  it("client cannot alter charge; Client B cannot access Client A request", async () => {
    const list = await request(app)
      .get("/api/compat/client/payment-requests")
      .set(bearer(clientA))
      .expect(200);
    const pending = list.body.data.paymentRequests.find(
      (p: { description: string; paymentStatus: string }) =>
        p.description === "Task6 CGT schedules" && p.paymentStatus === "pending",
    );
    expect(pending).toBeTruthy();

    const checkout = await request(app)
      .post(`/api/compat/client/payment-requests/${pending.id}/checkout`)
      .set(bearer(clientA))
      .send({ originUrl: "https://app.test.taxsimba.local", amount: 1 })
      .expect(200);
    expect(checkout.body.data.amount).toBe(85.5);
    expect(provider.last().amount).toBe(85.5);

    const asB = await request(app)
      .post(`/api/compat/client/payment-requests/${pending.id}/checkout`)
      .set(bearer(clientB))
      .send({ originUrl: "https://app.test.taxsimba.local" })
      .expect(404);

    expect(asB.body.message || asB.body.error || "").toMatch(/not found|Not found/i);

    await request(app)
      .get(`/api/compat/client/payment-requests/${pending.id}/receipt`)
      .set(bearer(clientB))
      .expect(404);
  });

  it("cancelled/failed stays unpaid; return URL / status alone cannot mark paid", async () => {
    const created = await request(app)
      .post("/api/compat/admin/payment-requests")
      .set(bearer(admin))
      .send({ caseId: caseA, description: "Cancel path", amount: 40 })
      .expect(201);
    const id = created.body.data.id;

    const checkout = await request(app)
      .post(`/api/compat/client/payment-requests/${id}/checkout`)
      .set(bearer(clientA))
      .send({ originUrl: "https://app.test.taxsimba.local" })
      .expect(200);
    const sessionId = checkout.body.data.sessionId;

    // Status poll without provider pay — remains unpaid
    const status = await request(app).get(`/api/payments/status/${sessionId}`).expect(200);
    expect(status.body.payment_status).not.toBe("paid");

    // Fake cancel/expire
    provider.expire(sessionId);
    await webhook("checkout.session.expired", {
      id: sessionId,
      payment_status: "expired",
    }).expect(200);

    const { col } = await import("../../src/db/mongo");
    const row = await col("payment_transactions").findOne({ id });
    expect(row?.payment_status).toBe("expired");
    expect(row?.fulfilled).toBe(false);

    // Explicit cancel on another outstanding request
    const created2 = await request(app)
      .post("/api/compat/admin/payment-requests")
      .set(bearer(admin))
      .send({ caseId: caseA, description: "Admin cancel", amount: 15 })
      .expect(201);
    await request(app)
      .post(`/api/compat/admin/payment-requests/${created2.body.data.id}/cancel`)
      .set(bearer(admin))
      .expect(200);
    await request(app)
      .post(`/api/compat/client/payment-requests/${created2.body.data.id}/checkout`)
      .set(bearer(clientA))
      .send({ originUrl: "https://app.test.taxsimba.local" })
      .expect(400);
  });

  it("pay once → receipt; replay/double-click no duplicate; AW never activates SA/MTD", async () => {
    const { col } = await import("../../src/db/mongo");
    const saBefore = await col("client_services").findOne({
      client_id: clientA.clientId,
      service_type: "SELF_ASSESSMENT",
    });
    const casesBefore = await col("cases").countDocuments({ client_id: clientA.clientId });
    const mtdBefore = await col("client_services").findOne({
      client_id: clientA.clientId,
      service_type: "MTD_INCOME_TAX",
    });

    const created = await request(app)
      .post("/api/compat/admin/payment-requests")
      .set(bearer(admin))
      .send({ caseId: caseA, description: "Pay once AW", amount: 120 })
      .expect(201);
    const id = created.body.data.id;

    const checkout1 = await request(app)
      .post(`/api/compat/client/payment-requests/${id}/checkout`)
      .set(bearer(clientA))
      .send({ originUrl: "https://app.test.taxsimba.local" })
      .expect(200);
    const checkout2 = await request(app)
      .post(`/api/compat/client/payment-requests/${id}/checkout`)
      .set(bearer(clientA))
      .send({ originUrl: "https://app.test.taxsimba.local" })
      .expect(200);
    expect(checkout2.body.data.sessionId).toBe(checkout1.body.data.sessionId);
    expect(checkout2.body.data.reused).toBe(true);

    await payAndConfirm(checkout1.body.data.sessionId);
    await payAndConfirm(checkout1.body.data.sessionId); // replay

    const receipts = await col("invoices").find({ payment_request_id: id }).toArray();
    expect(receipts).toHaveLength(1);

    const paidNote = await col("notifications").findOne({
      user_id: clientA.id,
      title: "Payment received | TaxSimba",
    });
    expect(paidNote?.link).toBe("/dashboard/billing-history");

    const receipt = await request(app)
      .get(`/api/compat/client/payment-requests/${id}/receipt`)
      .set(bearer(clientA))
      .expect(200);
    expect(receipt.text).toContain(receipts[0].number);
    expect(receipt.text).toContain("£120.00");

    // Paid cannot checkout / resend
    await request(app)
      .post(`/api/compat/client/payment-requests/${id}/checkout`)
      .set(bearer(clientA))
      .send({ originUrl: "https://app.test.taxsimba.local" })
      .expect(400);
    await request(app)
      .post(`/api/compat/admin/payment-requests/${id}/resend`)
      .set(bearer(admin))
      .expect(400);

    const saAfter = await col("client_services").findOne({
      client_id: clientA.clientId,
      service_type: "SELF_ASSESSMENT",
    });
    const mtdAfter = await col("client_services").findOne({
      client_id: clientA.clientId,
      service_type: "MTD_INCOME_TAX",
    });
    expect(saAfter?.package_code).toBe(saBefore?.package_code);
    expect(saAfter?.status).toBe(saBefore?.status);
    expect(mtdAfter?.status ?? "NOT_ACTIVE").toBe(mtdBefore?.status ?? "NOT_ACTIVE");
    expect(await col("cases").countDocuments({ client_id: clientA.clientId })).toBe(casesBefore);
  });

  it("M-005 resend reminder always emails even when prior unread reminder exists", async () => {
    recording.sent.length = 0;
    const created = await request(app)
      .post("/api/compat/admin/payment-requests")
      .set(bearer(admin))
      .send({ caseId: caseA, description: "Remind me", amount: 55 })
      .expect(201);
    const id = created.body.data.id;

    await request(app)
      .post(`/api/compat/admin/payment-requests/${id}/resend`)
      .set(bearer(admin))
      .expect(200);

    // Second resend while first reminder still unread — must still produce email
    recording.sent.length = 0;
    await request(app)
      .post(`/api/compat/admin/payment-requests/${id}/resend`)
      .set(bearer(admin))
      .expect(200);

    for (let i = 0; i < 50 && recording.sent.length === 0; i += 1) {
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(recording.sent.length).toBeGreaterThan(0);

    const { col } = await import("../../src/db/mongo");
    const reminder = await col("notifications").findOne({
      user_id: clientA.id,
      title: "Reminder: additional work awaiting payment",
      is_read: false,
    });
    expect(reminder?.link).toBe("/dashboard/billing-history");
  });

  it("provider-complete DB-pending AW checkout reuses session (no second charge)", async () => {
    const created = await request(app)
      .post("/api/compat/admin/payment-requests")
      .set(bearer(admin))
      .send({ caseId: caseA, description: "Inflight reuse", amount: 33 })
      .expect(201);
    const id = created.body.data.id;
    const first = await request(app)
      .post(`/api/compat/client/payment-requests/${id}/checkout`)
      .set(bearer(clientA))
      .send({ originUrl: "https://app.test.taxsimba.local" })
      .expect(200);
    provider.pay(first.body.data.sessionId); // complete at provider only
    const before = provider.checkouts.length;
    const second = await request(app)
      .post(`/api/compat/client/payment-requests/${id}/checkout`)
      .set(bearer(clientA))
      .send({ originUrl: "https://app.test.taxsimba.local" })
      .expect(200);
    expect(second.body.data.sessionId).toBe(first.body.data.sessionId);
    expect(second.body.data.reused).toBe(true);
    expect(provider.checkouts.length).toBe(before);
  });
});
