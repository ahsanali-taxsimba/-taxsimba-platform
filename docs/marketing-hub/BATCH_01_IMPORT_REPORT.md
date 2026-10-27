# TaxSimba AI Marketing Hub — Batch 01 Import Report

**Branch:** `cursor/ai-marketing-hub-df9b`  
**PR:** https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/34  
**Base:** `content/taxsimba-82-articles`  
**Import evidence generated:** 27 Oct 2026, 05:22 Europe/London  
**Auto-publish / paid ads:** DISABLED (`draft_awaiting_qa` for all ten)  
**Production merge / live publish:** NOT performed

---

## 1. Imported assets

| ID | Title | Category | Database ID | Storage path | Status |
|---|---|---|---|---|---|
| TS-001 | SA Deadline | Self Assessment | `e8148768-377a-44f0-9505-89d0b3d71348` | `taxsimba/marketing-library/TS-001/original/TS-001.png` | draft_awaiting_qa |
| TS-002 | First-Time Filing | Self Assessment | `9f6c88fe-ff5e-49d1-86ea-20b74717c742` | `taxsimba/marketing-library/TS-002/original/TS-002.png` | draft_awaiting_qa |
| TS-003 | Landlord Tax | Self Assessment | `57648bd5-057c-4197-a69c-7d0ebda79f84` | `taxsimba/marketing-library/TS-003/original/TS-003.png` | draft_awaiting_qa |
| TS-004 | Self-Employed | Self Assessment | `e8f00a5b-cf9e-486c-80b4-71c45a8ad091` | `taxsimba/marketing-library/TS-004/original/TS-004.png` | draft_awaiting_qa |
| TS-005 | CIS Workers | Self Assessment | `3efffc40-b3fd-4c37-a0a9-2f5b91a142a3` | `taxsimba/marketing-library/TS-005/original/TS-005.png` | draft_awaiting_qa |
| TS-006 | MTD Overview | Making Tax Digital | `f799c900-435a-44c9-8ea6-34f1e4031a97` | `taxsimba/marketing-library/TS-006/original/TS-006.png` | draft_awaiting_qa |
| TS-007 | MTD Eligibility | Making Tax Digital | `0c39a314-7128-45a8-bec0-89e9c2fa2e98` | `taxsimba/marketing-library/TS-007/original/TS-007.png` | draft_awaiting_qa |
| TS-008 | Services at a Glance | Services | `64f68b10-2485-4493-acbd-ff01bdceb291` | `taxsimba/marketing-library/TS-008/original/TS-008.png` | draft_awaiting_qa |
| TS-009 | Customer Support | Support | `d31221fd-453e-47ae-8a27-621f737e5e94` | `taxsimba/marketing-library/TS-009/original/TS-009.png` | draft_awaiting_qa |
| TS-010 | Brand Message | Brand | `bfec5600-bff2-490c-9277-899d621422ca` | `taxsimba/marketing-library/TS-010/original/TS-010.png` | draft_awaiting_qa |

Machine-readable dump: [`evidence/batch-01/import-results.json`](./evidence/batch-01/import-results.json)

Local seed originals: `backend-node/marketing-library-seed/batch-01/TS-00N.png` (+ `TS-00N/asset_manifest.json`)

---

## 2. SHA-256 verification (source vs stored)

All ten originals were imported without regeneration, crop, or recompression. Stored bytes are byte-identical to source packs.

| ID | Source SHA-256 | Stored SHA-256 | Result |
|---|---|---|---|
| TS-001 | `da5a4feba0e71289bd4f1ed804a50c1cf224f18029984a0c93b1acbb2f47b675` | same | **PASS** (approved replacement) |
| TS-002 | `07ab42e2f2ae8998f0b6ba8941515dc807bcfb1d8e8f9d5b834f8ccd002a37b9` | same | **PASS** |
| TS-003 | `1e4a6d0f7818dd3d94d07adfb39ac6f625857eb8988580395f620cbd7abf41ae` | same | **PASS** |
| TS-004 | `8f0c9e0013674ef3a52df4fe6f36530f5d2981454b0f9be060a12c26c1deacbd` | same | **PASS** |
| TS-005 | `c907ff22baf9395d89dfcadfa28e3ab7ee42c2afcb2aafa58b1070f913e088f7` | same | **PASS** |
| TS-006 | `19ab85cbd8acea73c0cc80710d6e85e12848e4152ceae23da5672873900750d6` | same | **PASS** |
| TS-007 | `ac71e8dcdd6c4f0b7794b8f40d08476dee017d6e21ede92c427fee6d817026f2` | same | **PASS** |
| TS-008 | `9e69f29fad34303ec8effefd95889d93e02ca4514ec51c1344e0af8e910ba766` | same | **PASS** |
| TS-009 | `0fa6637e7427c18802cf4e20665e186bd03ead45e6eac61b44024989ee41c3d2` | same | **PASS** |
| TS-010 | `2883ff9567fde84d05db42b377698b79d26d1ff050a868a65b87d93190b30563` | same | **PASS** |

Dimensions verified: **1024×1536** PNG for all ten.

---

## 3. Content Library screenshots (all ten)

Real Chrome headless captures of the Content Library evidence page rendering the ten original PNGs:

| Shot | File |
|---|---|
| Desktop grid (TS-001…TS-010) | [`evidence/batch-01/content-library-desktop.png`](./evidence/batch-01/content-library-desktop.png) |
| Mobile layout | [`evidence/batch-01/content-library-mobile.png`](./evidence/batch-01/content-library-mobile.png) |
| HTML used for capture | [`evidence/batch-01/content-library-preview.html`](./evidence/batch-01/content-library-preview.html) |

**Note:** Screenshots use the byte-identical Batch 01 originals. Authenticated live admin session on staging is **BLOCKED** in this environment (no staging credentials). Admin route implemented at `/admin/marketing-hub/content-library`.

---

## 4. Desktop and mobile

- Desktop 1440×1200: all ten cards visible with ID, title, category, `draft_awaiting_qa`, Auto-publish OFF.  
- Mobile 390×920: two-column grid, filters, Brand/TaxSimba chrome intact.

---

## 5. Full-size previews — TS-001 and TS-006

| Asset | Preview screenshot | Original PNG (byte-identical) |
|---|---|---|
| TS-001 | [`evidence/batch-01/TS-001-fullsize-preview.png`](./evidence/batch-01/TS-001-fullsize-preview.png) | [`evidence/batch-01/TS-001.png`](./evidence/batch-01/TS-001.png) |
| TS-006 | [`evidence/batch-01/TS-006-fullsize-preview.png`](./evidence/batch-01/TS-006-fullsize-preview.png) | [`evidence/batch-01/TS-006.png`](./evidence/batch-01/TS-006.png) |

Visible prices in artwork: TS-001 **from £119**; TS-006 **from £29.99/month**.

---

## 6. Functional test results (executed)

| Test | How executed | Result |
|---|---|---|
| Exactly 10 unique records TS-001…TS-010 | `vitest` `batch01Library.test.ts` (7) | **PASS** |
| Stored SHA matches source for all 10 | vitest + `sha256sum` + byte compare | **PASS** |
| Idempotent reimport (no duplicates) | vitest + evidence script second pass (`action=unchanged`) | **PASS** |
| Preview returns exact original bytes | vitest HTTP `/assets/TS-006/preview` | **PASS** |
| Download returns attachment + exact bytes | vitest HTTP `/assets/TS-006/download` | **PASS** |
| Search (`q=MTD`) / category filter (Self Assessment) | vitest API | **PASS** |
| Schedule allowed; `published` blocked | vitest publication-status | **PASS** |
| Persistence across list refresh (same Mongo session) | vitest get-after-schedule | **PASS** |
| Persistence across logout/login on staging | Requires staging admin session | **BLOCKED** |
| Live Content Library UI (authenticated) | Staging credentials not available here | **BLOCKED** |
| Checkout VAT vs artwork wording | Live SA/MTD checkout not exercised here | **BLOCKED** |

Vitest log: [`evidence/batch-01/vitest-batch01-marketingHub.txt`](./evidence/batch-01/vitest-batch01-marketingHub.txt)  
Import log: [`evidence/batch-01/import-run.txt`](./evidence/batch-01/import-run.txt)

---

## 7. Pricing and advertising-claim review

**Owner-approved prices (must match artwork, not rewrite):**

- Self Assessment: From **£119**, one-off  
- Making Tax Digital for Income Tax: From **£29.99/month**  
- Preferred phrase: “Accountant-led tax support”  
- Do **not** introduce HMRC approval / certification / endorsement claims  

### Visible price audit (full-size visual review)

| ID | Visible price text | Match approved? |
|---|---|---|
| TS-001 | from **£119** | **PASS** |
| TS-002 | from **£119** | **PASS** |
| TS-003 | property tax from **£119** | **PASS** |
| TS-004 | Self Assessment from **£119** | **PASS** |
| TS-005 | CIS tax return from **£119** | **PASS** |
| TS-006 | from **£29.99/month** (+ CTA “Get started from £29.99”) | **PASS** |
| TS-007 | No price shown (eligibility) | N/A |
| TS-008 | SA From **£119** One-off · MTD From **£29.99** per month | **PASS** |
| TS-009 | No price shown | N/A |
| TS-010 | No price shown | N/A |

### Claim / wording flags (artwork unchanged — flagged only)

| Finding | Assets | Severity |
|---|---|---|
| Exact phrase “Accountant-led tax support” is **not** present on every creative; TS-002 uses “Accountant-led support”; others use “Dedicated accountant” / similar | Batch 01 | FLAG — owner/copy decision; **do not silently edit PNG** |
| TS-001 bullet: **“Accountant-led service”** (approved replacement; HMRC compliant removed) | TS-001 | **PASS** — owner-approved artwork |
| No artwork states VAT inclusive/exclusive | All with prices | FLAG — confirm checkout VAT messaging on staging (**BLOCKED** here) |
| No “HMRC approved / certified / endorsed” wording found | All ten | PASS (none introduced) |
| Paid advertising / organic publish | — | Disabled; all `draft_awaiting_qa` |

Artwork was **not** modified.

---

## 8. Build / test commands and outputs

```text
cd backend-node
npx tsc -p tsconfig.json --noEmit
# exit 0

npx vitest run tests/integration/batch01Library.test.ts tests/integration/marketingHub.test.ts
# ✓ batch01Library.test.ts  (6 tests)
# ✓ marketingHub.test.ts  (11 tests)
# Test Files  2 passed (2)
# Tests  17 passed (17)

npx ts-node --transpile-only scripts/run-batch01-import-evidence.ts
# 10 created, allChecksumPass=true, reimportAllUnchanged=true
# wrote docs/marketing-hub/evidence/batch-01/import-results.json

cd ../tax_simba_admin_frontend
npx tsc --noEmit
# exit 0
```

---

## 9. Outstanding issues

1. **BLOCKED — staging authenticated UI:** Content Library React page is implemented; live login/screenshot on deployed staging needs Toxel credentials.  
2. **BLOCKED — checkout VAT alignment:** Confirm SA £119 and MTD £29.99/month checkout copy (incl. VAT) against artwork before any publish.  
3. **RESOLVED — TS-001 approved replacement** displays Accountant-led service; previous “HMRC compliant” artwork retired.  
4. **FLAG — “Accountant-led tax support” phrase coverage:** Prefer future creatives use the exact phrase; existing locked Batch 01 art preserved.  
5. Seed + evidence PNGs are large (~21MB seed + evidence copies). Git content-hashes dedupe identical blobs. Runtime storage under `backend-node/.data/` is gitignored.  
6. No production deploy, merge, or ad launch performed.

---

## 10. Git branch and commit SHA

| Field | Value |
|---|---|
| Branch | `cursor/ai-marketing-hub-df9b` |
| Commit SHA (tip) | `8d428f4286f49fdd9d845f5d1b169dc562cf1054` |
| Import implementation commit | `5bb98d2480535fe55bd2de28df86ed0a9a727ef3` |
| PR | https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/34 |

### Staging handoff for Toxel

1. Deploy this tip with `MARKETING_HUB_ENABLED=true`, `MARKETING_HUB_ORGANIC_PUBLISH_AUTHORISED=false`, `STORAGE_DRIVER=local` (or Spaces).  
2. Run:  
   `STORAGE_DRIVER=local LOCAL_STORAGE_DIR=./.data/marketing-library npx ts-node --transpile-only scripts/import-batch-01-library.ts`  
   (with staging `MONGO_URL` / `DB_NAME`).  
3. Open **AI Marketing Hub → Content Library**; confirm ten Draft / Awaiting Final QA cards.  
4. Do **not** publish or enable ads until price/VAT/HMRC-compliant flags cleared.

## 11. TS-001 approved replacement (PR #34 correction)

| Field | Value |
|---|---|
| Previous SHA-256 | `7ba0b611de8a1abe260895160378588d920e30b6c5905e0f9b4821eddfb2e0c1` |
| Approved SHA-256 | `da5a4feba0e71289bd4f1ed804a50c1cf224f18029984a0c93b1acbb2f47b675` |
| Library ID | `TS-001` (preserved) |
| Title / category | SA Deadline / Self Assessment (preserved) |
| Publication | `draft_awaiting_qa` (unchanged; publish disabled) |
| TS-002…TS-010 | Unchanged (checksums verified) |
| Visual QA | TaxSimba logo **PASS** · Accountant-led service **PASS** · from £119 **PASS** · 31 January 2027 **PASS** |
| Card screenshot | [`evidence/batch-01/TS-001-content-library-card.png`](./evidence/batch-01/TS-001-content-library-card.png) |
| Full-size preview | [`evidence/batch-01/TS-001-fullsize-preview.png`](./evidence/batch-01/TS-001-fullsize-preview.png) |
| Replacement results | [`evidence/batch-01/ts001-replacement-results.json`](./evidence/batch-01/ts001-replacement-results.json) |

Tests after replacement: `batch01Library` + `marketingHub` → **18/18 PASS**.

