/**
 * Full MTD signup path regression against the correction SHA.
 * Local API only — not a Toxsl/staging PASS claim.
 *
 * Steps: register → verify → login → select MTD Growth → checkout (subscription)
 * → cancel (no entitlement) → pay + webhook → entitlement → dashboard → portal.
 */
import { randomUUID } from "crypto";

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bootTestApp, dropTestDb } from "../helpers/app";
import { FakePaymentProvider, WEBHOOK_SIGNATURE } from "../helpers/payments";
import { setPaymentProvider } from "../../src/services/payments";

describe("MTD full-path regression (correction SHA)", () => {
  let app: Express;
  let fake: FakePaymentProvider;

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    process.env.APP_BASE_URL = "https://app.test.taxsimba.local";
    process.env.ADMIN_BASE_URL = "https://admin.test.taxsimba.local";
    fake = new FakePaymentProvider();
    setPaymentProvider(fake);
  }, 120000);

  afterAll(async () => {
    setPaymentProvider(null);
    await dropTestDb();
  });

  it("register → verify → login → MTD Growth checkout → cancel/pay/webhook → dashboard → portal", async () => {
    const email = `mtd-full.${randomUUID().slice(0, 8)}@example.com`;
    const password = "Tr0ubl3-Kettle-Marsh";

    // 1) Register with MTD intent
    const reg = await request(app)
      .post("/api/compat/auth/register")
      .send({
        email,
        password,
        name: "Mtd",
        surname: "Fullpath",
        mobile: "07700900222",
        userRole: "MTD",
      })
      .expect(200);
    expect(reg.body.data.onboardingIntent).toBe("MTD_INCOME_TAX");
    expect(reg.body.data.continuePath).toBe("/planlist?category=mtd");
    const unverifiedToken = reg.body.data.accessToken || reg.body.data.access_token;

    // Unverified checkout blocked
    await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set({ Authorization: `Bearer ${unverifiedToken}` })
      .send({ planId: "MTD_GROWTH", origin_url: "https://app.test.taxsimba.local" })
      .expect(403);

    // 2) Verification email token path
    const { col } = await import("../../src/db/mongo");
    const { issueEmailVerification } = await import("../../src/services/emailVerification");
    const user = await col("users").findOne({ email });
    expect(user).toBeTruthy();
    const issued = await issueEmailVerification(user!);
    const verify = await request(app)
      .post(`/api/compat/auth/verify-email?token=${encodeURIComponent(issued.token)}`)
      .expect(200);
    expect(verify.body.data.continuePath).toBe("/planlist?category=mtd");

    // 3) Verified login
    const login = await request(app)
      .post("/api/compat/auth/login")
      .send({ email, password })
      .expect(200);
    const token = login.body.data.accessToken || login.body.data.access_token;
    expect(token).toBeTruthy();
    expect(login.body.data.hasActiveService).toBe(false);
    expect(login.body.data.continuePath).toBe("/planlist?category=mtd");

    // 4) MTD package selection (Growth £59.99)
    const plans = await request(app)
      .get("/api/compat/subscription-plans?category=mtd")
      .expect(200);
    const growth = (plans.body.data as { code: string; id?: string; price: number }[]).find(
      (p) => p.code === "MTD_GROWTH",
    );
    expect(growth?.price).toBe(59.99);

    // 5) Checkout session — subscription mode
    const checkout = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set({ Authorization: `Bearer ${token}` })
      .send({
        planId: growth!.id || "MTD_GROWTH",
        packageCode: "MTD_GROWTH",
        origin_url: "http://192.168.0.197:3000",
      })
      .expect(200);
    expect(checkout.body.data.mode).toBe("subscription");
    expect(checkout.body.data.checkoutUrl || checkout.body.data.checkout_url).toMatch(/^https?:\/\//);
    expect(fake.last().mode).toBe("subscription");
    expect(fake.last().success_url).toContain("/planlist/checkout-success");
    expect(fake.last().cancel_url).toContain("/planlist/checkout-cancel");

    // 6) Cancel / expire — no entitlement
    const cancelledSession = fake.last().session_id;
    fake.expire(cancelledSession);
    const clientDoc = await col("clients").findOne({ email });
    expect(
      await col("client_services").countDocuments({
        client_id: clientDoc!.id,
        service_type: "MTD_INCOME_TAX",
        status: "ACTIVE",
      }),
    ).toBe(0);

    // 7) Fresh checkout → pay → webhook (idempotent replay)
    const checkout2 = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set({ Authorization: `Bearer ${token}` })
      .send({
        planId: growth!.id || "MTD_GROWTH",
        origin_url: "https://app.test.taxsimba.local",
      })
      .expect(200);
    const sessionId = checkout2.body.data.sessionId || checkout2.body.data.session_id;
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

    const success = await request(app)
      .post("/api/compat/client/subscription/checkout-success")
      .set({ Authorization: `Bearer ${token}` })
      .send({ sessionId })
      .expect(200);
    expect(success.body.data.fulfilled || success.body.data.paymentStatus === "paid").toBeTruthy();

    const mtdSvcs = await col("client_services")
      .find({ client_id: clientDoc!.id, service_type: "MTD_INCOME_TAX", status: "ACTIVE" })
      .toArray();
    expect(mtdSvcs).toHaveLength(1);
    expect(mtdSvcs[0].package_code).toBe("MTD_GROWTH");

    // 8) MTD dashboard overview works without UTR
    const overview = await request(app)
      .get("/api/compat/mtd/dashboard-overview")
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(overview.body.success).toBe(true);
    const pkgCode =
      overview.body.data.packageCode ||
      overview.body.data.package_code ||
      overview.body.data.packageName;
    expect(String(pkgCode || "")).toMatch(/GROWTH|Growth/i);

    // Active packages list includes MTD Growth
    const subs = await request(app)
      .get("/api/compat/client/active/subscription/list")
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    const rows = subs.body.data?.subscriptions || [];
    expect(
      rows.some(
        (s: { packageCode?: string; plan?: { code?: string } }) =>
          s.packageCode === "MTD_GROWTH" || s.plan?.code === "MTD_GROWTH",
      ),
    ).toBe(true);

    // 9) Billing portal for active MTD
    const portal = await request(app)
      .post("/api/compat/client/subscription/portal")
      .set({ Authorization: `Bearer ${token}` })
      .send({ origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    expect(portal.body.data.url || portal.body.data.portalUrl).toBeTruthy();

    // Login after purchase routes to MTD dashboard ownership
    const login2 = await request(app)
      .post("/api/compat/auth/login")
      .send({ email, password })
      .expect(200);
    expect(login2.body.data.hasActiveService).toBe(true);
    expect(["mtd", "both"]).toContain(login2.body.data.ownership);
  });
});
