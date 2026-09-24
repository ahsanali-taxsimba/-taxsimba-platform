/**
 * MTD signup journey — intent persistence, catalogue separation, entitlement, admin state.
 */
import { randomUUID } from "crypto";
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bearer, bootTestApp, dropTestDb, makeClient, makeUser } from "../helpers/app";
import { FakePaymentProvider, WEBHOOK_SIGNATURE } from "../helpers/payments";

describe("MTD signup journey — intent / catalogue / entitlement / admin", () => {
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

  async function verifyUser(email: string) {
    const { col } = await import("../../src/db/mongo");
    const { issueEmailVerification } = await import("../../src/services/emailVerification");
    const user = await col("users").findOne({ email });
    const issued = await issueEmailVerification(user!);
    const res = await request(app)
      .post(`/api/compat/auth/verify-email?token=${encodeURIComponent(issued.token)}`)
      .expect(200);
    return { user, issued, verifyBody: res.body };
  }

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    const { setPaymentProvider } = await import("../../src/services/payments");
    provider = new FakePaymentProvider();
    setPaymentProvider(provider);
    admin = await makeUser("ADMIN", "mtd-journey-admin");
  }, 60000);

  afterAll(async () => {
    const { setPaymentProvider } = await import("../../src/services/payments");
    setPaymentProvider(null);
    await dropTestDb();
  });

  it("1–3: MTD signup persists intent; survives verification; returns only MTD packages", async () => {
    const email = `mtd-intent.${randomUUID().slice(0, 8)}@example.com`;
    const password = "Tr0ubl3-Kettle-Marsh";

    const reg = await request(app)
      .post("/api/compat/auth/register")
      .send({
        email,
        password,
        name: "Mtd",
        surname: "Client",
        mobile: "07700900111",
        userRole: "MTD",
      })
      .expect(200);

    expect(reg.body.data.onboardingIntent).toBe("MTD_INCOME_TAX");
    expect(reg.body.data.catalogueCategory).toBe("mtd");
    expect(reg.body.data.continuePath).toBe("/planlist?category=mtd");
    expect(reg.body.data.serviceState).toBe("PENDING_MTD");
    expect(reg.body.data.user.role).toBe("CLIENT");

    const { col } = await import("../../src/db/mongo");
    const client = await col("clients").findOne({ email });
    expect(client?.onboarding_intent).toBe("MTD_INCOME_TAX");

    const { verifyBody } = await verifyUser(email);
    expect(verifyBody.data.onboardingIntent).toBe("MTD_INCOME_TAX");
    expect(verifyBody.data.continuePath).toBe("/planlist?category=mtd");
    expect(verifyBody.data.catalogueCategory).toBe("mtd");

    const login = await request(app)
      .post("/api/compat/auth/login")
      .send({ email, password })
      .expect(200);
    expect(login.body.data.onboardingIntent).toBe("MTD_INCOME_TAX");
    expect(login.body.data.hasActiveService).toBe(false);
    expect(login.body.data.continuePath).toBe("/planlist?category=mtd");

    const mtdPlans = await request(app)
      .get("/api/compat/subscription-plans?category=mtd")
      .expect(200);
    const mtdCodes = (mtdPlans.body.data as { code: string; price: number }[]).map((p) => p.code);
    expect(mtdCodes).toEqual(["MTD_COMPLY", "MTD_GROWTH", "MTD_ELITE"]);
    expect(mtdCodes).not.toContain("SIMPLE");
    expect(mtdCodes).not.toContain("SMART");
    expect(mtdCodes).not.toContain("ELITE");
    const byCode = Object.fromEntries(
      (mtdPlans.body.data as { code: string; price: number }[]).map((p) => [p.code, p.price]),
    );
    expect(byCode.MTD_COMPLY).toBe(29.99);
    expect(byCode.MTD_GROWTH).toBe(59.99);
    expect(byCode.MTD_ELITE).toBe(89.99);
  });

  it("4–6: MTD pending does not get SA Tax Return ownership; SA signup stays SA; login resumes intent", async () => {
    const mtdEmail = `mtd-pending.${randomUUID().slice(0, 8)}@example.com`;
    const saEmail = `sa-intent.${randomUUID().slice(0, 8)}@example.com`;
    const password = "Tr0ubl3-Kettle-Marsh";

    await request(app)
      .post("/api/compat/auth/register")
      .send({ email: mtdEmail, password, name: "M", surname: "P", userRole: "MTD" })
      .expect(200);
    await verifyUser(mtdEmail);
    const mtdLogin = await request(app)
      .post("/api/compat/auth/login")
      .send({ email: mtdEmail, password })
      .expect(200);
    expect(mtdLogin.body.data.ownership).toBe("neither");
    expect(mtdLogin.body.data.hasActiveSa).toBe(false);
    expect(mtdLogin.body.data.serviceState).toBe("PENDING_MTD");
    // continuePath must NOT be SA Tax Return dashboard
    expect(mtdLogin.body.data.continuePath).not.toMatch(/\/dashboard(?!\/)/);
    expect(mtdLogin.body.data.continuePath).toContain("category=mtd");

    await request(app)
      .post("/api/compat/auth/register")
      .send({ email: saEmail, password, name: "S", surname: "A", userRole: "TAXSIMBA" })
      .expect(200);
    await verifyUser(saEmail);
    const saLogin = await request(app)
      .post("/api/compat/auth/login")
      .send({ email: saEmail, password })
      .expect(200);
    expect(saLogin.body.data.onboardingIntent).toBe("SELF_ASSESSMENT");
    expect(saLogin.body.data.catalogueCategory).toBe("taxSimba");
    expect(saLogin.body.data.continuePath).toBe("/planlist?category=taxSimba");
    expect(saLogin.body.data.serviceState).toBe("PENDING_SA");

    const saPlans = await request(app)
      .get("/api/compat/subscription-plans?category=taxSimba")
      .expect(200);
    const saRows = saPlans.body.data as { code: string; price: number }[];
    expect(saRows.map((p) => p.code)).toEqual(["SIMPLE", "SMART", "ELITE"]);
    expect(saRows.find((p) => p.code === "SIMPLE")!.price).toBe(119);
    expect(saRows.find((p) => p.code === "SMART")!.price).toBe(149);
    expect(saRows.find((p) => p.code === "ELITE")!.price).toBe(299);
    expect(saRows.every((p) => !String(p.code).startsWith("MTD_"))).toBe(true);
  });

  it("7–8: MTD webhook activates one MTD entitlement; unpaid cancel creates none", async () => {
    const email = `mtd-pay.${randomUUID().slice(0, 8)}@example.com`;
    const password = "Tr0ubl3-Kettle-Marsh";
    await request(app)
      .post("/api/compat/auth/register")
      .send({ email, password, name: "Pay", surname: "Mtd", userRole: "MTD" })
      .expect(200);
    await verifyUser(email);
    const login = await request(app)
      .post("/api/compat/auth/login")
      .send({ email, password })
      .expect(200);
    const token = login.body.data.accessToken as string;

    const plans = await request(app)
      .get("/api/compat/subscription-plans?category=mtd")
      .expect(200);
    const comply = (plans.body.data as { code: string; id: string }[]).find(
      (p) => p.code === "MTD_COMPLY",
    )!;

    // Cancel / unpaid: open checkout, never pay → no ACTIVE
    const cancelClient = await makeClient("mtd-cancel-no-entitle");
    // Use verified MTD registrant for paid path; unpaid uses a separate checkout opener.
    const unpaid = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set({ Authorization: `Bearer ${token}` })
      .send({ planId: comply.id, originUrl: "https://app.test.taxsimba.local" })
      .expect(200);
    expect(unpaid.body.data.sessionId).toBeTruthy();
    expect(provider.last().currency).toBe("gbp");
    expect(provider.last().unit_amount_pence).toBe(2999);
    expect(provider.last().metadata.service_type).toBe("MTD_INCOME_TAX");
    expect(provider.last().metadata.to_package).toBe("MTD_COMPLY");

    const { col } = await import("../../src/db/mongo");
    const user = await col("users").findOne({ email });
    const client = await col("clients").findOne({ user_id: user!.id });
    const beforeActive = await col("client_services")
      .find({ client_id: client!.id, status: "ACTIVE" })
      .toArray();
    expect(beforeActive).toHaveLength(0);

    // Fresh paid checkout for success path
    const paidCheckout = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set({ Authorization: `Bearer ${token}` })
      .send({ planId: comply.id, originUrl: "https://app.test.taxsimba.local" })
      .expect(200);
    const sessionId = paidCheckout.body.data.sessionId as string;
    const paid = provider.pay(sessionId);
    await webhook("checkout.session.completed", {
      id: sessionId,
      payment_status: paid.payment_status,
      payment_intent: paid.payment_intent,
      metadata: provider.last().metadata,
    }).expect(200);
    await webhook("checkout.session.completed", {
      id: sessionId,
      payment_status: paid.payment_status,
      payment_intent: paid.payment_intent,
      metadata: provider.last().metadata,
    }).expect(200);

    const entitlements = await col("client_services")
      .find({ client_id: client!.id, status: "ACTIVE" })
      .toArray();
    expect(entitlements).toHaveLength(1);
    expect(entitlements[0].service_type).toBe("MTD_INCOME_TAX");
    expect(entitlements[0].package_code).toBe("MTD_COMPLY");
    expect(await col("cases").countDocuments({ client_id: client!.id })).toBe(0);

    // Unused cancelClient kept for pattern clarity
    expect(cancelClient.id).toBeTruthy();
  });

  it("9: one account can hold both SA and MTD entitlements", async () => {
    const client = await makeClient("both-services");
    const { activateService } = await import("../../src/domain/packages");
    const { col } = await import("../../src/db/mongo");
    const clientDoc = await col("clients").findOne({ id: client.clientId });
    const userDoc = await col("users").findOne({ id: client.id });
    await activateService(clientDoc!, userDoc!, "SELF_ASSESSMENT", "SIMPLE", {
      reason: "test SA",
    });
    await activateService(clientDoc!, userDoc!, "MTD_INCOME_TAX", "MTD_GROWTH", {
      reason: "test MTD",
    });
    const active = await col("client_services")
      .find({ client_id: client.clientId, status: "ACTIVE" })
      .toArray();
    expect(active).toHaveLength(2);
    const types = active.map((a) => a.service_type).sort();
    expect(types).toEqual(["MTD_INCOME_TAX", "SELF_ASSESSMENT"]);

    const mine = await request(app)
      .get("/api/my-services")
      .set(bearer(client))
      .expect(200);
    const statuses = (mine.body.services as { service_type: string; status: string }[])
      .filter((s) => s.status === "ACTIVE")
      .map((s) => s.service_type)
      .sort();
    expect(statuses).toEqual(["MTD_INCOME_TAX", "SELF_ASSESSMENT"]);
  });

  it("10: admin DTO returns SA, MTD, SA+MTD and pending states", async () => {
    const password = "Tr0ubl3-Kettle-Marsh";
    const pendingMtd = `adm-pend-mtd.${randomUUID().slice(0, 8)}@example.com`;
    const pendingSa = `adm-pend-sa.${randomUUID().slice(0, 8)}@example.com`;
    const superAdmin = await makeUser("SUPER_ADMIN", "mtd-journey-super");

    await request(app)
      .post("/api/compat/auth/register")
      .send({ email: pendingMtd, password, name: "Pend", surname: "Mtd", userRole: "MTD" })
      .expect(200);
    await verifyUser(pendingMtd);

    await request(app)
      .post("/api/compat/auth/register")
      .send({ email: pendingSa, password, name: "Pend", surname: "Sa", userRole: "TAXSIMBA" })
      .expect(200);
    await verifyUser(pendingSa);

    const both = await makeClient("adm-both");
    const { activateService } = await import("../../src/domain/packages");
    const { col } = await import("../../src/db/mongo");
    await col("clients").updateOne(
      { id: both.clientId },
      { $set: { onboarding_intent: "SELF_ASSESSMENT" } },
    );
    const bothClient = await col("clients").findOne({ id: both.clientId });
    const bothUser = await col("users").findOne({ id: both.id });
    await activateService(bothClient!, bothUser!, "SELF_ASSESSMENT", "SMART", { reason: "t" });
    await activateService(bothClient!, bothUser!, "MTD_INCOME_TAX", "MTD_ELITE", { reason: "t" });

    // SUPER_ADMIN sees unmasked emails — required to assert state by identity.
    const list = await request(app)
      .post("/api/compat/admin/clients")
      .set(bearer(superAdmin))
      .send({})
      .expect(200);
    const clients = list.body.data.clients as {
      email: string;
      serviceState: string;
      serviceStateLabel: string;
      onboardingIntent: string | null;
    }[];

    const rowPendMtd = clients.find((c) => c.email === pendingMtd);
    expect(rowPendMtd?.serviceState).toBe("PENDING_MTD");
    expect(rowPendMtd?.serviceStateLabel).toBe("Pending MTD");
    expect(rowPendMtd?.onboardingIntent).toBe("MTD_INCOME_TAX");

    const rowPendSa = clients.find((c) => c.email === pendingSa);
    expect(rowPendSa?.serviceState).toBe("PENDING_SA");
    expect(rowPendSa?.serviceStateLabel).toBe("Pending SA");

    const rowBoth = clients.find((c) => c.email === both.email);
    expect(rowBoth?.serviceState).toBe("SA_AND_MTD");
    expect(rowBoth?.serviceStateLabel).toBe("SA + MTD");
  });

  it("11: invalid/tampered journey values are rejected", async () => {
    await request(app)
      .post("/api/compat/auth/register")
      .send({
        email: `bad-journey.${randomUUID().slice(0, 8)}@example.com`,
        password: "Tr0ubl3-Kettle-Marsh",
        name: "Bad",
        surname: "Journey",
        userRole: "HACKER_ADMIN",
      })
      .expect(400);

    await request(app)
      .post("/api/compat/auth/register")
      .send({
        email: `bad2.${randomUUID().slice(0, 8)}@example.com`,
        password: "Tr0ubl3-Kettle-Marsh",
        name: "Bad",
        surname: "Two",
        userRole: "CLIENT",
      })
      .expect(400);

    const { parseOnboardingIntent } = await import("../../src/domain/onboardingIntent");
    expect(parseOnboardingIntent(null)).toBe("SELF_ASSESSMENT");
    expect(parseOnboardingIntent("MTD")).toBe("MTD_INCOME_TAX");
    expect(parseOnboardingIntent("TAXSIMBA")).toBe("SELF_ASSESSMENT");
    expect(() => parseOnboardingIntent("not-a-journey", { required: true })).toThrow();
  });

  it("12: direct register without journey defaults safely to SA pending", async () => {
    const email = `default-sa.${randomUUID().slice(0, 8)}@example.com`;
    const reg = await request(app)
      .post("/api/compat/auth/register")
      .send({
        email,
        password: "Tr0ubl3-Kettle-Marsh",
        name: "Default",
        surname: "Sa",
      })
      .expect(200);
    expect(reg.body.data.onboardingIntent).toBe("SELF_ASSESSMENT");
    expect(reg.body.data.serviceState).toBe("PENDING_SA");
  });
});
