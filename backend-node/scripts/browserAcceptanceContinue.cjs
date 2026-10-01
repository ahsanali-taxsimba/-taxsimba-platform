/**
 * Continue browser-only SA journey from already-registered audit account.
 * No API-driven status transitions; Mailpit not needed here.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const CLIENT = "http://127.0.0.1:3000";
const ADMIN = "http://127.0.0.1:3001";
const OUT = "/opt/cursor/artifacts/acceptance-audit";
const NET = [];
const RESULTS = {};
fs.mkdirSync(OUT, { recursive: true });

const email = process.env.AUDIT_EMAIL || "audit-sa-muphrkz5@toxsl-audit.test";
const pass = "Client@12345";

function log(s) {
  console.log(s);
}
function mark(k, status, detail) {
  RESULTS[k] = { status, detail };
  log(`${status}: ${k} — ${detail}`);
}
async function shot(page, name) {
  const p = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  log(`SHOT ${p}`);
}

function attach(page, label) {
  page.on("response", (res) => {
    const u = res.url();
    if (/api\/|compat|checkout|progress|assign|upload|send-to|communication|draft|approve|apply-tax/i.test(u)) {
      NET.push({ label, method: res.request().method(), url: u, status: res.status() });
    }
  });
}

async function typeField(page, sel, value) {
  const el = page.locator(sel).first();
  await el.waitFor({ state: "visible", timeout: 30000 });
  await el.click();
  await el.fill("");
  await el.pressSequentially(String(value), { delay: 10 });
}

async function adminLogin(page) {
  await page.goto(`${ADMIN}/admin/auth/signin`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await typeField(page, 'input[name="email"]', "admin@taxsimba.co.uk");
  await typeField(page, 'input[name="password"]', "Admin@123");
  await page.locator('button:has-text("Sign In")').first().click();
  await page.waitForTimeout(4500);
}

async function accountantLogin(page) {
  await page.goto(`${ADMIN}/admin/auth/signin`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await typeField(page, 'input[name="email"]', "accountant.a@taxsimba.co.uk");
  await typeField(page, 'input[name="password"]', "Account@123");
  await page.locator('button:has-text("Sign In")').first().click();
  await page.waitForTimeout(4500);
}

async function clientLogin(page) {
  await page.goto(`${CLIENT}/login`, { waitUntil: "networkidle" });
  await page.locator('button:has-text("Accept All")').click().catch(() => null);
  await typeField(page, 'input[type="email"]', email);
  await typeField(page, 'input[type="password"]', pass);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(5000);
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/local/bin/google-chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  attach(page, "client");

  await clientLogin(page);
  await shot(page, "10-client-logged-in");
  mark("login", page.url().includes("login") ? "FAIL" : "PASS", page.url());

  // Engagement letter if still required
  if (page.url().includes("engagement-letter") || (await page.locator("text=AGREE & CONTINUE").count())) {
    await page.goto(`${CLIENT}/engagement-letter`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    // scroll document to bottom for progress
    await page.evaluate(() => {
      const main = document.querySelector("main") || document.scrollingElement;
      if (main) main.scrollTop = main.scrollHeight;
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(500);
    await page.locator(".el-chk-row").nth(0).click();
    await page.locator(".el-chk-row").nth(1).click();
    const canvas = page.locator("canvas.el-sig-canvas, canvas").first();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 30, box.y + 40);
      await page.mouse.down();
      await page.mouse.move(box.x + 180, box.y + 80);
      await page.mouse.move(box.x + 220, box.y + 30);
      await page.mouse.up();
    }
    await shot(page, "11-engagement-ready");
    const agree = page.locator('button.el-btn-main:has-text("AGREE")');
    const acceptWait = page.waitForResponse((r) => r.url().includes("accept-engagement-letter"), { timeout: 60000 }).catch(() => null);
    await agree.click({ force: true });
    const ar = await acceptWait;
    await page.waitForTimeout(4000);
    await shot(page, "12-after-engagement");
    mark(
      "engagement_accept",
      ar && ar.status() < 400 ? "PASS" : "FAIL",
      `net=${ar?.status()} ${ar?.url()} page=${page.url()}`,
    );
  }

  // Active packages
  await page.goto(`${CLIENT}/dashboard/my-subscriptions`, { waitUntil: "networkidle" }).catch(() => null);
  await page.waitForTimeout(2500);
  await shot(page, "13-my-subscriptions");
  const subText = await page.locator("body").innerText();
  mark(
    "my_active_packages",
    /Simple|Smart|Elite|Active|subscription|package/i.test(subText) && !/sign in/i.test(subText.slice(0, 40))
      ? "PASS"
      : "FAIL",
    subText.slice(0, 160).replace(/\n/g, " "),
  );

  // Start / apply tax return from dashboard or tax-return-form
  for (const u of [`${CLIENT}/dashboard`, `${CLIENT}/tax-return-form`, `${CLIENT}/my-tax-return`]) {
    await page.goto(u, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
    await page.waitForTimeout(2000);
    await shot(page, `14-${u.split("/").pop() || "dash"}`);
    const start = page.locator('a:has-text("Start Now"), button:has-text("Start Now"), button:has-text("Apply"), a:has-text("Apply")').first();
    if (await start.count()) {
      const applyWait = page.waitForResponse((r) => r.url().includes("apply-tax-return"), { timeout: 30000 }).catch(() => null);
      await start.click();
      const ap = await applyWait;
      await page.waitForTimeout(3000);
      await shot(page, "15-after-start-now");
      if (ap) mark("apply_tax_return", ap.status() < 400 ? "PASS" : "FAIL", `${ap.status()} ${ap.url()}`);
      break;
    }
  }
  if (!RESULTS.apply_tax_return) {
    // Try clicking Start Now inside tracker
    const sn = page.locator("text=Start Now").first();
    if (await sn.count()) {
      const applyWait = page.waitForResponse((r) => r.url().includes("apply-tax-return"), { timeout: 30000 }).catch(() => null);
      await sn.click();
      const ap = await applyWait;
      mark("apply_tax_return", ap && ap.status() < 400 ? "PASS" : "FAIL", ap ? `${ap.status()} ${ap.url()}` : "no apply response");
    } else {
      mark("apply_tax_return", "FAIL", "no Start Now control found in browser");
    }
  }

  await page.goto(`${CLIENT}/my-tax-return`, { waitUntil: "networkidle" }).catch(() => null);
  await page.waitForTimeout(2500);
  await shot(page, "16-my-tax-return");
  const taxText = await page.locator("body").innerText();
  mark("taxation_list", /tax return|Self Assessment|Simple|Smart|package|pending|assigned/i.test(taxText) ? "PASS" : "FAIL", taxText.slice(0, 120).replace(/\n/g, " "));

  // ——— Admin assign ———
  const admin = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  attach(admin, "admin");
  await adminLogin(admin);
  await admin.goto(`${ADMIN}/admin/manage-tax`, { waitUntil: "networkidle" });
  await admin.waitForTimeout(3000);
  await shot(admin, "17-admin-manage-tax");
  const adminBody = await admin.locator("body").innerText();
  const sees = /Audit|audit-sa-/i.test(adminBody);
  mark("admin_sees_client", sees && !/Failed to load/i.test(adminBody) ? "PASS" : "FAIL", adminBody.slice(0, 120).replace(/\n/g, " "));

  // Open first matching row link
  let caseUrl = null;
  const link = admin.locator('a[href*="/manage-tax/"], a[href*="/tax-return-list/"]').first();
  if (await link.count()) {
    caseUrl = await link.getAttribute("href");
    await link.click();
    await admin.waitForTimeout(3000);
  } else {
    // click row text Audit
    const row = admin.locator("tr, .card, div").filter({ hasText: /Audit/ }).locator("a").first();
    if (await row.count()) {
      await row.click();
      await admin.waitForTimeout(3000);
    }
  }
  await shot(admin, "18-admin-detail");
  caseUrl = admin.url();

  // Assign accountant if button present
  const assignBtn = admin.locator('button:has-text("Assign")').first();
  if (await assignBtn.count()) {
    await assignBtn.click();
    await admin.waitForTimeout(1500);
    await shot(admin, "19-assign-modal");
    // pick accountant
    const acct = admin.locator('text=/Amara|Boateng|accountant/i').first();
    if (await acct.count()) await acct.click().catch(() => null);
    const confirm = admin.locator('button:has-text("Assign"), button:has-text("Confirm"), button:has-text("Save")').last();
    const assignWait = admin.waitForResponse((r) => r.url().includes("assign"), { timeout: 30000 }).catch(() => null);
    if (await confirm.count()) await confirm.click();
    const as = await assignWait;
    await admin.waitForTimeout(2000);
    await shot(admin, "20-after-assign");
    mark("assign_accountant", as && as.status() < 400 ? "PASS" : "FAIL", as ? `${as.status()} ${as.url()}` : "no assign net");
  } else {
    mark("assign_accountant", "FAIL", "Assign button not found");
  }

  // ——— Accountant upload draft ———
  const acctPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  attach(acctPage, "accountant");
  await accountantLogin(acctPage);
  await acctPage.goto(`${ADMIN}/admin/tax-return-list`, { waitUntil: "networkidle" });
  await acctPage.waitForTimeout(3000);
  await shot(acctPage, "21-accountant-list");
  const aLink = acctPage.locator('a[href*="/tax-return-list/"], a[href*="/manage-tax/"]').first();
  if (await aLink.count()) {
    await aLink.click();
    await acctPage.waitForTimeout(3000);
  } else if (caseUrl) {
    const pathOnly = caseUrl.replace(/^https?:\/\/[^/]+/, "");
    await acctPage.goto(`http://127.0.0.1:3001${pathOnly.startsWith("/admin") ? pathOnly : "/admin" + pathOnly}`, {
      waitUntil: "networkidle",
    }).catch(() => null);
    await acctPage.waitForTimeout(2500);
  }
  await shot(acctPage, "22-accountant-detail");
  const uploadBtn = acctPage.locator('button:has-text("Upload Draft")').first();
  if (await uploadBtn.count()) {
    await uploadBtn.click();
    await acctPage.waitForTimeout(1500);
    await shot(acctPage, "23-upload-modal");
    // create temp pdf and set input
    const pdfPath = path.join(OUT, "browser-draft.pdf");
    fs.writeFileSync(pdfPath, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
    const fileInput = acctPage.locator('input[type="file"]').first();
    if (await fileInput.count()) {
      await fileInput.setInputFiles(pdfPath);
      const notes = acctPage.locator('textarea, input[name*="note"], input[placeholder*="note" i]').first();
      if (await notes.count()) await notes.fill("Browser audit draft upload");
      const submit = acctPage.locator('button:has-text("Upload"), button:has-text("Submit"), button:has-text("Send")').last();
      const upWait = acctPage.waitForResponse((r) => /upload-draft|draft/i.test(r.url()) && r.request().method() === "POST", { timeout: 60000 }).catch(() => null);
      await submit.click();
      const up = await upWait;
      await acctPage.waitForTimeout(3000);
      await shot(acctPage, "24-after-upload");
      mark("draft_upload", up && up.status() < 400 ? "PASS" : "FAIL", up ? `${up.status()} ${up.url()}` : "no upload net");
    } else {
      mark("draft_upload", "FAIL", "no file input in upload modal");
    }
  } else {
    mark("draft_upload", "FAIL", "Upload Draft button missing");
  }

  // ——— Admin Approve Draft ———
  await admin.goto(caseUrl.includes("manage-tax") || caseUrl.includes("tax-return-list") ? caseUrl : `${ADMIN}/admin/manage-tax`, {
    waitUntil: "networkidle",
  });
  await admin.waitForTimeout(3000);
  // reopen detail if list
  if (admin.url().endsWith("manage-tax") || admin.url().endsWith("tax-return-list")) {
    const l = admin.locator('a[href*="/manage-tax/"], a[href*="/tax-return-list/"]').first();
    if (await l.count()) {
      await l.click();
      await admin.waitForTimeout(3000);
    }
  }
  await shot(admin, "25-admin-before-approve");
  const approve = admin.locator('button:has-text("Approve Draft")').first();
  if (await approve.count()) {
    const apWait = admin.waitForResponse((r) => /progress|manage-review|approve/i.test(r.url()) && r.request().method() === "POST", { timeout: 60000 }).catch(() => null);
    await approve.click();
    const ap = await apWait;
    await admin.waitForTimeout(3500);
    await shot(admin, "26-admin-after-approve");
    mark("admin_approve_draft", ap && ap.status() < 400 ? "PASS" : "FAIL", ap ? `${ap.status()} ${ap.url()}` : "clicked but no net");
  } else {
    const advance = admin.locator('button:has-text("Advance to Draft Ready")').first();
    if (await advance.count()) {
      const apWait = admin.waitForResponse((r) => /progress|manage-review/i.test(r.url()), { timeout: 60000 }).catch(() => null);
      await advance.click();
      const ap = await apWait;
      await shot(admin, "26-admin-after-advance");
      mark("admin_approve_draft", ap && ap.status() < 400 ? "PASS" : "FAIL", ap ? `${ap.status()} ${ap.url()}` : "advance clicked");
    } else {
      mark("admin_approve_draft", "FAIL", "Approve Draft not visible");
    }
  }

  // Admin → client message
  const emailBtn = admin.locator('button:has-text("Email Client")').first();
  if (await emailBtn.count()) {
    await emailBtn.click();
    await admin.waitForTimeout(2000);
    await shot(admin, "27-email-modal");
    const subject = admin.locator('input[name="subject"], input[placeholder*="Subject" i]').first();
    const body = admin.locator('textarea').first();
    if (await subject.count()) await subject.fill("Admin browser audit message");
    if (await body.count()) await body.fill("Hello client from admin browser audit.");
    const sendWait = admin.waitForResponse((r) => /send-to-client/i.test(r.url()), { timeout: 30000 }).catch(() => null);
    await admin.locator('button:has-text("Send Email"), button:has-text("Send")').last().click();
    const sm = await sendWait;
    await admin.waitForTimeout(2000);
    await shot(admin, "28-after-admin-send");
    mark("admin_to_client_message", sm && sm.status() < 400 ? "PASS" : "FAIL", sm ? `${sm.status()} ${sm.url()}` : "send failed/no net");
  } else {
    mark("admin_to_client_message", "FAIL", "Email Client unavailable");
  }

  // ——— Client approve draft + message ———
  await page.goto(`${CLIENT}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await shot(page, "29-client-dashboard-after-release");
  const approveClient = page.locator('button:has-text("Approve")').filter({ hasText: /Approve/ }).first();
  // DraftFeedback Approve button
  const dfApprove = page.locator('button:has-text("Approve")').first();
  if (await dfApprove.count()) {
    const cWait = page.waitForResponse((r) => /drafts\/.*\/approve/i.test(r.url()), { timeout: 30000 }).catch(() => null);
    await dfApprove.click();
    const c = await cWait;
    await page.waitForTimeout(3000);
    await shot(page, "30-client-after-approve");
    mark("client_approve_draft", c && c.status() < 400 ? "PASS" : "FAIL", c ? `${c.status()} ${c.url()}` : "clicked approve no net");
  } else {
    mark("client_approve_draft", "FAIL", "Approve control not found on dashboard");
  }

  // Client message via chat if available
  const chat = page.locator('button:has-text("Message"), button:has-text("Chat"), text=Message').first();
  if (await chat.count()) {
    await chat.click().catch(() => null);
    await page.waitForTimeout(1500);
  }
  const compose = page.locator('button:has-text("Send New Email"), button:has-text("New Message"), button:has-text("Send Message")').first();
  if (await compose.count()) {
    await compose.click();
    await page.waitForTimeout(1500);
    await shot(page, "31-client-compose");
    const sub = page.locator('input[name="subject"], input[placeholder*="Subject" i]').first();
    const bod = page.locator('textarea').first();
    if (await sub.count()) await sub.fill("Client browser audit message");
    if (await bod.count()) await bod.fill("Hello accountant from client browser audit.");
    const sWait = page.waitForResponse((r) => /send-to-specific-accountant/i.test(r.url()), { timeout: 30000 }).catch(() => null);
    await page.locator('button:has-text("Send")').last().click();
    const s = await sWait;
    await page.waitForTimeout(2000);
    await shot(page, "32-client-after-send");
    mark("client_to_accountant_message", s && s.status() < 400 ? "PASS" : "FAIL", s ? `${s.status()} ${s.url()}` : "no send net / Invalid?");
    const bodyTxt = await page.locator("body").innerText();
    if (/Invalid Date/i.test(bodyTxt)) mark("message_invalid_date", "FAIL", "Invalid Date visible");
    else mark("message_invalid_date", "PASS", "no Invalid Date on page");
  } else {
    mark("client_to_accountant_message", "FAIL", "compose UI not found");
  }

  // refresh + relogin persistence check
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await shot(page, "33-after-refresh");
  await page.goto(`${CLIENT}/login`, { waitUntil: "networkidle" });
  // logout first
  await page.goto(`${CLIENT}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.locator('text=Log Out').click().catch(() => null);
  await page.waitForTimeout(1500);
  await clientLogin(page);
  await page.goto(`${CLIENT}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await shot(page, "34-after-relogin");
  const after = await page.locator("body").innerText();
  mark(
    "message_persist_relogin",
    /browser audit|Hello accountant|Admin browser|Hello client/i.test(after) ? "PASS" : "FAIL",
    "checked dashboard text for message content after relogin",
  );
  mark(
    "status_after_client_approve",
    /client approved|ready for submission|Ready for submission/i.test(after)
      ? "PASS"
      : /draft ready/i.test(after)
        ? "FAIL"
        : "FAIL",
    after.slice(0, 200).replace(/\n/g, " "),
  );

  fs.writeFileSync(path.join(OUT, "continue-results.json"), JSON.stringify({ RESULTS, NET: NET.slice(-80) }, null, 2));
  log("CONTINUE AUDIT DONE");
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  fs.writeFileSync(path.join(OUT, "continue-fatal.txt"), String(e.stack || e));
  process.exit(1);
});
