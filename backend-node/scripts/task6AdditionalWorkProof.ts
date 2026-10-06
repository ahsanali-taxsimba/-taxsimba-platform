/**
 * Task 6 proof — Additional Work create → notify → pay → receipt → resend (SIMULATED).
 * Never counts as real Stripe proof. Writes JSON under OUT_DIR.
 *
 * Usage:
 *   OUT_DIR=/tmp/t6-aw-proof ts-node --transpile-only scripts/task6AdditionalWorkProof.ts
 */
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

import request from "supertest";

import {
  activateClientService,
  bearer,
  bootTestApp,
  dropTestDb,
  makeClient,
  makeUser,
} from "../tests/helpers/app";
import { FakePaymentProvider, WEBHOOK_SIGNATURE } from "../tests/helpers/payments";

const OUT = process.env.OUT_DIR || path.join("/tmp", `t6-aw-proof-${Date.now()}`);

function save(name: string, data: unknown) {
  fs.mkdirSync(OUT, { recursive: true });
  const p = path.join(OUT, name);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
  return p;
}

async function main() {
  process.env.EMAIL_DRIVER = "smtp";
  const { app } = await bootTestApp();
  const { setPaymentProvider } = await import("../src/services/payments");
  const { setEmailProvider } = await import("../src/services/email");
  const provider = new FakePaymentProvider();
  setPaymentProvider(provider);
  const recording = {
    name: "recording",
    sent: [] as { to: string; subject: string; text: string }[],
    async send(m: { to: string; subject: string; text: string }) {
      recording.sent.push(m);
    },
  };
  setEmailProvider(recording as any);

  const admin = await makeUser("ADMIN", "t6p-admin");
  const client = await makeClient(`t6p-${randomUUID().slice(0, 6)}`, { emailVerified: true });
  const stranger = await makeClient(`t6p-b-${randomUUID().slice(0, 6)}`, { emailVerified: true });
  const { caseId } = await activateClientService(client, "SELF_ASSESSMENT");
  await activateClientService(stranger, "SELF_ASSESSMENT");

  const webhook = (type: string, object: Record<string, unknown>) =>
    request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", WEBHOOK_SIGNATURE)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ type, object }));

  const pay = async (sessionId: string) => {
    const paid = provider.pay(sessionId);
    await webhook("checkout.session.completed", {
      id: sessionId,
      payment_status: paid.payment_status,
      payment_intent: paid.payment_intent,
    }).expect(200);
  };

  // 01 create
  const created = await request(app)
    .post("/api/compat/admin/payment-requests")
    .set(bearer(admin))
    .send({
      taxReturnId: caseId,
      description: "Proof additional schedules",
      amount: 99.5,
      internalNote: "staff only",
    });
  save("01_admin_create.json", {
    label: "SIMULATED — not Stripe",
    status: created.status,
    body: created.body,
  });

  const { col } = await import("../src/db/mongo");
  const createNote = await col("notifications").findOne({
    user_id: client.id,
    title: "Action required: additional work for your TaxSimba service",
  });
  save("02_client_notification.json", {
    link: createNote?.link,
    title: createNote?.title,
    emails: recording.sent.map((e) => ({ to: e.to, subject: e.subject })),
  });

  // 03 client list
  const list = await request(app)
    .get("/api/compat/client/payment-requests")
    .set(bearer(client));
  save("03_client_list.json", { status: list.status, body: list.body });

  const id = created.body.data.id;

  // 04 isolation
  const iso = await request(app)
    .post(`/api/compat/client/payment-requests/${id}/checkout`)
    .set(bearer(stranger))
    .send({ originUrl: "https://app.test.taxsimba.local" });
  save("04_client_b_isolation.json", { status: iso.status, body: iso.body });

  // 05 checkout + amount locked
  const checkout = await request(app)
    .post(`/api/compat/client/payment-requests/${id}/checkout`)
    .set(bearer(client))
    .send({ originUrl: "https://app.test.taxsimba.local", amount: 1 });
  save("05_checkout_amount_locked.json", {
    status: checkout.status,
    body: checkout.body,
    providerAmount: provider.last()?.amount,
    label: "SIMULATED FakePaymentProvider",
  });

  // 06 return URL alone
  const statusAlone = await request(app).get(
    `/api/payments/status/${checkout.body.data.sessionId}`,
  );
  save("06_return_url_alone_unpaid.json", { status: statusAlone.status, body: statusAlone.body });

  // 07 pay + replay
  await pay(checkout.body.data.sessionId);
  await pay(checkout.body.data.sessionId);
  const receipts = await col("invoices").find({ payment_request_id: id }).toArray();
  const paidRow = await col("payment_transactions").findOne({ id });
  const sa = await col("client_services").findOne({
    client_id: client.clientId,
    service_type: "SELF_ASSESSMENT",
  });
  save("07_paid_receipt_no_dup_no_package_change.json", {
    receiptCount: receipts.length,
    receiptNumber: receipts[0]?.number ?? null,
    paymentStatus: paidRow?.payment_status,
    fulfilled: paidRow?.fulfilled,
    saPackage: sa?.package_code,
    saStatus: sa?.status,
  });

  const receiptHtml = await request(app)
    .get(`/api/compat/client/payment-requests/${id}/receipt`)
    .set(bearer(client));
  save("08_receipt_html_meta.json", {
    status: receiptHtml.status,
    contentType: receiptHtml.headers["content-type"],
    includesAmount: String(receiptHtml.text || "").includes("£99.50"),
    includesNumber: receipts[0] ? String(receiptHtml.text || "").includes(String(receipts[0].number)) : false,
  });

  // 09 paid cannot resend
  const resendPaid = await request(app)
    .post(`/api/compat/admin/payment-requests/${id}/resend`)
    .set(bearer(admin));
  save("09_paid_cannot_resend.json", { status: resendPaid.status, body: resendPaid.body });

  // 10 outstanding resend email
  const outstanding = await request(app)
    .post("/api/compat/admin/payment-requests")
    .set(bearer(admin))
    .send({ caseId, description: "Outstanding remind", amount: 25 });
  recording.sent.length = 0;
  await request(app)
    .post(`/api/compat/admin/payment-requests/${outstanding.body.data.id}/resend`)
    .set(bearer(admin));
  recording.sent.length = 0;
  await request(app)
    .post(`/api/compat/admin/payment-requests/${outstanding.body.data.id}/resend`)
    .set(bearer(admin));
  for (let i = 0; i < 40 && recording.sent.length === 0; i += 1) {
    await new Promise((r) => setTimeout(r, 25));
  }
  const remindNote = await col("notifications").findOne({
    user_id: client.id,
    title: "Reminder: additional work awaiting payment",
    is_read: false,
  });
  save("10_resend_reminder_email.json", {
    secondResendEmails: recording.sent.map((e) => ({ to: e.to, subject: e.subject })),
    reminderLink: remindNote?.link,
  });

  save("00_summary.json", {
    mode: "SIMULATED FakePaymentProvider",
    stripe: "BLOCKED — not exercised",
    outDir: OUT,
    caseId,
    paidRequestId: id,
  });

  console.log(`Task 6 proof written to ${OUT}`);
  setPaymentProvider(null);
  setEmailProvider(null);
  await dropTestDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
