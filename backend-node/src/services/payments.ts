/**
 * Payment provider boundary. Stripe stays in test mode for migration work; the interface
 * exists so parity tests can drive checkout flows without calling Stripe.
 */
import Stripe from "stripe";

import { env, required } from "../config/env";
import { Doc } from "../db/mongo";
import { checkoutReturnUrls, gbpToStripePence } from "./checkoutUrls";

export const TAX_CODE = "txcd_20060000"; // professional services

export interface CheckoutSession {
  id: string;
  url: string | null;
  status: string;
  payment_status: string;
  payment_intent: string | null;
}

export interface WebhookEvent {
  type: string;
  object: Doc;
}

export interface PaymentProvider {
  createCheckout(
    amount: number,
    label: string,
    originUrl: string,
    metadata: Record<string, string>,
    productDescription?: string | null,
  ): Promise<CheckoutSession>;
  retrieveSession(sessionId: string): Promise<CheckoutSession>;
  parseWebhook(payload: Buffer, signature: string): WebhookEvent;
}

function session(s: Stripe.Checkout.Session): CheckoutSession {
  return {
    id: s.id,
    url: s.url ?? null,
    status: s.status ?? "open",
    payment_status: s.payment_status ?? "unpaid",
    payment_intent: typeof s.payment_intent === "string" ? s.payment_intent : null,
  };
}

export class StripeProvider implements PaymentProvider {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor() {
    this.stripe = new Stripe(required("STRIPE_SECRET_KEY"));
    this.webhookSecret = env("STRIPE_WEBHOOK_SECRET") ?? "";
  }

  async createCheckout(
    amount: number,
    label: string,
    originUrl: string,
    metadata: Record<string, string>,
    productDescription?: string | null,
  ): Promise<CheckoutSession> {
    const unitAmount = gbpToStripePence(amount);
    const { success_url, cancel_url } = checkoutReturnUrls(originUrl);
    // Metadata values must remain strings (UUID-safe) — never Number(uuid).
    const safeMeta: Record<string, string> = {};
    for (const [k, v] of Object.entries(metadata || {})) {
      if (v == null) continue;
      const s = String(v).trim();
      if (!s || s === "NaN" || s === "undefined") continue;
      safeMeta[k] = s;
    }
    const desc = String(productDescription || "").trim();
    return session(
      await this.stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "gbp",
              unit_amount: unitAmount,
              tax_behavior: "exclusive",
              product_data: {
                name: label,
                tax_code: TAX_CODE,
                ...(desc ? { description: desc.slice(0, 500) } : {}),
              },
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url,
        cancel_url,
        automatic_tax: { enabled: true },
        billing_address_collection: "required",
        metadata: safeMeta,
      }),
    );
  }

  async retrieveSession(sessionId: string): Promise<CheckoutSession> {
    return session(await this.stripe.checkout.sessions.retrieve(sessionId));
  }

  parseWebhook(payload: Buffer, signature: string): WebhookEvent {
    const event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    return { type: event.type, object: event.data.object as unknown as Doc };
  }
}

let provider: PaymentProvider | null = null;

export function payments(): PaymentProvider {
  if (!provider) provider = new StripeProvider();
  return provider;
}

/** Test seam: swap the provider so no automated test ever calls Stripe. */
export function setPaymentProvider(next: PaymentProvider | null): void {
  provider = next;
}
