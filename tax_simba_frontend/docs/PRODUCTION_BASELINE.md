# Live TaxSimba website — production baseline for PR #26

## Identified production source

Inspected on 20 October 2026:

| Signal | Finding |
|---|---|
| Live host | `https://taxsimba.co.uk` |
| Live `/sitemap.xml` blog URLs | **38** unique `/blogs/<slug>` entries |
| Live article UI | Classic `blog-header` (not compact) |
| Live article copy/metadata | Matches curated SEO registry (e.g. Reviewed 15 September 2026) |
| Staging deploy docs (`START_HERE_TOXEL.md`) | `taxsimba-p0-integration` — **not** the live marketing blogs (that tip only has 3 legacy `staticBlogs`) |
| Render blueprint (`render.yaml`) | Staging only → `node-only-production` |

**Exact production codebase for the live Blog & Guides content:**

- **Branch:** `cursor/taxsimba-seo-cleanup-80a7`
- **Commit:** `0d21a049a2d1f38e85f0d78d1e52b4b9610e293f`
- **Slug set:** identical to live sitemap (38/38)

`content/taxsimba-82-articles` is rebased onto that tip. The original 38 records are preserved verbatim; the 82 new records are slug-upserted additions only (no duplication of the live 38).
