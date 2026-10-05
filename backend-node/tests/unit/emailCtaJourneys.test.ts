/**
 * Email CTA destinations + public APP_BASE_URL contract (Toxsl J-003/J-004/J-006).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("email CTA + public base URL contract", () => {
  const prevBase = process.env.APP_BASE_URL;
  const prevLogo = process.env.EMAIL_LOGO_URL;

  beforeEach(() => {
    process.env.APP_BASE_URL = "https://staging-client.example.com";
    delete process.env.EMAIL_LOGO_URL;
    delete process.env.ADMIN_BASE_URL;
  });

  afterEach(() => {
    if (prevBase === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = prevBase;
    if (prevLogo === undefined) delete process.env.EMAIL_LOGO_URL;
    else process.env.EMAIL_LOGO_URL = prevLogo;
    delete process.env.ADMIN_BASE_URL;
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
});
