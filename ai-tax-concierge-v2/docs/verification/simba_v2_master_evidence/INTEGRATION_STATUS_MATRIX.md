# Integration status matrix

| Integration | Status | Evidence / notes |
|-------------|--------|------------------|
| Website widget + sidebar | **IMPLEMENTED & VERIFIED** (local) | `screenshots/*`; Vitest embed/accessibility |
| Mobile/desktop rendering | **IMPLEMENTED**; real-device **UNVERIFIED** | Mobile-width screenshot `07_mobile_width_chat.webp`; physical iPhone Safari **BLOCKED** |
| SIMBA API + OpenAI | **IMPLEMENTED & VERIFIED** | `openai_api_verification.json`; 20 live journeys; model `gpt-4o-mini`; server-side key only |
| HMRC retrieval + monitor | **IMPLEMENTED**; staging ops **UNVERIFIED** | Corpus + monitor code; needs ops token on staging |
| Catalogue sync | **IMPLEMENTED**; staging **UNVERIFIED** | `catalog/sync/*` |
| Registration / email verification | **STUB / BLOCKED** for E2E | Chat links to website routes only; portal not exercised |
| Package pages / checkout | **STUB for payment** | Prices verified in catalogue; checkout not claimed live |
| Customer dashboard handoff | **STUB** | Existing-client messaging guidance only |
| Stripe payment | **STUB / NOT CONNECTED** | `payment_status: unavailable`; never claim success |
| Calendly + Google Meet | **STUB / NOT CONNECTED** | Booking honesty flags; consultations described (£99/20, £149/40) but **not bookable** here |
| Consultation product copy | **VERIFIED** | Screenshot `08_consultations_99_149.webp`; recording `recordings/simba_consultation_evidence_journey.mp4` |
| Email enquiry | **IMPLEMENTED** (address published) | `info@taxsimba.co.uk` — SMTP delivery not verified from SIMBA |
| Auth / rate limit / CORS | **IMPLEMENTED & VERIFIED** (unit/security) | Wildcard CORS blocked in staging/prod settings |
| Privacy / secrets | **IMPLEMENTED & VERIFIED** | Security suite + allowlist; no keys in public config |
| Direct HMRC filing by TaxSimba | **NOT CLAIMED** | TaxCalc SA / Xero MTD references only |

Do not pretend Stripe/Calendly/portal E2E work because adapters exist.
