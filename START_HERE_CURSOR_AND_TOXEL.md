> LATEST: Read README_LANDLORD_HUB_V6.md and release/hubs-v6/HANDOVER.md first. Earlier validation remains historical.

> LATEST HANDOVER: Read README_REVIEWED_V5.md and release/review-v5/REVIEW_HANDOVER.md first. Older readiness statements below are historical. V5 has bounded AI review and test evidence; it does not invent independent professional approval. Toxel must validate its actual deployment/customer-flow environment.

> CURRENT VERSION: Read README_QUALITY_V4.md and release/quality-v4 first. Older handover/publication statements below are superseded. Current status: integration and staging; qualified review and live validation remain open.

> CURRENT VERSION: Read README_COMPETITIVE_V3.md and release/competitive-v3 first. This older handover is retained for history; its deployment/approval wording is superseded. Current status: integration and staging, not production publication.

# TaxSimba Premium 120 — Cursor and Toxel handoff

This bundle contains one deployable frontend commit based on:

- repository: `ahsanali-taxsimba/-taxsimba-platform`
- base branch: `content/taxsimba-82-articles`
- base commit: `67e371a17d6b774bc5364a3b52ebd831ddeb873c`

## Cursor: integrate and push

1. Clone/fetch the repository and check out `content/taxsimba-82-articles` (or an integration branch that already contains that commit).
2. Fetch the bundle supplied beside this file:

   `git fetch ./TaxSimba_Premium_120.bundle content/taxsimba-premium-120:content/taxsimba-premium-120`

3. Fast-forward or merge `content/taxsimba-premium-120` into a new release branch.
4. In `tax_simba_frontend`, run `npm ci` and `npm run release:build`.
5. Push the release branch and give Toxel the exact commit SHA.

Do not cherry-pick this onto an older 38-article production branch. Integrate the 82-article content base first.

## Toxel: deploy

This is frontend-only. No database migration, backend change, payment change or customer-data operation is required.

- Build: `npm ci && npm run release:build`
- Start: `npm run release:start`
- Keep the normal production API URL, reverse proxy and port configuration.
- The release command creates `.env.production.local` with one stable first-publication timestamp and enables all 120 approved guides on server and client.

After deployment smoke-test `/blogs`, the first three priority cards, `/blogs/mtd-accountant-cost`, search/filter/pagination, `/sitemap.xml`, `/register`, `/pricing` and `/mtd-information`.

Rollback is the previous frontend image/commit. No database rollback is needed.
