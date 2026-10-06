# UAT reconciliation — Tasks 1–8 on `cursor/toxsl-blockers-b01-b04-80a7`

**Branch tip:** `42e93c208771371948e32febeae6bcb3a48aa9d9` (docs tip; product fix tip for J-005 remains `a89c83f`)  
**PR:** https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/18  
**Generated:** 2026-10-06  
**Final Toxel handover SHA:** deferred (no deploy)  
**Staging / Stripe TEST / external inbox:** **BLOCKED** unless a row was actually tested there (none were)  
**J-011 original runtime error:** **UNVERIFIED**

Statuses used: **LOCAL PASS** | **FAIL** | **BLOCKED** | **UNVERIFIED** | **NOT CHECKED**

## Master table

| UAT ID | Original defect | Fix / task | Evidence reference | Tested SHA | Status |
|---|---|---|---|---|---|
| **B01** | MTD RECURRING checkout not subscription / dual entitlement drift | Task 1 — `toxslBlockersB01toB04` + payment mode | Vitest B01 in `backend-node/tests/integration/toxslBlockersB01toB04.test.ts`; e2e log `/opt/cursor/artifacts/toxsl-evidence-blockers-e2e-proof.log` | suite on branch (commit `603fc0a` lineage) | **LOCAL PASS** |
| **B02** | Draft email CTA wrong Admin path; draft gate | Task 1 — Admin FE CTA + Admin-only approve | Vitest B02 same suite | suite on branch | **LOCAL PASS** |
| **B03** | Assigned accountant missing / messaging isolation | Task 1 — all-tax-returns + message ACL | Vitest B03 same suite | suite on branch | **LOCAL PASS** |
| **B04** | SA upgrade does not update package / failed upgrade mutates | Task 1 — upgrade checkout preserve/update | Vitest B04 same suite | suite on branch | **LOCAL PASS** |
| **F-003 / F-004** | Client document request upload / certificate journey | Task 2 — upload + certificate advance | commits `ccfaa11`, `c673458`; preserved on branch | Task 2 lineage on branch | **LOCAL PASS** |
| **J-003 / J-004 / J-006** | Email branding (logo / CTA / legal links) | Task 3 — public HTTPS branding + Mailpit local proofs | `/opt/cursor/artifacts/task3-finalize-evidence/` + ZIP `…1a62adb….zip`; README | `1a62adbf2917b631389662d727ccb8b47653fbdb` | **LOCAL PASS** (Outlook/Gmail **BLOCKED**) |
| **C-004** | Same-account SA+MTD locked; Tax Tracker dual WIP leak | Task 4 — dual CTAs/switcher; SA-default tracker | `/opt/cursor/artifacts/task4_c004_evidence_with_builds.zip`; `docs/C004_RETEST_CHECKLIST.md` | `e62ee95970fe660726660e6c80dbe708c697176f` | **LOCAL PASS** (Stripe/staging **BLOCKED**) |
| **D-001** | SA upgrade amount clarity (sticker vs difference) | Task 5 — labelled target/credit/payable | `/opt/cursor/artifacts/task5_sa_upgrade_evidence_followup.zip`; `docs/T5_SA_UPGRADE_RETEST_CHECKLIST.md` | `0b5b57472d219a426c1d4cadb45fcfe09610724c` | **LOCAL PASS** (SIMULATED; Stripe **BLOCKED**) |
| **C-009** | Billing history missing upgrade-difference wording | Task 5 — billing description | same Task 5 ZIP / checklist | `0b5b57472d219a426c1d4cadb45fcfe09610724c` | **LOCAL PASS** (SIMULATED; Stripe **BLOCKED**) |
| **D-004 / D-005** | Super Admin pricing / agreed freeze | Task 5 — preserved | T5 checklist + packagePricingP0 | `0b5b57472d219a426c1d4cadb45fcfe09610724c` | **LOCAL PASS** |
| **J-011** | Original SA upgrade runtime error (Toxel) | Task 5 — **not reproduced**; preventive hardening only | T5 J-011 section; DEPLOY_SHA notes `J011_ORIGINAL=UNVERIFIED` | `0b5b57472d219a426c1d4cadb45fcfe09610724c` | **UNVERIFIED** (hardening LOCAL PASS SIMULATED) |
| **D-006** | Admin cannot create Additional Work request | Task 6 — mount `AdditionalWorkPanel` | `/opt/cursor/artifacts/task6_additional_work_evidence.zip`; `docs/T6_…CHECKLIST.md` | `2111ee4e2f00622a9c4960849360859ab7f22fe6` (checklist tip; ZIP tip `22c0ae30…`) | **LOCAL PASS** (SIMULATED; Stripe **BLOCKED**) |
| **D-007** | Client desc/amount wrong | Task 6 | same ZIP `finalize/api/d007_…` | same | **LOCAL PASS** |
| **D-008** | Request email + in-app notification | Task 6 | Mailpit + dashboard notify screenshots | same | **LOCAL PASS** (Mailpit; external inbox **BLOCKED**) |
| **D-009** | Resend/reminder outstanding | Task 6 | Mailpit reminder evidence | same | **LOCAL PASS** (Mailpit; external inbox **BLOCKED**) |
| **D-010** | Pay + receipt/status | Task 6 | reconcile INV-2026-0006 | same | **LOCAL PASS** (SIMULATED; Stripe **BLOCKED**) |
| **M-005** | Full AW journey | Task 6 | D-006→D-010 + `reconcile/` | same | **LOCAL PASS** (SIMULATED) |
| **J-007** | Notification content not openable; read persistence | Task 7 — link/url mirror + MTD Notifications | `/opt/cursor/artifacts/task7_notifications_reminders_evidence.zip`; **specific ID** `after/03b_specific_notification_id_read_persistence.json` | primary `8ff8211d0b0bb85d004a78bde90a8153ecb9dbd3`; specific-ID check tip `3a1c6074990f487cea20a0d30039eaffaa2ba9b3` | **LOCAL PASS** (Mailpit; staging/external **BLOCKED**) |
| **J-008** | Missing reminders (open task / awaiting info / awaiting approval) | Task 7 — reminder job + states | `api/j008_uat_states_verification.json` + Mailpit | `8ff8211d0b0bb85d004a78bde90a8153ecb9dbd3` | **LOCAL PASS** (Mailpit local; auto staging scheduler **BLOCKED**) |
| **J-009** | Overdue escalation to Admin/Super Admin; no client overdue email | Task 7 — §15.8 gate + `/admin/mtd` | `api/j009_recipient_rules.json`; Mailpit; bucket screenshot | `8ff8211d0b0bb85d004a78bde90a8153ecb9dbd3` | **LOCAL PASS** (Mailpit; staging/external **BLOCKED**) |
| **J-005** | Raw HTML in message content (`<p>dfgd<p>`) | Task 8 — allowlisted sanitize + SafeMessageBody | `/opt/cursor/artifacts/task8_j005_safe_message_html.zip` (+ preserved `…_a89c83f.zip`); `docs/T8_…CHECKLIST.md` | `a89c83fcc48bdb6f4d0d7654a3d28225c8f31994` | **LOCAL PASS** |

## Exact counts

| Status | Count | IDs |
|---|---:|---|
| **LOCAL PASS** | **24** | B01, B02, B03, B04, F-003, F-004, J-003, J-004, J-006, C-004, D-001, C-009, D-004, D-005, D-006, D-007, D-008, D-009, D-010, M-005, J-007, J-008, J-009, J-005 |
| **UNVERIFIED** | **1** | J-011 (original runtime error) |
| **FAIL** | **0** | — |
| **NOT CHECKED** | **0** | (within Tasks 1–8 scoped rows above) |
| **BLOCKED** (environment — not a product FAIL) | **N/A as product defect** | Staging, Stripe TEST, external inbox / Outlook-Gmail delivery remain **BLOCKED** for all payment/email rows that rely on them |

Notes on counting: J-003/J-004/J-006 counted as three LOCAL PASS rows (Task 3 pack). F-003 and F-004 counted separately. Environment **BLOCKED** is recorded per-row in the table notes but is **not** counted as a remaining product defect.

## Remaining actionable defects

| Item | Kind | Action |
|---|---|---|
| **J-011** original Toxel runtime error | **UNVERIFIED** | Needs staging/Stripe TEST reproduction before claiming fixed; local preventive hardening only |
| Staging acceptance for C-004 / D-001 / C-009 / D-006–D-010 / M-005 / J-007–J-009 | **BLOCKED** | Operator retest after deploy with Stripe TEST + real scheduler/inbox as applicable |
| External inbox (Task 3 branding, Task 6/7 emails) | **BLOCKED** | Outlook/Gmail / staging SMTP not exercised |
| Stripe TEST checkouts | **BLOCKED** | Empty Stripe keys in this environment |

**No open FAIL rows** on Tasks 1–8 product defects in this reconciliation.

## Task 7 — specific clicked notification ID (completed)

| Field | Value |
|---|---|
| Clicked ID | `d7a56591-e360-4cc7-81ee-68b4f9ff31bc` |
| Before | `read: false` |
| After click | `read: true` |
| After logout/login | `read: true` |
| Pass | **true** |
| Evidence | `task7_…/after/03b_specific_notification_id_read_persistence.json` (+ before/after PNGs) |
| ZIP | Updated in `/opt/cursor/artifacts/task7_notifications_reminders_evidence.zip` |

## Task 8 evidence verification

| Check | Result |
|---|---|
| `after/05_mtd_messages.png` on disk | **OK** — PNG 1440×3403, 737911 bytes, magic `89504e47…` |
| Same file in preserved ZIP `task8_j005_safe_message_html_preserved_a89c83f.zip` | **OK** |
| Analysis = accountant Chat (not notifications tab) | **OK** — `url: /mtd-dashboard`, `has_readable_dfgd: true`, `has_raw_p_tags_as_text: false`, XSS null |
| Other key files in ZIP | BEFORE PNG, SA AFTER, admin AFTER, `browser_verification.json` `"pass": true`, README, INDEX — all present |

Previews: files are valid PNGs on disk/ZIP. If the chat UI preview strip fails to render, use the filenames above and the analysis JSON; do not treat a UI preview failure as missing evidence.
