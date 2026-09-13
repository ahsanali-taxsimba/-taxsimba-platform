/**
 * P0 package pricing: SUPER_ADMIN catalogue change → subscription-plans + Checkout amount,
 * while existing customers keep frozen agreed_price. ADMIN remains write-blocked.
 */
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bearer, bootTestApp, dropTestDb, makeClient, makeUser, TestUser } from "../helpers/app";
import { FakePaymentProvider, WEBHOOK_SIGNATURE } from "../helpers/payments";

type Client = TestUser & { clientId: string };

describe("P0 SUPER_ADMIN pricing → plans → checkout → agreed_price freeze", () => {
  let app: Express;
  let provider: FakePaymentProvider;
  let superAdmin: TestUser;
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
    await payAndConfirm(res.body.session_id).expect(200);
    return res.body.session_id as string;
  }

  async function services(client: Client) {
    const res = await request(app).get("/api/my-services").set(bearer(client)).expect(200);
    return res.body.services as Record<string, unknown>[];
  }

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    const { setPaymentProvider } = await import("../../src/services/payments");
    provider = new FakePaymentProvider();
    setPaymentProvider(provider);
    superAdmin = await makeUser("SUPER_ADMIN", "pricing-ui-super");
    admin = await makeUser("ADMIN", "pricing-ui-admin");
  });

  afterAll(async () => {
    const { setPaymentProvider } = await import("../../src/services/payments");
    setPaymentProvider(null);
    await dropTestDb();
  });

  it("SUPER_ADMIN price change updates plans + checkout; ADMIN cannot write; agreed_price frozen", async () => {
    const existing = await makeClient("pricing-existing");
    await buy(existing, "SELF_ASSESSMENT", "SIMPLE");

    const beforeSa = (await services(existing)).find((s) => s.service_type === "SELF_ASSESSMENT");
    expect(beforeSa?.agreed_price).toBe(119);

    const list = await request(app)
      .get("/api/packages?service_type=SELF_ASSESSMENT")
      .set(bearer(admin))
      .expect(200);
    const simple = list.body.find((p: { code: string }) => p.code === "SIMPLE") as {
      id: string;
      price: number;
    };
    expect(simple.price).toBe(119);

    await request(app)
      .patch(`/api/packages/${simple.id}/price`)
      .set(bearer(admin))
      .send({ price: 129 })
      .expect(403);

    await request(app)
      .patch(`/api/packages/${simple.id}/price`)
      .set(bearer(superAdmin))
      .send({ price: 129 })
      .expect(200);

    const history = await request(app)
      .get(`/api/packages/${simple.id}/price-history`)
      .set(bearer(admin))
      .expect(200);
    expect(history.body[0]).toMatchObject({
      previous_price: 119,
      new_price: 129,
      changed_by: superAdmin.name,
    });

    const plans = await request(app)
      .get("/api/compat/subscription-plans?category=taxSimba")
      .set(bearer(existing))
      .expect(200);
    const plan = (plans.body.data as { code: string; price: number; id: string }[]).find(
      (p) => p.code === "SIMPLE",
    );
    expect(plan?.price).toBe(129);

    const newBuyer = await makeClient("pricing-newbuyer");
    const beforeCheckoutCount = provider.checkouts.length;
    const checkout = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(newBuyer))
      .send({ planId: plan!.id, originUrl: "https://app.test.taxsimba.local" })
      .expect(200);
    expect(checkout.body.data.amount).toBe(129);
    expect(provider.checkouts.length).toBe(beforeCheckoutCount + 1);
    expect(provider.last().amount).toBe(129);

    const afterSa = (await services(existing)).find((s) => s.service_type === "SELF_ASSESSMENT");
    expect(afterSa?.agreed_price).toBe(119);
    expect(afterSa?.current_master_price).toBe(129);

    await request(app)
      .patch(`/api/packages/${simple.id}/price`)
      .set(bearer(superAdmin))
      .send({ price: 119 })
      .expect(200);
  });

  it("SUPER_ADMIN can schedule a future MTD price; ADMIN cannot; live price unchanged until due", async () => {
    const list = await request(app)
      .get("/api/packages?service_type=MTD_INCOME_TAX")
      .set(bearer(admin))
      .expect(200);
    const mtd = list.body.find((p: { code: string }) => p.code === "MTD_ESSENTIAL") as {
      id: string;
      price: number;
    };
    const original = mtd.price;
    const effectiveFrom = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    await request(app)
      .post(`/api/packages/${mtd.id}/price-schedule`)
      .set(bearer(admin))
      .send({ price: original + 10, effective_from: effectiveFrom })
      .expect(403);

    const created = await request(app)
      .post(`/api/packages/${mtd.id}/price-schedule`)
      .set(bearer(superAdmin))
      .send({ price: original + 10, effective_from: effectiveFrom })
      .expect(200);
    expect(created.body).toMatchObject({
      price: original + 10,
      status: "PENDING",
    });

    const still = await request(app)
      .get("/api/packages?service_type=MTD_INCOME_TAX")
      .set(bearer(admin))
      .expect(200);
    expect(still.body.find((p: { code: string }) => p.code === "MTD_ESSENTIAL").price).toBe(
      original,
    );

    await request(app)
      .delete(`/api/packages/${mtd.id}/price-schedule/${created.body.id}`)
      .set(bearer(superAdmin))
      .expect(200);
  });
});
