/** Transactional email and the scheduled reminder worker. */
import { randomUUID } from "crypto";

import type { Express } from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { bearer, bootTestApp, dropTestDb, makeClient, makeUser, TestUser } from "../helpers/app";

type Client = TestUser & { clientId: string };

interface Sent {
  to: string;
  subject: string;
  text: string;
}

class RecordingProvider {
  readonly name = "recording";

  sent: Sent[] = [];

  failNext = 0;

  async send(message: Sent): Promise<void> {
    if (this.failNext > 0) {
      this.failNext -= 1;
      throw new Error("provider unavailable");
    }
    this.sent.push(message);
  }
}

describe("transactional email and reminders", () => {
  let app: Express;
  let superAdmin: TestUser;
  let client: Client;
  let provider: RecordingProvider;

  beforeAll(async () => {
    process.env.EMAIL_DRIVER = "smtp"; // any non-"none" driver; the provider below replaces it
    process.env.APP_BASE_URL = "https://app.test.taxsimba.local";
    ({ app } = await bootTestApp());
    superAdmin = await makeUser("SUPER_ADMIN", "superadmin");
    client = await makeClient("emailclient");
  });

  afterEach(async () => {
    const { setEmailProvider } = await import("../../src/services/email");
    setEmailProvider(null);
  });

  afterAll(async () => {
    delete process.env.EMAIL_DRIVER;
    await dropTestDb();
  });

  async function useRecording(): Promise<RecordingProvider> {
    const { setEmailProvider } = await import("../../src/services/email");
    provider = new RecordingProvider();
    setEmailProvider(provider);
    return provider;
  }

  /** Delivery is fire-and-forget, so wait for the attempt to be recorded before asserting on it. */
  async function waitForAttempt(subject: string): Promise<void> {
    const { col } = await import("../../src/db/mongo");
    for (let i = 0; i < 100; i += 1) {
      const row = await col("email_messages").findOne({ subject });
      if (row && (row.attempts as number) >= 1) return;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`no delivery attempt recorded for '${subject}'`);
  }

  async function makeCase(patch: Record<string, unknown> = {}) {
    const { col } = await import("../../src/db/mongo");
    const { nowIso } = await import("../../src/domain/workflow");
    const kase = {
      id: randomUUID(),
      case_ref: `SA-${Math.floor(1000 + Math.random() * 8999)}`,
      client_id: client.clientId,
      client_user_id: client.id,
      client_name: client.name,
      service_type: "SELF_ASSESSMENT",
      tax_year: "2024/25",
      status: "AWAITING_CLIENT",
      next_action: "Please upload your bank statements",
      next_action_owner: "CLIENT",
      is_test: false,
      created_at: nowIso(),
      last_updated: nowIso(),
      ...patch,
    };
    await col("cases").insertOne({ ...kase });
    return kase;
  }

  it("emails the recipient of an in-app notification", async () => {
    const rec = await useRecording();
    const { notify } = await import("../../src/domain/workflow");
    await notify(client.id, "Your calculation is ready", "Please review it.", null, "/my-return", "REVIEW");
    expect(rec.sent).toHaveLength(1);
    expect(rec.sent[0].to).toBe(client.email);
    expect(rec.sent[0].subject).toBe("Your calculation is ready");
    expect(rec.sent[0].text).toContain("https://app.test.taxsimba.local/my-return");
  });

  it("does not send a second email when a repeat notification is collapsed", async () => {
    const rec = await useRecording();
    const { notify } = await import("../../src/domain/workflow");
    const title = `Documents requested ${randomUUID().slice(0, 6)}`;
    await notify(client.id, title, "First wording", null, "/actions", "DOCUMENT");
    await notify(client.id, title, "Updated wording", null, "/actions", "DOCUMENT");
    expect(rec.sent.filter((m) => m.subject === title)).toHaveLength(1);
  });

  it("still creates the in-app notification when the provider fails", async () => {
    const rec = await useRecording();
    rec.failNext = 99;
    const { notify } = await import("../../src/domain/workflow");
    const { col } = await import("../../src/db/mongo");
    const title = `Service notice ${randomUUID().slice(0, 6)}`;
    await notify(client.id, title, "Something you should know.", null, null, "INFO");
    expect(rec.sent).toHaveLength(0);
    expect(await col("notifications").countDocuments({ user_id: client.id, title })).toBe(1);
    expect(await col("email_messages").countDocuments({ subject: title, status: "QUEUED" })).toBe(1);
  });

  it("retries a queued message on the next flush without duplicating it", async () => {
    const rec = await useRecording();
    rec.failNext = 1;
    const { notify } = await import("../../src/domain/workflow");
    const { flushEmailQueue } = await import("../../src/services/email");
    const { col } = await import("../../src/db/mongo");
    const title = `Payment receipt ${randomUUID().slice(0, 6)}`;
    await notify(client.id, title, "Your payment was received.", null, null, "PAYMENT");
    expect(rec.sent.filter((m) => m.subject === title)).toHaveLength(0);
    // The first failure schedules a backoff; make it due.
    await waitForAttempt(title);
    await col("email_messages").updateOne({ subject: title }, { $set: { next_attempt_at: new Date(0) } });
    await flushEmailQueue();
    await flushEmailQueue();
    expect(rec.sent.filter((m) => m.subject === title)).toHaveLength(1);
  });

  it("respects the client's notification preferences for email only", async () => {
    const rec = await useRecording();
    const { col } = await import("../../src/db/mongo");
    const { notify } = await import("../../src/domain/workflow");
    await col("notification_preferences").updateOne(
      { user_id: client.id },
      { $set: { user_id: client.id, preferences: { payment_update: false } } },
      { upsert: true },
    );
    const title = `Additional work ${randomUUID().slice(0, 6)}`;
    await notify(client.id, title, "A payment request is waiting.", null, null, "PAYMENT");
    expect(rec.sent.filter((m) => m.subject === title)).toHaveLength(0);
    expect(await col("notifications").countDocuments({ user_id: client.id, title })).toBe(1);
    await col("notification_preferences").deleteOne({ user_id: client.id });
  });

  it("emails a staff invitation with the setup link", async () => {
    const rec = await useRecording();
    const email = `newstaff.${randomUUID().slice(0, 8)}@parity.taxsimba.local`;
    const res = await request(app)
      .post("/api/staff-invites")
      .set(bearer(superAdmin))
      .send({ name: "New Staff", email, role: "ACCOUNTANT" });
    expect(res.status).toBe(200);
    const invite = rec.sent.find((m) => m.to === email);
    expect(invite).toBeDefined();
    expect(invite?.text).toContain("/invite/");
  });

  it("never emails seeded test addresses", async () => {
    const rec = await useRecording();
    const { col } = await import("../../src/db/mongo");
    const { notify } = await import("../../src/domain/workflow");
    const id = randomUUID();
    await col("users").insertOne({
      id,
      email: `test_${id.slice(0, 6)}@qa-taxsimba.example.com`,
      name: "QA",
      role: "CLIENT",
      is_active: true,
      is_test: true,
    });
    await notify(id, "QA notice", "Nothing real.", null, null, "INFO");
    expect(rec.sent).toHaveLength(0);
  });

  it("reminds a client once per repeat window about an open task", async () => {
    const rec = await useRecording();
    const { col } = await import("../../src/db/mongo");
    const { runReminders } = await import("../../src/jobs/reminders");
    const kase = await makeCase({ status: "ASSIGNED", next_action_owner: "ACCOUNTANT" });
    await col("tasks").insertOne({
      id: randomUUID(),
      case_id: kase.id,
      name: "Upload bank statements",
      owner_id: client.id,
      owner_role: "CLIENT",
      status: "OPEN",
      due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    });
    const first = await runReminders();
    expect(first.client_task).toBe(1);
    const second = await runReminders();
    expect(second.client_task).toBe(0);
    expect(rec.sent.filter((m) => m.subject.includes("Upload bank statements"))).toHaveLength(1);
  });

  it("reminds again once the repeat window has elapsed", async () => {
    await useRecording();
    const { col } = await import("../../src/db/mongo");
    const { runReminders } = await import("../../src/jobs/reminders");
    const kase = await makeCase({ status: "AWAITING_CLIENT_APPROVAL", next_action_owner: "CLIENT" });
    expect((await runReminders()).client_case_action).toBeGreaterThanOrEqual(1);
    expect((await runReminders()).client_case_action).toBe(0);
    // Age the claim past REMINDER_REPEAT_DAYS (default 3).
    await col("reminder_log").updateOne(
      { key: `client_case:${kase.id}:AWAITING_CLIENT_APPROVAL` },
      { $set: { last_sent_at: new Date(Date.now() - 10 * 86400000) } },
    );
    expect((await runReminders()).client_case_action).toBe(1);
  });

  it("chases an MTD approval and escalates an overdue period to admins", async () => {
    await useRecording();
    const { col } = await import("../../src/db/mongo");
    const { runReminders } = await import("../../src/jobs/reminders");
    const admin = await makeUser("ADMIN", "reminderadmin");
    const kase = await makeCase({ service_type: "MTD_INCOME_TAX", status: "ASSIGNED" });
    await col("mtd_periods").insertMany([
      {
        id: randomUUID(),
        case_id: kase.id,
        client_id: client.clientId,
        label: "Quarter 1",
        kind: "QUARTER",
        quarter: 1,
        status: "AWAITING_CLIENT_APPROVAL",
        deadline: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        is_test: false,
      },
      {
        id: randomUUID(),
        case_id: kase.id,
        client_id: client.clientId,
        label: "Quarter 2",
        kind: "QUARTER",
        quarter: 2,
        status: "IN_PROGRESS",
        deadline: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
        is_test: false,
      },
    ]);
    const run = await runReminders();
    expect(run.mtd_client_approval).toBe(1);
    expect(run.mtd_overdue_escalation).toBeGreaterThanOrEqual(1);
    expect(
      await col("notifications").countDocuments({
        user_id: admin.id,
        title: "Overdue — waiting for client: Quarter 2",
      }),
    ).toBe(1);
    // A second pass must not stack a duplicate escalation.
    const again = await runReminders();
    expect(again.mtd_overdue_escalation).toBe(0);
  });

  it("ignores test-flagged cases", async () => {
    await useRecording();
    const { col } = await import("../../src/db/mongo");
    const { runReminders } = await import("../../src/jobs/reminders");
    const kase = await makeCase({ is_test: true, status: "AWAITING_CLIENT" });
    await col("tasks").insertOne({
      id: randomUUID(),
      case_id: kase.id,
      name: "Test-only task",
      owner_id: client.id,
      owner_role: "CLIENT",
      status: "OPEN",
      due_date: null,
    });
    const run = await runReminders();
    expect(
      await col("notifications").countDocuments({ title: "Still needed: Test-only task" }),
    ).toBe(0);
    expect(run.client_task).toBe(0);
  });
});
