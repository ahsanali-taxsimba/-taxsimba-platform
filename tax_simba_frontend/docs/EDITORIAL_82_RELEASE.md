# Editorial 82-article release checklist

## Current PR state (safe)

- All **82** new articles are intentional **drafts** (`status: "draft"`, `publishedAt: null`).
- Public hub, routes, sitemap and related cards expose only the existing **38** published guides.
- PR #26 must stay **draft** — do not merge or deploy until the blockers below are cleared.

## Controlled publish setting (deployment time)

Enable both environment variables in the deployment that should go live:

```bash
export TAXSIMBA_PUBLISH_EDITORIAL_DRAFTS=true
export TAXSIMBA_EDITORIAL_PUBLISHED_AT=2026-10-20T03:00:00.000Z
# Mirror for client bundles (inlined at build time):
export NEXT_PUBLIC_TAXSIMBA_PUBLISH_EDITORIAL_DRAFTS=true
export NEXT_PUBLIC_TAXSIMBA_EDITORIAL_PUBLISHED_AT=2026-10-20T03:00:00.000Z
# Real release timestamp — not backdated, and not in the future (future dates stay excluded).
npm run build && npm run start
npm run release:publish-editorial -- --verify
```

Helpers:

```bash
npm run release:publish-editorial -- --dry-run
npm run release:publish-editorial -- --at=2026-10-20T12:00:00.000Z --print-env
npm run verify:article-fields
npm run verify:articles
```

Source of truth for the switch: `src/data/articleReleaseConfig.js`.

## Merge order (hard blocker)

1. **Merge the existing 38-article SEO branch first**  
   `cursor/taxsimba-seo-cleanup-80a7` (PR #4 lineage) into the production base / updated `main`.  
   `main` today does **not** contain `tax_simba_frontend/`.
2. **Rebase** `content/taxsimba-82-articles` onto that updated `main` before final approval.
3. Only then enable the publish env vars in the target deployment and re-run verify.

## After publish — acceptance

- Exactly **120** public articles
- All **120** `/blogs/<slug>` routes return success
- All **120** published routes appear in `/sitemap.xml`
- `/blogs/mtd-accountant-cost` returns the full article
