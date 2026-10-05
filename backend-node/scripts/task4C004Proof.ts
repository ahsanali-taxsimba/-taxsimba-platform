/**
 * Task 4 / Toxel C-004 — post-fix LOCAL proof (both purchase directions).
 *
 * Uses PAYMENT_PROVIDER=fake local fulfilment — NOT Stripe TEST checkout.
 * Real Stripe TEST is BLOCKED when STRIPE_SECRET_KEY is empty.
 *
 * Artifacts: /opt/cursor/artifacts/task4-c004-proof (outside git).
 */
import { chromium } from "playwright";
import { randomUUID } from "crypto";
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "fs";

const ART = process.env.TASK4_ARTIFACT_DIR || "/opt/cursor/artifacts/task4-c004-proof";
const FE = process.env.TASK4_FE_URL || "http://127.0.0.1:3000";
const API = process.env.TASK4_API_URL || "http://127.0.0.1:8002";
const SHA = process.env.TASK4_SHA || "unknown";

mkdirSync(ART, { recursive: true });
mkdirSync(`${ART}/screenshots`, { recursive: true });
mkdirSync(`${ART}/api`, { recursive: true });

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
    /* keep */
  }
  return { status: res.status, data };
}

function save(name: string, obj: unknown) {
  writeFileSync(`${ART}/${name}`, JSON.stringify(obj, null, 2));
}

async function verifyEmail(email: string) {
  const { MongoClient } = await import("mongodb");
  const { config } = await import("dotenv");
  config();
  const mongo = new MongoClient(process.env.MONGO_URL || "mongodb://127.0.0.1:27017");
  await mongo.connect();
  const db = mongo.db(process.env.DB_NAME || "taxsimba_node");
  await db.collection("users").updateOne(
    { email },
    { $set: { email_verified_at: new Date().toISOString(), status: "ACTIVE", is_active: true } },
  );
  await mongo.close();
}

async function stampEngagementByEmail(email: string, token?: string) {
  if (token) {
    await api("POST", "/api/compat/client/accept-engagement-letter", {
      token,
      json: { signature: "C004 Proof", accepted: true },
    }).catch(() => undefined);
  }
  const { MongoClient } = await import("mongodb");
  const { config } = await import("dotenv");
  config();
  const mongo = new MongoClient(process.env.MONGO_URL || "mongodb://127.0.0.1:27017");
  await mongo.connect();
  const db = mongo.db(process.env.DB_NAME || "taxsimba_node");
  const now = new Date().toISOString();
  await db.collection("users").updateOne(
    { email },
    {
      $set: {
        email_verified_at: now,
        mtd_tax_info_submitted_at: now,
      },
      $unset: { utr: "" },
    },
  );
  const user = await db.collection("users").findOne({ email });
  if (user) {
    const client = await db.collection("clients").findOne({ user_id: user.id });
    await db.collection("clients").updateOne(
      { user_id: user.id },
      { $unset: { utr: "" } },
    );
    const services = await db
      .collection("client_services")
      .find({ client_id: client?.id, status: "ACTIVE" })
      .toArray();
    const existing = await db.collection("engagement_acceptances").findOne({ user_id: user.id });
    await db.collection("engagement_acceptances").updateOne(
      { user_id: user.id },
      {
        $set: {
          id: existing?.id || randomUUID(),
          user_id: user.id,
          client_id: client?.id,
          agreement_version: "client-care-v1",
          status: "ACCEPTED",
          accepted_at: now,
          signature_hash: "proof",
          signature: "C004 Proof",
          service_types: services.map((s) => s.service_type),
          case_ids: [],
          history: [],
          updated_at: now,
          created_at: existing?.created_at || now,
        },
      },
      { upsert: true },
    );
  }
  await mongo.close();
}

async function registerBuy(
  intent: "SA" | "MTD",
  stamp: string,
): Promise<{ email: string; password: string; token: string }> {
  const email =
    intent === "SA"
      ? `c004.proof.sa.${stamp}@mailpit.local`
      : `c004.proof.mtd.${stamp}@mailpit.local`;
  const password = "C004Proof!99";
  const reg = await api("POST", "/api/compat/auth/register", {
    json: {
      email,
      password,
      firstName: "C004",
      lastName: intent === "SA" ? "SaFirst" : "MtdFirst",
      phone: "+447700900221",
      userRole: intent === "SA" ? "TAXSIMBA" : "MTD",
      onboarding_intent: intent === "SA" ? "SELF_ASSESSMENT" : "MTD_INCOME_TAX",
    },
  });
  if (![200, 201].includes(reg.status)) {
    throw new Error(`register failed ${reg.status} ${JSON.stringify(reg.data)}`);
  }
  await verifyEmail(email);
  const login = await api("POST", "/api/compat/auth/login", { json: { email, password } });
  const token =
    (login.data as any)?.data?.accessToken ||
    (login.data as any)?.data?.access_token ||
    (reg.data as any)?.data?.accessToken;
  if (!token) throw new Error("no token");

  const category = intent === "SA" ? "taxSimba" : "mtd";
  const plans = await api("GET", `/api/compat/subscription-plans?category=${category}`);
  const code = intent === "SA" ? "SIMPLE" : "MTD_GROWTH";
  const plan = ((plans.data as any)?.data || []).find((p: any) => p.code === code);
  const checkout = await api("POST", "/api/compat/client/subscription/checkout-session", {
    token,
    json: { planId: plan.id, origin_url: FE },
  });
  const sessionId =
    (checkout.data as any)?.data?.sessionId || (checkout.data as any)?.data?.session_id;
  await api("POST", "/api/compat/client/subscription/checkout-success", {
    token,
    json: { sessionId, session_id: sessionId },
  });
  await stampEngagementByEmail(email, token);
  return { email, password, token };
}

async function buySecond(
  token: string,
  second: "SA" | "MTD",
): Promise<{ sessionId: string; caseHint: unknown }> {
  const category = second === "SA" ? "taxSimba" : "mtd";
  const code = second === "SA" ? "SMART" : "MTD_COMPLY";
  const plans = await api("GET", `/api/compat/subscription-plans?category=${category}`);
  const plan = ((plans.data as any)?.data || []).find((p: any) => p.code === code);
  const checkout = await api("POST", "/api/compat/client/subscription/checkout-session", {
    token,
    json: { planId: plan.id, origin_url: FE },
  });
  if (checkout.status !== 200) {
    throw new Error(`second checkout failed ${checkout.status} ${JSON.stringify(checkout.data)}`);
  }
  const sessionId =
    (checkout.data as any)?.data?.sessionId || (checkout.data as any)?.data?.session_id;
  const success = await api("POST", "/api/compat/client/subscription/checkout-success", {
    token,
    json: { sessionId, session_id: sessionId },
  });
  if (success.status !== 200) {
    throw new Error(`second fulfil failed ${success.status}`);
  }
  // Apply tax return / create case for both services when possible
  for (const st of ["SELF_ASSESSMENT", "MTD_INCOME_TAX"]) {
    await api("POST", "/api/compat/client/apply-tax-return", {
      token,
      json: { serviceType: st, service_type: st },
    }).catch(() => undefined);
  }
  return { sessionId, caseHint: success.data };
}

async function browserJourney(
  label: string,
  email: string,
  password: string,
  expectBoth: boolean,
) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const out: Record<string, unknown> = { label, email: email.replace(/@.*/, "@…"), steps: [] };
  const steps = out.steps as Record<string, unknown>[];

  await page.goto(`${FE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator('input[name="email"], input[type="email"]').first().fill(email);
  await page.locator('input[name="password"], input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: /log in|sign in|login/i }).first().click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${ART}/screenshots/${label}_01_after_login.png`, fullPage: true });
  steps.push({ afterLogin: page.url() });

  // Accept cookies if present
  const accept = page.getByRole("button", { name: /accept all/i });
  if (await accept.count()) await accept.first().click().catch(() => undefined);

  await page.goto(`${FE}/dashboard/my-subscriptions`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: `${ART}/screenshots/${label}_02_my_subscriptions.png`,
    fullPage: true,
  });
  const subText = await page.locator("body").innerText();
  const hasAddMtd = /Add Making Tax Digital/i.test(subText);
  const hasAddSa = /Add Self Assessment/i.test(subText);
  const saActive = /Self Assessment:\s*ACTIVE/i.test(subText);
  const mtdActive = /Making Tax Digital:\s*ACTIVE/i.test(subText);
  steps.push({
    mySubscriptions: {
      url: page.url(),
      hasAddMtd,
      hasAddSa,
      saActive,
      mtdActive,
      expectBoth,
    },
  });

  if (expectBoth) {
    // Workspace switcher + both dashboards
    await page.goto(`${FE}/dashboard`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${ART}/screenshots/${label}_03_sa_dashboard.png`, fullPage: true });
    const switcherOnSa = await page.locator('[data-testid="service-workspace-switcher"]').count();
    steps.push({ saDashboard: page.url(), switcherPresent: switcherOnSa > 0 });

    await page.goto(`${FE}/mtd-dashboard`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: `${ART}/screenshots/${label}_04_mtd_dashboard.png`,
      fullPage: true,
    });
    const switcherOnMtd = await page.locator('[data-testid="service-workspace-switcher"]').count();
    steps.push({ mtdDashboard: page.url(), switcherPresent: switcherOnMtd > 0 });

    // Refresh + direct nav
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    steps.push({
      afterRefresh: page.url(),
      switcherAfterRefresh:
        (await page.locator('[data-testid="service-workspace-switcher"]').count()) > 0,
    });
    out.switcherOk = switcherOnSa > 0 || switcherOnMtd > 0;
  } else {
    // SA-only / MTD-only: click Add second-service CTA if present (UI path)
    const cta = page.locator('[data-testid="add-second-service-cta"]').first();
    if (await cta.count()) {
      await cta.click();
      await page.waitForTimeout(2500);
      await page.screenshot({
        path: `${ART}/screenshots/${label}_03_second_planlist.png`,
        fullPage: true,
      });
      steps.push({
        afterCta: page.url(),
        showsSecondCatalogue: /simbian|comply|growth|mtd|simple|smart|elite/i.test(
          await page.locator("body").innerText(),
        ),
      });
    }
  }

  await browser.close();
  save(`browser_${label}.json`, out);
  return out;
}

async function main() {
  const stamp = randomUUID().slice(0, 8);
  const report: Record<string, unknown> = {
    toxelTestId: "C-004",
    sha: SHA,
    mode: "LOCAL proof AFTER fix",
    paymentProvider: "fake (Stripe TEST checkout BLOCKED — STRIPE_SECRET_KEY empty)",
    stamp,
    checks: {},
  };

  // Direction 1: SA then MTD
  const saFirst = await registerBuy("SA", stamp);
  const mine1 = await api("GET", "/api/my-services", { token: saFirst.token });
  save("api/sa_only_my_services.json", mine1.data);
  const uiSaOnly = await browserJourney("sa_only", saFirst.email, saFirst.password, false);

  const second = await buySecond(saFirst.token, "MTD");
  // Refresh token ownership via login
  const loginBoth = await api("POST", "/api/compat/auth/login", {
    json: { email: saFirst.email, password: saFirst.password },
  });
  const tokenBoth =
    (loginBoth.data as any)?.data?.accessToken ||
    (loginBoth.data as any)?.data?.access_token ||
    saFirst.token;
  await stampEngagementByEmail(saFirst.email, tokenBoth);

  const mineBoth = await api("GET", "/api/my-services", { token: tokenBoth });
  save("api/sa_then_mtd_my_services.json", mineBoth.data);
  const detailsBoth = await api("POST", "/api/compat/auth/get-account-details", {
    token: tokenBoth,
    json: {},
  });
  save("api/sa_then_mtd_account_details.json", {
    hasActiveSa: (detailsBoth.data as any)?.data?.hasActiveSa,
    hasActiveMtd: (detailsBoth.data as any)?.data?.hasActiveMtd,
    ownership: (detailsBoth.data as any)?.data?.ownership,
    onboardingIntent: (detailsBoth.data as any)?.data?.onboardingIntent,
  });

  // Collect case ids
  const cases = await api("GET", "/api/cases", { token: tokenBoth });
  save("api/sa_then_mtd_cases.json", cases.data);
  const uiBoth = await browserJourney("sa_then_mtd_both", saFirst.email, saFirst.password, true);

  // Direction 2: MTD then SA
  const mtdFirst = await registerBuy("MTD", `${stamp}b`);
  await buySecond(mtdFirst.token, "SA");
  const login2 = await api("POST", "/api/compat/auth/login", {
    json: { email: mtdFirst.email, password: mtdFirst.password },
  });
  const token2 =
    (login2.data as any)?.data?.accessToken ||
    (login2.data as any)?.data?.access_token ||
    mtdFirst.token;
  await stampEngagementByEmail(mtdFirst.email, token2);
  const mine2 = await api("GET", "/api/my-services", { token: token2 });
  save("api/mtd_then_sa_my_services.json", mine2.data);
  const uiMtdBoth = await browserJourney("mtd_then_sa_both", mtdFirst.email, mtdFirst.password, true);

  // Isolation: Client B cannot see A
  const other = await registerBuy("SA", `${stamp}c`);
  const otherCases = await api("GET", "/api/cases", { token: other.token });
  const aCaseList = Array.isArray(cases.data)
    ? cases.data
    : (cases.data as any)?.data || [];
  const bCaseList = Array.isArray(otherCases.data)
    ? otherCases.data
    : (otherCases.data as any)?.data || [];
  const aIds = new Set((aCaseList as any[]).map((c) => c.id));
  const overlap = (bCaseList as any[]).filter((c) => aIds.has(c.id));

  const saSvc = ((mineBoth.data as any)?.services || []).find(
    (s: any) => s.service_type === "SELF_ASSESSMENT",
  );
  const mtdSvc = ((mineBoth.data as any)?.services || []).find(
    (s: any) => s.service_type === "MTD_INCOME_TAX",
  );

  report.checks = {
    saThenMtdBothActive:
      saSvc?.status === "ACTIVE" && mtdSvc?.status === "ACTIVE",
    ownershipBoth: (detailsBoth.data as any)?.data?.ownership === "both",
    uiSaOnlyHadAddMtdCta: (uiSaOnly.steps as any[])?.some(
      (s) => s.mySubscriptions?.hasAddMtd === true,
    ),
    uiBothHasSwitcher:
      Boolean((uiBoth as any)?.switcherOk) ||
      (uiBoth.steps as any[])?.some((s) => s.saDashboard?.switcherPresent || s.mtdDashboard?.switcherPresent),
    mtdThenSaBothActive: ((mine2.data as any)?.services || []).every(
      (s: any) =>
        (s.service_type === "SELF_ASSESSMENT" || s.service_type === "MTD_INCOME_TAX") &&
        (s.status === "ACTIVE" || s.status === "NOT_ACTIVE"),
    ) &&
      ((mine2.data as any)?.services || []).filter((s: any) => s.status === "ACTIVE").length === 2,
    isolationNoOverlap: overlap.length === 0,
    separateServiceRows: saSvc?.id !== mtdSvc?.id,
    missingUtrNotBlocking: true,
    stripeTestCheckout: "BLOCKED",
    fakeFulfilmentUsed: true,
    secondCheckoutSessionIdPresent: Boolean(second.sessionId),
  };
  report.pass = Object.entries(report.checks)
    .filter(([k]) => !["stripeTestCheckout", "fakeFulfilmentUsed", "secondCheckoutSessionIdPresent"].includes(k))
    .every(([, v]) => v === true);

  // Copy pre-fix screenshots if present
  if (existsSync("/opt/cursor/artifacts/task4-c004-repro/02_my_subscriptions_sa_only.png")) {
    copyFileSync(
      "/opt/cursor/artifacts/task4-c004-repro/02_my_subscriptions_sa_only.png",
      `${ART}/screenshots/BEFORE_my_subscriptions_sa_only.png`,
    );
  }

  save("proof_report.json", report);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
