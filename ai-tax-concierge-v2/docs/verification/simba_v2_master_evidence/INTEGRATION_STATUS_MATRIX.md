# Integration status matrix — honest claims only

| Integration | Status | Notes |
|-------------|--------|-------|
| OpenAI chat | **REAL API TESTED** (this env) | `llm_mode=openai`, model `gpt-4o-mini` |
| Package catalogue / prices | **IMPLEMENTED** | SA 119/149/299; MTD 29.99/59.99/89.99 VAT incl. |
| Package pages / checkout | **STUB for payment** | Prices verified; portal checkout not claimed live |
| Consultation booking UX | **IMPLEMENTED** | Options → Calendly event → pay within Calendly → Meet |
| Calendly events + Calendly payment | **STUB / NOT CONNECTED** | Set per-tier URLs; leave `CONSULTATION_BOOKING_LIVE=false` until E2E |
| Separate Stripe Checkout for consultations | **NOT USED** | Consultations must not use a duplicate TaxSimba Stripe page |
| Package Stripe / portal payment | **STUB / NOT CONNECTED** | `payment_status: unavailable` |
| Google Meet via Calendly | **STUB / NOT CONNECTED** | Confirmed only after Calendly booking+payment |
| Lead capture storage | **IMPLEMENTED** | `/api/v1/leads` + dedupe |
| Lead SMTP inbox delivery | **BLOCKED** | Outbox file only until SMTP wired |
| HMRC monitor code | **IMPLEMENTED** | Change detection / quarantine / approval gates in code |
| HMRC monitor scheduler | **BLOCKED** | `hmrc_monitor=off` until ops enablement |
| Client portal registration E2E | **BLOCKED** | Toxel staging |
| Physical iPhone / Android | **BLOCKED** | Browser emulation only so far |

Do not pretend Calendly payment, SMTP, portal E2E, or HMRC ops work because adapters/code exist.
