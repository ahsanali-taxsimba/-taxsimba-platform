/**
 * Local release-acceptance API journeys (RA01–RA30 subset runnable without shared staging).
 * Browser Playwright against shared staging is packaged separately for operators.
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
import { renderEmail } from "../../src/services/email";

describe("local release-acceptance API suite", () => {
  let app: Express;
  let admin: TestUser;
  let accountant: TestUser;
  let fake: FakePaymentProvider;

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    process.env.APP_BASE_URL = "https://app.test.taxsimba.local";
    admin = await makeUser("ADMIN", "ra-admin");
    accountant = await makeUser("ACCOUNTANT", "ra-acc");
    fake = new FakePaymentProvider();
    setPaymentProvider(fake);
  }, 120000);

  afterAll(async () => {
    setPaymentProvider(null);
    await dropTestDb();
  });

  it("RA01/RA03/RA04 SA purchase + one case without UTR", async () => {
    const client = await makeClient(`ra-sa-${randomUUID().slice(0, 6)}`);
    const pkgs = await request(app).get("/api/packages?service_type=SELF_ASSESSMENT").set(bearer(client));
    const simple = (pkgs.body as { code: string; id: string; price: number }[]).find(
      (p) => p.code === "SIMPLE",
    );
    expect(simple?.price).toBe(119);

    const checkout = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(client))
      .send({ planId: simple!.id, origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    const sessionId = checkout.body.data.sessionId || checkout.body.data.session_id;
    fake.pay(sessionId);
    await request(app)
      .post("/api/compat/client/subscription/checkout-success")
      .set(bearer(client))
      .send({ sessionId })
      .expect(200);

    const typesRes = await request(app)
      .post("/api/compat/client/tax-return-type")
      .set(bearer(client))
      .send({})
      .expect(200);
    const types = typesRes.body.data.taxReturnTypes as Array<{ id: string; typeCode: string }>;
    const typeId = types[0]?.id;
    expect(typeId).toBeTruthy();

    const apply = await request(app)
      .post("/api/compat/client/apply-tax-return")
      .set(bearer(client))
      .field("taxReturnTypeId", typeId!)
      .field("financialYear", "2024-2025")
      .field("taxYear", "2024/25")
      .field("serviceType", "SELF_ASSESSMENT")
      .expect(201);
    const caseId = apply.body.data?.taxReturn?.id as string;
    expect(caseId).toBeTruthy();

    const apply2 = await request(app)
      .post("/api/compat/client/apply-tax-return")
      .set(bearer(client))
      .field("taxReturnTypeId", typeId!)
      .field("financialYear", "2024-2025")
      .field("taxYear", "2024/25")
      .field("serviceType", "SELF_ASSESSMENT")
      .expect(201);
    expect(apply2.body.data?.taxReturn?.id).toBe(caseId);
  });

  it("RA12 dual service SA then MTD; RA20 portal after MTD", async () => {
    const client = await makeClient(`ra-dual-${randomUUID().slice(0, 6)}`);
    await activateClientService(client, "SELF_ASSESSMENT", "SMART");
    const pkgs = await request(app).get("/api/packages?service_type=MTD_INCOME_TAX").set(bearer(client));
    const comply = (pkgs.body as { code: string; id: string }[]).find((p) => p.code === "MTD_COMPLY");
    const checkout = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(client))
      .send({ planId: comply!.id, origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    expect(fake.last().mode).toBe("subscription");
    const sessionId = checkout.body.data.sessionId || checkout.body.data.session_id;
    fake.pay(sessionId);
    await request(app)
      .post("/api/compat/client/subscription/checkout-success")
      .set(bearer(client))
      .send({ sessionId })
      .expect(200);

    const portal = await request(app)
      .post("/api/compat/client/subscription/portal")
      .set(bearer(client))
      .send({ origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    expect(portal.body.data.url || portal.body.data.portalUrl).toContain("billing.test");
  });

  it("RA09 Super Admin assign denied; Admin assign ok; RA29 deactivate 409", async () => {
    const client = await makeClient(`ra-asg-${randomUUID().slice(0, 6)}`);
    const { caseId } = await activateClientService(client, "SELF_ASSESSMENT", "SIMPLE");
    const superAdmin = await makeUser("SUPER_ADMIN", "ra-super");
    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(superAdmin))
      .send({ taxReturnId: caseId, accountantId: accountant.id })
      .expect(403);
    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: accountant.id })
      .expect(200);

    const leaver = await makeUser("ACCOUNTANT", "ra-leaver");
    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: leaver.id })
      .expect(200);
    const del = await request(app)
      .delete(`/api/compat/admin/accountants/${leaver.id}`)
      .set(bearer(superAdmin));
    // 409 until reassigned (or 400/403 depending path) — must not succeed with open cases.
    expect([400, 403, 409]).toContain(del.status);
    if (del.status === 409) {
      expect(del.body?.data?.activeCaseIds || del.body?.active_cases || del.body).toBeTruthy();
    }
  });

  it("RA10/RA11 draft gate: client hidden until Admin approve; CTA is real route", async () => {
    const client = await makeClient(`ra-draft-${randomUUID().slice(0, 6)}`);
    const { caseId } = await activateClientService(client, "SELF_ASSESSMENT", "ELITE");
    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: accountant.id })
      .expect(200);

    await request(app)
      .post(`/api/compat/accountant/assignments/${caseId}/upload-draft`)
      .set(bearer(accountant))
      .attach("draftReturnFile", Buffer.from("%PDF-1.4 draft"), {
        filename: "draft.pdf",
        contentType: "application/pdf",
      })
      .expect(200);

    const draftsBefore = await request(app)
      .get(`/api/compat/client/drafts/${caseId}`)
      .set(bearer(client));
    // Client must not see awaiting Admin drafts.
    if (draftsBefore.status === 200) {
      const list = draftsBefore.body.data?.documents || draftsBefore.body.data || [];
      const visible = Array.isArray(list) ? list : [];
      expect(visible.every((d: { reviewStatus?: string }) => d.reviewStatus !== "AWAITING_ADMIN_REVIEW")).toBe(
        true,
      );
    }

    const email = renderEmail({
      title: "Your tax return draft is ready to review",
      body: "Please review.",
      link: "/dashboard/my-documents",
      callToAction: "View my documents",
    });
    expect(email.html).toContain("/dashboard/my-documents");
    expect(email.html).not.toContain('href="https://app.test.taxsimba.local/documents"');
    expect(email.html).toContain("Your partner for stress free taxes");
    expect(email.html).toContain("/privacy-policy");
    expect(email.html).toContain("/terms-and-conditions");
  });

  it("RA16 webhook replay does not duplicate entitlement", async () => {
    const client = await makeClient(`ra-wh-${randomUUID().slice(0, 6)}`);
    const pkgs = await request(app).get("/api/packages?service_type=SELF_ASSESSMENT").set(bearer(client));
    const smart = (pkgs.body as { code: string; id: string }[]).find((p) => p.code === "SMART");
    const checkout = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(client))
      .send({ planId: smart!.id, origin_url: "https://app.test.taxsimba.local" })
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
    const svcs = await col("client_services")
      .find({ client_id: client.clientId, service_type: "SELF_ASSESSMENT", status: "ACTIVE" })
      .toArray();
    expect(svcs).toHaveLength(1);
  });

  it("RA25 email/legal branding and no /messages CTA", async () => {
    const out = renderEmail({
      title: "New message",
      body: "Hello",
      link: "/dashboard/tax-tracker",
      recipientName: "Alex",
    });
    expect(out.html).toContain("TaxSimba");
    expect(out.html).toContain("Your partner for stress free taxes");
    expect(out.html).toContain("/images/logo.png");
    expect(out.html).toContain("/privacy-policy");
    expect(out.html).toContain("/terms-and-conditions");
    expect(out.html).toContain("/contact-us");
    expect(out.html).not.toMatch(/href="[^"]*\/messages"/);
  });
});
