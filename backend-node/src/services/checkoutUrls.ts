/**
 * Canonical Stripe Checkout return paths for the TaxSimba Next.js client.
 * Never hardcode hostnames — callers pass the configured public client origin.
 */
export const CHECKOUT_SUCCESS_PATH = "/planlist/checkout-success";
export const CHECKOUT_CANCEL_PATH = "/planlist/checkout-cancel";

/** Legacy paths observed in older Stripe sessions / CRA — must not 404. */
export const LEGACY_CHECKOUT_SUCCESS_PATHS = [
  "/payment/success",
  "/payments/success",
] as const;
export const LEGACY_CHECKOUT_CANCEL_PATHS = [
  "/payment/cancel",
  "/payments/cancel",
] as const;

export function normalizeClientOrigin(originUrl: string): string {
  const raw = String(originUrl || "").trim();
  if (!raw) throw new Error("originUrl is required");
  return raw.replace(/\/+$/, "");
}

export function checkoutReturnUrls(originUrl: string): {
  success_url: string;
  cancel_url: string;
} {
  const origin = normalizeClientOrigin(originUrl);
  return {
    success_url: `${origin}${CHECKOUT_SUCCESS_PATH}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${CHECKOUT_CANCEL_PATH}`,
  };
}

/** Convert a GBP major-unit amount to Stripe pence. Rejects £0 / invalid. */
export function gbpToStripePence(amount: number): number {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Checkout amount must be a positive GBP price");
  }
  return Math.round(n * 100);
}
