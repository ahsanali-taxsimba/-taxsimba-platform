/** Config/mock adapters for integrations not yet available. */

import type { Settings } from "../config/settings.js";
import type {
  CalendlyAdapter,
  ClientPortalAdapter,
  PaymentAdapter,
  WebsiteNavAdapter,
} from "./base.js";

export class ConfigWebsiteNavAdapter implements WebsiteNavAdapter {
  private readonly base: string;
  private readonly map: Record<string, string>;

  constructor(settings: Settings) {
    this.base = settings.websiteBaseUrl.replace(/\/$/, "");
    this.map = {
      self_assessment: `${this.base}/self-assessment`,
      mtd: `${this.base}/making-tax-digital`,
      pricing: `${this.base}/pricing`,
      consultation: `${this.base}/book-consultation`,
      contact: `${this.base}/contact`,
    };
  }

  suggestPaths(intent: string): Array<Record<string, string>> {
    const key = intent.toLowerCase().trim();
    const url = this.map[key];
    if (!url) {
      return [{ label: "TaxSimba home", url: this.base, status: "stub" }];
    }
    return [
      {
        label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        url,
        status: "stub",
      },
    ];
  }
}

export class MockPaymentAdapter implements PaymentAdapter {
  createCheckout(packageCode: string): Record<string, unknown> {
    return {
      status: "unavailable",
      reason: "Payment integration not wired in Phase 1",
      package_code: packageCode,
      checkout_url: null,
    };
  }
}

export class ConfigCalendlyAdapter implements CalendlyAdapter {
  private readonly url: string;

  constructor(settings: Settings) {
    this.url = settings.consultationBookingUrl;
  }

  consultationLink(priceGbp = 99): Record<string, unknown> {
    const duration = priceGbp >= 149 ? 40 : 20;
    const name =
      priceGbp >= 149 ? "Extended Tax Consultation" : "Quick Tax Advice";
    const live =
      Boolean(this.url) && !/example|localhost|stub/i.test(this.url);
    return {
      status: live ? "live" : "stub",
      price_gbp: priceGbp,
      duration_minutes: duration,
      meeting: "Google Meet",
      booking_url: live ? this.url : null,
      availability: live ? "calendly" : "not_live",
      payment: live ? "stripe" : "stripe_not_connected",
      label: `${name} — £${priceGbp} for ${duration} minutes (Google Meet)`,
      flow: [
        "Select option",
        "Calendly availability",
        "Stripe payment",
        "Google Meet after confirmation",
      ],
      email_enquiry: "info@taxsimba.co.uk",
      note: live
        ? "Use online booking; do not claim success until Calendly and Stripe confirm"
        : "Online booking not connected — do not invent a confirmed appointment; email is only for enquiries while unavailable",
    };
  }
}

export class MockClientPortalAdapter implements ClientPortalAdapter {
  accountStatus(externalRef: string | null): Record<string, unknown> {
    return {
      status: "unavailable",
      reason: "Client portal adapter not wired in Phase 1",
      external_ref: externalRef,
    };
  }
}
