/**
 * Consultation booking copy and selection helpers.
 * Online flow when live: explain → customer selects → Calendly event →
 * pay within Calendly’s supported payment integration → Google Meet after confirmation.
 * Do not build a separate Stripe Checkout page for consultations.
 * Email (info@taxsimba.co.uk) is only for general enquiries or when booking is unavailable —
 * never the default “how to book” path.
 */

export type ConsultationTier = {
  code: "ACCOUNTANT_CONSULT_99" | "ACCOUNTANT_CONSULT_149";
  name: string;
  price_gbp: number;
  duration_minutes: number;
};

export const CONSULTATION_TIERS: ConsultationTier[] = [
  {
    code: "ACCOUNTANT_CONSULT_99",
    name: "Quick Tax Advice",
    price_gbp: 99,
    duration_minutes: 20,
  },
  {
    code: "ACCOUNTANT_CONSULT_149",
    name: "Extended Tax Consultation",
    price_gbp: 149,
    duration_minutes: 40,
  },
];

export const BOOKING_FLOW_STEPS = [
  "Choose Quick Tax Advice (£99 / 20 minutes) or Extended Tax Consultation (£149 / 40 minutes).",
  "Open the Calendly booking page for that option.",
  "Pick an available Calendly appointment.",
  "Pay within Calendly’s booking process (Calendly’s supported payment integration).",
  "Receive Google Meet details after Calendly confirms payment and booking.",
] as const;

export function detectConsultationSelection(
  message: string,
): ConsultationTier | null {
  const lower = message.toLowerCase();
  // Do not treat £99000 / £149000 income figures as consultation prices.
  const wants149 =
    /£\s*149(?![\d,])/.test(lower) ||
    /(?:^|[^\d])149(?![\d,])\s*(?:consultation|minutes|min\b)/.test(lower) ||
    /extended tax consultation|40\s*min/.test(lower) ||
    /longer (consultation|session|call)/.test(lower);
  const wants99 =
    /£\s*99(?![\d,])/.test(lower) ||
    /(?:^|[^\d])99(?![\d,])\s*(?:consultation|minutes|min\b)/.test(lower) ||
    /quick tax advice|20\s*min/.test(lower) ||
    /shorter (consultation|session)/.test(lower);
  if (wants149 && !wants99) return CONSULTATION_TIERS[1];
  if (wants99 && !wants149) return CONSULTATION_TIERS[0];
  // Explicit “I'd like the quick/extended” without both prices
  if (/i('d| would)? like (the )?extended|book (the )?extended/.test(lower)) {
    return CONSULTATION_TIERS[1];
  }
  if (/i('d| would)? like (the )?quick|book (the )?quick/.test(lower)) {
    return CONSULTATION_TIERS[0];
  }
  return null;
}

export function isConsultationIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /consult|speak to (an )?accountant|talk to (an )?accountant|book (a )?(call|session|appointment|consultation)|video (call|consultation)|accountant advice|quick tax advice|extended tax consultation|£\s*99(?![\d,])|£\s*149(?![\d,])|20\s*minute|40\s*minute/.test(
      lower,
    ) && !/package|simbian|self assessment simple|mtd plan/.test(lower)
  );
}

export function consultationOptionsReply(): string {
  return (
    "TaxSimba offers two private accountant video consultations on Google Meet:\n\n" +
    "• Quick Tax Advice — £99 for 20 minutes (one focused question)\n" +
    "• Extended Tax Consultation — £149 for 40 minutes (more complex situations)\n\n" +
    "Neither includes filing, bookkeeping or a written report, and there are no free callbacks.\n\n" +
    "The usual booking path is: choose an option → open the matching Calendly event → " +
    "select an available appointment → pay within Calendly’s booking process → " +
    "receive Google Meet details after Calendly confirms the booking.\n\n" +
    "Which option would you like — Quick (£99 / 20 minutes) or Extended (£149 / 40 minutes)?"
  );
}

export function consultationSelectionReply(
  tier: ConsultationTier,
  bookingLive: boolean,
  bookingUrl: string | null,
): string {
  const head =
    `You’ve chosen ${tier.name} — £${tier.price_gbp} for ${tier.duration_minutes} minutes on Google Meet ` +
    `(advice only; no filing, bookkeeping or written report).\n\n`;

  if (bookingLive && bookingUrl && !/example|localhost|stub/i.test(bookingUrl)) {
    return (
      head +
      "Next steps for online booking:\n" +
      "1) Open the Calendly event for this consultation.\n" +
      "2) Choose an available appointment.\n" +
      "3) Pay within Calendly’s booking process (no separate TaxSimba checkout page).\n" +
      "4) You’ll receive Google Meet details after Calendly confirms payment and the booking.\n\n" +
      `Book consultation: ${bookingUrl}\n\n` +
      "I won’t mark anything as booked or paid until Calendly confirms it."
    );
  }

  return (
    head +
    "Online booking (Calendly with integrated payment + Google Meet) is not connected in this environment yet, " +
    "so I can’t open a live slot or confirm an appointment.\n\n" +
    "When booking goes live, you’ll use: select this option → Calendly event → " +
    "pay within Calendly → Meet link after confirmation.\n\n" +
    "For a general enquiry while booking is unavailable, email info@taxsimba.co.uk — " +
    "email is not the normal booking method once online scheduling is live."
  );
}

export function consultationHint(bookingLive: boolean): string {
  if (bookingLive) {
    return (
      "Need personalised help? Choose Quick Tax Advice (£99 / 20 minutes) or " +
      "Extended Tax Consultation (£149 / 40 minutes), then continue to Calendly booking " +
      "(availability → pay within Calendly → Google Meet after confirmation)."
    );
  }
  return (
    "Need personalised help? TaxSimba offers Quick Tax Advice (£99 / 20 minutes) or " +
    "Extended Tax Consultation (£149 / 40 minutes) via Google Meet. " +
    "Ask me which option fits — online booking isn’t connected yet, so I won’t invent a confirmed slot."
  );
}

export function callbackHonestyReply(bookingLive: boolean): string {
  const book =
    "You can choose a paid video consultation instead: Quick Tax Advice (£99 / 20 minutes) or " +
    "Extended Tax Consultation (£149 / 40 minutes) on Google Meet.";
  if (bookingLive) {
    return (
      "I can’t arrange a free phone callback. " +
      book +
      " Say which option you want and I’ll point you to the Calendly booking steps."
    );
  }
  return (
    "I can’t arrange a free phone callback. " +
    book +
    " Online booking isn’t connected yet, so I won’t claim a slot is confirmed. " +
    "For a general enquiry while booking is unavailable, email info@taxsimba.co.uk."
  );
}
