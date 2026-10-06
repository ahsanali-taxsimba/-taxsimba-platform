const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = "/opt/cursor/artifacts/acceptance-audit";
const CASE_ID = process.env.CASE_ID || "34c6eaf1-a9b6-44bd-a2ea-b7b292a73f04";
const ADMIN = "http://127.0.0.1:3001";
const CLIENT = "http://127.0.0.1:3000";

async function typeField(page, sel, val) {
  const el = page.locator(sel).first();
  await el.click();
  await el.fill("");
  await el.pressSequentially(val, { delay: 8 });
}
async function shot(p, n) {
  await p.screenshot({ path: `${OUT}/${n}.png`, fullPage: true });
  console.log("SHOT", n);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/local/bin/google-chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const net = [];
  const admin = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  admin.on("response", (r) => {
    if (/assign|upload|approve|progress|send-to|draft|upgrade|checkout/i.test(r.url())) {
      net.push(`${r.request().method()} ${r.status()} ${r.url()}`);
    }
  });

  await admin.goto(`${ADMIN}/admin/auth/signin`, { waitUntil: "networkidle" });
  await typeField(admin, 'input[name="email"]', "admin@taxsimba.co.uk");
  await typeField(admin, 'input[name="password"]', "Admin@123");
  await admin.locator('button:has-text("Sign In")').click();
  await admin.waitForTimeout(4000);
  await admin.goto(`${ADMIN}/admin/manage-tax/${CASE_ID}`, { waitUntil: "networkidle" });
  await admin.waitForTimeout(2500);
  await admin.locator('button:has-text("Assign")').first().click();
  await admin.waitForTimeout(1000);

  const selects = admin.locator("div.fixed select");
  console.log("select count", await selects.count());
  for (let i = 0; i < (await selects.count()); i++) {
    const opts = await selects.nth(i).locator("option").allTextContents();
    console.log("select", i, opts);
  }
  for (let i = 0; i < (await selects.count()); i++) {
    const values = await selects
      .nth(i)
      .locator("option")
      .evaluateAll((os) => os.map((o) => ({ v: o.value, t: o.textContent })));
    const pick = values.find((o) => /Amara|Boateng|accountant/i.test(o.t || "") && o.v);
    if (pick) {
      console.log("picking", pick);
      await selects.nth(i).selectOption(pick.v);
      break;
    }
  }
  await shot(admin, "80-assign-filled");
  const aw = admin
    .waitForResponse((r) => /assign/i.test(r.url()) && r.request().method() === "POST", {
      timeout: 30000,
    })
    .catch(() => null);
  await admin.locator('div.fixed button:has-text("Assign")').last().click();
  const a = await aw;
  let aBody = "";
  if (a) aBody = await a.text().catch(() => "");
  console.log("ASSIGN", a && a.status(), a && a.url(), aBody.slice(0, 300));
  await admin.waitForTimeout(2500);
  await shot(admin, "81-after-assign");

  const acct = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  acct.on("response", (r) => {
    if (/upload|draft|approve|progress/i.test(r.url())) {
      net.push(`acct ${r.request().method()} ${r.status()} ${r.url()}`);
    }
  });
  await acct.goto(`${ADMIN}/admin/auth/signin`, { waitUntil: "networkidle" });
  await typeField(acct, 'input[name="email"]', "accountant.a@taxsimba.co.uk");
  await typeField(acct, 'input[name="password"]', "Account@123");
  await acct.locator('button:has-text("Sign In")').click();
  await acct.waitForTimeout(4000);
  await acct.goto(`${ADMIN}/admin/manage-tax/${CASE_ID}`, { waitUntil: "networkidle" });
  await acct.waitForTimeout(2500);
  await shot(acct, "82-acct");
  console.log("upload btn", await acct.locator('button:has-text("Upload Draft")').count());
  if (await acct.locator('button:has-text("Upload Draft")').count()) {
    await acct.locator('button:has-text("Upload Draft")').click();
    await acct.waitForTimeout(1000);
    const pdf = `${OUT}/d3.pdf`;
    fs.writeFileSync(pdf, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
    await acct.locator('input[type="file"]').first().setInputFiles(pdf);
    if (await acct.locator("textarea").count()) {
      await acct.locator("textarea").first().fill("draft");
    }
    const uw = acct
      .waitForResponse((r) => /upload-draft/i.test(r.url()), { timeout: 60000 })
      .catch(() => null);
    await acct.locator('button:has-text("Upload"), button:has-text("Submit")').last().click();
    const u = await uw;
    console.log("UPLOAD", u && u.status(), u && u.url());
    await acct.waitForTimeout(2500);
    await shot(acct, "83-uploaded");
  }

  await admin.goto(`${ADMIN}/admin/manage-tax/${CASE_ID}`, { waitUntil: "networkidle" });
  await admin.waitForTimeout(2500);
  await shot(admin, "84-before-appr");
  console.log("approve btn", await admin.locator('button:has-text("Approve Draft")').count());
  if (await admin.locator('button:has-text("Approve Draft")').count()) {
    const w = admin
      .waitForResponse(
        (r) => /manage-review|progress/i.test(r.url()) && r.request().method() === "POST",
        { timeout: 60000 },
      )
      .catch(() => null);
    await admin.locator('button:has-text("Approve Draft")').click();
    const r = await w;
    let body = "";
    if (r) body = await r.text().catch(() => "");
    console.log("APPROVE", r && r.status(), r && r.url(), body.slice(0, 300));
    await admin.waitForTimeout(3000);
    await shot(admin, "85-approved");
  }

  const client = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await client.goto(`${CLIENT}/login`, { waitUntil: "networkidle" });
  await client.locator('button:has-text("Accept All")').click().catch(() => null);
  await typeField(client, 'input[type="email"]', "audit-sa-muphrkz5@toxsl-audit.test");
  await typeField(client, 'input[type="password"]', "Client@12345");
  await client.locator('button[type="submit"]').click();
  await client.waitForTimeout(5000);
  await client.goto(`${CLIENT}/dashboard`, { waitUntil: "networkidle" });
  await client.waitForTimeout(3000);
  await shot(client, "86-client");
  console.log("client approve count", await client.locator('button:has-text("Approve")').count());
  if (await client.locator('button:has-text("Approve")').count()) {
    const w = client
      .waitForResponse((r) => /drafts\/.*approve/i.test(r.url()), { timeout: 30000 })
      .catch(() => null);
    await client.locator('button:has-text("Approve")').first().click();
    const r = await w;
    console.log("CLIENT_APPROVE", r && r.status(), r && r.url());
    await client.waitForTimeout(3000);
    await shot(client, "87-client-approved");
  }
  console.log(
    "BODY",
    (await client.locator("body").innerText()).slice(0, 300).replace(/\n/g, " | "),
  );

  await client.goto(`${CLIENT}/dashboard/my-subscriptions`, { waitUntil: "networkidle" });
  await client.waitForTimeout(1500);
  await client.locator('button:has-text("View upgrade options")').click();
  await client.waitForTimeout(3000);
  await shot(client, "88-upgrade");
  const selectPlans = client.locator('button:has-text("Select Plan"), a:has-text("Select Plan")');
  console.log("select plan buttons", await selectPlans.count());
  if ((await selectPlans.count()) >= 2) {
    await selectPlans.nth(1).click();
    await client.waitForTimeout(2500);
    await shot(client, "89-smart");
    const cw = client
      .waitForResponse(
        (r) => /upgrade-checkout|checkout/i.test(r.url()) && r.request().method() === "POST",
        { timeout: 60000 },
      )
      .catch(() => null);
    await client
      .locator("button")
      .filter({ hasText: /pay|checkout|purchase|continue|upgrade|start|select/i })
      .first()
      .click()
      .catch(() => null);
    const cr = await cw;
    if (cr) {
      const t = await cr.text();
      console.log("UPG", cr.status(), t.slice(0, 300));
      try {
        const u = JSON.parse(t)?.data?.checkoutUrl;
        if (u) await client.goto(u, { waitUntil: "networkidle" });
      } catch {
        /* */
      }
    }
  }
  await client.waitForTimeout(4000);
  await client.goto(`${CLIENT}/dashboard/my-subscriptions`, { waitUntil: "networkidle" });
  await client.waitForTimeout(2500);
  await shot(client, "90-subs-final");
  console.log(
    "SUBS",
    (await client.locator("body").innerText()).match(/Simple|Smart|Elite|Active/g),
  );
  fs.writeFileSync(`${OUT}/stage4-net.txt`, net.join("\n"));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
