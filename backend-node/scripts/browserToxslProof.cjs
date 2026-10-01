/**
 * Real-browser screenshots for Toxsl evidence repair proof.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = "/opt/cursor/artifacts/browser-proof";
fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const p = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  console.log("SHOT", p);
  return p;
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/local/bin/google-chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  const results = [];

  // 9. Privacy / Terms
  await page.goto("http://127.0.0.1:3000/privacy-policy", { waitUntil: "networkidle", timeout: 60000 });
  await shot(page, "01-privacy-policy");
  results.push(`privacy ${page.url()} title=${await page.title()}`);

  await page.goto("http://127.0.0.1:3000/terms-and-conditions", { waitUntil: "networkidle", timeout: 60000 });
  await shot(page, "02-terms");
  results.push(`terms ${page.url()}`);

  // Client login page
  await page.goto("http://127.0.0.1:3000/login", { waitUntil: "networkidle", timeout: 60000 });
  await shot(page, "03-client-login");
  results.push(`client-login ${page.url()}`);

  // Admin signin
  await page.goto("http://127.0.0.1:3001/admin/auth/signin", { waitUntil: "networkidle", timeout: 60000 });
  await shot(page, "04-admin-signin");
  // Fill login
  const email = page.locator('input[type="email"], input[name="email"]').first();
  const pass = page.locator('input[type="password"], input[name="password"]').first();
  await email.fill("admin@taxsimba.co.uk");
  await pass.fill("Admin@123");
  await shot(page, "05-admin-signin-filled");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle", timeout: 60000 }).catch(() => null),
    page.locator('button[type="submit"], button:has-text("Sign"), button:has-text("Login")').first().click(),
  ]);
  await page.waitForTimeout(3000);
  await shot(page, "06-admin-after-login");
  results.push(`admin-after-login ${page.url()}`);

  // Try tax return list
  for (const pathTry of [
    "http://127.0.0.1:3001/admin/tax-return-list",
    "http://127.0.0.1:3001/admin/manage-tax",
    "http://127.0.0.1:3001/admin/dashboard",
  ]) {
    const res = await page.goto(pathTry, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
    await page.waitForTimeout(2000);
    const name = pathTry.split("/").pop();
    await shot(page, `07-admin-${name}`);
    results.push(`${name} status=${res?.status()} url=${page.url()}`);
  }

  // If we can open a tax return and email modal
  const firstLink = page.locator('a[href*="tax-return-list/"]').first();
  if (await firstLink.count()) {
    await firstLink.click();
    await page.waitForTimeout(3000);
    await shot(page, "08-tax-return-detail");
    const emailBtn = page.locator('button:has-text("Email Client"), button:has-text("Send New Email")').first();
    if (await emailBtn.count()) {
      await emailBtn.click();
      await page.waitForTimeout(2000);
      await shot(page, "09-email-modal");
      const bodyText = await page.locator("body").innerText();
      results.push(
        bodyText.includes("Unable to load email template")
          ? "EMAIL_TEMPLATE_FAIL"
          : "EMAIL_TEMPLATE_OK",
      );
    }
  }

  fs.writeFileSync(path.join(OUT, "results.txt"), results.join("\n") + "\n");
  console.log(results.join("\n"));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
