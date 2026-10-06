/**
 * Task 6 browser evidence — Additional Work panel (admin) + client billing.
 * SIMULATED FakePaymentProvider. Not Stripe TEST proof.
 * Admin must be on CORS-allowed origin http://127.0.0.1:3001
 */
import { createRequire } from "module";
import fs from "fs";
import http from "http";
import path from "path";

const require = createRequire(import.meta.url);
const { chromium } = require("/workspace/tax_simba_frontend/node_modules/playwright");

const API = "http://127.0.0.1:8002";
const ADMIN = "http://127.0.0.1:3001";
const FE = "http://127.0.0.1:3000";
const OUT = "/opt/cursor/artifacts/t6-aw";
const CASE_ID = process.env.T6_CASE_ID || "72e14e37-2755-4f83-b51a-a5d0686d5519";
const CLIENT_EMAIL = process.env.T6_CLIENT_EMAIL || "t6aw.1791242316475@example.com";
const CLIENT_PASSWORD = process.env.T6_CLIENT_PASSWORD || "Client@12345";
const ADMIN_EMAIL = process.env.T6_ADMIN_EMAIL || "admin@taxsimba.co.uk";
const ADMIN_PASSWORD = process.env.T6_ADMIN_PASSWORD || "Admin@123";

fs.mkdirSync(OUT, { recursive: true });
const log = [];
function note(obj) {
  log.push({ t: new Date().toISOString(), ...obj });
}

function request(pathname, { method = "GET", headers = {}, body = null } = {}) {
  const u = new URL(pathname.startsWith("http") ? pathname : API + pathname);
  const payload = body == null ? null : typeof body === "string" ? body : JSON.stringify(body);
  const h = { ...headers };
  if (payload && !h["Content-Type"]) h["Content-Type"] = "application/json";
  if (payload) h["Content-Length"] = Buffer.byteLength(payload);
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: h },
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
          resolve({ status: res.statusCode, body: buf, json });
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function ensureEngagement() {
  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email: CLIENT_EMAIL, password: CLIENT_PASSWORD },
  });
  const token = login.json?.access_token;
  if (!token) throw new Error(`client login ${login.status}`);
  await request("/api/compat/client/accept-engagement-letter", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { signature: "T6 AW Client", accepted: true },
  });
  note({ step: "engagement_ok" });
}

async function adminLogin(page) {
  await page.goto(`${ADMIN}/admin/auth/signin`, { waitUntil: "networkidle", timeout: 60000 });
  await page.screenshot({ path: path.join(OUT, "10_admin_signin.png"), fullPage: true });
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
  await page.waitForTimeout(2500);
  note({ step: "admin_logged_in", url: page.url() });
  await page.screenshot({ path: path.join(OUT, "11_admin_after_login.png"), fullPage: true });
}

async function captureAdminPanel(page) {
  page.on("console", (msg) => {
    if (/CORS|Error|Failed/i.test(msg.text())) note({ console: msg.text().slice(0, 300) });
  });
  page.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() >= 400) {
      note({ apiFail: r.status(), url: r.url().slice(0, 200) });
    }
  });

  await page.goto(`${ADMIN}/admin/manage-tax/${CASE_ID}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(4000);

  // Panel may be below the fold on overview tab
  const panel = page.locator('[data-testid="additional-work-panel"]');
  const visible = await panel.count();
  note({ step: "case_page", url: page.url(), panelCount: visible });

  if (visible === 0) {
    // Try clicking Overview tab if present
    const overview = page.getByRole("button", { name: /overview/i }).or(page.getByText(/^Overview$/i));
    if ((await overview.count()) > 0) {
      await overview.first().click().catch(() => null);
      await page.waitForTimeout(2000);
    }
  }

  if ((await panel.count()) > 0) {
    await panel.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }

  await page.screenshot({ path: path.join(OUT, "12_admin_case_overview.png"), fullPage: true });

  const panelVisible = (await panel.count()) > 0;
  note({ panelVisible, bodySnippet: (await page.locator("body").innerText()).slice(0, 400) });

  if (!panelVisible) {
    fs.writeFileSync(path.join(OUT, "browser_log.json"), JSON.stringify(log, null, 2));
    throw new Error("Additional Work panel not visible on case page");
  }

  await panel.first().screenshot({ path: path.join(OUT, "13_admin_aw_panel.png") });

  // Open create form
  await page.locator('[data-testid="request-additional-payment-btn"]').click();
  await page.waitForTimeout(500);
  await page.fill('[data-testid="addpay-description"]', "T6 UI create — browser evidence");
  await page.fill('[data-testid="addpay-amount"]', "42.75");
  await page.screenshot({ path: path.join(OUT, "14_admin_aw_form_filled.png"), fullPage: true });

  page.once("dialog", async (d) => {
    note({ confirm: d.message() });
    await d.accept();
  });
  await page.locator('[data-testid="addpay-send-btn"]').click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, "15_admin_aw_after_create.png"), fullPage: true });
  await panel.first().screenshot({ path: path.join(OUT, "16_admin_aw_panel_with_rows.png") });

  const hasRow = (await page.locator('[data-testid^="addwork-"]').count()) > 0;
  note({ afterCreateHasRows: hasRow });
  return hasRow;
}

async function clientLogin(page) {
  await page.goto(`${FE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.screenshot({ path: path.join(OUT, "19_client_login.png"), fullPage: true });
  const emailSel = 'input[name="email"], input[type="email"], #email';
  const passSel = 'input[name="password"], input[type="password"], #password';
  await page.waitForSelector(emailSel, { timeout: 15000 });
  await page.fill(emailSel, CLIENT_EMAIL);
  await page.fill(passSel, CLIENT_PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(2500);
  note({ step: "client_logged_in", url: page.url() });
}

async function captureClientBilling(page) {
  await page.goto(`${FE}/dashboard/billing-history`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);

  // Dismiss cookie banner if present
  const acceptCookies = page.getByRole("button", { name: /accept all/i });
  if ((await acceptCookies.count()) > 0) {
    await acceptCookies.first().click().catch(() => null);
    await page.waitForTimeout(500);
  }

  note({
    step: "billing",
    url: page.url(),
    bodySnippet: (await page.locator("body").innerText()).slice(0, 500),
  });

  if (page.url().includes("engagement")) {
    throw new Error("Still redirected to engagement letter");
  }

  const panel = page.locator('[data-testid="additional-work-panel"]');
  await panel.first().waitFor({ timeout: 15000 });
  await panel.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, "20_client_billing_aw.png"), fullPage: true });
  await panel.first().screenshot({ path: path.join(OUT, "21_client_aw_panel.png") });
  const payBtns = await page.locator('[data-testid^="addwork-pay-"]').count();
  note({ clientPayButtons: payBtns });
  return payBtns > 0;
}

async function main() {
  await ensureEngagement();
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await adminLogin(page);
    const adminOk = await captureAdminPanel(page);
    note({ adminOk });

    const clientPage = await context.newPage();
    await clientLogin(clientPage);
    const clientOk = await captureClientBilling(clientPage);
    note({ clientOk, mode: "SIMULATED FakePaymentProvider — not Stripe TEST" });

    fs.writeFileSync(path.join(OUT, "browser_log.json"), JSON.stringify(log, null, 2));
    console.log(JSON.stringify({ adminOk, clientOk, out: OUT }, null, 2));
    if (!adminOk || !clientOk) process.exitCode = 2;
  } catch (e) {
    note({ error: String(e?.message || e) });
    fs.writeFileSync(path.join(OUT, "browser_log.json"), JSON.stringify(log, null, 2));
    await page.screenshot({ path: path.join(OUT, "99_error.png"), fullPage: true }).catch(() => null);
    console.error(e);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
