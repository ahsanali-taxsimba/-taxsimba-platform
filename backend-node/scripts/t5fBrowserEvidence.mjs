/**
 * Task 5 follow-up browser evidence (SIMULATED FakePaymentProvider).
 * Captures: upgrade breakdown, cancel preserves SIMPLE, success upgrade + billing after re-login.
 * Not Stripe TEST proof.
 */
import { createRequire } from "module";
import fs from "fs";
import http from "http";
import { MongoClient } from "mongodb";
import { randomUUID } from "crypto";

const require = createRequire(import.meta.url);
const { chromium } = require("/workspace/tax_simba_frontend/node_modules/playwright");

const API = "http://127.0.0.1:8002";
const FE = "http://127.0.0.1:3000";
const OUT = "/opt/cursor/artifacts/task5-followup-screenshots";
const PASSWORD = "Client@12345";
fs.mkdirSync(OUT, { recursive: true });

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

async function seedClient(tag) {
  const email = `t5f.${tag}.${Date.now()}@taxsimba.test`;
  const reg = await request("/api/auth/register", {
    method: "POST",
    body: {
      email,
      password: PASSWORD,
      name: `T5F ${tag}`,
      phone: "+447700900123",
      onboarding_intent: "SA",
    },
  });
  const mongo = new MongoClient("mongodb://127.0.0.1:27017");
  await mongo.connect();
  const db = mongo.db("taxsimba_sa_cert_e2e");
  await db.collection("users").updateOne(
    { email },
    {
      $set: {
        email_verified_at: new Date().toISOString(),
        status: "ACTIVE",
        is_active: true,
      },
    },
  );
  // Accept engagement letter if required later
  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email, password: PASSWORD },
  });
  const token = login.json?.access_token;
  if (!token) throw new Error(`login failed ${login.status} ${login.body.toString().slice(0, 200)}`);
  const me = await request("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
  const clientId = me.json?.client_id || me.json?.id;
  await request("/api/compat/client/accept-engagement-letter", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { signature: "T5F Accept", signed_name: `T5F ${tag}` },
  }).catch(() => null);

  const pkgs = await request("/api/packages?service_type=SELF_ASSESSMENT", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const simple = (pkgs.json || []).find((p) => p.code === "SIMPLE");
  const smart = (pkgs.json || []).find((p) => p.code === "SMART");
  const elite = (pkgs.json || []).find((p) => p.code === "ELITE");

  const buy = await request("/api/payments/service-checkout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: {
      service_type: "SELF_ASSESSMENT",
      package_code: "SIMPLE",
      origin_url: FE,
    },
  });
  const sid = buy.json?.session_id;
  // Fake provider: mark paid via checkout-success after pay — retrieve may auto-complete on fake.
  // Prefer webhook-style: use compat checkout-success which retrieves session.
  // FakePaymentProvider.retrieveSession returns unpaid until .pay — pay via native webhook helper not available here.
  // Use FakePaymentProvider path: POST checkout-success after manually setting paid in DB if needed.
  const paid = await request("/api/compat/client/subscription/checkout-success", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { sessionId: sid, session_id: sid },
  });
  if (paid.status >= 400) {
    // Force-pay for local fake: update tx + fulfil by re-calling after marking paid
    await db.collection("payment_transactions").updateOne(
      { session_id: sid },
      {
        $set: {
          payment_status: "paid",
          status: "completed",
          stripe_payment_intent_id: `pi_fake_${randomUUID().slice(0, 8)}`,
          updated_at: new Date().toISOString(),
        },
      },
    );
    const paid2 = await request("/api/compat/client/subscription/checkout-success", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: { sessionId: sid, session_id: sid },
    });
    if (paid2.status >= 400) {
      await mongo.close();
      throw new Error(`activate SIMPLE failed ${paid2.status} ${paid2.body.toString().slice(0, 300)}`);
    }
  }
  const services = await request("/api/my-services", {
    headers: { Authorization: `Bearer ${token}` },
  });
  await mongo.close();
  return {
    email,
    password: PASSWORD,
    token,
    clientId,
    smartPlanId: smart?.id,
    elitePlanId: elite?.id,
    simplePlanId: simple?.id,
    services: services.json,
  };
}

async function loginPage(page, email, password) {
  await page.goto(`${FE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  const accept = page.locator('button:has-text("Accept All")');
  if (await accept.count()) await accept.click().catch(() => {});
  const csrf = await page.evaluate(async () => (await fetch("/frontend-api/auth/csrf")).json());
  await page.evaluate(
    async ({ csrfToken, email, password }) => {
      const body = new URLSearchParams({
        csrfToken,
        email,
        password,
        callbackUrl: `${window.location.origin}/dashboard`,
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
  const session = await page.evaluate(async () => (await fetch("/frontend-api/auth/session")).json());
  return session;
}

async function withProxy(page) {
  await page.route("**/api/compat/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const headers = { ...req.headers() };
    delete headers.origin;
    delete headers.referer;
    try {
      const r = await request(url.pathname + url.search, {
        method: req.method(),
        headers,
        body: req.postData() || null,
      });
      await route.fulfill({
        status: r.status,
        headers: { "content-type": "application/json" },
        body: r.body,
      });
    } catch (e) {
      await route.fulfill({ status: 502, body: JSON.stringify({ message: String(e) }) });
    }
  });
}

async function main() {
  const cancelClient = await seedClient("cancel");
  const successClient = await seedClient("success");
  fs.writeFileSync(
    `${OUT}/seed_clients.json`,
    JSON.stringify(
      {
        mode: "SIMULATED",
        cancel: { email: cancelClient.email, package: cancelClient.services },
        success: { email: successClient.email, package: successClient.services },
      },
      null,
      2,
    ),
  );

  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/local/bin/google-chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  // --- CANCEL PATH ---
  {
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await context.newPage();
    await withProxy(page);
    await loginPage(page, cancelClient.email, cancelClient.password);

    await page.goto(`${FE}/dashboard/my-subscriptions`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/07_cancel_before_subscriptions_simple.png`, fullPage: true });

    await page.goto(`${FE}/planlist/${cancelClient.smartPlanId}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForTimeout(3500);
    await page.waitForSelector('[data-testid="upgrade-price-breakdown"]', { timeout: 15000 }).catch(() => {});
    await page.screenshot({ path: `${OUT}/02_upgrade_checkout_breakdown.png`, fullPage: true });

    // Start upgrade then expire (cancel) via webhook
    const co = await request("/api/payments/upgrade-checkout", {
      method: "POST",
      headers: { Authorization: `Bearer ${cancelClient.token}` },
      body: { package_code: "SMART", origin_url: FE },
    });
    const sid = co.json?.session_id;
    fs.writeFileSync(
      `${OUT}/api_cancel_checkout.json`,
      JSON.stringify({ status: co.status, body: co.json }, null, 2),
    );
    // Abandon checkout: mark session expired in DB (customer cancelled / closed tab).
    // Note: LocalStagingFakePaymentProvider recovers retrieveSession as paid — so we do NOT
    // call checkout-success here. Vitest FakePaymentProvider covers unpaid return-URL isolation.
    const mongoCancel = new MongoClient("mongodb://127.0.0.1:27017");
    await mongoCancel.connect();
    await mongoCancel
      .db("taxsimba_sa_cert_e2e")
      .collection("payment_transactions")
      .updateOne(
        { session_id: sid },
        {
          $set: {
            status: "expired",
            payment_status: "expired",
            updated_at: new Date().toISOString(),
          },
        },
      );
    const cancelTx = await mongoCancel
      .db("taxsimba_sa_cert_e2e")
      .collection("payment_transactions")
      .findOne({ session_id: sid }, { projection: { session_id: 1, payment_status: 1, fulfilled: 1, kind: 1, amount: 1 } });
    await mongoCancel.close();
    fs.writeFileSync(`${OUT}/api_cancel_expired_tx.json`, JSON.stringify(cancelTx, null, 2));

    await page.goto(`${FE}/dashboard/my-subscriptions`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/08_cancel_after_still_simple.png`, fullPage: true });
    const cancelServices = await request("/api/my-services", {
      headers: { Authorization: `Bearer ${cancelClient.token}` },
    });
    fs.writeFileSync(`${OUT}/api_cancel_services_after.json`, JSON.stringify(cancelServices.json, null, 2));
    await context.close();
  }

  // --- SUCCESS PATH ---
  {
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await context.newPage();
    await withProxy(page);
    await loginPage(page, successClient.email, successClient.password);

    await page.goto(`${FE}/dashboard/my-subscriptions`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/01_my_subscriptions_simple.png`, fullPage: true });

    await page.goto(`${FE}/planlist/${successClient.smartPlanId}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${OUT}/02b_success_path_breakdown.png`, fullPage: true });
    const cont = page.locator("button").filter({ hasText: /Continue|upgrade difference|Pay/i });
    if (await cont.count()) {
      await cont.first().click();
      await page.waitForTimeout(2000);
      await page.waitForSelector('[data-testid="upgrade-final-amount-confirm"]', { timeout: 10000 }).catch(() => {});
      await page.screenshot({ path: `${OUT}/03_confirm_final_amount.png`, fullPage: true });
    }

    const up = await request("/api/payments/upgrade-checkout", {
      method: "POST",
      headers: { Authorization: `Bearer ${successClient.token}` },
      body: { package_code: "SMART", origin_url: FE },
    });
    const upSid = up.json?.session_id;
    fs.writeFileSync(`${OUT}/api_success_checkout.json`, JSON.stringify(up.json, null, 2));
    // Mark paid + fulfil (SIMULATED)
    const mongo = new MongoClient("mongodb://127.0.0.1:27017");
    await mongo.connect();
    await mongo
      .db("taxsimba_sa_cert_e2e")
      .collection("payment_transactions")
      .updateOne(
        { session_id: upSid },
        {
          $set: {
            payment_status: "paid",
            status: "completed",
            stripe_payment_intent_id: `pi_fake_${randomUUID().slice(0, 8)}`,
            updated_at: new Date().toISOString(),
          },
        },
      );
    await mongo.close();
    const fulfil = await request("/api/compat/client/subscription/checkout-success", {
      method: "POST",
      headers: { Authorization: `Bearer ${successClient.token}` },
      body: { sessionId: upSid },
    });
    fs.writeFileSync(
      `${OUT}/api_success_fulfil.json`,
      JSON.stringify({ status: fulfil.status, body: fulfil.json }, null, 2),
    );

    await page.goto(`${FE}/dashboard/billing-history`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/04_billing_history_after.png`, fullPage: true });

    await page.goto(`${FE}/dashboard/my-subscriptions`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/05_after_upgrade_subscriptions.png`, fullPage: true });

    // Re-login
    await page.goto(`${FE}/login`, { waitUntil: "networkidle", timeout: 60000 });
    await page.evaluate(async () => {
      await fetch("/frontend-api/auth/signout", { method: "POST" }).catch(() => {});
    });
    await loginPage(page, successClient.email, successClient.password);
    await page.goto(`${FE}/dashboard/billing-history`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/06_billing_after_relogin.png`, fullPage: true });
    await page.goto(`${FE}/dashboard/my-subscriptions`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/09_subscriptions_after_relogin.png`, fullPage: true });

    const after = await request("/api/my-services", {
      headers: { Authorization: `Bearer ${successClient.token}` },
    });
    const hist = await request("/api/compat/client/transaction/list", {
      headers: { Authorization: `Bearer ${successClient.token}` },
    });
    fs.writeFileSync(`${OUT}/api_after_services.json`, JSON.stringify(after.json, null, 2));
    fs.writeFileSync(`${OUT}/api_billing_history.json`, JSON.stringify(hist.json, null, 2));
    await context.close();
  }

  await browser.close();
  fs.writeFileSync(
    `${OUT}/browser_report.json`,
    JSON.stringify(
      {
        mode: "SIMULATED — FakePaymentProvider + Playwright (not Stripe TEST)",
        stripe: "BLOCKED",
        captured: fs.readdirSync(OUT).filter((f) => f.endsWith(".png")),
      },
      null,
      2,
    ),
  );
  console.log("OK", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
