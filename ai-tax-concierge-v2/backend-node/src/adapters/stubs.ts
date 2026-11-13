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
    return {
      status: "stub",
      price_gbp: priceGbp,
      duration_minutes: 30,
      meeting: "Google Meet",
      booking_url: this.url,
      availability: "not_live",
      label: `£${priceGbp} accountant consultation (30 min Google Meet)`,
      note: "Calendly not connected — do not claim a booking is confirmed",
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
