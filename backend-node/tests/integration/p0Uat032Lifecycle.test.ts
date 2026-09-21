/**
 * TS-UAT-032 — purchase/activation must not mint Tax Manager cases.
 * Cases + assignment notifications only after verified + ACTIVE entitlement +
 * successful application/questionnaire submit.
 */
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  bearer,
  bootTestApp,
  dropTestDb,
  makeClient,
  makeUser,
} from "../helpers/app";
import { FakePaymentProvider, WEBHOOK_SIGNATURE } from "../helpers/payments";

describe("TS-UAT-032 lifecycle — entitlement vs case creation", () => {
  let app: Express;
  let admin: Awaited<ReturnType<typeof makeUser>>;
  let provider: FakePaymentProvider;

  function webhook(type: string, object: Record<string, unknown>) {
    return request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", WEBHOOK_SIGNATURE)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ type, object }));
  }

  async function buy(
    client: Awaited<ReturnType<typeof makeClient>>,
    serviceType: string,
    packageCode: string,
  ): Promise<string> {
    const res = await request(app)
      .post("/api/payments/service-checkout")
      .set(bearer(client))
      .send({
        service_type: serviceType,
        package_code: packageCode,
        origin_url: "https://app.test.taxsimba.local",
      })
      .expect(200);
    const paid = provider.pay(res.body.session_id);
    await webhook("checkout.session.completed", {
      id: res.body.session_id,
      payment_status: paid.payment_status,
      payment_intent: paid.payment_intent,
    }).expect(200);
    return res.body.session_id as string;
  }

  async function assignmentNotifications(): Promise<
    Array<{ title: string; case_id?: string | null }>
  > {
    const res = await request(app).get("/api/notifications").set(bearer(admin)).expect(200);
    return (res.body as Array<{ title: string; case_id?: string | null }>).filter((n) =>
      /assign an accountant/i.test(n.title),
    );
  }

  async function caseCountForUser(userId: string): Promise<number> {
    const { col } = await import("../../src/db/mongo");
    return col("cases").countDocuments({ client_user_id: userId });
  }

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    const { ensurePhase1bData } = await import("../../src/domain/packages");
    await ensurePhase1bData();
    const { setPaymentProvider } = await import("../../src/services/payments");
    provider = new FakePaymentProvider();
    setPaymentProvider(provider);
    admin = await makeUser("ADMIN", "uat032admin");
  });

  afterAll(async () => {
    const { setPaymentProvider } = await import("../../src/services/payments");
    setPaymentProvider(null);
    await dropTestDb();
  });

  it("A: registration creates zero cases", async () => {
    const email = `reg.lifecycle.${Date.now()}@uat.taxsimba.test`;
    await request(app)
      .post("/api/compat/auth/register")
      .send({
        name: "Reg Lifecycle",
        email,
        password: "RegLife1!",
        mobile: "07700900111",
      })
      .expect(200);
    const { col } = await import("../../src/db/mongo");
    const user = await col("users").findOne({ email });
    expect(user).toBeTruthy();
    expect(await caseCountForUser(user!.id as string)).toBe(0);
  });

  it("B: verification creates zero cases", async () => {
    const email = `verify.lifecycle.${Date.now()}@uat.taxsimba.test`;
    await request(app)
      .post("/api/compat/auth/register")
      .send({
        name: "Verify Lifecycle",
        email,
        password: "VerifyLife1!",
        mobile: "07700900112",
      })
      .expect(200);
    const { col } = await import("../../src/db/mongo");
    const { issueEmailVerification } = await import("../../src/services/emailVerification");
    const user = await col("users").findOne({ email });
    expect(user).toBeTruthy();
    const issued = await issueEmailVerification(user!);
    await request(app)
      .post(`/api/auth/verify-email?token=${encodeURIComponent(issued.token)}`)
      .expect(200);
    const after = await col("users").findOne({ id: user!.id });
    expect(after?.email_verified_at).toBeTruthy();
    expect(await caseCountForUser(user!.id as string)).toBe(0);
  });

  it("C: purchase/activation creates ACTIVE entitlement but zero cases and zero assignment notifications", async () => {
    const client = await makeClient("uat032buy");
    const beforeNotes = await assignmentNotifications();
    await buy(client, "SELF_ASSESSMENT", "SIMPLE");

    const svc = await request(app).get("/api/my-services").set(bearer(client)).expect(200);
    const sa = svc.body.services.find(
      (s: { service_type: string }) => s.service_type === "SELF_ASSESSMENT",
    );
    expect(sa.status).toBe("ACTIVE");
    expect(sa.package_code).toBe("SIMPLE");
    expect(sa.cases ?? []).toHaveLength(0);
    expect(await caseCountForUser(client.id)).toBe(0);

    const afterNotes = await assignmentNotifications();
    expect(afterNotes.length).toBe(beforeNotes.length);
  });

  it("D: submitted application with verified email and ACTIVE entitlement creates exactly one case and one notification", async () => {
    const client = await makeClient("uat032apply");
    await buy(client, "SELF_ASSESSMENT", "SMART");
    const beforeNotes = await assignmentNotifications();

    const applied = await request(app)
      .post("/api/compat/client/apply-tax-return")
      .set(bearer(client))
      .field("category", "taxSimba")
      .expect(201);
    expect(applied.body.data.createdFromApplication).toBe(true);
    expect(applied.body.data.taxReturn.status).toBe("AWAITING_ASSIGNMENT");
    expect(await caseCountForUser(client.id)).toBe(1);

    const afterNotes = await assignmentNotifications();
    expect(afterNotes.length).toBe(beforeNotes.length + 1);
    expect(afterNotes.some((n) => /application submitted/i.test(n.title))).toBe(true);
  });

  it("E: repeat submission creates no duplicate case or notification", async () => {
    const client = await makeClient("uat032repeat");
    await buy(client, "SELF_ASSESSMENT", "SIMPLE");
    await request(app)
      .post("/api/compat/client/apply-tax-return")
      .set(bearer(client))
      .field("category", "taxSimba")
      .expect(201);
    const afterFirst = await assignmentNotifications();
    const caseId = (
      await request(app).get("/api/my-services").set(bearer(client)).expect(200)
    ).body.services.find((s: { service_type: string }) => s.service_type === "SELF_ASSESSMENT")
      .cases[0].id;

    const second = await request(app)
      .post("/api/compat/client/apply-tax-return")
      .set(bearer(client))
      .field("category", "taxSimba")
      .expect(201);
    expect(second.body.data.createdFromApplication).toBe(false);
    expect(second.body.data.taxReturn.id || second.body.data.taxReturn.tax_return_id).toBe(
      caseId,
    );
    expect(await caseCountForUser(client.id)).toBe(1);
    expect((await assignmentNotifications()).length).toBe(afterFirst.length);
  });

  it("F: activation/webhook retry creates no case or notification", async () => {
    const client = await makeClient("uat032retry");
    const sessionId = await buy(client, "SELF_ASSESSMENT", "SIMPLE");
    expect(await caseCountForUser(client.id)).toBe(0);
    const beforeNotes = await assignmentNotifications();

    const paid = provider.pay(sessionId);
    await webhook("checkout.session.completed", {
      id: sessionId,
      payment_status: paid.payment_status,
      payment_intent: paid.payment_intent,
    }).expect(200);

    const { activateService } = await import("../../src/domain/packages");
    const { col } = await import("../../src/db/mongo");
    const clientDoc = await col("clients").findOne({ id: client.clientId });
    const userDoc = await col("users").findOne({ id: client.id });
    const result = await activateService(clientDoc!, userDoc!, "SELF_ASSESSMENT", "SIMPLE", {
      reason: "retry activation",
    });
    expect(result.created_case).toBe(false);
    expect(result.case).toBeNull();
    expect(await caseCountForUser(client.id)).toBe(0);
    expect((await assignmentNotifications()).length).toBe(beforeNotes.length);
  });

  it("G: unverified submission is rejected", async () => {
    const unverified = await makeClient("uat032unverified", { emailVerified: false });
    // Force entitlement without case (activateService never mints cases).
    const { activateService } = await import("../../src/domain/packages");
    const { col } = await import("../../src/db/mongo");
    const clientDoc = await col("clients").findOne({ id: unverified.clientId });
    const userDoc = await col("users").findOne({ id: unverified.id });
    await activateService(clientDoc!, userDoc!, "SELF_ASSESSMENT", "SIMPLE", {
      reason: "entitle unverified",
    });

    await request(app)
      .post("/api/compat/client/apply-tax-return")
      .set(bearer(unverified))
      .field("category", "taxSimba")
      .expect(403);
    expect(await caseCountForUser(unverified.id)).toBe(0);
  });

  it("H: submission without the correct ACTIVE entitlement is rejected", async () => {
    const unpaid = await makeClient("uat032unpaid");
    await request(app)
      .post("/api/compat/client/apply-tax-return")
      .set(bearer(unpaid))
      .field("category", "taxSimba")
      .expect(403);
    expect(await caseCountForUser(unpaid.id)).toBe(0);

    // Wrong service entitlement (MTD only) cannot open SA case via application.
    const mtdOnly = await makeClient("uat032mtdonly");
    await buy(mtdOnly, "MTD_INCOME_TAX", "MTD_COMPLY");
    await request(app)
      .post("/api/compat/client/apply-tax-return")
      .set(bearer(mtdOnly))
      .field("category", "taxSimba")
      .expect(403);
    expect(await caseCountForUser(mtdOnly.id)).toBe(0);
  });

  it("I: seeded/demo paths cannot produce misleading premature cases when SEED_DEMO_DATA=false", async () => {
    expect(process.env.SEED_DEMO_DATA).toBe("false");
    const { col } = await import("../../src/db/mongo");
    // Demo seed accounts from domain/seed.ts must not exist under SEED_DEMO_DATA=false.
    const demo = await col("users").findOne({ email: "clienta@example.com" });
    expect(demo).toBeNull();
    const demoCases = await col("cases").countDocuments({
      client_name: { $in: ["Client A", "Client B"] },
    });
    expect(demoCases).toBe(0);

    // activateService alone (seed-style entitlement) never mints a case.
    const client = await makeClient("uat032seedpath");
    const { activateService } = await import("../../src/domain/packages");
    const clientDoc = await col("clients").findOne({ id: client.clientId });
    const userDoc = await col("users").findOne({ id: client.id });
    const result = await activateService(clientDoc!, userDoc!, "SELF_ASSESSMENT", "SIMPLE", {
      reason: "Staging UAT seed entitlement",
    });
    expect(result.created_case).toBe(false);
    expect(await caseCountForUser(client.id)).toBe(0);
  });

  it("staff create without manual_creation_reason is rejected; with reason is audited", async () => {
    const client = await makeClient("uat032staff");
    await buy(client, "SELF_ASSESSMENT", "SIMPLE");

    await request(app)
      .post("/api/cases")
      .set(bearer(admin))
      .send({
        client_user_id: client.id,
        tax_year: "2030/31",
        service_type: "SELF_ASSESSMENT",
      })
      .expect(400);

    const created = await request(app)
      .post("/api/cases")
      .set(bearer(admin))
      .send({
        client_user_id: client.id,
        tax_year: "2030/31",
        service_type: "SELF_ASSESSMENT",
        manual_creation_reason: "Authorised UAT manual case override",
      })
      .expect(200);
    expect(created.body.created_from).toBe("STAFF_MANUAL");
    expect(created.body.manual_creation_reason).toMatch(/Authorised UAT/);
  });
});
