# TOXEL_RELEASE_HANDOVER — TaxSimba Landlord Hub V6

**Status: Technically ready for Toxel staging validation. Do not deploy production until Toxel signs off the same SHA below.**

## Identity

| Field | Value |
|---|---|
| Integration branch | `cursor/taxsimba-v6-integration-df9b` |
| Integration PR | https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/31 |
| **Approved candidate SHA** | `1cd29e8d1b3c158bf2ba89f9cb8059e4863208b9` |
| Deployment base | `content/taxsimba-82-articles` @ `67e371a17d6b774bc5364a3b52ebd831ddeb873c` |
| Package source | Remote branch `taxsimba-v6-upload` (parts 01–06); **not** merged |
| Package ZIP | Size `113671918`; SHA-256 `95568877c054797b62d5654e0fb428822f7b92a4be48416fcdf3ce8e7c4e60fe` (**verified**) |
| Related content PR | #26 (120 articles / controlled publish) |
| part01 cleanup on main | https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/30 |
| Rollback target | Previous frontend image / `content/taxsimba-82-articles` @ `67e371a` |

Toxel must test and deploy **this exact SHA**. Do not deploy a different commit.

Later commits on this branch that only update `TOXEL_RELEASE_HANDOVER.md` do not change the deployable tree; if the branch tip differs, still deploy `1cd29e8d1b3c158bf2ba89f9cb8059e4863208b9` unless a newer code commit is explicitly approved.

## Obsolete blocker (replaced)

Earlier handover claimed parts 02–06 were missing because only `main` was inspected. **Correction:** all six parts are on `origin/taxsimba-v6-upload`. Fresh retrieval via `git show` reconstructed and verified the ZIP successfully. The missing-parts blocker is withdrawn.

## What changed (intended)

- All 120 guides with agreed first-20 then remaining 100; artwork, downloads (120 checklists), calculators/tools, SEO metadata.
- New `/landlords` hub; focused `/rental-income-service` (annual SA) and `/rental-income-tax` (landlord MTD).
- Permanent redirect `/services/rental-income-tax-returns` → `/rental-income-service` (308); alias excluded from sitemap.
- Nav/footer/blog hub landlord links; 17 guide contextual return links; SA vs MTD signup paths kept separate (`/register` vs `/register?role=MTD`).
- Manifest deletion: `tax_simba_frontend/src/app/rental-income-tax/page.client.js`.
- Preserved newer repo fixes: `articleReleaseConfig.js` env helpers + expanded draft readiness; `FontClassWrapper` hydration guard; `eslint.config.mjs`.
- No upload-branch merge. No unrelated backend changes. No database migrations.
- Multipart binaries / reconstructed ZIP / `.env*` / build output excluded from the release tree.

## Checks

### Passed

| Check | Result |
|---|---|
| Fetch `taxsimba-v6-upload`; write parts 01–06 outside tree | PASS |
| ZIP size + SHA-256 | PASS |
| Safe extract to staging; INTEGRATION_FILES hashes | PASS |
| `npm ci` | PASS |
| `npm run verify:landlord-hub-v6` | PASS |
| `verify:articles` / `verify:article-fields` / `verify:complete-release` | PASS |
| `verify:priority20` … `verify:review-v5` | PASS |
| `npm run release:build` (prepare + premium verify + `next build`) | PASS — routes include `/landlords`, `/rental-income-service`, `/rental-income-tax` |
| Drafts hidden without publish env (38 public / 82 draft) | PASS |
| With release env: all **120** `/blogs/{slug}` → 200 | PASS |
| Sitemap: 120 blog URLs; landlords + both service pages present; alias absent | PASS |
| Alias redirect → `/rental-income-service` | PASS (308) |
| Sample downloads + article artwork HTTP 200 | PASS |
| Playwright desktop (1280) + mobile (390): hub, SA/MTD pages, nav, blogs search, guide return, tools/download, redirect | PASS |
| Screenshots | `/opt/cursor/artifacts/v6-qa/*.png` |

### Failed

None on the automated + Playwright suite above.

### Untested / blocked by environment

| Check | Reason |
|---|---|
| Configured test signup → package → dashboard → verification → payment/email → accountant assignment | No local/staging API (`:5001`/`:5000` unavailable); no Stripe test keys in this agent environment |
| Missing-UTR must not block onboarding/dashboard | Requires live backend + test account |
| Production indexability / staging noindex policy | Deployment-environment concern for Toxel |
| Full accessibility audit (axe/WCAG certification) | Keyboard tab + FAQ `<details>` on service pages exercised; not a formal a11y certification |
| Computer-use GUI agent | Unavailable (model usage limit); Playwright used instead |

Historical V5 browser evidence was **not** reused as a V6 pass.

## Deployment instructions

Frontend-only. No DB migration.

```bash
cd tax_simba_frontend
npm ci
# Keep an existing first-publication timestamp if already set; otherwise prepare writes one:
# export TAXSIMBA_EDITORIAL_PUBLISHED_AT=<ISO-not-in-future>
npm run release:build
npm run release:start
```

`release:prepare` writes `.env.production.local` enabling all 120 guides with a stable `TAXSIMBA_EDITORIAL_PUBLISHED_AT` (reuses existing value when present). Keep normal production API URL, reverse proxy and port configuration.

Smoke after deploy: `/landlords`, `/rental-income-service`, `/rental-income-tax`, `/blogs`, `/blogs/mtd-accountant-cost`, search/filter, alias redirect, `/sitemap.xml`, `/register`, `/pricing`, `/mtd-information`.

Rollback = previous frontend image/commit. No database rollback.

## part01 on main

Confirmed accidental commit on `main` @ `7494dd2`. Cleanup PR #30 deletes it and adds ignore rules. Upload branch `taxsimba-v6-upload` retains the parts for reconstruction only — **do not merge that branch**.
