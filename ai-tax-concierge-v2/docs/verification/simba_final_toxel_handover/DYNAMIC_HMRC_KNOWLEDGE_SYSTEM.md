# Dynamic HMRC Knowledge System (canonical)

## Purpose

Monitor official GOV.UK / HMRC sources via the Content API, detect changes (hash + version token), extract structured facts, **auto-publish** when authenticity + validation pass, and quarantine only ambiguous / conflicting / withdrawn / interpretation-heavy facts — without app redeploy.

## Canonical components (PR #35)

| Module | Role |
|--------|------|
| `data/config/hmrc_watchlist.json` | Official watchlist + extractors |
| `src/knowledge/monitor/content_api.ts` | GOV.UK Content API client |
| `src/knowledge/monitor/extract.ts` | Structured fact extraction |
| `src/knowledge/monitor/decision.ts` | Risk-based publish / quarantine |
| `src/knowledge/monitor/service.ts` | Cycle, overlay publish, alerts, rollback, scheduler |
| `src/knowledge/loader.ts` | Baseline + published overlay − blocked fact IDs |
| Ops | `POST /api/v1/ops/hmrc/run` · quarantine approve/reject · rollback |

## Policy

- Verified official changes auto-publish into customer answers (no routine accountant approval).  
- Quarantine **only affected** fact IDs; unaffected verified knowledge stays available.  
- Preserve historical versions and future-dated rules; apply by customer tax year.  
- Does **not** claim 100% accuracy; never publish unverified legal interpretations.  
- Accountant-only boundary for MTD reviews / bookkeeping / returns / submissions.

## Proof

- Unit: `tests/hmrc_monitor.test.ts`  
- Live Content API: `evidence/dynamic_systems_demo_report.json`  
- Live OpenAI uses overlay: `evidence/live_auto_publish_openai_proof.json`  
- Owner report: `../auto_publish_20261114/AUTO_PUBLISH_OWNER_APPROVAL_REPORT.md`
