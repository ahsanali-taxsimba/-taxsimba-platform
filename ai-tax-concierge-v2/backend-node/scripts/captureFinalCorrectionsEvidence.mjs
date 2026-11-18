/**
 * Final corrections evidence: Menu UX, package cards, consultation, lead form.
 * Run with server on :8091 and Playwright browsers installed.
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(
  __dirname,
  "../../docs/verification/simba_v2_master_evidence/screenshots/final_corrections",
);
const ART = "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(ART, { recursive: true });

const BASE = process.env.SIMBA_BASE || "http://127.0.0.1:8091";
const WIDGET = `${BASE}/widget/index.html`;

async function shot(page, name) {
  const p1 = path.join(OUT, name);
  const p2 = path.join(ART, name);
  await page.screenshot({ path: p1, fullPage: false });
  fs.copyFileSync(p1, p2);
  console.log("wrote", name);
}

async function chat(page, message) {
  const input = page.locator("#ts-input");
  await input.fill(message);
  await page.locator("#ts-send").click();
  await page.waitForTimeout(3500);
}

async function openMenu(page) {
  const open = await page.locator(".ts-shell").evaluate((el) =>
    el.classList.contains("nav-open"),
  );
  if (!open) {
    await page.locator("#ts-nav-toggle").click();
    await page.waitForTimeout(400);
  }
  await page.waitForSelector(".ts-shell.nav-open .ts-sidebar");
}

async function closeMenu(page) {
  const open = await page.locator(".ts-shell").evaluate((el) =>
    el.classList.contains("nav-open"),
  );
  if (open) {
    const close = page.locator("#ts-nav-close");
    if (await close.isVisible()) {
      await close.click();
    } else {
      await page.locator("#ts-nav-toggle").click();
    }
    await page.waitForTimeout(300);
  }
}

async function mobileContext(browser, opts = {}) {
  return browser.newContext({
    viewport: { width: opts.width || 390, height: opts.height || 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    ...opts.extra,
  });
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  // —— Mobile header + Menu drawer (360–430) ——
  for (const w of [360, 375, 390, 430]) {
    const context = await mobileContext(browser, { width: w, height: 800 });
    const page = await context.newPage();
    await page.goto(WIDGET, { waitUntil: "networkidle" });
    await page.waitForSelector("#ts-nav-toggle");
    await shot(page, `menu_closed_header_${w}.png`);
    await openMenu(page);
    await shot(page, `menu_drawer_open_${w}.png`);
    await context.close();
  }

  // —— Menu interaction recording + destinations ——
  {
    const context = await mobileContext(browser, {
      width: 390,
      height: 844,
      extra: {
        recordVideo: {
          dir: path.join(OUT, "video_raw"),
          size: { width: 390, height: 844 },
        },
      },
    });
    const page = await context.newPage();
    await page.goto(WIDGET, { waitUntil: "networkidle" });
    await page.waitForSelector("#ts-nav-toggle");
    await shot(page, "01_mobile390_header_menu_button.png");

    await openMenu(page);
    await shot(page, "02_mobile390_drawer_all_items.png");

    const destinations = [
      ["guided", "03_nav_guided.png"],
      ["calculators", "04_nav_calculators.png"],
      ["packages", "05_nav_packages.png"],
      ["consultation", "06_nav_consultation.png"],
      ["faqs", "07_nav_faqs.png"],
      ["chat", "08_nav_chat_restored.png"],
    ];
    for (const [panel, file] of destinations) {
      await closeMenu(page);
      await openMenu(page);
      await page
        .locator(`.ts-shell.nav-open .ts-nav-item[data-panel="${panel}"]`)
        .click({ force: true });
      await page.waitForTimeout(600);
      await shot(page, file);
    }

    // Outside tap close
    await closeMenu(page);
    await openMenu(page);
    await shot(page, "09_drawer_before_outside_close.png");
    await page.locator("#ts-sidebar-backdrop").click({ force: true });
    await page.waitForTimeout(400);
    await shot(page, "10_drawer_closed_chat_intact.png");

    await context.close();
    const raw = path.join(OUT, "video_raw");
    if (fs.existsSync(raw)) {
      const vids = fs.readdirSync(raw).filter((f) => f.endsWith(".webm"));
      if (vids.length) {
        const dest = path.join(OUT, "mobile_menu_interaction.webm");
        fs.renameSync(path.join(raw, vids[0]), dest);
        fs.copyFileSync(dest, path.join(ART, "mobile_menu_interaction.webm"));
        console.log("wrote video", dest);
      }
    }
  }

  // —— Desktop welcome + recommendations ——
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(WIDGET, { waitUntil: "networkidle" });
    await shot(page, "desktop_welcome.png");

    await chat(
      page,
      "I am a sole trader with about £28k turnover. What Self Assessment package do I need?",
    );
    await shot(page, "desktop_sa_simple_recommendation.png");

    await chat(
      page,
      "I have rental income from two properties, CIS deductions, and crypto disposals this year. Which SA package?",
    );
    await shot(page, "desktop_sa_complex_recommendation.png");

    await chat(
      page,
      "I need Making Tax Digital for Income Tax. Turnover about £45k sole trader. Cheapest suitable Simbian plan?",
    );
    await shot(page, "desktop_mtd_comply_recommendation.png");

    await chat(page, "I want to speak to an accountant about my tax return.");
    await shot(page, "desktop_consultation_options.png");

    await chat(
      page,
      "Please note my details for a follow-up: Name Alex Test, email alex.test@example.com, interested in Self Assessment Smart.",
    );
    await shot(page, "desktop_lead_capture.png");

    await context.close();
  }

  // —— Mobile package cards + consultation ——
  {
    const context = await mobileContext(browser, { width: 390, height: 844 });
    const page = await context.newPage();
    await page.goto(WIDGET, { waitUntil: "networkidle" });
    await chat(
      page,
      "Sole trader £22k turnover — recommend Self Assessment package.",
    );
    await shot(page, "mobile390_sa_recommendation_cards.png");
    await chat(page, "I need MTD monthly support, simple sole trader.");
    await shot(page, "mobile390_mtd_recommendation_cards.png");
    await openMenu(page);
    await page.locator('.ts-nav-item[data-panel="consultation"]').click();
    await page.waitForTimeout(500);
    await shot(page, "mobile390_consultation_panel.png");
    await context.close();
  }

  // —— Tablet ——
  {
    const context = await browser.newContext({
      viewport: { width: 768, height: 1024 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(WIDGET, { waitUntil: "networkidle" });
    await shot(page, "tablet768_welcome.png");
    await context.close();
  }

  await browser.close();
  console.log("DONE", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
