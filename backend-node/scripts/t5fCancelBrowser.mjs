/**
 * Capture cancel-path + dashboard screenshots after accepting engagement letter.
 * Uses existing success clients from seed or creates fresh SIMPLE client.
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

async function acceptEngagement(token) {
  // Must be AFTER active service exists.
  const r = await request("/api/compat/client/accept-engagement-letter", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: {
      accepted: true,
      signature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      signed_name: "T5F Cancel",
    },
  });
  return r;
}

async function seedSimple(tag) {
  const email = `t5f.${tag}.${Date.now()}@taxsimba.test`;
  await request("/api/auth/register", {
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
    { $set: { email_verified_at: new Date().toISOString(), status: "ACTIVE", is_active: true } },
  );
  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email, password: PASSWORD },
  });
  const token = login.json?.access_token;
  const pkgs = await request("/api/packages?service_type=SELF_ASSESSMENT", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const smart = (pkgs.json || []).find((p) => p.code === "SMART");
  const buy = await request("/api/payments/service-checkout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { service_type: "SELF_ASSESSMENT", package_code: "SIMPLE", origin_url: FE },
  });
  const sid = buy.json?.session_id;
  // Fake provider: checkout-success fulfils
  let ok = await request("/api/compat/client/subscription/checkout-success", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { sessionId: sid },
  });
  if (ok.status >= 400) {
    await db.collection("payment_transactions").updateOne(
      { session_id: sid },
      {
        $set: {
          payment_status: "paid",
          status: "completed",
          stripe_payment_intent_id: `pi_${randomUUID().slice(0, 8)}`,
          updated_at: new Date().toISOString(),
        },
      },
    );
    ok = await request("/api/compat/client/subscription/checkout-success", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: { sessionId: sid },
    });
  }
  const eng = await acceptEngagement(token);
  await mongo.close();
  return { email, password: PASSWORD, token, smartPlanId: smart?.id, eng: { status: eng.status, body: eng.json } };
}

async function main() {
  // Restart backend to pick up inflight fix? Prefer killing and restarting.
  const cancel = await seedSimple("cancel2");
  fs.writeFileSync(`${OUT}/cancel2_seed.json`, JSON.stringify(cancel, null, 2));

  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/local/bin/google-chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
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
    { csrfToken: csrf.csrfToken, email: cancel.email, password: cancel.password },
  );

  await page.goto(`${FE}/dashboard/my-subscriptions`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(3000);
  console.log("before url", page.url());
  await page.screenshot({ path: `${OUT}/07_cancel_before_subscriptions_simple.png`, fullPage: true });
  console.log("before text", (await page.locator("body").innerText()).slice(0, 400));

  // Start upgrade then abandon (expire)
  const co = await request("/api/payments/upgrade-checkout", {
    method: "POST",
    headers: { Authorization: `Bearer ${cancel.token}` },
    body: { package_code: "SMART", origin_url: FE },
  });
  const sid = co.json?.session_id;
  const mongo = new MongoClient("mongodb://127.0.0.1:27017");
  await mongo.connect();
  await mongo
    .db("taxsimba_sa_cert_e2e")
    .collection("payment_transactions")
    .updateOne(
      { session_id: sid },
      { $set: { status: "expired", payment_status: "expired", updated_at: new Date().toISOString() } },
    );
  await mongo.close();

  await page.goto(`${FE}/dashboard/my-subscriptions`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/08_cancel_after_still_simple.png`, fullPage: true });
  console.log("after url", page.url());
  console.log("after text", (await page.locator("body").innerText()).slice(0, 500));

  const services = await request("/api/my-services", {
    headers: { Authorization: `Bearer ${cancel.token}` },
  });
  fs.writeFileSync(`${OUT}/api_cancel_services_after.json`, JSON.stringify(services.json, null, 2));
  fs.writeFileSync(
    `${OUT}/api_cancel_expired_tx.json`,
    JSON.stringify({ session_id: sid, checkout: co.json }, null, 2),
  );

  await browser.close();
  console.log("OK cancel screenshots");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
