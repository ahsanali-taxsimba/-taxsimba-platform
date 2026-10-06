/**
 * Fresh browser/API proof for F-002 (SA questionnaire) and F-012–F-014 (certificate gate).
 * LOCAL/SIMULATED: PAYMENT_PROVIDER=fake, Mailpit SMTP.
 */
import { createRequire } from "module";
import { randomUUID } from "crypto";
import fs from "fs";
import http from "http";
import { MongoClient } from "mongodb";

const require = createRequire(import.meta.url);
const { chromium } = require("/workspace/tax_simba_frontend/node_modules/playwright");

const API = process.env.API_BASE || "http://127.0.0.1:8002";
const CLIENT = process.env.CLIENT_BASE || "http://127.0.0.1:3000";
const ADMIN = process.env.ADMIN_BASE || "http://127.0.0.1:3001";
const OUT = "/opt/cursor/artifacts/f002_f012_browser_20261006";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const CHECKLIST = {
  client_information_reviewed: true,
  required_documents_reviewed: true,
  income_checked: true,
  allowable_expenses_checked: true,
  tax_calculation_checked: true,
  supporting_documents_attached: true,
  return_ready: true,
};

fs.mkdirSync(OUT, { recursive: true });
const results = [];
const log = (s) => {
  console.log(s);
  results.push(s);
};

function request(pathname, { method = "GET", headers = {}, body = null, form = null } = {}) {
  if (form) {
    return fetch(`${API}${pathname}`, {
      method,
      headers: { Accept: "application/json", ...headers },
      body: form,
    }).then(async (res) => {
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* raw */
      }
      return { status: res.status, json, text };
    });
  }
  const u = new URL(pathname.startsWith("http") ? pathname : API + pathname);
  const payload = body == null ? null : typeof body === "string" ? body : JSON.stringify(body);
  const h = { ...headers };
  if (payload && !h["Content-Type"]) h["Content-Type"] = "application/json";
  if (payload) h["Content-Length"] = Buffer.byteLength(payload);
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search, method, headers: h },
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

async function apiLogin(email, password) {
  const res = await request("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  if (res.status !== 200) throw new Error(`login ${email} ${res.status}`);
  return {
    token: res.json.access_token || res.json.accessToken,
    user: res.json.user || res.json.data?.user,
    raw: res.json,
  };
}

async function clientLogin(page, email, password, dest = "/dashboard") {
  await page.goto(`${CLIENT}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const accept = page.locator('button:has-text("Accept All")');
  if (await accept.count()) await accept.click().catch(() => {});
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
    { csrfToken: csrf.csrfToken, email, password, callbackUrl: `${CLIENT}${dest}` },
  );
  await page.goto(`${CLIENT}${dest}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
}

async function adminLogin(page, email = "admin@taxsimba.co.uk", password = "Admin@123") {
  await page.goto(`${ADMIN}/admin/auth/signin`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await Promise.all([
    page.waitForURL(/\/admin\//, { timeout: 45000 }).catch(() => null),
    page.locator('input[name="password"]').press("Enter"),
  ]);
  if (page.url().includes("signin")) {
    await page.getByRole("button", { name: /sign in/i }).click().catch(() => {});
    await page.waitForTimeout(2500);
  }
}

async function seedSaClient() {
  const suffix = randomUUID().slice(0, 8);
  const email = `f002.${suffix}@taxsimba.test`;
  const password = "Client@12345";
  await request("/api/auth/register", {
    method: "POST",
    body: {
      email,
      password,
      name: `F002 ${suffix}`,
      phone: "+447700900222",
      onboarding_intent: "SA",
    },
  });
  const mongo = new MongoClient(process.env.MONGO_URL || "mongodb://127.0.0.1:27017");
  await mongo.connect();
  const db = mongo.db(process.env.DB_NAME || "taxsimba_sa_cert_e2e");
  await db.collection("users").updateOne(
    { email: email.toLowerCase() },
    { $set: { email_verified_at: new Date().toISOString(), status: "ACTIVE", is_active: true } },
  );
  const user = await db.collection("users").findOne({ email: email.toLowerCase() });
  await mongo.close();

  let client = await apiLogin(email, password);
  const pkgs = await request("/api/packages?service_type=SELF_ASSESSMENT", {
    headers: { Authorization: `Bearer ${client.token}` },
  });
  const simple = (Array.isArray(pkgs.json) ? pkgs.json : []).find((p) => p.code === "SIMPLE");
  if (!simple) throw new Error("SIMPLE package missing");
  const checkout = await request("/api/compat/client/subscription/checkout-session", {
    method: "POST",
    headers: { Authorization: `Bearer ${client.token}` },
    body: { planId: simple.id, origin_url: CLIENT },
  });
  if (checkout.status !== 200) throw new Error(`checkout ${checkout.status}`);
  const sessionId = checkout.json?.data?.sessionId || checkout.json?.data?.session_id;
  await request("/api/compat/client/subscription/checkout-success", {
    method: "POST",
    headers: { Authorization: `Bearer ${client.token}` },
    body: { sessionId, session_id: sessionId },
  });

  // Accept engagement with required signature
  const eng = await request("/api/compat/client/accept-engagement-letter", {
    method: "POST",
    headers: { Authorization: `Bearer ${client.token}` },
    body: { signature: "F002 Browser Proof", accepted: true },
  });
  log(`accept-engagement ${eng.status}`);
  if (eng.status !== 200) throw new Error(`engagement ${eng.status} ${eng.text?.slice(0, 200)}`);

  await request("/api/compat/client/apply-tax-return", {
    method: "POST",
    headers: { Authorization: `Bearer ${client.token}` },
    body: { serviceType: "SELF_ASSESSMENT", service_type: "SELF_ASSESSMENT" },
  });

  // F-002: SA questionnaire without UTR (multipart like production wizard)
  const form = new FormData();
  form.append("serviceType", "SELF_ASSESSMENT");
  form.append("businessType", "Sole Trader");
  form.append("businessName", "F002 Browser Biz");
  form.append("utr", "");
  form.append("jobRole", "Freelance designer");
  form.append("employmentStatus", "Self-employed");
  form.append("currentAccountant", "No — I handle it myself");
  form.append("incomeSources", JSON.stringify(["Self-Employment"]));
  form.append("annualTurnover", "Under £50,000");
  form.append("recordKeepingMethod", "Spreadsheets");
  form.append("accountantNotes", "F-002 browser proof");
  const tax = await request("/api/compat/client/submit-tax-info", {
    method: "POST",
    headers: { Authorization: `Bearer ${client.token}` },
    form,
  });
  if (tax.status !== 200) throw new Error(`submit-tax-info ${tax.status} ${tax.text?.slice(0, 300)}`);
  log(`submit-tax-info ${tax.status} (blank UTR)`);

  // Re-login so JWT/session flags refresh
  client = await apiLogin(email, password);
  const details = await request("/api/compat/auth/get-account-details", {
    method: "POST",
    headers: { Authorization: `Bearer ${client.token}` },
    body: {},
  });
  const d = details.json?.data || details.json;
  fs.writeFileSync(`${OUT}/f002_account_details.json`, JSON.stringify(d, null, 2));
  const submitted = d.isTaxInfoSubmitted === true || d.is_tax_info_submitted === true;
  const engOk = d.isEngagementLetterAccepted === true || d.is_engagement_letter_accepted === true;
  if (!submitted || !engOk) {
    throw new Error(`flags eng=${engOk} tax=${submitted}`);
  }
  if ((d.jobRole || d.job_role) !== "Freelance designer") {
    throw new Error(`jobRole missing in account details: ${d.jobRole || d.job_role}`);
  }
  log(`F-002-api-flags PASS eng=${engOk} tax=${submitted} job=${d.jobRole || d.job_role}`);

  return { email, password, token: client.token, userId: user.id, suffix };
}

async function advanceCaseToReadyForSubmission({ token, userId, suffix, email }) {
  const admin = await apiLogin("admin@taxsimba.co.uk", "Admin@123");
  const accountant = await apiLogin("accountant.a@taxsimba.co.uk", "Account@123");
  let caseId;
  const existing = await request("/api/cases?service_type=SELF_ASSESSMENT", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const cases = Array.isArray(existing.json) ? existing.json : existing.json?.data || [];
  if (cases.length) {
    caseId = cases[0].id;
  } else {
    const created = await request("/api/cases", {
      method: "POST",
      headers: { Authorization: `Bearer ${admin.token}` },
      body: {
        client_user_id: userId,
        tax_year: "2098/99",
        manual_creation_reason: "F-012 browser proof",
      },
    });
    if (created.status !== 200) throw new Error(`create case ${created.status}`);
    caseId = created.json.id;
  }

  const steps = [
    ["assign", `/api/cases/${caseId}/assign`, { accountant_id: accountant.user.id }, admin.token],
    ["start-review", `/api/cases/${caseId}/start-review`, {}, accountant.token],
  ];
  for (const [name, path, body, tok] of steps) {
    const r = await request(path, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}` },
      body,
    });
    if (r.status !== 200) log(`warn ${name} ${r.status}`);
  }
  const calc = await request(`/api/cases/${caseId}/calculations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accountant.token}` },
    body: { total_income: 42500.5, taxable_income: 30000, tax_due: 4280.75 },
  });
  if (calc.status !== 200) throw new Error(`calc ${calc.status}`);
  await request(`/api/cases/${caseId}/submit-for-admin-review`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accountant.token}` },
    body: { calculation_version_id: calc.json.id, checklist: CHECKLIST },
  });
  await request(`/api/cases/${caseId}/admin-approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${admin.token}` },
    body: { note: "ok" },
  });
  await request(`/api/cases/${caseId}/client-approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: {},
  });

  const progress = await request(`/api/compat/tax-return/${caseId}/progress`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accountant.token}` },
    body: {},
  });
  log(
    `ready progress status=${progress.json?.data?.status} node=${progress.json?.data?.nodeStatus} email=${email} suffix=${suffix}`,
  );
  return { caseId, admin, accountant };
}

async function main() {
  const build = await request("/api/build-info");
  const productSha = build.json?.gitSha || "unknown";
  log(`PRODUCT_SHA=${productSha}`);
  fs.writeFileSync(`${OUT}/build-info.json`, JSON.stringify(build.json, null, 2));

  const seeded = await seedSaClient();
  log(`F-002 seeded ${seeded.email}`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/local/bin/google-chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // F-002 dashboard without UTR
  await clientLogin(page, seeded.email, seeded.password, "/dashboard");
  await page.screenshot({ path: `${OUT}/f002_dashboard_no_utr.png`, fullPage: true });
  const dashUrl = page.url();
  const f002Dash = /\/dashboard/i.test(dashUrl) && !/engagement-letter/i.test(dashUrl);
  log(`F-002-dashboard ${f002Dash ? "PASS" : "FAIL"} url=${dashUrl}`);

  await page.goto(`${CLIENT}/dashboard/edit-profile`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/f002_profile_answers.png`, fullPage: true });
  const jobEl = page.locator('[data-testid="profile-job-role"]');
  const empEl = page.locator('[data-testid="profile-employment-status"]');
  const jobText = (await jobEl.count()) ? await jobEl.first().innerText() : "";
  const empText = (await empEl.count()) ? await empEl.first().innerText() : "";
  const hasJob = /Freelance designer/i.test(jobText);
  const hasEmployment = /Self-employed/i.test(empText);
  log(`F-002-profile ${hasJob && hasEmployment ? "PASS" : "FAIL"} job=${jobText} emp=${empText}`);

  // Re-login persistence
  await page.context().clearCookies();
  await clientLogin(page, seeded.email, seeded.password, "/dashboard/edit-profile");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/f002_profile_after_relogin.png`, fullPage: true });
  const job2 = (await jobEl.count()) ? await jobEl.first().innerText() : "";
  log(`F-002-relogin ${/Freelance designer/i.test(job2) ? "PASS" : "FAIL"} job=${job2}`);

  // Advance case for F-012
  const { caseId, accountant } = await advanceCaseToReadyForSubmission(seeded);

  // Admin sees onboarding answers
  await adminLogin(page);
  await page.goto(`${ADMIN}/admin/manage-tax/${caseId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/f002_admin_onboarding.png`, fullPage: true });
  const adminJob = page.locator('[data-testid="admin-client-job-role"]');
  const adminJobText = (await adminJob.count()) ? await adminJob.first().innerText() : "";
  log(`F-002-admin-access ${/Freelance designer/i.test(adminJobText) ? "PASS" : "FAIL"} job=${adminJobText}`);

  // F-012: at ready_for_submission, certificate CTA must not be available
  await page.goto(`${ADMIN}/admin/tax-return-list/${caseId}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/f012_ready_for_submission.png`, fullPage: true });

  const certBtnCount = await page.locator('[data-testid="upload-final-certificate-btn"]').count();
  const certBtnVisible =
    certBtnCount > 0
      ? await page.locator('[data-testid="upload-final-certificate-btn"]').first().isVisible()
      : false;
  const modalOpen = (await page.locator("text=Upload Tax return certificate").count()) > 0;

  // Attempt to force advance to certificate via status UI if present
  const selects = page.locator("select");
  const n = await selects.count();
  for (let i = 0; i < n; i++) {
    const opt = selects.nth(i).locator('option[value="final_submitted"]');
    if ((await opt.count()) > 0) {
      await selects.nth(i).selectOption("final_submitted").catch(() => null);
      await page.waitForTimeout(1200);
      break;
    }
  }
  const modalAfter = (await page.locator("text=Upload Tax return certificate").count()) > 0;
  const gateOk = !certBtnVisible && !modalOpen && !modalAfter;
  log(
    `F-012-block-cert-at-ready ${gateOk ? "PASS" : "FAIL"} certBtnVisible=${certBtnVisible} modal=${modalOpen||modalAfter}`,
  );
  await page.screenshot({ path: `${OUT}/f012_cert_blocked_at_ready.png`, fullPage: true });

  // Record external submission then upload certificate
  const rec = await request(`/api/compat/admin/tax-return/${caseId}/record-submission`, {
    method: "POST",
    headers: { Authorization: `Bearer ${(await apiLogin("admin@taxsimba.co.uk", "Admin@123")).token}` },
    body: {
      submissionDate: "2025-06-01",
      submissionReference: `HMRC-F012-${seeded.suffix}`,
      provider: "Test software",
    },
  });
  log(`record-submission ${rec.status} LOCAL/SIMULATED`);
  if (rec.status !== 200) throw new Error(`record-submission ${rec.status}`);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/f012_after_external_submission.png`, fullPage: true });

  const uploadBtn = page.locator('[data-testid="upload-final-certificate-btn"]').first();
  await uploadBtn.waitFor({ state: "visible", timeout: 60000 });
  await uploadBtn.click();
  await page.waitForSelector("text=Upload Tax return certificate", { timeout: 30000 });
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "sa-certificate-f012.pdf",
    mimeType: "application/pdf",
    buffer: PDF,
  });
  await page.locator('button:has-text("Upload & Notify Client")').click();
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${OUT}/f012_after_certificate_upload.png`, fullPage: true });

  const progressAfter = await request(`/api/compat/tax-return/${caseId}/progress`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accountant.token}` },
    body: {},
  });
  const completed =
    progressAfter.json?.data?.status === "completed" ||
    String(progressAfter.json?.data?.nodeStatus || "").toUpperCase() === "COMPLETED";
  log(
    `F-012-completed ${completed ? "PASS" : "FAIL"} status=${progressAfter.json?.data?.status} node=${progressAfter.json?.data?.nodeStatus}`,
  );
  fs.writeFileSync(`${OUT}/f012_progress_after.json`, JSON.stringify(progressAfter.json, null, 2));

  // F-013 client final certificate
  const clientRelog = await apiLogin(seeded.email, seeded.password);
  const certGet = await request(`/api/compat/client/tax-returns/${caseId}/final-certificate`, {
    headers: { Authorization: `Bearer ${clientRelog.token}` },
  });
  fs.writeFileSync(`${OUT}/f013_final_certificate.json`, JSON.stringify(certGet.json, null, 2));
  const f013 =
    certGet.status === 200 &&
    certGet.json?.success !== false &&
    Boolean(
      certGet.json?.data?.url ||
        certGet.json?.data?.downloadUrl ||
        certGet.json?.data?.cloudinaryUrl ||
        certGet.json?.data?.fileName ||
        certGet.json?.data,
    );
  log(`F-013-final-certificate ${f013 ? "PASS" : "FAIL"} status=${certGet.status}`);

  await clientLogin(page, seeded.email, seeded.password, "/dashboard/my-documents");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/f013_client_documents.png`, fullPage: true });

  // F-014 history consistency
  const progressReload = await request(`/api/compat/tax-return/${caseId}/progress`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accountant.token}` },
    body: {},
  });
  const f014 =
    progressReload.json?.data?.status === "completed" ||
    String(progressReload.json?.data?.nodeStatus || "").toUpperCase() === "COMPLETED";
  log(`F-014-history ${f014 ? "PASS" : "FAIL"} status=${progressReload.json?.data?.status}`);
  fs.writeFileSync(`${OUT}/f014_progress_reload.json`, JSON.stringify(progressReload.json, null, 2));

  await adminLogin(page);
  await page.goto(`${ADMIN}/admin/manage-tax/${caseId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/f014_admin_completed.png`, fullPage: true });

  await browser.close();

  const summary = {
    productSha,
    caseId,
    email: seeded.email,
    results: results.slice(),
    label: "LOCAL/SIMULATED payments + Mailpit",
    testedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    `${OUT}/BROWSER_RESULTS.md`,
    [
      `# F-002 / F-012–F-014 browser proof`,
      ``,
      `Tested SHA: \`${productSha}\``,
      `Hosts: client ${CLIENT}, admin ${ADMIN}/admin, API ${API}`,
      `Label: **LOCAL/SIMULATED** (fake payments; Mailpit SMTP)`,
      ``,
      ...results.map((r) => `- ${r}`),
      ``,
      `## Screenshots`,
      ...fs
        .readdirSync(OUT)
        .filter((f) => f.endsWith(".png"))
        .map((f) => `- \`${f}\``),
    ].join("\n"),
  );
  fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
  log(`DONE wrote ${OUT}`);

  const fails = results.filter((r) => /\bFAIL\b/.test(r));
  if (fails.length) {
    console.error("FAILURES", fails);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  fs.writeFileSync(`${OUT}/error.txt`, String(e.stack || e));
  process.exit(1);
});
