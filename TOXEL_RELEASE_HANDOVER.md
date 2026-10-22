# TOXEL_RELEASE_HANDOVER — TaxSimba Landlord Hub V6

**Status: BLOCKED — package verification failed. Do not deploy.**

## Identity

| Field | Value |
|---|---|
| Integration branch | `cursor/taxsimba-v6-integration-df9b` |
| Integration PR | https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/31 (draft, blocked) |
| Handover commit on integration branch | `e9fa5e6a8959f0283338655a90e191774fd45920` (docs only — not a deployable V6 SHA) |
| Intended deployment base | `content/taxsimba-82-articles` @ `67e371a17d6b774bc5364a3b52ebd831ddeb873c` |
| Live SEO / 38-article base | `cursor/taxsimba-seo-cleanup-80a7` (PR #4 / production candidate) |
| Related content PR | #26 `content/taxsimba-82-articles` → `cursor/taxsimba-seo-cleanup-80a7` (120 articles, controlled publish) |
| Cleanup PR (part01 on main) | https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/30 (`cursor/remove-taxsimba-v6-part01-df9b` → `main`) |
| Exact approved integration SHA | **none** — V6 source files not available |
| Rollback target if anything were deployed | previous frontend image / `content/taxsimba-82-articles` @ `67e371a` |

Toxel must test and deploy the same approved SHA. No approved SHA exists until parts 02–06 are supplied and verification passes.

## Package reconstruction (step 1) — FAILED

Required multipart reconstruction outside the repository:

1. `TaxSimba_V6.part01.bin`
2. `TaxSimba_V6.part02.bin`
3. `TaxSimba_V6.part03.bin`
4. `TaxSimba_V6.part04.bin`
5. `TaxSimba_V6.part05.bin`
6. `TaxSimba_V6.part06.bin`

Expected after `cat` in order:

- Size: `113671918` bytes
- SHA-256: `95568877c054797b62d5654e0fb428822f7b92a4be48416fcdf3ce8e7c4e60fe`

### What was found

| Part | Location | Size |
|---|---|---|
| part01 | Accidentally committed to `main` @ `7494dd2` (“Upload complete TaxSimba V6 package”) | 20,000,000 bytes |
| part02–part06 | **Not found** in uploads, agent attachments, or any git branch | missing |

### Verification result

- Concatenation cannot be completed.
- Expected hash/size cannot be verified.
- Per instructions: **stopped**. No full extract into a staging directory as a verified V6 tree.
- Partial recovery from part01 alone (ZIP local headers / `zip -FF`) recovered early docs and many article assets, then failed with CRC error on later compressed members. **This is not a verified V6 package.**

Critical integration sources listed in `release/hubs-v6/INTEGRATION_FILES.json` that are **missing** from the partial extract (present only in package SHA inventory):

- `tax_simba_frontend/scripts/dev.mjs`
- `tax_simba_frontend/scripts/verify-landlord-hub-v6.mjs`
- `tax_simba_frontend/src/data/landlordJourney.js`
- `tax_simba_frontend/src/app/common.css`
- `tax_simba_frontend/src/components/navbar.js`
- `tax_simba_frontend/src/components/footer.js`
- `tax_simba_frontend/src/app/landlords/page.js`
- `tax_simba_frontend/src/app/rental-income-service/page.js`
- `tax_simba_frontend/src/app/rental-income-tax/page.js`
- `tax_simba_frontend/src/app/blogs/page.client.js`
- `tax_simba_frontend/src/app/blogs/[slug]/page.client.js`
- `tax_simba_frontend/src/app/sitemap.xml/route.js`
- `tax_simba_frontend/src/components/landlords/LandlordPages.jsx`
- `tax_simba_frontend/src/components/landlords/Landlords.module.css`

Deletion manifest target (not applied): `tax_simba_frontend/src/app/rental-income-tax/page.client.js`

## Compare / mapping notes (from recoverable docs only)

- Package docs say base = `content/taxsimba-82-articles` @ `67e371a` — matches current content branch tip used for PR #26.
- V6 extends Reviewed V5 with `/landlords`, focused `/rental-income-service` (annual SA) and `/rental-income-tax` (landlord MTD), redirect from `/services/rental-income-tax-returns`, nav/footer/blog links, 17 guide return links, sitemap exclusion for the alias.
- Preserve: newer repo fixes, env settings, original publication timestamp / controlled publish flags from PR #26 (`articleReleaseConfig.js`).
- Map packaged `tax_simba_frontend/` → repository `tax_simba_frontend/` (do not create a second app under `frontend/`).
- Keep SA and MTD journeys separate. No unrelated backend / DB migrations.
- Do **not** merge the main upload commit (`7494dd2`) into the integration branch.

## Checks

| Check | Result |
|---|---|
| Reconstruct ZIP size/SHA-256 | **FAILED** — parts 02–06 missing |
| Safe full extract to staging | **FAILED** — blocked by verification |
| `npm ci` / `verify:landlord-hub-v6` / production build | **UNTESTED** — V6 sources unavailable |
| Fresh mobile/desktop browser QA (hub, SA/MTD pages, a11y, links, downloads, calculators, search/filter, FAQs, redirect, sitemap) | **UNTESTED** — no V6 candidate build |
| Historical V5 evidence reused as V6 pass | **Not done** (correctly avoided) |
| Signup / package / dashboard / verification / payment / email / accountant assignment | **UNTESTED** — no staging access attempted; blocked upstream |
| Missing-UTR must not block onboarding/dashboard | **UNTESTED** |
| Binary parts / reconstructed ZIP / secrets / build output excluded from release tree | **PASS** for this branch (no parts committed here); cleanup PR removes part01 from main |

## Blockers

1. **Hard blocker:** Supply `TaxSimba_V6.part02.bin` … `TaxSimba_V6.part06.bin` (and re-confirm part01) so the ZIP can be reconstructed outside the repo and SHA-256-verified.
2. After verification: integrate per `INTEGRATION_FILES.json` / `DELETED_FILES.json` onto a fresh branch from `content/taxsimba-82-articles`, preserve PR #26 release config and publication timestamp, run documented verify + build + fresh browser/customer-flow checks, then replace this handover with the approved SHA.

## Deployment instructions (when unblocked)

1. Reconstruct ZIP outside repo; verify size + SHA-256; extract to staging.
2. Integrate only manifest files into `tax_simba_frontend` on a branch from `content/taxsimba-82-articles` (after PR #26 base is agreed).
3. `cd tax_simba_frontend && npm ci && npm run verify:landlord-hub-v6 && npm run build` (or `release:build` / `release:start` per package docs).
4. Fresh V6 browser + customer-flow QA on the candidate environment.
5. Deploy **only** the approved commit SHA recorded in an updated copy of this file.
6. Rollback = previous frontend image/commit; no DB rollback.

## part01 on main

- Confirmed: `TaxSimba_V6.part01.bin` (20 MB, ZIP magic `PK`) is on `origin/main` at `7494dd2`.
- Cleanup branch pushed: `cursor/remove-taxsimba-v6-part01-df9b` (deletes the binary; adds ignore rules). No history rewrite / no force-push.

## Request to package owner

Please attach or otherwise deliver parts **02–06** (and confirm part01 matches the multipart set). Preferred: upload all six `.bin` files to this agent chat, or place them where the agent can read them **outside** git. Do not commit the reconstructed ZIP or remaining parts to `main`.
