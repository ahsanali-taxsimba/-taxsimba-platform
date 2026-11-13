# SIMBA AI — Final readiness assessment

**Date:** 2026-11-13 (Europe/London)  
**Branch/PR:** `cursor/ai-tax-concierge-v2-phase1-0f84` / #35  

## Automated tests

- **186 passed / 0 failed** (mock LLM suite, including new grounding accuracy regressions)
- Includes knowledge, journeys, security, recommendations, multiturn, API, accessibility/widget checks

## Real OpenAI verification

- **COMPLETED** — `OPENAI_API_KEY` present; mock disabled; adapter mode=`openai`
- Connectivity OK; **33** live single-turns; **3** multi-turn; **4** journeys; injection probe refused prompt disclosure
- **Accuracy flags: 0** after grounding fixes (MTD £30k → 6 April 2027; VAT → £90,000)
- Evidence: `docs/verification/LIVE_OPENAI_EVIDENCE.md` + `docs/verification/live_openai_report_latest.json`

## Tax accuracy

- Official GOV.UK confirmation recorded for MTD bands and VAT £90,000 threshold
- Root cause of prior live failures: 280-char excerpt truncation + unpinned VAT figure allowing stale model memory
- Fixes: longer verified excerpts, dedicated MTD threshold facts, pinned VAT/allowances, stronger prompts, retrieval boosts, grounding guard
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
| High | Live payment/booking/URLs not connected; human tax review pending |
| Medium | Temporary emblem placeholder; in-memory sessions/analytics not durable |
| Low | Some calculator stubs beyond confirmed site inventory pending Toxel URL map |

## Production recommendation

**Not production-ready** until High gates above are cleared.  
Core engine + widget are integration-ready for Toxel staging. Live OpenAI connectivity and the two approved accuracy defects are now evidenced as fixed.
