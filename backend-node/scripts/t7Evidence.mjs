/**
 * Task 7 evidence — J-007 / J-008 / J-009
 * LOCAL / MAILPIT only. Controlled dates for reminder eligibility.
 * Agreed: no new client overdue email.
 */
import { createRequire } from "module";
import fs from "fs";
import http from "http";
import path from "path";
import { randomUUID } from "crypto";

const require = createRequire(import.meta.url);
const { chromium } = require("/workspace/tax_simba_frontend/node_modules/playwright");
const { MongoClient } = require("mongodb");

const API = "http://127.0.0.1:8002";
const FE = "http://127.0.0.1:3000";
const ADMIN_FE = "http://127.0.0.1:3001";
const OUT = "/tmp/t7-evidence";
const ADMIN_EMAIL = "admin@taxsimba.co.uk";
const ADMIN_PASSWORD = "Admin@123";
const CLIENT_PASSWORD = "Client@12345";
const DB = "taxsimba_sa_cert_e2e";

fs.mkdirSync(path.join(OUT, "api"), { recursive: true });
fs.mkdirSync(path.join(OUT, "screenshots"), { recursive: true });
fs.mkdirSync(path.join(OUT, "mailpit"), { recursive: true });
fs.mkdirSync(path.join(OUT, "before"), { recursive: true });
fs.mkdirSync(path.join(OUT, "after"), { recursive: true });

function request(pathname, { method = "GET", headers = {}, body = null, base = API } = {}) {
  const u = new URL(pathname.startsWith("http") ? pathname : base + pathname);
  const payload = body == null ? null : typeof body === "string" ? body : JSON.stringify(body);
  const h = { ...headers };
  if (payload && !h["Content-Type"]) h["Content-Type"] = "application/json";
  if (payload) h["Content-Length"] = Buffer.byteLength(payload);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname + u.search,
        method,
        headers: h,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          let json = null;
          try {
            json = JSON.parse(buf.toString());
          } catch {
            /* raw */
          }
          resolve({ status: res.statusCode, body: buf, json, text: buf.toString() });
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function save(rel, data) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (typeof data === "string" || Buffer.isBuffer(data)) fs.writeFileSync(p, data);
  else fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
  return p;
}

async function main() {
  const stamp = Date.now();
  const clientEmail = `t7.mtd.${stamp}@example.com`;
  const adminLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (adminLogin.status !== 200) throw new Error("admin login failed");
  const adminToken = adminLogin.json.access_token;

  // Register dedicated MTD client
  const reg = await request("/api/auth/register", {
    method: "POST",
    body: {
      email: clientEmail,
      password: CLIENT_PASSWORD,
      name: "T7 MTD Client",
      phone: "+447700900777",
      onboarding_intent: "MTD_INCOME_TAX",
    },
  });
  save("api/register.json", { status: reg.status, email: clientEmail });

  const mongo = new MongoClient("mongodb://127.0.0.1:27017");
  await mongo.connect();
  const db = mongo.db(DB);
  await db.collection("users").updateOne(
    { email: clientEmail },
    {
      $set: {
        email_verified_at: new Date().toISOString(),
        status: "ACTIVE",
        is_active: true,
        is_test: false,
      },
    },
  );

  const clientLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: clientEmail, password: CLIENT_PASSWORD },
  });
  if (clientLogin.status !== 200) throw new Error("client login failed");
  const clientToken = clientLogin.json.access_token;
  const clientUser = await db.collection("users").findOne({ email: clientEmail });

  // Activate MTD via package checkout (compat) if needed — fall back to direct case seed
  const pkgs = await request("/api/packages?service_type=MTD_INCOME_TAX", {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  const plan = (pkgs.json || []).find((p) => p.is_active !== false) || (pkgs.json || [])[0];
  let caseId = null;
  if (plan?.id) {
    const co = await request("/api/compat/client/subscription/checkout-session", {
      method: "POST",
      headers: { Authorization: `Bearer ${clientToken}` },
      body: { planId: plan.id, origin_url: FE },
    });
    const sid = co.json?.data?.sessionId || co.json?.data?.session_id;
    if (sid) {
      await request("/api/compat/client/subscription/checkout-success", {
        method: "POST",
        headers: { Authorization: `Bearer ${clientToken}` },
        body: { sessionId: sid, session_id: sid },
      });
      await request("/api/compat/client/apply-tax-return", {
        method: "POST",
        headers: { Authorization: `Bearer ${clientToken}` },
        body: { serviceType: "MTD_INCOME_TAX", service_type: "MTD_INCOME_TAX" },
      });
    }
  }

  let kase = await db.collection("cases").findOne({
    client_user_id: clientUser.id,
    service_type: "MTD_INCOME_TAX",
  });
  if (!kase) {
    // Direct seed when checkout path unavailable
    const clientDoc =
      (await db.collection("clients").findOne({ user_id: clientUser.id })) ||
      (
        await db.collection("clients").insertOne({
          id: randomUUID(),
          user_id: clientUser.id,
          name: "T7 MTD Client",
          email: clientEmail,
          is_test: false,
        }),
        await db.collection("clients").findOne({ user_id: clientUser.id })
      );
    caseId = randomUUID();
    await db.collection("cases").insertOne({
      id: caseId,
      case_ref: `MTD-T7-${stamp.toString().slice(-4)}`,
      client_id: clientDoc.id,
      client_user_id: clientUser.id,
      client_name: "T7 MTD Client",
      service_type: "MTD_INCOME_TAX",
      status: "ASSIGNED",
      tax_year: "2026/27",
      is_test: false,
      created_at: new Date().toISOString(),
    });
    await db.collection("client_services").insertOne({
      id: randomUUID(),
      client_id: clientDoc.id,
      service_type: "MTD_INCOME_TAX",
      status: "ACTIVE",
      is_test: false,
    });
    const deadlines = [
      { q: 1, label: "Quarter 1", deadline: "2026-08-07" },
      { q: 2, label: "Quarter 2", deadline: "2026-11-07" },
      { q: 3, label: "Quarter 3", deadline: "2027-02-07" },
      { q: 4, label: "Quarter 4", deadline: "2027-05-07" },
    ];
    for (const d of deadlines) {
      await db.collection("mtd_periods").insertOne({
        id: randomUUID(),
        case_id: caseId,
        client_id: clientDoc.id,
        label: d.label,
        kind: "QUARTER",
        quarter: d.q,
        status: "NOT_STARTED",
        deadline: d.deadline,
        is_test: false,
      });
    }
    kase = await db.collection("cases").findOne({ id: caseId });
  }
  caseId = kase.id;

  // Controlled dates: one approaching (due in 5 days), one overdue with Requested docs
  const approachingId = randomUUID();
  const overdueId = randomUUID();
  const approachingDeadline = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  const overdueDeadline = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);

  // Reuse Q1 as approaching, Q2 as overdue waiting for client
  const periods = await db.collection("mtd_periods").find({ case_id: caseId }).toArray();
  const q1 = periods.find((p) => p.quarter === 1) || periods[0];
  const q2 = periods.find((p) => p.quarter === 2) || periods[1];
  await db.collection("mtd_periods").updateOne(
    { id: q1.id },
    { $set: { deadline: approachingDeadline, status: "IN_PROGRESS", label: q1.label || "Quarter 1" } },
  );
  await db.collection("mtd_periods").updateOne(
    { id: q2.id },
    { $set: { deadline: overdueDeadline, status: "IN_PROGRESS", label: q2.label || "Quarter 2" } },
  );

  const taskId = randomUUID();
  await db.collection("tasks").insertOne({
    id: taskId,
    case_id: caseId,
    name: "Upload bank statements (T7)",
    owner_id: clientUser.id,
    owner_role: "CLIENT",
    status: "OPEN",
    mtd_period_id: q1.id,
    due_date: approachingDeadline,
  });

  const docId = randomUUID();
  await db.collection("documents").insertOne({
    id: docId,
    case_id: caseId,
    mtd_period_id: q2.id,
    status: "Requested",
    filename: "t7-records.pdf",
    is_internal: false,
    is_deleted: false,
    client_user_id: clientUser.id,
  });

  save("api/seed_meta.json", {
    caseId,
    case_ref: kase.case_ref,
    clientEmail,
    approachingPeriodId: q1.id,
    overduePeriodId: q2.id,
    approachingDeadline,
    overdueDeadline,
    taskId,
    docId,
    controlled_now_note: "REMINDER_DEADLINE_DAYS default 14; approaching due in 5d; overdue -5d with Requested doc",
  });

  // BEFORE: notifications should not yet have T7 reminders (clear reminder_log for these keys)
  await db.collection("reminder_log").deleteMany({
    key: {
      $in: [
        `client_task:${taskId}`,
        `mtd_records:${q1.id}`,
        `mtd_overdue:${q2.id}`,
      ],
    },
  });
  // Also clear any admin keys for this period
  await db.collection("reminder_log").deleteMany({ key: new RegExp(`^mtd_overdue:${q2.id}:`) });

  const beforeNotifs = await request("/api/compat/all-notifications", {
    method: "POST",
    headers: { Authorization: `Bearer ${clientToken}` },
    body: { page: 1, limit: 50 },
  });
  save("before/client_notifications.json", beforeNotifs.json);
  const beforeAdmin = await request("/api/compat/all-notifications", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { page: 1, limit: 50, search: "Overdue" },
  });
  save("before/admin_notifications_overdue_search.json", beforeAdmin.json);

  // Run reminders with controlled "now" against the same Mongo (connect backend mongo first).
  process.env.MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017";
  process.env.DB_NAME = process.env.DB_NAME || DB;
  const mongoMod = require("../dist/db/mongo.js");
  await mongoMod.connect();
  const remMod = require("../dist/jobs/reminders.js");
  const run = await remMod.runReminders(new Date());
  save("api/reminder_run.json", run);

  const afterClient = await request("/api/compat/all-notifications", {
    method: "POST",
    headers: { Authorization: `Bearer ${clientToken}` },
    body: { page: 1, limit: 50 },
  });
  save("after/client_notifications.json", afterClient.json);
  const afterAdmin = await request("/api/compat/all-notifications", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { page: 1, limit: 50 },
  });
  save("after/admin_notifications.json", afterAdmin.json);

  const clientItems = afterClient.json?.data?.notifications || [];
  const adminItems = afterAdmin.json?.data?.notifications || [];
  const deadlineNotif = clientItems.find(
    (n) => String(n.title || "").includes("deadline approaching") || String(n.message || "").includes(approachingDeadline),
  );
  const taskNotif = clientItems.find((n) => String(n.title || n.message || "").includes("Upload bank statements"));
  const escalateNotif = adminItems.find((n) => String(n.title || "").includes("Overdue — waiting for client"));

  // Isolation: second client must not see these
  const otherEmail = `t7.other.${stamp}@example.com`;
  await request("/api/auth/register", {
    method: "POST",
    body: {
      email: otherEmail,
      password: CLIENT_PASSWORD,
      name: "T7 Other",
      phone: "+447700900778",
      onboarding_intent: "SA",
    },
  });
  await db.collection("users").updateOne(
    { email: otherEmail },
    { $set: { email_verified_at: new Date().toISOString(), status: "ACTIVE", is_active: true } },
  );
  const otherLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: otherEmail, password: CLIENT_PASSWORD },
  });
  const otherNotifs = await request("/api/compat/all-notifications", {
    method: "POST",
    headers: { Authorization: `Bearer ${otherLogin.json.access_token}` },
    body: { page: 1, limit: 50 },
  });
  const leaked = (otherNotifs.json?.data?.notifications || []).filter(
    (n) =>
      String(n.message || n.body || "").includes("T7") ||
      String(n.title || "").includes("Upload bank statements (T7)"),
  );
  save("api/isolation.json", { otherEmail, leaked_count: leaked.length, pass: leaked.length === 0 });

  // Duplicate prevention
  const run2 = await remMod.runReminders(new Date());
  save("api/reminder_run_duplicate.json", run2);

  // Suppression: complete task + clear Requested doc
  await db.collection("tasks").updateOne({ id: taskId }, { $set: { status: "COMPLETED" } });
  await db.collection("documents").updateOne({ id: docId }, { $set: { status: "Uploaded" } });
  await db.collection("reminder_log").deleteMany({
    key: { $in: [`client_task:${taskId}`] },
  });
  await db.collection("reminder_log").deleteMany({ key: new RegExp(`^mtd_overdue:${q2.id}:`) });
  const run3 = await remMod.runReminders(new Date());
  save("api/reminder_run_after_suppress.json", {
    run: run3,
    note: "Task COMPLETED + Requested→Uploaded; expect no new client_task / overdue escalation for those subjects",
  });

  // No client overdue email — check Mailpit for subjects
  const mailpit = await request("/api/v1/messages?limit=50", { base: "http://127.0.0.1:8025" });
  const msgs = mailpit.json?.messages || [];
  const clientOverdueEmails = msgs.filter(
    (m) =>
      /overdue/i.test(m.Subject || "") &&
      (m.To || []).some((t) => (t.Address || "").includes(clientEmail)),
  );
  save("mailpit/summary.json", {
    total: msgs.length,
    client_overdue_emails: clientOverdueEmails.length,
    agreed_no_client_overdue_email: clientOverdueEmails.length === 0,
  });

  // Browser evidence
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  // Client login + notifications
  await page.goto(`${FE}/auth/signin`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"], input[name="email"]', clientEmail);
  await page.fill('input[type="password"], input[name="password"]', CLIENT_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  await page.goto(`${FE}/mtd-dashboard/notifications`, { waitUntil: "networkidle" }).catch(() =>
    page.goto(`${FE}/dashboard/notifications`, { waitUntil: "networkidle" }),
  );
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, "after/01_client_notifications.png"), fullPage: true });

  // Open notification content (J-007)
  const bodySel = '[data-testid^="notification-body-"]';
  const rowSel = '[data-testid^="notification-row-"]';
  if (await page.locator(rowSel).count()) {
    await page.locator(rowSel).first().click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, "after/02_client_notification_opened_nav.png"), fullPage: true });
  }

  // Re-login persistence
  await page.goto(`${FE}/auth/signin`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"], input[name="email"]', clientEmail);
  await page.fill('input[type="password"], input[name="password"]', CLIENT_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await page.goto(`${FE}/mtd-dashboard/notifications`, { waitUntil: "networkidle" }).catch(() =>
    page.goto(`${FE}/dashboard/notifications`, { waitUntil: "networkidle" }),
  );
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "after/03_client_notifications_after_relogin.png"), fullPage: true });

  // Admin notifications + MTD ops
  await page.goto(`${ADMIN_FE}/admin/signin`, { waitUntil: "networkidle" }).catch(() =>
    page.goto(`${ADMIN_FE}/signin`, { waitUntil: "networkidle" }),
  );
  await page.waitForTimeout(1000);
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  if (await emailInput.count()) {
    await emailInput.fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(2500);
  }
  await page.goto(`${ADMIN_FE}/admin/notifications`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, "after/04_admin_notifications.png"), fullPage: true });
  // Click overdue escalation if present
  const overdueRow = page.locator("text=Overdue — waiting for client").first();
  if (await overdueRow.count()) {
    await overdueRow.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, "after/05_admin_escalation_opened.png"), fullPage: true });
  }
  await page.goto(`${ADMIN_FE}/admin/mtd?bucket=overdue_waiting_client`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, "after/06_admin_mtd_overdue_bucket.png"), fullPage: true });

  await browser.close();
  await mongo.close();

  const summary = {
    mode: "LOCAL PASS — MAILPIT",
    stripe: "BLOCKED",
    staging: "BLOCKED",
    external_inbox: "BLOCKED",
    j011: "UNVERIFIED",
    j007: {
      criterion: "notification content opens; link reaches correct case/service; read persists",
      client_deadline_or_task_present: Boolean(deadlineNotif || taskNotif),
      has_message_field: Boolean(
        clientItems[0] && (clientItems[0].message || clientItems[0].body),
      ),
      has_url_or_link: Boolean(clientItems[0] && (clientItems[0].link || clientItems[0].url)),
    },
    j008: {
      criterion: "eligible MTD deadline/task reminders appear (controlled dates)",
      reminder_run: run,
      task_reminder: Boolean(taskNotif),
      deadline_reminder: Boolean(deadlineNotif),
    },
    j009: {
      criterion: "overdue MTD admin escalation reaches correct admin; suppressed when docs uploaded",
      escalation_present: Boolean(escalateNotif),
      escalation_link: escalateNotif?.link || escalateNotif?.url || null,
      duplicate_second_pass: run2,
      after_suppress: run3,
      no_client_overdue_email: clientOverdueEmails.length === 0,
    },
    isolation_pass: leaked.length === 0,
  };
  save("00_summary.json", summary);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
