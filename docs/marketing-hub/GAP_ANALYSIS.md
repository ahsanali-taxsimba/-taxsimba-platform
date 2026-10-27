# TaxSimba AI Marketing Hub — Phase 1 gap analysis

**Inspection branch:** `content/taxsimba-82-articles` @ `67e371a17d6b774bc5364a3b52ebd831ddeb873c`  
**Feature branch:** `cursor/ai-marketing-hub-df9b`  
**Date:** 27 Oct 2026 (Europe/London)

## A. Existing functionality discovered

| Area | Finding | Paths |
|---|---|---|
| Frontend | Next.js 15.5.22 App Router, React 19 | `tax_simba_frontend/` |
| Admin | Next.js 15 admin shell, `basePath: /admin` | `tax_simba_admin_frontend/` |
| API | Express 4 + TypeScript, Mongo driver (no Mongoose) | `backend-node/` |
| Auth | JWT + NextAuth credentials; roles `CLIENT\|ACCOUNTANT\|ADMIN\|SUPER_ADMIN` | `backend-node/src/middleware/auth.ts`, admin `middleware.ts` |
| Deploy | Dockerfiles + PM2 scripts; `render.yaml` still targets legacy CRA | no `.do/`, no GitHub Actions |
| Logo | Genuine SVG wordmark `#37A267` | `tax_simba_frontend/public/images/logo.svg` |
| Palette | Forest `#031f18`, Green `#37A267`, Lime `#B3ED97` present; Mint `#EAF6F0` **not** in repo (closest `#EAF5EE`) | `globals.css` |
| Animal mascot assets | **NOT FOUND** | — |
| Packages | Live prices from API/DB; seed SA Simple £119; article copy mentions MTD Comply £29.99 (not in seed) | `backend-node/src/domain/packages.ts` |
| Checkout | Stripe Checkout Session + webhook | `compat/payments.ts`, `routes/payments.ts` |
| Articles | 120 guides (38 live + 82 next); inventory CSVs; launch top-20 CSV | `src/data/articles*.js`, `docs/inventories/` |
| Analytics | Hard-coded GTM `GTM-PLL2PLKZ`, GA4 `G-LT8D06Y49W`, `ppcAnalytics.js` | `layout.js`, `lib/ppcAnalytics.js` |
| Social OAuth / publish | **NOT FOUND** (footer outbound links only) | — |
| GSC / GA4 APIs | **NOT FOUND** (browser tags only) | — |
| Marketing Hub | **NOT FOUND** | — |
| Content automation (prior PR) | **NOT on this base branch** | — |
| Meta pixel | **NOT FOUND** | — |

## B. Dependencies required for full live scope

1. Meta (Facebook/Instagram) app + Page tokens  
2. LinkedIn Company Page app + tokens  
3. Google Cloud OAuth client for Ads, Search Console, GA4 Data API  
4. Secure secret store for OAuth refresh tokens  
5. Production authorisation flag to enable organic auto-publish  
6. Verified live checkout prices / VAT / billing period before any price claims in creatives  
7. Owner-controlled Google Ads budgets (no automated spend)

## C. Implementation plan (agreed scope for this branch)

Build hub **inside** admin app + backend-node:

1. Dashboard — real counts from Mongo where available; **Not Connected / No Data** otherwise  
2. AI Marketing — daily engine (fixture + optional generation key), approval queue, calendar, **120-template library**  
3. Auto SEO — preserve 120 guides; inventory-based recommendations; GSC/GA4 **connection stubs**  
4. Results & Connections — OAuth scaffolding + health; TikTok **manual packs only**  
5. Publishing engine — durable queue, stages, idempotency, kill switch; never mark Published without platform confirm  
6. Attribution — join verified payment events when present; never invent revenue  

**Out of scope for unverified claims:** live social publish, live Ads spend, invented search volumes, mass AI article publish.
