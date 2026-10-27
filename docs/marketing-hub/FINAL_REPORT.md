# TaxSimba AI Marketing Hub — Final report (hardened)

**Status:** Staging candidate — **not production-ready**. Live publishing remains **disabled**.  
**Branch:** `cursor/ai-marketing-hub-df9b` (single branch for Toxel)  
**PR:** https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/34  
**Base:** `content/taxsimba-82-articles`  
**Date:** 27 Oct 2026 (Europe/London)

Confirm tip after push: `git rev-parse origin/cursor/ai-marketing-hub-df9b`

---

## Feature classification

| Area | Classification |
|---|---|
| Admin 4 sections + RBAC middleware | **Implemented** |
| Dashboard Not Connected / No Data | **Implemented** |
| Fixture daily engine (labelled) | **Implemented** |
| Real LLM generation when key + FIXTURE_MODE=false | **Implemented** (code path) · **Blocked** without credentials · **Staging verify** |
| Disconnected state (no fake success drafts) | **Implemented** (HTTP 409) |
| Assets TS-001…TS-120 upload/preview/approve/bulk | **Implemented** |
| Claim guards (HMRC/prices/reviews) | **Implemented** |
| Workflow Draft→Review→Approved→Scheduled + audit/pause/dedupe | **Implemented** |
| Live social publish | **Disabled** / **Blocked** |
| OAuth live connect | **Blocked** (missing client IDs) |
| GSC/GA4 data sync | **Disconnected** until OAuth |
| UTM attribution API + client hooks | **Implemented** · **Staging verify** live traffic |
| Screenshots (static evidence preview) | **Implemented** (not logged-in admin session) |
| Live admin UI with session | **Untested** / **Staging verify** |

---

## A–L summary

### A. Existing functionality
Unchanged product surfaces preserved (checkout, 120 articles). Genuine logo from `tax_simba_frontend/public/images/logo.svg`.

### B. Implemented paths (hardening)
- `backend-node/src/marketing-hub/{claims,assets,imageDims,attribution,engine,publishing,router,store,dashboard,seo,templates,config,types}.ts`
- Admin UI under `tax_simba_admin_frontend/.../marketing-hub/*`
- Client UTM hooks: `tax_simba_frontend/src/lib/ppcAnalytics.js`
- Evidence: `docs/marketing-hub/evidence/*`

### C. DB / security
Collections: drafts, connections, publish_jobs, audit, settings (emergency_pause), marketing_assets, marketing_attribution_events. SUPER_ADMIN writes; ADMIN reads; CLIENT may post authenticated payment attribution.

### D. Integrations
All social/Google remain **Not Connected** without secrets. TikTok manual. Ads owner-controlled.

### E. Publishing tests
Fixture workflow **PASS**. Live publish blocked **PASS**. Real platform confirm **NOT TESTED**.

### F. Auto SEO
120 inventory **PASS**. GSC/GA4 **Not Connected**.

### G. Brand / templates / assets
Logo **PASS**. SA≠MTD messaging **PASS**. TS-001…TS-120 validation **PASS**. Placeholders not finished **PASS**.

### H. Attribution
Leads vs paid vs revenue API **PASS** (integration). Live register→Stripe path **NOT TESTED** on staging.

### I. PASS / FAIL / NOT TESTED matrix

| # | Check | Result |
|---|---|---|
| 1 | Backend typecheck | **PASS** |
| 2 | Unit marketing-hub (9) | **PASS** |
| 3 | Integration marketingHub (11) | **PASS** |
| 4 | Admin build | **PASS** |
| 5 | Admin lint | **PASS** (pre-existing warnings) |
| 6 | Fixture engine + workflow + audit | **PASS** |
| 7 | Real-mode disconnected (no fake drafts) | **PASS** |
| 8 | Asset upload/approve/preview + low-res reject | **PASS** |
| 9 | Claim block before schedule | **PASS** |
| 10 | Emergency pause | **PASS** |
| 11 | SEO 120 preserve | **PASS** |
| 12 | Attribution dedupe | **PASS** |
| 13 | RBAC (ADMIN read, ACCOUNTANT 403) | **PASS** |
| 14 | Mobile/desktop evidence screenshots | **PASS** (static preview) |
| 15 | Live OAuth / live publish / live LLM call | **NOT TESTED** |
| 16 | Logged-in admin UI E2E | **NOT TESTED** |
| 17 | Client full website regression build | **NOT TESTED** this pass |
| 18 | Accessibility audit (axe) | **NOT TESTED** (aria labels added; staging verify) |

### J. Remaining blockers (credentials)
1. `MARKETING_HUB_GENERATION_API_KEY` (+ FIXTURE_MODE=false) for real drafts  
2. Meta / LinkedIn / Google OAuth client IDs & secrets  
3. Keep `MARKETING_HUB_ORGANIC_PUBLISH_AUTHORISED=false` until real platform confirmation IDs proven  
4. Verify live checkout prices before any public price creative  
5. Staging login to exercise admin UI end-to-end  

### K. Branch readiness
One branch: `cursor/ai-marketing-hub-df9b` → PR #34 only.

### L. Toxel staging
See `docs/marketing-hub/TOXEL_STAGING_INSTRUCTIONS.md`.

---

## Screenshots

<img alt="Marketing Hub desktop evidence" src="/opt/cursor/artifacts/screenshots/marketing-hub-desktop.png" />
<img alt="Marketing Hub mobile evidence" src="/opt/cursor/artifacts/screenshots/marketing-hub-mobile.png" />

Also copied under `docs/marketing-hub/evidence/`.
