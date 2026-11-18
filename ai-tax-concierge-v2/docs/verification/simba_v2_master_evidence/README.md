# SIMBA V2 — Master Implementation Evidence Pack

**Date:** 2026-11-18 (Europe/London)  
**Branch:** `cursor/simba-v2-final-corrected-6522`  
**PR:** https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/39  
**Production:** **HOLD**  
**Evidence remediation commit:** `760007fe25eadccca90870aa930266c3d2744060` (branch tip on PR #39)

## Headline results

| Gate | Result | Obtained via |
|------|--------|--------------|
| Vitest | **512/512 PASS** | `npm test` — `evidence/vitest_full.txt` |
| Typecheck / build | **PASS** | `evidence/typecheck.txt`, `evidence/build.txt` |
| Master single-turn | **537/537 PASS** (was 504/537) | mock LLM + deterministic handlers — `evidence/master_suite_*` |
| Original 33 failures | **All genuine defects fixed; 33/33 retest PASS** | `evidence/ORIGINAL_33_FAILURES_ANALYSIS.md` |
| Multiturn | **50/50 PASS** | `transcripts/multiturn_50.json` |
| Live MTD boundaries | **8/8 PASS** | `evidence/live_mtd_*` |
| Live OpenAI journeys | **20/20 PASS** (whole-transcript scoring) | `evidence/live_openai_journeys_20.json` |
| Ambiguous intents | **10/10 clarified** | `evidence/ambiguous_intent_live.json` |
| Security suite | **37/37 PASS** (allowlist + security + clarifier) | `evidence/security_retest.txt` |

## Evidence modes (do not confuse)

| Mode | Artefacts |
|------|-----------|
| **Mock / deterministic** | 537 scenarios, 50 multiturns, most Vitest |
| **Real OpenAI API** | 20 live journeys, ambiguous probe (short-circuits often), live MTD probes, `live_api_chat_demo.json` |
| **Browser automation** | Screenshots under `screenshots/`; recording `recordings/simba_consultation_evidence_journey.mp4` |
| **Physical iPhone Safari** | **BLOCKED** — staging acceptance for Toxel |

## Latest CX / mobile / model audit

See `evidence/CX_MOBILE_OPENAI_AUDIT.md`, `screenshots/responsive/`, `evidence/model_comparison/`.

## Final master handover

- `FINAL_MASTER_HANDOVER_REPORT.md`
- `REQUIREMENTS_TO_EVIDENCE_MATRIX.md`
- Long chats: `evidence/long_conversation_summary.json`
- Packages: `evidence/personalised_package_recommendations.json`
- Leads: `evidence/lead_capture_api.json` + outbox samples
- Tax accuracy: `evidence/TAX_ACCURACY_VERIFICATION_REPORT.md`

## Documents

| Doc | Purpose |
|-----|---------|
| `FINAL_TOXEL_STAGING_HANDOVER.md` | Staging deploy + acceptance checklist |
| `INTEGRATION_STATUS_MATRIX.md` | Honest integration status (Stripe/Calendly BLOCKED) |
| `DEFECT_REGISTER.md` | Remaining defects / external blockers |
| `SOURCE_AUDIT_AND_FIXES.md` | Code corrections audit |
| `evidence/ORIGINAL_33_FAILURES_ANALYSIS.md` | Verbatim before/after for all 33 |
| `evidence/openai_api_verification.json` | Model, latency, redacted sample |
| `transcripts/LIVE_OPENAI_JOURNEYS_20.md` | Journey index |
| `screenshots/` | Desktop/mobile UI captures |
| `recordings/` | Screen recordings where available |

## Visual artefacts (also under `/opt/cursor/artifacts/`)

- `screenshots/01_preview_ask_simba_launcher.webp` … `08_consultations_99_149.webp`
- `recordings/simba_consultation_evidence_journey.mp4`
