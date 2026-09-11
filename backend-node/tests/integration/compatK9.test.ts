/**
 * K.9 — CRITICAL E2E gate through `/api/compat`.
 * Continuous journeys: verify-before-purchase, entitlement, AW, role isolation.
 * Does not rewrite protected domain; proves adapters call existing spines.
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

describe("K.9 CRITICAL E2E gate via /api/compat", () => {
  let app: Express;
  let provider: FakePaymentProvider;
  let admin: TestUser;
  let superAdmin: TestUser;
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

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    const { setPaymentProvider } = await import("../../src/services/payments");
    provider = new FakePaymentProvider();
    setPaymentProvider(provider);
    admin = await makeUser("ADMIN", "k9admin");
    superAdmin = await makeUser("SUPER_ADMIN", "k9super");
    accountant = await makeUser("ACCOUNTANT", "k9acc");
  }, 90000);

  afterAll(async () => {
    const { setPaymentProvider } = await import("../../src/services/payments");
    setPaymentProvider(null);
    await dropTestDb();
  });

  describe("G1 continuous happy path", () => {
    it("register → verify → buy SA → engage → case → AW pay; no entitlement side effects", async () => {
      const email = `k9g1.${randomUUID().slice(0, 8)}@example.com`;
      const password = "Tr0ubl3-Kettle-Marsh";
      const reg = await request(app)
        .post("/api/compat/auth/register")
        .send({ email, password, name: "K9", surname: "Gate" })
        .expect(200);
      expect(reg.body.data.hasActiveService).toBe(false);

      const { col } = await import("../../src/db/mongo");
      const user = await col("users").findOne({ email });
      expect(user).toBeTruthy();
      // Mark verified (token consume path covered in K.2; gate focuses on post-verify journey).
      await col("users").updateOne(
        { id: user!.id },
        { $set: { email_verified_at: new Date().toISOString() } },
      );
      const login = await request(app)
        .post("/api/compat/auth/login")
        .send({ email, password })
        .expect(200);
      const token = login.body.data.accessToken as string;
      const clientBearer = { Authorization: `Bearer ${token}` };

      const plans = await request(app)
        .get("/api/compat/subscription-plans?category=taxSimba")
        .set(clientBearer)
        .expect(200);
      const plan = plans.body.data.plans?.[0] || plans.body.data?.[0];
      const planId = plan?.id || plan?.code || "SIMPLE";

      const checkout = await request(app)
        .post("/api/compat/client/subscription/checkout-session")
        .set(clientBearer)
        .send({ planId, originUrl: "https://app.test.taxsimba.local" })
        .expect(200);
      const sessionId = checkout.body.data.sessionId as string;
      await payAndConfirm(sessionId).expect(200);

      const success = await request(app)
        .post("/api/compat/client/subscription/checkout-success")
        .set(clientBearer)
        .send({ sessionId })
        .expect(200);
      expect(success.body.data.paymentStatus).toBe("paid");

      const client = await col("clients").findOne({ user_id: user!.id });
      const sa = await col("client_services").findOne({
        client_id: client!.id,
        service_type: "SELF_ASSESSMENT",
      });
      expect(sa?.status).toBe("ACTIVE");
      const mtd = await col("client_services").findOne({
        client_id: client!.id,
        service_type: "MTD_INCOME_TAX",
      });
      expect(mtd?.status).toBe("NOT_ACTIVE");
      const casesBeforeAw = await col("cases").countDocuments({ client_id: client!.id });
      expect(casesBeforeAw).toBeGreaterThanOrEqual(1);

      await request(app)
        .post("/api/compat/client/accept-engagement-letter")
        .set(clientBearer)
        .send({
          accepted: true,
          signature: "K9 Gate",
          agreementVersion: "client-care-v1",
        })
        .expect(200);

      const applied = await request(app)
        .post("/api/compat/client/apply-tax-return")
        .set(clientBearer)
        .send({ category: "taxSimba" });
      expect([200, 201]).toContain(applied.status);
      const caseId =
        applied.body.data?.taxReturn?.taxReturnId ||
        applied.body.data?.taxReturn?.id ||
        applied.body.data?.taxReturnId ||
        applied.body.data?.id;
      expect(caseId).toBeTruthy();

      const aw = await request(app)
        .post("/api/compat/admin/payment-requests")
        .set(bearer(admin))
        .send({
          taxReturnId: caseId,
          description: "K9 extra work",
          amount: 42,
        })
        .expect(201);
      const awId = aw.body.data.id as string;

      const awCheckout = await request(app)
        .post(`/api/compat/client/payment-requests/${awId}/checkout`)
        .set(clientBearer)
        .send({ originUrl: "https://app.test.taxsimba.local" })
        .expect(200);
      const awSession = awCheckout.body.data.sessionId as string;
      await payAndConfirm(awSession).expect(200);

      // Fulfil via payments/status-style retrieve path used by webhook already.
      const awTx = await col("payment_transactions").findOne({ id: awId });
      expect(awTx?.payment_status).toBe("paid");
      expect(awTx?.fulfilled).toBe(true);

      const casesAfter = await col("cases").countDocuments({ client_id: client!.id });
      expect(casesAfter).toBe(casesBeforeAw);
      const saAfter = await col("client_services").findOne({
        client_id: client!.id,
        service_type: "SELF_ASSESSMENT",
      });
      const mtdAfter = await col("client_services").findOne({
        client_id: client!.id,
        service_type: "MTD_INCOME_TAX",
      });
      expect(saAfter?.status).toBe("ACTIVE");
      expect(saAfter?.package_code).toBe(sa?.package_code);
      expect(mtdAfter?.status).toBe("NOT_ACTIVE");
    }, 90000);
  });

  describe("G2 verify-before-purchase (compat)", () => {
    it("unverified blocked on service checkout, AW checkout, and upgrade checkout", async () => {
      const unverified = await makeClient("k9unv", { emailVerified: false });
      const before = provider.checkouts.length;

      await request(app)
        .post("/api/compat/client/subscription/checkout-session")
        .set(bearer(unverified))
        .send({ planId: "SIMPLE", originUrl: "https://app.test.taxsimba.local" })
        .expect(403);

      const { caseId } = await activateClientService(unverified, "SELF_ASSESSMENT");
      // activateClientService bypasses checkout for fixture; still unpaid verify for AW.
      const aw = await request(app)
        .post("/api/compat/admin/payment-requests")
        .set(bearer(admin))
        .send({ taxReturnId: caseId, description: "blocked", amount: 10 })
        .expect(201);
      await request(app)
        .post(`/api/compat/client/payment-requests/${aw.body.data.id}/checkout`)
        .set(bearer(unverified))
        .send({ originUrl: "https://app.test.taxsimba.local" })
        .expect(403);

      await request(app)
        .post("/api/compat/client/subscription/upgrade-checkout")
        .set(bearer(unverified))
        .send({ packageCode: "SMART", originUrl: "https://app.test.taxsimba.local" })
        .expect(403);

      expect(provider.checkouts.length).toBe(before);
    });

    it("checkout-success does not activate unpaid session", async () => {
      const client = await makeClient("k9unpaid", { emailVerified: true });
      const checkout = await request(app)
        .post("/api/compat/client/subscription/checkout-session")
        .set(bearer(client))
        .send({ planId: "SIMPLE", originUrl: "https://app.test.taxsimba.local" })
        .expect(200);
      await request(app)
        .post("/api/compat/client/subscription/checkout-success")
        .set(bearer(client))
        .send({ sessionId: checkout.body.data.sessionId })
        .expect(400);
      const { col } = await import("../../src/db/mongo");
      const svc = await col("client_services").findOne({
        client_id: client.clientId,
        service_type: "SELF_ASSESSMENT",
      });
      expect(svc?.status).toBe("NOT_ACTIVE");
    });
  });

  describe("G3 entitlement matrix via compat", () => {
    it("unpaid cannot apply SA or MTD; dual can list both; SA-only blocked from MTD", async () => {
      const unpaid = await makeClient("k9unpaid2", { emailVerified: true });
      await request(app)
        .post("/api/compat/client/apply-tax-return")
        .set(bearer(unpaid))
        .send({ category: "taxSimba" })
        .expect(403);
      await request(app)
        .post("/api/compat/client/apply-tax-return")
        .set(bearer(unpaid))
        .send({ category: "mtd" })
        .expect(403);

      const saOnly = await makeClient("k9sa", { emailVerified: true });
      await activateClientService(saOnly, "SELF_ASSESSMENT");
      await request(app)
        .post("/api/compat/client/apply-tax-return")
        .set(bearer(saOnly))
        .send({ category: "mtd" })
        .expect(403);

      const dual = await makeClient("k9dual", { emailVerified: true });
      await activateClientService(dual, "SELF_ASSESSMENT");
      await activateClientService(dual, "MTD_INCOME_TAX");
      const list = await request(app)
        .post("/api/compat/client/all-tax-returns")
        .set(bearer(dual))
        .send({})
        .expect(200);
      const rows = list.body.data.taxReturns || list.body.data.files || list.body.data || [];
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("G4 role / privacy / profile / staff collab", () => {
    it("ADMIN masks contacts; SUPER_ADMIN sees full; profile + password + messages + docs", async () => {
      const client = await makeClient("k9priv", { emailVerified: true });
      const { col } = await import("../../src/db/mongo");
      await col("users").updateOne(
        { id: client.id },
        { $set: { phone: "07700900111", password_hash: (await import("../../src/services/auth")).hashPassword("OldPassw0rd!") } },
      );
      const { caseId } = await activateClientService(client, "SELF_ASSESSMENT");

      const asAdmin = await request(app)
        .post("/api/compat/admin/clients")
        .set(bearer(admin))
        .send({})
        .expect(200);
      const adminRow = asAdmin.body.data.clients.find((c: { id: string }) => c.id === client.id);
      expect(String(adminRow.email)).toContain("***");

      const asSuper = await request(app)
        .post("/api/compat/admin/clients")
        .set(bearer(superAdmin))
        .send({})
        .expect(200);
      const superRow = asSuper.body.data.clients.find((c: { id: string }) => c.id === client.id);
      expect(superRow.email).toBe(client.email);

      await request(app)
        .put("/api/compat/auth/update-account-settings")
        .set(bearer(client))
        .send({ name: "K9 Updated", phone: "07700900222" })
        .expect(200);

      await request(app)
        .post("/api/compat/auth/change-password")
        .set(bearer(client))
        .send({
          currentPassword: "OldPassw0rd!",
          newPassword: "N3w-Passw0rd-Gate",
          confirmNewPassword: "N3w-Passw0rd-Gate",
        })
        .expect(200);

      await request(app)
        .post(`/api/cases/${caseId}/assign`)
        .set(bearer(admin))
        .send({ accountant_id: accountant.id })
        .expect(200);

      await request(app)
        .post("/api/compat/admin/send-to-client")
        .set(bearer(admin))
        .send({ taxReturnId: caseId, message: "Hello from admin" })
        .expect(200);

      const log = await request(app)
        .post(`/api/compat/admin/communication-log/${caseId}`)
        .set(bearer(admin))
        .send({})
        .expect(200);
      expect(log.body.data.messages.some((m: { body: string }) => m.body.includes("Hello"))).toBe(
        true,
      );

      await request(app)
        .post(`/api/compat/accountant/tax-returns/${caseId}/request-documents`)
        .set(bearer(accountant))
        .send({
          requiredDocuments: [{ documentType: "P60", description: "Latest P60" }],
          message: "Please upload",
        })
        .expect(200);

      // Upgrade options available for ACTIVE SA.
      const upgrades = await request(app)
        .get("/api/compat/client/subscription/upgrade-options")
        .set(bearer(client))
        .expect(200);
      expect(upgrades.body.success).toBe(true);
    });

    it("CLIENT cannot create AW; ACCOUNTANT cannot admin-approve via manage-review", async () => {
      const client = await makeClient("k9iso", { emailVerified: true });
      const { caseId } = await activateClientService(client, "SELF_ASSESSMENT");
      await request(app)
        .post("/api/compat/admin/payment-requests")
        .set(bearer(client))
        .send({ taxReturnId: caseId, description: "nope", amount: 1 })
        .expect(403);
      await request(app)
        .post("/api/compat/admin/manage-review")
        .set(bearer(accountant))
        .send({ taxReturnId: caseId, action: "approve" })
        .expect(403);
    });
  });
});
