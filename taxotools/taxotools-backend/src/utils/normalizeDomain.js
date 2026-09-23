/**
 * Normalize hostnames / URLs to a bare registrable-ish domain.
 */
export function normalizeDomain(input) {
  if (!input) return "";
  let s = String(input).trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  s = s.split("/")[0].split("?")[0].split("#")[0];
  s = s.replace(/:\d+$/, "");
  return s;
}

export function toAbsoluteUrl(href, base) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export function isUkAccountancyDomain(domain) {
  const d = normalizeDomain(domain);
  return (
    d.endsWith(".co.uk") ||
    d.endsWith(".org.uk") ||
    d.endsWith(".gov.uk") ||
    d.endsWith(".uk") ||
    d.endsWith(".com") // many UK firms use .com
  );
}

export function preferUkTld(domain) {
  const d = normalizeDomain(domain);
  return (
    d.endsWith(".co.uk") || d.endsWith(".org.uk") || d.endsWith(".gov.uk")
  );
}
