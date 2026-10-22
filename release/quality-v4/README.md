# TaxSimba Quality Revision 4 — current source and audit

Continues Competitive V3; no rebuild. Keep the agreed first 20 first, followed by the other 100. Current status: tested integration/staging source, not independent tax approval or direct-publication clearance.

Read release/quality-v4/AUDIT.md and REGISTER.html for the twelve-angle review and all 120 records. ALL_ARTICLES.json is the current copy snapshot; MAINTENANCE_REGISTER.json holds review risk, first due date, required roles and open evidence. Earlier release folders are historical.

Changes: 120 mapped service-fit actions; topic-matched deadline context that switches/expires using London dates; official free routes where the reader needs an eligibility/payment answer first; home-nation guidance in 34 relevant guides and savings/dividend distinctions in two others; six shorter metadata titles. Retains V3 tools, original artwork, logo, 120 downloads, stable URLs and SA/MTD signup destinations.

Source check: all 140 existing V3 source URLs responded successfully. URL availability is not full tax fact-checking. Selected current official guidance supports the new national/deadline treatment. No named qualified tax review is recorded. National notes are contextual scope guidance, not a complete review of devolved tax rules or proof of national market reach.

Build and verification:

    npm ci
    npm run verify:quality-v4
    npm run verify:competitive-v3
    npm run verify:articles
    npm run verify:article-fields
    npm run build
    npm run release:start

The normal production build and structural checks passed, including V4 date boundaries and expiry. HTTP checks passed all 120 pages, 360 responsive image responses, 120 downloads and 120 sitemap entries; key service/signup routes returned 200. The five tools and their jump links remained in server-rendered HTML. No new browser, mobile visual, screen-reader or Core Web Vitals pass is claimed. Live auth/payment/email/accountant-assignment flows were not exercised. Existing lint/type-check skips remain.

For maintenance:

    npm run audit:maintenance
    node scripts/check-article-maintenance.mjs --as-of=2026-10-28

This lists reviews due, not completed reviews. Weekly monitoring is proposed for 80 time-sensitive records, monthly for 10 specialist records and quarterly for 30 others. Owners are unassigned and monitoring is not automatically scheduled. Deduplicate shared sources and trigger a technical review immediately after relevant official, fiscal, product or reader-error changes. Do not auto-refresh a review date to make content appear checked.

For measurement, follow AUDIT.md. No live Search Console, analytics or paid attribution dataset was available. Do not claim signup uplift, market superiority or national ranking coverage from this source audit. A future implementation should use the existing consent mechanism, stable article slugs, declared attribution windows and server-confirmed payments. Do not send calculator values or personal/tax details into analytics. No new tracking was activated in this package.

Cursor/Toxel: compare with the newest repository before merging. Use INTEGRATION_FILES.json for changes from Competitive V3 and earlier integration lists for older baselines. Preserve newer unrelated code, real environment configuration and the original publication timestamp. Do not use old patches or replace the entire application blindly. Provide one integration branch and exact SHA. Build the all-120 overlay only in protected/noindex staging until the remaining editorial/tax/product/browser/customer-flow gates are completed. Do not invent service availability or turnaround promises to strengthen urgency.
