# TOXEL_RELEASE_HANDOVER — TaxSimba Landlord Hub V6

**Status: RELEASE CANDIDATE for Toxel review. Not approved. Do not merge or deploy production until Toxel signs off.**

## Identity

| Field | Value |
|---|---|
| Integration branch | `cursor/taxsimba-v6-integration-df9b` |
| Integration PR | https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/31 |
| **RELEASE CANDIDATE SHA (full)** | `PLACEHOLDER_CODE_SHA` |
| Label | **RELEASE CANDIDATE** (not approved) |
| Deployment base | `content/taxsimba-82-articles` @ `67e371a17d6b774bc5364a3b52ebd831ddeb873c` |
| Package source | Remote branch `taxsimba-v6-upload` (parts 01–06); **not** merged |
| Package ZIP | Size `113671918`; SHA-256 `95568877c054797b62d5654e0fb428822f7b92a4be48416fcdf3ce8e7c4e60fe` (**verified**) |
| Related content PR | #26 |
| part01 cleanup | PR #30 |
| Rollback target | Previous frontend image / `content/taxsimba-82-articles` @ `67e371a` |

## Publication settings (controlled 120)

| Setting | Value |
|---|---|
| Default (no publish env) | **38** public / **82** drafts hidden |
| Release publish | `release:prepare` → `.env.production.local` enables all **120** |
| Env flags | `TAXSIMBA_*` + `NEXT_PUBLIC_*` via `articleReleaseConfig.js` |
| Order on `/blogs` | First **20**, then remaining **100** (9 per page) |

## /blogs mockup implementation

**Reference:** attached Blog & Guides mockup **1169×769** px (scaled to 1536 for comparison).

### Assets (extracted from mockup — tracked in Git)

| Asset | Path |
|---|---|
| Hero books/mug/plant | `public/images/guide-hub/hero-still-life-{640,960,1600}.webp` (+ `.jpg`) |
| First six card illustrations | `public/images/guide-hub/cards/{slug}-{480,960,1440}.webp` for: `mtd-accountant-cost`, `self-assessment-accountant-cost`, `join-mtd-service-mid-year`, `switch-mtd-accountant-mid-year`, `mtd-quarterly-updates-tax-payments`, `self-assessment-2025-26-mtd-2026-27` |

Crop quality at display size: native card crops **313×133** → ~1.32× upscale to 414×172; hero ~1.2× — **acceptable, not blocked**. Production logo: `public/images/logo.svg` (not taken from mockup).

### Actual metrics @ 1536px

| Metric | Target | Actual |
|---|---|---|
| Content width | 1272px | **1272px** |
| Hero height | ~185px | **185px** |
| H1 | ~46px, one line | **46px**, 1 line |
| Landlord strip | ~75px | **79px** |
| Card image | ~414×172, 2.4:1 | **398×166**, ratio **2.398** |
| Column gap | ~24px | **1.5rem (24px)** |

### Screenshots

- Desktop 1536 (header + hero + strip + six cards): `/opt/cursor/artifacts/blogs_mockup_desktop_1536.png`
- Side-by-side vs reference @ 1536: `/opt/cursor/artifacts/blogs_mockup_compare_1536.png`
- Mobile hero + first three: `/opt/cursor/artifacts/blogs_mockup_mobile_hero_three.png`
- Mobile first three cards: `/opt/cursor/artifacts/blogs_mockup_mobile_first_three.png`

## Checks

### Passed

| Check | Result |
|---|---|
| `npm run release:build` | PASS |
| Overflow 320 / 390 / 768 / 1536 | PASS |
| Hero + first-six mockup assets HTTP 200 | PASS |
| Search / category filter / pagination | PASS |
| First-20 order on page 1 | PASS |
| Full titles preserved (wrap naturally) | PASS |

### Untested / not claimed

| Check | Reason |
|---|---|
| Signup → package → dashboard → payment / accountant assignment | No staging API/keys |
| Missing-UTR onboarding | Needs live backend |
| Formal a11y audit | Not run (keyboard tab exercised only lightly) |
| Exact pixel match to mockup | Not claimed — see remaining differences |

## Remaining visual differences (plain list)

1. Production header (promo bar, Home/Calculators/Login/Get Started) vs mockup nav (Services / Landlord tax help / Blog & Guides / Pricing / Get started).
2. Production TaxSimba logo mark vs mockup wordmark styling.
3. Full article titles (longer, wrapping) vs mockup shortened titles.
4. Cards 7–120 still use existing article illustrations (not mockup art).
5. Mockup calendar/binder labels left only in artwork — not copied into article tax guidance.
6. Minor spacing/type rendering differences vs the 1169px source bitmap when scaled.
7. Hero mug retains the crest present in the extracted mockup artwork (not redrawn).

## Deployment

**Do not deploy until Toxel approves.** Frontend-only; no DB migration.

```bash
cd tax_simba_frontend
npm ci
npm run release:build
npm run release:start
```

Rollback = previous frontend image / `content/taxsimba-82-articles` @ `67e371a`.
