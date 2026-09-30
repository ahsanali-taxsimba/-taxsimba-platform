/**
 * Map Stripe / payment-provider failures to controlled HttpErrors.
 * Never leak secrets or raw Stripe payloads to clients.
 */
import { HttpError, httpError } from "../http/errors";

export class PaymentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentConfigError";
  }
}

function safeStripeMessage(err: unknown): string {
  if (!err || typeof err !== "object") return "Payment provider request failed";
  const e = err as {
    type?: string;
    code?: string;
    message?: string;
    rawType?: string;
  };
  const code = String(e.code || "").trim();
  const type = String(e.type || e.rawType || "").trim();
  const msg = String(e.message || "").trim();

  // Never echo anything that looks like a secret.
  if (/sk_(live|test)_|whsec_|rk_/i.test(msg)) {
    return "Payment provider rejected the checkout request. Check Stripe TEST configuration.";
  }

  if (code === "resource_missing" || /no such customer/i.test(msg)) {
    return "The stored Stripe customer is invalid. Retry checkout so a new customer can be created.";
  }
  if (
    /automatic.?tax/i.test(msg) ||
    /tax.*not.*activated/i.test(msg) ||
    code === "tax_id_invalid" ||
    code === "customer_tax_location_invalid"
  ) {
    return "Stripe Tax is not available for this account. Enable Stripe Tax in the Stripe Dashboard (TEST mode) or contact TaxSimba support.";
  }
  if (type === "StripeAuthenticationError" || /invalid api key/i.test(msg)) {
    return "Stripe authentication failed. Set a valid STRIPE_SECRET_KEY (sk_test_…) for this environment.";
  }
  if (type === "StripeConnectionError") {
    return "Could not reach Stripe. Check network access and try again.";
  }
  if (msg && msg.length < 220) return msg;
  return "Payment provider request failed. Check Stripe TEST configuration and try again.";
}

/** Convert provider failures into HttpError; rethrow existing HttpError unchanged. */
export function mapPaymentError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  if (err instanceof PaymentConfigError) {
    return httpError(503, err.message);
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/STRIPE_SECRET_KEY is not configured/i.test(msg) || /STRIPE_SECRET_KEY/i.test(msg) && /not configured/i.test(msg)) {
    return httpError(
      503,
      "Stripe is not configured. Set STRIPE_SECRET_KEY (sk_test_…) for this environment before starting checkout.",
    );
  }
  if (/originUrl is required/i.test(msg) || /Checkout amount must be/i.test(msg)) {
    return httpError(400, msg);
  }
  // Stripe SDK errors expose type/code; fall through to safe message.
  return httpError(502, safeStripeMessage(err));
}

export function isStripeTaxConfigError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  const msg = String(e.message || "");
  const code = String(e.code || "");
  return (
    /automatic.?tax/i.test(msg) ||
    /tax.*not.*activated/i.test(msg) ||
    code === "customer_tax_location_invalid" ||
    code === "tax_id_invalid"
  );
}

export function isStripeMissingCustomerError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string; param?: string };
  const msg = String(e.message || "");
  return e.code === "resource_missing" || /no such customer/i.test(msg);
}
