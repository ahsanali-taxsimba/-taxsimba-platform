/**
 * Live local Toxsl evidence repair proof against the running API on :8002.
 * Uses real HTTP + the real Mongo DB (taxsimba_local_e2e) — not vitest harness.
 */
import { randomUUID } from "crypto";
import fs from "fs";

const API = process.env.API_BASE || "http://127.0.0.1:8002";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

type Json = Record<string, any>;

async function req(
  method: string,
  path: string,
  opts: { token?: string; json?: unknown; form?: FormData; expect?: number } = {},
): Promise<{ status: number; body: any; headers: Headers }> {
  // Use http.request to avoid undici auto-Origin which triggers isBrowser() and omits access_token.
  const http = await import("http");
  const url = new URL(`${API}${path}`);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "ToxslLiveProof/1.0",
    Host: url.host,
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let payload: Buffer | undefined;
  if (opts.form) {
    // Node 18+ FormData via undici — fall back to fetch without Origin header override.
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        "User-Agent": "ToxslLiveProof/1.0",
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.form as any,
      // @ts-expect-error undici
      duplex: "half",
    });
    const text = await res.text();
    let parsed: any = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep */
    }
    if (opts.expect != null && res.status !== opts.expect) {
      throw new Error(
        `${method} ${path} expected ${opts.expect} got ${res.status}: ${text.slice(0, 500)}`,
      );
    }
    return { status: res.status, body: parsed, headers: res.headers };
  } else if (opts.json !== undefined) {
    payload = Buffer.from(JSON.stringify(opts.json));
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = String(payload.length);
  }

  const { status, bodyText, rawHeaders } = await new Promise<{
    status: number;
    bodyText: string;
    rawHeaders: http.IncomingHttpHeaders;
  }>((resolve, reject) => {
    const r = http.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode || 0,
            bodyText: Buffer.concat(chunks).toString("utf8"),
            rawHeaders: res.headers,
          }),
        );
      },
    );
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });

  let parsed: any = bodyText;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    /* keep */
  }
  if (opts.expect != null && status !== opts.expect) {
    throw new Error(
      `${method} ${path} expected ${opts.expect} got ${status}: ${bodyText.slice(0, 500)}`,
    );
  }
  const headersObj = new Headers();
  for (const [k, v] of Object.entries(rawHeaders)) {
    if (v == null) continue;
    headersObj.set(k, Array.isArray(v) ? v.join(", ") : String(v));
  }
  return { status, body: parsed, headers: headersObj };
}

async function login(email: string, password: string): Promise<{ token: string; user: Json }> {
  const { body } = await req("POST", "/api/auth/login", {
    json: { email, password },
    expect: 200,
  });
  const token = body.access_token || body.accessToken;
  if (!token) throw new Error(`login missing token for ${email}`);
  return { token, user: body.user };
}

async function registerClient(prefix: string): Promise<{ email: string; password: string; token: string; id: string }> {
  const email = `${prefix}-${randomUUID().slice(0, 6)}@toxsl-e2e.test`;
  const password = "Client@12345";
  const reg = await req("POST", "/api/auth/register", {
    json: {
      email,
      password,
      name: `Toxsl ${prefix}`,
      phone: "+447700900123",
      onboarding_intent: prefix.toUpperCase().includes("MTD") ? "MTD" : "SA",
    },
  });
  if (![200, 201].includes(reg.status)) {
    throw new Error(`register failed ${reg.status}: ${JSON.stringify(reg.body).slice(0, 400)}`);
  }
  // Mark verified in the live local DB (same DB the API uses).
  const { MongoClient } = await import("mongodb");
  const c = new MongoClient("mongodb://127.0.0.1:27017");
  await c.connect();
  const db = c.db("taxsimba_local_e2e");
  await db.collection("users").updateOne(
    { email: email.toLowerCase() },
    {
      $set: {
        email_verified_at: new Date().toISOString(),
        status: "ACTIVE",
        is_active: true,
      },
    },
  );
  await c.close();
  const logged = await login(email, password);
  return { email, password, token: logged.token, id: logged.user.id };
}

async function activateViaFakeCheckout(
  clientToken: string,
  serviceType: string,
  packageCode: string,
): Promise<string> {
  const pkgs = await req("GET", `/api/packages?service_type=${serviceType}`, {
    token: clientToken,
    expect: 200,
  });
  const list = Array.isArray(pkgs.body) ? pkgs.body : pkgs.body?.data || [];
  const pkg = list.find((p: any) => p.code === packageCode);
  if (!pkg) throw new Error(`package ${packageCode} not found in ${JSON.stringify(list).slice(0, 300)}`);

  const checkout = await req("POST", "/api/compat/client/subscription/checkout-session", {
    token: clientToken,
    json: { planId: pkg.id, origin_url: "http://127.0.0.1:3000" },
    expect: 200,
  });
  if (!checkout.body?.success && !checkout.body?.data?.checkoutUrl && !checkout.body?.data?.checkout_url) {
    // Native path
  }
  const data = checkout.body?.data || checkout.body;
  const sessionId = data.sessionId || data.session_id;
  if (!sessionId) {
    throw new Error(`checkout missing session: ${JSON.stringify(checkout.body).slice(0, 500)}`);
  }
  // Complete fake checkout
  const done = await req("POST", "/api/compat/client/subscription/checkout-success", {
    token: clientToken,
    json: { sessionId, session_id: sessionId },
  });
  if (done.status !== 200 && done.status !== 201) {
    // try native
    const native = await req("POST", "/api/payments/checkout-success", {
      token: clientToken,
      json: { session_id: sessionId },
    });
    if (native.status !== 200) {
      throw new Error(`checkout-success failed ${done.status}/${native.status}`);
    }
  }
  return pkg.id;
}

const results: string[] = [];
const log = (s: string) => {
  results.push(s);
  console.log(s);
};

async function main() {
  const admin = await login("admin@taxsimba.co.uk", "Admin@123");
  const accountant = await login("accountant.a@taxsimba.co.uk", "Account@123");
  log("AUTH staff ok");

  // ——— 4. Checkout must not 500 ———
  const saClient = await registerClient("sa");
  const saCheckout = await req("POST", "/api/compat/client/subscription/checkout-session", {
    token: saClient.token,
    json: {
      planId: (
        await (async () => {
          const pkgs = await req("GET", "/api/packages?service_type=SELF_ASSESSMENT", {
            token: saClient.token,
            expect: 200,
          });
          const list = Array.isArray(pkgs.body) ? pkgs.body : pkgs.body?.data || [];
          const smart = list.find((p: any) => p.code === "SMART" || p.code === "SIMPLE");
          if (!smart) throw new Error("no SA package");
          return smart.id;
        })()
      ),
      origin_url: "http://127.0.0.1:3000",
    },
  });
  if (saCheckout.status === 500) throw new Error("checkout returned 500");
  if (saCheckout.status !== 200) {
    throw new Error(`checkout status ${saCheckout.status}: ${JSON.stringify(saCheckout.body).slice(0, 400)}`);
  }
  log("ITEM4 PASS — checkout-session not 500");

  // Complete SA purchase + engagement
  await activateViaFakeCheckout(saClient.token, "SELF_ASSESSMENT", "SMART").catch(async () => {
    await activateViaFakeCheckout(saClient.token, "SELF_ASSESSMENT", "SIMPLE");
  });
  log("SA purchase activated");

  const eng = await req("POST", "/api/compat/client/accept-engagement-letter", {
    token: saClient.token,
    json: { signature: "data:image/png;base64,aaa", accepted: true },
    expect: 200,
  });
  log(`ITEM1a PASS — accept-engagement-letter ${eng.status}`);

  // Apply SA tax return (engagement for SA goes to dashboard; case via apply)
  const applySa = await req("POST", "/api/compat/client/apply-tax-return", {
    token: saClient.token,
    json: { serviceType: "SELF_ASSESSMENT", service_type: "SELF_ASSESSMENT" },
  });
  if (![200, 201].includes(applySa.status)) {
    throw new Error(`SA apply-tax-return ${applySa.status}: ${JSON.stringify(applySa.body).slice(0, 400)}`);
  }
  const saCaseId =
    applySa.body?.data?.taxReturn?.id ||
    applySa.body?.data?.id ||
    applySa.body?.data?.caseId ||
    applySa.body?.data?.taxReturnId ||
    applySa.body?.id;
  if (!saCaseId) throw new Error(`no SA case id: ${JSON.stringify(applySa.body).slice(0, 400)}`);
  log(`SA case ${saCaseId}`);

  // ——— 5+2. Assign, upload draft, Admin approve via real endpoints ———
  await req("POST", "/api/compat/admin/assign", {
    token: admin.token,
    json: { taxReturnId: saCaseId, accountantId: accountant.user.id },
    expect: 200,
  });
  log("ITEM5/6 assign ok");

  // Verify accountant id visible to client
  const list1 = await req("POST", "/api/compat/client/all-tax-returns", {
    token: saClient.token,
    json: {},
    expect: 200,
  });
  const row1 = (list1.body.data || []).find((r: any) => r.id === saCaseId || r.taxReturn?.id === saCaseId);
  if (!row1?.accountant?.id && !row1?.assignedAccountantId) {
    throw new Error("ITEM6 FAIL — accountant id missing on all-tax-returns");
  }
  log(`ITEM6 PASS — accountant ${row1.accountant?.id || row1.assignedAccountantId}`);

  const form = new FormData();
  form.append(
    "draftReturnFile",
    new Blob([PDF], { type: "application/pdf" }),
    "toxsl-sa-draft.pdf",
  );
  form.append("draftType", "Tax Return Draft");
  form.append("explanationNotes", "Live Toxsl proof draft");
  const upload = await req(
    "POST",
    `/api/compat/accountant/assignments/${saCaseId}/upload-draft`,
    { token: accountant.token, form, expect: 200 },
  );
  const draftId = upload.body?.data?.id;
  log(`Draft uploaded ${draftId}`);

  // Admin approve via manage-review (Tax Return / manage-tax path)
  const approve = await req("POST", `/api/compat/admin/manage-review/${saCaseId}`, {
    token: admin.token,
    json: { action: "approve" },
    expect: 200,
  });
  log(`ITEM5 PASS — Admin manage-review approve ${approve.status}`);

  // Also verify progress advance path works (tax-return-list button)
  // (already approved — progress draft_ready should be idempotent/same bucket)
  const clientDrafts = await req("GET", `/api/compat/client/drafts/${saCaseId}`, {
    token: saClient.token,
    expect: 200,
  });
  const docs = clientDrafts.body?.data?.documents?.draftDocuments || [];
  if (!docs.length) throw new Error("ITEM2 FAIL — client cannot see released draft");
  log("ITEM2a PASS — client sees released draft");

  const clientApprove = await req("POST", `/api/compat/client/drafts/${saCaseId}/approve`, {
    token: saClient.token,
    json: { approvalNotes: "Looks good", confirmFinalSubmission: true },
    expect: 200,
  });
  log(`Client approve ${clientApprove.status}`);

  const list2 = await req("POST", "/api/compat/client/all-tax-returns", {
    token: saClient.token,
    json: {},
    expect: 200,
  });
  const row2 = (list2.body.data || []).find((r: any) => r.id === saCaseId || r.taxReturn?.id === saCaseId);
  const st = row2?.taxReturn?.status;
  if (st === "draft_ready") throw new Error(`ITEM2 FAIL — still draft_ready after approve`);
  if (!["client_approved", "ready_for_submission", "final_submitted"].includes(st)) {
    throw new Error(`ITEM2 FAIL — unexpected status ${st}`);
  }
  // Same case id — no second record
  const sameIdCount = (list2.body.data || []).filter(
    (r: any) => r.id === saCaseId || r.taxReturn?.id === saCaseId,
  ).length;
  if (sameIdCount !== 1) throw new Error(`ITEM2 FAIL — expected 1 row for case, got ${sameIdCount}`);
  log(`ITEM2 PASS — status=${st} same case id`);

  const progress = await req("POST", `/api/compat/tax-return/${saCaseId}/progress`, {
    token: saClient.token,
    json: {},
    expect: 200,
  });
  if (progress.body?.data?.status !== st && progress.body?.data?.status === "draft_ready") {
    throw new Error("progress status mismatch still draft_ready");
  }
  log(`Progress status=${progress.body?.data?.status} node=${progress.body?.data?.nodeStatus}`);

  // ——— 3. Messaging both directions ———
  const tmpl = await req("GET", "/api/compat/admin/template", {
    token: admin.token,
    expect: 200,
  });
  if (!tmpl.body?.data?.template) throw new Error("ITEM3 FAIL — template missing");
  log("ITEM3a PASS — admin template loads");

  await req("POST", "/api/compat/admin/send-to-client", {
    token: admin.token,
    json: {
      taxReturnId: saCaseId,
      subject: "Update regarding your TaxSimba tax return",
      message: "<p>Hello from Admin live proof</p>",
      htmlContent: "<p>Hello from Admin live proof</p>",
      templateId: "default-staff-case-email",
      priority: "high",
      recipientId: saClient.id,
    },
    expect: 200,
  });
  await req("POST", "/api/compat/accountant/send-to-client", {
    token: accountant.token,
    json: {
      taxReturnId: saCaseId,
      message: "Accountant message body",
      subject: "From accountant",
      recipientId: saClient.id,
    },
    expect: 200,
  });
  await req("POST", "/api/compat/client/send-to-specific-accountant", {
    token: saClient.token,
    json: {
      taxReturnId: saCaseId,
      accountantId: accountant.user.id,
      subject: "Client question",
      message: "Client message body",
      priority: "high",
    },
    expect: 200,
  });
  const clog = await req("POST", `/api/compat/client/communication-log/${saCaseId}`, {
    token: saClient.token,
    json: { page: 1, limit: 50 },
    expect: 200,
  });
  const emails = clog.body?.data?.emails || [];
  if (emails.length < 2) throw new Error(`ITEM3 FAIL — expected messages, got ${emails.length}`);
  for (const e of emails) {
    const ts = e.sentAt || e.createdAt || e.created_at;
    if (!ts || Number.isNaN(new Date(ts).getTime())) {
      throw new Error(`ITEM3 FAIL — Invalid Date in ${JSON.stringify(e).slice(0, 200)}`);
    }
    if (!(e.parsedEmailData?.messageText || e.body || e.message)) {
      throw new Error("ITEM3 FAIL — empty message body in DTO");
    }
  }
  const staffLog = await req("POST", `/api/compat/admin/communication-log/${saCaseId}`, {
    token: admin.token,
    json: {},
    expect: 200,
  });
  if (!(staffLog.body?.data?.emails || []).length) {
    throw new Error("ITEM3 FAIL — staff log empty");
  }
  log(`ITEM3 PASS — ${emails.length} client emails, dates valid, staff log ok`);

  // ——— 7. Upgrade package ———
  const beforeServices = await req("GET", "/api/compat/client/my-subscriptions", {
    token: saClient.token,
  }).catch(() => null);
  // Try upgrade checkout
  const pkgs2 = await req("GET", "/api/packages?service_type=SELF_ASSESSMENT", {
    token: saClient.token,
    expect: 200,
  });
  const listPkgs = Array.isArray(pkgs2.body) ? pkgs2.body : pkgs2.body?.data || [];
  const elite = listPkgs.find((p: any) => p.code === "ELITE" || p.code === "SMART");
  if (elite) {
    const up = await req("POST", "/api/compat/client/subscription/upgrade-checkout", {
      token: saClient.token,
      json: { package_code: elite.code, packageCode: elite.code, origin_url: "http://127.0.0.1:3000" },
    });
    if (up.status === 500) throw new Error("ITEM7 FAIL — upgrade checkout 500");
    log(`ITEM7 checkout status=${up.status}`);
    const sid = up.body?.data?.sessionId || up.body?.data?.session_id;
    if (sid) {
      await req("POST", "/api/compat/client/subscription/checkout-success", {
        token: saClient.token,
        json: { sessionId: sid, session_id: sid },
      });
    }
  }
  const list3 = await req("POST", "/api/compat/client/all-tax-returns", {
    token: saClient.token,
    json: {},
    expect: 200,
  });
  const row3 = (list3.body.data || []).find((r: any) => r.id === saCaseId || r.taxReturn?.id === saCaseId);
  if (!row3) throw new Error("ITEM7 FAIL — tax return lost after upgrade attempt");
  log("ITEM7 PASS — tax return still linked after upgrade path");

  // ——— 1 MTD submit-tax-info multipart ———
  const mtdClient = await registerClient("mtd");
  await activateViaFakeCheckout(mtdClient.token, "MTD_INCOME_TAX", "MTD_COMPLY").catch(async () => {
    await activateViaFakeCheckout(mtdClient.token, "MTD_INCOME_TAX", "MTD_GROWTH");
  });
  await req("POST", "/api/compat/client/accept-engagement-letter", {
    token: mtdClient.token,
    json: { signature: "data:image/png;base64,aaa", accepted: true },
    expect: 200,
  });
  await req("POST", "/api/compat/client/apply-tax-return", {
    token: mtdClient.token,
    json: { serviceType: "MTD_INCOME_TAX", service_type: "MTD_INCOME_TAX" },
  }).then((r) => {
    if (![200, 201].includes(r.status)) {
      throw new Error(`MTD apply ${r.status}: ${JSON.stringify(r.body).slice(0, 400)}`);
    }
  });
  const taxForm = new FormData();
  taxForm.append("accountantNotes", "Anything else for accountant — live proof");
  taxForm.append("govGatewayStatus", "Yes");
  taxForm.append("businessType", "Sole trader");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const taxInfoRes = await fetch(`${API}/api/compat/client/submit-tax-info`, {
    method: "POST",
    headers: { Authorization: `Bearer ${mtdClient.token}` },
    body: taxForm as any,
    signal: controller.signal,
  });
  clearTimeout(timer);
  const taxInfoText = await taxInfoRes.text();
  if (taxInfoRes.status !== 200) {
    throw new Error(`ITEM1 FAIL submit-tax-info ${taxInfoRes.status}: ${taxInfoText.slice(0, 400)}`);
  }
  log("ITEM1 PASS — submit-tax-info multipart completed <15s");

  // ——— 9. Privacy / Terms ———
  for (const page of ["/privacy-policy", "/terms-and-conditions"]) {
    const r = await fetch(`http://127.0.0.1:3000${page}`);
    if (r.status >= 500) throw new Error(`ITEM9 FAIL ${page} → ${r.status}`);
    log(`ITEM9 ${page} → ${r.status}`);
  }

  // ——— 8. Email render (logo / wording) ———
  const { renderEmail } = await import("../src/services/email");
  const rendered = renderEmail({
    title: "Verify your email",
    body: "Please verify your TaxSimba account.",
    link: "http://127.0.0.1:3000/verify-email?token=test",
    callToAction: "Verify email",
  });
  if (!/taxsimba/i.test(rendered.html)) throw new Error("ITEM8 FAIL — TaxSimba missing in email HTML");
  if (!rendered.html.includes("Verify email")) throw new Error("ITEM8 FAIL — CTA missing");
  log("ITEM8 PASS — email HTML contains brand + CTA");

  log("ALL LIVE API JOURNEY CHECKS PASSED");
  fs.writeFileSync(
    "/opt/cursor/artifacts/toxsl-live-api-journey-proof.log",
    results.join("\n") + "\n",
  );
}

main().catch((e) => {
  console.error(e);
  fs.writeFileSync(
    "/opt/cursor/artifacts/toxsl-live-api-journey-proof.log",
    results.concat([String(e)]).join("\n") + "\n",
  );
  process.exit(1);
});
