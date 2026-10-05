/**
 * Toxsl J-003 / J-004 / J-006 — email public URL + logo safety.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  EmailPublicUrlError,
  PROHIBITED_EMAIL_HOST_PATTERN,
  assertNoProhibitedEmailHosts,
  emailLegalUrls,
  emailLogoUrl,
  isPrivateOrLocalHostname,
  renderEmail,
  resolveEmailHref,
  requirePublicAppBaseUrl,
  requirePublicLegalBaseUrl,
} from "../../src/services/email";

describe("emailPublicUrls (Toxsl J-003/J-004/J-006)", () => {
  const prev = {
    APP_BASE_URL: process.env.APP_BASE_URL,
    ADMIN_BASE_URL: process.env.ADMIN_BASE_URL,
    EMAIL_LOGO_URL: process.env.EMAIL_LOGO_URL,
    EMAIL_LEGAL_BASE_URL: process.env.EMAIL_LEGAL_BASE_URL,
  };

  beforeEach(() => {
    process.env.APP_BASE_URL = "https://taxsimba.co.uk";
    delete process.env.ADMIN_BASE_URL;
    delete process.env.EMAIL_LOGO_URL;
    delete process.env.EMAIL_LEGAL_BASE_URL;
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("classifies private and loopback hosts", () => {
    expect(isPrivateOrLocalHostname("localhost")).toBe(true);
    expect(isPrivateOrLocalHostname("127.0.0.1")).toBe(true);
    expect(isPrivateOrLocalHostname("0.0.0.0")).toBe(true);
    expect(isPrivateOrLocalHostname("192.168.0.197")).toBe(true);
    expect(isPrivateOrLocalHostname("10.1.2.3")).toBe(true);
    expect(isPrivateOrLocalHostname("172.16.5.1")).toBe(true);
    expect(isPrivateOrLocalHostname("172.31.255.255")).toBe(true);
    expect(isPrivateOrLocalHostname("taxsimba.co.uk")).toBe(false);
    expect(isPrivateOrLocalHostname("staging-client.example.com")).toBe(false);
  });

  it("requires public HTTPS APP_BASE_URL", () => {
    expect(requirePublicAppBaseUrl()).toBe("https://taxsimba.co.uk");
    process.env.APP_BASE_URL = "http://192.168.0.197:3000";
    expect(() => requirePublicAppBaseUrl()).toThrow(EmailPublicUrlError);
    delete process.env.APP_BASE_URL;
    expect(() => requirePublicAppBaseUrl()).toThrow(/not configured/i);
  });

  it("builds email-safe logo + legal URLs", () => {
    expect(emailLogoUrl()).toBe("https://taxsimba.co.uk/images/email-logo.png");
    expect(emailLegalUrls()).toEqual({
      privacyUrl: "https://taxsimba.co.uk/privacy-policy",
      termsUrl: "https://taxsimba.co.uk/terms-and-conditions",
      contactUrl: "https://taxsimba.co.uk/contact-us",
    });
  });

  it("separates legal origin from APP_BASE_URL when EMAIL_LEGAL_BASE_URL is set", () => {
    process.env.APP_BASE_URL = "https://taxsimba-staging-web.onrender.com";
    process.env.EMAIL_LEGAL_BASE_URL = "https://taxsimba.co.uk";
    expect(requirePublicLegalBaseUrl()).toBe("https://taxsimba.co.uk");
    expect(emailLegalUrls()).toEqual({
      privacyUrl: "https://taxsimba.co.uk/privacy-policy",
      termsUrl: "https://taxsimba.co.uk/terms-and-conditions",
      contactUrl: "https://taxsimba.co.uk/contact-us",
    });
    const out = renderEmail({
      title: "Verify",
      body: "Body",
      link: "/verify-email?token=redacted",
      callToAction: "Verify my email",
    });
    expect(out.html).toContain(
      'href="https://taxsimba-staging-web.onrender.com/verify-email?token=redacted"',
    );
    expect(out.html).toContain("https://taxsimba.co.uk/privacy-policy");
    expect(out.html).toContain(
      'src="https://taxsimba-staging-web.onrender.com/images/email-logo.png"',
    );
  });

  it("rejects private EMAIL_LEGAL_BASE_URL", () => {
    process.env.EMAIL_LEGAL_BASE_URL = "http://127.0.0.1:3000";
    expect(() => requirePublicLegalBaseUrl()).toThrow(EmailPublicUrlError);
  });

  it("rewrites private absolute CTAs and keeps public absolute CTAs", () => {
    expect(resolveEmailHref("/dashboard")).toBe("https://taxsimba.co.uk/dashboard");
    expect(resolveEmailHref("http://192.168.0.197:3000/verify-email?token=x")).toBe(
      "https://taxsimba.co.uk/verify-email?token=x",
    );
    expect(resolveEmailHref("https://taxsimba.co.uk/mtd-dashboard")).toBe(
      "https://taxsimba.co.uk/mtd-dashboard",
    );
  });

  it("routes /admin CTAs through ADMIN_BASE_URL when set", () => {
    process.env.ADMIN_BASE_URL = "https://admin.example.com";
    expect(resolveEmailHref("/admin/manage-tax/case-123")).toBe(
      "https://admin.example.com/admin/manage-tax/case-123",
    );
    expect(resolveEmailHref("/admin/invite/tok")).toBe("https://admin.example.com/admin/invite/tok");
  });

  it("generated HTML never contains prohibited hosts", () => {
    const out = renderEmail({
      title: "Documents needed",
      body: "Please upload your P60.",
      link: "http://10.0.0.8/dashboard/tax-tracker",
      callToAction: "Upload document",
    });
    expect(out.html).toMatch(/src="https:\/\/taxsimba\.co\.uk\/images\/email-logo\.png"/);
    expect(out.html).toContain("https://taxsimba.co.uk/privacy-policy");
    expect(out.html).toContain("https://taxsimba.co.uk/terms-and-conditions");
    expect(out.html).toContain("https://taxsimba.co.uk/contact-us");
    expect(out.html).toContain('href="https://taxsimba.co.uk/dashboard/tax-tracker"');
    expect(out.html).not.toMatch(PROHIBITED_EMAIL_HOST_PATTERN);
    expect(out.text).not.toMatch(PROHIBITED_EMAIL_HOST_PATTERN);
    expect(() => assertNoProhibitedEmailHosts(out.html)).not.toThrow();
    expect(() => assertNoProhibitedEmailHosts("See http://192.168.0.197/x")).toThrow(
      EmailPublicUrlError,
    );
  });
});
