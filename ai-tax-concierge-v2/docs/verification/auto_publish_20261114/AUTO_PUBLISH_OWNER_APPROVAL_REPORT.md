# Owner approval — risk-based automatic HMRC knowledge publication

**Date:** 2026-11-14 (Europe/London)  
**PR:** [#35](https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/35) — **HOLD: do not merge / do not deploy production / no live payments**  
**Branch:** `cursor/ai-tax-concierge-v2-phase1-0f84`

Owner decision: verified official HMRC/GOV.UK changes must automatically flow into SIMBA customer answers without routine manual accountant approval. Quarantine only ambiguous, conflicting, withdrawn, or interpretation-heavy facts.

This does **not** claim 100% accuracy. Unverified legal interpretations are not published.

---

## Policy (replaces blanket quarantine)

| Gate | Auto-publish requires |
|------|------------------------|
| Source | Official `.gov.uk` via GOV.UK Content API (HTML fallback); host + publisher + title markers |
| Change detection | Content hash + version token (`content_id` / `public_updated_at`) + scheduled checks |
| Extraction | Structured fact: source URL, tax year(s), effective date, publication date, conditions, superseded summary |
| Validation | Expected phrases; high-impact numeric/deadline facts need effective dates; confidence high/medium |
| Contradiction | No unresolved authoritative conflict for the same fact id |
| Interpretation | No low-confidence / uncertain legal-interpretation markers |
| Publication | Runtime overlay → `loadFacts()` merge; cache invalidate via `reloadFacts()`; **no redeploy** |
| History | Prior overlays copied to history; future-dated bands preserved; tax-year retrieval applies |
| Failure mode | Quarantine **only affected** fact IDs; alert admins; omit blocked IDs from retrieval; unaffected knowledge stays live |
| Accountant path | Remains for quarantined/ambiguous facts only (approve/reject ops) |
| Boundary | SIMBA does not perform client MTD reviews, bookkeeping corrections, tax-return preparation, or HMRC submissions |

---

## Evidence

| Check | Result | Evidence |
|-------|--------|----------|
| Vitest (incl. auto-publish fixtures) | **PASS — 482/482** | `npm test` |
| Auto-publish MTD / SA / VAT / future-dated without manual approval | **PASS** | `tests/hmrc_monitor.test.ts` |
| Conflict quarantines only affected fact; MTD remains | **PASS** | same |
| Withdrawn / outage / malformed / rollback | **PASS** | same |
| Live GOV.UK Content API cycle + auto-publish | **PASS** | `dynamic_systems_demo_report.json` |
| Live OpenAI uses published overlay (not DB-only) | **PASS** | `live_auto_publish_openai_proof.json` — marker `SIMBA-AUTO-PUB-MARKER-2026-11-14-MTD30K` repeated in gpt-4o-mini reply with 6 April 2027 / £30,000 |
| Accountant-only boundary | **PASS** | prompts rule #11 + live proof |
| Catalogue auto-sync (unchanged requirement) | **PASS** | demo staging Elite 311→299 revert |
| Stripe / Calendly / registration / production embed | **BLOCKED** | staging E2E still required |

Reproduce:

```bash
cd ai-tax-concierge-v2/backend-node
npm test
npm run demo:dynamic
npm run live:auto-publish   # needs OPENAI_API_KEY
```

---

## Scheduler / ops (Toxel)

| Variable | Purpose |
|----------|---------|
| `CONCIERGE_HMRC_MONITOR_ENABLED=true` | Enable scheduled Content API checks |
| `CONCIERGE_HMRC_MONITOR_INTERVAL_MS` | Default 6h |
| `CONCIERGE_OPS_TOKEN` | Protect `/api/v1/ops/hmrc/*` |
| `GOVUK_CONTENT_API_BASE` | Optional override (default `https://www.gov.uk/api/content`) |
| `CONCIERGE_RUNTIME_DIR` | Writable overlays/alerts/history |

Ops: `POST /ops/hmrc/run` · `GET /ops/hmrc/status` · quarantine approve/reject · `POST /ops/hmrc/rollback`.

---

## Verdict

**PASS** for risk-based automatic publication of verified official HMRC facts into live SIMBA answers.  
**BLOCKED** for merge, production deploy, and live payments pending owner/Toxel staging sign-off.
