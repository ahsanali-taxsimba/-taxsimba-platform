/**
 * Safe toast message helpers for auth/API error paths.
 * Never returns undefined/null/empty/[object Object]/stack traces.
 */

const FALLBACK_ERROR = "Something went wrong. Please try again.";
const FALLBACK_SUCCESS = "Success";

function isUsableMessage(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed === "undefined" || trimmed === "null") return false;
  if (trimmed === "[object Object]") return false;
  if (/^\s*Error:\s*$/i.test(trimmed)) return false;
  return true;
}

function firstUsable(...candidates) {
  for (const candidate of candidates) {
    if (isUsableMessage(candidate)) return candidate.trim();
  }
  return null;
}

/**
 * Extract a human-readable error message from an axios/fetch-style error.
 */
export function getSafeErrorMessage(error, fallback = FALLBACK_ERROR) {
  const data = error?.response?.data;
  const fromEnvelope = firstUsable(
    data?.message,
    typeof data?.detail === "string" ? data.detail : null,
    Array.isArray(data?.detail) ? null : null,
  );
  if (fromEnvelope) return fromEnvelope;

  if (error?.response == null && error?.request) {
    return "Unable to reach the server. Please check your connection and try again.";
  }

  const fromError = firstUsable(error?.message);
  if (fromError && !/status code \d+/i.test(fromError) && !/network error/i.test(fromError)) {
    return fromError;
  }
  if (fromError && /network error/i.test(fromError)) {
    return "Unable to reach the server. Please check your connection and try again.";
  }

  return firstUsable(fallback) || FALLBACK_ERROR;
}

export function getSafeSuccessMessage(data, fallback = FALLBACK_SUCCESS) {
  return (
    firstUsable(
      typeof data === "string" ? data : null,
      data?.message,
      fallback,
    ) || FALLBACK_SUCCESS
  );
}
