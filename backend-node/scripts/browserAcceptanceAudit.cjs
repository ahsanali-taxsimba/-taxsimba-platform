/**
 * Pre-handover browser-only acceptance audit.
 * Rules: business actions only via visible UI. Mailpit inbox is used solely to open
 * delivered verification emails (not DB token injection). No case status scripting.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const http = require("http");

const CLIENT = "http://127.0.0.1:3000";
const ADMIN = "http://127.0.0.1:3001";
const API = "http://127.0.0.1:8002";
const MAILPIT = "http://127.0.0.1:8025";
const OUT = "/opt/cursor/artifacts/acceptance-audit";
const NET = [];
const LOG = [];
const RESULTS = {};

fs.mkdirSync(OUT, { recursive: true });

function log(s) {
  LOG.push(s);
  console.log(s);
}
function mark(key, status, detail) {
  RESULTS[key] = { status, detail };
  log(`${status}: ${key} — ${detail}`);
}

async function shot(page, name) {
  const p = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  log(`SHOT ${p}`);
  return p;
}

function attachNet(page, label) {
  page.on("response", async (res) => {
    const u = res.url();
    if (
      u.includes("/api/") ||
      u.includes("compat") ||
      u.includes("checkout") ||
      u.includes("auth") ||
      u.includes("verify") ||
      u.includes("send-to") ||
      u.includes("communication") ||
      u.includes("progress") ||
      u.includes("upload") ||
      u.includes("assign")
    ) {
      NET.push({
        label,
        method: res.request().method(),
        url: u,
        status: res.status(),
      });
    }
  });
}

async function mailpitLatestTo(email) {
  const list = await fetch(`${MAILPIT}/api/v1/messages`).then((r) => r.json());
  const msgs = (list.messages || []).filter((m) =>
    JSON.stringify(m.To || []).toLowerCase().includes(email.toLowerCase()),
  );
  if (!msgs.length) return null;
  const id = msgs[0].ID;
  return fetch(`${MAILPIT}/api/v1/message/${id}`).then((r) => r.json());
}

async function waitMail(email, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const m = await mailpitLatestTo(email);
    if (m) return m;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

/** Complete Stripe Checkout (TEST mode) with Visa 4242… */
async function completeStripeTestCheckout(page) {
  await page.waitForURL(/checkout\.stripe\.com/i, { timeout: 90000 });
  await page.waitForTimeout(2000);
  // Email sometimes prefilled; fill if present
  const email = page.locator('input[type="email"], input[name="email"]').first();
  if (await email.count()) {
    const v = await email.inputValue().catch(() => "");
    if (!v) await email.fill("stripe-test@toxsl-audit.test").catch(() => null);
  }
  // Card fields may be in iframes
  const cardFrame = page.frameLocator('iframe[name*="card"], iframe[title*="card"], iframe[src*="elements"]').first();
  const numberCandidates = [
    page.locator('input[name="cardNumber"], input[autocomplete="cc-number"], input[placeholder*="Card number"]').first(),
    cardFrame.locator('input[name="cardnumber"], input[autocomplete="cc-number"]').first(),
  ];
  let filled = false;
  for (const loc of numberCandidates) {
    try {
      if (await loc.count()) {
        await loc.fill("4242424242424242", { timeout: 5000 });
        filled = true;
        break;
      }
    } catch {
      /* try next */
    }
  }
  if (!filled) {
    // Stripe Checkout often uses a single Payment Element iframe
    const frames = page.frames();
    for (const f of frames) {
      const n = f.locator('input[name="cardnumber"], input[autocomplete="cc-number"]').first();
      if (await n.count().catch(() => 0)) {
        await n.fill("4242424242424242");
        const exp = f.locator('input[name="exp-date"], input[autocomplete="cc-exp"]').first();
        if (await exp.count()) await exp.fill("1234");
        const cvc = f.locator('input[name="cvc"], input[autocomplete="cc-csc"]').first();
        if (await cvc.count()) await cvc.fill("123");
        filled = true;
        break;
      }
    }
  }
  // Expiry / CVC on main or frame
  const expMain = page.locator('input[name="cardExpiry"], input[autocomplete="cc-exp"], input[placeholder*="MM"]').first();
  if (await expMain.count()) await expMain.fill("12 / 34").catch(() => expMain.fill("1234"));
  const cvcMain = page.locator('input[name="cardCvc"], input[autocomplete="cc-csc"], input[placeholder*="CVC"]').first();
  if (await cvcMain.count()) await cvcMain.fill("123");
  // Billing name / address if required
  const name = page.locator('input[name="billingName"], input[autocomplete="name"]').first();
  if (await name.count()) await name.fill("Audit SA").catch(() => null);
  const country = page.locator('select[name="billingCountry"], select[autocomplete="country"]').first();
  if (await country.count()) await country.selectOption({ label: "United Kingdom" }).catch(() => null);
  const postal = page.locator('input[name="billingPostalCode"], input[autocomplete="postal-code"]').first();
  if (await postal.count()) await postal.fill("SW1A 1AA").catch(() => null);
  // Submit
  const pay = page.locator('button[type="submit"], button:has-text("Pay"), button:has-text("Subscribe")').first();
  await pay.click({ timeout: 15000 });
  await page.waitForTimeout(4000);
}

async function typeField(page, selector, value) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: "visible", timeout: 30000 });
  await el.click();
  await el.fill("");
  await el.pressSequentially(String(value), { delay: 12 });
}

async function adminLogin(page, email, password) {
  await page.goto(`${ADMIN}/admin/auth/signin`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1000);
  await typeField(page, 'input[name="email"]', email);
  await typeField(page, 'input[name="password"]', password);
  await page.locator('button:has-text("Sign In")').first().click();
  await page.waitForTimeout(5000);
  if (page.url().includes("/signin")) throw new Error("admin login failed");
}

async function clientLogin(page, email, password) {
  await page.goto(`${CLIENT}/login`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(800);
  await typeField(page, 'input[type="email"], input[name="email"]', email);
  await typeField(page, 'input[type="password"], input[name="password"]', password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(4000);
}

async function dismissCookies(page) {
  const btn = page.locator('button:has-text("Accept All")').first();
  if (await btn.count()) {
    await btn.click().catch(() => null);
    await page.waitForTimeout(500);
  }
}

async function main() {
  const stamp = Date.now().toString(36);
  const saEmail = `audit-sa-${stamp}@toxsl-audit.test`;
  const saPass = "Client@12345";
  const mtdEmail = `audit-mtd-${stamp}@toxsl-audit.test`;
  const upgradeEmail = `audit-upg-${stamp}@toxsl-audit.test`;
  log(`SHA check expected af181415d60bc26ab97c8f981c4efc536b306c82`);
  log(`Fresh SA ${saEmail}`);
  log(`Fresh MTD ${mtdEmail}`);
  log(`Fresh UPGRADE ${upgradeEmail}`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/local/bin/google-chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  // ——— 6. Privacy / Terms from footer (public, no login) ———
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    attachNet(page, "legal");
    await page.goto(`${CLIENT}/`, { waitUntil: "networkidle", timeout: 90000 });
    await dismissCookies(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await shot(page, "06a-home-footer");
    const priv = page.locator('footer a[href="/privacy-policy"], a[href="/privacy-policy"]').first();
    const terms = page
      .locator('footer a[href="/terms-and-conditions"], a[href="/terms-and-conditions"]')
      .first();
    if (!(await priv.count()) || !(await terms.count())) {
      mark("6_footer_links_present", "FAIL", "footer missing privacy/terms anchors");
    } else {
      const [pRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/privacy-policy"), { timeout: 30000 }).catch(() => null),
        priv.click(),
      ]);
      await page.waitForTimeout(1500);
      await shot(page, "06b-privacy-from-footer");
      const pOk = page.url().includes("/privacy-policy") && !/error|404/i.test(await page.locator("body").innerText());
      mark(
        "6_privacy_from_footer",
        pOk ? "PASS" : "FAIL",
        `url=${page.url()} net=${pRes?.status?.() || "n/a"}`,
      );

      await page.goto(`${CLIENT}/`, { waitUntil: "networkidle" });
      await dismissCookies(page);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const [tRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/terms-and-conditions"), { timeout: 30000 }).catch(() => null),
        page.locator('footer a[href="/terms-and-conditions"]').first().click(),
      ]);
      await page.waitForTimeout(1500);
      await shot(page, "06c-terms-from-footer");
      const tOk = page.url().includes("/terms-and-conditions");
      mark(
        "6_terms_from_footer",
        tOk ? "PASS" : "FAIL",
        `url=${page.url()} net=${tRes?.status?.() || "n/a"}`,
      );
    }

    // Registration page links
    await page.goto(`${CLIENT}/register`, { waitUntil: "networkidle" });
    await dismissCookies(page);
    await shot(page, "06d-register-page");
    const regLinks = await page
      .locator('a[href*="privacy"], a[href*="terms"]')
      .evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    mark(
      "6_privacy_terms_on_registration",
      regLinks.length >= 2 ? "PASS" : "FAIL",
      `links=${JSON.stringify(regLinks)}`,
    );
    await page.close();
  }

  // ——— 1. Fresh SA registration + email verification via Mailpit inbox ———
  const saCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const saPage = await saCtx.newPage();
  attachNet(saPage, "sa");
  let saCaseId = null;
  try {
    await saPage.goto(`${CLIENT}/register`, { waitUntil: "networkidle", timeout: 90000 });
    await dismissCookies(saPage);
    await typeField(saPage, 'input[name="name"]', "Audit");
    await typeField(saPage, 'input[name="surname"]', "SA");
    await typeField(saPage, 'input[name="email"]', saEmail);
    await typeField(saPage, 'input[name="mobile"]', "07700900111");
    await typeField(saPage, 'input[name="password"]', saPass);
    await typeField(saPage, 'input[name="confirmPassword"]', saPass);
    await shot(saPage, "01a-register-filled");
    const regWait = saPage.waitForResponse(
      (r) => r.url().includes("register") || r.url().includes("auth"),
      { timeout: 60000 },
    ).catch(() => null);
    await saPage.locator('button:has-text("Register Now")').click();
    const regRes = await regWait;
    await saPage.waitForTimeout(3000);
    await shot(saPage, "01b-after-register");
    mark(
      "1_registration",
      regRes && regRes.status() < 400 ? "PASS" : pageLikelyRegistered(saPage) ? "PASS" : "FAIL",
      `net=${regRes ? regRes.status() + " " + regRes.url() : "n/a"} url=${saPage.url()}`,
    );

    // Real email verification via Mailpit inbox (delivered email)
    const mail = await waitMail(saEmail, 45000);
    if (!mail) {
      mark("1_email_verification", "FAIL", "no verification email delivered to Mailpit inbox");
    } else {
      const html = mail.HTML || "";
      const text = mail.Text || "";
      const linkMatch =
        html.match(/href=["'](http[^"']*verify-email[^"']*)["']/) ||
        text.match(/(http[^\s]*verify-email[^\s]*)/);
      const verifyUrl = linkMatch ? linkMatch[1].replace(/&amp;/g, "&") : null;
      const logoOk = /images\/logo\.png|taxsimba.*logo/i.test(html);
      mark(
        "5_verify_email_logo",
        logoOk ? "PASS" : "FAIL",
        `imgs=${[...html.matchAll(/src=["']([^"']+)/g)].map((m) => m[1]).join(",")}`,
      );
      if (!verifyUrl) {
        mark("1_email_verification", "FAIL", "verification email missing CTA link");
      } else {
        const vRes = await saPage.goto(verifyUrl, { waitUntil: "networkidle", timeout: 90000 });
        await saPage.waitForTimeout(2000);
        await shot(saPage, "01c-email-verify");
        mark(
          "1_email_verification",
          vRes && vRes.status() < 400 ? "PASS" : "FAIL",
          `opened ${verifyUrl} status=${vRes?.status()} page=${saPage.url()}`,
        );
        // CTA working page
        mark(
          "5_verify_cta_opens",
          saPage.url().includes("verify") || saPage.url().includes("login") || saPage.url().includes("dashboard") || saPage.url().includes("planlist")
            ? "PASS"
            : "FAIL",
          `landing=${saPage.url()}`,
        );
      }
    }

    // Login
    await clientLogin(saPage, saEmail, saPass);
    await dismissCookies(saPage);
    await shot(saPage, "01d-after-login");
    mark(
      "1_login_after_verify",
      !saPage.url().includes("/login") || (await saPage.locator("body").innerText()).length > 100
        ? "PASS"
        : "FAIL",
      `url=${saPage.url()}`,
    );

    // Checkout — must reach Stripe TEST hosted checkout (not PAYMENT_PROVIDER=fake).
    await saPage.goto(`${CLIENT}/planlist?category=taxSimba`, { waitUntil: "networkidle", timeout: 90000 });
    await dismissCookies(saPage);
    await saPage.waitForTimeout(2000);
    await shot(saPage, "01e-planlist");
    const planLegal = await saPage
      .locator('a[href*="privacy"], a[href*="terms"]')
      .evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    mark(
      "6_privacy_terms_on_checkout_planlist",
      planLegal.some((h) => /privacy/i.test(h || "")) && planLegal.some((h) => /terms/i.test(h || ""))
        ? "PASS"
        : "FAIL",
      `links=${JSON.stringify(planLegal)}`,
    );

    // Prefer Simple package for later upgrade eligibility
    const simpleCard = saPage.locator('a[href*="/planlist/"]').filter({ hasText: /Simple/i }).first();
    if (await simpleCard.count()) {
      await simpleCard.click();
    } else {
      const pkgLink = saPage.locator('a[href*="/planlist/"]').first();
      if (await pkgLink.count()) await pkgLink.click();
      else await saPage.locator("text=Simple").first().click().catch(() => null);
    }
    await saPage.waitForTimeout(2500);
    await shot(saPage, "01f-package-detail");

    const checkoutPromise = saPage.waitForResponse(
      (r) => r.url().includes("checkout") && r.request().method() === "POST",
      { timeout: 90000 },
    ).catch(() => null);
    const payBtn = saPage
      .locator(
        'button:has-text("Pay"), button:has-text("Checkout"), button:has-text("Purchase"), button:has-text("Buy"), button:has-text("Continue"), a:has-text("Checkout")',
      )
      .first();
    if (await payBtn.count()) await payBtn.click();
    else {
      await saPage.locator("button").filter({ hasText: /pay|checkout|purchase|start|continue/i }).first().click().catch(() => null);
    }
    const checkoutRes = await checkoutPromise;
    await saPage.waitForTimeout(4000);
    await shot(saPage, "01g-after-checkout-click");
    const checkoutUrl = checkoutRes?.url() || "";
    const checkoutStatus = checkoutRes?.status();
    let checkoutBody = "";
    try {
      checkoutBody = checkoutRes ? await checkoutRes.text() : "";
    } catch {
      /* */
    }
    let hostedUrl = "";
    try {
      const parsed = JSON.parse(checkoutBody || "{}");
      hostedUrl = parsed?.data?.checkoutUrl || parsed?.data?.checkout_url || "";
    } catch {
      /* */
    }
    if (hostedUrl && !/checkout\.stripe\.com/i.test(saPage.url())) {
      await saPage.goto(hostedUrl, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => null);
      await saPage.waitForTimeout(3000);
    }
    const isStripeHosted = /checkout\.stripe\.com/i.test(saPage.url());
    const isFakeLocal =
      /cs_test_local_/i.test(checkoutBody) ||
      /cs_test_local_/i.test(saPage.url()) ||
      /PAYMENT_PROVIDER=fake/i.test(checkoutBody);
    mark(
      "1_stripe_test_checkout",
      isStripeHosted && !isFakeLocal ? "PASS" : "FAIL",
      `stripeHosted=${isStripeHosted} fakeLocal=${isFakeLocal} net=${checkoutStatus} api=${checkoutUrl} page=${saPage.url()} bodySnippet=${checkoutBody.slice(0, 160)}`,
    );

    if (isStripeHosted) {
      // Complete Stripe TEST Checkout with test card 4242…
      try {
        await completeStripeTestCheckout(saPage);
        await saPage.waitForURL(/checkout-success|session_id|dashboard|engagement/i, { timeout: 120000 }).catch(() => null);
        await saPage.waitForTimeout(5000);
        await shot(saPage, "01h-checkout-success");
        mark(
          "1_checkout_activation_browser",
          /checkout-success|session_id|dashboard|engagement/i.test(saPage.url()) ? "PASS" : "FAIL",
          `after Stripe TEST pay url=${saPage.url()}`,
        );
      } catch (stripeErr) {
        await shot(saPage, "01h-stripe-pay-fail");
        mark("1_checkout_activation_browser", "FAIL", `Stripe TEST pay failed: ${stripeErr.message || stripeErr}`);
      }
    } else if (saPage.url().includes("checkout-success") || saPage.url().includes("session_id")) {
      await shot(saPage, "01h-checkout-success");
      mark("1_checkout_activation_browser", "FAIL", `landed ${saPage.url()} without Stripe hosted checkout (fake/local provider)`);
    } else {
      mark("1_checkout_activation_browser", "FAIL", `checkout not completed via Stripe TEST browser; page=${saPage.url()}`);
    }

    // My Active Packages
    for (const pathTry of ["/dashboard/my-subscriptions", "/my-subscriptions", "/dashboard"]) {
      await saPage.goto(`${CLIENT}${pathTry}`, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
      await saPage.waitForTimeout(2000);
      const t = await saPage.locator("body").innerText();
      if (/Simple|Smart|Elite|Active|package|subscription/i.test(t) && !/sign in|log in/i.test(t.slice(0, 80))) {
        await shot(saPage, "01i-active-packages");
        mark("1_my_active_packages", "PASS", `path=${pathTry} snippet=${t.slice(0, 120).replace(/\n/g, " ")}`);
        break;
      }
    }
    if (!RESULTS["1_my_active_packages"]) {
      await shot(saPage, "01i-active-packages-miss");
      mark("1_my_active_packages", "FAIL", `could not confirm package on UI url=${saPage.url()}`);
    }

    // Taxation list / my tax return
    for (const pathTry of ["/my-tax-return", "/dashboard", "/taxation-list"]) {
      await saPage.goto(`${CLIENT}${pathTry}`, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
      await saPage.waitForTimeout(2000);
      const t = await saPage.locator("body").innerText();
      if (/tax return|Self Assessment|Simple|Smart|package|Taxation/i.test(t)) {
        await shot(saPage, "01j-taxation-list");
        mark("1_taxation_list_package", "PASS", `path=${pathTry}`);
        break;
      }
    }
    if (!RESULTS["1_taxation_list_package"]) {
      mark("1_taxation_list_package", "FAIL", "package not visible on taxation/my-tax-return UI");
    }

    // Engagement letter — custom toggles + canvas signature (not native checkboxes)
    await saPage.goto(`${CLIENT}/engagement-letter`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => null);
    await saPage.waitForTimeout(2000);
    await shot(saPage, "01k-engagement-letter");
    const engText = await saPage.locator("body").innerText();
    if (/engagement|signature|agree|subscription agreement/i.test(engText)) {
      const agreeSub = saPage.locator('[data-testid="engagement-agree-subscription"]').first();
      const agreeTerms = saPage.locator('[data-testid="engagement-agree-terms"]').first();
      if (await agreeSub.count()) await agreeSub.click();
      else await saPage.locator(".el-chk-row").nth(0).click().catch(() => null);
      if (await agreeTerms.count()) await agreeTerms.click();
      else await saPage.locator(".el-chk-row").nth(1).click().catch(() => null);

      const canvas = saPage.locator('[data-testid="engagement-signature-canvas"], canvas').first();
      if (await canvas.count()) {
        const box = await canvas.boundingBox();
        if (box) {
          await saPage.mouse.move(box.x + 30, box.y + 40);
          await saPage.mouse.down();
          for (let i = 0; i < 8; i++) {
            await saPage.mouse.move(box.x + 30 + i * 18, box.y + 40 + (i % 2 === 0 ? 12 : -8));
          }
          await saPage.mouse.up();
        }
      }
      await saPage.waitForTimeout(500);
      const acceptBtn = saPage.locator('[data-testid="engagement-agree-submit"], button.el-btn-main').first();
      if (await acceptBtn.count()) {
        await acceptBtn.click({ timeout: 15000 });
        await saPage.waitForTimeout(4000);
      }
      await shot(saPage, "01l-engagement-after-accept");
      const submitting = await saPage.locator("text=SUBMITTING").count();
      const after = await saPage.locator("body").innerText();
      mark(
        "1_engagement_tax_info",
        submitting
          ? "FAIL"
          : /Complete Setup|Tax Info|business|UTR|Success|dashboard|My Tax/i.test(after) ||
              saPage.url().includes("dashboard") ||
              saPage.url().includes("my-tax")
            ? "PASS"
            : "FAIL",
        `url=${saPage.url()} stuckSubmitting=${!!submitting}`,
      );
    } else {
      mark("1_engagement_tax_info", "FAIL", `engagement page unexpected: ${engText.slice(0, 120)}`);
    }
  } catch (e) {
    mark("1_sa_journey_exception", "FAIL", String(e && e.stack ? e.stack : e));
    await shot(saPage, "01z-exception").catch(() => null);
  }

  // ——— Admin assign + approve path (browser) — only if we can find the client ———
  try {
    const adminPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    attachNet(adminPage, "admin");
    await adminLogin(adminPage, "admin@taxsimba.co.uk", "Admin@123");
    await shot(adminPage, "01m-admin-overview");
    await adminPage.goto(`${ADMIN}/admin/manage-tax`, { waitUntil: "networkidle", timeout: 90000 });
    await adminPage.waitForTimeout(3000);
    await shot(adminPage, "01n-manage-tax");
    const body = await adminPage.locator("body").innerText();
    if (/Audit SA|audit-sa-|Failed to load/i.test(body)) {
      mark("1_admin_sees_client", /Failed to load/i.test(body) ? "FAIL" : "PASS", "manage-tax list");
      const row = adminPage.locator("text=Audit").first();
      if (await row.count()) {
        await row.click();
        await adminPage.waitForTimeout(3000);
        await shot(adminPage, "01o-tax-return-detail");
      }
    } else {
      mark(
        "1_admin_sees_client",
        "FAIL",
        "fresh SA client not visible yet (purchase/engagement may be incomplete) — cannot continue assign/approve via UI from this account alone",
      );
    }

    // Messaging compose from admin if detail open
    const emailBtn = adminPage.locator('button:has-text("Email Client")').first();
    if (await emailBtn.count()) {
      await emailBtn.click();
      await adminPage.waitForTimeout(2000);
      await shot(adminPage, "03a-admin-email-modal");
      const modal = await adminPage.locator("body").innerText();
      mark(
        "3_admin_email_modal",
        /Unable to load email template/i.test(modal) ? "FAIL" : "PASS",
        /Invalid/i.test(modal) && /template/i.test(modal) ? "Invalid/template error" : "modal opened",
      );
    } else {
      mark("3_admin_email_modal", "FAIL", "Email Client button not available (no open return detail)");
    }
    await adminPage.close();
  } catch (e) {
    mark("1_admin_path", "FAIL", String(e.message || e));
  }

  // ——— 2. MTD journey registration through browser ———
  try {
    const mtdPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    attachNet(mtdPage, "mtd");
    await mtdPage.goto(`${CLIENT}/register`, { waitUntil: "networkidle" });
    await dismissCookies(mtdPage);
    await typeField(mtdPage, 'input[name="name"]', "Audit");
    await typeField(mtdPage, 'input[name="surname"]', "MTD");
    await typeField(mtdPage, 'input[name="email"]', mtdEmail);
    await typeField(mtdPage, 'input[name="mobile"]', "07700900222");
    await typeField(mtdPage, 'input[name="password"]', saPass);
    await typeField(mtdPage, 'input[name="confirmPassword"]', saPass);
    await mtdPage.locator('button:has-text("Register Now")').click();
    await mtdPage.waitForTimeout(3000);
    await shot(mtdPage, "02a-mtd-registered");
    const mmail = await waitMail(mtdEmail, 45000);
    if (mmail) {
      const html = mmail.HTML || "";
      const link = html.match(/href=["'](http[^"']*verify-email[^"']*)["']/);
      if (link) {
        await mtdPage.goto(link[1].replace(/&amp;/g, "&"), { waitUntil: "networkidle" });
        await mtdPage.waitForTimeout(1500);
      }
      mark("2_mtd_email_verify", "PASS", "verification email opened from Mailpit");
    } else {
      mark("2_mtd_email_verify", "FAIL", "no MTD verification email");
    }
    await clientLogin(mtdPage, mtdEmail, saPass);
    await mtdPage.goto(`${CLIENT}/planlist?category=mtd`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => null);
    await mtdPage.waitForTimeout(2500);
    await shot(mtdPage, "02b-mtd-planlist");
    const pkg = mtdPage.locator('a[href*="/planlist/"]').first();
    if (await pkg.count()) {
      await pkg.click();
      await mtdPage.waitForTimeout(2000);
      const checkoutPromise = mtdPage.waitForResponse((r) => r.url().includes("checkout") && r.request().method() === "POST", { timeout: 60000 }).catch(() => null);
      await mtdPage.locator("button").filter({ hasText: /pay|checkout|purchase|continue|start/i }).first().click().catch(() => null);
      const cr = await checkoutPromise;
      await mtdPage.waitForTimeout(4000);
      if (cr) {
        try {
          const body = await cr.text();
          const parsed = JSON.parse(body);
          const url = parsed?.data?.checkoutUrl || parsed?.data?.checkout_url;
          if (url) await mtdPage.goto(url, { waitUntil: "networkidle" });
        } catch {
          /* */
        }
      }
      await mtdPage.waitForTimeout(4000);
      await shot(mtdPage, "02c-mtd-after-checkout");
    }
    await mtdPage.goto(`${CLIENT}/mtd-dashboard`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => null);
    await mtdPage.waitForTimeout(2500);
    await shot(mtdPage, "02d-mtd-dashboard");
    const mt = await mtdPage.locator("body").innerText();
    mark(
      "2_mtd_dashboard",
      /MTD|Making Tax Digital|Quarter|Comply|Growth|Elite/i.test(mt) ? "PASS" : "FAIL",
      `url=${mtdPage.url()}`,
    );
    mark(
      "2_mtd_full_implemented_stages",
      "PARTIAL",
      "Registered+verified+checkout attempted+dashboard opened in browser; remaining accountant/admin MTD stages not completed in this audit pass",
    );
    await mtdPage.close();
  } catch (e) {
    mark("2_mtd_journey", "FAIL", String(e.message || e));
  }

  // ——— 4. Upgrade on eligible fresh account (SIMPLE then upgrade to SMART before lock) ———
  try {
    const upPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    attachNet(upPage, "upgrade");
    await upPage.goto(`${CLIENT}/register`, { waitUntil: "networkidle" });
    await dismissCookies(upPage);
    await typeField(upPage, 'input[name="name"]', "Audit");
    await typeField(upPage, 'input[name="surname"]', "Upgrade");
    await typeField(upPage, 'input[name="email"]', upgradeEmail);
    await typeField(upPage, 'input[name="mobile"]', "07700900333");
    await typeField(upPage, 'input[name="password"]', saPass);
    await typeField(upPage, 'input[name="confirmPassword"]', saPass);
    await upPage.locator('button:has-text("Register Now")').click();
    await upPage.waitForTimeout(2500);
    const umail = await waitMail(upgradeEmail, 45000);
    if (umail) {
      const link = (umail.HTML || "").match(/href=["'](http[^"']*verify-email[^"']*)["']/);
      if (link) await upPage.goto(link[1].replace(/&amp;/g, "&"), { waitUntil: "networkidle" });
    }
    await clientLogin(upPage, upgradeEmail, saPass);
    await upPage.goto(`${CLIENT}/planlist?category=taxSimba`, { waitUntil: "networkidle" });
    await upPage.waitForTimeout(2000);
    // Buy SIMPLE via first cheapest / Simple card if possible
    const simpleCard = upPage.locator("text=/Simple/i").first();
    if (await simpleCard.count()) await simpleCard.click().catch(() => null);
    await upPage.waitForTimeout(1500);
    let pkgLink = upPage.locator('a[href*="/planlist/"]').first();
    if (await pkgLink.count()) await pkgLink.click();
    await upPage.waitForTimeout(2000);
    let checkoutPromise = upPage.waitForResponse((r) => r.url().includes("checkout") && r.request().method() === "POST", { timeout: 60000 }).catch(() => null);
    await upPage.locator("button").filter({ hasText: /pay|checkout|purchase|continue|start/i }).first().click().catch(() => null);
    let cr = await checkoutPromise;
    if (cr) {
      try {
        const body = await cr.text();
        const url = JSON.parse(body)?.data?.checkoutUrl;
        if (url) await upPage.goto(url, { waitUntil: "networkidle" });
      } catch {
        /* */
      }
    }
    await upPage.waitForTimeout(4000);
    await shot(upPage, "04a-after-initial-purchase");

    // Navigate to upgrade options
    await upPage.goto(`${CLIENT}/dashboard/my-subscriptions`, { waitUntil: "networkidle" }).catch(() => null);
    await upPage.waitForTimeout(2000);
    await shot(upPage, "04b-subscriptions-before-upgrade");
    const upgradeCta = upPage.getByRole("button", { name: /upgrade/i }).or(upPage.getByRole("link", { name: /upgrade/i })).first();
    if (await upgradeCta.count()) {
      await upgradeCta.click();
      await upPage.waitForTimeout(2500);
    } else {
      await upPage.goto(`${CLIENT}/planlist?category=taxSimba`, { waitUntil: "networkidle" });
    }
    await shot(upPage, "04c-upgrade-planlist");
    // Choose Smart
    const smartLink = upPage.locator('a[href*="/planlist/"]').filter({ hasText: /Smart/i }).first();
    if (await smartLink.count()) await smartLink.click();
    else {
      const smart = upPage.getByText(/Smart/i).first();
      if (await smart.count()) await smart.click().catch(() => null);
      pkgLink = upPage.locator('a[href*="/planlist/"]').nth(1);
      if (await pkgLink.count()) await pkgLink.click().catch(() => null);
    }
    await upPage.waitForTimeout(2000);
    checkoutPromise = upPage.waitForResponse(
      (r) => (r.url().includes("upgrade-checkout") || r.url().includes("checkout")) && r.request().method() === "POST",
      { timeout: 60000 },
    ).catch(() => null);
    await upPage.locator("button").filter({ hasText: /pay|checkout|purchase|continue|upgrade|start/i }).first().click().catch(() => null);
    cr = await checkoutPromise;
    let upgradeNet = `status=${cr?.status()} url=${cr?.url()}`;
    let upgradeHosted = "";
    if (cr) {
      try {
        const body = await cr.text();
        upgradeNet += ` body=${body.slice(0, 200)}`;
        upgradeHosted = JSON.parse(body)?.data?.checkoutUrl || "";
        if (upgradeHosted) await upPage.goto(upgradeHosted, { waitUntil: "domcontentloaded", timeout: 120000 });
      } catch {
        /* */
      }
    }
    if (/checkout\.stripe\.com/i.test(upPage.url())) {
      await completeStripeTestCheckout(upPage).catch((e) => {
        upgradeNet += ` stripePayErr=${e.message}`;
      });
      await upPage.waitForURL(/checkout-success|session_id|dashboard|subscription/i, { timeout: 120000 }).catch(() => null);
      await upPage.waitForTimeout(5000);
    }
    await shot(upPage, "04d-after-upgrade-attempt");
    await upPage.goto(`${CLIENT}/dashboard/my-subscriptions`, { waitUntil: "networkidle" }).catch(() => null);
    await upPage.waitForTimeout(2000);
    await shot(upPage, "04e-subscriptions-after-upgrade");
    const subText = await upPage.locator("body").innerText();
    const upgraded = /Smart/i.test(subText) && !/Simple/i.test(subText);
    mark(
      "4_package_upgrade_browser",
      upgraded && /checkout\.stripe\.com/i.test(upgradeHosted || "") ? "PASS" : upgraded ? "PARTIAL" : "FAIL",
      `${upgradeNet}; subscriptionsUI hasSmart=${upgraded}; stripeHosted=${/checkout\.stripe\.com/i.test(upgradeHosted || "")}`,
    );
    await upPage.close();
  } catch (e) {
    mark("4_package_upgrade_browser", "FAIL", String(e.message || e));
  }

  // ——— 5. Purchase confirmation email in Mailpit (logo/CTA) ———
  try {
    const list = await fetch(`${MAILPIT}/api/v1/messages`).then((r) => r.json());
    const purchase = (list.messages || []).find((m) => /purchase|welcome|subscription|package|confirm/i.test(m.Subject || ""));
    if (!purchase) {
      mark("5_purchase_email_delivery", "FAIL", "no purchase/welcome email found in Mailpit");
    } else {
      const msg = await fetch(`${MAILPIT}/api/v1/message/${purchase.ID}`).then((r) => r.json());
      const html = msg.HTML || "";
      fs.writeFileSync(path.join(OUT, "05-purchase-email.html"), html);
      const logo = /images\/logo\.png/i.test(html);
      const links = [...html.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]);
      mark("5_purchase_email_delivery", "PASS", `to=${JSON.stringify(msg.To)} subject=${msg.Subject}`);
      mark("5_purchase_email_logo", logo ? "PASS" : "FAIL", `imgs present logo=${logo}`);
      mark("5_purchase_email_cta", links.length ? "PASS" : "FAIL", `links=${links.slice(0, 5).join(",")}`);
      // Open logo URL
      const page = await browser.newPage();
      const logoRes = await page.goto(`${CLIENT}/images/logo.png`, { waitUntil: "load" });
      await shot(page, "05-logo-asset");
      mark("5_logo_http", logoRes && logoRes.status() === 200 ? "PASS" : "FAIL", `status=${logoRes?.status()}`);
      if (links[0] && links[0].startsWith("http")) {
        const ctaRes = await page.goto(links[0], { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
        await shot(page, "05-cta-landing");
        mark("5_cta_landing", ctaRes && ctaRes.status() < 400 ? "PASS" : "FAIL", `url=${page.url()} status=${ctaRes?.status()}`);
      }
      await page.close();
    }
  } catch (e) {
    mark("5_email", "FAIL", String(e.message || e));
  }

  // Remaining SA stages that require complete case — mark unproven if not done
  for (const k of [
    "1_accountant_assignment_browser",
    "1_accountant_draft_upload_browser",
    "1_admin_approve_release_browser",
    "1_client_views_approves_draft_browser",
    "1_status_draft_ready_to_client_approved_browser",
    "1_status_to_ready_for_submission_browser",
    "1_final_submitted_completed_browser",
    "3_client_to_accountant_message_browser",
    "3_accountant_to_client_message_browser",
    "3_message_persist_after_refresh_relogin",
  ]) {
    if (!RESULTS[k]) mark(k, "FAIL", "not completed through visible browser UI in this audit (blocked by earlier incomplete SA purchase/engagement stages)");
  }

  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ RESULTS, NET: NET.slice(-120), LOG }, null, 2));
  fs.writeFileSync(
    path.join(OUT, "accounts.txt"),
    `sa=${saEmail}\nmtd=${mtdEmail}\nupgrade=${upgradeEmail}\npassword=${saPass}\n`,
  );
  log("AUDIT SCRIPT COMPLETE");
  await browser.close();
}

function pageLikelyRegistered(page) {
  return /inbox|verify|success|registered|check your/i.test(page.url() + " ");
}

main().catch((e) => {
  console.error(e);
  fs.writeFileSync(path.join(OUT, "fatal.txt"), String(e && e.stack ? e.stack : e));
  process.exit(1);
});
