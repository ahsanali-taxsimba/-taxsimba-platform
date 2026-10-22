# Cursor and Toxel — one release

Use the supplied self-contained TaxSimba_Premium_120.bundle. It contains the earlier content base and the repaired frontend commit. Do not use the older prerequisite-only bundle.

## Cursor

For an existing checkout:

```bash
git fetch /absolute/path/TaxSimba_Premium_120.bundle content/taxsimba-premium-120-repaired:content/taxsimba-premium-120-repaired
git switch content/taxsimba-premium-120-repaired
```

Review the release against the current deployment branch, then integrate it on one release branch. This branch contains the original 38 and the added 82; do not re-import drafts through the CMS or regenerate slugs. If the target branch contains later work, merge that work and resolve conflicts instead of overwriting it.

For an independent inspection checkout, no existing repository is required:

```bash
git clone -b content/taxsimba-premium-120-repaired /absolute/path/TaxSimba_Premium_120.bundle taxsimba-release
```

In tax_simba_frontend:

```bash
npm ci
npm run release:build
npm run release:start
```

The release build enables the 82 draft overlays on both server and client, preserving original publication dates for the existing 38. Keep the production API, proxy, environment and port settings. No database migration is required by this frontend repair.

Before the real first publication, set TAXSIMBA_EDITORIAL_PUBLISHED_AT to the actual publication timestamp (ISO 8601, at or before deployment). Persist this same value in deployment configuration for every future clean CI build; otherwise a fresh workspace defaults to a new build-time timestamp. Do not use the local verification build timestamp as evidence of public publication. The preparation script sets the matching NEXT_PUBLIC value. Rebuild when changing public configuration.

After staging checks in REPAIR_NOTES.md, Cursor pushes the reviewed release branch and gives Toxel the exact final commit SHA. Toxel deploys that SHA using the existing production environment. Revert to the previous frontend image/commit for rollback.

Keep the official logo, all existing slugs, source links, internal links, full article pages and signup journeys. Do not replace the frontend wholesale on a newer deployment branch without reviewing the merge.
