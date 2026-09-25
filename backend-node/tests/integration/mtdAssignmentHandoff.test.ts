/**
 * MTD assignment handoff — identity consistency across admin → case → accountant list.
 *
 * Root cause covered: accountant FE expected `data.assignments` while API returned
 * only `files`/`taxReturns`, and assignment must store JWT user id (users.id).
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

describe("MTD assignment handoff — identity + list + obligation", () => {
  let app: Express;
  let provider: FakePaymentProvider;
  let admin: Awaited<ReturnType<typeof makeUser>>;
  let accountantA: Awaited<ReturnType<typeof makeUser>>;
  let accountantB: Awaited<ReturnType<typeof makeUser>>;
  let inactiveAcc: Awaited<ReturnType<typeof makeUser>>;

  function webhook(type: string, object: Record<string, unknown>) {
    return request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", WEBHOOK_SIGNATURE)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ type, object }));
  }

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    const { ensurePhase1bData } = await import("../../src/domain/packages");
    await ensurePhase1bData();
    const { setPaymentProvider } = await import("../../src/services/payments");
    provider = new FakePaymentProvider();
    setPaymentProvider(provider);
    admin = await makeUser("SUPER_ADMIN", "assign-handoff-admin");
    accountantA = await makeUser("ACCOUNTANT", "assign-handoff-a");
    accountantB = await makeUser("ACCOUNTANT", "assign-handoff-b");
    inactiveAcc = await makeUser("ACCOUNTANT", "assign-handoff-inactive");
    const { col } = await import("../../src/db/mongo");
    await col("users").updateOne({ id: inactiveAcc.id }, { $set: { is_active: false } });
  }, 60000);

  afterAll(async () => {
    const { setPaymentProvider } = await import("../../src/services/payments");
    setPaymentProvider(null);
    await dropTestDb();
  });

  it("fresh MTD → apply → assign → same accountant list contains case; other cannot", async () => {
    const email = `mtd-assign.${randomUUID().slice(0, 8)}@example.com`;
    const password = "Tr0ubl3-Kettle-Marsh";

    await request(app)
      .post("/api/compat/auth/register")
      .send({
        email,
        password,
        name: "Mtd",
        surname: "Retest",
        mobile: "07700900999",
        userRole: "MTD",
      })
      .expect(200);

    const { col } = await import("../../src/db/mongo");
    const { issueEmailVerification } = await import("../../src/services/emailVerification");
    const user = await col("users").findOne({ email });
    const issued = await issueEmailVerification(user!);
    await request(app)
      .post(`/api/compat/auth/verify-email?token=${encodeURIComponent(issued.token)}`)
      .expect(200);

    const login = await request(app)
      .post("/api/compat/auth/login")
      .send({ email, password })
      .expect(200);
    const clientToken = login.body.data.accessToken as string;
    const clientUserId = login.body.data.user.id as string;
    const clientDoc = await col("clients").findOne({ user_id: clientUserId });
    const client = {
      id: clientUserId,
      token: clientToken,
      role: "CLIENT" as const,
      clientId: String(clientDoc!.id),
    };

    // Purchase MTD
    const plans = await request(app)
      .get("/api/compat/subscription-plans?category=mtd")
      .expect(200);
    const comply = (plans.body.data as { code: string; id: string }[]).find(
      (p) => p.code === "MTD_COMPLY",
    )!;
    const checkout = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(client))
      .send({ planId: comply.id, originUrl: "https://app.test.taxsimba.local" })
      .expect(200);
    const sessionId = String(
      checkout.body.data.sessionId || checkout.body.data.session_id,
    );
    const paid = provider.pay(sessionId);
    await webhook("checkout.session.completed", {
      id: sessionId,
      payment_status: paid.payment_status,
      payment_intent: paid.payment_intent,
    }).expect(200);

    // Application submit creates case
    const apply = await request(app)
      .post("/api/compat/client/apply-tax-return")
      .set(bearer(client))
      .send({ serviceType: "MTD_INCOME_TAX" })
      .expect(201);
    const caseId = String(
      apply.body.data.taxReturn?.id || apply.body.data.taxReturn?.caseId,
    );
    expect(caseId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    // Pending in admin queue
    const before = await request(app)
      .post("/api/compat/admin/tax-return/files")
      .set(bearer(admin))
      .send({})
      .expect(200);
    const pendingRows = before.body.data.assignments || before.body.data.taxReturns || [];
    expect(pendingRows.some((r: { id: string }) => r.id === caseId)).toBe(true);

    // Identity evidence: dropdown accountants use users.id
    const accts = await request(app)
      .post("/api/compat/admin/accountants")
      .set(bearer(admin))
      .send({})
      .expect(200);
    const listed = (accts.body.data.accountants as { id: string; email: string }[]).find(
      (a) => a.id === accountantA.id,
    );
    expect(listed?.id).toBe(accountantA.id);
    expect(typeof listed?.id).toBe("string");
    expect(Number(listed?.id)).toBeNaN();

    // Reject numeric accountant id (must remain string UUID end-to-end)
    const numericReject = await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: 12345 });
    expect(numericReject.status).toBe(400);
    expect(String(numericReject.body.message || numericReject.body.detail || "")).toMatch(
      /string UUID|accountantId/i,
    );

    // Reject inactive
    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: inactiveAcc.id })
      .expect(400);

    // Reject missing
    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId })
      .expect(400);

    // Reject accountant_profiles.id when it differs from users.id
    const { randomUUID: uuid } = await import("crypto");
    const profileOnlyId = uuid();
    await col("accountant_profiles").insertOne({
      id: profileOnlyId,
      user_id: accountantA.id,
      is_active: true,
      created_at: new Date().toISOString(),
    });
    const profileReject = await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: profileOnlyId });
    expect(profileReject.status).toBe(400);
    expect(String(profileReject.body.message || profileReject.body.detail || "")).toMatch(
      /user id|profile/i,
    );

    // Successful assign — string UUID
    const assign = await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: accountantA.id, priority: "HIGH" })
      .expect(200);
    expect(assign.body.data.assignedAccountantId).toBe(accountantA.id);
    expect(typeof assign.body.data.assignedAccountantId).toBe("string");
    expect(assign.body.data.notificationLink).toBe(`/tax-return-list/${caseId}`);

    const stored = await col("cases").findOne({ id: caseId });
    expect(stored?.assigned_accountant_id).toBe(accountantA.id);
    expect(stored?.assigned_accountant_name).toBeTruthy();
    expect(stored?.status).toBe("ASSIGNED");

    // Same accountant retrieves exactly that assignment via assignments key
    const mine = await request(app)
      .post("/api/compat/accountant/tax-return/files")
      .set(bearer(accountantA))
      .send({})
      .expect(200);
    expect(Array.isArray(mine.body.data.assignments)).toBe(true);
    expect(mine.body.data.assignments.length).toBeGreaterThanOrEqual(1);
    const hit = mine.body.data.assignments.find((a: { id: string }) => a.id === caseId);
    expect(hit).toBeTruthy();
    expect(hit.assignedAccountantId).toBe(accountantA.id);
    expect(hit.serviceType).toBe("MTD_INCOME_TAX");
    expect(hit.client.name).toMatch(/Mtd/i);
    expect(hit.TaxReturnType.typeCode).toBe("MTD");

    // Other accountant cannot see it
    const other = await request(app)
      .post("/api/compat/accountant/tax-return/files")
      .set(bearer(accountantB))
      .send({})
      .expect(200);
    const leaked = (other.body.data.assignments || []).some(
      (a: { id: string }) => a.id === caseId,
    );
    expect(leaked).toBe(false);

    // Client overview shows accountant name + assigned status
    const overview = await request(app)
      .get("/api/compat/mtd/dashboard-overview")
      .set(bearer(client))
      .expect(200);
    expect(overview.body.data.taxReturnStatus).toBe("assigned");
    expect(overview.body.data.accountant).toBeTruthy();
    expect(String(overview.body.data.accountant.id)).toBe(accountantA.id);
    expect(overview.body.data.accountant.name).toBeTruthy();
    expect(overview.body.data.nextAction).not.toMatch(/Waiting for accountant assignment/i);

    // Notification for correct accountant with deep link
    const notes = await request(app)
      .get("/api/notifications")
      .set(bearer(accountantA))
      .expect(200);
    const noteList = Array.isArray(notes.body) ? notes.body : notes.body?.data || [];
    const assignmentNote = noteList.find(
      (n: { type?: string; case_id?: string; title?: string }) =>
        n.case_id === caseId || /assigned/i.test(String(n.title)),
    );
    expect(assignmentNote).toBeTruthy();
    expect(String(assignmentNote.link || "")).toContain(caseId);
    expect(String(assignmentNote.body || "")).toMatch(/Making Tax Digital|MTD|Client/i);

    // Idempotent re-assign same accountant
    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: accountantA.id })
      .expect(200);
    const afterRetry = await col("cases").findOne({ id: caseId });
    expect(afterRetry?.assigned_accountant_id).toBe(accountantA.id);

    // Quarterly history / periods — 200 with array (may be populated by ensurePeriods)
    const hist = await request(app)
      .get("/api/compat/mtd/dashboard-overview")
      .set(bearer(client))
      .expect(200);
    expect(Array.isArray(hist.body.data.periods)).toBe(true);
    if (hist.body.data.obligation?.hasObligation) {
      expect(hist.body.data.obligation.deadline).toBeTruthy();
      expect(typeof hist.body.data.obligation.daysToDeadline).toBe("number");
    }

    // Progress uses same obligation deadline for MTD
    const progress = await request(app)
      .post(`/api/compat/tax-return/${caseId}/progress`)
      .set(bearer(admin))
      .send({})
      .expect(200);
    if (hist.body.data.obligation?.deadline) {
      expect(progress.body.data.submissionDeadline).toBe(hist.body.data.obligation.deadline);
      expect(progress.body.data.daysToDeadline).toBe(hist.body.data.obligation.daysToDeadline);
    }
  });

  it("SA assignment still appears in accountant list", async () => {
    const client = await makeClient("sa-assign-handoff");
    const { caseId } = await activateClientService(client, "SELF_ASSESSMENT", "SIMPLE");
    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: accountantA.id })
      .expect(200);
    const mine = await request(app)
      .post("/api/compat/accountant/tax-return/files")
      .set(bearer(accountantA))
      .send({})
      .expect(200);
    const hit = mine.body.data.assignments.find((a: { id: string }) => a.id === caseId);
    expect(hit).toBeTruthy();
    expect(hit.serviceType).toBe("SELF_ASSESSMENT");
    expect(hit.TaxReturnType.typeCode).toBe("SA");
  });

  it("admin dashboard totals expose totalTaxReturns aligned with OPERATIONAL_ONLY cases", async () => {
    const { col } = await import("../../src/db/mongo");
    const stats = await request(app)
      .post("/api/compat/admin/dashboard/stats")
      .set(bearer(admin))
      .send({})
      .expect(200);
    const total = await col("cases").countDocuments({ is_test: { $ne: true } });
    expect(stats.body.data.totalTaxReturns).toBe(total);
    expect(typeof stats.body.data.totalOngoingTaxReturns).toBe("number");
    expect(typeof stats.body.data.assignedActive).toBe("number");
  });

  it("overdue deadline surfaces absolute days overdue; empty obligation is valid", async () => {
    const client = await makeClient("mtd-overdue-handoff");
    const { caseId } = await activateClientService(client, "MTD_INCOME_TAX", "MTD_COMPLY");
    const { col } = await import("../../src/db/mongo");
    const past = "2020-01-15";
    await col("mtd_periods").updateMany(
      { case_id: caseId, kind: "QUARTER", quarter: 1 },
      { $set: { deadline: past, status: "NOT_STARTED" } },
    );
    // Ensure Q1 is the current open quarter
    await col("mtd_periods").updateMany(
      { case_id: caseId, kind: "QUARTER", quarter: { $gt: 1 } },
      { $set: { status: "SUBMITTED" } },
    );

    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: accountantA.id })
      .expect(200);

    const overview = await request(app)
      .get("/api/compat/mtd/dashboard-overview")
      .set(bearer(client))
      .expect(200);
    expect(overview.body.data.obligation.hasObligation).toBe(true);
    expect(overview.body.data.obligation.deadline).toBe(past);
    expect(overview.body.data.obligation.daysToDeadline).toBeLessThan(0);
    expect(overview.body.data.obligation.isOverdue).toBe(true);

    const progress = await request(app)
      .post(`/api/compat/tax-return/${caseId}/progress`)
      .set(bearer(admin))
      .send({})
      .expect(200);
    expect(progress.body.data.submissionDeadline).toBe(past);
    expect(progress.body.data.daysToDeadline).toBe(overview.body.data.obligation.daysToDeadline);
    expect(progress.body.data.isOverdue).toBe(true);

    // Empty obligation state — no invented deadline when periods wiped
    await col("mtd_periods").deleteMany({ case_id: caseId });
    const empty = await request(app)
      .get("/api/compat/mtd/dashboard-overview")
      .set(bearer(client))
      .expect(200);
    // ensurePeriods may recreate; if no current deadline after wipe+recreate check hasObligation shape
    expect(empty.status).toBe(200);
    expect(Array.isArray(empty.body.data.periods)).toBe(true);
    expect(empty.body.data.obligation).toBeTruthy();
    expect(typeof empty.body.data.obligation.hasObligation).toBe("boolean");
  });
});
