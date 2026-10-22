# TOXEL_RELEASE_HANDOVER — TaxSimba Landlord Hub V6

**Status: Technically ready for Toxel staging validation. Do not merge or deploy production until Toxel signs off the same SHA below.**

## Identity

| Field | Value |
|---|---|
| Integration branch | `cursor/taxsimba-v6-integration-df9b` |
| Integration PR | https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/31 |
| **Approved candidate SHA (full)** | `2b10fd2b12cfacde9aa8b80960ff4a800723361e` |
| Deployment base | `content/taxsimba-82-articles` @ `67e371a17d6b774bc5364a3b52ebd831ddeb873c` |
| Package source | Remote branch `taxsimba-v6-upload` (parts 01–06); **not** merged |
| Package ZIP | Size `113671918`; SHA-256 `95568877c054797b62d5654e0fb428822f7b92a4be48416fcdf3ce8e7c4e60fe` (**verified**) |
| Related content PR | #26 (120 articles / controlled publish) |
| part01 cleanup on main | https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/30 |
| Rollback target | Previous frontend image / `content/taxsimba-82-articles` @ `67e371a` |

Toxel must test and deploy **this exact SHA**. Do not deploy a different commit.

Later commits on this branch that only update `TOXEL_RELEASE_HANDOVER.md` do not change the deployable tree; if the branch tip differs, still deploy `2b10fd2b12cfacde9aa8b80960ff4a800723361e` unless a newer code commit is explicitly approved.

## Publication settings (controlled 120)

| Setting | Value / behaviour |
|---|---|
| Default public set (no publish env) | **38** live guides; **82** editorial drafts hidden |
| Release publish | `release:prepare` writes `.env.production.local` enabling all **120** guides |
| Env flags | `TAXSIMBA_*` + matching `NEXT_PUBLIC_*` via `articleReleaseConfig.js` |
| Published-at | `TAXSIMBA_EDITORIAL_PUBLISHED_AT` — reuse existing ISO timestamp if already set; otherwise prepare writes a stable not-in-future value |
| Draft readiness | Expanded draft readiness checks preserved from newer content work |
| Order on `/blogs` | Agreed first **20**, then remaining **100** (featured page limit 9 per page) |

Do **not** enable the 82 drafts in production without an intentional publish decision.

## Obsolete blocker (replaced)

Earlier handover claimed parts 02–06 were missing because only `main` was inspected. **Correction:** all six parts are on `origin/taxsimba-v6-upload`. Fresh retrieval via `git show` reconstructed and verified the ZIP successfully. The missing-parts blocker is withdrawn.

## What changed (intended)

- All 120 guides with agreed first-20 then remaining 100; artwork, downloads (120 checklists), calculators/tools, SEO metadata.
- New `/landlords` hub; focused `/rental-income-service` (annual SA) and `/rental-income-tax` (landlord MTD).
- Permanent redirect `/services/rental-income-tax-returns` → `/rental-income-service` (308); alias excluded from sitemap.
- Nav/footer/blog hub landlord links; 17 guide contextual return links; SA vs MTD signup paths kept separate (`/register` vs `/register?role=MTD`).
- Manifest deletion: `tax_simba_frontend/src/app/rental-income-tax/page.client.js`.
- Preserved newer repo fixes: `articleReleaseConfig.js` env helpers + expanded draft readiness; `FontClassWrapper` hydration guard; `eslint.config.mjs`.
- `/blogs` listing presentation refined to the agreed ivory-and-forest mockup (compact split hero, landlord strip, featured toolbar with search/filters, 3-column equal-height illustrated cards, 16:10 crops). Listing-only; article bodies and other surfaces unchanged.
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
| `/blogs` overflow at 320 / 390 / 768 / 1440 | PASS (0 px overflow) |
| `/blogs` CSS tokens (ivory hub, Georgia headings, sage strip) | PASS |
| `/blogs` images load; hero + cards ~16:10 (ratio 1.6) | PASS |
| `/blogs` search / filter / pagination | PASS |
| `/blogs` first-page order matches first-20 prefix | PASS |
| Screenshots | `/opt/cursor/artifacts/blogs_final_desktop_hero_two_rows.png`, `/opt/cursor/artifacts/blogs_final_mobile_first_three.png` (+ `/opt/cursor/artifacts/blogs-qa/`) |

### Failed

None on the automated + Playwright suite above.

### Soft / not claimed as formal pass

| Check | Note |
|---|---|
| Hub-scoped keyboard focus ring | Hub CSS focus styles present; automated Tab landed on global nav (yellow outline) — treat as soft; not a formal a11y certification |

### Untested / blocked by environment (do not claim as passed)

| Check | Reason |
|---|---|
| Configured test signup → package → dashboard → verification → payment/email → accountant assignment | No local/staging API (`:5001`/`:5000` unavailable); no Stripe test keys in this agent environment |
| Missing-UTR must not block onboarding/dashboard | Requires live backend + test account — **Toxel staging only** |
| Production indexability / staging noindex policy | Deployment-environment concern for Toxel |
| Full accessibility audit (axe/WCAG certification) | Keyboard tab + FAQ `<details>` on service pages exercised; not a formal a11y certification |
| Computer-use GUI agent | Unavailable (model usage limit); Playwright used instead |

Historical V5 browser evidence was **not** reused as a V6 pass.

## Deployment instructions

Frontend-only. No DB migration. **Do not deploy until Toxel signs off.**

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

### Rollback

Rollback = previous frontend image/commit (`content/taxsimba-82-articles` @ `67e371a` or prior production image). No database rollback.

## part01 on main

Confirmed accidental commit on `main` @ `7494dd2`. Cleanup PR #30 deletes it and adds ignore rules. Upload branch `taxsimba-v6-upload` retains the parts for reconstruction only — **do not merge that branch**.

## /blogs listing presentation

Scoped `/blogs` hub layout/styles match the agreed green-and-ivory visual reference:

- Compact split hero (serif H1 + lead; illustrated media ~16:10)
- Sage landlord strip with hub link
- Featured toolbar: filter tabs + pill search
- Three-column desktop / one-column mobile equal-height cards (image, title, category, “Read guide →”)
- No horizontal overflow at 320–1440

**Out of scope (reported, not changed):** global navbar redesign to mockup; new custom binders/mug lifestyle photograph (existing article artwork used for hero).

Article bodies, titles, slugs, first-20 order, artwork files, downloads, calculators, SEO metadata, service pages and signup behaviour unchanged.
