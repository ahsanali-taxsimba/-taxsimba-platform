/**
 * Email CTA destinations + public APP_BASE_URL contract (Toxsl J-003/J-004/J-006).
 * Covers verification, password reset, welcome/purchase, document requests,
 * admin notifications and tax-return review — tokens/query preserved, secrets not logged.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("email CTA + public base URL contract", () => {
  const prevBase = process.env.APP_BASE_URL;
  const prevLogo = process.env.EMAIL_LOGO_URL;
  const prevAdmin = process.env.ADMIN_BASE_URL;
  const prevLegal = process.env.EMAIL_LEGAL_BASE_URL;

  beforeEach(() => {
    process.env.APP_BASE_URL = "https://staging-client.example.com";
    delete process.env.EMAIL_LOGO_URL;
    delete process.env.ADMIN_BASE_URL;
    delete process.env.EMAIL_LEGAL_BASE_URL;
  });

  afterEach(() => {
    if (prevBase === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = prevBase;
    if (prevLogo === undefined) delete process.env.EMAIL_LOGO_URL;
    else process.env.EMAIL_LOGO_URL = prevLogo;
    if (prevAdmin === undefined) delete process.env.ADMIN_BASE_URL;
    else process.env.ADMIN_BASE_URL = prevAdmin;
    if (prevLegal === undefined) delete process.env.EMAIL_LEGAL_BASE_URL;
    else process.env.EMAIL_LEGAL_BASE_URL = prevLegal;
  });

  it("verification CTA is absolute public HTTPS with email-safe PNG logo", async () => {
    const { renderEmail, emailLogoUrl, PROHIBITED_EMAIL_HOST_PATTERN } = await import(
      "../../src/services/email"
    );
    expect(emailLogoUrl()).toBe("https://staging-client.example.com/images/email-logo.png");
    expect(emailLogoUrl()).toMatch(/^https:\/\//);
    expect(emailLogoUrl()).not.toMatch(PROHIBITED_EMAIL_HOST_PATTERN);

    const out = renderEmail({
      recipientName: "Amara",
      subject: "Verify your email address | TaxSimba",
      title: "Verify your TaxSimba account",
      body: "Please verify your email address to confirm your TaxSimba account.",
      link: "/verify-email?token=abc123",
      callToAction: "Verify my email",
    });
    expect(out.html).toContain('src="https://staging-client.example.com/images/email-logo.png"');
    expect(out.text).toContain(
      "Verify my email: https://staging-client.example.com/verify-email?token=abc123",
    );
    expect(out.html).toContain('href="https://staging-client.example.com/verify-email?token=abc123"');
    expect(out.html + out.text).not.toMatch(PROHIBITED_EMAIL_HOST_PATTERN);
  });

  it("password reset CTA preserves token query on APP_BASE_URL", async () => {
    const { renderEmail, PROHIBITED_EMAIL_HOST_PATTERN } = await import("../../src/services/email");
    const out = renderEmail({
      recipientName: "Jordan",
      subject: "Reset your TaxSimba password",
      title: "Reset your password",
      body: "We received a request to reset the password for your TaxSimba account.",
      link: "/reset-password?token=reset-tok-xyz",
      callToAction: "Reset my password",
    });
    expect(out.html).toContain(
      'href="https://staging-client.example.com/reset-password?token=reset-tok-xyz"',
    );
    expect(out.text).toContain(
      "Reset my password: https://staging-client.example.com/reset-password?token=reset-tok-xyz",
    );
    expect(out.html + out.text).not.toMatch(PROHIBITED_EMAIL_HOST_PATTERN);
  });

  it("SA and MTD purchase CTAs open the correct dashboards on APP_BASE_URL", async () => {
    const { renderEmail, PROHIBITED_EMAIL_HOST_PATTERN } = await import("../../src/services/email");
    const { buildPurchaseConfirmationContent } = await import(
      "../../src/services/purchaseConfirmationEmail"
    );

    const sa = buildPurchaseConfirmationContent({
      firstName: "Sara",
      serviceType: "SELF_ASSESSMENT",
      packageName: "Tax Simba Simple",
      amount: 119,
      billingType: "ONE_OFF",
      billingFrequency: "Per tax year",
      sessionId: "cs_sa",
    });
    expect(sa.dashboardPath).toBe("/dashboard");
    expect(sa.dashboardUrl).toBe("https://staging-client.example.com/dashboard");
    const saMail = renderEmail({
      recipientName: sa.firstName,
      subject: sa.subject,
      title: sa.title,
      body: sa.body,
      link: sa.dashboardPath,
      callToAction: sa.callToAction,
    });
    expect(saMail.text).toContain("https://staging-client.example.com/dashboard");
    expect(saMail.html).toContain('href="https://staging-client.example.com/dashboard"');
    expect(saMail.html).toContain("https://staging-client.example.com/images/email-logo.png");

    const mtd = buildPurchaseConfirmationContent({
      firstName: "Amara",
      serviceType: "MTD_INCOME_TAX",
      packageName: "Simbian Growth",
      amount: 59.99,
      billingType: "RECURRING",
      billingFrequency: "Monthly",
      sessionId: "cs_mtd",
    });
    expect(mtd.dashboardPath).toBe("/mtd-dashboard");
    expect(mtd.dashboardUrl).toBe("https://staging-client.example.com/mtd-dashboard");
    const mtdMail = renderEmail({
      recipientName: mtd.firstName,
      subject: mtd.subject,
      title: mtd.title,
      body: mtd.body,
      link: mtd.dashboardPath,
      callToAction: mtd.callToAction,
    });
    expect(mtdMail.text).toContain("https://staging-client.example.com/mtd-dashboard");
    expect(mtdMail.html).toContain('href="https://staging-client.example.com/mtd-dashboard"');
    expect(mtdMail.html + mtdMail.text).not.toMatch(PROHIBITED_EMAIL_HOST_PATTERN);
  });

  it("document-request CTA opens Tax Tracker on APP_BASE_URL", async () => {
    const { renderEmail } = await import("../../src/services/email");
    const out = renderEmail({
      recipientName: "Alex",
      subject: "Documents needed for your tax return",
      title: "We need a document from you",
      body: "Please upload your P60 through Tax Tracker.",
      link: "/dashboard/tax-tracker",
      callToAction: "Upload document",
    });
    expect(out.html).toContain('href="https://staging-client.example.com/dashboard/tax-tracker"');
    expect(out.html).toContain("https://staging-client.example.com/privacy-policy");
    expect(out.html).toContain("https://staging-client.example.com/terms-and-conditions");
    expect(out.html).toContain("https://staging-client.example.com/contact-us");
  });

  it("admin draft-review CTA uses ADMIN_BASE_URL and preserves case id", async () => {
    process.env.ADMIN_BASE_URL = "https://admin.staging.example.com";
    const { renderEmail } = await import("../../src/services/email");
    const caseId = "case-review-abc";
    const out = renderEmail({
      recipientName: "Admin",
      subject: "Draft ready for Admin review",
      title: "Draft ready for Admin review",
      body: "A draft was submitted for review.",
      link: `/admin/manage-tax/${caseId}`,
      callToAction: "Review tax return",
    });
    expect(out.html).toContain(
      `href="https://admin.staging.example.com/admin/manage-tax/${caseId}"`,
    );
    expect(out.text).toContain(
      `Review tax return: https://admin.staging.example.com/admin/manage-tax/${caseId}`,
    );
  });

  it("tax-return review CTA for client uses dashboard documents path", async () => {
    const { renderEmail } = await import("../../src/services/email");
    const out = renderEmail({
      recipientName: "Casey",
      subject: "Your tax return draft is ready to review",
      title: "Your tax calculation is ready",
      body: "Please review your tax return.",
      link: "/dashboard/my-documents",
      callToAction: "Review my tax return",
    });
    expect(out.html).toContain('href="https://staging-client.example.com/dashboard/my-documents"');
  });
});
