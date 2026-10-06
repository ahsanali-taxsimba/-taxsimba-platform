/**
 * Pre-fix reproduction for Toxsl F-003/F-004 (client SA document upload).
 * Does not modify data beyond seeding a disposable case.
 */
const { randomUUID } = require("crypto");
const fs = require("fs");
const http = require("http");
const FormData = require("form-data");

const API = process.env.API_BASE || "http://127.0.0.1:8002";
const OUT = "/opt/cursor/artifacts/sa-client-document-upload";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
fs.mkdirSync(OUT, { recursive: true });
const logLines = [];
const log = (s) => {
  logLines.push(s);
  console.log(s);
};

async function api(method, path, { token, json, form, headers } = {}) {
  if (form) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
        ...form.getHeaders(),
      },
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
    const h = { Accept: "application/json", ...(headers || {}) };
    if (token) h.Authorization = `Bearer ${token}`;
    if (payload) {
      h["Content-Type"] = "application/json";
      h["Content-Length"] = String(payload.length);
    }
    const r = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers: h },
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
  return { token: res.body.access_token || res.body.accessToken, user: res.body.user };
}

async function main() {
  const admin = await login("admin@taxsimba.co.uk", "Admin@123");
  const accountant = await login("accountant.a@taxsimba.co.uk", "Account@123");
  const suffix = randomUUID().slice(0, 6);
  const clientEmail = `sa-doc-${suffix}@toxsl-e2e.test`;
  await api("POST", "/api/auth/register", {
    json: {
      email: clientEmail,
      password: "Client@12345",
      name: `SA Doc ${suffix}`,
      phone: "+447700900999",
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
  const sessionId = checkout.body?.data?.sessionId || checkout.body?.data?.session_id;
  await api("POST", "/api/compat/client/subscription/checkout-success", {
    token: client.token,
    json: { sessionId, session_id: sessionId },
  });

  const created = await api("POST", "/api/cases", {
    token: admin.token,
    json: {
      client_user_id: clientUser.id,
      tax_year: "2096/97",
      manual_creation_reason: "F-003/F-004 reproduce",
    },
  });
  const caseId = created.body.id;
  await api("POST", `/api/cases/${caseId}/assign`, {
    token: admin.token,
    json: { accountant_id: accountant.user.id },
  });
  await api("POST", `/api/cases/${caseId}/start-review`, { token: accountant.token });

  // BEFORE request: upload UI should not appear (no outstanding requested docs)
  const beforeReq = await api("POST", "/api/compat/client/all-tax-returns", {
    token: client.token,
    json: {},
  });
  const beforeRow = (beforeReq.body.data || []).find((r) => r.id === caseId || r.taxReturn?.id === caseId);
  const beforeOutstanding = (beforeRow?.files?.allFiles || []).filter((f) => f.uploadStatus !== "completed");
  log(`BEFORE request: outstanding=${beforeOutstanding.length}`);

  const reqDocs = await api("POST", `/api/compat/accountant/tax-returns/${caseId}/request-documents`, {
    token: accountant.token,
    json: {
      requiredDocuments: [{ documentType: "P60", description: "Latest P60" }],
      message: "Please upload your P60",
      deadline: "2026-12-31",
    },
  });
  log(`REQUEST status=${reqDocs.status} body=${JSON.stringify(reqDocs.body).slice(0, 300)}`);
  fs.writeFileSync(`${OUT}/api-request-documents.json`, JSON.stringify(reqDocs, null, 2));

  const afterReq = await api("POST", "/api/compat/client/all-tax-returns", {
    token: client.token,
    json: {},
  });
  const afterRow = (afterReq.body.data || []).find((r) => r.id === caseId || r.taxReturn?.id === caseId);
  const outstanding = (afterRow?.files?.allFiles || []).filter((f) => f.uploadStatus !== "completed");
  log(`AFTER request: outstanding=${outstanding.length} ids=${outstanding.map((d) => d.id).join(",")}`);
  fs.writeFileSync(`${OUT}/api-all-tax-returns-after-request.json`, JSON.stringify(afterRow, null, 2));
  if (!outstanding.length) {
    log("FAIL F-003: upload action would not be visible (no outstanding required docs)");
  } else {
    log("INFO F-003 visibility data present on all-tax-returns (Tax Tracker filter)");
  }

  // Simulate broken FE: Content-Type multipart/form-data WITHOUT boundary
  const broken = await new Promise((resolve, reject) => {
    const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
    // Intentionally omit boundary from Content-Type header (FE bug)
    const body =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="p60.pdf"\r\n` +
      `Content-Type: application/pdf\r\n\r\n`;
    const buf = Buffer.concat([Buffer.from(body), PDF, Buffer.from(`\r\n--${boundary}--\r\n`)]);
    const url = new URL(`${API}/api/compat/client/tax-returns/${caseId}/upload-documents`);
    const r = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: {
          Authorization: `Bearer ${client.token}`,
          Accept: "application/json",
          "Content-Type": "multipart/form-data",
          "Content-Length": String(buf.length),
        },
      },
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
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    r.on("error", reject);
    r.write(buf);
    r.end();
  });
  log(`BROKEN Content-Type upload status=${broken.status} body=${JSON.stringify(broken.body).slice(0, 400)}`);
  fs.writeFileSync(`${OUT}/api-upload-broken-content-type.json`, JSON.stringify(broken, null, 2));

  // Correct multipart upload (what FE should send) — observe request fulfilment gap
  const form = new FormData();
  form.append("file", PDF, { filename: "p60.pdf", contentType: "application/pdf" });
  form.append("documentType", "P60");
  // FE currently does NOT send document_id / documentId for the placeholder
  const okUpload = await api("POST", `/api/compat/client/tax-returns/${caseId}/upload-documents`, {
    token: client.token,
    form,
  });
  log(`CORRECT multipart upload status=${okUpload.status} message=${okUpload.body?.message}`);
  fs.writeFileSync(`${OUT}/api-upload-without-document-id.json`, JSON.stringify(okUpload, null, 2));

  const { MongoClient: MC } = require("mongodb");
  const mc = new MC(process.env.MONGO_URL || "mongodb://127.0.0.1:27017");
  await mc.connect();
  const db2 = mc.db(dbName);
  const docs = await db2.collection("documents").find({ case_id: caseId }).toArray();
  const requests = await db2.collection("document_requests").find({ case_id: caseId }).toArray();
  const tasks = await db2.collection("tasks").find({ case_id: caseId }).toArray();
  await mc.close();
  log(
    `DB after upload: docs=${docs.length} statuses=${docs.map((d) => d.status).join(",")} ` +
      `requests=${requests.map((r) => r.status).join(",")} tasks=${tasks.map((t) => t.status).join(",")}`,
  );
  fs.writeFileSync(
    `${OUT}/db-after-upload-without-document-id.json`,
    JSON.stringify({ docs, requests, tasks }, null, 2),
  );

  const afterUploadList = await api("POST", "/api/compat/client/all-tax-returns", {
    token: client.token,
    json: {},
  });
  const afterUploadRow = (afterUploadList.body.data || []).find(
    (r) => r.id === caseId || r.taxReturn?.id === caseId,
  );
  const stillOutstanding = (afterUploadRow?.files?.allFiles || []).filter(
    (f) => f.uploadStatus !== "completed",
  );
  log(`AFTER upload without document_id: stillOutstanding=${stillOutstanding.length}`);
  if (stillOutstanding.length) {
    log("FAIL F-004 persistence: request still open / upload UI would still show after 'success'");
  }
  if (broken.status >= 400) {
    log("REPRODUCED F-004: FE Content-Type without boundary → upload fails");
  }
  fs.writeFileSync(`${OUT}/reproduce.log`, logLines.join("\n") + "\n");
}

main().catch((e) => {
  console.error(e);
  fs.writeFileSync(`${OUT}/reproduce.log`, logLines.join("\n") + "\n" + String(e.stack || e));
  process.exit(1);
});
