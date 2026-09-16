import { describe, expect, it, beforeEach, afterEach } from "vitest";

describe("renderEmail branded layout", () => {
  const prev = process.env.APP_BASE_URL;

  beforeEach(() => {
    process.env.APP_BASE_URL = "https://app.test.taxsimba.local";
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = prev;
  });

  it("renders subject, heading, CTA, brand colours, logo and legal footer links", async () => {
    const { renderEmail } = await import("../../src/services/email");
    const out = renderEmail({
      recipientName: "Alex Client",
      subject: "Verify your email address | TaxSimba",
      title: "Confirm your email address",
      body:
        "Welcome to TaxSimba.\n\nPlease verify your email address to securely activate your account.",
      link: "/verify-email?token=abc",
      callToAction: "Verify my email",
      preheader: "Confirm your email",
    });

    expect(out.subject).toBe("Verify your email address | TaxSimba");
    expect(out.text).toContain("Hello Alex Client,");
    expect(out.text).toContain("Welcome to TaxSimba.");
    expect(out.text).toContain("Verify my email: https://app.test.taxsimba.local/verify-email?token=abc");
    expect(out.text).toContain("Simple tax. Expert support.");
    expect(out.text).toContain("https://app.test.taxsimba.local/privacy-policy");
    expect(out.text).toContain("https://app.test.taxsimba.local/terms-and-conditions");
    expect(out.text).toContain("https://app.test.taxsimba.local/contact-us");
    expect(out.text).toMatch(/© \d{4} TaxSimba Group Limited/);

    expect(out.html).toContain("Confirm your email address");
    expect(out.html).toContain("#37a267");
    expect(out.html).toContain("#b3ed97");
    expect(out.html).toContain("https://app.test.taxsimba.local/images/logo.svg");
    expect(out.html).toContain("border-radius:50px");
    expect(out.html).toContain("Verify my email");
    expect(out.html).toContain("/privacy-policy");
    expect(out.html).toContain("/terms-and-conditions");
    expect(out.html).toContain("/contact-us");
    expect(out.html).toContain("Simple tax. Expert support.");
  });

  it("escapes user-provided HTML in dynamic fields", async () => {
    const { renderEmail } = await import("../../src/services/email");
    const out = renderEmail({
      recipientName: '<img src=x onerror=alert(1)>',
      title: '<script>alert("x")</script>',
      body: 'Please upload <b>P60</b> & "bank" statements',
      link: '/documents',
      callToAction: 'Upload <document>',
    });
    expect(out.html).not.toContain("<script>");
    expect(out.html).not.toContain("<img src=x");
    expect(out.html).toContain("&lt;script&gt;");
    expect(out.html).toContain("&lt;b&gt;P60&lt;/b&gt;");
    expect(out.html).toContain("&amp;");
    expect(out.html).toContain("Upload &lt;document&gt;");
  });
});
