/**
 * Task 8 / J-005 — browser evidence for safe message HTML rendering.
 * Verifies SA ChatBox, MTD Messages, admin manage-tax; XSS must not execute.
 */
import { createRequire } from "module";
import fs from "fs";
import http from "http";
import path from "path";
import { randomUUID } from "crypto";
import { MongoClient } from "mongodb";

const require = createRequire(import.meta.url);
const { chromium } = require("/workspace/tax_simba_frontend/node_modules/playwright");

const FE = "http://127.0.0.1:3000";
const ADMIN = "http://127.0.0.1:3001";
const API = "http://127.0.0.1:8002";
const OUT = "/opt/cursor/artifacts/task8_j005_safe_message_html";
const ADMIN_EMAIL = "admin@taxsimba.co.uk";
const ADMIN_PASSWORD = "Admin@123";
const CLIENT_PASSWORD = "Client@12345";

const seed = JSON.parse(fs.readFileSync(path.join(OUT, "api/seed_and_communication_log.json"), "utf8"));
const SA_CASE = seed.saCaseId;
const MTD_CASE = seed.mtdCaseId;
const OTHER_CASE = seed.otherCaseId;

fs.mkdirSync(path.join(OUT, "after"), { recursive: true });
fs.mkdirSync(path.join(OUT, "api"), { recursive: true });

function save(rel, data) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (typeof data === "string" || Buffer.isBuffer(data)) fs.writeFileSync(p, data);
  else fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
  return p;
}

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

async function acceptEngagement(token) {
  return request("/api/compat/client/accept-engagement-letter", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { signature: "T8 J005 Client", accepted: true },
  });
}

async function clientLogin(page, email, password, dest = "/dashboard") {
  await page.goto(`${FE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  const accept = page.locator('button:has-text("Accept All")');
  if (await accept.count()) await accept.click().catch(() => {});
  const pwdTab = page.locator(
    'button:has-text("Password"), a:has-text("Password"), [data-testid="use-password"]',
  );
  if (await pwdTab.count()) await pwdTab.first().click().catch(() => {});
  const csrf = await page.evaluate(async () => (await fetch("/frontend-api/auth/csrf")).json());
  await page.evaluate(
    async ({ csrfToken, email, password, callbackUrl }) => {
      const body = new URLSearchParams({
        csrfToken,
        email,
        password,
        callbackUrl,
        json: "true",
      });
      await fetch("/frontend-api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    },
    { csrfToken: csrf.csrfToken, email, password, callbackUrl: `${FE}${dest}` },
  );
  await page.goto(`${FE}${dest}`, { waitUntil: "networkidle", timeout: 60000 });
  if (page.url().includes("/login")) {
    // Fallback: fill form UI
    await page.locator('input[name="email"], input[type="email"]').fill(email).catch(() => {});
    await page.locator('input[name="password"], input[type="password"]').fill(password).catch(() => {});
    await page.getByRole("button", { name: /sign in/i }).click().catch(() => {});
    await page.waitForTimeout(3000);
    await page.goto(`${FE}${dest}`, { waitUntil: "networkidle", timeout: 60000 });
  }
  if (page.url().includes("/login")) {
    throw new Error(`clientLogin failed for ${email}; still on ${page.url()}`);
  }
}

async function adminLogin(page) {
  await page.goto(`${ADMIN}/admin/auth/signin`, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator('input[name="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[name="password"]').fill(ADMIN_PASSWORD);
  await Promise.all([
    page.waitForURL(/\/admin\/(overview|dashboard)/, { timeout: 45000 }).catch(() => null),
    page.locator('input[name="password"]').press("Enter"),
  ]);
  if (!/\/admin\/(overview|dashboard)/.test(page.url())) {
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForURL(/\/admin\/(overview|dashboard)/, { timeout: 45000 }).catch(() => null);
  }
  await page.waitForTimeout(1500);
}

function analyzeMessageDom(text, messageHtml) {
  const html = messageHtml || "";
  return {
    has_readable_dfgd: /\bdfgd\b/.test(text),
    has_raw_p_tags_as_text: /<p>dfgd/i.test(text) || /&lt;p&gt;dfgd/i.test(text),
    has_amp_lt_double_escape: /&amp;lt;/.test(text) || /&amp;lt;/.test(html),
    has_script_tag_in_message_html: /<script/i.test(html),
    has_onerror_attr: /onerror=/i.test(html),
    has_onclick_attr: /onclick=/i.test(html),
    has_javascript_href: /href=["']javascript:/i.test(html),
    snippet: text.slice(0, 2000),
  };
}

async function messageHtmlSnapshot(page) {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll(".safe-message-body, .offcanvas-body, [class*='communication']"));
    return nodes.map((n) => n.innerHTML).join("\n").slice(0, 20000);
  });
}

async function openSaChat(page) {
  // TaxTracker opens Communication Log via .chat / message.png
  const chatIcon = page.locator(".chat img[alt='chat'], .chat, img[alt='chat']");
  if (await chatIcon.count()) {
    await chatIcon.first().click();
    await page.waitForTimeout(1500);
  }
  await page.waitForSelector("text=Communication Log", { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(1000);
}

async function main() {
  const mongo = new MongoClient(process.env.MONGO_URL || "mongodb://127.0.0.1:27017");
  await mongo.connect();
  const db = mongo.db(process.env.DB_NAME || "taxsimba_sa_cert_e2e");

  const saCase = await db.collection("cases").findOne({ id: SA_CASE });
  const mtdCase = await db.collection("cases").findOne({ id: MTD_CASE });
  // Prefer client_user_id (authoritative for login); client_id→clients can drift.
  const saUser =
    (saCase?.client_user_id &&
      (await db.collection("users").findOne({ id: saCase.client_user_id }))) ||
    (await db.collection("users").findOne({ email: "dbg@test.com" }));
  const mtdUser =
    (mtdCase?.client_user_id &&
      (await db.collection("users").findOne({ id: mtdCase.client_user_id }))) ||
    (await db.collection("users").findOne({ email: "t7.mtd.1791247928362@example.com" }));

  const saEmail = saUser?.email || "dbg@test.com";
  const mtdEmail = mtdUser?.email || "t7.mtd.1791247928362@example.com";

  save("api/resolved_users.json", {
    saEmail,
    mtdEmail,
    saCaseId: SA_CASE,
    mtdCaseId: MTD_CASE,
    otherCaseId: OTHER_CASE,
  });

  // Ensure engagement accepted for both clients
  for (const email of [saEmail, mtdEmail]) {
    const login = await request("/api/auth/login", {
      method: "POST",
      body: { email, password: CLIENT_PASSWORD },
    });
    if (login.status === 200 && login.json?.access_token) {
      const eng = await acceptEngagement(login.json.access_token);
      save(`api/engagement_${email.replace(/[^a-z0-9]/gi, "_")}.json`, {
        status: eng.status,
        body: eng.json,
      });
    }
  }

  // Ensure MTD case has assigned accountant (admin)
  const adminUser = await db.collection("users").findOne({ email: ADMIN_EMAIL });
  if (mtdCase && adminUser) {
    await db.collection("cases").updateOne(
      { id: MTD_CASE },
      {
        $set: {
          assigned_accountant_id: adminUser.id,
          assigned_to: adminUser.id,
          accountant_id: adminUser.id,
        },
      },
    );
  }

  // Post a fresh compose-style escaped message via admin message API if available
  const adminLoginApi = await request("/api/auth/login", {
    method: "POST",
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const adminToken = adminLoginApi.json?.access_token;
  // Prefer compat communication endpoint used by EmailModal
  const freshBodies = [
    "<p>dfgd<p>",
    "<p>Hello from Admin — readable paragraph</p>",
    '<p>safe text</p><script>window.__t8_xss=1</script><img src=x onerror="window.__t8_onerror=1"><a href="javascript:alert(1)">click</a>',
    "<p>&lt;script&gt;compose-escaped&lt;/script&gt;</p><p>Second paragraph readable.</p>",
  ];
  const postResults = [];
  for (const caseId of [SA_CASE, MTD_CASE]) {
    for (const body of freshBodies) {
      const r = await request(`/api/compat/admin/send-to-client`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          taxReturnId: caseId,
          tax_return_id: caseId,
          message: body,
          body,
          htmlContent: body,
          subject: "J-005 verification",
        },
      });
      postResults.push({ caseId, status: r.status, bodyPreview: body.slice(0, 80) });
    }
  }
  save("api/fresh_message_posts.json", postResults);

  // Isolation re-check — SA client must not read OTHER case communication log
  const otherLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: saEmail, password: CLIENT_PASSWORD },
  });
  const isoAlt = await request(`/api/compat/client/communication-log/${OTHER_CASE}`, {
    headers: { Authorization: `Bearer ${otherLogin.json?.access_token}` },
  });
  const isoText = isoAlt.text || "";
  save("api/isolation_recheck.json", {
    status: isoAlt.status,
    hasSecret: /SECRET_OTHER_CLIENT|other-client/i.test(isoText),
    isolationOk: isoAlt.status === 403,
  });

  await mongo.close();

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // —— SA ChatBox AFTER
  await clientLogin(page, saEmail, CLIENT_PASSWORD, "/dashboard");
  await page.waitForTimeout(2000);
  if (page.url().includes("engagement")) {
    throw new Error(`SA still on engagement: ${page.url()}`);
  }
  await page.screenshot({ path: path.join(OUT, "after/01_sa_tax_tracker.png"), fullPage: true });
  await openSaChat(page);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, "after/02_sa_chatbox_messages.png"), fullPage: true });
  const saText = await page.locator("body").innerText();
  const saMsgHtml = await messageHtmlSnapshot(page);
  const saXss = await page.evaluate(() => ({
    t8_xss: window.__t8_xss || null,
    t8_onerror: window.__t8_onerror || null,
  }));
  const saAnalysis = { ...analyzeMessageDom(saText, saMsgHtml), xss: saXss, url: page.url() };
  save("after/02_sa_chatbox_analysis.json", saAnalysis);

  // Refresh
  await page.reload({ waitUntil: "networkidle" });
  await openSaChat(page);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "after/03_sa_chat_after_refresh.png"), fullPage: true });

  // Re-login
  await page.goto(`${FE}/login`, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await fetch("/frontend-api/auth/signout", { method: "POST" }).catch(() => {});
  });
  await clientLogin(page, saEmail, CLIENT_PASSWORD, "/dashboard");
  await openSaChat(page);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "after/04_sa_chat_after_relogin.png"), fullPage: true });

  // —— MTD Messages
  await page.goto(`${FE}/login`, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await fetch("/frontend-api/auth/signout", { method: "POST" }).catch(() => {});
  });
  await clientLogin(page, mtdEmail, CLIENT_PASSWORD, "/mtd-dashboard");
  await page.waitForTimeout(2500);
  if (page.url().includes("engagement")) {
    throw new Error(`MTD still on engagement: ${page.url()}`);
  }
  // Stay on overview — open Tax Return Chat modal (MtdMessages)
  await page.goto(`${FE}/mtd-dashboard`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  // Exact Chat button next to assigned accountant (not "Requests & messages")
  const chatBtn = page.getByRole("button", { name: /^Chat$/i });
  if (await chatBtn.count()) {
    await chatBtn.first().click();
  } else {
    await page.locator("button").filter({ hasText: /^Chat$/ }).first().click();
  }
  await page.waitForSelector("text=Tax Return Chat", { timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, "after/05_mtd_messages.png"), fullPage: true });
  const mtdText = await page.locator(".modal.show .modal-body, .mtd-messages-list").first().innerText().catch(async () => page.locator("body").innerText());
  const mtdMsgHtml = await messageHtmlSnapshot(page);
  const mtdXss = await page.evaluate(() => ({
    t8_mtd_xss: window.__t8_mtd_xss || null,
    t8_xss: window.__t8_xss || null,
  }));
  save("after/05_mtd_messages_analysis.json", {
    ...analyzeMessageDom(mtdText, mtdMsgHtml),
    xss: mtdXss,
    url: page.url(),
  });

  // —— Admin manage-tax messages
  const adminPage = await ctx.newPage();
  await adminLogin(adminPage);
  await adminPage.goto(`${ADMIN}/admin/manage-tax/${SA_CASE}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await adminPage.waitForTimeout(2500);
  // Open communications / messages tab if present
  for (const label of ["Communication", "Messages", "Email", "Chat"]) {
    const tab = adminPage.locator(`button:has-text("${label}"), a:has-text("${label}")`);
    if (await tab.count()) {
      await tab.first().click().catch(() => {});
      await adminPage.waitForTimeout(800);
    }
  }
  await adminPage.screenshot({
    path: path.join(OUT, "after/06_admin_manage_tax_messages.png"),
    fullPage: true,
  });
  const adminText = await adminPage.locator("body").innerText();
  const adminMsgHtml = await messageHtmlSnapshot(adminPage);
  const adminXss = await adminPage.evaluate(() => ({
    t8_xss: window.__t8_xss || null,
    t8_onerror: window.__t8_onerror || null,
  }));
  save("after/06_admin_manage_tax_analysis.json", {
    ...analyzeMessageDom(adminText, adminMsgHtml),
    xss: adminXss,
    url: adminPage.url(),
  });

  // Also tax-return-list path if route exists
  await adminPage.goto(`${ADMIN}/admin/tax-return-list/${SA_CASE}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  }).catch(() => null);
  await adminPage.waitForTimeout(2000);
  await adminPage.screenshot({
    path: path.join(OUT, "after/07_admin_tax_return_list_messages.png"),
    fullPage: true,
  });

  await browser.close();

  const summary = {
    sa: saAnalysis,
    testedAt: new Date().toISOString(),
    note: "See after/*_analysis.json for MTD/admin; XSS flags must be null",
  };
  save("after/browser_verification.json", summary);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
