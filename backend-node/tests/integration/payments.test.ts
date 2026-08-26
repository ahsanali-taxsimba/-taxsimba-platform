/** Stage 5 parity: packages, service activation, payments, receipts, recommendations. */
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bearer, bootTestApp, dropTestDb, makeClient, makeUser, TestUser } from "../helpers/app";
import { FakePaymentProvider, WEBHOOK_SIGNATURE } from "../helpers/payments";

type Client = TestUser & { clientId: string };

describe("phase 1B packages, payments and recommendations", () => {
  let app: Express;
  let provider: FakePaymentProvider;
  let superAdmin: TestUser;
  let admin: TestUser;
  let accountant: TestUser;

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

  /** Buys a service end to end and returns the checkout session id. */
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
    return res.body.services as Record<string, any>[];
  }

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    const { setPaymentProvider } = await import("../../src/services/payments");
    provider = new FakePaymentProvider();
    setPaymentProvider(provider);
    superAdmin = await makeUser("SUPER_ADMIN", "superadmin");
    admin = await makeUser("ADMIN", "admin");
    accountant = await makeUser("ACCOUNTANT", "accountant");
  });

  afterAll(async () => {
    const { setPaymentProvider } = await import("../../src/services/payments");
    setPaymentProvider(null);
    await dropTestDb();
  });

  // ---------------------------------------------------------------- catalogue
  it("seeds the default package catalogue exactly once", async () => {
    const { ensurePhase1bData } = await import("../../src/domain/packages");
    await ensurePhase1bData();
    const res = await request(app).get("/api/packages").set(bearer(admin)).expect(200);
    const codes = res.body.map((p: { code: string }) => p.code);
    expect(codes).toEqual(
      expect.arrayContaining(["SIMPLE", "SMART", "ELITE", "MTD_ESSENTIAL", "MTD_PLUS"]),
    );
    expect(codes.filter((c: string) => c === "SIMPLE")).toHaveLength(1);
    const sa = await request(app)
      .get("/api/packages?service_type=SELF_ASSESSMENT")
      .set(bearer(admin))
      .expect(200);
    expect(sa.body.map((p: { code: string }) => p.code)).toEqual(["SIMPLE", "SMART", "ELITE"]);
    expect(sa.body[2].price).toBe(249);
  });

  it("only a super admin maintains the catalogue, and price changes are audited", async () => {
    const list = await request(app)
      .get("/api/packages?service_type=MTD_INCOME_TAX")
      .set(bearer(admin))
      .expect(200);
    const pkg = list.body.find((p: { code: string }) => p.code === "MTD_PLUS");

    await request(app)
      .patch(`/api/packages/${pkg.id}/price`)
      .set(bearer(admin))
      .send({ price: 400 })
      .expect(403);

    await request(app)
      .patch(`/api/packages/${pkg.id}/price`)
      .set(bearer(superAdmin))
      .send({ price: 400, effective_from: "2026-04-06" })
      .expect(200);

    const history = await request(app)
      .get(`/api/packages/${pkg.id}/price-history`)
      .set(bearer(admin))
      .expect(200);
    expect(history.body[0]).toMatchObject({
      previous_price: 360,
      new_price: 400,
      effective_from: "2026-04-06",
      changed_by: superAdmin.name,
    });

    // restored so later activations use the documented catalogue price
    await request(app)
      .patch(`/api/packages/${pkg.id}`)
      .set(bearer(superAdmin))
      .send({ price: 360 })
      .expect(200);
    await request(app)
      .patch(`/api/packages/${pkg.id}`)
      .set(bearer(superAdmin))
      .send({})
      .expect(400);
  });

  it("exposes the configurable package-change lock", async () => {
    const res = await request(app).get("/api/settings/package-lock").set(bearer(admin)).expect(200);
    expect(res.body.locked_statuses).toContain("ADMIN_REVIEW");
    expect(res.body.locked_statuses).toContain("COMPLETED");
    await request(app)
      .patch("/api/settings/package-lock")
      .set(bearer(admin))
      .send({ locked_statuses: [] })
      .expect(403);
  });

  // ---------------------------------------------------------------- activation
  it("starts a new account with no active service", async () => {
    const client = await makeClient("fresh");
    const rows = await services(client);
    expect(rows.map((s) => s.service_type)).toEqual(["SELF_ASSESSMENT", "MTD_INCOME_TAX"]);
    expect(rows.every((s) => s.status === "NOT_ACTIVE")).toBe(true);
    expect(rows.every((s) => s.package_code === null)).toBe(true);
  });

  it("activates an MTD service on confirmed payment and generates the five periods", async () => {
    const client = await makeClient("mtdbuyer");
    const sessionId = await buy(client, "MTD_INCOME_TAX", "MTD_ESSENTIAL");
    expect(provider.last().amount).toBe(240);

    const rows = await services(client);
    const mtd = rows.find((s) => s.service_type === "MTD_INCOME_TAX")!;
    expect(mtd).toMatchObject({
      status: "ACTIVE",
      package_code: "MTD_ESSENTIAL",
      agreed_price: 240,
      tax_year: "2026/27",
      billing_frequency: "Quarterly billing",
    });
    expect(mtd.cases).toHaveLength(1);
    expect(mtd.cases[0].case_ref).toMatch(/^MTD-\d+$/);
    expect(mtd.cases[0].status).toBe("AWAITING_ASSIGNMENT");

    const periods = await request(app)
      .get(`/api/mtd/cases/${mtd.cases[0].id}/periods`)
      .set(bearer(admin))
      .expect(200);
    expect(periods.body.map((p: { label: string }) => p.label)).toEqual([
      "Quarter 1",
      "Quarter 2",
      "Quarter 3",
      "Quarter 4",
      "Final Declaration",
    ]);

    const notifications = await request(app)
      .get("/api/notifications")
      .set(bearer(admin))
      .expect(200);
    expect(
      notifications.body.some(
        (n: { title: string }) => n.title === "New MTD for Income Tax service activated — assign an accountant",
      ),
    ).toBe(true);

    // A replayed webhook must not duplicate the service, case or periods.
    await payAndConfirm(sessionId).expect(200);
    const after = await services(client);
    const mtdAfter = after.find((s) => s.service_type === "MTD_INCOME_TAX")!;
    expect(mtdAfter.cases).toHaveLength(1);
    const periodsAfter = await request(app)
      .get(`/api/mtd/cases/${mtd.cases[0].id}/periods`)
      .set(bearer(admin))
      .expect(200);
    expect(periodsAfter.body).toHaveLength(5);
  });

  it("reuses an open checkout instead of creating a second payable session", async () => {
    const client = await makeClient("reuser");
    const first = await request(app)
      .post("/api/payments/service-checkout")
      .set(bearer(client))
      .send({
        service_type: "SELF_ASSESSMENT",
        package_code: "SIMPLE",
        origin_url: "https://app.test.taxsimba.local",
      })
      .expect(200);
    const second = await request(app)
      .post("/api/payments/service-checkout")
      .set(bearer(client))
      .send({
        service_type: "SELF_ASSESSMENT",
        package_code: "SIMPLE",
        origin_url: "https://app.test.taxsimba.local",
      })
      .expect(200);
    expect(second.body.session_id).toBe(first.body.session_id);
    expect(second.body.reused).toBe(true);

    // Once the session is dead a fresh one is issued.
    provider.expire(first.body.session_id);
    const third = await request(app)
      .post("/api/payments/service-checkout")
      .set(bearer(client))
      .send({
        service_type: "SELF_ASSESSMENT",
        package_code: "SIMPLE",
        origin_url: "https://app.test.taxsimba.local",
      })
      .expect(200);
    expect(third.body.session_id).not.toBe(first.body.session_id);
  });

  it("refuses to sell a service the client already holds", async () => {
    const client = await makeClient("already");
    await buy(client, "SELF_ASSESSMENT", "SMART");
    const res = await request(app)
      .post("/api/payments/service-checkout")
      .set(bearer(client))
      .send({
        service_type: "SELF_ASSESSMENT",
        package_code: "ELITE",
        origin_url: "https://app.test.taxsimba.local",
      })
      .expect(400);
    expect(res.body.detail).toBe("This service is already active");
    await request(app)
      .post("/api/payments/service-checkout")
      .set(bearer(client))
      .send({
        service_type: "VAT",
        package_code: "SMART",
        origin_url: "https://app.test.taxsimba.local",
      })
      .expect(400);
  });

  it("confirms payment through the status endpoint as well as the webhook", async () => {
    const client = await makeClient("statuspoll");
    const res = await request(app)
      .post("/api/payments/service-checkout")
      .set(bearer(client))
      .send({
        service_type: "MTD_INCOME_TAX",
        package_code: "MTD_PLUS",
        origin_url: "https://app.test.taxsimba.local",
      })
      .expect(200);
    provider.pay(res.body.session_id);
    const status = await request(app)
      .get(`/api/payments/status/${res.body.session_id}`)
      .expect(200);
    expect(status.body.payment_status).toBe("paid");
    const rows = await services(client);
    expect(rows.find((s) => s.service_type === "MTD_INCOME_TAX")!.status).toBe("ACTIVE");
    await request(app).get("/api/payments/status/cs_test_missing").expect(404);
  });

  // ---------------------------------------------------------------- upgrades
  it("prices upgrades as the difference and never permits a downgrade", async () => {
    const client = await makeClient("upgrader");
    await buy(client, "SELF_ASSESSMENT", "SIMPLE");

    const options = await request(app)
      .get("/api/my-upgrade-options")
      .set(bearer(client))
      .expect(200);
    expect(options.body.current_package.code).toBe("SIMPLE");
    expect(options.body.is_highest).toBe(false);
    expect(options.body.options).toEqual([
      expect.objectContaining({ code: "SMART", additional_amount_payable: 30 }),
      expect.objectContaining({ code: "ELITE", additional_amount_payable: 130 }),
    ]);

    const checkout = await request(app)
      .post("/api/payments/upgrade-checkout")
      .set(bearer(client))
      .send({ package_code: "ELITE", origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    expect(checkout.body.amount).toBe(130);
    await payAndConfirm(checkout.body.session_id).expect(200);

    const sa = (await services(client)).find((s) => s.service_type === "SELF_ASSESSMENT")!;
    expect(sa.package_code).toBe("ELITE");
    expect(sa.package_history.at(-1)).toMatchObject({
      previous_package: "SIMPLE",
      new_package: "ELITE",
      reason: "Client upgrade",
      amount_paid: 130,
    });

    const downgrade = await request(app)
      .post("/api/payments/upgrade-checkout")
      .set(bearer(client))
      .send({ package_code: "SMART", origin_url: "https://app.test.taxsimba.local" })
      .expect(400);
    expect(downgrade.body.detail).toBe("Downgrades are not permitted once a package is active");
  });

  it("locks client package changes once the return reaches a late stage", async () => {
    const client = await makeClient("locked");
    await buy(client, "SELF_ASSESSMENT", "SIMPLE");
    const { col } = await import("../../src/db/mongo");
    const kase = await col("cases").findOne({
      client_id: client.clientId,
      service_type: "SELF_ASSESSMENT",
    });
    await col("cases").updateOne({ id: kase!.id }, { $set: { status: "ADMIN_REVIEW" } });

    const options = await request(app)
      .get("/api/my-upgrade-options")
      .set(bearer(client))
      .expect(200);
    expect(options.body.locked).toBe(true);
    expect(options.body.lock_reason).toBe("Your return has reached ADMIN_REVIEW");
    const res = await request(app)
      .post("/api/payments/upgrade-checkout")
      .set(bearer(client))
      .send({ package_code: "ELITE", origin_url: "https://app.test.taxsimba.local" })
      .expect(400);
    expect(res.body.detail).toBe("Package changes are locked at this stage (ADMIN_REVIEW)");
  });

  it("keeps the customer's agreed price when the master price later changes", async () => {
    const client = await makeClient("frozenprice");
    await buy(client, "SELF_ASSESSMENT", "SMART");
    const pkg = (
      await request(app).get("/api/packages?service_type=SELF_ASSESSMENT").set(bearer(admin))
    ).body.find((p: { code: string }) => p.code === "SMART");
    await request(app)
      .patch(`/api/packages/${pkg.id}/price`)
      .set(bearer(superAdmin))
      .send({ price: 199 })
      .expect(200);

    const sa = (await services(client)).find((s) => s.service_type === "SELF_ASSESSMENT")!;
    expect(sa.agreed_price).toBe(149);
    expect(sa.current_master_price).toBe(199);

    await request(app)
      .patch(`/api/packages/${pkg.id}/price`)
      .set(bearer(superAdmin))
      .send({ price: 149 })
      .expect(200);
  });

  it("lets an admin override a package with a recorded reason", async () => {
    const client = await makeClient("overridden");
    await buy(client, "SELF_ASSESSMENT", "SIMPLE");
    await request(app)
      .post(`/api/clients/${client.id}/override-package`)
      .set(bearer(admin))
      .send({ package_code: "ELITE", reason: "   " })
      .expect(400);
    await request(app)
      .post(`/api/clients/${client.id}/override-package`)
      .set(bearer(admin))
      .send({ service_type: "SELF_ASSESSMENT", package_code: "ELITE", reason: "Goodwill" })
      .expect(200);
    const sa = (await services(client)).find((s) => s.service_type === "SELF_ASSESSMENT")!;
    expect(sa.package_code).toBe("ELITE");
    expect(sa.package_history.at(-1)).toMatchObject({
      override: true,
      reason: "Goodwill",
      changed_by: admin.name,
    });
  });

  // ---------------------------------------------------------------- additional work
  it("runs the additional-work payment request through to a receipt exactly once", async () => {
    const client = await makeClient("extrawork");
    await buy(client, "SELF_ASSESSMENT", "SMART");
    const { col } = await import("../../src/db/mongo");
    const kase = (await col("cases").findOne({
      client_id: client.clientId,
      service_type: "SELF_ASSESSMENT",
    }))!;
    await request(app)
      .post(`/api/cases/${kase.id}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: accountant.id })
      .expect(200);

    await request(app)
      .post("/api/payment-requests")
      .set(bearer(accountant))
      .send({ case_id: kase.id, description: "CGT computation", amount: 120 })
      .expect(403);
    await request(app)
      .post("/api/payment-requests")
      .set(bearer(admin))
      .send({ case_id: kase.id, description: "CGT computation", amount: 0 })
      .expect(400);

    const created = await request(app)
      .post("/api/payment-requests")
      .set(bearer(admin))
      .send({
        case_id: kase.id,
        description: "CGT computation",
        amount: 120,
        internal_note: "Quoted by phone",
        vat_rate: 20,
      })
      .expect(200);
    expect(created.body).toMatchObject({
      request_status: "SENT",
      amount: 120,
      net_amount: 100,
      vat_amount: 20,
      payment_status: "pending",
    });

    const clientView = await request(app)
      .get("/api/payment-requests")
      .set(bearer(client))
      .expect(200);
    expect(clientView.body[0].internal_note).toBeUndefined();
    await request(app).get("/api/payment-requests").set(bearer(accountant)).expect(400);
    const accountantView = await request(app)
      .get(`/api/payment-requests?case_id=${kase.id}`)
      .set(bearer(accountant))
      .expect(200);
    expect(accountantView.body[0].internal_note).toBeUndefined();

    const checkout = await request(app)
      .post(`/api/payment-requests/${created.body.id}/checkout`)
      .set(bearer(client))
      .send({ origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    expect(checkout.body.amount).toBe(120);
    await payAndConfirm(checkout.body.session_id).expect(200);
    // A replayed webhook must not raise a second receipt or a second notification.
    await payAndConfirm(checkout.body.session_id).expect(200);

    const receipts = await col("invoices")
      .find({ payment_request_id: created.body.id })
      .toArray();
    expect(receipts).toHaveLength(1);
    expect(receipts[0].number).toMatch(/^INV-\d{4}-\d{4}$/);

    const paid = await request(app).get("/api/payment-requests").set(bearer(client)).expect(200);
    expect(paid.body[0]).toMatchObject({
      request_status: "PAID",
      receipt_number: receipts[0].number,
    });

    const receipt = await request(app)
      .get(`/api/payment-requests/${created.body.id}/receipt`)
      .set(bearer(client))
      .expect(200);
    expect(receipt.headers["content-type"]).toContain("text/html");
    expect(receipt.text).toContain(receipts[0].number);
    expect(receipt.text).toContain("£120.00");

    const stranger = await makeClient("stranger");
    await request(app)
      .get(`/api/payment-requests/${created.body.id}/receipt`)
      .set(bearer(stranger))
      .expect(403);

    await request(app)
      .post(`/api/payment-requests/${created.body.id}/cancel`)
      .set(bearer(admin))
      .expect(400);
  });

  it("cancels and resends outstanding requests only", async () => {
    const client = await makeClient("outstanding");
    await buy(client, "SELF_ASSESSMENT", "SIMPLE");
    const { col } = await import("../../src/db/mongo");
    const kase = (await col("cases").findOne({
      client_id: client.clientId,
      service_type: "SELF_ASSESSMENT",
    }))!;
    const created = await request(app)
      .post("/api/payment-requests")
      .set(bearer(admin))
      .send({ case_id: kase.id, description: "Extra schedule", amount: 60 })
      .expect(200);

    await request(app)
      .post(`/api/payment-requests/${created.body.id}/resend`)
      .set(bearer(admin))
      .expect(200);
    await request(app)
      .post(`/api/payment-requests/${created.body.id}/cancel`)
      .set(bearer(admin))
      .expect(200);
    await request(app)
      .post(`/api/payment-requests/${created.body.id}/resend`)
      .set(bearer(admin))
      .expect(400);
    const afterCancel = await request(app)
      .post(`/api/payment-requests/${created.body.id}/checkout`)
      .set(bearer(client))
      .send({ origin_url: "https://app.test.taxsimba.local" })
      .expect(400);
    expect(afterCancel.body.detail).toBe("This request has been cancelled");
  });

  it("keeps test-client transactions out of the operational payments list", async () => {
    const testClient = await makeClient("qa", { isTest: true });
    await buy(testClient, "SELF_ASSESSMENT", "SIMPLE");
    const operational = await request(app).get("/api/payments").set(bearer(admin)).expect(200);
    expect(operational.body.some((p: { client_id: string }) => p.client_id === testClient.clientId)).toBe(
      false,
    );
    const withTest = await request(app)
      .get("/api/payments?include_test=true")
      .set(bearer(admin))
      .expect(200);
    expect(withTest.body.some((p: { client_id: string }) => p.client_id === testClient.clientId)).toBe(
      true,
    );
    await request(app).get("/api/payments").set(bearer(accountant)).expect(403);
  });

  // ---------------------------------------------------------------- recommendations
  it("raises, approves and sells an MTD recommendation without duplicating it", async () => {
    const client = await makeClient("recommended");
    await buy(client, "SELF_ASSESSMENT", "SMART");
    const { col } = await import("../../src/db/mongo");
    const kase = (await col("cases").findOne({
      client_id: client.clientId,
      service_type: "SELF_ASSESSMENT",
    }))!;
    await request(app)
      .post(`/api/cases/${kase.id}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: accountant.id })
      .expect(200);

    const rec = await request(app)
      .post(`/api/cases/${kase.id}/recommend-mtd`)
      .set(bearer(accountant))
      .send({ reason: "Client turnover exceeds the MTD threshold", note: "Sole trader" })
      .expect(200);
    expect(rec.body).toMatchObject({ type: "MTD", status: "PENDING", service_type: "MTD_INCOME_TAX" });

    const duplicate = await request(app)
      .post(`/api/cases/${kase.id}/recommend-mtd`)
      .set(bearer(accountant))
      .send({ reason: "Again" })
      .expect(409);
    expect(duplicate.body.detail).toContain("already pending");

    // The client sees nothing until an admin approves and releases an offer.
    expect((await request(app).get("/api/my-offers").set(bearer(client)).expect(200)).body).toEqual([]);

    const offer = await request(app)
      .post(`/api/recommendations/${rec.body.id}/approve`)
      .set(bearer(admin))
      .send({ package_code: "MTD_ESSENTIAL", credit: 40, message: "Recommended for you" })
      .expect(200);
    expect(offer.body).toMatchObject({
      package_code: "MTD_ESSENTIAL",
      price: 240,
      credit: 40,
      amount_due: 200,
      status: "PENDING",
    });

    const offers = await request(app).get("/api/my-offers").set(bearer(client)).expect(200);
    expect(offers.body).toHaveLength(1);
    await request(app).get(`/api/my-offers/${offer.body.id}`).set(bearer(client)).expect(200);

    const checkout = await request(app)
      .post("/api/payments/offer-checkout")
      .set(bearer(client))
      .send({ offer_id: offer.body.id, origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    expect(checkout.body.amount).toBe(200);
    await payAndConfirm(checkout.body.session_id).expect(200);

    const mtd = (await services(client)).find((s) => s.service_type === "MTD_INCOME_TAX")!;
    expect(mtd.status).toBe("ACTIVE");
    expect(mtd.cases).toHaveLength(1);
    const recAfter = await col("recommendations").findOne({ id: rec.body.id });
    expect(recAfter!.status).toBe("ACTIVATED");
    const offerAfter = await col("offers").findOne({ id: offer.body.id });
    expect(offerAfter!.status).toBe("PAID");

    // A paid offer cannot be paid a second time.
    await request(app)
      .post("/api/payments/offer-checkout")
      .set(bearer(client))
      .send({ offer_id: offer.body.id, origin_url: "https://app.test.taxsimba.local" })
      .expect(400);
  });

  it("only recommends higher packages and keeps rejections internal", async () => {
    const client = await makeClient("upsell");
    await buy(client, "SELF_ASSESSMENT", "ELITE");
    const { col } = await import("../../src/db/mongo");
    const kase = (await col("cases").findOne({
      client_id: client.clientId,
      service_type: "SELF_ASSESSMENT",
    }))!;
    await request(app)
      .post(`/api/cases/${kase.id}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: accountant.id })
      .expect(200);

    const invalid = await request(app)
      .post(`/api/cases/${kase.id}/recommend-package`)
      .set(bearer(accountant))
      .send({ recommended_package: "SMART", reason: "More support" })
      .expect(400);
    expect(invalid.body.detail).toBe("Only higher packages can be recommended");
    await request(app)
      .post(`/api/cases/${kase.id}/recommend-package`)
      .set(bearer(accountant))
      .send({ reason: "No package named" })
      .expect(400);

    const work = await request(app)
      .post(`/api/cases/${kase.id}/recommend-additional-work`)
      .set(bearer(accountant))
      .send({ reason: "Rental schedule needed", suggested_amount: 90 })
      .expect(200);
    // Additional-work recommendations are internal: several may coexist and the client
    // is never notified.
    await request(app)
      .post(`/api/cases/${kase.id}/recommend-additional-work`)
      .set(bearer(accountant))
      .send({ reason: "Second piece of work" })
      .expect(200);
    const clientNotes = await request(app).get("/api/notifications").set(bearer(client)).expect(200);
    expect(
      clientNotes.body.some((n: { title: string }) => n.title.includes("Additional work recommended")),
    ).toBe(false);

    const sent = await request(app)
      .post("/api/payment-requests")
      .set(bearer(admin))
      .send({
        case_id: kase.id,
        description: "Rental schedule",
        amount: 95,
        recommendation_id: work.body.id,
      })
      .expect(200);
    const approvedRec = await col("recommendations").findOne({ id: work.body.id });
    expect(approvedRec).toMatchObject({
      status: "APPROVED",
      final_amount: 95,
      payment_request_id: sent.body.id,
    });

    const another = await request(app)
      .post(`/api/cases/${kase.id}/recommend-mtd`)
      .set(bearer(accountant))
      .send({ reason: "Turnover growing" })
      .expect(200);
    await request(app)
      .post(`/api/recommendations/${another.body.id}/reject`)
      .set(bearer(admin))
      .send({ reason: "Too early" })
      .expect(200);
    const rejected = await col("recommendations").findOne({ id: another.body.id });
    expect(rejected).toMatchObject({ status: "REJECTED", review_reason: "Too early" });
    expect((await request(app).get("/api/my-offers").set(bearer(client)).expect(200)).body).toEqual([]);
    await request(app)
      .post(`/api/recommendations/${another.body.id}/approve`)
      .set(bearer(admin))
      .send({ package_code: "MTD_ESSENTIAL" })
      .expect(400);
  });

  it("scopes recommendation reads by role and hides test cases from the admin queue", async () => {
    const client = await makeClient("scoped");
    await buy(client, "SELF_ASSESSMENT", "SIMPLE");
    const testClient = await makeClient("scopedqa", { isTest: true });
    await buy(testClient, "SELF_ASSESSMENT", "SIMPLE");
    const { col } = await import("../../src/db/mongo");
    const kase = (await col("cases").findOne({
      client_id: client.clientId,
      service_type: "SELF_ASSESSMENT",
    }))!;
    const testCase = (await col("cases").findOne({
      client_id: testClient.clientId,
      service_type: "SELF_ASSESSMENT",
    }))!;
    await request(app)
      .post(`/api/cases/${kase.id}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: accountant.id })
      .expect(200);

    await request(app)
      .post(`/api/cases/${kase.id}/recommend-mtd`)
      .set(bearer(accountant))
      .send({ reason: "Growing turnover" })
      .expect(200);
    await request(app)
      .post(`/api/cases/${testCase.id}/recommend-mtd`)
      .set(bearer(admin))
      .send({ reason: "QA fixture" })
      .expect(200);

    const other = await makeUser("ACCOUNTANT", "otheraccountant");
    await request(app)
      .get(`/api/cases/${kase.id}/recommendations`)
      .set(bearer(other))
      .expect(403);
    await request(app).get("/api/recommendations").set(bearer(client)).expect(403);

    const queue = await request(app).get("/api/recommendations").set(bearer(admin)).expect(200);
    expect(queue.body.some((r: { case_id: string }) => r.case_id === kase.id)).toBe(true);
    expect(queue.body.some((r: { case_id: string }) => r.case_id === testCase.id)).toBe(false);
    const withTest = await request(app)
      .get("/api/recommendations?include_test=true")
      .set(bearer(admin))
      .expect(200);
    expect(withTest.body.some((r: { case_id: string }) => r.case_id === testCase.id)).toBe(true);
  });

  it("rejects a webhook that is not signed by the payment provider", async () => {
    const res = await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", "nonsense")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ type: "checkout.session.completed", object: { id: "cs_test_1" } }))
      .expect(400);
    expect(res.body.detail).toBe("Invalid signature");
  });

  it("reports the client's own payment history only", async () => {
    const client = await makeClient("history");
    await buy(client, "SELF_ASSESSMENT", "SIMPLE");
    const mine = await request(app).get("/api/my-payments").set(bearer(client)).expect(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0]).toMatchObject({
      kind: "SERVICE_ACTIVATION",
      new_package: "SIMPLE",
      amount: 119,
      payment_status: "paid",
    });
    expect(mine.body[0].session_id).toBeUndefined();
    await request(app).get("/api/my-payments").set(bearer(admin)).expect(403);
  });
});
