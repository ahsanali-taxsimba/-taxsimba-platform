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

const JUNK_HOST =
  /^(www\.)?(facebook|instagram|twitter|x|linkedin|tiktok|youtube|google|bing|yahoo|microsoft|apple|amazon|tripadvisor|booking|indeed|yelp|wikipedia|gov\.uk|companieshouse)\./i;

export function isUkAccountancyDomain(domain) {
  const d = normalizeDomain(domain);
  if (!d || JUNK_HOST.test(d) || d.includes("tiktok.com") || d.includes("facebook.com")) {
    return false;
  }
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
