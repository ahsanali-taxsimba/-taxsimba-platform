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
  private readonly settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  consultationLink(priceGbp = 99): Record<string, unknown> {
    const duration = priceGbp >= 149 ? 40 : 20;
    const name =
      priceGbp >= 149 ? "Extended Tax Consultation" : "Quick Tax Advice";
    const url = this.settings.bookingUrlForPrice(priceGbp);
    const live =
      this.settings.consultationBookingLive &&
      Boolean(url) &&
      !/example|localhost|stub/i.test(url);
    return {
      status: live ? "live" : "stub",
      price_gbp: priceGbp,
      duration_minutes: duration,
      meeting: "Google Meet",
      booking_url: live ? url : null,
      availability: live ? "calendly" : "not_live",
      payment: live ? "calendly_integrated" : "calendly_payment_not_connected",
      label: `${name} — £${priceGbp} for ${duration} minutes (Google Meet)`,
      flow: [
        "Select option",
        "Open matching Calendly event",
        "Pick available appointment",
        "Pay within Calendly booking",
        "Google Meet after Calendly confirmation",
      ],
      email_enquiry: "info@taxsimba.co.uk",
      note: live
        ? "Use Calendly booking with integrated payment; do not claim success until Calendly confirms"
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
