# SIMBA AI — Final readiness assessment

**Date:** 2026-11-13 (Europe/London)  
**Branch/PR:** `cursor/ai-tax-concierge-v2-phase1-0f84` / #35  

## Automated tests

- **175 passed / 0 failed** (mock LLM suite)
- Includes knowledge, journeys, security, recommendations, multiturn, API, accessibility/widget checks

## Real OpenAI verification

- **COMPLETED** — `OPENAI_API_KEY` present in this Cloud Agent session (value never logged)
- Mock mode disabled (`CONCIERGE_FORCE_MOCK_LLM=false`); adapter mode=`openai`
- Connectivity ping OK; **33** live single-turn UK tax questions; **3** multi-turn dialogues; **4** journeys; injection probe refused prompt disclosure
- Tokens used this run: **44,900** / 250,000 daily budget (`gpt-4o-mini`)
- Full evidence: `docs/verification/LIVE_OPENAI_EVIDENCE.md` + `docs/verification/live_openai_report_latest.json`

## Tax accuracy

- MTD thresholds/dates and qualifying-income definition in **corpus** aligned to GOV.UK guidance summaries verified 2026-11-13
- Live answers: most core SA/MTD/allowance facts matched; **two material live issues** recorded:
  - `mtd_threshold_30k` answered **April 2026** instead of corpus **6 April 2027**
  - `vat_threshold` answered **£85,000** (stale) vs current **£90,000**
- Corpus facts carry source URLs + verification metadata
- **Outstanding gate:** human accountant review of material answers before production

## Security

- Core app controls implemented (see `docs/toxel/SECURITY_CHECKLIST.md`)
- Live injection probe did not disclose system prompt
- Production edge/auth/DPIA items remain for Toxel/legal

## Mobile / iPhone staging

- Widget responsive; embed launcher available
- **No public iPhone URL** from this agent — staging host required (`docs/toxel/STAGING_IPHONE.md`)

## Defect summary

| Severity | Status |
|----------|--------|
| Critical | None open in isolated app code paths covered by tests |
| High | Live MTD £30k date error + VAT threshold stale figure; live payment/booking/URLs not connected; human tax review pending |
| Medium | Temporary emblem placeholder; in-memory sessions/analytics not durable |
| Low | Some calculator stubs beyond confirmed site inventory pending Toxel URL map |

## Production recommendation

**Not production-ready** until High gates above are cleared.  
Core engine + widget are integration-ready for Toxel staging work. Live OpenAI connectivity is now evidenced; tax accuracy still needs accountant sign-off and targeted grounding fixes.
