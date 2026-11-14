# SIMBA dynamic systems — implementation & evidence

**Date:** 2026-11-14 (Europe/London)  
**PR:** [#35](https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/35) — **HOLD: do not merge / do not deploy production**  
**Branch:** `cursor/ai-tax-concierge-v2-phase1-0f84`

---

## 0. Requirements addressed

| # | Owner requirement | Implementation |
|---|-------------------|----------------|
| 1 | Automatic HMRC/GOV.UK knowledge monitoring, verification, effective dates, versioned updates, safe publication | `src/knowledge/monitor/*` + ops routes + scheduler |
| 2 | Automatic SIMBA package catalogue sync with approved TaxSimba live catalogue without redeploy | `src/catalog/sync/*` + runtime overlay + scheduler |
| 3 | Commercial correction: **NO FIXED MONTHLY TRANSACTION CAPS** on all Simbian packages | Catalogue + prompts + tests updated |

Working chat/live OpenAI path preserved (no duplicate chatbot).

---

## 1. Architecture (safe overlays)

```
Baseline (committed)          Runtime (writable, no redeploy)
─────────────────────         ────────────────────────────────
data/corpus/*.json      →     data/runtime/hmrc/published/*.json  (accountant-approved only)
data/catalog/packages.json →  data/runtime/catalog/overlays/packages.live.json
data/config/hmrc_watchlist.json
```

- Customers see **baseline + approved published overlays only**.
- Quarantined HMRC changes **never** reach `loadFacts()` until accountant approval.
- Catalogue sync writes a live overlay; `packagesCatalog()` prefers it when present.
- Rollback restores prior overlay / baseline without rebuilding the Node image.

---

## 2. HMRC / GOV.UK monitor

| Capability | Status | Evidence |
|------------|--------|----------|
| Official `.gov.uk` sources only | **PASS** | Watchlist + host checks; non-gov rejected in tests |
| Automatic change detection (content hash) | **PASS** | Live cycle quarantined first snapshots |
| Authenticity (host, title markers, expected phrases) | **PASS** | Live: `authenticity_failures: 0` |
| Effective-date extraction | **PASS** | Dates captured on MTD/SA pages |
| Preserve historical tax rules | **PASS** | Baseline corpus never deleted; overlays versioned; history dir |
| Quarantine high-impact / ambiguous changes | **PASS** | All content changes quarantine until approval |
| Prevent unverified info to customers | **PASS** | Unit test: overlay status absent until approve |
| Monitoring / alerts | **PASS** | `data/runtime/hmrc/alerts/*.jsonl` |
| Rollback | **PASS** | Demo approve → rollback restores baseline review_status |
| Scheduled execution | **PASS** | `CONCIERGE_HMRC_MONITOR_ENABLED=true` + interval; demo started scheduler |

Ops (token-protected):

- `POST /api/v1/ops/hmrc/run`
- `GET /api/v1/ops/hmrc/status`
- `GET /api/v1/ops/hmrc/quarantine`
- `POST /api/v1/ops/hmrc/quarantine/:id/approve|reject`
- `POST /api/v1/ops/hmrc/rollback`

Machine report: `dynamic_systems_demo_report.json`

**Verdict: PASS (implemented + tested)** — staging must set `CONCIERGE_OPS_TOKEN` + enable scheduler.

---

## 3. TaxSimba package catalogue sync

| Capability | Status | Evidence |
|------------|--------|----------|
| Authoritative approved catalogue APIs | **PASS** | Live sync from `/api/compat/subscription-plans` |
| Preserve stable package IDs / checkout mappings | **PASS** | `SA_*`, `MTD_STARTER/GROWTH/COMPLETE` preserved |
| Sync published price / VAT / name / description | **PASS** | Live sync applied; SA 119/149/299 · MTD 29.99/59.99/89.99 |
| Strip unpublished / removed claims | **PASS** | Priority / QBR / planning stripped |
| Never expose unpublished values | **PASS** | `priceAvailable:false` skipped |
| Staging price change + reversion without redeploy | **PASS** | Elite 299→311→299 in demo |
| Preserve subscription terms / owner overlays | **PASS** | Consultation + commercial rules re-applied |
| Scheduled sync | **PASS** | `CONCIERGE_CATALOGUE_SYNC_ENABLED=true` |

Ops:

- `POST /api/v1/ops/catalog/sync`
- `GET /api/v1/ops/catalog/status`
- `POST /api/v1/ops/catalog/rollback`

**Verdict: PASS (implemented + tested)**

---

## 4. Commercial correction — no fixed monthly caps

| Before | After |
|--------|-------|
| `bookkeeping_transaction_limits: UNDECIDED` | `NO_FIXED_MONTHLY_TRANSACTION_CAPS` |
| “do not invent caps / undecided” | Owner approved **no fixed monthly transaction caps**; **not** unlimited out-of-scope work |

Updated: `packages.json` (Node + Python reference), recommendations, prompts, Vitest, live owner probe.

---

## 5. Regression after implementation

| Suite | Result |
|-------|--------|
| Vitest | **481/481 PASS** (was 476; +dynamic system tests) |
| Security suite | **26/26 PASS** |
| Live OpenAI harness | **33/33 PASS**, accuracy flags **0** (`live_openai_report_20261114T020133Z.json`) |
| Owner commercial live probe | **11/11 PASS** |
| Dynamic systems demo | **PASS** (see verdict block in JSON report) |

---

## 6. Still outstanding (not these two systems)

| Item | Owner | Status |
|------|-------|--------|
| HTTPS staging host + TLS + CORS | Toxel | BLOCKED |
| `OPENAI_API_KEY` + `CONCIERGE_OPS_TOKEN` in staging secrets | Toxel | BLOCKED until staging |
| Enable schedulers on staging | Toxel | BLOCKED until staging |
| Staging embed (not production) | Toxel | BLOCKED |
| Stripe test checkout + webhooks | Toxel / portal | BLOCKED |
| Calendly £99 + Google Meet E2E | Toxel | BLOCKED |
| Registration / email verification | Toxel / portal | BLOCKED |
| Authenticated dashboard messaging | Toxel / portal | BLOCKED |
| Package exclusions / amendments / cancel-refund legal copy | TaxSimba owner / legal | BLOCKED |
| Live marketing HTML contradictions | TaxSimba / Toxel | Known; not silently fixed |
| Human accountant sign-off of material answers | TaxSimba | Required before production |
| Production merge / live payments / Python deletion | — | **HOLD** |
