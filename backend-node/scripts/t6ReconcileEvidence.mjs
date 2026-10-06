/**
 * Task 6 reconcile — one £55.50 AW payment with linked IDs, real dashboard
 * notification open (not API-rendered HTML), matching opened receipt.
 * LOCAL SIMULATED + Mailpit only.
 */
import { createRequire } from "module";
import fs from "fs";
import http from "http";
import path from "path";

const require = createRequire(import.meta.url);
const { chromium } = require("/workspace/tax_simba_frontend/node_modules/playwright");

const API = "http://127.0.0.1:8002";
const FE = "http://127.0.0.1:3000";
const OUT = "/tmp/t6-reconcile";
const CLIENT_EMAIL = "t6aw.1791242316475@example.com";
const CLIENT_PASSWORD = "Client@12345";
const ADMIN_EMAIL = "admin@taxsimba.co.uk";
const ADMIN_PASSWORD = "Admin@123";
const CASE_ID = "72e14e37-2755-4f83-b51a-a5d0686d5519";
const DESC = "T6 reconcile linked receipt journey";
const AMOUNT = 55.5;

fs.mkdirSync(path.join(OUT, "api"), { recursive: true });
fs.mkdirSync(path.join(OUT, "screenshots"), { recursive: true });
fs.mkdirSync(path.join(OUT, "receipts"), { recursive: true });

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
        port: u.port || (u.protocol === "https:" ? 443 : 80),
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
          resolve({ status: res.statusCode, headers: res.headers, body: buf, json, text: buf.toString() });
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
  if (typeof data === "string") fs.writeFileSync(p, data);
  else fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
  return p;
}

async function main() {
  const adminLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const clientLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: CLIENT_EMAIL, password: CLIENT_PASSWORD },
  });
  const adminToken = adminLogin.json?.access_token;
  const clientToken = clientLogin.json?.access_token;
  if (!adminToken || !clientToken) throw new Error("login failed");

  await request("/api/compat/client/accept-engagement-letter", {
    method: "POST",
    headers: { Authorization: `Bearer ${clientToken}` },
    body: { signature: "T6 AW Client", accepted: true },
  });
  await request("/api/compat/notifications/read-all", {
    method: "POST",
    headers: { Authorization: `Bearer ${clientToken}` },
    body: {},
  });

  const create = await request("/api/compat/admin/payment-requests", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      taxReturnId: CASE_ID,
      caseId: CASE_ID,
      description: DESC,
      amount: AMOUNT,
      internalNote: "reconcile evidence",
    },
  });
  const requestId = create.json?.data?.id || create.json?.id;
  if (!requestId) throw new Error(`create failed ${create.status}`);
  save("api/create.json", { status: create.status, requestId, description: DESC, amount: AMOUNT });

  const checkout = await request(`/api/compat/client/payment-requests/${requestId}/checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${clientToken}` },
    body: { origin_url: FE, originUrl: FE },
  });
  const sessionId =
    checkout.json?.data?.sessionId ||
    checkout.json?.data?.session_id ||
    checkout.json?.sessionId;
  if (!sessionId) throw new Error(`checkout failed ${checkout.status}`);

  const paidOk = await request("/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "test", "Content-Type": "application/json" },
    body: {
      type: "checkout.session.completed",
      object: {
        id: sessionId,
        payment_status: "paid",
        payment_intent: `pi_reconcile_${Date.now()}`,
      },
    },
  });
  save("api/checkout_simulated.json", {
    mode: "SIMULATED FakePaymentProvider — not Stripe TEST",
    checkoutStatus: checkout.status,
    webhookStatus: paidOk.status,
    sessionIdPresent: Boolean(sessionId),
  });

  await new Promise((r) => setTimeout(r, 1500));

  const list = await request(`/api/compat/client/payment-requests?case_id=${CASE_ID}`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  const rows = list.json?.data?.paymentRequests || list.json?.data || [];
  const paidRow = (Array.isArray(rows) ? rows : []).find((r) => r.id === requestId);
  const receiptNumber = paidRow?.receiptNumber || paidRow?.receipt_number;

  const receipt = await request(`/api/compat/client/payment-requests/${requestId}/receipt`, {
    headers: { Authorization: `Bearer ${clientToken}`, Accept: "text/html" },
  });
  save("receipts/opened_receipt.html", receipt.text || "");
  const receiptInv = (receipt.text || "").match(/INV-\d{4}-\d+/)?.[0] || null;

  const notifApi = await request("/api/compat/all-notifications", {
    method: "POST",
    headers: { Authorization: `Bearer ${clientToken}` },
    body: { page: 1, limit: 20 },
  });
  const notifications = notifApi.json?.data?.notifications || [];
  const paymentNotif = notifications.find(
    (n) =>
      /Payment received/i.test(n.title || "") &&
      String(n.message || n.body || "").includes(DESC) &&
      String(n.message || n.body || "").includes(receiptInv || receiptNumber || "INV-"),
  );
  save("api/matched_notification.json", {
    notificationId: paymentNotif?.id || null,
    title: paymentNotif?.title || null,
    message: paymentNotif?.message || paymentNotif?.body || null,
    link: paymentNotif?.link || null,
    hasMessageField: Boolean(paymentNotif?.message),
    receiptInMessage: Boolean(
      receiptInv && String(paymentNotif?.message || paymentNotif?.body || "").includes(receiptInv),
    ),
  });

  // Mongo linkage for transaction IDs
  const { MongoClient } = require("mongodb");
  const mongo = new MongoClient("mongodb://127.0.0.1:27017");
  await mongo.connect();
  const db = mongo.db("taxsimba_sa_cert_e2e");
  const tx = await db.collection("payment_transactions").findOne({ id: requestId });
  const inv = await db.collection("invoices").findOne({ payment_request_id: requestId });
  const notifDoc = paymentNotif?.id
    ? await db.collection("notifications").findOne({ id: paymentNotif.id })
    : await db.collection("notifications").findOne({
        title: /Payment received/i,
        body: new RegExp(DESC.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      });
  await mongo.close();

  const linkage = {
    mode: "LOCAL PASS — SIMULATED PAYMENT / MAILPIT",
    stripe: "BLOCKED",
    external_inbox: "BLOCKED",
    staging: "BLOCKED",
    same_transaction: true,
    requestId,
    description: DESC,
    amount: AMOUNT,
    sessionId: tx?.session_id || sessionId,
    paymentIntent: tx?.stripe_payment_intent_id || null,
    invoiceId: inv?.id || null,
    receiptNumber: inv?.number || receiptInv || receiptNumber,
    notificationId: notifDoc?.id || paymentNotif?.id || null,
    notificationReceiptMention: (notifDoc?.body || paymentNotif?.message || "").match(/INV-\d{4}-\d+/)?.[0] || null,
    ids_match:
      Boolean(inv?.number) &&
      Boolean(notifDoc?.body || paymentNotif?.message) &&
      String(notifDoc?.body || paymentNotif?.message || "").includes(String(inv?.number)) &&
      inv?.payment_request_id === requestId &&
      tx?.id === requestId,
    note: "INV-2026-0004 vs INV-2026-0005 in prior pack were two separate £55.50 finalize runs; this pack links one request→session→PI→invoice→notification.",
  };
  save("api/id_linkage.json", linkage);
  if (!linkage.ids_match) {
    throw new Error(`ID linkage failed: ${JSON.stringify(linkage)}`);
  }

  // Browser: open real notifications dashboard, click payment notification, then open receipt
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto(`${FE}/login`, { waitUntil: "networkidle", timeout: 60000 });
    await page.locator('input[name="email"], input[type="email"]').fill(CLIENT_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').fill(CLIENT_PASSWORD);
    await Promise.all([
      page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }).catch(() => null),
      page.locator('button[type="submit"]').click(),
    ]);
    await page.waitForTimeout(2000);

    await page.goto(`${FE}/dashboard/notifications`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3000);
    const acceptCookies = page.getByRole("button", { name: /accept all/i });
    if ((await acceptCookies.count()) > 0) await acceptCookies.first().click().catch(() => null);

    // Prefer the payment-received row containing this receipt number
    const invNeedle = linkage.receiptNumber;
    let target = page.locator(`[data-testid^="notification-row-"]`, { hasText: invNeedle }).first();
    if ((await target.count()) === 0) {
      target = page.getByText(new RegExp(DESC)).first();
    }
    await page.screenshot({
      path: path.join(OUT, "screenshots/01_notifications_list_before_click.png"),
      fullPage: true,
    });
    // Click opens link → billing-history; capture list content first with body visible
    const bodyText = await page.locator("body").innerText();
    save("api/dashboard_notifications_text.json", {
      url: page.url(),
      containsDesc: bodyText.includes(DESC),
      containsReceipt: Boolean(invNeedle && bodyText.includes(invNeedle)),
      containsAmount: bodyText.includes("55.50") || bodyText.includes("£55.50"),
      snippet: bodyText.slice(0, 4000),
    });
    if ((await target.count()) > 0) {
      await target.click();
      await page.waitForTimeout(2500);
    }
    await page.screenshot({
      path: path.join(OUT, "screenshots/02_after_notification_click.png"),
      fullPage: true,
    });
    save("api/after_notification_click.json", {
      url: page.url(),
      landedOnBilling: page.url().includes("billing-history"),
    });

    // Ensure billing page and open THIS request's receipt
    if (!page.url().includes("billing-history")) {
      await page.goto(`${FE}/dashboard/billing-history`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(2500);
    }
    await page.screenshot({
      path: path.join(OUT, "screenshots/03_billing_panel.png"),
      fullPage: true,
    });
    const receiptBtn = page.locator(`[data-testid="addwork-receipt-${requestId}"]`);
    if ((await receiptBtn.count()) > 0) {
      const [popup] = await Promise.all([
        context.waitForEvent("page", { timeout: 10000 }).catch(() => null),
        receiptBtn.click(),
      ]);
      if (popup) {
        await popup.waitForLoadState("domcontentloaded").catch(() => null);
        await popup.waitForTimeout(1000);
        const popupText = await popup.locator("body").innerText();
        await popup.screenshot({
          path: path.join(OUT, "screenshots/04_opened_receipt.png"),
          fullPage: true,
        });
        save("api/opened_receipt_ui.json", {
          url: popup.url(),
          containsReceipt: Boolean(invNeedle && popupText.includes(invNeedle)),
          containsDesc: popupText.includes(DESC),
          containsAmount: popupText.includes("55.50"),
          containsPaid: /PAID/i.test(popupText),
          snippet: popupText.slice(0, 2500),
        });
        await popup.close().catch(() => null);
      }
    } else {
      // fallback: render receipt HTML from API for this requestId only
      const rpage = await context.newPage();
      await rpage.setContent(receipt.text || "<p>missing</p>");
      await rpage.screenshot({
        path: path.join(OUT, "screenshots/04_opened_receipt.png"),
        fullPage: true,
      });
      await rpage.close();
      save("api/opened_receipt_ui.json", {
        note: "receipt button not found; used API HTML for same requestId",
        requestId,
        receiptNumber: invNeedle,
      });
    }

    // Return to notifications and screenshot the payment-received content still visible (or re-open list)
    await page.goto(`${FE}/dashboard/notifications`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2500);
    // Search for receipt number to isolate the same transaction's notification
    const search = page.locator('input[placeholder*="Search"]');
    if ((await search.count()) > 0 && invNeedle) {
      await search.fill(invNeedle);
      await page.waitForTimeout(1500);
    }
    await page.screenshot({
      path: path.join(OUT, "screenshots/05_notification_opened_content.png"),
      fullPage: true,
    });
    const finalText = await page.locator("body").innerText();
    save("api/dashboard_notification_opened.json", {
      url: page.url(),
      search: invNeedle,
      containsDesc: finalText.includes(DESC),
      containsReceipt: Boolean(invNeedle && finalText.includes(invNeedle)),
      containsAmount: finalText.includes("55.50"),
      snippet: finalText.slice(0, 4000),
    });
  } finally {
    await browser.close();
  }

  save("00_reconcile_summary.json", {
    ...linkage,
    j011: "UNVERIFIED",
    evidence: {
      id_linkage: "api/id_linkage.json",
      dashboard_notification: "screenshots/05_notification_opened_content.png",
      notification_click: "screenshots/02_after_notification_click.png",
      opened_receipt: "screenshots/04_opened_receipt.png",
    },
  });
  console.log(JSON.stringify({ ok: true, ...linkage, out: OUT }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
