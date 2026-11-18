# Requirements-to-evidence matrix — SIMBA V2

**Branch:** `cursor/simba-v2-final-corrected-6522`  
**PR:** #39  
**Primary report:** `FINAL_CORRECTIONS_AND_VERIFICATION_REPORT.md`  
**Classification legend:** IMPLEMENTED · MOCK TESTED · REAL API TESTED · STAGING VERIFIED · DEVICE VERIFIED · BLOCKED · FAILED

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Friendly British Digital Tax Assistant personality | **IMPLEMENTED** + **REAL API TESTED** | Welcome copy; live journeys; conversion evidence |
| 2 | Tax accuracy — verified retrieval + deterministic MTD/PAYE/Ltd | **IMPLEMENTED** + **MOCK TESTED** + **REAL API TESTED** | Master suite; live MTD; `TAX_ACCURACY_VERIFICATION_REPORT.md` |
| 3 | Personalised package cards (badge, price, CTA) | **IMPLEMENTED** + **REAL API TESTED** | `ts-pkg-card`; `screenshots/final_corrections/desktop_sa_*` / `mobile390_*` |
| 4 | Long conversation 20 / 50 turns (single session) | **IMPLEMENTED** + **REAL API TESTED** | `long_conversation_20.json`, `long_conversation_50.json` |
| 5 | Automatic HMRC/GOV.UK monitor pipeline | **IMPLEMENTED** + **MOCK TESTED**; staging scheduler **BLOCKED** | `knowledge/monitor/*`; boot `hmrc_monitor=off` |
| 6 | Lead capture + business notification | **IMPLEMENTED** + outbox **MOCK TESTED**; SMTP **BLOCKED** | `/api/v1/leads`; outbox files |
| 7 | Paid consultations via Calendly (pay within Calendly → Meet) | **IMPLEMENTED** (honest unavailable UX); live E2E **BLOCKED** | `consultation_booking.ts`; per-tier URLs; widget Book consultation |
| 8 | Registration → verify → checkout → dashboard | Links **IMPLEMENTED**; portal E2E **BLOCKED** | `choose_url` → taxsimba.co.uk routes |
| 9 | Mobile Menu drawer (no truncated “–Op…”) | **IMPLEMENTED**; browser emulation verified; physical **BLOCKED** | `screenshots/final_corrections/01_*` … `10_*`, `mobile_menu_interaction.webm` |
| 10 | Mobile/desktop responsive + scroll | **IMPLEMENTED**; browser emulation **REAL**; physical **BLOCKED** | `screenshots/responsive/` + `final_corrections/` |
| 11 | OpenAI model comparison | **REAL API TESTED**; model unchanged (`gpt-4o-mini`) | `evidence/model_comparison/` |
| 12 | Security / privacy / rate limits | **IMPLEMENTED** + **MOCK TESTED** | `SECURITY_VERIFICATION.md` |
| 13 | Comprehensive customer journeys | **REAL API TESTED** (partial continuous) | Journeys A–E; long convo |
| 14 | Visual evidence pack (readable) | **IMPLEMENTED** (browser) | `screenshots/final_corrections/` |
| 15 | Physical iPhone Safari / Android | **BLOCKED** | Toxel staging |
| 16 | Production deploy | **HOLD** | Owner approval required |

## Release recommendation

**NO-GO for production.**  
**GO for staging handoff to Toxel** on this PR tip after they verify Calendly payment E2E, SMTP, HMRC scheduler, portal E2E, and physical devices.
