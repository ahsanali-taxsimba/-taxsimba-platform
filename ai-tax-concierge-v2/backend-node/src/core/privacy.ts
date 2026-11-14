/** Privacy helpers — redact PII before analytics / logs. */

const UTR = /\b\d{10}\b/g;
const NI = /\b[A-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-Z]\b/gi;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE = /\b(?:\+44\s?|0)(?:7\d{3}|\d{4})\s?\d{3}\s?\d{3,4}\b/g;
const CARD = /\b(?:\d[ -]*?){13,19}\b/g;

function hasMatch(pattern: RegExp, text: string): boolean {
  const re = new RegExp(pattern.source, pattern.flags.replace("g", ""));
  return re.test(text || "");
}

export function redactPii(text: string): string {
  if (!text) return text;
  let out = text;
  out = out.replace(EMAIL, "[REDACTED_EMAIL]");
  out = out.replace(NI, "[REDACTED_NI]");
  out = out.replace(UTR, "[REDACTED_UTR]");
  out = out.replace(PHONE, "[REDACTED_PHONE]");
  out = out.replace(CARD, "[REDACTED_CARD]");
  return out;
}

export function privacyFlags(text: string): Record<string, boolean> {
  const raw = text || "";
  return {
    email: hasMatch(EMAIL, raw),
    ni: hasMatch(NI, raw),
    utr: hasMatch(UTR, raw),
    phone: hasMatch(PHONE, raw),
    card: hasMatch(CARD, raw),
  };
}
