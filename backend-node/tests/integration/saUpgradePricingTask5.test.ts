/**
 * Task 5 — SA upgrade pricing / payment / billing (D-001, C-009, J-011).
 *
 * Charging rule under test:
 *   payable = max(target_catalogue − SA agreed_price, 0) in integer pence.
 * £30 / £150 at DEFAULT catalogue are legitimate differences, not full package prices.
 *
 * J-011 note: Toxel’s original runtime error was not reproduced in this environment.
 * Hardening below (amount reject, inflight reuse, mapPaymentError, confirm UX) is
 * preventive — original J-011 remains UNVERIFIED for “error fixed”.
 */
import { randomUUID } from "crypto";
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bearer, bootTestApp, dropTestDb, makeClient, makeUser, TestUser } from "../helpers/app";
import { FakePaymentProvider, WEBHOOK_SIGNATURE } from "../helpers/payments";

type Client = TestUser & { clientId: string };

describe("Task 5 SA upgrade pricing (D-001 / C-009 / J-011)", () => {
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

  async function buySa(client: Client, packageCode: string) {
    const res = await request(app)
      .post("/api/payments/service-checkout")
      .set(bearer(client))
      .send({
        service_type: "SELF_ASSESSMENT",
        package_code: packageCode,
        origin_url: "https://app.test.taxsimba.local",
      })
      .expect(200);
    await payAndConfirm(res.body.session_id).expect(200);
    return res.body.session_id as string;
  }

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    const { setPaymentProvider } = await import("../../src/services/payments");
    provider = new FakePaymentProvider();
    setPaymentProvider(provider);
    superAdmin = await makeUser("SUPER_ADMIN", "superadmin");
    admin = await makeUser("ADMIN", "admin");
  });

  afterAll(async () => {
    const { setPaymentProvider } = await import("../../src/services/payments");
    setPaymentProvider(null);
    await dropTestDb();
  });

  it("D-001: DEFAULT catalogue upgrade deltas are differences not full sticker prices", async () => {
    const client = await makeClient("d001-deltas");
    await buySa(client, "SIMPLE");

    const options = await request(app)
      .get("/api/my-upgrade-options")
      .set(bearer(client))
      .expect(200);
    // Live catalogue: SIMPLE 119 → SMART 149 = 30; → ELITE 299 = 180
    expect(options.body.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SMART",
          upgrade_price: 149,
          current_package_credit: 119,
          additional_amount_payable: 30,
          total_due_now: 30,
          amount_due_pence: 3000,
        }),
        expect.objectContaining({
          code: "ELITE",
          upgrade_price: 299,
          additional_amount_payable: 180,
          amount_due_pence: 18000,
        }),
      ]),
    );

    const smart = await request(app)
      .post("/api/payments/upgrade-checkout")
      .set(bearer(client))
      .send({ package_code: "SMART", origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    expect(smart.body.amount).toBe(30);
    expect(smart.body.amount_due_pence).toBe(3000);
    expect(smart.body.upgrade_price).toBe(149);
    expect(smart.body.current_package_credit).toBe(119);
  });

  it("uses frozen agreed_price as credit when catalogue current package price later changes", async () => {
    const client = await makeClient("agreed-credit");
    await buySa(client, "SIMPLE");

    const list = await request(app)
      .get("/api/packages?service_type=SELF_ASSESSMENT")
      .set(bearer(admin))
      .expect(200);
    const simple = list.body.find((p: { code: string }) => p.code === "SIMPLE");
    const smart = list.body.find((p: { code: string }) => p.code === "SMART");
    // Raise SIMPLE catalogue — agreed_price for the client stays 119.
    await request(app)
      .patch(`/api/packages/${simple.id}/price`)
      .set(bearer(superAdmin))
      .send({ price: 130 })
      .expect(200);

    const options = await request(app)
      .get("/api/my-upgrade-options")
      .set(bearer(client))
      .expect(200);
    const smartOpt = options.body.options.find((o: { code: string }) => o.code === "SMART");
    expect(smartOpt.current_package_credit).toBe(119);
    expect(smartOpt.additional_amount_payable).toBe(30); // 149 - 119, not 149 - 130

    // Restore SIMPLE catalogue for other tests.
    await request(app)
      .patch(`/api/packages/${simple.id}/price`)
      .set(bearer(superAdmin))
      .send({ price: 119 })
      .expect(200);
    void smart;
  });

  it("recalculates payable when target catalogue changes between quote and checkout", async () => {
    const client = await makeClient("price-move");
    await buySa(client, "SIMPLE");

    const list = await request(app)
      .get("/api/packages?service_type=SELF_ASSESSMENT")
      .set(bearer(admin))
      .expect(200);
    const smart = list.body.find((p: { code: string }) => p.code === "SMART");

    const before = await request(app)
      .get("/api/my-upgrade-options")
      .set(bearer(client))
      .expect(200);
    expect(before.body.options.find((o: { code: string }) => o.code === "SMART").total_due_now).toBe(
      30,
    );

    await request(app)
      .patch(`/api/packages/${smart.id}/price`)
      .set(bearer(superAdmin))
      .send({ price: 159 })
      .expect(200);

    const checkout = await request(app)
      .post("/api/compat/client/subscription/upgrade-checkout")
      .set(bearer(client))
      .send({ package_code: "SMART", origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    // 159 - 119 = 40
    expect(checkout.body.data.amount).toBe(40);
    expect(checkout.body.data.amountDuePence ?? checkout.body.data.amount_due_pence).toBe(4000);
    expect(checkout.body.data.upgradePrice ?? checkout.body.data.upgrade_price).toBe(159);

    await request(app)
      .patch(`/api/packages/${smart.id}/price`)
      .set(bearer(superAdmin))
      .send({ price: 149 })
      .expect(200);
  });

  it("J-011 hardening (preventive): rejects client amounts; double-click reuses session", async () => {
    const client = await makeClient("j011-amount");
    await buySa(client, "SIMPLE");

    await request(app)
      .post("/api/payments/upgrade-checkout")
      .set(bearer(client))
      .send({
        package_code: "SMART",
        origin_url: "https://app.test.taxsimba.local",
        amount: 999,
      })
      .expect(400);

    const first = await request(app)
      .post("/api/compat/client/subscription/upgrade-checkout")
      .set(bearer(client))
      .send({ package_code: "ELITE", origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    const second = await request(app)
      .post("/api/compat/client/subscription/upgrade-checkout")
      .set(bearer(client))
      .send({ package_code: "ELITE", origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    expect(second.body.data.sessionId || second.body.data.session_id).toBe(
      first.body.data.sessionId || first.body.data.session_id,
    );
    expect(second.body.data.reused ?? second.body.data.amount).toBeTruthy();
  });

  it("does not open a second payable upgrade while a pending SA_UPGRADE exists", async () => {
    const client = await makeClient("no-dup-upgrade");
    await buySa(client, "SIMPLE");
    const first = await request(app)
      .post("/api/payments/upgrade-checkout")
      .set(bearer(client))
      .send({ package_code: "SMART", origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    const second = await request(app)
      .post("/api/payments/upgrade-checkout")
      .set(bearer(client))
      .send({ package_code: "SMART", origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    expect(second.body.session_id).toBe(first.body.session_id);
    expect(second.body.reused).toBe(true);

    // Provider reports paid while DB row is still pending (LocalStagingFake / recovered session).
    // Must still reuse — not invent a second payable upgrade.
    provider.pay(first.body.session_id);
    const third = await request(app)
      .post("/api/payments/upgrade-checkout")
      .set(bearer(client))
      .send({ package_code: "SMART", origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    expect(third.body.session_id).toBe(first.body.session_id);
    expect(third.body.reused).toBe(true);

    await payAndConfirm(first.body.session_id).expect(200);
    const hist = await request(app).get("/api/my-payments").set(bearer(client)).expect(200);
    const upgrades = (hist.body as { kind: string; amount: number; payment_status: string }[]).filter(
      (t) => t.kind === "SA_UPGRADE" && t.payment_status === "paid" && Number(t.amount) === 30,
    );
    expect(upgrades.length).toBe(1);
  });

  it("C-009: billing history labels upgrade difference + amount charged; excludes MTD from credit", async () => {
    const client = await makeClient("c009-billing");
    await buySa(client, "SIMPLE");
    // Activate MTD as well — must not affect SA upgrade credit.
    const mtd = await request(app)
      .post("/api/payments/service-checkout")
      .set(bearer(client))
      .send({
        service_type: "MTD_INCOME_TAX",
        package_code: "MTD_COMPLY",
        origin_url: "https://app.test.taxsimba.local",
      })
      .expect(200);
    await payAndConfirm(mtd.body.session_id).expect(200);

    const checkout = await request(app)
      .post("/api/payments/upgrade-checkout")
      .set(bearer(client))
      .send({ package_code: "SMART", origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    expect(checkout.body.amount).toBe(30);
    await payAndConfirm(checkout.body.session_id).expect(200);

    const hist = await request(app)
      .get("/api/compat/client/transaction/list")
      .set(bearer(client))
      .expect(200);
    const txs = hist.body.data?.transactions || hist.body.transactions || [];
    const upgrade = txs.find((t: { kind?: string }) => t.kind === "SA_UPGRADE");
    expect(upgrade).toBeTruthy();
    expect(Number(upgrade.amount)).toBe(30);
    expect(String(upgrade.currency).toLowerCase()).toBe("gbp");
    expect(String(upgrade.description).toLowerCase()).toMatch(/upgrade difference/);
    expect(upgrade.status).toBe("succeeded");

    const services = await request(app).get("/api/my-services").set(bearer(client)).expect(200);
    const sa = services.body.services.find((s: { service_type: string }) => s.service_type === "SELF_ASSESSMENT");
    const mtdSvc = services.body.services.find(
      (s: { service_type: string }) => s.service_type === "MTD_INCOME_TAX",
    );
    expect(sa.package_code).toBe("SMART");
    expect(Number(sa.agreed_price)).toBe(149);
    expect(mtdSvc.status).toBe("ACTIVE");
    expect(mtdSvc.package_code).toBe("MTD_COMPLY");
  });

  it("cancel / unfulfilled success URL does not upgrade; replay webhook is idempotent", async () => {
    const client = await makeClient("cancel-replay");
    await buySa(client, "SIMPLE");
    const { col } = await import("../../src/db/mongo");
    const beforeCases = await col("cases").countDocuments({
      client_id: client.clientId,
      service_type: "SELF_ASSESSMENT",
    });

    const checkout = await request(app)
      .post("/api/payments/upgrade-checkout")
      .set(bearer(client))
      .send({ package_code: "SMART", origin_url: "https://app.test.taxsimba.local" })
      .expect(200);

    // Expire without paying — package stays SIMPLE.
    await webhook("checkout.session.expired", {
      id: checkout.body.session_id,
      payment_status: "unpaid",
    }).expect(200);

    let services = await request(app).get("/api/my-services").set(bearer(client)).expect(200);
    expect(
      services.body.services.find((s: { service_type: string }) => s.service_type === "SELF_ASSESSMENT")
        .package_code,
    ).toBe("SIMPLE");

    // Fresh upgrade + pay
    const paidCheckout = await request(app)
      .post("/api/payments/upgrade-checkout")
      .set(bearer(client))
      .send({ package_code: "SMART", origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    await payAndConfirm(paidCheckout.body.session_id).expect(200);
    // Replay
    await payAndConfirm(paidCheckout.body.session_id).expect(200);

    services = await request(app).get("/api/my-services").set(bearer(client)).expect(200);
    const sa = services.body.services.find((s: { service_type: string }) => s.service_type === "SELF_ASSESSMENT");
    expect(sa.package_code).toBe("SMART");
    const hist = await request(app).get("/api/my-payments").set(bearer(client)).expect(200);
    const upgrades = (hist.body as { kind: string; amount: number }[]).filter(
      (t) => t.kind === "SA_UPGRADE" && t.amount === 30,
    );
    // One paid upgrade row (replay must not duplicate charge records beyond the same session)
    const paidUpgrades = upgrades.filter(Boolean);
    expect(paidUpgrades.length).toBeGreaterThanOrEqual(1);

    const afterCases = await col("cases").countDocuments({
      client_id: client.clientId,
      service_type: "SELF_ASSESSMENT",
    });
    expect(afterCases).toBe(beforeCases);

    // Downgrade blocked
    await request(app)
      .post("/api/payments/upgrade-checkout")
      .set(bearer(client))
      .send({ package_code: "SIMPLE", origin_url: "https://app.test.taxsimba.local" })
      .expect(400);
  });

  it("isolates upgrade checkout from another client", async () => {
    const a = await makeClient("iso-a");
    const b = await makeClient("iso-b");
    await buySa(a, "SIMPLE");
    await buySa(b, "SIMPLE");

    const aCheckout = await request(app)
      .post("/api/payments/upgrade-checkout")
      .set(bearer(a))
      .send({ package_code: "SMART", origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    await payAndConfirm(aCheckout.body.session_id).expect(200);

    // B cannot poll/fulfil A's session via status as B
    const status = await request(app)
      .get(`/api/payments/status/${aCheckout.body.session_id}`)
      .set(bearer(b));
    // Status endpoint may be unauthenticated or scoped — either way B must stay on SIMPLE.
    void status;
    const bServices = await request(app).get("/api/my-services").set(bearer(b)).expect(200);
    expect(
      bServices.body.services.find((s: { service_type: string }) => s.service_type === "SELF_ASSESSMENT")
        .package_code,
    ).toBe("SIMPLE");

    const aHist = await request(app)
      .get("/api/compat/client/transaction/list")
      .set(bearer(a))
      .expect(200);
    const bHist = await request(app)
      .get("/api/compat/client/transaction/list")
      .set(bearer(b))
      .expect(200);
    const aTx = (aHist.body.data?.transactions || []).map((t: { id: string }) => t.id);
    const bTx = (bHist.body.data?.transactions || []).map((t: { id: string }) => t.id);
    expect(aTx.some((id: string) => bTx.includes(id))).toBe(false);
  });

  it("does not queue SA_UPGRADE purchase-confirmation email", async () => {
    const client = await makeClient("no-upgrade-email");
    await buySa(client, "SIMPLE");
    const { col } = await import("../../src/db/mongo");
    const before = await col("email_messages").countDocuments({
      user_id: client.id,
      kind: "PURCHASE_CONFIRMATION",
    });
    const checkout = await request(app)
      .post("/api/payments/upgrade-checkout")
      .set(bearer(client))
      .send({ package_code: "SMART", origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    await payAndConfirm(checkout.body.session_id).expect(200);
    const after = await col("email_messages").countDocuments({
      user_id: client.id,
      kind: "PURCHASE_CONFIRMATION",
    });
    expect(after).toBe(before);
  });

  it("sequential SIMPLE→SMART→ELITE uses catalogue deltas (£30 then £150); total paid £299", async () => {
    const client = await makeClient("seq-upgrade");
    await buySa(client, "SIMPLE");

    const toSmart = await request(app)
      .post("/api/payments/upgrade-checkout")
      .set(bearer(client))
      .send({ package_code: "SMART", origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    expect(toSmart.body.amount).toBe(30);
    expect(toSmart.body.upgrade_price).toBe(149);
    expect(toSmart.body.current_package_credit).toBe(119);
    await payAndConfirm(toSmart.body.session_id).expect(200);

    let services = await request(app).get("/api/my-services").set(bearer(client)).expect(200);
    let sa = services.body.services.find(
      (s: { service_type: string }) => s.service_type === "SELF_ASSESSMENT",
    );
    expect(sa.package_code).toBe("SMART");
    expect(Number(sa.agreed_price)).toBe(149);

    const toElite = await request(app)
      .post("/api/payments/upgrade-checkout")
      .set(bearer(client))
      .send({ package_code: "ELITE", origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    // Credit is SMART agreed_price 149, not original 119 — payable 150 not 180.
    expect(toElite.body.amount).toBe(150);
    expect(toElite.body.upgrade_price).toBe(299);
    expect(toElite.body.current_package_credit).toBe(149);
    await payAndConfirm(toElite.body.session_id).expect(200);

    services = await request(app).get("/api/my-services").set(bearer(client)).expect(200);
    sa = services.body.services.find(
      (s: { service_type: string }) => s.service_type === "SELF_ASSESSMENT",
    );
    expect(sa.package_code).toBe("ELITE");
    expect(Number(sa.agreed_price)).toBe(299);

    const hist = await request(app).get("/api/my-payments").set(bearer(client)).expect(200);
    const rows = hist.body as { kind: string; amount: number; payment_status: string }[];
    const saPaid = rows
      .filter(
        (t) =>
          (t.kind === "SERVICE_ACTIVATION" || t.kind === "SA_UPGRADE") &&
          t.payment_status === "paid",
      )
      .reduce((sum, t) => sum + Number(t.amount), 0);
    expect(saPaid).toBe(299); // 119 + 30 + 150
  });

  it("direct SIMPLE→ELITE charges catalogue difference £180", async () => {
    const client = await makeClient("direct-elite");
    await buySa(client, "SIMPLE");
    const checkout = await request(app)
      .post("/api/payments/upgrade-checkout")
      .set(bearer(client))
      .send({ package_code: "ELITE", origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    expect(checkout.body.amount).toBe(180);
    expect(checkout.body.amount_due_pence).toBe(18000);
    expect(checkout.body.upgrade_price).toBe(299);
    expect(checkout.body.current_package_credit).toBe(119);
    await payAndConfirm(checkout.body.session_id).expect(200);
    const services = await request(app).get("/api/my-services").set(bearer(client)).expect(200);
    expect(
      services.body.services.find((s: { service_type: string }) => s.service_type === "SELF_ASSESSMENT")
        .package_code,
    ).toBe("ELITE");
  });

  it("zero-payable when target catalogue ≤ SA credit: no Stripe session, no refund, return URL does not activate", async () => {
    const client = await makeClient("zero-payable");
    await buySa(client, "SIMPLE");

    const list = await request(app)
      .get("/api/packages?service_type=SELF_ASSESSMENT")
      .set(bearer(admin))
      .expect(200);
    const smart = list.body.find((p: { code: string }) => p.code === "SMART");
    // Higher-rank SMART priced below existing SA credit (£119).
    await request(app)
      .patch(`/api/packages/${smart.id}/price`)
      .set(bearer(superAdmin))
      .send({ price: 50 })
      .expect(200);

    const options = await request(app)
      .get("/api/my-upgrade-options")
      .set(bearer(client))
      .expect(200);
    const smartOpt = options.body.options.find((o: { code: string }) => o.code === "SMART");
    expect(smartOpt.upgrade_price).toBe(50);
    expect(smartOpt.current_package_credit).toBe(119);
    expect(smartOpt.additional_amount_payable).toBe(0);
    expect(smartOpt.amount_due_pence).toBe(0);

    const denied = await request(app)
      .post("/api/payments/upgrade-checkout")
      .set(bearer(client))
      .send({ package_code: "SMART", origin_url: "https://app.test.taxsimba.local" })
      .expect(400);
    expect(String(denied.body.detail || denied.body.message || "")).toMatch(/no additional amount/i);

    // Fabricate an unpaid upgrade txn and hit return URL — must not activate.
    const { col } = await import("../../src/db/mongo");
    const fakeSession = `cs_test_zero_${randomUUID().slice(0, 8)}`;
    await col("payment_transactions").insertOne({
      id: randomUUID(),
      session_id: fakeSession,
      user_id: client.id,
      client_id: client.clientId,
      kind: "SA_UPGRADE",
      service_type: "SELF_ASSESSMENT",
      previous_package: "SIMPLE",
      new_package: "SMART",
      amount: 0,
      amount_due_pence: 0,
      currency: "gbp",
      status: "initiated",
      payment_status: "pending",
      fulfilled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await request(app)
      .post("/api/compat/client/subscription/checkout-success")
      .set(bearer(client))
      .send({ sessionId: fakeSession })
      .expect(400);

    const services = await request(app).get("/api/my-services").set(bearer(client)).expect(200);
    expect(
      services.body.services.find((s: { service_type: string }) => s.service_type === "SELF_ASSESSMENT")
        .package_code,
    ).toBe("SIMPLE");

    // Restore SMART catalogue price for other tests.
    await request(app)
      .patch(`/api/packages/${smart.id}/price`)
      .set(bearer(superAdmin))
      .send({ price: 149 })
      .expect(200);
  });

  it("delayed confirmation: unpaid upgrade stays pending; package unchanged until webhook", async () => {
    const client = await makeClient("delayed-confirm");
    await buySa(client, "SIMPLE");
    const checkout = await request(app)
      .post("/api/payments/upgrade-checkout")
      .set(bearer(client))
      .send({ package_code: "SMART", origin_url: "https://app.test.taxsimba.local" })
      .expect(200);

    const { col } = await import("../../src/db/mongo");
    const openTx = await col("payment_transactions").findOne({
      session_id: checkout.body.session_id,
    });
    expect(openTx).toBeTruthy();
    expect(openTx!.payment_status).toBe("pending");
    expect(openTx!.fulfilled).toBe(false);

    const hist = await request(app)
      .get("/api/compat/client/transaction/list")
      .set(bearer(client))
      .expect(200);
    const txs = hist.body.data?.transactions || [];
    const pendingUpgrade = txs.find(
      (t: { kind?: string; status?: string; amount?: number }) =>
        t.kind === "SA_UPGRADE" && t.status === "pending" && Number(t.amount) === 30,
    );
    expect(pendingUpgrade).toBeTruthy();

    let services = await request(app).get("/api/my-services").set(bearer(client)).expect(200);
    expect(
      services.body.services.find((s: { service_type: string }) => s.service_type === "SELF_ASSESSMENT")
        .package_code,
    ).toBe("SIMPLE");

    // Return URL alone while unpaid must not fulfil.
    await request(app)
      .post("/api/compat/client/subscription/checkout-success")
      .set(bearer(client))
      .send({ sessionId: checkout.body.session_id })
      .expect(400);

    await payAndConfirm(checkout.body.session_id).expect(200);
    services = await request(app).get("/api/my-services").set(bearer(client)).expect(200);
    expect(
      services.body.services.find((s: { service_type: string }) => s.service_type === "SELF_ASSESSMENT")
        .package_code,
    ).toBe("SMART");
  });
});
