import { httpError } from "../http/errors";

/**
 * H-007 — Super Admin contact-reveal reason must be a meaningful audit note,
 * not a single character / placeholder.
 */
const TRIVIAL = new Set([
  "x",
  "xx",
  "xxx",
  "test",
  "testing",
  "asdf",
  "qwerty",
  "n/a",
  "na",
  "none",
  "reason",
  "ok",
  "yes",
  "no",
  "xxxxxxxxxx",
]);

export function assertRevealReason(raw: string | null | undefined): string {
  const reason = String(raw ?? "").trim();
  if (!reason) throw httpError(400, "A reason is required");
  if (reason.length < 10) {
    throw httpError(400, "Reveal reason must be at least 10 characters");
  }
  const lower = reason.toLowerCase();
  if (TRIVIAL.has(lower)) {
    throw httpError(400, "Reveal reason must describe why contact details are needed");
  }
  // Reject keyboard-mash / single-character spam (e.g. "aaaaaaaaaa", "!!!!!!!!!!!").
  if (/^(.)\1+$/.test(lower) || /^(.{1,3})\1+$/.test(lower)) {
    throw httpError(400, "Reveal reason must describe why contact details are needed");
  }
  return reason;
}
