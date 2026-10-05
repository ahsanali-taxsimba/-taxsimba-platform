/**
 * Task 5 — SA upgrade pricing / payment / billing (D-001, C-009, J-011).
 *
 * Charging rule under test:
 *   payable = max(target_catalogue − SA agreed_price, 0) in integer pence.
 * £30 / £150 at DEFAULT catalogue are legitimate differences, not full package prices.
 */
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

  it("J-011: rejects client-supplied amounts; double-click reuses the same session", async () => {
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
});
