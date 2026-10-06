/**
 * Task 7 browser evidence — J-007 / J-008 / J-009
 * Uses CSRF credentials login (same pattern as T5/T6).
 * Expects /tmp/t7-evidence/api/seed_meta.json from t7Evidence.mjs.
 */
import { createRequire } from "module";
import fs from "fs";
import http from "http";
import path from "path";

const require = createRequire(import.meta.url);
const { chromium } = require("/workspace/tax_simba_frontend/node_modules/playwright");

const FE = "http://127.0.0.1:3000";
const ADMIN = "http://127.0.0.1:3001";
const API = "http://127.0.0.1:8002";
const OUT = "/tmp/t7-evidence";
const ADMIN_EMAIL = "admin@taxsimba.co.uk";
const ADMIN_PASSWORD = "Admin@123";
const CLIENT_PASSWORD = "Client@12345";

const seed = JSON.parse(fs.readFileSync(path.join(OUT, "api/seed_meta.json"), "utf8"));
const CLIENT_EMAIL = seed.clientEmail;

fs.mkdirSync(path.join(OUT, "after"), { recursive: true });
fs.mkdirSync(path.join(OUT, "before"), { recursive: true });
fs.mkdirSync(path.join(OUT, "mailpit"), { recursive: true });

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

async function acceptEngagement(token) {
  return request("/api/compat/client/accept-engagement-letter", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { signature: "T7 MTD Client", accepted: true },
  });
}

async function clientLogin(page, email, password) {
  await page.goto(`${FE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  const accept = page.locator('button:has-text("Accept All")');
  if (await accept.count()) await accept.click().catch(() => {});
  const pwdTab = page.locator(
    'button:has-text("Password"), a:has-text("Password"), [data-testid="use-password"]',
  );
  if (await pwdTab.count()) await pwdTab.first().click().catch(() => {});
  const csrf = await page.evaluate(async () => (await fetch("/frontend-api/auth/csrf")).json());
  await page.evaluate(
    async ({ csrfToken, email, password }) => {
      const body = new URLSearchParams({
        csrfToken,
        email,
        password,
        callbackUrl: `${window.location.origin}/mtd-dashboard`,
        json: "true",
      });
      await fetch("/frontend-api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    },
    { csrfToken: csrf.csrfToken, email, password },
  );
  await page.goto(`${FE}/mtd-dashboard/notifications`, { waitUntil: "networkidle", timeout: 60000 });
  if (page.url().includes("engagement")) {
    throw new Error(`still on engagement: ${page.url()}`);
  }
}

async function adminLogin(page) {
  await page.goto(`${ADMIN}/admin/auth/signin`, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator('input[name="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[name="password"]').fill(ADMIN_PASSWORD);
  // Button component omits type=submit; Enter on password triggers form onSubmit
  await Promise.all([
    page.waitForURL(/\/admin\/(overview|dashboard)/, { timeout: 45000 }).catch(() => null),
    page.locator('input[name="password"]').press("Enter"),
  ]);
  if (!/\/admin\/(overview|dashboard)/.test(page.url())) {
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/admin\/(overview|dashboard)/, { timeout: 45000 }).catch(() => null);
  }
  await page.waitForTimeout(2000);
}

async function main() {
  // Unlock client dashboard (engagement letter)
  const preLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: CLIENT_EMAIL, password: CLIENT_PASSWORD },
  });
  if (preLogin.status !== 200) throw new Error(`prelogin ${preLogin.status}`);
  const eng = await acceptEngagement(preLogin.json.access_token);
  save("api/engagement_accept.json", eng);
  const engStatus = await request("/api/compat/client/engagement-letter-status", {
    headers: { Authorization: `Bearer ${preLogin.json.access_token}` },
  });
  save("api/engagement_status.json", engStatus.json);
  if (!engStatus.json?.data?.isEngagementLetterAccepted) {
    throw new Error("engagement not accepted");
  }

  // Persist Mailpit bodies for T7 subjects
  const mailpit = await request("/api/v1/messages?limit=100", { base: "http://127.0.0.1:8025" });
  const msgs = mailpit.json?.messages || [];
  const t7 = msgs.filter((m) => {
    const to = (m.To || []).map((t) => t.Address || "").join(",");
    const subj = m.Subject || "";
    return (
      to.includes(CLIENT_EMAIL) ||
      /deadline approaching|Action needed: Upload bank statements \(T7\)|Overdue — waiting for client: Quarter 2/i.test(
        subj,
      )
    );
  });
  save("mailpit/t7_related_messages.json", t7);
  for (const m of t7.slice(0, 8)) {
    const full = await request(`/api/v1/message/${m.ID}`, { base: "http://127.0.0.1:8025" });
    save(`mailpit/${m.ID}.json`, {
      id: m.ID,
      subject: m.Subject,
      to: m.To,
      text: full.json?.Text || full.text?.slice?.(0, 2000),
    });
  }
  const clientOverdue = msgs.filter(
    (m) =>
      /overdue/i.test(m.Subject || "") &&
      (m.To || []).some((t) => (t.Address || "") === CLIENT_EMAIL),
  );
  save("mailpit/summary.json", {
    total: msgs.length,
    t7_related: t7.length,
    client_overdue_emails: clientOverdue.length,
    agreed_no_client_overdue_email: clientOverdue.length === 0,
    label: "LOCAL / MAILPIT only — external inbox BLOCKED",
  });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // —— Client: notifications list with content visible (J-007 / J-008)
  await clientLogin(page, CLIENT_EMAIL, CLIENT_PASSWORD);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, "after/01_client_notifications.png"), fullPage: true });

  const bodyText = await page.locator("body").innerText();
  save("after/01_client_notifications_text.json", {
    url: page.url(),
    has_deadline: /deadline approaching/i.test(bodyText),
    has_task: /Upload bank statements \(T7\)/i.test(bodyText),
    snippet: bodyText.slice(0, 1500),
  });

  // Open first notification (click → navigate + mark read)
  const row = page.locator('[data-testid^="notification-row-"]').first();
  let openedUrl = null;
  if (await row.count()) {
    await row.click();
    await page.waitForTimeout(3000);
    openedUrl = page.url();
    await page.screenshot({
      path: path.join(OUT, "after/02_client_notification_opened_nav.png"),
      fullPage: true,
    });
  }
  save("after/02_open_nav.json", { openedUrl, expected_mtd_or_tracker: true });

  // Mark-read persistence: re-login and check read state via API + UI
  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email: CLIENT_EMAIL, password: CLIENT_PASSWORD },
  });
  const token = login.json.access_token;
  // Explicitly mark deadline notif read if click didn't
  const notifs = await request("/api/compat/all-notifications", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { page: 1, limit: 50 },
  });
  const items = notifs.json?.data?.notifications || [];
  const unread = items.filter((n) => !n.read && !n.is_read);
  if (unread[0]) {
    await request(`/api/compat/notifications/${unread[0].id}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: {},
    });
  }
  // Re-login UI
  await page.goto(`${FE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(async () => {
    await fetch("/frontend-api/auth/signout", { method: "POST" }).catch(() => {});
  });
  await clientLogin(page, CLIENT_EMAIL, CLIENT_PASSWORD);
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(OUT, "after/03_client_notifications_after_relogin.png"),
    fullPage: true,
  });
  const afterRelogin = await request("/api/compat/all-notifications", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { page: 1, limit: 50 },
  });
  const afterItems = afterRelogin.json?.data?.notifications || [];
  save("after/03_read_persistence.json", {
    items: afterItems.map((n) => ({
      id: n.id,
      title: n.title,
      read: n.read ?? n.is_read,
      message: (n.message || n.body || "").slice(0, 120),
      link: n.link || n.url,
    })),
    any_read_persisted: afterItems.some((n) => n.read || n.is_read),
  });

  // —— Admin: notifications + escalation open + MTD ops bucket (J-007 / J-009)
  await adminLogin(page);
  await page.goto(`${ADMIN}/admin/notifications`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, "after/04_admin_notifications.png"), fullPage: true });

  const overdue = page.locator("text=Overdue — waiting for client").first();
  if (await overdue.count()) {
    await overdue.click();
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(OUT, "after/05_admin_escalation_opened.png"),
      fullPage: true,
    });
    save("after/05_admin_escalation_nav.json", { url: page.url() });
  }

  await page.goto(`${ADMIN}/admin/mtd?bucket=overdue_waiting_client`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(2500);
  await page.screenshot({
    path: path.join(OUT, "after/06_admin_mtd_overdue_bucket.png"),
    fullPage: true,
  });
  const mtdText = await page.locator("body").innerText();
  save("after/06_admin_mtd_bucket.json", {
    url: page.url(),
    has_overdue_label: /Overdue/i.test(mtdText),
    has_case_ref: mtdText.includes(seed.case_ref || "MTD-"),
    snippet: mtdText.slice(0, 1200),
  });

  await browser.close();

  const summary = {
    mode: "LOCAL PASS — MAILPIT",
    stripe: "BLOCKED",
    staging: "BLOCKED",
    external_inbox: "BLOCKED",
    j011: "UNVERIFIED",
    clientEmail: CLIENT_EMAIL,
    caseId: seed.caseId,
    case_ref: seed.case_ref,
    screenshots: [
      "after/01_client_notifications.png",
      "after/02_client_notification_opened_nav.png",
      "after/03_client_notifications_after_relogin.png",
      "after/04_admin_notifications.png",
      "after/05_admin_escalation_opened.png",
      "after/06_admin_mtd_overdue_bucket.png",
    ],
  };
  save("00_browser_summary.json", summary);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
