# TaxSimba Toxel admin frontend (P0 integration working copy)

Source of truth for structure: `origin/toxel-frontend-reference` zip
(`TaxSimba_Toxel_Frontend_GitHub_Reference.zip` → `tax_simba_admin_frontend/`).

This tree lives on `taxsimba-p0-integration` only. The `toxel-frontend-reference`
branch itself is **not** modified.

## P0 K.7 changes on this copy

- **S1:** `SUPER_ADMIN` is first-class (middleware, guards, hooks, sidebar, overview, reviews, notifications). Never collapsed to `ADMIN`.
- **S6 HIDE:** CMS/partners/tax-rates/api-keys/templates/fee/home-page nav entries hidden via `p0Hide`.
- FAQ management nav retained (S5).
- Point `NEXT_PUBLIC_API_URL` at Node compat base, e.g. `https://<host>/api/compat`.
