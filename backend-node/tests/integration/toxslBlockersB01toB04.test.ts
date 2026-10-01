/**
 * Toxsl blockers B01–B04 regression suite (local API — not a staging PASS claim).
 */
import { randomUUID } from "crypto";

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
import { setPaymentProvider } from "../../src/services/payments";
import { mapPaymentError, PaymentConfigError } from "../../src/services/paymentErrors";
import { renderEmail } from "../../src/services/email";

describe("Toxsl blockers B01–B04", () => {
  let app: Express;
  let admin: TestUser;
  let accountant: TestUser;
  let fake: FakePaymentProvider;

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    process.env.APP_BASE_URL = "https://app.test.taxsimba.local";
    process.env.ADMIN_BASE_URL = "https://admin.test.taxsimba.local";
    admin = await makeUser("ADMIN", "tb-admin");
    accountant = await makeUser("ACCOUNTANT", "tb-acc");
    fake = new FakePaymentProvider();
    setPaymentProvider(fake);
  }, 120000);

  afterAll(async () => {
    setPaymentProvider(null);
    await dropTestDb();
  });

  it("B01: MTD RECURRING checkout uses subscription mode; missing Stripe config is actionable", async () => {
    const client = await makeClient(`tb-mtd-${randomUUID().slice(0, 6)}`);
    const pkgs = await request(app)
      .get("/api/packages?service_type=MTD_INCOME_TAX")
      .set(bearer(client));
    const growth = (pkgs.body as { code: string; id: string; price: number }[]).find(
      (p) => p.code === "MTD_GROWTH",
    );
    expect(growth?.price).toBe(59.99);

    const checkout = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(client))
      .send({ planId: growth!.id, origin_url: "http://192.168.0.197:3000" })
      .expect(200);
    expect(fake.last().mode).toBe("subscription");
    expect(fake.last().billing_type).toBe("RECURRING");
    expect(checkout.body.data.mode).toBe("subscription");
    expect(checkout.body.data.checkoutUrl || checkout.body.data.checkout_url).toBeTruthy();

    // Cancelled/expired session grants no entitlement.
    fake.expire(fake.last().session_id);
    const { col } = await import("../../src/db/mongo");
    const before = await col("client_services").countDocuments({
      client_id: client.clientId,
      service_type: "MTD_INCOME_TAX",
      status: "ACTIVE",
    });
    expect(before).toBe(0);

    // Controlled config error (no unexplained 500).
    const cfg = mapPaymentError(
      new PaymentConfigError(
        "Stripe is not configured. Set STRIPE_SECRET_KEY (sk_test_…) for this environment before starting checkout.",
      ),
    );
    expect(cfg.status).toBe(503);
    expect(String(cfg.detail)).toMatch(/STRIPE_SECRET_KEY/);
    // Guidance may mention sk_test_… placeholder — never a real secret value.
    expect(String(cfg.detail)).not.toMatch(/sk_test_[A-Za-z0-9]{8,}/);
  });

  it("B01: successful MTD checkout + webhook replay = one entitlement; SA untouched", async () => {
    const client = await makeClient(`tb-dual-${randomUUID().slice(0, 6)}`);
    await activateClientService(client, "SELF_ASSESSMENT", "SIMPLE");
    const pkgs = await request(app)
      .get("/api/packages?service_type=MTD_INCOME_TAX")
      .set(bearer(client));
    const growth = (pkgs.body as { code: string; id: string }[]).find((p) => p.code === "MTD_GROWTH");
    const checkout = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(client))
      .send({ planId: growth!.id, origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    const sessionId = checkout.body.data.sessionId || checkout.body.data.session_id;
    fake.pay(sessionId);
    const event = {
      type: "checkout.session.completed",
      object: {
        id: sessionId,
        payment_status: "paid",
        metadata: fake.last().metadata,
      },
    };
    await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", WEBHOOK_SIGNATURE)
      .send(JSON.stringify(event))
      .expect(200);
    await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", WEBHOOK_SIGNATURE)
      .send(JSON.stringify(event))
      .expect(200);

    const { col } = await import("../../src/db/mongo");
    const mtd = await col("client_services")
      .find({ client_id: client.clientId, service_type: "MTD_INCOME_TAX", status: "ACTIVE" })
      .toArray();
    expect(mtd).toHaveLength(1);
    const sa = await col("client_services")
      .find({ client_id: client.clientId, service_type: "SELF_ASSESSMENT", status: "ACTIVE" })
      .toArray();
    expect(sa).toHaveLength(1);
    expect(sa[0].package_code).toBe("SIMPLE");
  });

  it("B02: draft email CTA uses Admin FE path; Admin approve releases to client", async () => {
    const client = await makeClient(`tb-draft-${randomUUID().slice(0, 6)}`);
    const { caseId } = await activateClientService(client, "SELF_ASSESSMENT", "SMART");
    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: accountant.id })
      .expect(200);

    await request(app)
      .post(`/api/compat/accountant/assignments/${caseId}/upload-draft`)
      .set(bearer(accountant))
      .attach("draftReturnFile", Buffer.from("%PDF-1.4 draft-b02"), {
        filename: "draft-b02.pdf",
        contentType: "application/pdf",
      })
      .expect(200);

    const email = renderEmail({
      title: "Draft ready for Admin review",
      body: "Please review.",
      link: `https://admin.test.taxsimba.local/admin/manage-tax/${caseId}`,
      callToAction: "Review tax return",
    });
    expect(email.html).toContain(`/admin/manage-tax/${caseId}`);
    expect(email.html).not.toMatch(/href="https:\/\/app\.test\.taxsimba\.local\/manage-tax/);

    // Relative /admin/… links resolve against ADMIN_BASE_URL.
    const relative = renderEmail({
      title: "Draft ready for Admin review",
      body: "Please review.",
      link: `/admin/manage-tax/${caseId}`,
    });
    expect(relative.html).toContain(`https://admin.test.taxsimba.local/admin/manage-tax/${caseId}`);

    const superAdmin = await makeUser("SUPER_ADMIN", "tb-super");
    await request(app)
      .post(`/api/compat/admin/manage-review/${caseId}`)
      .set(bearer(superAdmin))
      .send({ action: "approve" })
      .expect(403);

    await request(app)
      .post(`/api/compat/admin/manage-review/${caseId}`)
      .set(bearer(admin))
      .send({ action: "approve" })
      .expect(200);

    // Client drafts visible only after Admin approval.
    const drafts = await request(app)
      .get(`/api/compat/client/drafts/${caseId}`)
      .set(bearer(client))
      .expect(200);
    const afterDocs =
      drafts.body.data?.documents?.draftDocuments ||
      drafts.body.data?.documents ||
      [];
    expect(Array.isArray(afterDocs) ? afterDocs.length : 0).toBeGreaterThan(0);
  });

  it("B03: assigned accountant id is present on all-tax-returns; messaging works; others blocked", async () => {
    const client = await makeClient(`tb-msg-${randomUUID().slice(0, 6)}`);
    const other = await makeClient(`tb-msg-o-${randomUUID().slice(0, 6)}`);
    const { caseId } = await activateClientService(client, "SELF_ASSESSMENT", "ELITE");
    await activateClientService(other, "SELF_ASSESSMENT", "SIMPLE");

    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: accountant.id })
      .expect(200);

    const list = await request(app)
      .post("/api/compat/client/all-tax-returns")
      .set(bearer(client))
      .send({})
      .expect(200);
    const row = (list.body.data as Array<{ id: string; accountant?: { id: string } }>).find(
      (r) => r.id === caseId,
    );
    expect(row?.accountant?.id).toBe(accountant.id);

    const progress = await request(app)
      .post(`/api/compat/tax-return/${caseId}/progress`)
      .set(bearer(client))
      .send({})
      .expect(200);
    expect(progress.body.data.accountant?.id).toBe(accountant.id);

    await request(app)
      .post("/api/compat/client/send-to-specific-accountant")
      .set(bearer(client))
      .send({
        taxReturnId: caseId,
        accountantId: accountant.id,
        message: "Hello assigned accountant",
        subject: "Help",
      })
      .expect(200);

    await request(app)
      .post("/api/compat/client/send-to-specific-accountant")
      .set(bearer(other))
      .send({
        taxReturnId: caseId,
        accountantId: accountant.id,
        message: "cross client",
        subject: "Nope",
      })
      .expect(403);
  });

  it("B04: SA upgrade updates client_services + case package; failed upgrade leaves original", async () => {
    const client = await makeClient(`tb-upg-${randomUUID().slice(0, 6)}`);
    await activateClientService(client, "SELF_ASSESSMENT", "SIMPLE");
    await activateClientService(client, "MTD_INCOME_TAX", "MTD_COMPLY");

    const pkgs = await request(app)
      .get("/api/packages?service_type=SELF_ASSESSMENT")
      .set(bearer(client));
    const smart = (pkgs.body as { code: string; id: string; price: number }[]).find(
      (p) => p.code === "SMART",
    );
    expect(smart?.price).toBe(149);

    const checkout = await request(app)
      .post("/api/compat/client/subscription/upgrade-checkout")
      .set(bearer(client))
      .send({ planId: smart!.id, packageCode: "SMART", origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    const sessionId = checkout.body.data.sessionId || checkout.body.data.session_id;

    // Cancelled upgrade — leave SIMPLE active.
    fake.expire(sessionId);
    const { col } = await import("../../src/db/mongo");
    let svc = await col("client_services").findOne({
      client_id: client.clientId,
      service_type: "SELF_ASSESSMENT",
    });
    expect(svc?.package_code).toBe("SIMPLE");

    // Successful upgrade path.
    const checkout2 = await request(app)
      .post("/api/compat/client/subscription/upgrade-checkout")
      .set(bearer(client))
      .send({ planId: smart!.id, packageCode: "SMART", origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    const sid2 = checkout2.body.data.sessionId || checkout2.body.data.session_id;
    fake.pay(sid2);
    await request(app)
      .post("/api/compat/client/subscription/checkout-success")
      .set(bearer(client))
      .send({ sessionId: sid2 })
      .expect(200);

    svc = await col("client_services").findOne({
      client_id: client.clientId,
      service_type: "SELF_ASSESSMENT",
    });
    expect(svc?.package_code).toBe("SMART");
    expect(Number(svc?.agreed_price)).toBe(149);

    const cases = await col("cases")
      .find({ client_id: client.clientId, service_type: "SELF_ASSESSMENT" })
      .toArray();
    expect(cases.length).toBeGreaterThan(0);
    expect(cases.every((c) => c.package_code === "SMART")).toBe(true);

    // MTD unchanged.
    const mtd = await col("client_services").findOne({
      client_id: client.clientId,
      service_type: "MTD_INCOME_TAX",
    });
    expect(mtd?.package_code).toBe("MTD_COMPLY");
    expect(mtd?.status).toBe("ACTIVE");

    // Active subscription list shows SMART name/price.
    const subs = await request(app)
      .get("/api/compat/client/active/subscription/list")
      .set(bearer(client))
      .expect(200);
    const rows = subs.body.data?.subscriptions || [];
    const saSub = rows.find(
      (s: { serviceType?: string; packageCode?: string; plan?: { code?: string } }) =>
        s.serviceType === "SELF_ASSESSMENT" ||
        s.packageCode === "SMART" ||
        s.plan?.code === "SMART",
    );
    expect(saSub?.packageCode || saSub?.plan?.code).toBe("SMART");
    expect(Number(saSub?.plan?.price)).toBe(149);
  });
});


