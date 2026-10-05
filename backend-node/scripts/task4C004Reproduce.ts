/**
 * Task 4 / Toxel C-004 — reproduce BEFORE fix.
 *
 * Proves whether an existing SA client can buy MTD (and vice versa) through the
 * normal customer UI. Uses PAYMENT_PROVIDER=fake local fulfilment (not Stripe).
 *
 * Artifacts: /opt/cursor/artifacts/task4-c004-repro (outside git).
 */
import { chromium } from "playwright";
import { createHash, randomBytes, randomUUID } from "crypto";
import { mkdirSync, writeFileSync } from "fs";

const ART = process.env.TASK4_ARTIFACT_DIR || "/opt/cursor/artifacts/task4-c004-repro";
const FE = process.env.TASK4_FE_URL || "http://127.0.0.1:3000";
const API = process.env.TASK4_API_URL || "http://127.0.0.1:8002";
const SHA = process.env.TASK4_SHA || "unknown";

mkdirSync(ART, { recursive: true });

async function api(method: string, path: string, { token, json }: { token?: string; json?: unknown } = {}) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: string | undefined;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }
  const res = await fetch(`${API}${path}`, { method, headers, body });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* keep text */
  }
  return { status: res.status, data };
}

function report(path: string, obj: unknown) {
  writeFileSync(`${ART}/${path}`, JSON.stringify(obj, null, 2));
}

async function main() {
  const stamp = randomUUID().slice(0, 8);
  const email = `c004.sa.${stamp}@mailpit.local`;
  const password = "C004Repro!99";
  const out: Record<string, unknown> = {
    toxelTestId: "C-004",
    sha: SHA,
    mode: "LOCAL reproduction BEFORE fix (PAYMENT_PROVIDER=fake)",
    note: "Real Stripe TEST checkout BLOCKED — no STRIPE_SECRET_KEY. Fake provider fulfilment used.",
    email,
    steps: [] as unknown[],
  };
  const steps = out.steps as Record<string, unknown>[];

  // 1. Register as SA journey
  const reg = await api("POST", "/api/compat/auth/register", {
    json: {
      email,
      password,
      firstName: "C004",
      lastName: "SaClient",
      phone: "+447700900123",
      userRole: "TAXSIMBA",
    },
  });
  steps.push({ step: "register_sa", status: reg.status, ok: reg.status === 200 || reg.status === 201 });
  const token =
    (reg.data as any)?.data?.accessToken ||
    (reg.data as any)?.data?.access_token ||
    (reg.data as any)?.accessToken;
  if (!token) {
    out.fail = "No access token from register";
    report("repro_report.json", out);
    process.exit(1);
  }

  // Force-verify email in Mongo for local proof
  const { MongoClient } = await import("mongodb");
  const { config } = await import("dotenv");
  config();
  const mongo = new MongoClient(process.env.MONGO_URL || "mongodb://127.0.0.1:27017");
  await mongo.connect();
  const db = mongo.db(process.env.DB_NAME || "taxsimba_node");
  await db.collection("users").updateOne(
    { email },
    { $set: { email_verified_at: new Date().toISOString() } },
  );
  const user = await db.collection("users").findOne({ email });
  const client = await db.collection("clients").findOne({ user_id: user?.id });
  const servicesBefore = await db
    .collection("client_services")
    .find({ client_id: client?.id })
    .toArray();
  steps.push({
    step: "bootstrap_services_after_register",
    onboardingIntent: client?.onboarding_intent,
    services: servicesBefore.map((s) => ({ type: s.service_type, status: s.status })),
  });

  // Login for fresh ownership JWT
  const login = await api("POST", "/api/compat/auth/login", { json: { email, password } });
  const access =
    (login.data as any)?.data?.accessToken ||
    (login.data as any)?.data?.access_token ||
    token;

  // 2. Buy SA via fake checkout
  const plans = await api("GET", "/api/compat/subscription-plans?category=taxSimba");
  const simple = ((plans.data as any)?.data || []).find((p: any) => p.code === "SIMPLE");
  const checkout = await api("POST", "/api/compat/client/subscription/checkout-session", {
    token: access,
    json: { planId: simple.id, origin_url: FE },
  });
  const sessionId =
    (checkout.data as any)?.data?.sessionId || (checkout.data as any)?.data?.session_id;
  steps.push({
    step: "sa_checkout_session",
    status: checkout.status,
    sessionId: sessionId ? "present" : null,
    mode: (checkout.data as any)?.data?.mode,
  });

  // Fake-pay: mark session paid then call checkout-success
  // Fake provider stores sessions in memory of the API process — use checkout-success which calls fulfil
  const success = await api("POST", "/api/compat/client/subscription/checkout-success", {
    token: access,
    json: { sessionId, session_id: sessionId },
  });
  steps.push({
    step: "sa_checkout_success",
    status: success.status,
    bodyKeys: Object.keys((success.data as any)?.data || {}),
  });

  const myServicesSa = await api("GET", "/api/my-services", { token: access });
  steps.push({ step: "my_services_after_sa", status: myServicesSa.status, body: myServicesSa.data });

  const detailsSa = await api("POST", "/api/compat/auth/get-account-details", {
    token: access,
    json: {},
  });
  const dSa = (detailsSa.data as any)?.data || {};
  steps.push({
    step: "account_details_after_sa",
    hasActiveSa: dSa.hasActiveSa,
    hasActiveMtd: dSa.hasActiveMtd,
    ownership: dSa.ownership,
    onboardingIntent: dSa.onboardingIntent,
    continuePath: dSa.continuePath,
    catalogueCategory: dSa.catalogueCategory,
  });

  // Accept engagement so dashboard is reachable
  await api("POST", "/api/compat/client/engagement-letter/accept", {
    token: access,
    json: { signature: "C004 Sa", agreed: true },
  }).catch(() => undefined);
  // Try alternate engagement endpoints
  await api("POST", "/api/engagement/accept", {
    token: access,
    json: { signature: "C004 Sa", agreed: true },
  }).catch(() => undefined);

  // 3. Browser: can SA client reach MTD planlist & purchase via normal UI?
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto(`${FE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator('input[name="email"], input[type="email"]').first().fill(email);
  await page.locator('input[name="password"], input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: /log in|sign in|login/i }).first().click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${ART}/01_after_sa_login.png`, fullPage: true });
  steps.push({ step: "browser_after_sa_login", url: page.url() });

  // Current Subscription — look for MTD purchase CTA
  await page.goto(`${FE}/dashboard/my-subscriptions`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${ART}/02_my_subscriptions_sa_only.png`, fullPage: true });
  const subText = await page.locator("body").innerText();
  const hasAddMtdCta =
    /add making tax digital|buy making tax digital|add mtd|get mtd|making tax digital/i.test(
      subText,
    ) && /planlist\?category=mtd/i.test(await page.content());
  // Also check for any link to mtd planlist
  const mtdPlanLinks = await page.locator('a[href*="category=mtd"], button').allTextContents();
  steps.push({
    step: "ui_my_subscriptions_add_mtd_cta",
    hasAddMtdCta,
    bodyHasMtdPhrase: /making tax digital|mtd/i.test(subText),
    upgradeOnlySa:
      /upgrade|view packages|current subscription/i.test(subText) &&
      !(await page.locator('a[href*="category=mtd"]').count()),
    linkTexts: mtdPlanLinks.slice(0, 20),
  });

  // Bare /planlist — should follow onboarding intent → SA catalogue, NOT offer MTD
  await page.goto(`${FE}/planlist`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${ART}/03_bare_planlist_after_sa.png`, fullPage: true });
  const bareUrl = page.url();
  const bareBody = await page.locator("body").innerText();
  steps.push({
    step: "bare_planlist_locks_to_sa_intent",
    url: bareUrl,
    showsSaPlans: /simple|smart|elite|self assessment|tax simba/i.test(bareBody),
    showsMtdPlans: /simbian|comply|growth|making tax digital/i.test(bareBody),
    lockedToSaCatalogue:
      bareUrl.includes("category=taxSimba") ||
      (/simple|smart|elite/i.test(bareBody) && !/simbian comply|mtd_/i.test(bareBody)),
  });

  // Explicit MTD catalogue deep link — API path must work even if UI CTA missing
  await page.goto(`${FE}/planlist?category=mtd`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${ART}/04_explicit_mtd_planlist.png`, fullPage: true });
  const mtdBody = await page.locator("body").innerText();
  steps.push({
    step: "explicit_mtd_planlist_reachable",
    url: page.url(),
    showsMtdPlans: /simbian|comply|growth|making tax digital/i.test(mtdBody),
  });

  // API: can SA client start MTD checkout?
  const mtdPlans = await api("GET", "/api/compat/subscription-plans?category=mtd");
  const growth = ((mtdPlans.data as any)?.data || []).find((p: any) => p.code === "MTD_GROWTH");
  const mtdCheckout = await api("POST", "/api/compat/client/subscription/checkout-session", {
    token: access,
    json: { planId: growth?.id, origin_url: FE },
  });
  steps.push({
    step: "api_mtd_checkout_while_sa_active",
    status: mtdCheckout.status,
    ok: mtdCheckout.status === 200,
    error: (mtdCheckout.data as any)?.detail || (mtdCheckout.data as any)?.message || null,
  });

  // Sidebar / dashboard: is there navigation to buy second service?
  await page.goto(`${FE}/dashboard`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${ART}/05_sa_dashboard.png`, fullPage: true });
  const dashHtml = await page.content();
  steps.push({
    step: "sa_dashboard_second_service_nav",
    hasMtdPlanlistLink: dashHtml.includes("category=mtd"),
    hasWorkspaceSwitcher: dashHtml.includes("service-workspace-switcher"),
  });

  out.rootCauseHypothesis = [
    "Registration persists onboarding_intent permanently; bare /planlist and Current Subscription CTAs stay locked to that catalogue.",
    "No in-dashboard CTA for SA clients to purchase MTD (or MTD→SA).",
    "API checkout for the second service may still work if the client discovers /planlist?category=mtd — UI journey failure is the primary C-004 defect.",
  ];
  out.reproducedFailure =
    steps.find((s) => s.step === "ui_my_subscriptions_add_mtd_cta")?.upgradeOnlySa === true ||
    steps.find((s) => s.step === "bare_planlist_locks_to_sa_intent")?.lockedToSaCatalogue === true;

  await browser.close();
  await mongo.close();
  report("repro_report.json", out);
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.reproducedFailure ? 0 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
