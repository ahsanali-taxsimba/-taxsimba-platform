# TaxSimba Competitive Revision 3 — current handover

Status: tested source for integration and staging. Not cleared for direct production publication.

This continues Editorial V2. Preserve the agreed first 20, followed by the remaining 100. Keep all 120 stable URLs, the artwork and separate SA/MTD signup destinations. Do not rebuild the application or replace newer unrelated work.

## Changes in this revision

- Expanded all first 20 main bodies with concrete comparison, handover, reconciliation, escalation or filing-stage help.
- Added three interactive tools on five guides: full-cost quote comparison (two cost guides), corrected cumulative totals (two MTD guides), and a 60-day completion-date counter (property disposal guide). Inputs are local component state; the tools do not submit or save them. These are arithmetic aids, not eligibility or tax-liability calculators.
- Replaced the existing worked example in each of the other 100 guides with a specific preparation exercise and a question to resolve from real records. Replaced rather than appended to avoid duplicate example blocks.
- Improved all 120 free text worksheets with the corresponding exercise, evidence gaps, responsibility and next-check prompts.
- Added explicit CIS missing-statement postal steps, current close-company director details, named loss-relief routes and a transition-profit numerical schedule. Clarified the new-income-source quick answer; the existing body already explained delayed MTD timing and was retained without an extra duplicate section.
- Changed the visible source heading to Sources and further reading: provider price references are not official HMRC sources.
- Kept truthful reviewer fields and publication flags. No invented reviewer, customer story, human-authorship or market-leading endorsement.

## Validation

The full normal production build passed, including complete-release, priority20, guide-depth, editorial-v2, competitive-v3 and premium checks. Registry and article-field checks passed. The new test covers quote totals/VAT, invalid numbers, cumulative corrections, invalid calendar dates and leap-year date arithmetic, plus all 120 upgraded records/worksheets and specialist assertions.

The standalone HTTP pass checked all 120 article pages, one H1 per page, canonical URLs, metadata, parseable structured data, all 120 downloads, 360 responsive image responses and all 120 sitemap entries. Five tool panels and jump links were present in rendered HTML. Blog, signup, pricing and MTD routes returned 200.

No fresh browser interaction, mobile rendering, screen-reader or visual pass is claimed: Chromium download failed again. Arithmetic tests and server-rendered HTML are not equivalent to testing input interaction in a browser. Check the new tools at 320px, 390px and desktop in staging. Live signup, authentication, payment, email and backend delivery were not exercised. Build-time external fetching was blocked during verification. Next's existing lint/TypeScript skips remain; a build pass is not a lint/type-check pass.

## Cursor integration

1. Fetch the newest repository branch and compare it with the saved source before editing. The recovered complete120 source recorded commit d55d79c33646f59a416505a5140c993f09c6fc30; this ZIP is a subsequent local editorial revision, not a newly pushed commit.
2. Use release/competitive-v3/INTEGRATION_FILES.json for differences from Editorial V2 and the earlier integration list for changes from the recovered baseline. Preserve newer application logic and environment values. Do not apply old batch patches over this version.
3. In tax_simba_frontend run npm ci, npm run verify:competitive-v3, npm run verify:articles, npm run verify:article-fields and npm run build. Run staging with npm run release:start using the real environment configuration.
4. The normal build enables the explicit all-120 release overlay. Use it in protected/noindex staging for review. It is not approval to expose the batch publicly. Preserve the real first-publication timestamp rather than creating a new one on every build.
5. Give Toxel one integration branch and its exact committed SHA. No database migration or unrelated backend change is requested by this revision.

## Publication work still required

- A qualified reviewer must check relevant tax claims and record actual name, date and scope with consent. Current independentReviewStatus remains not-performed.
- Product-specific promises need evidence from the actual TaxSimba service: engagement scope, handover acceptance, authorisation steps and submission confirmations. Do not invent button labels or features from competitors.
- Complete the staging browser and live customer-flow checks above.
- Reassess competitor gaps on the final copy. The 120-topic initial review is evidence for improvement, not a completed independent superiority audit or guarantee of rankings. Reader testing and real professional attribution remain open.

The ZIP includes source and evidence, without installed dependencies, build output or production credentials. Historical release snapshots remain historical. release/competitive-v3/ALL_ARTICLES.json is the current reference export; do not mistake older exports for current copy.
