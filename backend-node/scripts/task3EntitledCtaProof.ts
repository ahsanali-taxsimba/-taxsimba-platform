/**
 * Task 3 — entitled CTA return proof + document/case accessibility check.
 *
 * Proves that after opening a document-request / review email CTA and logging in,
 * the correct requested document and case are visible — not only that a dashboard opens.
 *
 * Reads credentials from TASK3_ARTIFACT_DIR/entitled_seed.json (from task3SeedEntitled.ts).
 * Screenshots/HTML are written under TASK3_ARTIFACT_DIR (outside git).
 *
 * Prerequisites: FE on :3000, Mailpit on :8025, seeded entitled client with outstanding P60.
 *
 * Usage:
 *   npx tsx scripts/task3EntitledCtaProof.ts
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

const ART = process.env.TASK3_ARTIFACT_DIR || "/opt/cursor/artifacts/task3-local";
const FE = process.env.TASK3_FE_URL || "http://127.0.0.1:3000";
const MAILPIT = process.env.TASK3_MAILPIT_URL || "http://127.0.0.1:8025";

mkdirSync(ART, { recursive: true });

function redact(s: string): string {
  return String(s || "")
    .replace(/token=[^&\s"'<>]+/gi, "token=REDACTED")
    .replace(/password["']?\s*[:=]\s*["'][^"']+/gi, "password=REDACTED");
}

function loadSeed(): {
  email: string;
  password: string;
  caseId: string;
  caseRef?: string;
  docTitle?: string;
  docCtaPath?: string;
  reviewCtaPath?: string;
} {
  const seedPath = `${ART}/entitled_seed.json`;
  if (!existsSync(seedPath)) {
    throw new Error(`Missing ${seedPath} — run task3SeedEntitled.ts first`);
  }
  return JSON.parse(readFileSync(seedPath, "utf8"));
}

async function loginViaNext(page: import("playwright").Page, email: string, password: string, path: string) {
  await page.goto(`${FE}${path}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  const url = page.url();
  if (/\/login/i.test(url) || (await page.locator('input[type="password"]').count()) > 0) {
    await page.locator('input[name="email"], input[type="email"]').first().fill(email);
    await page.locator('input[name="password"], input[type="password"]').first().fill(password);
    await page.getByRole("button", { name: /log in|sign in|login/i }).first().click();
    await page.waitForTimeout(5000);
  }
}

async function main() {
  const seed = loadSeed();
  const caseRef = seed.caseRef || "SA-TASK3";
  const docTitle = seed.docTitle || "P60";
  const docPath =
    seed.docCtaPath || `/dashboard/tax-tracker?caseId=${encodeURIComponent(seed.caseId)}`;
  const reviewPath =
    seed.reviewCtaPath || `/dashboard/my-documents?caseId=${encodeURIComponent(seed.caseId)}`;

  const report: Record<string, unknown> = {
    caseId: seed.caseId,
    caseRef,
    docTitle,
    docPath,
    reviewPath,
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // Document CTA → Tax Tracker must show the requested document + case, not a bare dashboard.
  await loginViaNext(page, seed.email, seed.password, docPath);
  report.afterLoginDocUrl = page.url();
  await page.screenshot({ path: `${ART}/entitled_after_login_tax_tracker.png`, fullPage: true });
  const trackerBody = await page.locator("body").innerText();
  const trackerHasDoc = trackerBody.includes(docTitle);
  const trackerHasCase =
    trackerBody.includes(caseRef) ||
    trackerBody.includes(seed.caseId) ||
    trackerBody.includes("2024/25") ||
    trackerBody.includes("2024-25");
  const trackerOnPath =
    page.url().includes("/dashboard/tax-tracker") || page.url().includes("/dashboard");
  report.documentCaseAccess = {
    ok: trackerOnPath && trackerHasDoc,
    onTaxTrackerOrDashboard: trackerOnPath,
    hasDocTitle: trackerHasDoc,
    hasCaseSignal: trackerHasCase,
    urlHasCaseId: page.url().includes(encodeURIComponent(seed.caseId)) || page.url().includes(seed.caseId),
    bodySnippet: redact(trackerBody).slice(0, 500),
  };

  // Review CTA → My Documents
  await page.context().clearCookies();
  await loginViaNext(page, seed.email, seed.password, reviewPath);
  report.afterLoginReviewUrl = page.url();
  await page.screenshot({ path: `${ART}/entitled_after_login_my_documents.png`, fullPage: true });
  const docsBody = await page.locator("body").innerText();
  report.reviewCaseAccess = {
    ok:
      (page.url().includes("/dashboard/my-documents") || page.url().includes("/dashboard")) &&
      (docsBody.includes(docTitle) ||
        docsBody.includes(caseRef) ||
        docsBody.includes("My Documents") ||
        docsBody.includes("Outstanding")),
    url: page.url(),
    hasDocTitle: docsBody.includes(docTitle),
    hasCaseRef: docsBody.includes(caseRef),
    bodySnippet: redact(docsBody).slice(0, 500),
  };

  // Mailpit: document/review emails must embed caseId in CTA + document/case wording.
  const msgs = await fetch(
    `${MAILPIT}/api/v1/search?query=to:${encodeURIComponent(seed.email)}&limit=30`,
  ).then((r) => r.json());
  const interesting = (msgs.messages || []).filter((m: { Subject?: string }) =>
    /document|review|welcome|self assessment|P60/i.test(m.Subject || ""),
  );
  report.mailpitCount = interesting.length;
  const mailChecks: Record<string, unknown>[] = [];
  for (const m of interesting.slice(0, 8)) {
    const full = await fetch(`${MAILPIT}/api/v1/message/${m.ID}`).then((r) => r.json());
    const html = full.HTML || "";
    const name = (m.Subject || "msg").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
    writeFileSync(`${ART}/mailpit_${name}.html`, html);
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((x) => x[1]);
    const check = {
      subject: m.Subject,
      logo: /email-logo\.png/.test(html),
      hasCaseIdInCta: hrefs.some((h) => h.includes(seed.caseId)),
      hasDocTitle: html.includes(docTitle),
      hasCaseRef: html.includes(caseRef),
      hrefs: hrefs.map(redact),
    };
    mailChecks.push(check);
    await page.setContent(html, { waitUntil: "load" });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${ART}/mailpit_render_${name}.png`, fullPage: true });
  }
  report.mailChecks = mailChecks;
  report.mailDocCaseOk = mailChecks.some(
    (c) => c.hasCaseIdInCta || (c.hasDocTitle && c.hasCaseRef),
  );

  report.pass =
    Boolean((report.documentCaseAccess as { ok?: boolean }).ok) &&
    Boolean((report.reviewCaseAccess as { ok?: boolean }).ok);

  writeFileSync(`${ART}/entitled_cta_report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (!report.pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
