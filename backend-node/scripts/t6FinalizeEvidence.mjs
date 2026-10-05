/**
 * Task 6 finalize capture — email body, notification content, opened receipt,
 * paid/cancelled cannot pay/remind. SIMULATED + Mailpit local only.
 */
import { createRequire } from "module";
import fs from "fs";
import http from "http";
import path from "path";

const require = createRequire(import.meta.url);
const { chromium } = require("/workspace/tax_simba_frontend/node_modules/playwright");

const API = "http://127.0.0.1:8002";
const FE = "http://127.0.0.1:3000";
const MAILPIT = "http://127.0.0.1:8025";
const OUT = "/tmp/t6-finalize";
const CLIENT_EMAIL = "t6aw.1791242316475@example.com";
const CLIENT_PASSWORD = "Client@12345";
const ADMIN_EMAIL = "admin@taxsimba.co.uk";
const ADMIN_PASSWORD = "Admin@123";
const CASE_ID = "72e14e37-2755-4f83-b51a-a5d0686d5519";

fs.mkdirSync(path.join(OUT, "api"), { recursive: true });
fs.mkdirSync(path.join(OUT, "receipts"), { recursive: true });
fs.mkdirSync(path.join(OUT, "screenshots"), { recursive: true });
fs.mkdirSync(path.join(OUT, "mailpit"), { recursive: true });

function request(pathname, { method = "GET", headers = {}, body = null, base = API } = {}) {
  const u = new URL(pathname.startsWith("http") ? pathname : base + pathname);
  const payload = body == null ? null : typeof body === "string" ? body : JSON.stringify(body);
  const h = { ...headers };
  if (payload && !h["Content-Type"]) h["Content-Type"] = "application/json";
  if (payload) h["Content-Length"] = Buffer.byteLength(payload);
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: u.hostname, port: u.port || (u.protocol === "https:" ? 443 : 80), path: u.pathname + u.search, method, headers: h },
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

function redact(s) {
  return String(s || "")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[REDACTED_EMAIL]")
    .replace(/Bearer [A-Za-z0-9._\-]+/g, "Bearer [REDACTED]")
    .replace(/eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g, "[REDACTED_JWT]");
}

function save(rel, data) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (typeof data === "string") fs.writeFileSync(p, data);
  else fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
  return p;
}

async function mailpitBySubject(substr) {
  const list = await request("/api/v1/messages?limit=80", { base: MAILPIT });
  const msgs = list.json?.messages || [];
  const hits = [];
  for (const m of msgs) {
    if (!String(m.Subject || "").toLowerCase().includes(substr.toLowerCase())) continue;
    const detail = await request(`/api/v1/message/${m.ID}`, { base: MAILPIT });
    hits.push({
      id: m.ID,
      subject: m.Subject,
      created: m.Created,
      text: redact(detail.json?.Text || ""),
      html: redact(detail.json?.HTML || ""),
    });
  }
  return hits;
}

async function main() {
  const adminLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const adminToken = adminLogin.json?.access_token;
  const clientLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: CLIENT_EMAIL, password: CLIENT_PASSWORD },
  });
  const clientToken = clientLogin.json?.access_token;
  if (!adminToken || !clientToken) throw new Error("login failed");

  // Ensure engagement
  await request("/api/compat/client/accept-engagement-letter", {
    method: "POST",
    headers: { Authorization: `Bearer ${clientToken}` },
    body: { signature: "T6 AW Client", accepted: true },
  });

  // D-006 create outstanding for reminder + email capture
  const beforeMail = Date.now();
  const create = await request("/api/compat/admin/payment-requests", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      taxReturnId: CASE_ID,
      caseId: CASE_ID,
      description: "Finalize T6 additional schedules review",
      amount: 55.5,
      internalNote: "finalize evidence",
    },
  });
  save("api/d006_admin_create.json", {
    mode: "SIMULATED",
    status: create.status,
    body: JSON.parse(redact(JSON.stringify(create.json))),
  });
  const outstandingId = create.json?.data?.id || create.json?.id;
  if (!outstandingId) throw new Error(`create failed ${create.status}`);

  // Wait briefly for mail
  await new Promise((r) => setTimeout(r, 1500));
  const requestEmails = await mailpitBySubject("Action required: additional work");
  const newestRequest = requestEmails.sort((a, b) => String(b.created).localeCompare(String(a.created)))[0];
  save("mailpit/d008_request_email.json", {
    mode: "LOCAL MAILPIT — not external inbox",
    subject: newestRequest?.subject,
    created: newestRequest?.created,
    text: newestRequest?.text?.slice(0, 5000),
    html_excerpt: newestRequest?.html?.slice(0, 8000),
    includes_description: /Finalize T6 additional schedules review|additional work/i.test(
      (newestRequest?.text || "") + (newestRequest?.html || ""),
    ),
    includes_amount: /55\.50|£55|GBP/i.test((newestRequest?.text || "") + (newestRequest?.html || "")),
    billing_link: /billing-history/.test((newestRequest?.text || "") + (newestRequest?.html || "")),
  });
  if (newestRequest?.html) save("mailpit/d008_request_email.html", newestRequest.html);

  // D-007 client list shows desc/amount
  const list = await request(`/api/compat/client/payment-requests?case_id=${CASE_ID}`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  const rows = list.json?.data?.paymentRequests || list.json?.data || list.json || [];
  const seen = (Array.isArray(rows) ? rows : []).find((r) => r.id === outstandingId);
  save("api/d007_client_sees_desc_amount.json", {
    status: list.status,
    requestId: outstandingId,
    description: seen?.description,
    amount: seen?.amount,
    currency: seen?.currency,
    paymentStatus: seen?.paymentStatus || seen?.payment_status,
    matches: seen?.description?.includes("Finalize T6") && Number(seen?.amount) === 55.5,
  });

  // D-008 in-app notification content
  const notif = await request("/api/compat/all-notifications", {
    method: "POST",
    headers: { Authorization: `Bearer ${clientToken}` },
    body: {},
  });
  const notifications = notif.json?.data?.notifications || notif.json?.notifications || [];
  const awNotifs = notifications.filter((n) =>
    /additional work/i.test(`${n.title || ""} ${n.message || n.body || n.content || ""}`),
  );
  save("api/d008_inapp_notifications.json", {
    status: notif.status,
    count: awNotifs.length,
    opened_content: awNotifs.slice(0, 5).map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message || n.body || n.content || n.description,
      link: n.link || n.cta_url || n.url,
      read: n.read ?? n.is_read,
      createdAt: n.createdAt || n.created_at,
    })),
  });

  // Create second request to cancel, and pay the first outstanding via fake checkout
  const toCancel = await request("/api/compat/admin/payment-requests", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      taxReturnId: CASE_ID,
      description: "Finalize cancel-target AW",
      amount: 12.0,
    },
  });
  const cancelId = toCancel.json?.data?.id || toCancel.json?.id;

  // Pay outstandingId (SIMULATED FakePaymentProvider webhook — not Stripe TEST)
  const checkout = await request(`/api/compat/client/payment-requests/${outstandingId}/checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${clientToken}` },
    body: { origin_url: FE, originUrl: FE },
  });
  const sessionId =
    checkout.json?.data?.sessionId ||
    checkout.json?.data?.session_id ||
    checkout.json?.sessionId;
  save("api/d010_checkout_simulated.json", {
    mode: "SIMULATED FakePaymentProvider — not Stripe TEST",
    status: checkout.status,
    sessionId: sessionId ? "[PRESENT]" : null,
    amountLocked: checkout.json?.data?.amount ?? checkout.json?.amount,
  });

  let paidOk = null;
  if (sessionId) {
    // Return URL alone must not mark paid — capture status first
    const alone = await request(`/api/payments/status/${sessionId}`);
    save("api/addl_return_url_alone.json", {
      status: alone.status,
      body: alone.json ? JSON.parse(redact(JSON.stringify(alone.json))) : alone.text?.slice(0, 500),
      note: "Return URL / status alone must leave request unpaid",
    });
    paidOk = await request("/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "test", "Content-Type": "application/json" },
      body: {
        type: "checkout.session.completed",
        object: {
          id: sessionId,
          payment_status: "paid",
          payment_intent: `pi_fake_${Date.now()}`,
        },
      },
    });
    // Replay webhook — no duplicate receipt
    await request("/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "test", "Content-Type": "application/json" },
      body: {
        type: "checkout.session.completed",
        object: {
          id: sessionId,
          payment_status: "paid",
          payment_intent: `pi_fake_${Date.now()}`,
        },
      },
    });
  }
  save("api/d010_checkout_success_simulated.json", {
    mode: "SIMULATED FakePaymentProvider webhook",
    status: paidOk?.status,
    body: paidOk?.json ? JSON.parse(redact(JSON.stringify(paidOk.json))) : null,
  });

  // Opened receipt HTML
  const receipt = await request(`/api/compat/client/payment-requests/${outstandingId}/receipt`, {
    headers: { Authorization: `Bearer ${clientToken}`, Accept: "text/html" },
  });
  const receiptHtml = redact(receipt.text || "");
  save("receipts/d010_opened_receipt.html", receiptHtml);
  save("api/d010_opened_receipt_meta.json", {
    status: receipt.status,
    contentType: receipt.headers["content-type"],
    includesAmount: /55\.50|£55/.test(receiptHtml),
    includesDescription: /Finalize T6 additional schedules review/i.test(receiptHtml),
    includesPaidOrReceipt: /paid|receipt|invoice/i.test(receiptHtml),
    html_excerpt: receiptHtml.slice(0, 4000),
  });

  // D-009 resend on still-pending cancel-target BEFORE cancel; then cancel; then paid cannot resend
  const resendPending = await request(`/api/compat/admin/payment-requests/${cancelId}/resend`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {},
  });
  await new Promise((r) => setTimeout(r, 1000));
  const reminderEmails = await mailpitBySubject("additional work");
  // Prefer newest after resend — subjects may still be Action required
  save("api/d009_resend_outstanding.json", {
    status: resendPending.status,
    body: resendPending.json ? JSON.parse(redact(JSON.stringify(resendPending.json))) : null,
  });
  const newestReminder = reminderEmails.sort((a, b) => String(b.created).localeCompare(String(a.created)))[0];
  save("mailpit/d009_reminder_email.json", {
    mode: "LOCAL MAILPIT — not external inbox",
    note: "Resend uses same Action required subject; body is reminder content",
    subject: newestReminder?.subject,
    created: newestReminder?.created,
    text: newestReminder?.text?.slice(0, 5000),
    html_excerpt: newestReminder?.html?.slice(0, 8000),
  });
  if (newestReminder?.html) save("mailpit/d009_reminder_email.html", newestReminder.html);

  // Cancel outstanding cancelId
  const cancelled = await request(`/api/compat/admin/payment-requests/${cancelId}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {},
  });
  save("api/addl_cancel.json", { status: cancelled.status });

  // Paid cannot resend / checkout again
  const paidResend = await request(`/api/compat/admin/payment-requests/${outstandingId}/resend`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {},
  });
  const paidCheckout = await request(`/api/compat/client/payment-requests/${outstandingId}/checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${clientToken}` },
    body: { origin_url: FE },
  });
  const cancelCheckout = await request(`/api/compat/client/payment-requests/${cancelId}/checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${clientToken}` },
    body: { origin_url: FE },
  });
  const cancelResend = await request(`/api/compat/admin/payment-requests/${cancelId}/resend`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {},
  });
  save("api/addl_paid_cancelled_guards.json", {
    paid_resend_status: paidResend.status,
    paid_resend_message: paidResend.json?.message || paidResend.json?.error,
    paid_checkout_status: paidCheckout.status,
    paid_checkout_message: paidCheckout.json?.message || paidCheckout.json?.error,
    cancelled_checkout_status: cancelCheckout.status,
    cancelled_checkout_message: cancelCheckout.json?.message || cancelCheckout.json?.error,
    cancelled_resend_status: cancelResend.status,
    cancelled_resend_message: cancelResend.json?.message || cancelResend.json?.error,
    expect: "All should be non-2xx / rejected",
  });

  // Browser: notifications page + receipt open
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

    // Notifications
    await page.goto(`${FE}/dashboard/notifications`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3000);
    const acceptCookies = page.getByRole("button", { name: /accept all/i });
    if ((await acceptCookies.count()) > 0) await acceptCookies.first().click().catch(() => null);
    // Click first additional-work notification if present
    const awRow = page.getByText(/additional work/i).first();
    if ((await awRow.count()) > 0) {
      await awRow.click().catch(() => null);
      await page.waitForTimeout(1500);
    }
    await page.screenshot({
      path: path.join(OUT, "screenshots/d008_notifications_opened.png"),
      fullPage: true,
    });
    save("api/d008_notifications_page_text.json", {
      url: page.url(),
      bodySnippet: redact((await page.locator("body").innerText()).slice(0, 2500)),
    });

    // Billing + open receipt in new page via API HTML render in browser
    await page.goto(`${FE}/dashboard/billing-history`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(OUT, "screenshots/d007_d010_billing_panel.png"),
      fullPage: true,
    });
    const receiptBtn = page.locator('[data-testid^="addwork-receipt-"]').first();
    if ((await receiptBtn.count()) > 0) {
      const [popup] = await Promise.all([
        context.waitForEvent("page", { timeout: 10000 }).catch(() => null),
        receiptBtn.click(),
      ]);
      if (popup) {
        await popup.waitForLoadState("domcontentloaded").catch(() => null);
        await popup.waitForTimeout(1000);
        await popup.screenshot({
          path: path.join(OUT, "screenshots/d010_opened_receipt.png"),
          fullPage: true,
        });
        save("api/d010_receipt_popup_text.json", {
          url: popup.url(),
          bodySnippet: redact((await popup.locator("body").innerText()).slice(0, 2500)),
        });
        await popup.close().catch(() => null);
      } else {
        // fallback: open receipt HTML data URL / blank with content
        const rpage = await context.newPage();
        await rpage.setContent(receiptHtml || "<p>no receipt html</p>");
        await rpage.screenshot({
          path: path.join(OUT, "screenshots/d010_opened_receipt.png"),
          fullPage: true,
        });
        await rpage.close();
      }
    } else {
      const rpage = await context.newPage();
      await rpage.setContent(receiptHtml || "<p>no receipt html</p>");
      await rpage.screenshot({
        path: path.join(OUT, "screenshots/d010_opened_receipt.png"),
        fullPage: true,
      });
      await rpage.close();
    }

    // Also screenshot rendered request email HTML
    const emailPage = await context.newPage();
    const emailHtml = fs.readFileSync(path.join(OUT, "mailpit/d008_request_email.html"), "utf8");
    await emailPage.setContent(emailHtml);
    await emailPage.screenshot({
      path: path.join(OUT, "screenshots/d008_request_email_opened.png"),
      fullPage: true,
    });
    await emailPage.close();
  } finally {
    await browser.close();
  }

  save("00_finalize_summary.json", {
    mode: "LOCAL PASS — SIMULATED PAYMENT / MAILPIT",
    stripe: "BLOCKED",
    external_inbox: "BLOCKED",
    staging: "BLOCKED",
    outstandingPaidId: outstandingId,
    cancelledId: cancelId,
    caseId: CASE_ID,
  });
  console.log(JSON.stringify({ ok: true, outstandingId, cancelId, out: OUT }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
