/**
 * Public URL contract for transactional email.
 *
 * Email clients (Outlook/Gmail/mobile) cannot fetch localhost or RFC1918 hosts.
 * Every logo, CTA and legal link must therefore be an absolute public HTTPS URL.
 *
 * Configuration:
 *   APP_BASE_URL   required public client origin, e.g. https://taxsimba.co.uk
 *   EMAIL_LOGO_URL optional absolute HTTPS PNG override
 *   ADMIN_BASE_URL optional public admin origin for /admin/… CTAs
 */
import { env } from "../config/env";

export class EmailPublicUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailPublicUrlError";
  }
}

/** Hostnames that must never appear in delivered email HTML. */
const BLOCKED_HOST_EXACT = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

export function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (BLOCKED_HOST_EXACT.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local")) return true;

  // IPv4 literals — RFC1918 + loopback + link-local.
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (m) {
    const octets = m.slice(1).map((x) => Number(x));
    if (octets.some((n) => Number.isNaN(n) || n > 255)) return true;
    const [a, b] = octets;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

/** True when the URL is absolute HTTPS with a publicly routable host. */
export function isPublicHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:") return false;
    if (isPrivateOrLocalHostname(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the configured public client origin for email links.
 * Throws EmailPublicUrlError when missing or not a public HTTPS origin.
 */
export function requirePublicAppBaseUrl(): string {
  const raw = (env("APP_BASE_URL") ?? "").trim();
  if (!raw) {
    throw new EmailPublicUrlError(
      "APP_BASE_URL is not configured. Set it to the public HTTPS client origin (e.g. https://taxsimba.co.uk) before sending email.",
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    throw new EmailPublicUrlError(`APP_BASE_URL is not a valid URL: ${raw}`);
  }
  if (parsed.protocol !== "https:") {
    throw new EmailPublicUrlError(
      `APP_BASE_URL must be HTTPS (got ${parsed.protocol}//${parsed.host}). Private/HTTP origins cannot be used in emails.`,
    );
  }
  if (isPrivateOrLocalHostname(parsed.hostname)) {
    // Integration harness uses https://*.taxsimba.local — never allowed outside NODE_ENV=test.
    const testHarness =
      process.env.NODE_ENV === "test" && /\.taxsimba\.local$/i.test(parsed.hostname);
    if (!testHarness) {
      throw new EmailPublicUrlError(
        `APP_BASE_URL host '${parsed.hostname}' is not publicly reachable. Email clients cannot load localhost or private IP addresses.`,
      );
    }
  }
  return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, "");
}

/** Admin origin for /admin/… CTAs — must also be public HTTPS when set. */
export function requirePublicAdminBaseUrl(): string {
  const configured = (env("ADMIN_BASE_URL") ?? "").trim();
  if (!configured) return requirePublicAppBaseUrl();
  let parsed: URL;
  try {
    parsed = new URL(configured.includes("://") ? configured : `https://${configured}`);
  } catch {
    throw new EmailPublicUrlError(`ADMIN_BASE_URL is not a valid URL: ${configured}`);
  }
  if (parsed.protocol !== "https:" || isPrivateOrLocalHostname(parsed.hostname)) {
    const testHarness =
      process.env.NODE_ENV === "test" && /\.taxsimba\.local$/i.test(parsed.hostname);
    if (!testHarness) {
      throw new EmailPublicUrlError(
        `ADMIN_BASE_URL must be a public HTTPS origin (got ${parsed.protocol}//${parsed.host}).`,
      );
    }
  }
  return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, "");
}

/**
 * Absolute HTTPS PNG for the email header.
 * Prefer EMAIL_LOGO_URL; otherwise `{APP_BASE_URL}/images/email-logo.png`
 * (white mark on green header — the site logo.png is brand-green and invisible in Outlook).
 */
export function emailLogoUrl(): string {
  const override = (env("EMAIL_LOGO_URL") ?? "").trim();
  if (override) {
    if (!isPublicHttpsUrl(override)) {
      throw new EmailPublicUrlError(
        "EMAIL_LOGO_URL must be an absolute public HTTPS URL to a PNG (no localhost/private hosts).",
      );
    }
    if (/\.svg(\?|$)/i.test(override)) {
      throw new EmailPublicUrlError("EMAIL_LOGO_URL must be a PNG — SVG is blocked or blank in major email clients.");
    }
    return override.replace(/\/+$/, "");
  }
  return `${requirePublicAppBaseUrl()}/images/email-logo.png`;
}

/**
 * Turn a relative or absolute link into a public HTTPS CTA.
 * Absolute links that point at private/local hosts are rewritten onto APP_BASE_URL
 * (path + query preserved) so a staging Origin leak cannot ship 192.168.* into Outlook.
 */
export function resolveEmailHref(link: string | null | undefined): string | null {
  if (link == null) return null;
  const raw = String(link).trim();
  if (!raw) return null;

  const appBase = requirePublicAppBaseUrl();

  if (raw.startsWith("/admin/") || raw.startsWith("admin/")) {
    const adminBase = requirePublicAdminBaseUrl();
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    return `${adminBase}${path}`;
  }

  if (/^https?:\/\//i.test(raw)) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new EmailPublicUrlError(`Email CTA link is not a valid URL: ${raw}`);
    }
    if (isPrivateOrLocalHostname(parsed.hostname) || parsed.protocol !== "https:") {
      // Rewrite onto the public client origin — never emit the private host.
      return `${appBase}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  }

  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${appBase}${path}`;
}

export function emailLegalUrls(): {
  privacyUrl: string;
  termsUrl: string;
  contactUrl: string;
} {
  const base = requirePublicAppBaseUrl();
  return {
    privacyUrl: `${base}/privacy-policy`,
    termsUrl: `${base}/terms-and-conditions`,
    contactUrl: `${base}/contact-us`,
  };
}

/** Regex used by tests / scanners to catch prohibited hosts in generated HTML. */
export const PROHIBITED_EMAIL_HOST_PATTERN =
  /(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|::1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(?::\d+)?/i;

export function assertNoProhibitedEmailHosts(htmlOrText: string, label = "email"): void {
  if (PROHIBITED_EMAIL_HOST_PATTERN.test(htmlOrText)) {
    throw new EmailPublicUrlError(
      `${label} contains a prohibited private/local host. Check APP_BASE_URL / CTA generation.`,
    );
  }
}
