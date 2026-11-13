# Toxel — Complete Node.js Staging Handover (SIMBA AI Tax Assistant)

**PR:** [#35](https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/35)  
**Product path:** `ai-tax-concierge-v2/backend-node/` + `ai-tax-concierge-v2/widget/`  
**Customer-facing name:** **SIMBA AI Tax Assistant** (Emerald Signature UI — do not restyle)  
**Release gate:** **STAGING ONLY** — no production merge/deploy; **do not delete Python** (`ai-tax-concierge-v2/backend/`) until staging acceptance is signed separately.

Accepted local evidence (2026-11-13 pre-Toxel pass): **450** Vitest · live OpenAI **33/33** · security **26** · Ask SIMBA launcher + welcome card + compact chat evidenced under `docs/verification/pre_toxel_final/`. Node independent of Python.  
Final audit: [`../verification/pre_toxel_final/PRE_TOXEL_FINAL_AUDIT.md`](../verification/pre_toxel_final/PRE_TOXEL_FINAL_AUDIT.md).

---

## 0. Package catalogue alignment (names VERIFIED; inclusions still need sign-off)

| Item | Status |
|------|--------|
| SA names + prices | **VERIFIED** — Simple £119 / Smart £149 / Elite **£299** |
| MTD customer-facing names + prices | **VERIFIED** — **Simbian Comply / Growth / Elite** £29.99 / £59.99 / £89.99 VAT incl. |
| Internal MTD codes | **Preserved** — `MTD_STARTER` / `MTD_GROWTH` / `MTD_COMPLETE` (portal/Stripe; no duplicates; amounts unchanged) |
| Recovered feature bullets / descriptions | **REQUIRES APPROVAL** — not used as contractual promises in SIMBA |
| Explicit exclusions | **UNKNOWN** |
| Consultation £99 / 30 min | **VERIFIED** price/duration; inclusions **UNKNOWN**; booking stub |
| Six-package approval matrix | [`../verification/inclusions_resolution/SIX_PACKAGE_APPROVAL_MATRIX.md`](../verification/inclusions_resolution/SIX_PACKAGE_APPROVAL_MATRIX.md) |
| Supply / sign-off form | [`PACKAGE_INCLUSIONS_SUPPLY_REQUEST.md`](./PACKAGE_INCLUSIONS_SUPPLY_REQUEST.md) |
| Catalogue flag | `names_and_prices_verified_inclusions_pending_signoff` |
| SIMBA behaviour | State verified names/prices; recommend **lowest suitable**; explain uncertainty; never invent; never say “MTD Starter/Complete” to customers |

**Do not** invent inclusions or change prices.

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
export PORT=8090
export HOST=0.0.0.0
npm start              # node dist/server.js
```

| Check | Expect |
|-------|--------|
| Node ≥ 20 | `engines` in package.json |
| `GET /api/v1/health` | `product: SIMBA AI`, `llm_mode: openai`, no `mock_notice` |
| `GET /api/v1/bootstrap` | `subtitle: SIMBA AI Tax Assistant`; **no** API key fields |
| Data | Vendored JSON under `backend-node/data/` (no Python process) |
| TLS | Terminate at reverse proxy / load balancer → Node HTTP |

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
| Catalogue | £99 · 30 minutes · Google Meet · `booking_status: stub` |
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
| A7 | Consultation | £99 / 30 min; booking stub or live URL only if configured |
| A8 | Inclusions question | Refuses to invent until catalogue approved |
| A9 | Existing client journey | Dashboard messaging; no paid consult push |
| A10 | Decline sales | Information only; no packages |
| A11 | Mobile Safari | Sidebar/drawer + chat usable |
| A12 | Embed on staging page | Launcher click-to-open; Escape closes |
| A13 | `npm test` in CI/image | 426 pass |

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

Do **not** modify TaxSimba portal (`backend/`, `frontend/`), taxotools, Marketing Hub, or live production site from this package without a separate ticket. SIMBA staging is an isolated service + embed.

---

## 11. Sign-off

| Role | Name | Date | Staging A suite | Integrations B suite | Notes |
|------|------|------|-----------------|----------------------|-------|
| Toxel | | | | | |
| TaxSimba product | | | | | inclusions form |
| TaxSimba eng | | | | | |

**Production merge/deploy and Python deletion require a separate approval after B suite PASS.**
