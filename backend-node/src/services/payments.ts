/**
 * Payment provider boundary. Stripe stays in test mode for migration work; the interface
 * exists so parity tests can drive checkout flows without calling Stripe.
 */
import Stripe from "stripe";

import { env, required } from "../config/env";
import { Doc } from "../db/mongo";

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
  ): Promise<CheckoutSession> {
    return session(
      await this.stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "gbp",
              unit_amount: Math.round(amount * 100),
              tax_behavior: "exclusive",
              product_data: { name: label, tax_code: TAX_CODE },
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${originUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${originUrl}/payment/cancel`,
        automatic_tax: { enabled: true },
        billing_address_collection: "required",
        metadata,
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
