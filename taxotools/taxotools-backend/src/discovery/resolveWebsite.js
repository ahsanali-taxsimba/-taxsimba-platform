import dns from "node:dns/promises";
import fetch from "node-fetch";
import { env } from "../utils/env.js";
import { normalizeDomain } from "../utils/normalizeDomain.js";
import { logger } from "../utils/logger.js";

const log = logger("resolveWebsite");

export async function dnsExists(domain) {
  const host = normalizeDomain(domain);
  if (!host) return false;
  try {
    await dns.lookup(host);
    return true;
  } catch {
    return false;
  }
}

/** Quick live check — DNS + HTTP(S) HEAD/GET */
export async function isWebsiteLive(domain, { timeoutMs = 8000 } = {}) {
  const host = normalizeDomain(domain);
  if (!host) return false;
  if (!(await dnsExists(host))) return false;

  for (const proto of ["https", "http"]) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${proto}://${host}/`, {
        method: "GET",
        redirect: "follow",
        signal: ctrl.signal,
        headers: { "User-Agent": env.userAgent, Accept: "text/html" },
      });
      clearTimeout(t);
      if (res.status > 0 && res.status < 500) return true;
    } catch {
      clearTimeout(t);
    }
  }
  return false;
}

/**
 * Try common UK domain patterns for a company name; return first live host.
 */
export async function resolveLiveDomainFromName(companyName) {
  const slug = String(companyName || "")
    .toLowerCase()
    .replace(/\b(limited|ltd|llp|plc|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 48);
  if (slug.length < 4) return null;

  const candidates = [
    `${slug}.co.uk`,
    `${slug}.com`,
    `${slug}accountants.co.uk`,
    `${slug}accounting.co.uk`,
  ];

  for (const c of candidates) {
    if (await isWebsiteLive(c, { timeoutMs: 5000 })) {
      log.info("resolved live domain", { companyName, domain: c });
      return c;
    }
  }
  return null;
}
