# Integration status matrix

| Integration | Status | Evidence / notes |
|-------------|--------|------------------|
| Website widget + sidebar | **IMPLEMENTED & VERIFIED** (local) | Widget assets served; Vitest accessibility/embed; branding updated |
| Mobile/desktop rendering | **IMPLEMENTED BUT UNVERIFIED** on real devices | Scroll fix in code; physical-device recording **BLOCKED** here |
| SIMBA API + OpenAI | **IMPLEMENTED & VERIFIED** (key present in agent) | Live MTD probe 8/8; staging HTTPS still external |
| HMRC retrieval + monitor | **IMPLEMENTED BUT UNVERIFIED** on staging | Code present (`knowledge/monitor/*`); needs ops token + enabled flag on staging |
| Catalogue sync | **IMPLEMENTED BUT UNVERIFIED** on staging | `catalog/sync/*` preserved; enable on staging |
| Registration / email verification | **STUB / BLOCKED** for E2E | Portal not modified; chat links to website routes only |
| Package pages / checkout | **STUB for payment** | Prices verified in catalogue; checkout not claimed live |
| Customer dashboard handoff | **STUB** | Existing-client messaging guidance only |
| Stripe payment | **STUB / NOT CONNECTED** | `payment_status: unavailable`; never claim success |
| Calendly + Google Meet | **STUB / NOT CONNECTED** | Booking honesty flags; consultations described but not bookable |
| Email enquiry | **IMPLEMENTED** (address published) | `info@taxsimba.co.uk` — delivery not verified from SIMBA |
| Auth / rate limit / CORS | **IMPLEMENTED & VERIFIED** (unit/security suite) | Wildcard CORS blocked in staging/prod settings |
| Privacy / secrets | **IMPLEMENTED & VERIFIED** (security suite + allowlist tests) | No keys in public config |

Do not pretend Stripe/Calendly/portal E2E work because adapters exist.
