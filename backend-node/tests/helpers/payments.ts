/** In-memory payment provider so no automated test ever calls Stripe. */
import type {
  CheckoutBillingOpts,
  CheckoutSession,
  PaymentProvider,
  WebhookEvent,
} from "../../src/services/payments";
import { checkoutReturnUrls, gbpToStripePence } from "../../src/services/checkoutUrls";

export const WEBHOOK_SIGNATURE = "test-signature";

export interface RecordedCheckout {
  amount: number;
  unit_amount_pence: number;
  currency: "gbp";
  label: string;
  product_description: string | null;
  origin_url: string;
  success_url: string;
  cancel_url: string;
  metadata: Record<string, string>;
  session_id: string;
  mode: "payment" | "subscription";
  billing_type: string | null;
}

export class FakePaymentProvider implements PaymentProvider {
  readonly checkouts: RecordedCheckout[] = [];
  private readonly sessions = new Map<string, CheckoutSession>();
  private seq = 0;
  private customers = 0;
  readonly portals: { customerId: string; returnUrl: string; url: string }[] = [];

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
    this.seq += 1;
    const id = `cs_test_${this.seq}`;
    const recurring = String(billing?.billingType || "").toUpperCase() === "RECURRING";
    let customerId = billing?.existingCustomerId ? String(billing.existingCustomerId) : null;
    if (recurring && !customerId) {
      this.customers += 1;
      customerId = `cus_test_${this.customers}`;
    }
    const s: CheckoutSession = {
      id,
      url: `https://checkout.test/${id}`,
      status: "open",
      payment_status: "unpaid",
      payment_intent: recurring ? null : null,
      customer_id: customerId,
      mode: recurring ? "subscription" : "payment",
    };
    this.sessions.set(id, s);
    this.checkouts.push({
      amount,
      unit_amount_pence: unitAmount,
      currency: "gbp",
      label,
      product_description: productDescription ? String(productDescription) : null,
      origin_url: originUrl,
      success_url,
      cancel_url,
      metadata,
      session_id: id,
      mode: recurring ? "subscription" : "payment",
      billing_type: billing?.billingType ? String(billing.billingType) : null,
    });
    return { ...s };
  }

  async retrieveSession(sessionId: string): Promise<CheckoutSession> {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error(`No such session: ${sessionId}`);
    return { ...s };
  }

  parseWebhook(payload: Buffer, signature: string): WebhookEvent {
    if (signature !== WEBHOOK_SIGNATURE) throw new Error("Invalid signature");
    return JSON.parse(payload.toString("utf8")) as WebhookEvent;
  }

  async createBillingPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<{ url: string }> {
    const url = `https://billing.test/portal/${encodeURIComponent(customerId)}?return=${encodeURIComponent(returnUrl)}`;
    this.portals.push({ customerId, returnUrl, url });
    return { url };
  }

  /** Marks a checkout as paid, as Stripe would after a successful test-mode payment. */
  pay(sessionId: string): CheckoutSession {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error(`No such session: ${sessionId}`);
    s.status = "complete";
    s.payment_status = "paid";
    s.payment_intent = s.mode === "subscription" ? null : `pi_test_${sessionId.split("_").pop()}`;
    return { ...s };
  }

  expire(sessionId: string): void {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error(`No such session: ${sessionId}`);
    s.status = "expired";
    s.payment_status = "expired";
    s.url = null;
  }

  last(): RecordedCheckout {
    return this.checkouts[this.checkouts.length - 1];
  }
}
