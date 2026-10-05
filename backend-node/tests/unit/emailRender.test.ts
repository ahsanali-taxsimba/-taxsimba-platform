import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("renderEmail branded layout (J-003/J-004/J-006)", () => {
  const prevBase = process.env.APP_BASE_URL;
  const prevLogo = process.env.EMAIL_LOGO_URL;
  const prevAdmin = process.env.ADMIN_BASE_URL;

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
    if (prevAdmin === undefined) delete process.env.ADMIN_BASE_URL;
    else process.env.ADMIN_BASE_URL = prevAdmin;
  });

  it("renders subject, heading, CTA, brand colours, white email logo and legal footer links", async () => {
    const { renderEmail, emailLogoUrl } = await import("../../src/services/email");
    expect(emailLogoUrl()).toBe("https://staging-client.example.com/images/email-logo.png");
    const out = renderEmail({
      recipientName: "Amara",
      subject: "Verify your email address | TaxSimba",
      title: "Verify your TaxSimba account",
      body:
        "Please verify your email address to confirm your TaxSimba account.\n\n" +
        "This email only verifies your account. It does not activate a package, confirm a purchase, or start a subscription.",
      link: "/verify-email?token=abc",
      callToAction: "Verify my email",
      preheader: "Verify your TaxSimba account email address",
    });

    expect(out.subject).toBe("Verify your email address | TaxSimba");
    expect(out.text).toContain("Hello Amara,");
    expect(out.text).toContain("Verify my email: https://staging-client.example.com/verify-email?token=abc");
    expect(out.text).toContain("https://staging-client.example.com/privacy-policy");
    expect(out.text).toContain("https://staging-client.example.com/terms-and-conditions");
    expect(out.text).toContain("https://staging-client.example.com/contact-us");

    expect(out.html).toContain("#37a267");
    expect(out.html).toContain("#b3ed97");
    expect(out.html).toContain('src="https://staging-client.example.com/images/email-logo.png"');
    expect(out.html).toContain('alt="TaxSimba"');
    expect(out.html).not.toContain("logo.svg");
    expect(out.html).not.toMatch(/\/images\/logo\.png/);
    expect(out.html).toContain("Verify my email");
    expect(out.html).toContain("https://staging-client.example.com/privacy-policy");
    expect(out.html).toContain("https://staging-client.example.com/terms-and-conditions");
    expect(out.html).toContain("https://staging-client.example.com/contact-us");
  });

  it("uses EMAIL_LOGO_URL override when it is public HTTPS PNG", async () => {
    process.env.EMAIL_LOGO_URL = "https://cdn.example.com/brand/taxsimba-email.png";
    const { renderEmail, emailLogoUrl } = await import("../../src/services/email");
    expect(emailLogoUrl()).toBe("https://cdn.example.com/brand/taxsimba-email.png");
    const out = renderEmail({
      title: "Purchase confirmed",
      body: "Package: Tax Simba Simple",
      link: "/dashboard",
      callToAction: "Open my Self Assessment dashboard",
    });
    expect(out.html).toContain('src="https://cdn.example.com/brand/taxsimba-email.png"');
    expect(out.html + out.text).not.toMatch(/localhost|127\.0\.0\.1|192\.168\.|logo\.svg/i);
  });

  it("rewrites private absolute CTA hosts onto APP_BASE_URL (Toxsl J-004)", async () => {
    const { renderEmail } = await import("../../src/services/email");
    const out = renderEmail({
      title: "Action needed",
      body: "Please continue.",
      link: "http://192.168.0.197:3000/dashboard",
      callToAction: "Open TaxSimba",
    });
    expect(out.html).toContain('href="https://staging-client.example.com/dashboard"');
    expect(out.text).toContain("https://staging-client.example.com/dashboard");
    expect(out.html + out.text).not.toMatch(/192\.168\.|127\.0\.0\.1|localhost/i);
  });

  it("fails safely when APP_BASE_URL is missing or private", async () => {
    const { renderEmail, EmailPublicUrlError } = await import("../../src/services/email");
    delete process.env.APP_BASE_URL;
    expect(() => renderEmail({ title: "Hi", body: "Body" })).toThrow(EmailPublicUrlError);

    process.env.APP_BASE_URL = "http://127.0.0.1:3000";
    expect(() => renderEmail({ title: "Hi", body: "Body" })).toThrow(/HTTPS|publicly reachable/i);

    process.env.APP_BASE_URL = "https://192.168.0.197";
    expect(() => renderEmail({ title: "Hi", body: "Body" })).toThrow(/publicly reachable/i);

    process.env.APP_BASE_URL = "https://10.0.0.5";
    expect(() => renderEmail({ title: "Hi", body: "Body" })).toThrow(/publicly reachable/i);
  });

  it("escapes user-provided HTML in dynamic fields", async () => {
    const { renderEmail } = await import("../../src/services/email");
    const out = renderEmail({
      recipientName: '<img src=x onerror=alert(1)>',
      title: '<script>alert("x")</script>',
      body: 'Please upload <b>P60</b> & "bank" statements',
      link: "/documents",
      callToAction: "Upload <document>",
    });
    expect(out.html).not.toContain("<script>");
    expect(out.html).not.toContain("<img src=x");
    expect(out.html).toContain("&lt;script&gt;");
    expect(out.html).toContain("&lt;b&gt;P60&lt;/b&gt;");
    expect(out.html).toContain("Upload &lt;document&gt;");
  });
});
