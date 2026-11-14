/**
 * Capture pre-Toxel evidence: mobile/desktop screenshots + short e2e video.
 * Run: node capture_evidence.mjs  (from this folder, with server on :8091)
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../docs/verification/pre_toxel_final/screenshots');
const VIDDIR = path.resolve(__dirname, '../../docs/verification/pre_toxel_final');
const ART = "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(ART, { recursive: true });

const BASE = process.env.SIMBA_BASE || "http://127.0.0.1:8091";
const PREVIEW = `${BASE}/widget/preview.html`;

async function shot(page, name) {
  const p1 = path.join(OUT, name);
  const p2 = path.join(ART, name);
  await page.screenshot({ path: p1, fullPage: false });
  fs.copyFileSync(p1, p2);
  console.log("wrote", name);
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  // --- Mobile: before click (launcher + welcome) ---
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      recordVideo: { dir: path.join(VIDDIR, "video_raw"), size: { width: 390, height: 844 } },
    });
    const page = await context.newPage();
    await page.goto(PREVIEW, { waitUntil: "networkidle" });
    await page.waitForSelector("#simba-launcher");
    await page.waitForSelector("#simba-welcome");
    await shot(page, "01_mobile_before_click_launcher_welcome.png");

    // Welcome only close-up (still showing card)
    await shot(page, "02_mobile_welcome_card.png");

    // Open chat
    await page.click("#simba-launcher");
    await page.waitForSelector("#simba-panel.open", { timeout: 10000 });
    await page.waitForTimeout(800);
    await shot(page, "03_mobile_chat_open.png");

    // Exercise Self Assessment action inside iframe
    const frame = page.frameLocator("#simba-panel");
    await frame.locator('[data-action="sa"]').click();
    await page.waitForTimeout(4000);
    await shot(page, "06_package_recommendation_journey.png");

    await context.close();
    // Move video
    const vids = fs.readdirSync(path.join(VIDDIR, "video_raw")).filter((f) => f.endsWith(".webm"));
    if (vids.length) {
      const src = path.join(VIDDIR, "video_raw", vids[0]);
      const dest = path.join(VIDDIR, "simba_pre_toxel_e2e_demo.webm");
      fs.renameSync(src, dest);
      fs.copyFileSync(dest, path.join(ART, "simba_pre_toxel_e2e_demo.webm"));
      console.log("wrote video", dest);
    }
  }

  // --- Desktop launcher ---
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(PREVIEW, { waitUntil: "networkidle" });
    await page.waitForSelector("#simba-launcher");
    await shot(page, "04_desktop_launcher_welcome.png");
    await page.click("#simba-launcher");
    await page.waitForSelector("#simba-panel.open");
    await page.waitForTimeout(600);
    await shot(page, "05_desktop_chat_open.png");

    // Package compare journey on desktop
    const frame = page.frameLocator("#simba-panel");
    await frame.locator('[data-action="package"]').click();
    await page.waitForTimeout(4500);
    await shot(page, "06b_desktop_choose_package.png");
    await context.close();
  }

  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
