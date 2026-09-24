/**
 * Post-purchase email acceptance — verification personalisation + webhook welcome emails.
 */
import { randomUUID } from "crypto";
import type { Express } from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { bearer, bootTestApp, dropTestDb, makeClient, makeUser, TestUser } from "../helpers/app";
import { FakePaymentProvider, WEBHOOK_SIGNATURE } from "../helpers/payments";

type Client = TestUser & { clientId: string };

interface Sent {
  to: string;
  subject: string;
  text: string;
  html: string;
}

class RecordingProvider {
  readonly name = "recording";
  sent: Sent[] = [];
  failNext = 0;

  async send(message: Sent): Promise<void> {
    if (this.failNext > 0) {
      this.failNext -= 1;
      throw new Error("provider unavailable");
    }
    this.sent.push(message);
  }
}

describe("post-purchase email acceptance", () => {
  let app: Express;
  let provider: FakePaymentProvider;
  let mail: RecordingProvider;

  beforeAll(async () => {
    process.env.EMAIL_DRIVER = "smtp";
    process.env.APP_BASE_URL = "https://app.test.taxsimba.local";
    ({ app } = await bootTestApp());
    const { setPaymentProvider } = await import("../../src/services/payments");
    provider = new FakePaymentProvider();
    setPaymentProvider(provider);
  }, 60000);

  afterEach(async () => {
    const { setEmailProvider } = await import("../../src/services/email");
    setEmailProvider(null);
  });

  afterAll(async () => {
    const { setPaymentProvider } = await import("../../src/services/payments");
    setPaymentProvider(null);
    delete process.env.EMAIL_DRIVER;
    await dropTestDb();
  });

  async function useMail(): Promise<RecordingProvider> {
    const { setEmailProvider } = await import("../../src/services/email");
    mail = new RecordingProvider();
    setEmailProvider(mail);
    return mail;
  }

  async function waitForMailTo(to: string, subject: string, min = 1): Promise<Sent[]> {
    const { col } = await import("../../src/db/mongo");
    for (let i = 0; i < 100; i += 1) {
      const rows = await col("email_messages").find({ to, subject }).toArray();
      if (rows.length >= min && rows.every((r) => (r.attempts as number) >= 1)) {
        return mail.sent.filter((m) => m.to === to && m.subject === subject);
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(`expected ${min} delivery attempt(s) for '${subject}' to ${to}`);
  }

  function webhook(type: string, object: Record<string, unknown>) {
    return request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", WEBHOOK_SIGNATURE)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ type, object }));
  }

  async function namedClient(first: string, last: string): Promise<Client> {
    const client = await makeClient(`${first.toLowerCase()}.${randomUUID().slice(0, 6)}`);
    const { col } = await import("../../src/db/mongo");
    await col("users").updateOne(
      { id: client.id },
      { $set: { name: `${first} ${last}`, email: client.email } },
    );
    await col("clients").updateOne(
      { id: client.clientId },
      { $set: { first_name: first, last_name: last, name: `${first} ${last}` } },
    );
    return client;
  }

  async function buy(client: Client, serviceType: string, packageCode: string): Promise<string> {
    const res = await request(app)
      .post("/api/payments/service-checkout")
      .set(bearer(client))
      .send({
        service_type: serviceType,
        package_code: packageCode,
        origin_url: "https://app.test.taxsimba.local",
      })
      .expect(200);
    const sessionId = res.body.session_id as string;
    const paid = provider.pay(sessionId);
    await webhook("checkout.session.completed", {
      id: sessionId,
      payment_status: paid.payment_status,
      payment_intent: paid.payment_intent,
    }).expect(200);
    return sessionId;
  }

  it("1+2: verification email uses first name and does not claim purchase", async () => {
    const rec = await useMail();
    const email = `verify.first.${randomUUID().slice(0, 8)}@parity.taxsimba.local`;
    const password = "Tr0ubl3-Kettle-Marsh";
    await request(app)
      .post("/api/compat/auth/register")
      .send({
        email,
        password,
        name: "Amara",
        surname: "Boateng",
        mobile: "07700900111",
        userRole: "MTD",
      })
      .expect(200);

    const msgs = await waitForMailTo(email, "Verify your email address | TaxSimba");
    expect(msgs).toHaveLength(1);
    const msg = msgs[0];
    expect(msg.text).toMatch(/Hello Amara,/);
    expect(msg.text).toMatch(/verify your email address to confirm your TaxSimba account/i);
    expect(msg.text).toMatch(/does not activate a package/i);
    expect(msg.text).not.toMatch(/purchase confirmed|subscription is active|amount paid/i);
    expect(msg.text).toContain(
      "https://app.test.taxsimba.local/verify-email?token=",
    );
    expect(msg.html).toContain("Verify your TaxSimba account");
  });

  it("3+7: successful SA purchase sends one correct SA confirmation", async () => {
    const rec = await useMail();
    const client = await namedClient("Sara", "Williams");
    await buy(client, "SELF_ASSESSMENT", "SIMPLE");

    const subject = "Your Self Assessment package is confirmed | TaxSimba";
    const msgs = await waitForMailTo(client.email, subject);
    expect(msgs).toHaveLength(1);
    const msg = msgs[0];
    expect(msg.text).toMatch(/Hello Sara,/);
    expect(msg.text).toContain("Service purchased: Self Assessment");
    expect(msg.text).toContain("Package: Tax Simba Simple");
    expect(msg.text).toMatch(/Amount paid: £119\.00/);
    expect(msg.text).toContain("One-off payment");
    expect(msg.text).toContain("Per tax year");
    expect(msg.text).toContain("Subscription status: Active");
    expect(msg.text).toContain("https://app.test.taxsimba.local/dashboard");
    expect(msg.text).toContain("https://app.test.taxsimba.local/engagement-letter");
    expect(msg.text).toContain("https://app.test.taxsimba.local/contact-us");
    expect(msg.text).not.toMatch(/Making Tax Digital|Simbian|mtd-dashboard/i);
    expect(msg.text).not.toMatch(/stripe|webhook|cs_test|payment_intent|pi_/i);
  });

  it("4+7: successful MTD purchase sends one correct MTD confirmation", async () => {
    const rec = await useMail();
    const client = await namedClient("Amara", "Boateng");
    await buy(client, "MTD_INCOME_TAX", "MTD_GROWTH");

    const subject = "Your Making Tax Digital for Income Tax package is confirmed | TaxSimba";
    const msgs = await waitForMailTo(client.email, subject);
    expect(msgs).toHaveLength(1);
    const msg = msgs[0];
    expect(msg.text).toMatch(/Hello Amara,/);
    expect(msg.text).toContain("Service purchased: Making Tax Digital for Income Tax");
    expect(msg.text).toContain("Package: Simbian Growth");
    expect(msg.text).toMatch(/Amount paid: £59\.99/);
    expect(msg.text).toContain("Recurring subscription");
    expect(msg.text).toContain("Monthly");
    expect(msg.text).toContain("Subscription status: Active");
    expect(msg.text).toContain("https://app.test.taxsimba.local/mtd-dashboard");
    expect(msg.text).not.toMatch(/Service purchased: Self Assessment|Tax Simba Simple/);
    expect(msg.text).not.toMatch(/stripe|webhook|cs_test|payment_intent|pi_/i);
  });

  it("5: webhook replay sends no duplicate welcome email", async () => {
    const rec = await useMail();
    const client = await namedClient("James", "Okoro");
    const sessionId = await buy(client, "MTD_INCOME_TAX", "MTD_COMPLY");
    const subject =
      "Your Making Tax Digital for Income Tax package is confirmed | TaxSimba";
    const first = await waitForMailTo(client.email, subject);
    expect(first).toHaveLength(1);

    // Replay the same paid webhook
    await webhook("checkout.session.completed", {
      id: sessionId,
      payment_status: "paid",
      payment_intent: "pi_replay",
    }).expect(200);
    await new Promise((r) => setTimeout(r, 200));
    expect(rec.sent.filter((m) => m.to === client.email && m.subject === subject)).toHaveLength(1);

    const { col } = await import("../../src/db/mongo");
    const rows = await col("email_messages").find({ to: client.email, subject }).toArray();
    expect(rows).toHaveLength(1);
  });

  it("6: cancelled/failed checkout sends no welcome email", async () => {
    const rec = await useMail();
    const client = await namedClient("Priya", "Nair");
    const res = await request(app)
      .post("/api/payments/service-checkout")
      .set(bearer(client))
      .send({
        service_type: "MTD_INCOME_TAX",
        package_code: "MTD_ELITE",
        origin_url: "https://app.test.taxsimba.local",
      })
      .expect(200);
    const sessionId = res.body.session_id as string;

    await webhook("checkout.session.expired", { id: sessionId }).expect(200);
    await webhook("checkout.session.async_payment_failed", { id: sessionId }).expect(200);
    await new Promise((r) => setTimeout(r, 250));

    expect(
      rec.sent.filter((m) => m.to === client.email && /package is confirmed/i.test(m.subject)),
    ).toHaveLength(0);

    const { col } = await import("../../src/db/mongo");
    const svc = await col("client_services").findOne({
      client_id: client.clientId,
      service_type: "MTD_INCOME_TAX",
    });
    expect(svc?.status).not.toBe("ACTIVE");
  });

  it("8: email-provider failure is recorded and retryable without duplicating entitlement", async () => {
    const rec = await useMail();
    rec.failNext = 99;
    const client = await namedClient("Nora", "Chen");
    await buy(client, "SELF_ASSESSMENT", "SMART");

    const subject = "Your Self Assessment package is confirmed | TaxSimba";
    await waitForMailTo(client.email, subject);

    const { col } = await import("../../src/db/mongo");
    const svc = await col("client_services").findOne({
      client_id: client.clientId,
      service_type: "SELF_ASSESSMENT",
    });
    expect(svc?.status).toBe("ACTIVE");
    expect(svc?.package_code).toBe("SMART");

    const row = await col("email_messages").findOne({ to: client.email, subject });
    expect(row?.status).toBe("QUEUED");
    expect(row?.attempts).toBeGreaterThanOrEqual(1);
    expect(String(row?.last_error ?? "")).toMatch(/provider unavailable/);

    // Retry via flush — provider recovers
    rec.failNext = 0;
    await col("email_messages").updateOne(
      { id: row!.id },
      { $set: { next_attempt_at: new Date(0) } },
    );
    const { flushEmailQueue } = await import("../../src/services/email");
    const result = await flushEmailQueue(20);
    expect(result.sent).toBeGreaterThanOrEqual(1);
    const after = await col("email_messages").findOne({ id: row!.id });
    expect(after?.status).toBe("SENT");

    // Still exactly one message row / one entitlement
    expect(await col("email_messages").countDocuments({ to: client.email, subject })).toBe(1);
    expect(
      await col("client_services").countDocuments({
        client_id: client.clientId,
        service_type: "SELF_ASSESSMENT",
        status: "ACTIVE",
      }),
    ).toBe(1);
  });

  it("dual-service: MTD purchase confirms MTD only without mislabelling existing SA", async () => {
    const rec = await useMail();
    const client = await namedClient("Dual", "Client");
    await buy(client, "SELF_ASSESSMENT", "SIMPLE");
    await waitForMailTo(client.email, "Your Self Assessment package is confirmed | TaxSimba");
    await buy(client, "MTD_INCOME_TAX", "MTD_COMPLY");
    const mtdMsgs = await waitForMailTo(
      client.email,
      "Your Making Tax Digital for Income Tax package is confirmed | TaxSimba",
    );

    expect(mtdMsgs).toHaveLength(1);
    expect(mtdMsgs[0].text).toContain("Simbian Comply");
    expect(mtdMsgs[0].text).toContain("/mtd-dashboard");
    expect(mtdMsgs[0].text).not.toMatch(/Tax Simba Simple|Service purchased: Self Assessment/);

    const { col } = await import("../../src/db/mongo");
    const services = await col("client_services")
      .find({ client_id: client.clientId, status: "ACTIVE" })
      .toArray();
    expect(services.map((s) => s.service_type).sort()).toEqual([
      "MTD_INCOME_TAX",
      "SELF_ASSESSMENT",
    ]);
  });
});

describe("purchase confirmation content (pure)", () => {
  it("builds SA and MTD bodies with required fields and no secrets", async () => {
    process.env.APP_BASE_URL = "https://app.test.taxsimba.local";
    const { buildPurchaseConfirmationContent } = await import(
      "../../src/services/purchaseConfirmationEmail"
    );
    const sa = buildPurchaseConfirmationContent({
      firstName: "Sara",
      serviceType: "SELF_ASSESSMENT",
      packageName: "Tax Simba Simple",
      amount: 119,
      billingType: "ONE_OFF",
      billingFrequency: "Per tax year",
      sessionId: "cs_test_sa",
      activationAt: "2026-09-24T12:00:00.000Z",
    });
    expect(sa.subject).toContain("Self Assessment");
    expect(sa.body).toContain("One-off payment");
    expect(sa.dashboardPath).toBe("/dashboard");
    expect(sa.body).not.toMatch(/cs_test|webhook|card/i);

    const mtd = buildPurchaseConfirmationContent({
      firstName: "Amara",
      serviceType: "MTD_INCOME_TAX",
      packageName: "Simbian Growth",
      amount: 59.99,
      billingType: "RECURRING",
      billingFrequency: "Monthly",
      sessionId: "cs_test_mtd",
    });
    expect(mtd.serviceName).toBe("Making Tax Digital for Income Tax");
    expect(mtd.billingTypeLabel).toBe("Recurring subscription");
    expect(mtd.dashboardPath).toBe("/mtd-dashboard");
  });
});
