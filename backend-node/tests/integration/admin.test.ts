/** Stage 6 parity: admin/users, audit/activity, help centre, invites/onboarding. */
import { randomUUID } from "crypto";

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bearer, bootTestApp, dropTestDb, makeClient, makeUser, TestUser } from "../helpers/app";

type Client = TestUser & { clientId: string };

describe("admin, audit, help centre and invitations", () => {
  let app: Express;
  let superAdmin: TestUser;
  let admin: TestUser;
  let accountant: TestUser;
  let client: Client;

  async function makeCase(owner: Client, acc: TestUser | null, patch: Record<string, unknown> = {}) {
    const { col } = await import("../../src/db/mongo");
    const { nowIso } = await import("../../src/domain/workflow");
    const kase = {
      id: randomUUID(),
      case_ref: `SA-${Math.floor(1000 + Math.random() * 8999)}`,
      client_id: owner.clientId,
      client_user_id: owner.id,
      client_name: owner.name,
      service_type: "SELF_ASSESSMENT",
      tax_year: "2024/25",
      status: "ASSIGNED",
      assigned_accountant_id: acc ? acc.id : null,
      next_action_owner: "ACCOUNTANT",
      is_test: false,
      created_at: nowIso(),
      last_updated: nowIso(),
      ...patch,
    };
    await col("cases").insertOne({ ...kase });
    return kase;
  }

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    superAdmin = await makeUser("SUPER_ADMIN", "superadmin");
    admin = await makeUser("ADMIN", "admin");
    accountant = await makeUser("ACCOUNTANT", "accountant");
    client = await makeClient("stage6client");
    const { col } = await import("../../src/db/mongo");
    await col("accountant_profiles").insertOne({
      id: randomUUID(),
      user_id: accountant.id,
      name: accountant.name,
      email: accountant.email,
      specialisms: ["SELF_ASSESSMENT"],
      capacity: 2,
      is_active: true,
    });
  });

  afterAll(async () => {
    await dropTestDb();
  });

  // ------------------------------------------------------------- help centre
  it("seeds the help centre and filters by category and search term", async () => {
    const all = await request(app).get("/api/faqs").set(bearer(client)).expect(200);
    expect(all.body.length).toBeGreaterThanOrEqual(12);
    expect(all.body[0].order).toBe(0);
    expect(all.body.every((f: { is_active: boolean }) => f.is_active)).toBe(true);

    const cats = await request(app).get("/api/faq-categories").set(bearer(client)).expect(200);
    expect(cats.body).toContain("MTD for Income Tax");

    const byCategory = await request(app)
      .get("/api/faqs?category=HMRC Submission")
      .set(bearer(client))
      .expect(200);
    expect(byCategory.body.length).toBe(2);

    const search = await request(app).get("/api/faqs?q=P60").set(bearer(client)).expect(200);
    expect(search.body.length).toBe(1);
    expect(search.body[0].question).toBe("What documents do I need?");
  });

  it("only lets admins author FAQs and hides deleted ones", async () => {
    await request(app)
      .post("/api/faqs")
      .set(bearer(client))
      .send({ category: "Getting Started", question: "q", answer: "a" })
      .expect(403);

    const created = await request(app)
      .post("/api/faqs")
      .set(bearer(admin))
      .send({ category: "Getting Started", question: "Stage 6 question?", answer: "Yes", order: 99 })
      .expect(200);
    expect(created.body.updated_by).toBe(admin.name);

    await request(app)
      .patch(`/api/faqs/${created.body.id}`)
      .set(bearer(superAdmin))
      .send({ category: "Getting Started", question: "Stage 6 question?", answer: "Updated", order: 99 })
      .expect(200);
    await request(app)
      .patch(`/api/faqs/${randomUUID()}`)
      .set(bearer(superAdmin))
      .send({ category: "x", question: "y", answer: "z" })
      .expect(404);

    const found = await request(app)
      .get("/api/faqs?q=stage 6 question")
      .set(bearer(client))
      .expect(200);
    expect(found.body[0].answer).toBe("Updated");

    await request(app).delete(`/api/faqs/${created.body.id}`).set(bearer(admin)).expect(200);
    const gone = await request(app)
      .get("/api/faqs?q=stage 6 question")
      .set(bearer(client))
      .expect(200);
    expect(gone.body).toEqual([]);
  });

  // -------------------------------------------------------------- directory
  it("lists staff for admins, masks client contact for ADMIN and excludes test accounts", async () => {
    const { col } = await import("../../src/db/mongo");
    await col("users").insertOne({
      id: randomUUID(),
      email: "test_excluded@parity.taxsimba.local",
      name: "test account",
      role: "CLIENT",
      is_active: true,
      is_test: true,
      created_at: new Date().toISOString(),
    });

    await request(app).get("/api/users").set(bearer(accountant)).expect(403);

    const asAdmin = await request(app).get("/api/users?role=CLIENT").set(bearer(admin)).expect(200);
    const masked = asAdmin.body.find((u: { id: string }) => u.id === client.id);
    expect(masked.contact_masked).toBe(true);
    expect(masked.email).not.toBe(client.email);
    expect(asAdmin.body.some((u: { is_test?: boolean }) => u.is_test)).toBe(false);

    const asSuper = await request(app)
      .get("/api/users?role=CLIENT")
      .set(bearer(superAdmin))
      .expect(200);
    const full = asSuper.body.find((u: { id: string }) => u.id === client.id);
    expect(full.email).toBe(client.email);
    expect(full.password_hash).toBeUndefined();

    const withTest = await request(app)
      .get("/api/users?role=CLIENT&include_test=true")
      .set(bearer(superAdmin))
      .expect(200);
    expect(withTest.body.some((u: { is_test?: boolean }) => u.is_test)).toBe(true);
  });

  it("creates users and bootstraps client/accountant records", async () => {
    const email = `created.${randomUUID().slice(0, 8)}@parity.taxsimba.local`;
    await request(app)
      .post("/api/users")
      .set(bearer(admin))
      .send({ email, password: "Str0ng!Passphrase", name: "Created", role: "CLIENT" })
      .expect(403);

    const created = await request(app)
      .post("/api/users")
      .set(bearer(superAdmin))
      .send({ email, password: "Str0ng!Passphrase", name: "Created", role: "CLIENT" })
      .expect(200);
    expect(created.body.password_hash).toBeUndefined();
    expect(created.body.is_active).toBe(true);

    const { col } = await import("../../src/db/mongo");
    const record = await col("clients").findOne({ user_id: created.body.id });
    expect(record?.client_ref).toMatch(/^CL-\d{4}$/);
    expect(await col("client_services").countDocuments({ client_id: record?.id })).toBe(2);

    await request(app)
      .post("/api/users")
      .set(bearer(superAdmin))
      .send({ email, password: "Str0ng!Passphrase", name: "Duplicate", role: "CLIENT" })
      .expect(400);
    await request(app)
      .post("/api/users")
      .set(bearer(superAdmin))
      .send({
        email: `role.${randomUUID().slice(0, 8)}@parity.taxsimba.local`,
        password: "Str0ng!Passphrase",
        name: "Bad role",
        role: "OWNER",
      })
      .expect(400);
  });

  it("deactivates staff and reports the cases that need reassignment", async () => {
    const leaver = await makeUser("ACCOUNTANT", "leaver");
    const { col } = await import("../../src/db/mongo");
    await col("accountant_profiles").insertOne({
      id: randomUUID(),
      user_id: leaver.id,
      name: leaver.name,
      email: leaver.email,
      is_active: true,
    });
    await makeCase(client, leaver);
    await makeCase(client, leaver, { status: "COMPLETED" });

    await request(app)
      .patch(`/api/users/${leaver.id}/active?is_active=false`)
      .set(bearer(admin))
      .expect(403);
    await request(app).patch(`/api/users/${leaver.id}/active`).set(bearer(superAdmin)).expect(422);

    const off = await request(app)
      .patch(`/api/users/${leaver.id}/active?is_active=false`)
      .set(bearer(superAdmin))
      .expect(200);
    expect(off.body).toEqual({ ok: true, active_cases_needing_reassignment: 1 });
    expect((await col("users").findOne({ id: leaver.id }))?.is_active).toBe(false);
    expect((await col("accountant_profiles").findOne({ user_id: leaver.id }))?.is_active).toBe(
      false,
    );

    const on = await request(app)
      .patch(`/api/users/${leaver.id}/active?is_active=true`)
      .set(bearer(superAdmin))
      .expect(200);
    expect(on.body.active_cases_needing_reassignment).toBe(0);
    expect((await col("users").findOne({ id: leaver.id }))?.is_active).toBe(true);
  });

  it("reveals client contact only to a Super Admin with a reason, and logs it", async () => {
    await request(app)
      .post(`/api/clients/${client.id}/reveal-contact`)
      .set(bearer(admin))
      .send({ reason: "support call" })
      .expect(403);
    await request(app)
      .post(`/api/clients/${client.id}/reveal-contact`)
      .set(bearer(superAdmin))
      .send({ reason: "   " })
      .expect(400);
    await request(app)
      .post(`/api/clients/${randomUUID()}/reveal-contact`)
      .set(bearer(superAdmin))
      .send({ reason: "support call" })
      .expect(404);

    const revealed = await request(app)
      .post(`/api/clients/${client.id}/reveal-contact`)
      .set(bearer(superAdmin))
      .send({ reason: "support call" })
      .expect(200);
    expect(revealed.body.email).toBe(client.email);

    await request(app).get("/api/contact-access-log").set(bearer(admin)).expect(403);
    const log = await request(app)
      .get("/api/contact-access-log")
      .set(bearer(superAdmin))
      .expect(200);
    expect(log.body[0]).toMatchObject({
      client_user_id: client.id,
      accessed_by: superAdmin.name,
      role: "SUPER_ADMIN",
      reason: "support call",
    });
  });

  // ------------------------------------------------------------------ stats
  it("reports admin, accountant and workload statistics from genuine cases only", async () => {
    const statsClient = await makeClient("statsclient");
    const testClient = await makeClient("statstest", { isTest: true });
    await makeCase(statsClient, accountant, { status: "AWAITING_CLIENT" });
    await makeCase(statsClient, accountant, { status: "READY_FOR_ADMIN_REVIEW" });
    await makeCase(testClient, accountant, { status: "AWAITING_CLIENT", is_test: true });

    await request(app).get("/api/stats/admin").set(bearer(accountant)).expect(403);
    const adminStats = await request(app).get("/api/stats/admin").set(bearer(admin)).expect(200);
    expect(adminStats.body.waiting_client).toBe(1);
    expect(adminStats.body.admin_review).toBe(adminStats.body.awaiting_admin_review);

    await request(app).get("/api/stats/accountant").set(bearer(admin)).expect(403);
    const accStats = await request(app)
      .get("/api/stats/accountant")
      .set(bearer(accountant))
      .expect(200);
    expect(accStats.body.awaiting_client).toBe(1);
    expect(accStats.body.ready_for_admin).toBe(1);

    const workload = await request(app)
      .get("/api/accountants/workload")
      .set(bearer(admin))
      .expect(200);
    const row = workload.body.find((w: { id: string }) => w.id === accountant.id);
    expect(row.capacity).toBe(2);
    expect(row.availability).toBe(row.active_cases < row.capacity ? "Available" : "At Capacity");
    await request(app).get("/api/accountants/workload").set(bearer(accountant)).expect(403);
  });

  it("exposes workflow settings to admins only and the service catalogue to everyone", async () => {
    await request(app).get("/api/workflow/settings").set(bearer(accountant)).expect(403);
    const settings = await request(app)
      .get("/api/workflow/settings")
      .set(bearer(admin))
      .expect(200);
    expect(settings.body.statuses).toContain("ADMIN_REVIEW");
    expect(settings.body.meta.ADMIN_REVIEW).toHaveProperty("owner");
    await request(app).get("/api/services").set(bearer(client)).expect(200);
  });

  it("summarises the business for the Super Admin only", async () => {
    await request(app).get("/api/overview").set(bearer(admin)).expect(403);
    const overview = await request(app).get("/api/overview").set(bearer(superAdmin)).expect(200);
    expect(overview.body.clients.total).toBeGreaterThanOrEqual(1);
    expect(overview.body.revenue).toHaveProperty("successful_payments");
    expect(overview.body.cases.per_accountant.some((a: { name: string }) => a.name)).toBe(true);
  });

  // -------------------------------------------------------------- invitations
  it("invites staff with a single-use link that expires, is revoked on resend and activates once", async () => {
    const email = `invitee.${randomUUID().slice(0, 8)}@parity.taxsimba.local`;
    await request(app)
      .post("/api/staff-invites")
      .set(bearer(admin))
      .send({ name: "Invitee", email })
      .expect(403);
    await request(app)
      .post("/api/staff-invites")
      .set(bearer(superAdmin))
      .send({ name: "Invitee", email, role: "CLIENT" })
      .expect(400);

    const invited = await request(app)
      .post("/api/staff-invites")
      .set(bearer(superAdmin))
      .set("Origin", "https://app.test.taxsimba.local")
      .send({ name: "Invitee", email, role: "ACCOUNTANT", capacity: 9 })
      .expect(200);
    expect(invited.body.user.status).toBe("PENDING");
    expect(invited.body.user.is_active).toBe(false);
    expect(invited.body.setup_link).toContain("https://app.test.taxsimba.local/invite/");
    const firstToken = invited.body.setup_link.split("/invite/")[1];

    await request(app)
      .post("/api/staff-invites")
      .set(bearer(superAdmin))
      .send({ name: "Invitee", email, role: "ACCOUNTANT" })
      .expect(400);

    const directory = await request(app)
      .get("/api/users?role=ACCOUNTANT")
      .set(bearer(superAdmin))
      .expect(200);
    const pending = directory.body.find((u: { id: string }) => u.id === invited.body.user.id);
    expect(pending.invite_expires_at).toBe(invited.body.expires_at);
    expect(JSON.stringify(directory.body)).not.toContain(firstToken);

    const resent = await request(app)
      .post(`/api/staff-invites/${invited.body.user.id}/resend`)
      .set(bearer(superAdmin))
      .set("Origin", "https://app.test.taxsimba.local")
      .expect(200);
    const token = resent.body.setup_link.split("/invite/")[1];
    // Re-issuing revokes the previous link.
    await request(app).get(`/api/auth/invite/${firstToken}`).expect(400);

    const check = await request(app).get(`/api/auth/invite/${token}`).expect(200);
    expect(check.body).toEqual({ name: "Invitee", email, role: "ACCOUNTANT" });

    await request(app)
      .post(`/api/auth/invite/${token}/accept`)
      .send({ password: "short" })
      .expect(400);
    await request(app)
      .post(`/api/auth/invite/${token}/accept`)
      .send({ password: "Str0ng!Passphrase" })
      .expect(200);
    // Single use: the same link cannot be replayed.
    await request(app)
      .post(`/api/auth/invite/${token}/accept`)
      .send({ password: "Str0ng!Passphrase" })
      .expect(400);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "Str0ng!Passphrase" })
      .expect(200);
    expect(login.body.user.role).toBe("ACCOUNTANT");

    const { col } = await import("../../src/db/mongo");
    expect((await col("accountant_profiles").findOne({ user_id: invited.body.user.id }))?.capacity).toBe(
      9,
    );
    await request(app)
      .post(`/api/staff-invites/${invited.body.user.id}/resend`)
      .set(bearer(superAdmin))
      .expect(400);
    await request(app)
      .post(`/api/staff-invites/${randomUUID()}/resend`)
      .set(bearer(superAdmin))
      .expect(404);
  });

  it("rejects an expired invitation", async () => {
    const email = `expired.${randomUUID().slice(0, 8)}@parity.taxsimba.local`;
    const invited = await request(app)
      .post("/api/staff-invites")
      .set(bearer(superAdmin))
      .send({ name: "Expired", email, role: "ADMIN" })
      .expect(200);
    const token = invited.body.setup_link.split("/invite/")[1];
    const { col } = await import("../../src/db/mongo");
    await col("staff_invites").updateOne(
      { user_id: invited.body.user.id, used_at: null },
      { $set: { expires_at: new Date(Date.now() - 1000).toISOString() } },
    );
    await request(app).get(`/api/auth/invite/${token}`).expect(400);
    await request(app)
      .post(`/api/auth/invite/${token}/accept`)
      .send({ password: "Str0ng!Passphrase" })
      .expect(400);
  });

  // -------------------------------------------------------------- audit log
  it("filters the audit log, excludes test-case activity and hides it from non-admins", async () => {
    const auditClient = await makeClient("auditclient");
    const genuine = await makeCase(auditClient, accountant);
    const testCase = await makeCase(auditClient, accountant, { is_test: true });
    const { logActivity } = await import("../../src/domain/workflow");
    await logActivity(genuine.id, "Case assigned to accountant", accountant);
    await logActivity(testCase.id, "Case assigned to accountant", accountant);
    await logActivity(null, "Account level action", superAdmin);

    await request(app).get("/api/audit-log").set(bearer(accountant)).expect(403);
    const log = await request(app).get("/api/audit-log?limit=200").set(bearer(admin)).expect(200);
    const refs = log.body.map((l: { case_id: string | null }) => l.case_id);
    expect(refs).toContain(genuine.id);
    expect(refs).not.toContain(testCase.id);
    expect(log.body[0].created_at >= log.body[log.body.length - 1].created_at).toBe(true);

    const withTest = await request(app)
      .get("/api/audit-log?limit=200&include_test=true")
      .set(bearer(admin))
      .expect(200);
    expect(withTest.body.map((l: { case_id: string | null }) => l.case_id)).toContain(testCase.id);

    const byRef = await request(app)
      .get(`/api/audit-log?case_ref=${genuine.case_ref.toLowerCase()}`)
      .set(bearer(admin))
      .expect(200);
    expect(byRef.body.length).toBeGreaterThan(0);
    expect(byRef.body.every((l: { case_ref: string }) => l.case_ref === genuine.case_ref)).toBe(
      true,
    );

    const byUser = await request(app)
      .get(`/api/audit-log?user_name=${accountant.name}&action=assigned`)
      .set(bearer(admin))
      .expect(200);
    expect(byUser.body.length).toBeGreaterThan(0);
    expect(byUser.body.every((l: { user_name: string }) => l.user_name === accountant.name)).toBe(
      true,
    );

    const future = await request(app)
      .get("/api/audit-log?date_from=2999-01-01")
      .set(bearer(admin))
      .expect(200);
    expect(future.body).toEqual([]);
  });

  it("returns the client Action Required feed with one history entry per completed request", async () => {
    const feedClient = await makeClient("feedclient");
    const kase = await makeCase(feedClient, accountant, {
      status: "AWAITING_CLIENT_APPROVAL",
      external_deadline: "2026-01-31T00:00:00+00:00",
    });
    const { col } = await import("../../src/db/mongo");
    const { nowIso } = await import("../../src/domain/workflow");
    await col("tasks").insertMany([
      {
        id: randomUUID(),
        case_id: kase.id,
        case_ref: kase.case_ref,
        owner_id: feedClient.id,
        name: "Send your P60",
        status: "OPEN",
        created_at: nowIso(),
      },
      {
        id: randomUUID(),
        case_id: kase.id,
        case_ref: kase.case_ref,
        owner_id: feedClient.id,
        name: "Send your bank interest",
        status: "COMPLETED",
        completed_date: nowIso(),
        created_at: nowIso(),
      },
      {
        id: randomUUID(),
        case_id: kase.id,
        case_ref: kase.case_ref,
        owner_id: feedClient.id,
        name: "Send your bank interest",
        status: "COMPLETED",
        completed_date: nowIso(),
        created_at: nowIso(),
      },
    ]);
    await col("offers").insertOne({
      id: randomUUID(),
      client_user_id: feedClient.id,
      status: "PENDING",
      service_type: "MTD_INCOME_TAX",
      service_name: "MTD Essential",
      recommendation_id: randomUUID(),
      created_at: nowIso(),
    });

    await request(app).get("/api/my-actions").set(bearer(admin)).expect(403);
    const feed = await request(app).get("/api/my-actions").set(bearer(feedClient)).expect(200);
    const types = feed.body.outstanding.map((o: { type: string }) => o.type).sort();
    expect(types).toEqual(["APPROVAL", "RECOMMENDATION", "TASK"]);
    expect(feed.body.history.length).toBe(1);
    const task = feed.body.outstanding.find((o: { type: string }) => o.type === "TASK");
    expect(task).toMatchObject({ service_name: "Self Assessment", link: "/tasks" });
    const approval = feed.body.outstanding.find((o: { type: string }) => o.type === "APPROVAL");
    expect(approval.id).toBe(`approve-${kase.id}`);
  });

  it("derives reopen history from the activity log for staff only", async () => {
    const historyClient = await makeClient("historyclient");
    const kase = await makeCase(historyClient, accountant, { status: "COMPLETED" });
    const { logActivity } = await import("../../src/domain/workflow");
    await logActivity(kase.id, "Case completed", accountant, null, {
      previousStatus: "READY_FOR_SUBMISSION",
      newStatus: "COMPLETED",
    });
    await logActivity(kase.id, "Case reopened", admin, null, {
      previousStatus: "COMPLETED",
      newStatus: "IN_PREPARATION",
      comments: "Client sent a late P11D",
    });

    await request(app)
      .get(`/api/cases/${kase.id}/reopen-history`)
      .set(bearer(historyClient))
      .expect(403);
    const history = await request(app)
      .get(`/api/cases/${kase.id}/reopen-history`)
      .set(bearer(admin))
      .expect(200);
    expect(history.body.length).toBe(1);
    expect(history.body[0]).toMatchObject({
      reopened_by: admin.name,
      reopened_by_role: "ADMIN",
      reason: "Client sent a late P11D",
      new_status: "IN_PREPARATION",
    });
    expect(history.body[0].previous_completed_at).not.toBeNull();
    expect(history.body[0].recompleted_at).toBeNull();
  });

  // ---------------------------------------------------------- client profile
  it("returns a masked UTR, applies profile edits everywhere and stores preferences", async () => {
    const profileClient = await makeClient("profileclient");
    const kase = await makeCase(profileClient, accountant);
    const { col } = await import("../../src/db/mongo");
    await col("clients").updateOne(
      { user_id: profileClient.id },
      { $set: { utr: "1234567890" } },
    );

    await request(app).get("/api/my-profile").set(bearer(admin)).expect(403);
    const profile = await request(app)
      .get("/api/my-profile")
      .set(bearer(profileClient))
      .expect(200);
    expect(profile.body.utr_masked).toBe("******7890");
    expect(profile.body.utr_on_record).toBe(true);
    expect(profile.body.preferences.payment_update).toBe(true);

    const revealed = await request(app)
      .get("/api/my-profile/utr")
      .set(bearer(profileClient))
      .expect(200);
    expect(revealed.body.utr).toBe("1234567890");

    const updated = await request(app)
      .patch("/api/my-profile")
      .set(bearer(profileClient))
      .send({ name: "Renamed Client", phone: "07123456789" })
      .expect(200);
    expect(updated.body.name).toBe("Renamed Client");
    expect(updated.body.phone).toBe("07123456789");
    expect((await col("cases").findOne({ id: kase.id }))?.client_name).toBe("Renamed Client");

    const prefs = await request(app)
      .patch("/api/my-preferences")
      .set(bearer(profileClient))
      .send({ preferences: { payment_update: false } })
      .expect(200);
    expect(prefs.body.preferences).toMatchObject({
      payment_update: false,
      accountant_message: true,
    });
  });

  it("queues one email change and one data request of each kind", async () => {
    const requestClient = await makeClient("requestclient");
    await request(app)
      .post("/api/my-profile/email-change")
      .set(bearer(requestClient))
      .send({ new_email: "not-an-email" })
      .expect(400);
    await request(app)
      .post("/api/my-profile/email-change")
      .set(bearer(requestClient))
      .send({ new_email: admin.email })
      .expect(400);
    const first = await request(app)
      .post("/api/my-profile/email-change")
      .set(bearer(requestClient))
      .send({ new_email: "new.address@parity.taxsimba.local" })
      .expect(200);
    expect(first.body.duplicate_prevented).toBeUndefined();
    const second = await request(app)
      .post("/api/my-profile/email-change")
      .set(bearer(requestClient))
      .send({ new_email: "other.address@parity.taxsimba.local" })
      .expect(200);
    expect(second.body.duplicate_prevented).toBe(true);
    const profile = await request(app)
      .get("/api/my-profile")
      .set(bearer(requestClient))
      .expect(200);
    expect(profile.body.pending_email_change).toBe("other.address@parity.taxsimba.local");

    await request(app)
      .post("/api/my-data-requests")
      .set(bearer(requestClient))
      .send({ kind: "DELETE_EVERYTHING" })
      .expect(400);
    await request(app)
      .post("/api/my-data-requests")
      .set(bearer(requestClient))
      .send({ kind: "DATA_EXPORT", reason: "records" })
      .expect(200);
    const duplicate = await request(app)
      .post("/api/my-data-requests")
      .set(bearer(requestClient))
      .send({ kind: "DATA_EXPORT" })
      .expect(200);
    expect(duplicate.body.duplicate_prevented).toBe(true);
    const mine = await request(app)
      .get("/api/my-data-requests")
      .set(bearer(requestClient))
      .expect(200);
    expect(mine.body.length).toBe(1);
  });

  it("changes a password, ends other sessions and refuses a wrong current password", async () => {
    const email = `pwd.${randomUUID().slice(0, 8)}@parity.taxsimba.local`;
    await request(app)
      .post("/api/users")
      .set(bearer(superAdmin))
      .send({ email, password: "Str0ng!Passphrase", name: "Password User", role: "CLIENT" })
      .expect(200);
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "Str0ng!Passphrase" })
      .expect(200);
    const token = login.body.access_token as string;

    await request(app)
      .post("/api/my-profile/change-password")
      .set({ Authorization: `Bearer ${token}` })
      .send({ current_password: "wrong", new_password: "An0ther!Passphrase" })
      .expect(400);
    await request(app)
      .post("/api/my-profile/change-password")
      .set({ Authorization: `Bearer ${token}` })
      .send({ current_password: "Str0ng!Passphrase", new_password: "short1!" })
      .expect(400);
    await request(app)
      .post("/api/my-profile/change-password")
      .set({ Authorization: `Bearer ${token}` })
      .send({ current_password: "Str0ng!Passphrase", new_password: "An0ther!Passphrase" })
      .expect(200);

    const { col } = await import("../../src/db/mongo");
    const user = await col("users").findOne({ email });
    expect(await col("refresh_tokens").countDocuments({ user_id: user?.id, revoked_at: null })).toBe(
      0,
    );
    await request(app)
      .post("/api/auth/login")
      .send({ email, password: "An0ther!Passphrase" })
      .expect(200);
  });

  // --------------------------------------------------------- service issues
  it("scopes service issues by role and only lets admins resolve them", async () => {
    const issueClient = await makeClient("issueclient");
    const kase = await makeCase(issueClient, accountant);
    const other = await makeClient("otherclient");

    await request(app)
      .post("/api/service-issues")
      .set(bearer(issueClient))
      .send({ category: "Service", subject: "  ", description: "  " })
      .expect(400);
    const issue = await request(app)
      .post("/api/service-issues")
      .set(bearer(issueClient))
      .send({
        category: "Service",
        subject: "Slow response",
        description: "No reply for a week",
        case_id: kase.id,
      })
      .expect(200);
    expect(issue.body).toMatchObject({ status: "OPEN", case_ref: kase.case_ref });

    const mine = await request(app)
      .get("/api/service-issues")
      .set(bearer(issueClient))
      .expect(200);
    expect(mine.body.length).toBe(1);
    const others = await request(app).get("/api/service-issues").set(bearer(other)).expect(200);
    expect(others.body).toEqual([]);

    const staffView = await request(app)
      .get("/api/service-issues")
      .set(bearer(accountant))
      .expect(200);
    const seen = staffView.body.find((r: { id: string }) => r.id === issue.body.id);
    expect(seen).toMatchObject({ status: "OPEN" });
    expect(seen.description).toBeUndefined();
    expect(seen.client_name).toBeUndefined();

    await request(app)
      .patch(`/api/service-issues/${issue.body.id}`)
      .set(bearer(accountant))
      .send({ status: "RESOLVED", resolution: "done" })
      .expect(403);
    await request(app)
      .patch(`/api/service-issues/${issue.body.id}`)
      .set(bearer(admin))
      .send({ status: "CLOSED" })
      .expect(400);
    await request(app)
      .patch(`/api/service-issues/${issue.body.id}`)
      .set(bearer(admin))
      .send({ status: "RESOLVED" })
      .expect(400);
    const resolved = await request(app)
      .patch(`/api/service-issues/${issue.body.id}`)
      .set(bearer(admin))
      .send({ status: "RESOLVED", resolution: "Apologies — accountant reassigned" })
      .expect(200);
    expect(resolved.body).toMatchObject({
      status: "RESOLVED",
      resolved_by_name: admin.name,
      handled_by_name: admin.name,
    });
    expect(resolved.body.resolved_at).not.toBeNull();
    await request(app)
      .patch(`/api/service-issues/${randomUUID()}`)
      .set(bearer(admin))
      .send({ status: "OPEN" })
      .expect(404);
  });
});
