/**
 * Browser proof: Toxsl F-003/F-004 client SA document upload journey.
 */
const { chromium } = require("playwright");
const { randomUUID } = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const API = process.env.API_BASE || "http://127.0.0.1:8002";
const CLIENT_FE = process.env.CLIENT_BASE || "http://127.0.0.1:3000";
const ADMIN_FE = process.env.ADMIN_BASE || "http://127.0.0.1:3001";
const OUT = "/opt/cursor/artifacts/sa-client-document-upload";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<< /Type /Catalog >>endobj\ntrailer<<>>\n%%EOF\n");
fs.mkdirSync(OUT, { recursive: true });
const logLines = [];
const log = (s) => {
  logLines.push(s);
  console.log(s);
};

async function api(method, pathName, { token, json, formHeaders, body } = {}) {
  if (body && formHeaders) {
    const res = await fetch(`${API}${pathName}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...formHeaders,
      },
      body,
    });
    const text = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    return { status: res.status, body: parsed };
  }
  return new Promise((resolve, reject) => {
    const url = new URL(`${API}${pathName}`);
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
          let parsed;
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = text;
          }
          resolve({ status: res.statusCode || 0, body: parsed });
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

async function seedCase() {
  const admin = await login("admin@taxsimba.co.uk", "Admin@123");
  const accountant = await login("accountant.a@taxsimba.co.uk", "Account@123");
  const suffix = randomUUID().slice(0, 6);
  const clientEmail = `sa-f003-${suffix}@toxsl-e2e.test`;
  await api("POST", "/api/auth/register", {
    json: {
      email: clientEmail,
      password: "Client@12345",
      name: `SA F003 ${suffix}`,
      phone: "+447700900111",
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
    json: { planId: simple.id, origin_url: CLIENT_FE },
  });
  const sessionId = checkout.body?.data?.sessionId || checkout.body?.data?.session_id;
  await api("POST", "/api/compat/client/subscription/checkout-success", {
    token: client.token,
    json: { sessionId, session_id: sessionId },
  });
  const engagement = await api("POST", "/api/compat/client/accept-engagement-letter", {
    token: client.token,
    json: {
      signature: "data:image/png;base64,c2ln",
      accepted: true,
      agreementVersion: "client-care-v1",
    },
  });
  if (engagement.status !== 200) {
    throw new Error(`engagement ${engagement.status}: ${JSON.stringify(engagement.body).slice(0, 200)}`);
  }

  const created = await api("POST", "/api/cases", {
    token: admin.token,
    json: {
      client_user_id: clientUser.id,
      tax_year: "2095/96",
      manual_creation_reason: "F-003/F-004 browser proof",
    },
  });
  const caseId = created.body.id;
  await api("POST", `/api/cases/${caseId}/assign`, {
    token: admin.token,
    json: { accountant_id: accountant.user.id },
  });
  await api("POST", `/api/cases/${caseId}/start-review`, { token: accountant.token });

  const reqDocs = await api("POST", `/api/compat/accountant/tax-returns/${caseId}/request-documents`, {
    token: accountant.token,
    json: {
      requiredDocuments: [{ documentType: "P60", description: "Latest P60" }],
      message: "Please upload your P60 for SA",
    },
  });
  const docId = reqDocs.body?.data?.documentIds?.[0];
  log(`SEEDED case=${caseId} docId=${docId} request=${reqDocs.status}`);

  const before = await api("POST", "/api/compat/client/all-tax-returns", {
    token: client.token,
    json: {},
  });
  fs.writeFileSync(`${OUT}/api-all-tax-returns-before-upload.json`, JSON.stringify(before, null, 2));
  return {
    caseId,
    docId,
    clientEmail,
    clientTok: client.token,
    adminTok: admin.token,
    accTok: accountant.token,
  };
}

async function clientUiLogin(page, email, password) {
  await page.goto(`${CLIENT_FE}/login`, { waitUntil: "networkidle", timeout: 120000 });
  // Prefer password tab if code login is default
  const passwordTab = page.locator('text=/password/i').first();
  if (await passwordTab.count()) {
    await passwordTab.click().catch(() => {});
  }
  const emailInput = page.locator('input[name="email"], input[type="email"], input[placeholder*="Email" i]').first();
  await emailInput.waitFor({ state: "visible", timeout: 60000 });
  await emailInput.fill(email);
  const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
  await passwordInput.fill(password);
  await page.locator('button:has-text("Sign In"), button:has-text("Sign in")').first().click();
  await page.waitForURL(/\/(dashboard|overview|mtd)/, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

async function main() {
  const ctx = await seedCase();
  const pdfPath = path.join(OUT, "p60-browser-proof.pdf");
  fs.writeFileSync(pdfPath, PDF);

  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/local/bin/google-chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let uploadApi = null;
  let uploadBody = null;
  page.on("response", async (res) => {
    if (res.url().includes("upload-documents")) {
      uploadApi = { url: res.url(), status: res.status(), method: res.request().method() };
      try {
        uploadBody = await res.json();
      } catch {
        uploadBody = null;
      }
      const req = res.request();
      fs.writeFileSync(
        `${OUT}/api-upload-request-headers.json`,
        JSON.stringify(
          {
            url: req.url(),
            method: req.method(),
            headers: req.headers(),
            // Content-Type must include boundary when set by browser
            contentType: req.headers()["content-type"] || null,
          },
          null,
          2,
        ),
      );
    }
  });

  await clientUiLogin(page, ctx.clientEmail, "Client@12345");
  await page.screenshot({ path: `${OUT}/01-client-after-login.png`, fullPage: true });

  await page.goto(`${CLIENT_FE}/dashboard/tax-tracker`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/02-tax-tracker-before-upload.png`, fullPage: true });

  const uploadBtn = page.locator('[data-testid="client-upload-documents-btn"]').first();
  await uploadBtn.waitFor({ state: "visible", timeout: 60000 });
  log("UPLOAD BUTTON VISIBLE");
  await uploadBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/03-upload-modal.png`, fullPage: true });

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(pdfPath);
  await page.locator('[data-testid="client-upload-submit-btn"]').click();
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${OUT}/04-after-upload.png`, fullPage: true });

  fs.writeFileSync(`${OUT}/api-upload-response.json`, JSON.stringify({ uploadApi, uploadBody }, null, 2));
  log(`UPLOAD API ${JSON.stringify(uploadApi)}`);

  // Refresh + persistence
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/05-after-refresh.png`, fullPage: true });

  const afterList = await api("POST", "/api/compat/client/all-tax-returns", {
    token: ctx.clientTok,
    json: {},
  });
  const row = (afterList.body.data || []).find((r) => r.id === ctx.caseId);
  const outstanding = (row?.files?.allFiles || []).filter((f) => f.uploadStatus !== "completed");
  log(`AFTER upload outstanding=${outstanding.length}`);

  // Sign out / sign in (fresh session)
  await page.context().clearCookies();
  await clientUiLogin(page, ctx.clientEmail, "Client@12345");
  await page.goto(`${CLIENT_FE}/dashboard/tax-tracker`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/06-after-fresh-login.png`, fullPage: true });
  const stillBtn = await page.locator('[data-testid="client-upload-documents-btn"]').count();
  log(`AFTER fresh login upload button count=${stillBtn} (expect 0)`);

  // Staff visibility via API
  const staffDocs = await api("GET", `/api/documents?case_id=${ctx.caseId}`, { token: ctx.accTok });
  fs.writeFileSync(`${OUT}/api-accountant-documents.json`, JSON.stringify(staffDocs, null, 2));
  const uploaded = (Array.isArray(staffDocs.body) ? staffDocs.body : []).find((d) => d.id === ctx.docId);
  log(`ACCOUNTANT sees doc status=${uploaded?.status} storage=${!!uploaded?.storage_path}`);

  const dl = await fetch(`${API}/api/documents/${ctx.docId}/download`, {
    headers: { Authorization: `Bearer ${ctx.accTok}` },
  });
  const dlBuf = Buffer.from(await dl.arrayBuffer());
  fs.writeFileSync(`${OUT}/downloaded-by-accountant.pdf`, dlBuf);
  log(`DOWNLOAD status=${dl.status} bytes=${dlBuf.length} starts=${dlBuf.slice(0, 5).toString()}`);

  // Unrelated client rejection
  const otherEmail = `sa-f003-x-${randomUUID().slice(0, 5)}@toxsl-e2e.test`;
  await api("POST", "/api/auth/register", {
    json: {
      email: otherEmail,
      password: "Client@12345",
      name: "Other Client",
      phone: "+447700900222",
      onboarding_intent: "SA",
    },
  });
  const { MongoClient } = require("mongodb");
  const mc = new MongoClient(process.env.MONGO_URL || "mongodb://127.0.0.1:27017");
  await mc.connect();
  await mc
    .db(process.env.DB_NAME || "taxsimba_sa_cert_e2e")
    .collection("users")
    .updateOne(
      { email: otherEmail.toLowerCase() },
      { $set: { email_verified_at: new Date().toISOString(), status: "ACTIVE", is_active: true } },
    );
  await mc.close();
  const other = await login(otherEmail, "Client@12345");
  const denied = await api("GET", `/api/compat/client/documents/${ctx.docId}/download`, {
    token: other.token,
  });
  log(`UNRELATED download status=${denied.status}`);
  fs.writeFileSync(`${OUT}/api-unrelated-download.json`, JSON.stringify(denied, null, 2));

  const { MongoClient: MC2 } = require("mongodb");
  const mc2 = new MC2(process.env.MONGO_URL || "mongodb://127.0.0.1:27017");
  await mc2.connect();
  const db = mc2.db(process.env.DB_NAME || "taxsimba_sa_cert_e2e");
  const dbDoc = await db.collection("documents").findOne({ id: ctx.docId });
  const dbReq = await db.collection("document_requests").findOne({ case_id: ctx.caseId });
  await mc2.close();
  fs.writeFileSync(
    `${OUT}/db-association.json`,
    JSON.stringify(
      {
        document: {
          id: dbDoc?.id,
          case_id: dbDoc?.case_id,
          client_user_id: dbDoc?.client_user_id,
          request_id: dbDoc?.request_id,
          status: dbDoc?.status,
          uploader_id: dbDoc?.uploader_id,
          storage_path: dbDoc?.storage_path,
        },
        request: { id: dbReq?.id, status: dbReq?.status, case_id: dbReq?.case_id },
      },
      null,
      2,
    ),
  );

  const ok =
    uploadApi?.status === 200 &&
    outstanding.length === 0 &&
    stillBtn === 0 &&
    uploaded?.status === "Uploaded" &&
    dl.status === 200 &&
    dlBuf.length > 0 &&
    dlBuf.slice(0, 4).toString() === "%PDF" &&
    (denied.status === 403 || denied.status === 401) &&
    dbDoc?.status === "Uploaded" &&
    dbReq?.status === "Uploaded";
  log(ok ? "PASS browser F-003/F-004 client document upload" : "FAIL browser F-003/F-004");
  fs.writeFileSync(`${OUT}/browser-proof.log`, logLines.join("\n") + "\n");
  await browser.close();
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  fs.writeFileSync(`${OUT}/browser-proof.log`, logLines.join("\n") + "\n" + String(e.stack || e));
  process.exit(1);
});
