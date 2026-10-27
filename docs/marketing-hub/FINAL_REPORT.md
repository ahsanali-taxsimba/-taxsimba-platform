# TaxSimba AI Marketing Hub — Final report

**Status:** Staging candidate — **not production-ready**.  
**Branch:** `cursor/ai-marketing-hub-df9b`  
**Base:** `content/taxsimba-82-articles`  
**Date:** 27 Oct 2026 (Europe/London)

---

## A. Existing functionality discovered

See `docs/marketing-hub/GAP_ANALYSIS.md`. Summary: Next.js client + admin, Express/Mongo API, Stripe checkout, 120 guides, GTM/GA4 browser tags, genuine `logo.svg`. **No** prior Marketing Hub, social OAuth publishers, GSC/GA4 APIs, or animal mascot assets. Mint `#EAF6F0` adopted as approved palette (closest prior `#EAF5EE`).

---

## B. Features implemented (file paths)

| Area | Paths |
|---|---|
| Config / brand / targets | `backend-node/src/marketing-hub/config.ts` |
| Types | `backend-node/src/marketing-hub/types.ts` |
| Mongo store + indexes | `backend-node/src/marketing-hub/store.ts` |
| 120-template library | `backend-node/src/marketing-hub/templates.ts` |
| Dashboard metrics | `backend-node/src/marketing-hub/dashboard.ts` |
| Daily AI engine + TikTok packs | `backend-node/src/marketing-hub/engine.ts` |
| Auto SEO | `backend-node/src/marketing-hub/seo.ts` |
| Publishing workflow | `backend-node/src/marketing-hub/publishing.ts` |
| HTTP router | `backend-node/src/marketing-hub/router.ts` |
| App wiring | `backend-node/src/app.ts` |
| Env names | `backend-node/.env.example` |
| Admin API client | `tax_simba_admin_frontend/src/lib/marketingHub.ts` |
| Hub UI shell | `.../marketing-hub/_components/HubShell.tsx` |
| Dashboard / AI / SEO / Results | `.../marketing-hub/{dashboard,ai-marketing,auto-seo,results}/` |
| Nav + middleware | `AppSidebar.tsx`, `middleware.ts` |
| Genuine logo copy | `tax_simba_admin_frontend/public/images/taxsimba-logo.svg` |
| Docs | `docs/marketing-hub/*` |

---

## C. Database migrations and security changes

- **Collections (lazy + indexes on startup):** `marketing_drafts`, `marketing_connections`, `marketing_publish_jobs`, `marketing_audit`, (+ reserved meta/settings).  
- **RBAC:** Staff (`ADMIN`/`SUPER_ADMIN`) for reads; **SUPER_ADMIN** for engine, advance, publish, OAuth begin/disconnect, pause.  
- **Kill switches:** `MARKETING_HUB_ENABLED`, `MARKETING_HUB_PAUSED`, `MARKETING_HUB_ORGANIC_PUBLISH_AUTHORISED`.  
- **Secrets:** OAuth client secrets via env only; connection documents never return credential material to clients.  
- **No schema migration tool** — Mongo index ensure only (matches existing backend pattern).

---

## D. Integration status (every platform)

| Platform | Status |
|---|---|
| Facebook Pages | Scaffold + OAuth begin when `META_APP_ID` set; else **Not Connected** |
| Instagram professional | Same Meta app path; **Not Connected** without credentials |
| LinkedIn Company Pages | Scaffold; needs `LINKEDIN_CLIENT_ID` |
| Google Ads | Scaffold; **owner-controlled spend** — publish always skipped for Ads |
| Google Search Console | Scaffold; **Not Connected** without Google OAuth |
| Google Analytics 4 | Scaffold; browser GTM/GA4 tags exist on public site but Hub API **Not Connected** |
| TikTok | **Manual only** — 9:16 packs, no OAuth auto-publish |

Mock UI connect sets `hasCredentials=false` and cannot confirm live publish.

---

## E. Automated publishing test results

| Test | Result | Notes |
|---|---|---|
| Workflow advance ai_draft→…→scheduled | **PASS** (integration) | |
| Publish without `ORGANIC_PUBLISH_AUTHORISED` | **PASS** (blocked 400) | |
| Never mark Published without platform confirm | **PASS** (unit/integration design) | |
| Live Facebook/LinkedIn publish | **NOT TESTED** | Credentials unavailable |
| Idempotent retry with real external id | **NOT TESTED** (live) | Job collection + key exist |

---

## F. Auto SEO and Google data

| Item | Result |
|---|---|
| Inventory 120 guides preserved | **PASS** |
| Recommendations require human review | **PASS** |
| GSC query sync | **NOT TESTED** / **Not Connected** |
| GA4 traffic in Hub dashboard | **NOT TESTED** / **Not Connected** |
| Invented search volumes | **PASS** (none invented) |

---

## G. Branding, pricing, template library

| Item | Result |
|---|---|
| Genuine logo (repo SVG) | **PASS** — copied, not AI-generated |
| Palette Forest/Green/Mint/Lime | **PASS** in Hub UI + API status |
| 120 templates, batches of 10, stable IDs | **PASS** |
| No false artwork approval | **PASS** |
| Proposed £119 / £29.99 with disclaimer | **PASS** — not claimed as live checkout |

---

## H. Registration and payment attribution

| Item | Result |
|---|---|
| Registrations from `users` CLIENT count | **PASS** (real query; may be 0 → shown) |
| Paying SA/MTD from `client_services` / `payment_transactions` | **PASS** structure; **No Data** when empty |
| Revenue from verified paid rows only | **PASS** structure |
| Private tax data exposure | **PASS** — aggregates only |
| End-to-end PPC→checkout attribution UI | **PARTIAL** — uses existing payment collections; full UTM join **NOT TESTED** live |

---

## I. PASS / FAIL / NOT TESTED checklist

1. Application build, lint, typecheck — **PASS** (backend typecheck; admin build+lint; hub unit+integration)  
2. Existing website regression — **NOT TESTED** (client `npm run build` not re-run this branch; no intentional client product changes)  
3. SA/MTD signup and checkout — **NOT TESTED** this branch  
4. Content creation, review, scheduling — **PASS** (fixture engine + advance API)  
5. Official platform connection flows — **NOT TESTED** live OAuth (**PASS** Not Connected / mock UI)  
6. Automatic publishing and failure recovery — **PASS** blocked path; live confirm **NOT TESTED**  
7. TikTok manual exports — **PASS** API pack shape  
8. GSC and GA4 integration — **NOT TESTED** (Not Connected)  
9. SEO recommendations and article preservation — **PASS**  
10. Campaign attribution and payment tracking — **PARTIAL** / **NOT TESTED** live  
11. Permissions and security — **PASS** (role gates in tests)  
12. Mobile layouts and accessibility — **NOT TESTED** (responsive classes present; no device QA screenshots)

---

## J. Outstanding blockers and credentials

1. Meta, LinkedIn, Google OAuth client IDs/secrets + refresh-token vault  
2. Production authorisation for organic publish  
3. Verified live checkout prices before any public price creative  
4. Owner Google Ads account linkage (manual budgets)  
5. Staging secrets for generation API if leaving fixture mode  
6. UAT-approved app line merge is **out of scope** of this content-base branch  

---

## K. GitHub branch and commit readiness

- **Branch:** `cursor/ai-marketing-hub-df9b`  
- Push + PR for **Toxel staging review only** — do not merge/deploy production from Cursor approval.

---

## L. Toxel staging testing instructions

See `docs/marketing-hub/TOXEL_STAGING_INSTRUCTIONS.md`.
