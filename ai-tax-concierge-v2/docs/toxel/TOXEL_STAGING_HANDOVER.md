# Toxel — Complete Node.js Staging Handover (SIMBA AI Tax Assistant)

**PR:** [#35](https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/35)  
**Product path:** `ai-tax-concierge-v2/backend-node/` + `ai-tax-concierge-v2/widget/`  
**Customer-facing name:** **SIMBA AI Tax Assistant** (Emerald Signature UI — do not restyle)  
**Release gate:** **STAGING ONLY** — no production merge/deploy; **do not delete Python** (`ai-tax-concierge-v2/backend/`) until staging acceptance is signed separately.

Accepted local evidence (2026-11-14 owner auto-publish approval): **482** Vitest · security **26** · live OpenAI **33/33** (accuracy flags **0**) · live auto-publish OpenAI proof **PASS** · owner commercial live probe **11/11** · HMRC Content API auto-publish + catalogue sync demos **PASS**. Node independent of Python.  
Does **not** claim 100% accuracy; unverified legal interpretations are not published.  
Dynamic systems: [`../verification/dynamic_systems_20261114/DYNAMIC_SYSTEMS_IMPLEMENTATION_REPORT.md`](../verification/dynamic_systems_20261114/DYNAMIC_SYSTEMS_IMPLEMENTATION_REPORT.md).  
Auto-publish owner report: [`../verification/auto_publish_20261114/AUTO_PUBLISH_OWNER_APPROVAL_REPORT.md`](../verification/auto_publish_20261114/AUTO_PUBLISH_OWNER_APPROVAL_REPORT.md).  
Live key re-run: [`../verification/live_key_rerun_20261113/LIVE_KEY_RERUN_REPORT.md`](../verification/live_key_rerun_20261113/LIVE_KEY_RERUN_REPORT.md).  
Reconciliation: [`../verification/final_website_reconciliation/FINAL_SIX_PACKAGE_RECONCILIATION_REPORT.md`](../verification/final_website_reconciliation/FINAL_SIX_PACKAGE_RECONCILIATION_REPORT.md).

---

## 0. Package catalogue alignment (owner decisions)

| Item | Status |
|------|--------|
| SA names + prices | **APPROVED** — Simple £119 / Smart £149 / Elite **£299** |
| MTD customer-facing names + prices | **APPROVED** — **Simbian Comply / Growth / Elite** £29.99 / £59.99 / £89.99 VAT incl. |
| Internal MTD codes | **Preserved** — `MTD_STARTER` / `MTD_GROWTH` / `MTD_COMPLETE` (portal/Stripe; no duplicates; amounts unchanged) |
| Xero in MTD monthly price | **APPROVED** — included in £29.99 / £59.99 / £89.99; customers do **not** pay separately |
| Xero mapping | **VERIFIED FROM WEBSITE** — Comply→Simple, Growth→Ignite, Elite→Grow |
| Bookkeeping | **APPROVED** — **NO FIXED MONTHLY TRANSACTION CAPS** on all three Simbian packages; **not** unlimited out-of-scope work |
| Quarterly MTD updates + year-end SA | **APPROVED** subject to documented customer responsibilities |
| Support channels | **APPROVED** — email + client-dashboard messaging; **not** telephone onboarding |
| Priority support / turnaround / QBR / proactive tax planning | **REMOVED** from SIMBA copy (may still appear on public API — do not auto-approve) |
| Consultation £99 / 30 min | **APPROVED** — Google Meet advice session; **no** filing/bookkeeping/written report; booking stub |
| Exclusions / amendments / cancel-refund / extra-work | **NOT IMPLEMENTED** on website — owner/legal must supply |
| Automatic HMRC knowledge monitor | **IMPLEMENTED** — Content API + risk-based **auto-publish** of verified facts; quarantine only ambiguous/conflicting/withdrawn; accountant path retained for those; rollback + alerts |
| Automatic catalogue sync (no redeploy) | **IMPLEMENTED** — live overlay from approved subscription-plans APIs |
| Final website reconciliation | [`../verification/final_website_reconciliation/FINAL_SIX_PACKAGE_RECONCILIATION_REPORT.md`](../verification/final_website_reconciliation/FINAL_SIX_PACKAGE_RECONCILIATION_REPORT.md) |
| Owner decisions | [`../verification/inclusions_resolution/OWNER_COMMERCIAL_DECISIONS_2026-11-13.md`](../verification/inclusions_resolution/OWNER_COMMERCIAL_DECISIONS_2026-11-13.md) |
| Remaining decision tables | [`../verification/inclusions_resolution/REMAINING_OWNER_DECISION_TABLES.md`](../verification/inclusions_resolution/REMAINING_OWNER_DECISION_TABLES.md) |
| SIMBA behaviour | Approved names/prices + Xero-in-price; no fixed monthly caps (not unlimited out-of-scope); subject-to-scope year-end SA; lowest suitable; never invent SLAs or separate Xero charges; never promise removed premium claims |

**Do not** invent unresolved commercial/legal terms. **Do not** silently change live website HTML or Stripe products outside approved catalogue sync.

---

## 1. Deploy Node to HTTPS staging

```bash
cd ai-tax-concierge-v2/backend-node
npm ci
npm run build          # tsc → dist/
# set secrets via platform secret store — never commit
export OPENAI_API_KEY=*** 
export CONCIERGE_FORCE_MOCK_LLM=false
export CONCIERGE_ENV=staging
export CONCIERGE_CORS_ORIGINS=https://STAGING_HOST,https://www.taxsimba.co.uk
export WEBSITE_BASE_URL=https://www.taxsimba.co.uk
export CONSULTATION_BOOKING_URL=https://calendly.com/<staging-event>
export CONCIERGE_OPS_TOKEN=***          # staging ops only — never expose to widget
export CONCIERGE_HMRC_MONITOR_ENABLED=true
export CONCIERGE_CATALOGUE_SYNC_ENABLED=true
# optional: TAXSIMBA_CATALOGUE_API_BASE=https://taxsimba.co.uk
export PORT=8090
export HOST=0.0.0.0
npm start              # node dist/server.js
```

| Check | Expect |
|-------|--------|
| Node ≥ 20 | `engines` in package.json |
| `GET /api/v1/health` | `product: SIMBA AI`, `llm_mode: openai`, no `mock_notice`; `dynamic_systems` flags |
| `GET /api/v1/bootstrap` | `subtitle: SIMBA AI Tax Assistant`; **no** API key / ops token fields |
| Data | Vendored JSON + writable `data/runtime/` overlays (no Python process) |
| TLS | Terminate at reverse proxy / load balancer → Node HTTP |
| Ops | `POST /api/v1/ops/hmrc/run` and `/ops/catalog/sync` with `x-concierge-ops-token` |

### Routes

| Path | Purpose |
|------|---------|
| `/api/v1/chat` | Conversation |
| `/api/v1/journeys/*` | Guided journeys |
| `/api/v1/bootstrap`, `/welcome`, `/catalog/*` | Config / catalogue |
| `/api/v1/analytics/track` | Engagement only (not verified purchase) |
| `/api/v1/sessions/*` | Session get/delete |
| `/api/v1/health`, `/config` | Ops |
| `/widget/**` | Emerald Signature UI + `embed.js` |

### Rollback

1. Point proxy to prior Node image **or** Python uvicorn (`ai-tax-concierge-v2/backend`).  
2. Disable/remove staging embed script.  
3. Keep Python tree until separate approval.

---

## 2. Widget embedding (staging site only)

```html
<script
  src="https://STAGING_HOST/widget/embed.js"
  data-api-base="https://STAGING_HOST"
  defer
></script>
```

- Floating **Ask SIMBA / AI Tax Assistant** — opens **only** on user click  
- Session welcome card (dismissible once per visitor session); launcher remains  
- Compact panel: `/widget/chat.html` · five actions · expand to full workspace `/widget/index.html`  
- Branding: **SIMBA AI Tax Assistant** · Emerald tokens (`#006B3C`) — see [`EMBEDDING.md`](./EMBEDDING.md)  
- Preview: `https://STAGING_HOST/widget/preview.html`  
- **BLOCKED:** production taxsimba.co.uk embed until staging E2E signed  

---

## 3. Environment variables (names only)

| Variable | Staging | Notes |
|----------|---------|-------|
| `OPENAI_API_KEY` | Required | Server-only secret |
| `OPENAI_MODEL` | Optional | Default `gpt-4o-mini` |
| `OPENAI_TIMEOUT_SECONDS` | Optional | Default `30` |
| `CONCIERGE_FORCE_MOCK_LLM` | `false` | |
| `CONCIERGE_CORS_ORIGINS` | Required | Exact origins, no `*` |
| `CONCIERGE_ENV` | `staging` | |
| `CONCIERGE_LOG_LEVEL` | Optional | |
| `WEBSITE_BASE_URL` | Required | Deep links |
| `CONSULTATION_BOOKING_URL` | When Calendly live | |
| `CONCIERGE_OPS_TOKEN` | Required for ops | Protects HMRC/catalogue ops routes |
| `CONCIERGE_HMRC_MONITOR_ENABLED` | `true` on staging | Schedules GOV.UK Content API monitor |
| `CONCIERGE_HMRC_MONITOR_INTERVAL_MS` | Optional | Default 6 hours |
| `GOVUK_CONTENT_API_BASE` | Optional | Default `https://www.gov.uk/api/content` |
| `CONCIERGE_CATALOGUE_SYNC_ENABLED` | `true` on staging | Schedules catalogue sync |
| `CONCIERGE_CATALOGUE_SYNC_INTERVAL_MS` | Optional | Default 6 hours |
| `TAXSIMBA_CATALOGUE_API_BASE` | Optional | Defaults from website base |
| `CONCIERGE_RUNTIME_DIR` | Optional | Writable overlays / alerts / history |
| `PORT` / `HOST` | As needed | |
| Stripe / portal secrets | **Not in SIMBA Node yet** | Wire via portal/backend when integrating |

---

## 4. Stripe (BLOCKED until E2E)

| Rule | Detail |
|------|--------|
| Today | Payment adapter stub — chat must never claim “paid” |
| Staging work | Stripe **test** Checkout + webhooks on TaxSimba portal/checkout |
| Success criterion | Webhook updates account; SIMBA analytics may record click only; **verified conversion** only from Stripe/portal |
| SIMBA change | Deep-link to staging checkout URLs in `routes.json` when `live_verified` |

Acceptance: complete test payment → portal shows paid package → SIMBA does **not** invent payment success from chat alone.

---

## 5. Calendly / Google Meet £99 (BLOCKED until E2E)

| Rule | Detail |
|------|--------|
| Catalogue | £99 · one 30-minute accountant-led Google Meet advice session · **excludes** filing, bookkeeping, written report · `booking_status: stub` |
| Staging work | Real Calendly event URL → `CONSULTATION_BOOKING_URL` |
| Success criterion | Visitor books; Meet link issued; SIMBA does not invent “booking confirmed” without Calendly webhook/API |

---

## 6. Registration / email verification (BLOCKED until E2E)

| Rule | Detail |
|------|--------|
| Today | Soft/stub registration routes |
| Staging work | Point soft links to staging registration; verify email flow on portal |
| Success criterion | New visitor can register from SIMBA handoff; email verified; no false “registered” from chat |

---

## 7. Authenticated dashboard messaging (BLOCKED until E2E)

| Rule | Detail |
|------|--------|
| Product behaviour | Existing clients → dashboard messaging to **assigned accountant** (no unnecessary upsell) |
| Staging work | Authenticated portal embed/SSO or deep-link to staging dashboard messages |
| Success criterion | Logged-in client reaches secure thread; SIMBA does not expose client data in public chat |

---

## 8. Security checklist (staging)

- [ ] `OPENAI_API_KEY` only in secret store  
- [ ] Bootstrap/config omit secrets  
- [ ] CORS allowlist exact  
- [ ] HTTPS only for embed + API  
- [ ] Rate limits observed under load  
- [ ] Session delete works  
- [ ] Prompt-injection / PII redaction still pass (`npm test`)  
- [ ] Analytics rejects fake `purchase_completed`  
- [ ] See also [`SECURITY_CHECKLIST.md`](./SECURITY_CHECKLIST.md)

---

## 9. End-to-end acceptance tests (staging)

Run after HTTPS deploy. Record PASS/FAIL with screenshots.

### A. Core (must PASS before any production discussion)

| ID | Test | Expect |
|----|------|--------|
| A1 | Health | `llm_mode=openai` |
| A2 | Branding | UI shows **SIMBA AI Tax Assistant**; Emerald theme intact |
| A3 | VAT £90k + timing tests | Grounded GOV.UK answer |
| A4 | MTD £30k | Starts **6 April 2027** |
| A5 | SA prices | £119 / £149 / £299 |
| A6 | MTD prices | £29.99 / £59.99 / £89.99 VAT included |
| A7 | Consultation | £99 / 30 min advice session; no filing/bookkeeping/written report; booking stub or live URL only if configured |
| A8 | Inclusions question | States Xero included in monthly price (no separate charge); subject-to-scope bookkeeping/year-end SA; refuses invented mapping/limits, priority/QBR/planning |
| A9 | Existing client journey | Dashboard messaging; no paid consult push |
| A10 | Decline sales | Information only; no packages |
| A11 | Mobile Safari | Sidebar/drawer + chat usable |
| A12 | Embed on staging page | Launcher click-to-open; Escape closes |
| A13 | `npm test` in CI/image | 482 pass |
| A14 | Live MTD package page | Flag if `/making-tax-digital` still lacks Simbian cards (known contradiction) |
| A15 | Live `/pricing` | Must not show service error |
| A16 | HMRC monitor auto-publish + targeted quarantine | `POST /ops/hmrc/run`; verified facts auto-publish; conflicts quarantine affected IDs only; alerts + rollback |
| A17 | Catalogue sync without redeploy | `POST /ops/catalog/sync`; prices match approved API |
| A18 | Live OpenAI uses published overlay | `npm run live:auto-publish` marker proof |

### B. Integrations (remain BLOCKED until each passes)

| ID | Test | Expect |
|----|------|--------|
| B1 | Stripe test checkout | Paid + webhook; no chat false claim |
| B2 | Calendly £99 | Booking + Meet confirmed via provider |
| B3 | Registration + email verify | Account created end-to-end |
| B4 | Dashboard messaging | Authenticated message to assigned accountant |
| B5 | Production site embed | Only after A+B staging sign-off |
| B6 | Approved inclusions loaded | Catalogue JSON updated; detailed recs unblocked |

### Local regression (reproducible now)

```bash
cd ai-tax-concierge-v2/backend-node
npm ci && npm test && npm run build
CONCIERGE_FORCE_MOCK_LLM=false PORT=8091 npm start
npm run live:openai   # optional; needs key
```

Evidence already on PR: `docs/verification/COMPREHENSIVE_INTELLIGENCE_SALES_AUDIT.md`, `docs/verification/FINAL_INDEPENDENT_VERIFICATION.md`.

---

## 10. Isolation

SIMBA product code lives under `ai-tax-concierge-v2/`. Do **not** modify `frontend/`, taxotools, Marketing Hub, or the live production site from this package without a separate ticket.

**Exception already on PR #35:** portal `backend/phase1b.py` (+ related tests/scripts) syncs the approved SA/MTD catalogue prices into Mongo on boot so Stripe `unit_amount` cannot remain stuck at obsolete Elite £249 / legacy Essential/Plus SKUs. That change is catalogue-only — not a website redesign.

### Dynamic systems (2026-11-14 — implemented + evidenced)

| Mechanism | Status |
|-----------|--------|
| HMRC/GOV.UK Content API monitor (hash + version token, authenticity, structured extraction) | **PASS** — live cycle auto_published 5 |
| Risk-based auto-publish (no routine accountant approval) | **PASS** — Vitest + live demo + live OpenAI marker proof |
| Quarantine only ambiguous/conflicting/withdrawn facts | **PASS** — per-fact block list; unaffected knowledge remains |
| Accountant approve path (quarantined only) + alerts + rollback | **PASS** |
| Scheduled HMRC monitor | **PASS** (enable with env on staging) |
| Catalogue sync from approved TaxSimba APIs | **PASS** — live sync + staging price change/revert without redeploy |
| Stable package IDs / checkout mappings preserved | **PASS** |
| Portal Mongo catalogue boot sync (`backend/phase1b.py`) | **Code on PR** — staging DB E2E still required |

Evidence: [`../verification/dynamic_systems_20261114/DYNAMIC_SYSTEMS_IMPLEMENTATION_REPORT.md`](../verification/dynamic_systems_20261114/DYNAMIC_SYSTEMS_IMPLEMENTATION_REPORT.md).

SIMBA staging remains an isolated service + embed until Toxel signs A/B suites.

---

## 11. Sign-off

| Role | Name | Date | Staging A suite | Integrations B suite | Notes |
|------|------|------|-----------------|----------------------|-------|
| Toxel | | | | | |
| TaxSimba product | | | | | inclusions form |
| TaxSimba eng | | | | | |

**Production merge/deploy and Python deletion require a separate approval after B suite PASS.**
