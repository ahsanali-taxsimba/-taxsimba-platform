# TaxSimba — Toxel Frontend GitHub Reference

This package contains a lightweight, **read-only reference copy** of the Toxel TaxSimba frontend source.

It contains:
- `tax_simba_frontend/` — Toxel client frontend source/config
- `tax_simba_admin_frontend/` — Toxel admin frontend source/config
- safe `.env.reference.example` files containing variable names only

Intentionally excluded:
- real `.env` / production secret values
- `node_modules`
- build/cache output
- large `public/` images/assets
- binaries and other files not needed for API/routing compatibility analysis

## GitHub placement

Create a branch named:

`toxel-frontend-reference`

Upload the **contents of this package** into a top-level folder:

`/toxel-frontend-reference/`

Recommended final layout:

```
/toxel-frontend-reference/
  README_REFERENCE.md
  tax_simba_frontend/
    src/
    package.json
    ...
  tax_simba_admin_frontend/
    src/
    package.json
    ...
```

Commit message:

`Add Toxel frontend reference for Node integration`

## Cursor instruction

Treat `origin/toxel-frontend-reference:/toxel-frontend-reference/` as the **read-only Toxel frontend source of truth**.

Treat `origin/node-only-production` as the **Node.js backend source of truth**.

Do not modify either source branch during comparison. Create implementation work only on the separate integration branch after the compatibility plan has been reviewed.
