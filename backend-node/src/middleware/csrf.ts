import { timingSafeEqual } from "crypto";

import { Request } from "express";

import { allowedOrigins } from "../config/env";
import { httpError } from "../http/errors";

export const CSRF_COOKIE = "csrf_token";

function normOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

/**
 * Origins that represent this application itself. The ingress may rewrite the inbound Origin
 * to an internal hostname while preserving the public one in X-Forwarded-Host, so a genuine
 * same-origin request can legitimately arrive with either.
 */
function selfOrigins(req: Request): Set<string> {
  const scheme = req.header("x-forwarded-proto") ?? req.protocol;
  const hosts = [req.header("host"), req.header("x-forwarded-host")].filter(
    (h): h is string => !!h,
  );
  return new Set(hosts.map((h) => normOrigin(`${scheme}://${h}`)));
}

function equals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * CSRF defence for cookie-authenticated state-changing endpoints: Sec-Fetch-Site, Referer
 * allowlist, and the double-submit X-CSRF-Token header. A request carrying none of these
 * browser markers cannot originate from a browser document.
 */
export function enforceCsrf(req: Request): void {
  const permitted = new Set<string>([
    ...allowedOrigins().map(normOrigin),
    ...selfOrigins(req),
  ]);

  const fetchSite = req.header("sec-fetch-site");
  if (fetchSite && !["same-origin", "none"].includes(fetchSite.toLowerCase())) {
    throw httpError(403, "Cross-origin request rejected");
  }

  const referer = req.header("referer");
  if (referer) {
    let parsed: URL;
    try {
      parsed = new URL(referer);
    } catch {
      throw httpError(403, "Cross-origin request rejected");
    }
    if (!permitted.has(normOrigin(`${parsed.protocol}//${parsed.host}`))) {
      throw httpError(403, "Cross-origin request rejected");
    }
  }

  const isBrowser = !!(
    fetchSite ||
    referer ||
    req.header("origin") ||
    req.header("sec-fetch-mode")
  );
  if (isBrowser) {
    const sent = req.header("x-csrf-token");
    const expected = req.cookies?.[CSRF_COOKIE];
    if (!sent || !expected || !equals(sent, expected)) {
      throw httpError(403, "Invalid or missing CSRF token");
    }
  }
}
