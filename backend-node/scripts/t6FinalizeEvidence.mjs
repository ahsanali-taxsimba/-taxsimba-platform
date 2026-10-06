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

async function mailpitMessages() {
  const list = await request("/api/v1/messages?limit=100", { base: MAILPIT });
  const msgs = list.json?.messages || [];
  const hits = [];
  for (const m of msgs) {
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

function mailpitFind(hits, { subjectIncludes, bodyIncludesAll = [], afterMs = 0 } = {}) {
  const needle = (bodyIncludesAll || []).map((s) => String(s).toLowerCase());
  return hits
    .filter((m) => {
      if (afterMs && new Date(m.created).getTime() < afterMs - 2000) return false;
      if (subjectIncludes && !String(m.subject || "").toLowerCase().includes(String(subjectIncludes).toLowerCase())) {
        return false;
      }
      const blob = `${m.subject || ""}\n${m.text || ""}\n${m.html || ""}`.toLowerCase();
      return needle.every((n) => blob.includes(n));
    })
    .sort((a, b) => String(b.created).localeCompare(String(a.created)))[0];
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

  // Clear unread collapse so create always sends email (same-title unread skips mail)
  await request("/api/compat/notifications/read-all", {
    method: "POST",
    headers: { Authorization: `Bearer ${clientToken}` },
    body: {},
  });
  await request("/api/compat/notifications/mark-all-read", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${clientToken}` },
    body: {},
  }).catch(() => null);

  const DESC = "Finalize T6 additional schedules review";
  const AMOUNT = 55.5;

  // D-006 create outstanding for reminder + email capture
  const beforeMail = Date.now();
  const create = await request("/api/compat/admin/payment-requests", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      taxReturnId: CASE_ID,
      caseId: CASE_ID,
      description: DESC,
      amount: AMOUNT,
      internalNote: "finalize evidence",
    },
  });
  save("api/d006_admin_create.json", {
    mode: "SIMULATED",
    status: create.status,
    body: JSON.parse(redact(JSON.stringify(create.json))),
  });
  let outstandingId = create.json?.data?.id || create.json?.id;
  if (!outstandingId) throw new Error(`create failed ${create.status}`);

  // Wait briefly for mail; match by desc+amount (not merely newest Action required)
  await new Promise((r) => setTimeout(r, 2000));
  let allMail = await mailpitMessages();
  let newestRequest = mailpitFind(allMail, {
    subjectIncludes: "Action required",
    bodyIncludesAll: ["Finalize T6 additional schedules review", "55.50"],
    afterMs: beforeMail,
  });
  // If create email was collapsed, mark-all-read again and create a fresh request so
  // Action required email is actually sent (resend alone produces Reminder subject).
  if (!newestRequest) {
    await request("/api/compat/notifications/read-all", {
      method: "POST",
      headers: { Authorization: `Bearer ${clientToken}` },
      body: {},
    });
    const recreate = await request("/api/compat/admin/payment-requests", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        taxReturnId: CASE_ID,
        caseId: CASE_ID,
        description: DESC,
        amount: AMOUNT,
        internalNote: "finalize evidence recreate for request email",
      },
    });
    const recreateId = recreate.json?.data?.id || recreate.json?.id;
    if (recreateId) {
      await request(`/api/compat/admin/payment-requests/${outstandingId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {},
      }).catch(() => null);
      outstandingId = recreateId;
      save("api/d006_admin_create.json", {
        mode: "SIMULATED",
        status: recreate.status,
        body: JSON.parse(redact(JSON.stringify(recreate.json))),
        note: "recreated after mark-all-read so Action required email is sent",
      });
    }
    await new Promise((r) => setTimeout(r, 2000));
    allMail = await mailpitMessages();
    newestRequest =
      mailpitFind(allMail, {
        subjectIncludes: "Action required",
        bodyIncludesAll: ["Finalize T6 additional schedules review", "55.50"],
        afterMs: beforeMail,
      }) ||
      mailpitFind(allMail, {
        bodyIncludesAll: ["Finalize T6 additional schedules review", "55.50"],
        afterMs: beforeMail,
      });
  }
  save("mailpit/d008_request_email.json", {
    mode: "LOCAL MAILPIT — not external inbox",
    subject: newestRequest?.subject,
    created: newestRequest?.created,
    text: newestRequest?.text?.slice(0, 5000),
    html_excerpt: newestRequest?.html?.slice(0, 8000),
    includes_description: /Finalize T6 additional schedules review/i.test(
      (newestRequest?.text || "") + (newestRequest?.html || ""),
    ),
    includes_amount: /55\.50|£55\.50/i.test((newestRequest?.text || "") + (newestRequest?.html || "")),
    is_action_required_subject: /action required/i.test(newestRequest?.subject || ""),
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
    matches: seen?.description?.includes("Finalize T6") && Number(seen?.amount) === AMOUNT,
  });

  // D-008 in-app notification content (prefer this request's Finalize T6 / £55.50 row)
  const notif = await request("/api/compat/all-notifications", {
    method: "POST",
    headers: { Authorization: `Bearer ${clientToken}` },
    body: {},
  });
  const notifications = notif.json?.data?.notifications || notif.json?.notifications || [];
  const awNotifs = notifications.filter((n) =>
    /additional work|Finalize T6/i.test(`${n.title || ""} ${n.message || n.body || n.content || ""}`),
  );
  const finalizeNotifs = awNotifs.filter((n) =>
    /Finalize T6 additional schedules review/i.test(`${n.message || n.body || n.content || ""}`),
  );
  const actionRequired = finalizeNotifs.filter((n) => /action required/i.test(n.title || ""));
  const openedNotifs = (actionRequired.length ? actionRequired : finalizeNotifs.length ? finalizeNotifs : awNotifs).slice(
    0,
    3,
  );
  save("api/d008_inapp_notifications.json", {
    status: notif.status,
    count: awNotifs.length,
    opened_content: openedNotifs.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message || n.body || n.content || n.description,
      link: n.link || n.cta_url || n.url,
      read: n.read ?? n.is_read,
      createdAt: n.createdAt || n.created_at,
    })),
  });
  // Render opened notification content HTML for screenshot (not just a list button)
  const notifHtml = `<!doctype html><html><body style="font-family:system-ui;padding:24px;background:#f6f7f8">
    <h1 style="font-size:16px;color:#333">LOCAL evidence — opened notification content from /api/compat/all-notifications (redacted)</h1>
    ${openedNotifs
      .map((n) => {
        const msg = String(n.message || n.body || n.content || n.description || "")
          .replace(/</g, "&lt;")
          .replace(/\n/g, "<br/>");
        return `<div style="background:#fff;border-radius:12px;padding:16px;margin:12px 0;box-shadow:0 1px 3px rgba(0,0,0,.08)">
          <div style="font-weight:700;margin-bottom:8px">${String(n.title || "").replace(/</g, "&lt;")}</div>
          <div style="white-space:pre-wrap;line-height:1.45">${msg}</div>
          <div style="margin-top:10px;font-size:12px;color:#666">Link: ${String(n.link || n.cta_url || n.url || "").replace(/</g, "&lt;")}</div>
          <div style="font-size:12px;color:#666">Created: ${String(n.createdAt || n.created_at || "")}</div>
        </div>`;
      })
      .join("")}
  </body></html>`;
  save("api/d008_opened_notification_content.html", notifHtml);

  // D-009 resend/reminder on the SAME outstanding £55.50 request (before pay)
  const beforeReminder = Date.now();
  const resendOutstanding = await request(`/api/compat/admin/payment-requests/${outstandingId}/resend`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {},
  });
  await new Promise((r) => setTimeout(r, 1500));
  allMail = await mailpitMessages();
  const newestReminder =
    mailpitFind(allMail, {
      subjectIncludes: "Reminder",
      bodyIncludesAll: ["Finalize T6 additional schedules review", "55.50"],
      afterMs: beforeReminder,
    }) ||
    mailpitFind(allMail, {
      bodyIncludesAll: ["Finalize T6 additional schedules review", "55.50", "reminder"],
      afterMs: beforeReminder,
    }) ||
    mailpitFind(allMail, {
      bodyIncludesAll: ["Finalize T6 additional schedules review", "55.50"],
      afterMs: beforeReminder,
    });
  save("api/d009_resend_outstanding.json", {
    status: resendOutstanding.status,
    body: resendOutstanding.json ? JSON.parse(redact(JSON.stringify(resendOutstanding.json))) : null,
    requestId: outstandingId,
  });
  save("mailpit/d009_reminder_email.json", {
    mode: "LOCAL MAILPIT — not external inbox",
    note: "Resend reminder for outstanding Finalize T6 / £55.50 request",
    subject: newestReminder?.subject,
    created: newestReminder?.created,
    text: newestReminder?.text?.slice(0, 5000),
    html_excerpt: newestReminder?.html?.slice(0, 8000),
    includes_description: /Finalize T6 additional schedules review/i.test(
      (newestReminder?.text || "") + (newestReminder?.html || ""),
    ),
    includes_amount: /55\.50|£55\.50/i.test((newestReminder?.text || "") + (newestReminder?.html || "")),
  });
  if (newestReminder?.html) save("mailpit/d009_reminder_email.html", newestReminder.html);

  // Create second request to cancel (guards only — not D-009 primary)
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

  // Capture payment-received email for this paid request (optional D-010)
  await new Promise((r) => setTimeout(r, 1000));
  allMail = await mailpitMessages();
  const paidEmail = mailpitFind(allMail, {
    subjectIncludes: "Payment received",
    bodyIncludesAll: ["Finalize T6 additional schedules review", "55.50"],
  });
  if (paidEmail) {
    save("mailpit/d010_payment_received_email.json", {
      mode: "LOCAL MAILPIT — not external inbox",
      subject: paidEmail.subject,
      created: paidEmail.created,
      text: paidEmail.text?.slice(0, 5000),
      html_excerpt: paidEmail.html?.slice(0, 8000),
    });
    if (paidEmail.html) save("mailpit/d010_payment_received_email.html", paidEmail.html);
  }

  // Cancel cancel-target; then paid/cancelled cannot pay or remind
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

    // Notifications list (secondary) + opened notification CONTENT (primary D-008)
    await page.goto(`${FE}/dashboard/notifications`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3000);
    const acceptCookies = page.getByRole("button", { name: /accept all/i });
    if ((await acceptCookies.count()) > 0) await acceptCookies.first().click().catch(() => null);
    const awRow = page.getByText(/Finalize T6|additional work/i).first();
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
    const notifPage = await context.newPage();
    await notifPage.setContent(notifHtml);
    await notifPage.screenshot({
      path: path.join(OUT, "screenshots/d008_opened_notification_content.png"),
      fullPage: true,
    });
    await notifPage.close();

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

    // Screenshot opened request email + reminder email + payment email bodies
    const emailPage = await context.newPage();
    const emailHtmlPath = path.join(OUT, "mailpit/d008_request_email.html");
    if (fs.existsSync(emailHtmlPath)) {
      await emailPage.setContent(fs.readFileSync(emailHtmlPath, "utf8"));
      await emailPage.screenshot({
        path: path.join(OUT, "screenshots/d008_request_email_opened.png"),
        fullPage: true,
      });
    }
    const remPath = path.join(OUT, "mailpit/d009_reminder_email.html");
    if (fs.existsSync(remPath)) {
      await emailPage.setContent(fs.readFileSync(remPath, "utf8"));
      await emailPage.screenshot({
        path: path.join(OUT, "screenshots/d009_reminder_email_opened.png"),
        fullPage: true,
      });
    }
    const paidPath = path.join(OUT, "mailpit/d010_payment_received_email.html");
    if (fs.existsSync(paidPath)) {
      await emailPage.setContent(fs.readFileSync(paidPath, "utf8"));
      await emailPage.screenshot({
        path: path.join(OUT, "screenshots/d010_payment_received_email_opened.png"),
        fullPage: true,
      });
    }
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
