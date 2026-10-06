# Toxel UAT full remediation — consolidated result

**Branch:** `cursor/toxsl-blockers-b01-b04-80a7`  
**Base PR:** #18 (update only; no new branch/PR)  
**Authoritative Toxel deploy HEAD:** tip of this branch / PR #18 (full SHA reported in handover + `PINNED_HEAD.txt` in the evidence bundle; do not use older pin commits that self-reference a prior tip)  
**Product revision tested (gap-close code):** `12c8930a993def839356a8e6d7e6dc5d4d7e6b1f` (G-009 links + J-003 admin logos + D1-014 amounts); prior journey core `7d92c997c2323dc0c67725c2fb6e3f91fdb6cd20`  
**Browser verification SHA (Playwright run):** `7fe42995e6ddbfe73903a57c4c10f155f4ecd6c0` (`gap_close_browser_20261006/tested_sha.txt`) — hosts still up; no product rebuild this handover turn  
**Status:** READY FOR TOXEL RETEST (Stripe TEST / staging scheduler / external inbox remain **BLOCKED**)  
**Attachment note:** `F-012_41ab.pdf` is now on disk (30 sampled frames — **not** the complete video). Combined colour PDF still missing. Raw `F-012.mp4` / `Toxel_Videos_04.zip` still missing.  
**Matrix (FAIL+PARTIAL=39):** LOCAL PASS **31** · BLOCKED **8** · UNVERIFIED **0** · FAIL **0**  
**Separate original BLOCKED:** F-012 / F-013 / F-014 → LOCAL PASS (product path); external inbox for F-012 email remains BLOCKED.

## ID mapping correction (mandatory)

| ID | Journey | Not sufficient |
|---|---|---|
| **F-008** | **SA** Admin calculation figures review (`GET /api/cases/:id/calculations` → total_income / taxable_income / tax_due on manage-tax **Self Assessment** panel `SaFiguresReviewPanel`) | MTD `MtdPeriodActionsPanel` alone does **not** establish F-008 PASS |
| **G-006 / G-007 / G-008 / H-010** | **MTD** period figures, admin publish → client `draft_ready`, external quarterly submission | Separate from F-008 |

## Attachment-access inventory

Base dir: `/home/ubuntu/.cursor/projects/workspace/uploads/` — every file below was opened on disk this session (size = bytes).

| Attachment | Bytes | Readable? | Role / notes |
|---|---:|---|---|
| `TOXEL_ORIGINAL_UAT_2964.txt` | 62596 | Yes | Master checklist text (238 unique IDs) |
| `528161_TAXSIMBASTAGINGUATPACKFORTOXEL2_02oct_4c79.odt` | 80640 | Yes | Locked pack ODT (extracted earlier) |
| `Toxel_UAT_Text_and_Index_b306.zip` | 22486 | Yes | `TOXEL_ORIGINAL_UAT.txt`, `EVIDENCE_INDEX.csv`, `README_CURSOR.txt` |
| `B-008_cb97.pdf` | 582902 | Yes | Defect/journey PDF — not continuous video |
| `B-011_3390.pdf` | 1126329 | Yes | Defect/journey PDF |
| `C-009_55ab.pdf` | 1294339 | Yes | Defect/journey PDF |
| `D-003_83f7.pdf` | 1432855 | Yes | Defect/journey PDF |
| `D-012_4b7b.pdf` | 813310 | Yes | Defect/journey PDF |
| `D1-001_7aee.pdf` | 513067 | Yes | Defect/journey PDF |
| `D1-002_0d68.pdf` | 307040 | Yes | Defect/journey PDF |
| `D1-004_26c4.pdf` | 275577 | Yes | Defect/journey PDF |
| `D1-005_d0e4.pdf` | 165091 | Yes | Defect/journey PDF |
| `F-004_626b.pdf` | 1413355 | Yes | Journey PDF |
| `F-010_clint_approve_draft_46e2.pdf` | 1328643 | Yes | Journey PDF |
| `G-0045678_08d6.pdf` | 1374589 | Yes | Journey PDF |
| `J-005_3405.pdf` | 1362436 | Yes | Journey PDF |
| `J-011_b138.pdf` | 681657 | Yes | Video-frame sample used for J-011 RCA |
| `mtd_retest_flow_2oct_2026_614a.pdf` | 1283379 | Yes | Retest flow PDF |
| `new_pull_e600.pdf` | 1561724 | Yes | Retest / pull PDF |
| `SA_registration_2_oct_2026_794e.pdf` | 762653 | Yes | SA registration PDF |
| `SA_tex_return_retesting_9ccc.pdf` | 1287648 | Yes | SA return retest PDF |
| `Toxel_Screenshots_Part_01_e0ac.pdf` | 1347881 | Yes | Screenshot archive |
| `Toxel_Screenshots_Part_02_d525.pdf` | 1815358 | Yes | Screenshot archive |
| `Toxel_Screenshots_Part_03_3397.pdf` | 1936021 | Yes | Screenshot archive |
| `Toxel_Screenshots_Part_04_da4a.pdf` | 1947707 | Yes | Screenshot archive |
| `Toxel_Screenshots_Part_05_9505.pdf` | 1810363 | Yes | Screenshot archive |
| `Toxel_Screenshots_Part_06_435c.pdf` | 1503818 | Yes | Screenshot archive |

**Not available / not claimed reviewed:** raw `.mp4` files (only PDF frame samples where uploaded), staging HAR, Stripe TEST live receipts, external Outlook/Gmail captures. Chat visibility alone is not filesystem proof.

### Inaccessible / missing from prior inventory (gap close) — reconfirmed this handover

| Item | Indexed? | On disk? | Classification | Maps to |
|---|---|---|---|---|
| `EVIDENCE_INDEX.csv` row for `2nd_oct_2026/F-012.mp4` in `Toxel_Videos_04.zip` (27053970 B, SHA256 `80a659cfbea41426ea4488ecb02e1cdc9ab9809ca21464be02a183a42fdb7bb7`) | Yes | Index only (inside `Toxel_UAT_Text_and_Index_b306.zip`) | **DUPLICATE metadata** — same inaccessible claim already inventoried; **not** video access | F-012 |
| `Toxel_Videos_04.zip` / `F-012.mp4` binary | Yes (index) | **No** — not in uploads | **MISSING evidence** | F-012 (tester path for F-013/F-014) |
| F-012 PDF frame sample (cf. `J-011_b138.pdf`) | No | **No** | **MISSING evidence** | F-012 |
| Combined colour PDF | No mention in ODT/`EVIDENCE_INDEX.csv` | **No** — not uploaded | **MISSING evidence** | Branding colour pack — cannot review |
| Prior `F012_COLOUR_PDF_INVENTORY.md` in gap-close artifacts | Agent-written | Yes | **DUPLICATE report** of inaccessibility (not substitute for binaries) | F-012 / colour |

**Access verdict:** Attached F-012 evidence is **not accessible for review**. Only the index metadata and prior “inaccessible” inventory notes are present. Combined colour PDF remains **not uploaded**.

## F-012–F-014 reconciliation vs current SA journey

Original tester outcome (all three): **BLOCKED / NOT TESTABLE** at **“Upload Tax Return Certificate”** — journey did not advance, so submitted status/email (F-012), final documents download (F-013), and full case history consistency (F-014) could not be verified. Cited evidence ref for F-012: `__F-012.mp4____`.

| ID | Original | Current SA product (preserved Tasks 1–8) | Handover status |
|---|---|---|---|
| **F-012** | BLOCKED — stuck at certificate upload; cannot verify Submitted status/email | Final certificate upload after external submission advances case **SUBMITTED → COMPLETED** (`backend-node/src/compat/documents.ts` upload-final-certificate + `saFinalCertificateJourney.test.ts`). Related **F-011** external submission is **LOCAL PASS**. | Product advance path preserved. **Original video still MISSING** — cannot re-review tester F-012.mp4. Submitted **email** proof still needs Mailpit local / external inbox (**external BLOCKED**). |
| **F-013** | BLOCKED — cannot reach completion/final-document download | Client `GET …/final-certificate` after staff upload; completion transition in same certificate journey | Product path preserved; original video MISSING |
| **F-014** | BLOCKED — cannot verify history through full journey | Certificate journey asserts status transitions + idempotent retry | Product path preserved; original video MISSING |

These three were **not** in the original 38 FAIL list (they were BLOCKED). They do **not** change the FAIL+PARTIAL matrix totals below. They remain **evidence-incomplete** for original-video sign-off until `Toxel_Videos_04.zip` / `F-012.mp4` (and optionally colour PDF) are uploaded.

## Environment blockers (keep for Toxel)

| Check | Status | Exact blocker |
|---|---|---|
| Stripe TEST checkout/webhooks | **BLOCKED** | `PAYMENT_PROVIDER=fake`; `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` empty |
| Staging scheduler | **BLOCKED** | No staging deploy of this tip; no `STAGING_URL` |
| External inbox (Outlook/Gmail) | **BLOCKED** | SMTP → Mailpit `127.0.0.1:1025` only |
| Fake payments / Mailpit / local reminder worker | **LOCAL / SIMULATED** | Available |

## Original pack baseline (from `TOXEL_ORIGINAL_UAT_2964.txt`)

- **238** unique Test IDs (239 rows if counting mid-line `B-003` embedding).
- Tester-marked Evidence Ref outcomes (parsed): **~73 PASS**, **38 FAIL** (incl. free-text **H-006**), **1 PARTIAL** (`D-014` Partially Verified), **5+ BLOCKED/NOT TESTABLE** (`F-012`–`F-014`, `G-010`, `G-011`), remainder blank/UNTESTED, plus process rows.

### Original FAIL list (38)

`B-002`, `B-003`, `B-004`, `C-004`, `D-001`, `D-006`, `D-015`, `D-016`, `D-017`, `D-018`, `D-021`, `D1-010`, `D1-014`, `E-002`, `E-003`, `F-001`, `F-002`, `F-003`, `F-005`, `F-008`, `F-009`, `F-011`, `G-006`, `G-007`, `G-008`, `G-009`, `H-006`, `H-007`, `H-010`, `I-004`, `I-006`, `I-010`, `J-003`, `J-005`, `J-007`, `J-008`, `J-009`, `J-011`

### Original PARTIAL list (1)

`D-014` (Apple Pay partially verified — option visible, E2E payment not completed)

## Reconciliation of every original FAIL / PARTIAL

Statuses used: **LOCAL PASS** | **FAIL** | **BLOCKED** | **UNVERIFIED** | **NOT CHECKED**

| ID | Original | Current | Basis |
|---|---|---|---|
| B-002 | FAIL | **LOCAL PASS** | Tasks 1–8 — registration intent does not auto-activate; preserved |
| B-003 | FAIL | **BLOCKED** | External inbox / branded email logo — Mailpit only |
| B-004 | FAIL | **BLOCKED** | Same — logo in real verification email |
| C-004 | FAIL | **LOCAL PASS** | Task 4 dual-service — preserved |
| D-001 | FAIL | **LOCAL PASS** | Task 5 SA pricing — preserved |
| D-006 | FAIL | **LOCAL PASS** | Task 6 Additional Work — preserved |
| D-014 | PARTIAL | **BLOCKED** | Stripe wallet eligibility / TEST config |
| D-015 | FAIL | **BLOCKED** | Google Pay — Stripe TEST |
| D-016 | FAIL | **BLOCKED** | Klarna — Stripe TEST |
| D-017 | FAIL | **BLOCKED** | Clearpay — Stripe TEST |
| D-018 | FAIL | **BLOCKED** | Saved card / Stripe TEST |
| D-021 | FAIL | **BLOCKED** | Stripe-hosted logo — Stripe TEST |
| D1-010 | FAIL | **LOCAL PASS** | Tasks 1–8 dynamic pricing cancel path — preserved |
| D1-014 | FAIL | **LOCAL PASS** | Live API + UI: upgrade tx `amount=30` (not sticker `upgradePrice=149`); `BillingHistoryUI` shows `£30.00`; evidence `gap_close_verify_20261006/` + `d1014_billing_amounts.png` |
| E-002 | FAIL | **LOCAL PASS** | Engagement letter shows client name + SA/MTD service lines (`engagement-client-name` / `engagement-service-line`); accept returns `serviceTypes`; browser `e002_engagement.png` |
| E-003 | FAIL | **LOCAL PASS** | Accept + status return timestamp/version; Profile wired; browser `e003_profile_acceptance.png` |
| F-001 | FAIL | **LOCAL PASS** | Tasks 1–8 SA open/continue — preserved |
| F-002 | FAIL | **LOCAL PASS** | **Product decision (B):** SA clients require onboarding questions. Reused engagement `submit-tax-info` wizard for SA (optional UTR, job role, employment + shared questions). Backend persists `sa_tax_info`; middleware gates SA until submitted; profile + admin manage-tax show answers. Missing UTR does not block dashboard. Docs: M-001 keeps `questionnaire/docs`; prior tester N/A note superseded. Evidence: `saSubmitTaxInfoF002.test.ts` + browser. |
| F-003 | FAIL | **LOCAL PASS** | Tasks 1–8 document upload — preserved |
| F-005 | FAIL | **LOCAL PASS** | Task 7 notification content/deep-link — preserved |
| **F-008** | FAIL | **LOCAL PASS** | **SA** calc API `total_income=42500.5` / `tax_due=4280.75`; browser `SaFiguresReviewPanel` on manage-tax (`f008_sa_figures_panel.png` + `f008_calculations_api.json`) |
| F-009 | FAIL | **LOCAL PASS** | Task 7 notification visibility — preserved |
| F-011 | FAIL | **LOCAL PASS** | Tasks 1–8 SA external submission — preserved |
| G-006 | FAIL | **LOCAL PASS** | Live API: manage-review approve → period `AWAITING_CLIENT_APPROVAL`, overview `draft_ready` |
| G-007 | FAIL | **LOCAL PASS** | Live API: client approve persists after G-006 publish |
| G-008 | FAIL | **LOCAL PASS** | Live API: `record-submission` on period; UI `MtdPeriodActionsPanel` |
| G-009 | FAIL | **LOCAL PASS** | Live API + Mailpit (`gap_close_verify_20261006/`); browser MTD dashboard + `?tab=notifications` + re-login PASS (`g009_*.png`, `g00x_mtd_dashboard.png`) after engagement + `submit-tax-info` gates |
| H-006 | FAIL | **LOCAL PASS** | Live Super Admin reveal API + browser SUPER_ADMIN `reveal-contact` on manage-tax (`h006_reveal.png`) |
| H-007 | FAIL | **LOCAL PASS** | Reason ≥10 chars; rejects trivial/repeated mash (`aaaaaaaaaa`); unit + live API |
| H-010 | FAIL | **LOCAL PASS** | Same MTD external submission panel/API as G-008 |
| I-004 | FAIL | **LOCAL PASS** | Task 7 — preserved |
| I-006 | FAIL | **LOCAL PASS** | Task 7 — preserved |
| I-010 | FAIL | **LOCAL PASS** | Task 7 — preserved |
| J-003 | FAIL | **LOCAL PASS** | Client `/images/logo.svg` + admin `/admin/images/logo/logo.svg` HTTP 200 and rendered (`j003_*.png`); admin auth/home paths fixed + assets added |
| J-005 | FAIL | **LOCAL PASS** | Task 8 safe HTML — preserved |
| J-007 | FAIL | **LOCAL PASS** | Task 7 — preserved (Mailpit) |
| J-008 | FAIL | **LOCAL PASS** | Task 7 — preserved (Mailpit) |
| J-009 | FAIL | **LOCAL PASS** | Task 7 overdue Admin+Super Admin, no client overdue email — preserved |
| J-011 | FAIL/NOT VERIFIABLE | **LOCAL PASS** (UX + no success-email policy) | Video RCA: upgrade at `READY_FOR_SUBMISSION`. UI disables upgrade CTA; checkout blocked while locked. **Stripe TEST still BLOCKED** for live Stripe payment proof of original error |

### Exact totals (original FAIL + PARTIAL only = 39)

| Status | Count | IDs |
|---|---|---|
| **LOCAL PASS** | **31** | B-002, C-004, D-001, D-006, D1-010, **D1-014**, E-002, E-003, F-001, **F-002**, F-003, F-005, **F-008**, F-009, F-011, G-006, G-007, G-008, **G-009**, H-006, H-007, H-010, I-004, I-006, I-010, **J-003**, J-005, J-007, J-008, J-009, J-011 |
| **FAIL** | **0** | — |
| **BLOCKED** | **8** | B-003, B-004, D-014, D-015, D-016, D-017, D-018, D-021 |
| **UNVERIFIED** | **0** | — |
| **NOT CHECKED** | **0** | — |
| **Sum** | **39** | 38 FAIL + 1 PARTIAL |

## Original BLOCKED / NOT TESTABLE (separate from FAIL+PARTIAL 39)

| ID | Original | Current | Basis |
|---|---|---|---|
| **F-012** | BLOCKED at certificate upload | **LOCAL PASS** (product path) | F-012.pdf 30 frames reviewed: defect was certificate modal at `ready_for_submission`. Fixed: advance requires External Submission panel first; certificate only after `final_submitted`/`SUBMITTED`. Journey test PASS; Mailpit submitted email = **LOCAL/SIMULATED**; external inbox still **BLOCKED**. PDF frames ≠ complete video. |
| **F-013** | BLOCKED | **LOCAL PASS** (product path) | Final certificate on `all-tax-returns` + enriched GET final-certificate; client download via My Documents / history. |
| **F-014** | BLOCKED | **LOCAL PASS** (product path) | Status transitions SUBMITTED→COMPLETED + reload assertions in `saFinalCertificateJourney.test.ts`. |
| G-010 / G-011 | BLOCKED/NOT TESTABLE | unchanged env | Outside this remediation focus |

## F-002 — product decision recorded

**Decision (B):** SA Self Assessment **requires** onboarding questionnaire (optional UTR, job role/employment, agreed shared questions). M-001 path `engagement → questionnaire/docs → …` is authoritative. Prior F-002 tester note (“questionnaire not applicable”) is superseded by this product decision.

Implementation: reuse engagement-letter tax-info wizard for SA; `POST /api/compat/client/submit-tax-info` accepts `SELF_ASSESSMENT`; persists `users.sa_tax_info`; `isTaxInfoSubmitted` includes SA; middleware gates SA until submitted; missing UTR never blocks dashboard.

## Newly changed journeys — verification evidence

Artifact dirs:
- `/opt/cursor/artifacts/full_remediation_verify_20261006_033025/` (prior live API)
- `/opt/cursor/artifacts/gap_close_verify_20261006/` (D1-014 + G-009 live API)
- `/opt/cursor/artifacts/gap_close_browser_20261006/` (Playwright screenshots + BROWSER_RESULTS.md)
- **Downloadable zip:** `/opt/cursor/artifacts/gap_close_evidence_bundle_20261006.zip`

| Journey | Evidence type | Result | Tested product SHA |
|---|---|---|---|
| **G-006 / G-007** | Live API publish → client approve | PASS | `7d92c997…` / tip |
| **G-008 / H-010** | Live API `record-submission` | PASS | `7d92c997…` / tip |
| **G-009** | Live API + Mailpit + browser MTD notifications tab + re-login | **PASS** | `12c8930a993def839356a8e6d7e6dc5d4d7e6b1f` |
| **F-008** | Live API calcs + browser `SaFiguresReviewPanel` (42500.5 / 4280.75) | PASS | `12c8930a…` (panel from `7d92c997…`) |
| **D1-014** | Live API amount=30 + billing UI £30.00 + refresh | PASS | `12c8930a…` |
| **J-003** | Client + admin logo HTTP 200 + screenshots | PASS | `12c8930a…` |
| **E-002 / E-003** | Live API + browser engagement/profile | PASS | tip |
| **H-006 / H-007** | Live API reveal + browser SUPER_ADMIN reveal control | **PASS** (UI+API) | tip |
| **J-011** | UI lock banner + API `locked=true` at READY_FOR_SUBMISSION | LOCAL PASS; Stripe TEST BLOCKED | tip |

Browser method: Playwright chromium (ComputerUse blocked — model usage quota). All 13 gap-close browser checks **PASS** (`BROWSER_RESULTS.md`).

## SHA authority

| Label | Full SHA | Meaning |
|---|---|---|
| **Authoritative Toxel deploy HEAD** | Tip of `cursor/toxsl-blockers-b01-b04-80a7` / PR #18 (`PINNED_HEAD.txt` in bundle + handover) | Docs-only tips after product do not change behaviour; deploy latest pushed tip |
| **Gap-close product commit (tested)** | `12c8930a993def839356a8e6d7e6dc5d4d7e6b1f` | G-009 `/mtd-dashboard` links, admin logo assets/paths, D1-014 charged amount UI + verify script |
| **Browser run SHA** | `7fe42995e6ddbfe73903a57c4c10f155f4ecd6c0` | Playwright 13/13 PASS against product at/after `12c8930…` |
| **Prior journey product core** | `7d92c997c2323dc0c67725c2fb6e3f91fdb6cd20` | F-008 SA panel + H-007 strengthen + G-006/J-011/E/H |

Toxel should deploy the **latest pushed tip** of `cursor/toxsl-blockers-b01-b04-80a7` / PR #18.

## Branding / visual

Diff for this remediation does **not** change brand colours, logos, themes, or global CSS. Changes are functional: manage-tax SA/MTD panels, reveal validation, engagement/profile acceptance display, upgrade lock UX. No unrelated visual redesign.

## Retest checklist (concise)

1. **SA:** buy → engagement (name+service) → docs → accountant calc → Admin manage-tax **SA figures panel** → approve → client → external submission.  
2. **MTD:** buy → assign → figures → Admin approve on manage-tax → client overview **Draft Ready** (not Assigned) → client approve → period record submission.  
3. **F-008:** confirm SA case shows calculation figures; MTD case shows MTD panel only.  
4. **Upgrade / J-011:** early-stage upgrade OK; `READY_FOR_SUBMISSION` → CTA disabled; no package/upgrade payment-success email; Stripe TEST when keys available.  
5. **Reveal:** Super Admin on manage-tax; short/trivial reasons rejected.  
6. Keep Stripe TEST / staging / external inbox **BLOCKED** until Toxel env ready.

## Status

**READY FOR TOXEL RETEST**

Journey-blocking G-006/G-007/G-008 and **SA F-008** addressed with live API evidence; Tasks 1–8 preserved. Stripe TEST, staging scheduler, and external inbox remain **BLOCKED**. Do not merge or deploy from this agent.
