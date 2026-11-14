# SIMBA AI Tax Assistant V2 — Consolidated Toxel Staging Handover

**Date:** 2026-11-14 (Europe/London)  
**FINAL STAGING BRANCH:** `cursor/simba-final-toxel-handover-6522`  
**COMMIT SHA:** `bdf68c494cf17077011234c09e85196534dda7d9` *(updated at push — verify with `git rev-parse HEAD`)*  
**PR (staging):** [#36](https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/36) — base `cursor/ai-tax-concierge-v2-phase1-0f84`  
**PR (parent / HOLD):** [#35](https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/35) — base `main`  
**Product path:** `ai-tax-concierge-v2/backend-node/` + `ai-tax-concierge-v2/widget/`  
**Customer name:** **SIMBA AI Tax Assistant**

### Release gates

| Gate | Status |
|------|--------|
| A. Toxel handover / controlled staging prep | **GO** |
| B. HTTPS staging embed + integrations | **GO WITH DEPENDENCIES** |
| C. Merge to `main` / production / live payments | **HOLD — do not merge either PR** |

Do **not** claim 100% tax accuracy. Unverified legal interpretations are not published.

---

## 1. Branch consolidation (PR #35 + PR #36)

| Item | PR #35 | PR #36 (final staging) |
|------|--------|------------------------|
| Source branch | `cursor/ai-tax-concierge-v2-phase1-0f84` | `cursor/simba-final-toxel-handover-6522` |
| Base | `main` | `cursor/ai-tax-concierge-v2-phase1-0f84` |
| Pre-consolidation tip | `9e0a538` (auto-publish) | `5bc3b4d` (behind #35; merge dirty) |
| Post-consolidation | ancestor of staging tip | **contains all of #35** + consolidated handover |

**Verification:** `9e0a538` is an ancestor of the staging tip. Canonical runtime systems from #35 are present; PR #36’s parallel `knowledge/dynamic` + single-file `catalog/sync.ts` duplicates were **not** retained (owner: no duplicate chatbot/systems). Handover package + screenshots from #36 retained and updated.

### Included capabilities

1. Full SIMBA Node + Emerald widget (Phase 1+2)  
2. Risk-based **automatic HMRC/GOV.UK publication** (Content API, structured extraction, per-fact quarantine)  
3. **Dynamic TaxSimba catalogue sync** without redeploy  
4. Accountant-only MTD boundary (no client MTD reviews / bookkeeping corrections / return prep / HMRC submissions)  
5. Commercial rules: Simbian names/prices, Xero-in-price, **NO FIXED MONTHLY TRANSACTION CAPS** (not unlimited out-of-scope)  
6. Ops routes, schedulers, alerts, rollback  

---

## 2. Staging instructions

```bash
git fetch origin cursor/simba-final-toxel-handover-6522
git checkout cursor/simba-final-toxel-handover-6522
cd ai-tax-concierge-v2/backend-node
npm ci
npm test          # expect 482 pass
npm run build
```

### Required staging secrets / env (names only)

| Variable | Value guidance |
|----------|----------------|
| `OPENAI_API_KEY` | Required |
| `CONCIERGE_FORCE_MOCK_LLM` | `false` |
| `CONCIERGE_ENV` | `staging` |
| `CONCIERGE_CORS_ORIGINS` | Exact staging + taxsimba origins (no `*`) |
| `WEBSITE_BASE_URL` | `https://www.taxsimba.co.uk` |
| `CONCIERGE_OPS_TOKEN` | Required for ops |
| `CONCIERGE_HMRC_MONITOR_ENABLED` | `true` |
| `CONCIERGE_HMRC_MONITOR_INTERVAL_MS` | Optional (default 6h) |
| `GOVUK_CONTENT_API_BASE` | Optional (`https://www.gov.uk/api/content`) |
| `CONCIERGE_CATALOGUE_SYNC_ENABLED` | `true` |
| `CONCIERGE_CATALOGUE_SYNC_INTERVAL_MS` | Optional (default 6h) |
| `CONCIERGE_RUNTIME_DIR` | Writable path for overlays/alerts/history |
| `PORT` / `HOST` | e.g. `8090` / `0.0.0.0` behind TLS terminator |

```bash
npm start
# health: GET /api/v1/health  → product SIMBA AI, llm_mode openai
# ops:    POST /api/v1/ops/hmrc/run  +  POST /api/v1/ops/catalog/sync
#         (header x-concierge-ops-token)
```

### Staging embed (not production)

```html
<script
  src="https://STAGING_HOST/widget/embed.js"
  data-api-base="https://STAGING_HOST"
  defer
></script>
```

---

## 3. Test results (this consolidation run)

| Suite | Result |
|-------|--------|
| Vitest regression | **PASS — 482/482** |
| Security suite | **PASS — 26/26** |
| Typecheck / build | **PASS** |
| Live OpenAI harness | **PASS — 33 singles**, multiturn 3, journeys 4, accuracy flags **0** (`evidence/live_openai_report_20261114T025329Z.json`) |
| Live auto-publish → OpenAI uses overlay | **PASS** (`evidence/live_auto_publish_openai_proof.json`) |
| Live HMRC Content API + catalogue demo | **PASS** (`evidence/dynamic_systems_demo_report.json`) |
| Owner commercial live probe | **PASS — 11/11** |
| Smoke startup | **PASS** — Node listens; llm=openai (`evidence/smoke_startup.txt`) |

Reproduce:

```bash
npm test && npm run typecheck && npm run build
npm run live:openai
npm run live:auto-publish
npm run demo:dynamic
npx tsx scripts/liveOwnerDecisionsProbe.ts
```

---

## 4. Outstanding blockers (genuine)

| Item | Status |
|------|--------|
| HTTPS staging host + TLS + CORS wiring | **BLOCKED** until Toxel provisions |
| Stripe test checkout + webhooks E2E | **BLOCKED** |
| Calendly £99 / Google Meet E2E | **BLOCKED** |
| Registration / email verification | **BLOCKED** |
| Authenticated dashboard messaging | **BLOCKED** |
| Legal copy: exclusions / amendments / cancel-refund / out-of-scope charges | **BLOCKED** (owner/legal) |
| Detailed feature-based package inclusions lists | **BLOCKED** (not on website) |
| Live marketing HTML contradictions (e.g. MTD page) | Known — do not silently rewrite production HTML |
| Human accountant sign-off of material answers | Required before production |
| Merge to `main` / production deploy / live payments / Python deletion | **HOLD** |

---

## 5. Catalogue (approved)

| Family | Names | Price |
|--------|-------|------:|
| SA | Simple / Smart / Elite | £119 / £149 / **£299** |
| MTD | **Simbian Comply / Growth / Elite** | £29.99 / £59.99 / £89.99 VAT incl. |
| Codes preserved | `SA_*`, `MTD_STARTER` / `MTD_GROWTH` / `MTD_COMPLETE` | — |
| Consult | £99 · 30 min Google Meet advice | no filing/bookkeeping/written report |
| Bookkeeping | **NO FIXED MONTHLY TRANSACTION CAPS** | **not** unlimited out-of-scope |
| Xero | Included in Simbian monthly price | Comply→Simple, Growth→Ignite, Elite→Grow |

---

## 6. Ops & monitoring (canonical)

| System | Paths / controls |
|--------|------------------|
| HMRC monitor | `src/knowledge/monitor/*` · Content API · risk-based auto-publish · `POST /ops/hmrc/run|rollback` · quarantine approve/reject |
| Catalogue sync | `src/catalog/sync/*` · `POST /ops/catalog/sync` · staging price change/revert without redeploy |
| Runtime | `data/runtime/` (or `CONCIERGE_RUNTIME_DIR`) — published overlays, history, alerts, blocked fact IDs |
| Boundary | Prompt rule #11 — accountant-only for MTD reviews / bookkeeping / returns / submissions |

Detail packs (supporting, same folder): `DYNAMIC_HMRC_KNOWLEDGE_SYSTEM.md`, `DYNAMIC_PACKAGE_CATALOGUE.md`, `STAGING_ENVIRONMENT_AND_DEPLOYMENT.md`, `TOXEL_INTEGRATION_CHECKLIST.md`, `SIX_PACKAGE_APPROVAL_MATRIX.md`, screenshots under `screenshots/`.

---

## 7. Confirmation block

```
FINAL STAGING BRANCH: cursor/simba-final-toxel-handover-6522
COMMIT SHA:           <set to git rev-parse HEAD after push>
TEST RESULTS:         Vitest 482 PASS · Security 26 PASS · Live OpenAI 33/33 flags 0 ·
                      Auto-publish OpenAI PASS · Dynamic demo PASS · Owner probe 11/11 PASS
OUTSTANDING BLOCKERS: HTTPS staging · Stripe · Calendly · Registration · Dashboard messaging ·
                      Legal copy · Feature inclusions · Production merge/payments HOLD
```

**Do not merge PR #35 or PR #36 into `main`. Do not enable live payments without owner approval.**
