/** In-memory payment provider so no automated test ever calls Stripe. */
import type {
  CheckoutSession,
  PaymentProvider,
  WebhookEvent,
} from "../../src/services/payments";

export const WEBHOOK_SIGNATURE = "test-signature";

export interface RecordedCheckout {
  amount: number;
  label: string;
  origin_url: string;
  metadata: Record<string, string>;
  session_id: string;
}

export class FakePaymentProvider implements PaymentProvider {
  readonly checkouts: RecordedCheckout[] = [];
  private readonly sessions = new Map<string, CheckoutSession>();
  private seq = 0;

  async createCheckout(
    amount: number,
    label: string,
    originUrl: string,
    metadata: Record<string, string>,
  ): Promise<CheckoutSession> {
    this.seq += 1;
    const id = `cs_test_${this.seq}`;
    const s: CheckoutSession = {
      id,
      url: `https://checkout.test/${id}`,
      status: "open",
      payment_status: "unpaid",
      payment_intent: null,
    };
    this.sessions.set(id, s);
    this.checkouts.push({ amount, label, origin_url: originUrl, metadata, session_id: id });
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

  /** Marks a checkout as paid, as Stripe would after a successful test-mode payment. */
  pay(sessionId: string): CheckoutSession {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error(`No such session: ${sessionId}`);
    s.status = "complete";
    s.payment_status = "paid";
    s.payment_intent = `pi_test_${sessionId.split("_").pop()}`;
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
