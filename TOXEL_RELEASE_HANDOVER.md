# TOXEL_RELEASE_HANDOVER — TaxSimba Landlord Hub V6

**Status: RELEASE CANDIDATE for Toxel review. Not approved. Do not merge or deploy production until Toxel signs off.**

## Identity

| Field | Value |
|---|---|
| Integration branch | `cursor/taxsimba-v6-integration-df9b` |
| Integration PR | https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/31 |
| **RELEASE CANDIDATE SHA (full)** | `fa2aca68eabe7a6ed5f2bde02f88fb092f584b53` |
| Label | **RELEASE CANDIDATE** (not approved) |
| Deployment base | `content/taxsimba-82-articles` @ `67e371a17d6b774bc5364a3b52ebd831ddeb873c` |
| Package source | Remote branch `taxsimba-v6-upload` (parts 01–06); **not** merged |
| Package ZIP | Size `113671918`; SHA-256 `95568877c054797b62d5654e0fb428822f7b92a4be48416fcdf3ce8e7c4e60fe` (**verified**) |
| Related content PR | #26 (120 articles / controlled publish) |
| part01 cleanup on main | https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/30 |
| Rollback target | Previous frontend image / `content/taxsimba-82-articles` @ `67e371a` |

Toxel must review **this exact SHA**. Do not deploy a different commit. Branch tip may include docs-only handover commits after the code SHA.

## Publication settings (controlled 120)

| Setting | Value / behaviour |
|---|---|
| Default public set (no publish env) | **38** live guides; **82** editorial drafts hidden |
| Release publish | `release:prepare` writes `.env.production.local` enabling all **120** guides |
| Env flags | `TAXSIMBA_*` + matching `NEXT_PUBLIC_*` via `articleReleaseConfig.js` |
| Published-at | `TAXSIMBA_EDITORIAL_PUBLISHED_AT` — reuse existing ISO timestamp if already set |
| Order on `/blogs` | Agreed first **20**, then remaining **100** (featured page limit 9 per page) |

## /blogs layout metrics @ 1536px (actual, after CSS match)

| Metric | Actual @ 1536 |
|---|---|
| Content shell width | **1280px** |
| Hero block height | **420px** (masthead pad 72/48 → mast **540px**) |
| H1 size / wrap | **64px**, **2 lines**, width ~567px |
| Landlord strip | pad **34px**, height **124px** |
| Card image ratio | **2.398 ≈ 2.4:1** (CSS `aspect-ratio: 2.4 / 1`) |
| Card media source | Existing **article illustrations** (no photographic listing override) |

CSS matches content width, hero scale, strip spacing and wide card crops. **CSS alone does not reproduce the mockup’s illustrated editorial artwork.**

## Artwork gap (exact — separate from layout)

| Item | Status |
|---|---|
| Hero books + **plain** mug + plant matching mockup art direction | Temporary still-life stand-in only (plain mug, no lion). **Approved mockup asset still required.** |
| Listing cards — illustrated editorial ~2.4:1 for **all 120** slugs | **0 present / 120 needed.** Repo has cartoon consultation series only. Prior photographic listing experiments were rejected as not matching the reference and are **not** applied; do **not** extend that style. |
| Production logo + working nav | **Kept** (reference nav not applied) |

See `tax_simba_frontend/src/data/guideHubListingArtwork.js` → `GUIDE_HUB_ARTWORK_GAP`.

## What changed (intended)

- V6 landlord hub + 120 guides, downloads, calculators, SEO, SA/MTD pages (prior integration preserved).
- `/blogs` layout CSS tuned to reference metrics at 1536px: 1280px shell, taller hero, 2-line headline, strip spacing, **2.4:1** card images.
- Hero mug: plain (no invented lion branding).
- Photographic listing overrides removed from the render path; cards use existing article artwork cropped to 2.4:1 until illustrated assets arrive.
- Article content, titles, first-20 order, URLs, SEO, calculators, downloads, publication controls, service pages, signup links unchanged.

## Checks

### Passed

| Check | Result |
|---|---|
| Package ZIP size + SHA-256 | PASS |
| `npm run release:build` | PASS |
| Overflow 320 / 390 / 768 / 1536 | PASS |
| Search / filter / pagination | PASS |
| First-20 order on page 1 | PASS |
| Card ratio ~2.4:1 @ 1536 | PASS |
| Screenshots | `blogs_rc_desktop_1536.png`, `blogs_rc_compare_1536.png` (reference \| actual), `blogs_rc_mobile_first_three.png` |

### Untested / blocked (do not claim passed)

| Check | Reason |
|---|---|
| Signup → package → dashboard → verification → payment/email → accountant assignment | No staging API/keys |
| Missing-UTR must not block onboarding/dashboard | Needs live backend |
| Formal a11y certification | Not run |
| Pixel-perfect artwork match to mockup | Blocked on missing illustrated assets above |

## Deployment

**Do not deploy until Toxel approves.** Frontend-only; no DB migration.

```bash
cd tax_simba_frontend
npm ci
npm run release:build
npm run release:start
```

Rollback = previous frontend image / `content/taxsimba-82-articles` @ `67e371a`.
