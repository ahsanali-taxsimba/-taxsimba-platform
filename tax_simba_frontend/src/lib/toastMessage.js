/**
 * Resolve a safe user-facing message from API/network errors.
 * Never returns an empty string (prevents blank toasts).
 */
export function getSafeErrorMessage(
  error,
  fallback = "Something went wrong. Please check your details and try again.",
) {
  const data = error?.response?.data;

  const candidates = [
    data?.message,
    data?.error,
    data?.msg,
    data?.detail,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  // Common validation shapes: { errors: ["..."] } or { errors: { field: ["..."] } }
  const errors = data?.errors;
  if (Array.isArray(errors)) {
    const joined = errors
      .flatMap((item) => (typeof item === "string" ? [item] : Object.values(item || {})))
      .flat()
      .filter((item) => typeof item === "string" && item.trim());
    if (joined.length) return joined.join(" ");
  } else if (errors && typeof errors === "object") {
    const joined = Object.values(errors)
      .flat()
      .filter((item) => typeof item === "string" && item.trim());
    if (joined.length) return joined.join(" ");
  }

  if (typeof error?.message === "string" && error.message.trim()) {
    // Avoid leaking opaque Axios/network internals when a better payload exists upstream.
    const msg = error.message.trim();
    if (!/^request failed with status code/i.test(msg) && msg !== "Network Error") {
      return msg;
    }
  }

  if (error?.code === "ERR_NETWORK" || error?.message === "Network Error") {
    return "We could not reach the server. Please check your connection and try again.";
  }

  return fallback;
}

export function getSafeSuccessMessage(payload, fallback = "Success") {
  if (typeof payload === "string" && payload.trim()) return payload.trim();
  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }
  return fallback;
}
