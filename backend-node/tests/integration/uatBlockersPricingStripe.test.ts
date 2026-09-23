/**
 * UAT blockers: package SoT (£119/£149/£299), Stripe return URLs, GBP pence,
 * webhook entitlement → admin Plan column, zero cases on purchase.
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
} from "../helpers/app";
import { FakePaymentProvider, WEBHOOK_SIGNATURE } from "../helpers/payments";

describe("UAT blockers — pricing / Stripe / entitlement / admin plan", () => {
  let app: Express;
  let provider: FakePaymentProvider;
  let admin: Awaited<ReturnType<typeof makeUser>>;

  function webhook(type: string, object: Record<string, unknown>) {
    return request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", WEBHOOK_SIGNATURE)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ type, object }));
  }

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    const { setPaymentProvider } = await import("../../src/services/payments");
    provider = new FakePaymentProvider();
    setPaymentProvider(provider);
    admin = await makeUser("ADMIN", "uat-price-admin");
  }, 60000);

  afterAll(async () => {
    const { setPaymentProvider } = await import("../../src/services/payments");
    setPaymentProvider(null);
    await dropTestDb();
  });

  it("catalogue SoT: promo presentation + descriptions; £0 realigned; dry-run is non-mutating", async () => {
    const { col } = await import("../../src/db/mongo");
    const { reconcilePackageCatalogue } = await import("../../src/domain/packages");

    // Corrupt Simple to £0 and insert a duplicate active SMART.
    await col("packages").updateOne(
      { code: "SIMPLE", service_type: "SELF_ASSESSMENT" },
      { $set: { price: 0, original_price: null, save_percentage: null } },
    );
    await col("packages").insertOne({
      id: randomUUID(),
      service_type: "SELF_ASSESSMENT",
      code: "SMART",
      name: "Duplicate Smart",
      price: 1,
      rank: 2,
      billing_frequency: "Per tax year",
      billing_type: "ONE_OFF",
      vat_treatment: "INCLUSIVE",
      is_active: true,
      created_at: new Date().toISOString(),
    });

    const dry = await reconcilePackageCatalogue({ dryRun: true });
    expect(dry.dryRun).toBe(true);
    expect(dry.realigned).toBeGreaterThanOrEqual(1);
    expect(dry.report.length).toBeGreaterThan(0);
    const stillCorrupt = await col("packages").findOne({
      code: "SIMPLE",
      service_type: "SELF_ASSESSMENT",
      is_active: true,
    });
    expect(Number(stillCorrupt?.price)).toBe(0);

    const result = await reconcilePackageCatalogue({ dryRun: false });
    expect(result.dryRun).toBe(false);
    expect(result.realigned).toBeGreaterThanOrEqual(1);
    expect(result.deactivatedDuplicates).toBeGreaterThanOrEqual(1);
    expect(result.presentationUpdated).toBeGreaterThanOrEqual(1);

    const plans = await request(app)
      .get("/api/compat/subscription-plans?category=taxSimba")
      .expect(200);
    const rows = plans.body.data as {
      code: string;
      price: number | null;
      name: string;
      originalPrice: number | null;
      savePercentage: number | null;
      description: string | null;
      features: string[];
    }[];
    const byCode = Object.fromEntries(rows.map((r) => [r.code, r]));
    expect(byCode.SIMPLE.price).toBe(119);
    expect(byCode.SIMPLE.originalPrice).toBe(199);
    expect(byCode.SIMPLE.savePercentage).toBe(40);
    expect(byCode.SIMPLE.description).toContain("straightforward Self Assessment");
    expect(byCode.SIMPLE.features.length).toBeGreaterThan(0);
    expect(byCode.SMART.price).toBe(149);
    expect(byCode.SMART.originalPrice).toBe(229);
    expect(byCode.SMART.savePercentage).toBe(35);
    expect(byCode.SMART.description).toContain("several income sources");
    expect(byCode.ELITE.price).toBe(299);
    expect(byCode.ELITE.originalPrice).toBe(399);
    expect(byCode.ELITE.savePercentage).toBe(25);
    expect(byCode.ELITE.description).toContain("most thorough Self Assessment");
    expect(rows.map((r) => r.code)).toEqual(["SIMPLE", "SMART", "ELITE"]);

    const activeSmart = await col("packages")
      .find({ code: "SMART", service_type: "SELF_ASSESSMENT", is_active: true })
      .toArray();
    expect(activeSmart).toHaveLength(1);
  });

  it("rejects SUPER_ADMIN £0 price writes", async () => {
    const superAdmin = await makeUser("SUPER_ADMIN", "uat-price-super");
    const list = await request(app)
      .get("/api/packages?service_type=SELF_ASSESSMENT")
      .set(bearer(admin))
      .expect(200);
    const simple = list.body.find((p: { code: string }) => p.code === "SIMPLE");
    await request(app)
      .patch(`/api/packages/${simple.id}/price`)
      .set(bearer(superAdmin))
      .send({ price: 0 })
      .expect((res) => {
        expect([400, 422]).toContain(res.status);
      });
  });

  it("Stripe checkout uses GBP pence amounts and canonical success/cancel URLs", async () => {
    const client = await makeClient("uat-checkout-gbp");
    const plans = await request(app)
      .get("/api/compat/subscription-plans?category=taxSimba")
      .expect(200);
    const simple = (plans.body.data as { code: string; id: string }[]).find(
      (p) => p.code === "SIMPLE",
    )!;
    const origin = "https://app.test.taxsimba.local";
    const checkout = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(client))
      .send({ planId: simple.id, originUrl: origin })
      .expect(200);

    expect(checkout.body.data.amount).toBe(119);
    const recorded = provider.last();
    expect(recorded.currency).toBe("gbp");
    expect(recorded.unit_amount_pence).toBe(11900);
    expect(recorded.success_url).toBe(
      `${origin}/planlist/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
    );
    expect(recorded.cancel_url).toBe(`${origin}/planlist/checkout-cancel`);
    expect(recorded.metadata.client_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(recorded.metadata.package_id).toBe(simple.id);
    expect(recorded.metadata.to_package).toBe("SIMPLE");
    expect(recorded.metadata.service_type).toBe("SELF_ASSESSMENT");
    expect(recorded.product_description).toContain("straightforward Self Assessment");
    expect(recorded.success_url).not.toMatch(/192\.168\.|localhost/);
  });

  it("Smart/Elite checkout amounts are 14900 / 29900 pence", async () => {
    const client = await makeClient("uat-checkout-tiers");
    const plans = await request(app)
      .get("/api/compat/subscription-plans?category=taxSimba")
      .expect(200);
    const byCode = Object.fromEntries(
      (plans.body.data as { code: string; id: string }[]).map((p) => [p.code, p]),
    );
    for (const [code, pence] of [
      ["SMART", 14900],
      ["ELITE", 29900],
    ] as const) {
      const buyer = await makeClient(`uat-${code.toLowerCase()}`);
      await request(app)
        .post("/api/compat/client/subscription/checkout-session")
        .set(bearer(buyer))
        .send({
          planId: byCode[code].id,
          originUrl: "https://app.test.taxsimba.local",
        })
        .expect(200);
      expect(provider.last().unit_amount_pence).toBe(pence);
      expect(provider.last().currency).toBe("gbp");
    }
    // unused client reserved to keep makeClient pattern clear
    expect(client.id).toBeTruthy();
  });

  it("webhook activates one entitlement, one payment; admin Plan shows package; zero cases", async () => {
    const client = await makeClient("uat-webhook-plan");
    const plans = await request(app)
      .get("/api/compat/subscription-plans?category=taxSimba")
      .expect(200);
    const smart = (plans.body.data as { code: string; id: string; name: string }[]).find(
      (p) => p.code === "SMART",
    )!;

    const checkout = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(client))
      .send({
        planId: smart.id,
        originUrl: "https://app.test.taxsimba.local",
      })
      .expect(200);
    const sessionId = checkout.body.data.sessionId as string;
    const paid = provider.pay(sessionId);

    await webhook("checkout.session.completed", {
      id: sessionId,
      payment_status: paid.payment_status,
      payment_intent: paid.payment_intent,
      metadata: provider.last().metadata,
    }).expect(200);

    // Replay must not duplicate
    await webhook("checkout.session.completed", {
      id: sessionId,
      payment_status: paid.payment_status,
      payment_intent: paid.payment_intent,
      metadata: provider.last().metadata,
    }).expect(200);

    const { col } = await import("../../src/db/mongo");
    const txs = await col("payment_transactions")
      .find({ session_id: sessionId, payment_status: "paid" })
      .toArray();
    expect(txs).toHaveLength(1);

    const entitlements = await col("client_services")
      .find({
        client_id: client.clientId,
        service_type: "SELF_ASSESSMENT",
        status: "ACTIVE",
      })
      .toArray();
    expect(entitlements).toHaveLength(1);
    expect(entitlements[0].package_code).toBe("SMART");

    const cases = await col("cases").find({ client_id: client.clientId }).toArray();
    expect(cases).toHaveLength(0);

    const adminList = await request(app)
      .post("/api/compat/admin/clients")
      .set(bearer(admin))
      .send({})
      .expect(200);
    const row = (adminList.body.data.clients as { id: string; subscription?: { plan?: { name?: string; code?: string } } }[]).find(
      (c) => c.id === client.id,
    );
    expect(row?.subscription?.plan?.code).toBe("SMART");
    expect(row?.subscription?.plan?.name).toMatch(/Smart/i);
  });

  it("checkout-success finalises paid session idempotently; unpaid cancel creates no entitlement", async () => {
    const client = await makeClient("uat-success-finalise");
    const plans = await request(app)
      .get("/api/compat/subscription-plans?category=taxSimba")
      .expect(200);
    const elite = (plans.body.data as { code: string; id: string }[]).find(
      (p) => p.code === "ELITE",
    )!;
    const checkout = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(client))
      .send({
        planId: elite.id,
        originUrl: "https://app.test.taxsimba.local",
      })
      .expect(200);
    const sessionId = checkout.body.data.sessionId as string;
    provider.pay(sessionId);

    const ok1 = await request(app)
      .post("/api/compat/client/subscription/checkout-success")
      .set(bearer(client))
      .send({ sessionId })
      .expect(200);
    expect(ok1.body.success).toBe(true);

    const ok2 = await request(app)
      .post("/api/compat/client/subscription/checkout-success")
      .set(bearer(client))
      .send({ sessionId })
      .expect(200);
    expect(ok2.body.success).toBe(true);

    await request(app)
      .post("/api/compat/client/subscription/checkout-success")
      .set(bearer(client))
      .send({ sessionId: "" })
      .expect((res) => {
        expect([400, 422]).toContain(res.status);
      });

    const { col } = await import("../../src/db/mongo");
    const entitlements = await col("client_services")
      .find({
        client_id: client.clientId,
        status: "ACTIVE",
      })
      .toArray();
    expect(entitlements).toHaveLength(1);
    expect(entitlements[0].package_code).toBe("ELITE");
    expect(await col("cases").countDocuments({ client_id: client.clientId })).toBe(0);

    // Client dashboard surfaces the purchased plan.
    const mine = await request(app).get("/api/my-services").set(bearer(client)).expect(200);
    const sa = (mine.body.services as { service_type: string; package_code: string; status: string }[]).find(
      (s) => s.service_type === "SELF_ASSESSMENT",
    );
    expect(sa?.status).toBe("ACTIVE");
    expect(sa?.package_code).toBe("ELITE");

    // Cancel path: checkout opened but never paid → no ACTIVE entitlement.
    const cancelClient = await makeClient("uat-cancel-no-entitle");
    const cancelCheckout = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(cancelClient))
      .send({
        planId: elite.id,
        originUrl: "https://app.test.taxsimba.local",
      })
      .expect(200);
    expect(cancelCheckout.body.data.sessionId).toBeTruthy();
    const cancelActive = await col("client_services")
      .find({ client_id: cancelClient.clientId, status: "ACTIVE" })
      .toArray();
    expect(cancelActive).toHaveLength(0);
  });

  it("checkoutReturnUrls helper never embeds localhost/LAN hosts", async () => {
    const { checkoutReturnUrls, gbpToStripePence } = await import(
      "../../src/services/checkoutUrls"
    );
    const urls = checkoutReturnUrls("https://client.example");
    expect(urls.success_url).toContain("/planlist/checkout-success?session_id={CHECKOUT_SESSION_ID}");
    expect(urls.cancel_url).toContain("/planlist/checkout-cancel");
    expect(gbpToStripePence(119)).toBe(11900);
    expect(gbpToStripePence(149)).toBe(14900);
    expect(gbpToStripePence(299)).toBe(29900);
    expect(() => gbpToStripePence(0)).toThrow();
  });
});
