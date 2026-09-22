/**
 * Preserve case / tax-return identifiers as strings (UUID-safe).
 * Rejects Number()-coerced NaN / empty values before any API call.
 */
export function asStringId(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return String(value);
  }
  const s = String(value).trim();
  if (!s || s === "NaN" || s === "undefined" || s === "null") return "";
  return s;
}

export function requireStringId(value: unknown, label = "Identifier"): string {
  const id = asStringId(value);
  if (!id) {
    throw new Error(`${label} is required`);
  }
  return id;
}
