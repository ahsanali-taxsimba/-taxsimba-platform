/**
 * Browser proof: SA Tax Return Certificate upload advances journey to completed.
 */
const { chromium } = require("playwright");
const { randomUUID } = require("crypto");
const fs = require("fs");
const http = require("http");

const API = process.env.API_BASE || "http://127.0.0.1:8002";
const ADMIN = process.env.ADMIN_BASE || "http://127.0.0.1:3001";
const OUT = "/opt/cursor/artifacts/sa-final-certificate";
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

const logLines = [];
const log = (s) => {
  logLines.push(s);
  console.log(s);
};

async function api(method, path, { token, json, form } = {}) {
  if (form) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: res.status, body };
  }
  return new Promise((resolve, reject) => {
    const url = new URL(`${API}${path}`);
    const payload = json != null ? Buffer.from(JSON.stringify(json)) : undefined;
    const headers = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (payload) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = String(payload.length);
    }
    const r = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let body;
          try {
            body = JSON.parse(text);
          } catch {
            body = text;
          }
          resolve({ status: res.statusCode || 0, body });
        });
      },
    );
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function login(email, password) {
  const res = await api("POST", "/api/auth/login", { json: { email, password } });
  if (res.status !== 200) throw new Error(`login ${email} ${res.status}`);
  return {
    token: res.body.access_token || res.body.accessToken,
    user: res.body.user,
  };
}

async function seedSubmittedCase() {
  const admin = await login("admin@taxsimba.co.uk", "Admin@123");
  const accountant = await login("accountant.a@taxsimba.co.uk", "Account@123");
  const suffix = randomUUID().slice(0, 6);
  const clientEmail = `sa-cert-${suffix}@toxsl-e2e.test`;
  await api("POST", "/api/auth/register", {
    json: {
      email: clientEmail,
      password: "Client@12345",
      name: `SA Cert ${suffix}`,
      phone: "+447700900321",
      onboarding_intent: "SA",
    },
  });
  const { MongoClient } = require("mongodb");
  const dbName = process.env.DB_NAME || "taxsimba_sa_cert_e2e";
  const c = new MongoClient(process.env.MONGO_URL || "mongodb://127.0.0.1:27017");
  await c.connect();
  const db = c.db(dbName);
  await db.collection("users").updateOne(
    { email: clientEmail.toLowerCase() },
    { $set: { email_verified_at: new Date().toISOString(), status: "ACTIVE", is_active: true } },
  );
  const clientUser = await db.collection("users").findOne({ email: clientEmail.toLowerCase() });
  await c.close();

  const client = await login(clientEmail, "Client@12345");
  const pkgs = await api("GET", "/api/packages?service_type=SELF_ASSESSMENT", { token: client.token });
  const simple = (Array.isArray(pkgs.body) ? pkgs.body : []).find((p) => p.code === "SIMPLE");
  const checkout = await api("POST", "/api/compat/client/subscription/checkout-session", {
    token: client.token,
    json: { planId: simple.id, origin_url: "http://127.0.0.1:3000" },
  });
  if (checkout.status !== 200) throw new Error(`checkout ${checkout.status}`);
  const sessionId = checkout.body?.data?.sessionId || checkout.body?.data?.session_id;
  await api("POST", "/api/compat/client/subscription/checkout-success", {
    token: client.token,
    json: { sessionId, session_id: sessionId },
  });

  const taxYear = `2097/98`;
  const created = await api("POST", "/api/cases", {
    token: admin.token,
    json: {
      client_user_id: clientUser.id,
      tax_year: taxYear,
      manual_creation_reason: "SA certificate browser proof",
    },
  });
  if (created.status !== 200) throw new Error(`create case ${created.status}: ${JSON.stringify(created.body).slice(0, 200)}`);
  const caseId = created.body.id;

  await api("POST", `/api/cases/${caseId}/assign`, {
    token: admin.token,
    json: { accountant_id: accountant.user.id },
  }).then((r) => {
    if (r.status !== 200) throw new Error(`assign ${r.status}`);
  });
  await api("POST", `/api/cases/${caseId}/start-review`, { token: accountant.token }).then((r) => {
    if (r.status !== 200) throw new Error(`start-review ${r.status}`);
  });
  const calc = await api("POST", `/api/cases/${caseId}/calculations`, {
    token: accountant.token,
    json: { total_income: 50000, taxable_income: 37430, tax_due: 7486 },
  });
  if (calc.status !== 200) throw new Error(`calc ${calc.status}`);
  await api("POST", `/api/cases/${caseId}/submit-for-admin-review`, {
    token: accountant.token,
    json: { calculation_version_id: calc.body.id, checklist: CHECKLIST },
  }).then((r) => {
    if (r.status !== 200) throw new Error(`submit-for-admin-review ${r.status}`);
  });
  await api("POST", `/api/cases/${caseId}/admin-approve`, { token: admin.token, json: { note: "ok" } }).then((r) => {
    if (r.status !== 200) throw new Error(`admin-approve ${r.status}`);
  });
  await api("POST", `/api/cases/${caseId}/client-approve`, { token: client.token, json: {} }).then((r) => {
    if (r.status !== 200) throw new Error(`client-approve ${r.status}`);
  });

  const rec = await api("POST", `/api/compat/admin/tax-return/${caseId}/record-submission`, {
    token: admin.token,
    json: {
      submissionDate: "2025-06-01",
      submissionReference: `HMRC-${suffix}`,
      provider: "Test software",
    },
  });
  if (rec.status !== 200) throw new Error(`record-submission ${rec.status}: ${JSON.stringify(rec.body).slice(0, 300)}`);

  const progressBefore = await api("POST", `/api/compat/tax-return/${caseId}/progress`, {
    token: accountant.token,
  });
  log(`BEFORE progress status=${progressBefore.body?.data?.status} node=${progressBefore.body?.data?.nodeStatus}`);
  fs.writeFileSync(`${OUT}/api-progress-before.json`, JSON.stringify(progressBefore, null, 2));
  return { caseId, adminTok: admin.token, accTok: accountant.token };
}

async function adminUiLogin(page) {
  await page.goto(`${ADMIN}/admin/auth/signin`, { waitUntil: "networkidle", timeout: 120000 });
  const email = page.locator('input[name="email"]').first();
  const password = page.locator('input[name="password"]').first();
  await email.click();
  await email.fill("admin@taxsimba.co.uk");
  await password.click();
  await password.fill("Admin@123");
  await page.locator('button.main-btn:has-text("Sign in")').first().click();
  await page.waitForURL(/\/admin\/(overview|tax-return-list)/, { timeout: 120000 });
}

async function main() {
  const { caseId, accTok } = await seedSubmittedCase();
  log(`SEEDED case=${caseId} at final_submitted`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/local/bin/google-chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let uploadApi = null;
  let uploadBody = null;
  page.on("response", async (res) => {
    const u = res.url();
    if (u.includes("upload-final-certificate")) {
      uploadApi = { url: u, status: res.status(), method: res.request().method() };
      try {
        uploadBody = await res.json();
      } catch {
        uploadBody = null;
      }
    }
  });

  await adminUiLogin(page);
  await page.screenshot({ path: `${OUT}/01-admin-login.png`, fullPage: true });

  const detailUrl = `${ADMIN}/admin/tax-return-list/${caseId}`;
  await page.goto(detailUrl, { waitUntil: "networkidle", timeout: 120000 });
  await page.screenshot({ path: `${OUT}/02-before-upload.png`, fullPage: true });

  const uploadBtn = page.locator('[data-testid="upload-final-certificate-btn"]').first();
  await uploadBtn.waitFor({ state: "visible", timeout: 60000 });
  await uploadBtn.click();
  await page.waitForSelector("text=Upload Tax return certificate", { timeout: 30000 });

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles({
    name: "sa-certificate-proof.pdf",
    mimeType: "application/pdf",
    buffer: PDF,
  });
  await page.locator('button:has-text("Upload & Notify Client")').click();
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${OUT}/03-after-upload.png`, fullPage: true });

  const progressAfter = await api("POST", `/api/compat/tax-return/${caseId}/progress`, {
    token: accTok,
  });
  fs.writeFileSync(`${OUT}/api-progress-after.json`, JSON.stringify(progressAfter, null, 2));
  fs.writeFileSync(
    `${OUT}/api-upload-response.json`,
    JSON.stringify({ uploadApi, uploadBody }, null, 2),
  );
  log(`UPLOAD API ${JSON.stringify(uploadApi)}`);
  log(`AFTER progress status=${progressAfter.body?.data?.status} node=${progressAfter.body?.data?.nodeStatus}`);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/04-after-refresh.png`, fullPage: true });

  const progressReload = await api("POST", `/api/compat/tax-return/${caseId}/progress`, {
    token: accTok,
  });
  log(`RELOAD progress status=${progressReload.body?.data?.status}`);

  const ok =
    uploadApi?.status === 200 &&
    progressAfter.body?.data?.status === "completed" &&
    progressReload.body?.data?.status === "completed";
  log(ok ? "PASS browser SA final certificate journey" : "FAIL browser SA final certificate journey");
  fs.writeFileSync(`${OUT}/browser-proof.log`, logLines.join("\n") + "\n");
  await browser.close();
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  fs.writeFileSync(`${OUT}/browser-proof.log`, logLines.join("\n") + "\n" + String(e.stack || e));
  process.exit(1);
});
