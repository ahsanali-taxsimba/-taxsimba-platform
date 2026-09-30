/**
 * Payment provider boundary. Stripe stays in test mode for migration work; the interface
 * exists so parity tests can drive checkout flows without calling Stripe.
 */
import Stripe from "stripe";

import { env } from "../config/env";
import { Doc } from "../db/mongo";
import { checkoutReturnUrls, gbpToStripePence } from "./checkoutUrls";
import {
  isStripeMissingCustomerError,
  isStripeTaxConfigError,
  PaymentConfigError,
} from "./paymentErrors";

export const TAX_CODE = "txcd_20060000"; // professional services

export interface CheckoutSession {
  id: string;
  url: string | null;
  status: string;
  payment_status: string;
  payment_intent: string | null;
  /** Present when a Stripe Customer was created/attached for subscriptions. */
  customer_id?: string | null;
  mode?: "payment" | "subscription";
}

export interface WebhookEvent {
  type: string;
  object: Doc;
}

export interface CheckoutBillingOpts {
  billingType?: string | null;
  /** Used when billingType is RECURRING (MTD monthly catalogue). */
  recurringInterval?: "month" | "year";
  customerEmail?: string | null;
  existingCustomerId?: string | null;
}

export interface PaymentProvider {
  createCheckout(
    amount: number,
    label: string,
    originUrl: string,
    metadata: Record<string, string>,
    productDescription?: string | null,
    billing?: CheckoutBillingOpts,
  ): Promise<CheckoutSession>;
  retrieveSession(sessionId: string): Promise<CheckoutSession>;
  parseWebhook(payload: Buffer, signature: string): WebhookEvent;
  createBillingPortalSession?(
    customerId: string,
    returnUrl: string,
  ): Promise<{ url: string }>;
}

function session(s: Stripe.Checkout.Session): CheckoutSession {
  return {
    id: s.id,
    url: s.url ?? null,
    status: s.status ?? "open",
    payment_status: s.payment_status ?? "unpaid",
    payment_intent: typeof s.payment_intent === "string" ? s.payment_intent : null,
    customer_id: typeof s.customer === "string" ? s.customer : null,
    mode: s.mode === "subscription" ? "subscription" : "payment",
  };
}

export class StripeProvider implements PaymentProvider {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor() {
    const key = env("STRIPE_SECRET_KEY");
    if (!key) {
      throw new PaymentConfigError(
        "Stripe is not configured. Set STRIPE_SECRET_KEY (sk_test_…) for this environment before starting checkout.",
      );
    }
    if (!/^sk_(test|live)_/.test(key)) {
      throw new PaymentConfigError(
        "STRIPE_SECRET_KEY must be a Stripe secret key (sk_test_… or sk_live_…). Update the environment configuration.",
      );
    }
    this.stripe = new Stripe(key);
    this.webhookSecret = env("STRIPE_WEBHOOK_SECRET") ?? "";
  }

  async createCheckout(
    amount: number,
    label: string,
    originUrl: string,
    metadata: Record<string, string>,
    productDescription?: string | null,
    billing?: CheckoutBillingOpts,
  ): Promise<CheckoutSession> {
    const unitAmount = gbpToStripePence(amount);
    const { success_url, cancel_url } = checkoutReturnUrls(originUrl);
    const safeMeta: Record<string, string> = {};
    for (const [k, v] of Object.entries(metadata || {})) {
      if (v == null) continue;
      const s = String(v).trim();
      if (!s || s === "NaN" || s === "undefined") continue;
      safeMeta[k] = s;
    }
    const desc = String(productDescription || "").trim();
    const recurring = String(billing?.billingType || "").toUpperCase() === "RECURRING";
    const interval = billing?.recurringInterval === "year" ? "year" : "month";

    let customerId = billing?.existingCustomerId
      ? String(billing.existingCustomerId)
      : null;
    if (recurring && !customerId && billing?.customerEmail) {
      const created = await this.stripe.customers.create({
        email: String(billing.customerEmail),
        metadata: { user_id: safeMeta.user_id || "", client_id: safeMeta.client_id || "" },
      });
      customerId = created.id;
    }

    const priceData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData = {
      currency: "gbp",
      unit_amount: unitAmount,
      tax_behavior: "exclusive",
      product_data: {
        name: label,
        tax_code: TAX_CODE,
        ...(desc ? { description: desc.slice(0, 500) } : {}),
      },
      ...(recurring ? { recurring: { interval } } : {}),
    };

    const buildParams = (
      useCustomer: string | null,
      automaticTax: boolean,
    ): Stripe.Checkout.SessionCreateParams => ({
      line_items: [{ price_data: priceData, quantity: 1 }],
      mode: recurring ? "subscription" : "payment",
      success_url,
      cancel_url,
      automatic_tax: { enabled: automaticTax },
      billing_address_collection: "required",
      metadata: safeMeta,
      ...(useCustomer ? { customer: useCustomer } : {}),
      ...(recurring && billing?.customerEmail && !useCustomer
        ? { customer_email: String(billing.customerEmail) }
        : {}),
    });

    try {
      return session(await this.stripe.checkout.sessions.create(buildParams(customerId, true)));
    } catch (first) {
      // Stale stored customer id — recreate and retry once.
      if (customerId && isStripeMissingCustomerError(first)) {
        customerId = null;
        if (recurring && billing?.customerEmail) {
          const created = await this.stripe.customers.create({
            email: String(billing.customerEmail),
            metadata: { user_id: safeMeta.user_id || "", client_id: safeMeta.client_id || "" },
          });
          customerId = created.id;
        }
        try {
          return session(await this.stripe.checkout.sessions.create(buildParams(customerId, true)));
        } catch (second) {
          if (isStripeTaxConfigError(second)) {
            return session(
              await this.stripe.checkout.sessions.create(buildParams(customerId, false)),
            );
          }
          throw second;
        }
      }
      // Stripe Tax not enabled on the TEST account — retry without automatic tax.
      if (isStripeTaxConfigError(first)) {
        return session(await this.stripe.checkout.sessions.create(buildParams(customerId, false)));
      }
      throw first;
    }
  }

  async retrieveSession(sessionId: string): Promise<CheckoutSession> {
    return session(await this.stripe.checkout.sessions.retrieve(sessionId));
  }

  parseWebhook(payload: Buffer, signature: string): WebhookEvent {
    const event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    return { type: event.type, object: event.data.object as unknown as Doc };
  }

  async createBillingPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
    const portal = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return { url: portal.url };
  }
}

let provider: PaymentProvider | null = null;

/**
 * Local-agent / isolated staging only. Activated when PAYMENT_PROVIDER=fake and
 * APP_BASE_URL is clearly non-production (localhost / 127.0.0.1). Never use on
 * shared Toxel staging or production — those require Stripe TEST (sk_test_).
 */
class LocalStagingFakePaymentProvider implements PaymentProvider {
  private readonly sessions = new Map<string, CheckoutSession>();
  private seq = 0;
  private customers = 0;

  async createCheckout(
    amount: number,
    label: string,
    originUrl: string,
    metadata: Record<string, string>,
    _productDescription?: string | null,
    billing?: CheckoutBillingOpts,
  ): Promise<CheckoutSession> {
    const { success_url } = checkoutReturnUrls(originUrl);
    this.seq += 1;
    const id = `cs_test_local_${this.seq}_${Date.now()}`;
    const recurring = String(billing?.billingType || "").toUpperCase() === "RECURRING";
    let customerId = billing?.existingCustomerId ? String(billing.existingCustomerId) : null;
    if (recurring && !customerId) {
      this.customers += 1;
      customerId = `cus_test_local_${this.customers}`;
    }
    const s: CheckoutSession = {
      id,
      url: success_url.includes("{CHECKOUT_SESSION_ID}")
        ? success_url.replace("{CHECKOUT_SESSION_ID}", id)
        : `${success_url}${success_url.includes("?") ? "&" : "?"}session_id=${id}`,
      status: "complete",
      payment_status: "paid",
      payment_intent: recurring ? null : `pi_test_local_${this.seq}`,
      customer_id: customerId,
      mode: recurring ? "subscription" : "payment",
    };
    this.sessions.set(id, s);
    void amount;
    void label;
    void metadata;
    return { ...s };
  }

  async retrieveSession(sessionId: string): Promise<CheckoutSession> {
    const s = this.sessions.get(sessionId);
    if (!s) {
      return {
        id: sessionId,
        url: null,
        status: "complete",
        payment_status: "paid",
        payment_intent: `pi_test_local_recovered`,
        customer_id: null,
        mode: "payment",
      };
    }
    return { ...s };
  }

  parseWebhook(payload: Buffer, signature: string): WebhookEvent {
    void signature;
    return JSON.parse(payload.toString("utf8")) as WebhookEvent;
  }

  async createBillingPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
    return { url: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}portal=1&customer=${encodeURIComponent(customerId)}` };
  }
}

function isLocalNonProdBaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function payments(): PaymentProvider {
  if (!provider) {
    const mode = (env("PAYMENT_PROVIDER") || "").toLowerCase();
    if (mode === "fake") {
      if (!isLocalNonProdBaseUrl(env("APP_BASE_URL"))) {
        throw new PaymentConfigError(
          "PAYMENT_PROVIDER=fake is only allowed when APP_BASE_URL is localhost/127.0.0.1",
        );
      }
      provider = new LocalStagingFakePaymentProvider();
    } else {
      provider = new StripeProvider();
    }
  }
  return provider;
}

/** Test seam: swap the provider so no automated test ever calls Stripe. */
export function setPaymentProvider(next: PaymentProvider | null): void {
  provider = next;
}
