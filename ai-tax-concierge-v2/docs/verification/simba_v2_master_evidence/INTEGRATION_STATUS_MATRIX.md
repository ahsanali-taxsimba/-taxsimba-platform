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
| Calendly + Google Meet | **STUB / NOT CONNECTED** | UI + copy describe select→Calendly→Stripe→Meet; buttons disabled until live |
| Consultation product copy | **VERIFIED** | Responsive consult panel + journeys C; email only as unavailable fallback |
| OpenAI model | **VERIFIED default `gpt-4o-mini`** | Comparison vs `gpt-4o` in `evidence/model_comparison/` — no switch without approval |
| Email enquiry | **IMPLEMENTED** (address published) | `info@taxsimba.co.uk` — SMTP delivery not verified from SIMBA |
| Lead capture API | **IMPLEMENTED & VERIFIED** (outbox) | `/api/v1/leads` saves lead + writes outbox; SMTP transporter **BLOCKED** |
| Long continuous chat | **IMPLEMENTED & VERIFIED** | 20- and 50-turn real OpenAI conversations PASS |
| Personalised package cards | **IMPLEMENTED & VERIFIED** | Recommended badge + Choose this package CTA |
| HMRC monitor scheduler | **IMPLEMENTED**; staging ops **BLOCKED** | Enable with ops token on staging |
| Auth / rate limit / CORS | **IMPLEMENTED & VERIFIED** (unit/security) | Wildcard CORS blocked in staging/prod settings |
| Privacy / secrets | **IMPLEMENTED & VERIFIED** | Security suite + allowlist; no keys in public config |
| Direct HMRC filing by TaxSimba | **NOT CLAIMED** | TaxCalc SA / Xero MTD references only |

Do not pretend Stripe/Calendly/portal E2E work because adapters exist.
