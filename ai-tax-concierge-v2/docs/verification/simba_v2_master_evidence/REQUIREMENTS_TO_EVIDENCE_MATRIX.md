# Requirements-to-evidence matrix — SIMBA V2

**Branch:** `cursor/simba-v2-final-corrected-6522`  
**PR:** #39  
**Classification legend:** IMPLEMENTED · MOCK TESTED · REAL API TESTED · STAGING VERIFIED · DEVICE VERIFIED · BLOCKED · FAILED

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Friendly British Digital Tax Assistant personality | **IMPLEMENTED** + **REAL API TESTED** | Welcome copy; live journeys; `conversion_journeys_AE.json` |
| 2 | Tax accuracy — verified retrieval + deterministic MTD/PAYE/Ltd | **IMPLEMENTED** + **MOCK TESTED** + **REAL API TESTED** | `mtd_eligibility*`, master 537/537, live MTD 8/8, accuracy report |
| 3 | Personalised package cards (badge, price, CTA) | **IMPLEMENTED** + **REAL API TESTED** | Widget `ts-pkg-card`; `personalised_package_recommendations.json`; screenshots `packages_*` |
| 4 | Long conversation 20 / 50 turns (single session) | **IMPLEMENTED** + **REAL API TESTED** | History pack fix; `long_conversation_20/50.json` |
| 5 | Automatic HMRC/GOV.UK monitor pipeline | **IMPLEMENTED** + **MOCK TESTED**; staging scheduler **BLOCKED** | Code `knowledge/monitor/*`; unit tests; ops enablement needed on staging |
| 6 | Lead capture + business notification | **IMPLEMENTED** + **MOCK TESTED** (outbox); SMTP **BLOCKED** | `/api/v1/leads`; outbox files; `lead_capture_api.json` |
| 7 | Paid consultations Calendly→Stripe→Meet | **IMPLEMENTED** (honest unavailable UX); live E2E **BLOCKED** | Consultation booking helpers + UI |
| 8 | Registration → verify → checkout → dashboard | **STUB / BLOCKED** | Choose-package links to taxsimba.co.uk routes only |
| 9 | Mobile/desktop responsive + scroll | **IMPLEMENTED**; browser emulation **REAL**; physical device **BLOCKED** | `screenshots/responsive/` |
| 10 | OpenAI model comparison | **REAL API TESTED**; model unchanged | `evidence/model_comparison/` — keep `gpt-4o-mini` |
| 11 | Security / privacy / rate limits | **IMPLEMENTED** + **MOCK TESTED** | Security suite 37+; allowlist; chat rate limit |
| 12 | Comprehensive customer journeys | **REAL API TESTED** (partial continuous) | Journeys A–E, long convo, ambiguous intents |
| 13 | Visual evidence pack | **IMPLEMENTED** (browser emulation) | Screenshots + recordings under evidence folder |
| 14 | Physical iPhone Safari / Android | **BLOCKED** | Toxel staging |
| 15 | Production deploy | **HOLD** | Owner approval required |

## Release recommendation

**NO-GO for production.**  
**GO for staging handoff to Toxel** on this branch tip after they verify external integrations and physical devices.
