# Toxel UAT full remediation — consolidated result

**Branch:** `cursor/toxsl-blockers-b01-b04-80a7`  
**Base PR:** #18  
**Final Toxel tip SHA:** `e08df065ea1e0ccf00d90f9aaf0e7087b902975a`  
**Previous tip (pre this remediation commit):** `780decd36c060b4bc7b66471e49f7478f00b2a05`  
**Product fix tip:**   
**Documentation-only commits after product tip:**  (counts/profile fields),  (SHA align)  
**Status:** READY FOR TOXEL RETEST (with documented env BLOCKED items)

## Evidence pack inventory (this run)

| Attachment | Readable? | Role |
|---|---|---|
| `TOXEL_ORIGINAL_UAT_2964.txt` | Yes | Master checklist (238 unique IDs) |
| `528161_…02oct_4c79.odt` | Yes (extracted) | Same locked pack |
| `Toxel_UAT_Text_and_Index_b306.zip` | Yes | Index + README + original txt |
| Defect PDFs (J-011, J-005, B-008, B-011, C-009, D-*, D1-*, F-*, G-*, SA/MTD retests, new_pull) | Yes (sampled frames) | Video frame samples — **not** continuous proof |
| `Toxel_Screenshots_Part_01…06` | Yes (present) | Screenshot archives |

Missing / not claimed reviewed: raw original `.mp4` video files (only sampled PDFs), staging HAR, Stripe TEST live receipts, external inbox captures.

## Environment blockers (honest)

| Check | Status | Exact blocker |
|---|---|---|
| Stripe TEST checkout/webhooks | **BLOCKED** | `PAYMENT_PROVIDER=fake`; `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` empty |
| Staging scheduler | **BLOCKED** | No staging deploy of this tip; no `STAGING_URL` |
| External inbox (Outlook/Gmail) | **BLOCKED** | SMTP → Mailpit `127.0.0.1:1025` only |
| Fake payments / Mailpit / local reminder worker | **LOCAL / SIMULATED** | Available |

## Original FAIL / PARTIAL / BLOCKED summary vs tip

Original pack: **38 FAIL**, **2 PARTIAL**, **9 BLOCKED**, **115 UNTESTED**, **73 PASS** (239 rows / 238 unique IDs).

### Journey-blocking fixes in this remediation

| ID | Original finding | Fix | Current result |
|---|---|---|---|
| **G-006 / G-007** | Admin approves MTD draft; client stays **Assigned** | Manage-tax approve publishes MTD period; case status synced; overview maps `draft_ready` | **LOCAL PASS** (`toxelG006MtdApprove` 3/3) |
| **G-008 / H-010** | No UI to record external MTD submission | `MtdPeriodActionsPanel` on manage-tax (period record-submission + figures) | **LOCAL PASS** (API + panel wired) |
| **F-008** | Admin no figures review view | Period figures shown on manage-tax MTD panel | **LOCAL PASS** (UI present) |
| **J-011** | Upgrade payment error; cannot verify no success email | Video root cause: lock at `READY_FOR_SUBMISSION`. UX: disable upgrade CTA when locked; no upgrade payment-success email already enforced | **LOCAL PASS** (lock UX + no-email code); Stripe TEST still **BLOCKED** |
| **E-002 / E-003** | Generic engagement; acceptance not in profile | Client/service lines on letter; acceptance status on Profile | **LOCAL PASS** (code) |
| **H-006 / H-007** | Reveal only on User List; any reason accepted | Reveal on manage-tax; reason ≥10 chars + non-trivial | **LOCAL PASS** (unit + admin tests) |

### Tasks 1–8 preserved (already LOCAL PASS)

B01–B04, F-001/F-003/F-004, C-004 (+ checklist), D-001/D-004/D-005/D-006–D-010, J-005, J-007/J-008/J-009, J-003/J-004/J-006 (Mailpit), D1-010, C-001 entitlement SoT, B-002 by-design registration intent.

### Still BLOCKED / out of local reach

| ID | Reason |
|---|---|
| D-014…D-018 wallets/BNPL/saved card | Stripe eligibility / TEST config |
| D-021 / B-003 / B-004 logo in Stripe/email | Staging branding assets + real inbox |
| A-006 / A-007 / A-009 | Staging Stripe + real email + scheduler |
| D1-006 / D1-008 / D1-009 | Renewal / schedule pending staging |
| F-012…F-014, G-010, G-011 | Were blocked by F-001 / period completion — retest after G/F fixes on staging |
| K / K1 / L / M / N / P / R sections | Mostly UNTESTED in original pack; not claimed retested here beyond prior Tasks 1–8 coverage |

## Retest checklist (concise)

**Setup:** backend-node + client `:3000` + admin `:3001` + Mongo + Mailpit; tip SHA below; fake payments OK for LOCAL; Stripe TEST keys required for payment acceptance.

1. **SA journey:** register → verify → buy SA → engagement → docs upload → accountant draft → Admin approve → client approve → record external submission → certificate.
2. **MTD journey:** buy MTD → assign → figures → Admin publish (manage-tax Approve Draft **or** period Publish) → client overview shows **Draft Ready** (not Assigned) → client approve → record external submission on period panel.
3. **Dual service (C-004):** same client ACTIVE SA+MTD; Tax Tracker SA-only.
4. **Upgrade (D-001 / J-011):** upgrade while case early-stage → difference amount; while `READY_FOR_SUBMISSION` → upgrade CTA disabled (no dead-end toast); confirm **no** package/upgrade payment-success email.
5. **Additional Work (D-006–010):** Admin create → client pay → receipt.
6. **Notifications (J-005/7/8/9):** safe HTML; deep-links; reminders LOCAL with `REMINDERS_ENABLED`; overdue Admin+Super Admin, no client overdue email.
7. **Engagement (E-002/3):** letter shows client + service; Profile shows acceptance timestamp/version.
8. **Reveal (H-006/7):** Super Admin reveal on manage-tax; short reasons rejected.

## Test / build counts (tip `e08df065ea1e0ccf00d90f9aaf0e7087b902975a` + docs follow-up)

| Suite | Result |
|---|---|
| toxelG006MtdApprove | 3/3 PASS |
| revealReason | 3/3 PASS |
| mtd | 19/19 PASS |
| admin | 18/18 PASS |
| saUpgradePricingTask5 | 13/13 PASS |
| toxslBlockersB01toB04 | 5/5 PASS |
| toxelC004DualService | 7/7 PASS |
| clientContractDto | 7/7 PASS |
| contactMasking | 4/4 PASS |
| additionalWorkTask6 | 6/6 PASS |
| email | 12/12 PASS |
| Backend `tsc --noEmit` | PASS |
| Client `npm run build` | PASS |
| Admin `npm run build` | PASS |

**Counts:** verified product LOCAL PASS rows from Tasks 1–8 plus G-006/G-007/G-008/F-008/J-011 UX/E-002/E-003/H-006/H-007 this tip. Stripe TEST / staging / external inbox remain **BLOCKED** (not counted as PASS).

## Status

**READY FOR TOXEL RETEST**

Reasons: journey-blocking G-006/G-007/G-008 and related UAT FAILs fixed and regression-tested; Tasks 1–8 preserved. Stripe TEST, staging scheduler, and external inbox remain BLOCKED for those specific acceptance checks — do not treat them as PASS.
