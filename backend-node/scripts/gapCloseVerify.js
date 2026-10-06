/** Local gap-close proof: D1-014 transaction amounts + G-009 submitted notification. */
const http = require("http");
const fs = require("fs");
const { MongoClient } = require("mongodb");

const OUT = process.env.OUT || "/opt/cursor/artifacts/gap_close_verify_20261006";
const API = "http://127.0.0.1:8002";
const results = [];
fs.mkdirSync(OUT, { recursive: true });

function api(method, path, { token, json } = {}) {
  return new Promise((res, rej) => {
    const u = new URL(API + path);
    const p = json ? Buffer.from(JSON.stringify(json)) : null;
    const h = { Accept: "application/json" };
    if (token) h.Authorization = "Bearer " + token;
    if (p) {
      h["Content-Type"] = "application/json";
      h["Content-Length"] = String(p.length);
    }
    const r = http.request(
      { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: h },
      (rs) => {
        let d = "";
        rs.on("data", (c) => (d += c));
        rs.on("end", () => {
          let body;
          try {
            body = JSON.parse(d);
          } catch {
            body = d;
          }
          res({ status: rs.statusCode, body });
        });
      },
    );
    r.on("error", rej);
    if (p) r.write(p);
    r.end();
  });
}

function push(id, ok, detail) {
  results.push({ id, ok: !!ok, detail });
  console.log(JSON.stringify({ id, ok: !!ok, detail: typeof detail === "object" ? JSON.stringify(detail).slice(0, 280) : detail }));
}

function arr(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.packages)) return body.packages;
  return [];
}

async function mailpitClear() {
  try {
    await fetch("http://127.0.0.1:8025/api/v1/messages", { method: "DELETE" });
  } catch {}
}
async function mailpitList() {
  try {
    const r = await fetch("http://127.0.0.1:8025/api/v1/messages");
    return r.json();
  } catch {
    return { messages: [] };
  }
}

(async () => {
  const ts = Date.now();
  const password = "Client@12345";
  const c = new MongoClient("mongodb://127.0.0.1:27017");
  await c.connect();
  const db = c.db("taxsimba_sa_cert_e2e");

  // --- D1-014 ---
  const email = `d1014b.${ts}@taxsimba.test`;
  await api("POST", "/api/auth/register", {
    json: { email, password, name: "D1014 Client", phone: "+447700900111", onboarding_intent: "SA" },
  });
  await db.collection("users").updateOne(
    { email },
    { $set: { email_verified_at: new Date().toISOString(), status: "ACTIVE", is_active: true } },
  );
  const login = await api("POST", "/api/auth/login", { json: { email, password } });
  const clientTok = login.body.access_token;
  push("client-login", !!clientTok, { status: login.status });

  const pkgs = await api("GET", "/api/packages?service_type=SELF_ASSESSMENT", { token: clientTok });
  const list = arr(pkgs.body);
  const simple = list.find((p) => p.code === "SIMPLE");
  const smart = list.find((p) => p.code === "SMART");
  push("packages", !!simple && !!smart, {
    status: pkgs.status,
    simplePrice: simple?.price ?? simple?.amount,
    smartPrice: smart?.price ?? smart?.amount,
    n: list.length,
  });

  const co = await api("POST", "/api/compat/client/subscription/checkout-session", {
    token: clientTok,
    json: { planId: simple.id, origin_url: "http://127.0.0.1:3000" },
  });
  const sid = co.body?.data?.sessionId || co.body?.data?.session_id;
  const ok = await api("POST", "/api/compat/client/subscription/checkout-success", {
    token: clientTok,
    json: { sessionId: sid, session_id: sid },
  });
  push("buy-simple", ok.status < 300, { co: co.status, ok: ok.status });

  let up = await api("POST", "/api/payments/upgrade-checkout", {
    token: clientTok,
    json: { package_code: "SMART", origin_url: "http://127.0.0.1:3000" },
  });
  if (up.status >= 400) {
    up = await api("POST", "/api/compat/client/subscription/upgrade-checkout", {
      token: clientTok,
      json: { packageCode: "SMART", package_code: "SMART", origin_url: "http://127.0.0.1:3000" },
    });
  }
  const usid = up.body?.session_id || up.body?.data?.sessionId || up.body?.data?.session_id;
  const charged = up.body?.amount ?? up.body?.data?.amount;
  push("upgrade-checkout", up.status < 300, { status: up.status, amount: charged, session: usid });

  if (usid) {
    let pay = await api("POST", "/api/payments/confirm-fake-checkout", {
      token: clientTok,
      json: { session_id: usid },
    });
    if (pay.status >= 400) {
      pay = await api("POST", "/api/compat/client/subscription/checkout-success", {
        token: clientTok,
        json: { sessionId: usid, session_id: usid },
      });
    }
    // fake provider may auto-fulfil via checkout-success only
    if (pay.status >= 400) {
      pay = await api("POST", "/api/payments/fake-confirm", {
        token: clientTok,
        json: { session_id: usid },
      });
    }
    push("upgrade-pay", pay.status < 300, { status: pay.status, body: JSON.stringify(pay.body).slice(0, 200) });
  }

  const hist = await api("GET", "/api/compat/client/transaction/list", { token: clientTok });
  const txs = hist.body?.data?.transactions || hist.body?.transactions || [];
  const upgrade = txs.find((t) => t.kind === "SA_UPGRADE");
  const amountOk =
    !!upgrade &&
    Number(upgrade.amount) === Number(charged) &&
    Number(upgrade.amount) !== Number(upgrade.upgradePrice) &&
    Number(upgrade.amount) > 0;
  push("D1-014-tx-list", amountOk, {
    status: hist.status,
    upgradeAmount: upgrade?.amount,
    upgradePrice: upgrade?.upgradePrice,
    chargedAtCheckout: charged,
    description: upgrade?.description,
    note: "Amount must equal charged upgrade delta, not catalogue sticker (upgradePrice)",
    all: txs.map((t) => ({ kind: t.kind, amount: t.amount, upgradePrice: t.upgradePrice })),
  });

  // --- G-009: full MTD publish → client approve → record-submission → notification ---
  const adminLogin = await api("POST", "/api/auth/login", {
    json: { email: "admin@taxsimba.co.uk", password: "Admin@123" },
  });
  const adminTok = adminLogin.body.access_token;
  push("admin-login", !!adminTok, { status: adminLogin.status });

  // Public signup rejects ACCOUNTANT intent — register as TAXSIMBA then promote, or use known accountant.
  const accEmail = `acc.g009b.${ts}@taxsimba.test`;
  await api("POST", "/api/auth/register", {
    json: {
      email: accEmail,
      password: "Acc@12345",
      name: "Acc G009",
      phone: "+447700900222",
      onboarding_intent: "TAXSIMBA",
    },
  });
  await db.collection("users").updateOne(
    { email: accEmail },
    {
      $set: {
        email_verified_at: new Date().toISOString(),
        status: "ACTIVE",
        is_active: true,
        role: "ACCOUNTANT",
        roles: ["ACCOUNTANT"],
        user_type: "ACCOUNTANT",
      },
    },
  );
  let accLogin = await api("POST", "/api/auth/login", { json: { email: accEmail, password: "Acc@12345" } });
  if (accLogin.status >= 400) {
    accLogin = await api("POST", "/api/auth/login", {
      json: { email: "acc.g006.1791257501784@taxsimba.test", password: "Acc@12345" },
    });
  }
  if (accLogin.status >= 400) {
    accLogin = await api("POST", "/api/auth/login", {
      json: { email: "accountant.a@taxsimba.co.uk", password: "Account@123" },
    });
  }
  const accTok = accLogin.body.access_token;
  let accUser =
    (await db.collection("users").findOne({ email: accEmail })) ||
    (await db.collection("users").findOne({ email: "acc.g006.1791257501784@taxsimba.test" })) ||
    (await db.collection("users").findOne({ email: "accountant.a@taxsimba.co.uk" }));
  push("accountant", !!accTok && !!accUser?.id, {
    status: accLogin.status,
    accId: accUser?.id,
    email: accUser?.email,
    role: accUser?.role,
  });
  if (!accTok || !accUser?.id) {
    fs.writeFileSync(`${OUT}/api_results.json`, JSON.stringify(results, null, 2));
    throw new Error("No accountant credentials available for G-009");
  }

  const mtdEmail = `mtd.g009b.${ts}@taxsimba.test`;
  await api("POST", "/api/auth/register", {
    json: {
      email: mtdEmail,
      password,
      name: "MTD G009",
      phone: "+447700900333",
      onboarding_intent: "MTD",
    },
  });
  await db.collection("users").updateOne(
    { email: mtdEmail },
    { $set: { email_verified_at: new Date().toISOString(), status: "ACTIVE", is_active: true } },
  );
  const mtdLogin = await api("POST", "/api/auth/login", { json: { email: mtdEmail, password } });
  const mtdTok = mtdLogin.body.access_token;
  const mtdUser = await db.collection("users").findOne({ email: mtdEmail });

  const mtdPkgs = await api("GET", "/api/packages?service_type=MTD_INCOME_TAX", { token: mtdTok });
  const mtdPkg = arr(mtdPkgs.body)[0];
  const mco = await api("POST", "/api/compat/client/subscription/checkout-session", {
    token: mtdTok,
    json: { planId: mtdPkg.id, origin_url: "http://127.0.0.1:3000" },
  });
  const msid = mco.body?.data?.sessionId || mco.body?.data?.session_id;
  await api("POST", "/api/compat/client/subscription/checkout-success", {
    token: mtdTok,
    json: { sessionId: msid, session_id: msid },
  });

  // Create MTD case as staff (same shape as prior live verify)
  let create = await api("POST", "/api/cases", {
    token: adminTok,
    json: {
      client_id: mtdUser.client_id || mtdUser.id,
      client_user_id: mtdUser.id,
      service_type: "MTD_INCOME_TAX",
      tax_year: "2024/25",
      created_from: "STAFF_MANUAL",
      manual_creation_reason: "Live verify G-009",
    },
  });
  let caseId = create.body?.id || create.body?.data?.id;
  if (!caseId) {
    create = await api("POST", "/api/compat/admin/manage-tax", {
      token: adminTok,
      json: {
        clientUserId: mtdUser.id,
        serviceType: "MTD_INCOME_TAX",
        taxYear: "2024/25",
        manualCreationReason: "G-009",
      },
    });
    caseId = create.body?.data?.id || create.body?.id;
  }
  push("mtd-case", !!caseId, { status: create.status, caseId, body: JSON.stringify(create.body).slice(0, 200) });

  // Assign accountant
  if (caseId) {
    await api("POST", `/api/cases/${caseId}/assign`, {
      token: adminTok,
      json: { accountant_id: accUser.id, accountant_user_id: accUser.id },
    });
    await api("POST", `/api/compat/admin/tax-returns/${caseId}/assign`, {
      token: adminTok,
      json: { accountantId: accUser.id, accountant_id: accUser.id },
    });
  }

  let periods = await api("GET", `/api/mtd/cases/${caseId}/periods`, { token: adminTok });
  if (periods.status >= 400) periods = await api("GET", `/api/mtd/cases/${caseId}/periods`, { token: accTok });
  const periodList = periods.body?.periods || periods.body || [];
  const periodId = Array.isArray(periodList) ? periodList[0]?.id : null;
  push("mtd-periods", !!periodId, { status: periods.status, periodId, count: periodList.length });

  if (periodId) {
    await api("POST", `/api/mtd/periods/${periodId}/figures`, {
      token: accTok,
      json: { income: 5000, expenses: 500, net_profit: 4500, estimated_income_tax: 400 },
    });
    await api("POST", `/api/mtd/periods/${periodId}/submit-for-review`, { token: accTok, json: {} });
    const approve = await api("POST", `/api/compat/admin/manage-review/${caseId}`, {
      token: adminTok,
      json: { action: "approve", periodId },
    });
    push("mtd-admin-approve", approve.status < 300, { status: approve.status });

    // Prefer empty body (version optional); if published_version known, send it.
    const periodDetail = await api("GET", `/api/mtd/periods/${periodId}`, { token: mtdTok });
    const publishedVersion =
      periodDetail.body?.published_version ??
      periodDetail.body?.data?.published_version ??
      periodDetail.body?.period?.published_version;
    const clientApprove = await api("POST", `/api/mtd/periods/${periodId}/client-approve`, {
      token: mtdTok,
      json: publishedVersion != null ? { version: publishedVersion } : {},
    });
    push("mtd-client-approve", clientApprove.status < 300, {
      status: clientApprove.status,
      publishedVersion,
      body: JSON.stringify(clientApprove.body).slice(0, 240),
    });

    await mailpitClear();
    // Compat list is POST /api/compat/all-notifications (not GET /client/notifications).
    const beforeNotifs = await api("POST", "/api/compat/all-notifications", {
      token: mtdTok,
      json: { page: 1, limit: 50 },
    });
    const beforeItems =
      beforeNotifs.body?.data?.notifications ||
      beforeNotifs.body?.notifications ||
      beforeNotifs.body?.data ||
      [];
    const beforeCount = Array.isArray(beforeItems) ? beforeItems.length : 0;

    const submit = await api("POST", `/api/mtd/periods/${periodId}/record-submission`, {
      token: adminTok,
      json: {
        submission_reference: `EXT-G009-${ts}`,
        submission_date: "2026-10-01",
      },
    });
    push("mtd-record-submission", submit.status < 300, {
      status: submit.status,
      periodStatus: submit.body?.status,
      ref: submit.body?.submission_reference,
      body: JSON.stringify(submit.body).slice(0, 240),
    });

    const afterNotifs = await api("POST", "/api/compat/all-notifications", {
      token: mtdTok,
      json: { page: 1, limit: 50 },
    });
    let notifs =
      afterNotifs.body?.data?.notifications ||
      afterNotifs.body?.notifications ||
      afterNotifs.body?.data ||
      [];
    if (!Array.isArray(notifs) || notifs.length === 0) {
      const native = await api("GET", "/api/notifications", { token: mtdTok });
      notifs = native.body?.data || native.body?.notifications || native.body || [];
    }
    // DB SoT fallback — proves notify() wrote /mtd-dashboard even if list shape drifts.
    const dbNotifs = await db
      .collection("notifications")
      .find({ user_id: mtdUser.id, title: /submitted/i })
      .sort({ created_at: -1 })
      .limit(5)
      .toArray();
    const subNotif =
      (Array.isArray(notifs) ? notifs : []).find(
        (n) =>
          /submitted/i.test(n.title || n.subject || "") ||
          n.type === "SUBMISSION" ||
          n.ntype === "SUBMISSION" ||
          /submitted/i.test(n.body || n.message || ""),
      ) || dbNotifs[0];
    const link = subNotif?.link || subNotif?.url || subNotif?.action_url || "";
    push("G-009-inapp-notification", !!subNotif && String(link).includes("/mtd-dashboard"), {
      verifier: "gapCloseVerify-v2",
      found: !!subNotif,
      title: subNotif?.title,
      link,
      beforeCount,
      afterCount: Array.isArray(notifs) ? notifs.length : 0,
      dbCount: dbNotifs.length,
      afterStatus: afterNotifs.status,
      mtdUserId: mtdUser?.id,
      sample: (Array.isArray(notifs) ? notifs : dbNotifs).slice(0, 5).map((n) => ({
        title: n.title,
        link: n.link || n.url || n.action_url,
        type: n.type || n.ntype,
      })),
    });

    let mailHit = null;
    let msgs = [];
    for (let i = 0; i < 40; i++) {
      const mail = await mailpitList();
      msgs = mail.messages || mail || [];
      mailHit = (Array.isArray(msgs) ? msgs : []).find((m) =>
        /submitted/i.test(m.Subject || m.subject || ""),
      );
      if (mailHit) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    push("G-009-mailpit", !!mailHit, {
      count: Array.isArray(msgs) ? msgs.length : 0,
      subject: mailHit?.Subject || mailHit?.subject,
      to: mailHit?.To || mailHit?.to,
      subjects: (Array.isArray(msgs) ? msgs : []).slice(0, 8).map((m) => m.Subject || m.subject),
    });
  }

  fs.writeFileSync(`${OUT}/api_results.json`, JSON.stringify(results, null, 2));
  fs.writeFileSync(
    `${OUT}/meta.txt`,
    `tested_at=${new Date().toISOString()}\nbranch=cursor/toxsl-blockers-b01-b04-80a7\n`,
  );
  const failed = results.filter((r) => !r.ok);
  console.log("DONE", { total: results.length, failed: failed.map((f) => f.id) });
  await c.close();
  process.exit(failed.length ? 2 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
