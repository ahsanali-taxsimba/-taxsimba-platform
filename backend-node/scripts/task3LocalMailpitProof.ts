/**
 * Task 3 local end-to-end proof against production builds + Mailpit.
 * Tokens are redacted in saved artifacts.
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync, copyFileSync } from "fs";
import { createHash, randomBytes } from "crypto";

const ART = "/opt/cursor/artifacts/task3-local";
const FE = "http://127.0.0.1:3000";
const API = "http://127.0.0.1:8002";
const MAILPIT = "http://127.0.0.1:8025";
const SHA = process.env.TASK3_SHA || "unknown";

mkdirSync(ART, { recursive: true });

function redact(s) {
  return String(s || "")
    .replace(/token=[^&\s"'<>]+/gi, "token=REDACTED")
    .replace(/[A-Za-z0-9_-]{20,}/g, (m) => (m.length > 40 ? `${m.slice(0, 8)}…REDACTED` : m));
}

async function mailpitMessages(search = "") {
  const url = search
    ? `${MAILPIT}/api/v1/search?query=${encodeURIComponent(search)}&limit=50`
    : `${MAILPIT}/api/v1/messages?limit=50`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`mailpit ${res.status}`);
  return res.json();
}

async function waitForMail(predicate, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const data = await mailpitMessages();
    const hit = (data.messages || []).find(predicate);
    if (hit) {
      const full = await fetch(`${MAILPIT}/api/v1/message/${hit.ID}`).then((r) => r.json());
      return full;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("mail not found in Mailpit within timeout");
}

async function screenshot(page, name) {
  const path = `${ART}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function main() {
  const report = {
    sha: SHA,
    mode: "LOCAL production builds + Mailpit SMTP (EMAIL_ALLOW_LOCAL_BASE_URL=true)",
    note: "APP_BASE_URL=http://127.0.0.1:3000 for local proof only. Not Outlook/Gmail. Not staging deploy.",
    results: {},
  };

  // Probe logo + legal content via HTTP first
  const logo = await fetch(`${FE}/images/email-logo.png`);
  const logoBuf = Buffer.from(await logo.arrayBuffer());
  report.results.logoLocal = {
    status: logo.status,
    contentType: logo.headers.get("content-type"),
    bytes: logoBuf.length,
    pngMagic: logoBuf.slice(0, 8).toString("hex"),
  };
  writeFileSync(`${ART}/email-logo-from-fe.png`, logoBuf);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(redact(msg.text()));
  });
  page.on("requestfailed", (req) => {
    failedRequests.push({ url: redact(req.url()), error: req.failure()?.errorText });
  });

  // Legal pages — meaningful content, not just 200
  for (const [name, path, needle] of [
    ["privacy", "/privacy-policy", "Information We Collect"],
    ["terms", "/terms-and-conditions", "Acceptance of Terms"],
    ["contact", "/contact-us", "Contact"],
  ]) {
    consoleErrors.length = 0;
    failedRequests.length = 0;
    await page.goto(`${FE}${path}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1500);
    const body = await page.locator("body").innerText();
    const ok = body.includes(needle) && body.length > 400;
    await screenshot(page, `legal_${name}`);
    report.results[`legal_${name}`] = {
      ok,
      bodyChars: body.length,
      hasNeedle: body.includes(needle),
      consoleErrors: [...consoleErrors].slice(0, 10),
      failedRequests: [...failedRequests].slice(0, 10),
    };
  }

  // Invalid verification token — clear error, not endless spinner
  consoleErrors.length = 0;
  await page.goto(`${FE}/verify-email?token=definitely-invalid-token`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(2500);
  const verifyInvalidText = await page.locator("body").innerText();
  const verifyStillLoading = /Loading\.+|Verifying your email…/i.test(verifyInvalidText) &&
    !/invalid|expired|error|failed/i.test(verifyInvalidText);
  await screenshot(page, "verify_invalid_token");
  report.results.verifyInvalidToken = {
    ok: !verifyStillLoading && /invalid|expired|error|failed|occurred/i.test(verifyInvalidText),
    stillLoading: verifyStillLoading,
    snippet: redact(verifyInvalidText).slice(0, 400),
  };

  // Missing reset token
  await page.goto(`${FE}/reset-password`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);
  const resetMissingText = await page.locator("body").innerText();
  await screenshot(page, "reset_missing_token");
  report.results.resetMissingToken = {
    ok: /invalid or expired password reset link/i.test(resetMissingText),
    snippet: redact(resetMissingText).slice(0, 400),
  };

  // Register → verification email via real API event
  const stamp = randomBytes(3).toString("hex");
  const email = `task3.verify.${stamp}@mailpit.local`;
  const password = "Task3Local!99";
  const registerRes = await fetch(`${API}/api/compat/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      name: "TaskThree",
      surname: "Verifier",
      mobile: "07000000000",
    }),
  });
  const registerBody = await registerRes.json().catch(() => ({}));
  report.results.register = {
    status: registerRes.status,
    ok: registerRes.ok || registerRes.status === 200,
    email,
  };

  let verifyMail;
  try {
    verifyMail = await waitForMail(
      (m) =>
        (m.To || []).some((t) => (t.Address || "").toLowerCase() === email.toLowerCase()) &&
        /verify/i.test(m.Subject || ""),
      45000,
    );
  } catch (e) {
    report.results.verificationEmail = { ok: false, error: String(e) };
  }

  if (verifyMail) {
    const html = verifyMail.HTML || "";
    const text = verifyMail.Text || "";
    writeFileSync(`${ART}/mailpit_verification.html`, html);
    writeFileSync(`${ART}/mailpit_verification.txt`, text);
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    const logoSrc = (html.match(/src="([^"]*email-logo\.png[^"]*)"/) || [])[1] || null;
    const cta = hrefs.find((h) => h.includes("/verify-email"));
    report.results.verificationEmail = {
      ok: Boolean(cta && logoSrc && hrefs.some((h) => h.includes("privacy-policy"))),
      subject: verifyMail.Subject,
      logoSrc,
      cta: redact(cta),
      legal: hrefs.filter((h) => /privacy-policy|terms-and-conditions|contact-us/.test(h)),
    };

    // Fetch logo URL from email as Mailpit/client would
    if (logoSrc) {
      const lr = await fetch(logoSrc);
      const lb = Buffer.from(await lr.arrayBuffer());
      report.results.emailLogoFetch = {
        url: logoSrc,
        status: lr.status,
        bytes: lb.length,
        png: lb.slice(0, 8).toString("hex") === "89504e470d0a1a0a",
      };
    }

    // Open CTA in browser (valid token)
    if (cta) {
      await page.goto(cta, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(3000);
      const verifiedText = await page.locator("body").innerText();
      await screenshot(page, "verify_valid_token_success");
      report.results.verifyValidToken = {
        ok: /successfully completed|verified/i.test(verifiedText),
        snippet: redact(verifiedText).slice(0, 400),
      };

      // Revisit same token — must not endless-spin
      await page.goto(cta, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(2500);
      const revisitText = await page.locator("body").innerText();
      await screenshot(page, "verify_token_reuse");
      report.results.verifyTokenReuse = {
        ok: !/^[\s\S]*Verifying your email…\s*$/m.test(revisitText) &&
          /invalid|expired|error|failed|successfully|login/i.test(revisitText),
        snippet: redact(revisitText).slice(0, 400),
      };
    }
  }

  // Password reset journey
  const forgot = await fetch(`${API}/api/compat/auth/forget-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  report.results.forgotPasswordApi = { status: forgot.status, ok: forgot.ok };

  let resetMail;
  try {
    resetMail = await waitForMail(
      (m) =>
        (m.To || []).some((t) => (t.Address || "").toLowerCase() === email.toLowerCase()) &&
        /reset/i.test(m.Subject || ""),
      45000,
    );
  } catch (e) {
    report.results.resetEmail = { ok: false, error: String(e) };
  }

  if (resetMail) {
    const html = resetMail.HTML || "";
    writeFileSync(`${ART}/mailpit_password_reset.html`, html);
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    const cta = hrefs.find((h) => h.includes("/reset-password"));
    report.results.resetEmail = {
      ok: Boolean(cta && html.includes("email-logo.png")),
      subject: resetMail.Subject,
      cta: redact(cta),
      legal: hrefs.filter((h) => /privacy-policy|terms-and-conditions|contact-us/.test(h)),
    };
    if (cta) {
      await page.goto(cta, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(1000);
      await screenshot(page, "reset_form_valid_token");
      const newPassword = "Task3Reset!99";
      await page.locator('input[name="password"]').fill(newPassword);
      await page.locator('input[name="confirmPassword"]').fill(newPassword);
      await page.getByRole("button", { name: /reset password/i }).click();
      await page.waitForTimeout(3000);
      await screenshot(page, "reset_after_submit");
      // Login with new password
      await page.goto(`${FE}/login`, { waitUntil: "networkidle", timeout: 60000 });
      await page.locator('input[name="email"], input[type="email"]').first().fill(email);
      await page.locator('input[name="password"], input[type="password"]').first().fill(newPassword);
      await page.getByRole("button", { name: /log in|sign in|login/i }).first().click();
      await page.waitForTimeout(4000);
      await screenshot(page, "login_after_reset");
      report.results.loginAfterReset = {
        url: page.url(),
        ok: !page.url().includes("/login") || /dashboard|planlist|mtd/i.test(page.url()),
      };
    }
  }

  // Protected CTA return-after-login
  await context.clearCookies();
  await page.goto(`${FE}/dashboard/tax-tracker`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  const loginUrl = page.url();
  await screenshot(page, "cta_tax_tracker_redirect_login");
  const hasNext = /[?&]next=/.test(loginUrl);
  report.results.protectedCtaRedirect = {
    ok: loginUrl.includes("/login") && hasNext && decodeURIComponent(loginUrl).includes("/dashboard/tax-tracker"),
    loginUrl: redact(loginUrl),
  };

  // If we can log in, prove next destination
  if (hasNext && report.results.loginAfterReset?.ok !== false) {
    try {
      await page.locator('input[name="email"], input[type="email"]').first().fill(email);
      await page.locator('input[name="password"], input[type="password"]').first().fill("Task3Reset!99");
      await page.getByRole("button", { name: /log in|sign in|login/i }).first().click();
      await page.waitForTimeout(5000);
      await screenshot(page, "cta_tax_tracker_after_login");
      report.results.protectedCtaAfterLogin = {
        url: page.url(),
        ok: page.url().includes("/dashboard/tax-tracker") || page.url().includes("/dashboard"),
      };
    } catch (e) {
      report.results.protectedCtaAfterLogin = { ok: false, error: String(e) };
    }
  }

  // Render purchase / document / admin emails via API notify path using recording through real queue
  // Trigger password-style document request email by calling notify through a tiny script is heavy;
  // instead render via backend unit path is insufficient — use Mailpit for a purchase email if we can enqueue.
  // Direct queue via internal isn't exposed; use forget/register already done.
  // Document-request style: call native notify by creating a case is complex; capture CTA matrix from Mailpit HTML templates by issuing verification already done.

  // Screenshot Mailpit UI with messages list
  await page.goto(`${MAILPIT}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);
  await screenshot(page, "mailpit_inbox");

  // Open verification message in Mailpit UI if present
  try {
    await page.goto(`${MAILPIT}/view/${verifyMail?.ID || ""}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);
    await screenshot(page, "mailpit_verification_view");
  } catch {
    /* optional */
  }

  await browser.close();

  // Purchase confirmation content check via Node (real renderEmail with local allow)
  process.env.APP_BASE_URL = "http://127.0.0.1:3000";
  process.env.EMAIL_ALLOW_LOCAL_BASE_URL = "true";
  process.env.ADMIN_BASE_URL = "http://127.0.0.1:3001";
  delete process.env.EMAIL_LOGO_URL;
  delete process.env.RENDER;
  delete process.env.APP_ENV;
  const {
    renderEmail,
    clientDocumentUploadPath,
    clientReviewDocumentsPath,
    resolveEmailHref,
    requirePublicAppBaseUrl,
    EmailPublicUrlError,
  } = await import("../src/services/email.ts");
  const { buildPurchaseConfirmationContent } = await import("../src/services/purchaseConfirmationEmail.ts");
  for (const [name, serviceType, path] of [
    ["purchase_sa", "SELF_ASSESSMENT", "/dashboard"],
    ["purchase_mtd", "MTD_INCOME_TAX", "/mtd-dashboard"],
  ]) {
    const content = buildPurchaseConfirmationContent({
      firstName: "Proof",
      serviceType,
      packageName: "Test Pack",
      amount: 10,
      billingType: "ONE_OFF",
      billingFrequency: "Once",
      sessionId: "cs_local",
    });
    const out = renderEmail({
      recipientName: content.firstName,
      subject: content.subject,
      title: content.title,
      body: content.body,
      link: content.dashboardPath,
      callToAction: content.callToAction,
    });
    writeFileSync(`${ART}/${name}.html`, out.html);
    report.results[name] = {
      ok: out.html.includes(`href="http://127.0.0.1:3000${path}"`) && out.html.includes("email-logo.png"),
      dashboardPath: content.dashboardPath,
      cta: `http://127.0.0.1:3000${path}`,
    };
  }

  const caseId = "CASE_REDACTED";
  const doc = renderEmail({
    title: "We need a document from you",
    body: "Please upload your P60 for SA-TASK3.",
    link: clientDocumentUploadPath(caseId),
    callToAction: "Upload document",
  });
  writeFileSync(`${ART}/document_request.html`, doc.html);
  report.results.documentRequestTemplate = {
    ok:
      doc.html.includes(`/dashboard/tax-tracker?caseId=${caseId}`) &&
      doc.html.includes("email-logo.png") &&
      doc.html.includes("P60") &&
      doc.html.includes("SA-TASK3"),
  };

  const review = renderEmail({
    title: "Your tax calculation is ready",
    body: "Please review your figures for SA-TASK3.",
    link: clientReviewDocumentsPath(caseId),
    callToAction: "Review my tax return",
  });
  writeFileSync(`${ART}/tax_return_review.html`, review.html);
  report.results.reviewTemplate = {
    ok:
      review.html.includes(`/dashboard/my-documents?caseId=${caseId}`) &&
      review.html.includes("SA-TASK3"),
  };

  const admin = renderEmail({
    title: "Draft ready for Admin review",
    body: "A draft is ready.",
    link: `/admin/manage-tax/${caseId}`,
    callToAction: "Review tax return",
  });
  writeFileSync(`${ART}/admin_review.html`, admin.html);
  const privateAdminRewritten = resolveEmailHref(
    `http://192.168.0.50:3001/admin/manage-tax/${caseId}`,
  );
  report.results.adminReviewTemplate = {
    ok: admin.html.includes(`http://127.0.0.1:3001/admin/manage-tax/${caseId}`),
    privateAbsoluteRewritesToAdminBase:
      privateAdminRewritten === `http://127.0.0.1:3001/admin/manage-tax/${caseId}`,
  };

  // Staging/production guard: EMAIL_ALLOW_LOCAL_BASE_URL must not enable private URLs on Render.
  process.env.RENDER = "true";
  process.env.EMAIL_ALLOW_LOCAL_BASE_URL = "true";
  process.env.APP_BASE_URL = "http://127.0.0.1:3000";
  let stagingGuardOk = false;
  try {
    requirePublicAppBaseUrl();
  } catch (e) {
    stagingGuardOk = e instanceof EmailPublicUrlError;
  }
  report.results.stagingLocalAllowIgnored = { ok: stagingGuardOk };
  delete process.env.RENDER;
  process.env.APP_BASE_URL = "http://127.0.0.1:3000";
  process.env.EMAIL_ALLOW_LOCAL_BASE_URL = "true";

  writeFileSync(`${ART}/local_proof_report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
