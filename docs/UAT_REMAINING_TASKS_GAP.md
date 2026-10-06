# Remaining UAT requirements vs Tasks 1–8 (pre-handover)

**Branch:** `cursor/toxsl-blockers-b01-b04-80a7`  
**Generated:** 2026-10-06  
**Final Toxel handover SHA:** deferred (no deploy / merge / send)  
**Pack source note:** A complete original Toxel/Toxsl letter-dash UAT pack spreadsheet was **not found in-repo or in the agent transcript**. Inventory below is reconstructed from Tasks 1–8 prompts, Task 4 checklist IDs, `docs/UAT_TOXSL_IMPACT_MATRIX.md` (contract RC), and `docs/UAT_TRIAGE_MATRIX.md`.

## Exact environment blockers (this pass)

| Check | Available? | Exact blocker |
|---|---|---|
| Stripe TEST checkout | **No** | `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are **empty** in `backend-node/.env`; `PAYMENT_PROVIDER=fake` |
| Staging acceptance | **No** | `STAGING_URL` / `E2E_BASE_URL` unset; no staging deploy of this tip; no staging credentials in environment |
| External inbox (Outlook/Gmail) | **No** | `SMTP_HOST=127.0.0.1` / `SMTP_PORT=1025` → **Mailpit local only**; no external SMTP |

## Status legend

| Status | Meaning |
|---|---|
| LOCAL PASS | Verified locally (tests and/or UI/API evidence) |
| UNVERIFIED | Could not reproduce original defect; not claimed fixed |
| BLOCKED | Required access/config missing (see table above) |
| OMITTED FROM T1–8 | Known from contract RC / triage / Task 4 checklist naming but not a discrete Task 1–8 product fix row |
| NOT IN PACK SOURCE | ID never appeared in available pack/prompt sources |

---

## A. Tasks 1–8 scoped letter-dash / Toxsl blocker rows

| UAT ID | Requirement | Tasks 1–8 | Remaining status | Evidence / note |
|---|---|---|---|---|
| B01–B04 | Toxsl blockers (MTD checkout, draft approve, messaging ACL, SA upgrade package) | Task 1 | **LOCAL PASS** | vitest `toxslBlockersB01toB04` 5/5 this pass |
| F-003 / F-004 | Client document request upload / certificate | Task 2 | **LOCAL PASS** | prior Task 2 lineage preserved |
| J-003 / J-004 / J-006 | Email logo / CTA / legal links | Task 3 | **LOCAL PASS** (external inbox **BLOCKED**) | Mailpit local; Outlook/Gmail not available |
| C-004 | Same account SA+MTD; Tax Tracker SA-only WIP | Task 4 | **LOCAL PASS** (Stripe/staging **BLOCKED**) | vitest `toxelC004DualService` 7/7; prior ZIP |
| C-002 / C-003 | Registration intent not permanent lock | Task 4 checklist | **LOCAL PASS** | Covered by C-004 vitest intent cases |
| C-006 / C-007 | ACTIVE only after paid checkout | Task 4 checklist | **LOCAL PASS** (Stripe **BLOCKED**) | vitest cancel/unpaid; Stripe TEST blocked |
| C-008 | Service switcher / refresh / direct nav | Task 4 checklist | **LOCAL PASS** | prior Task 4 browser ZIP |
| C-009 | (Task 4: switcher) **and** (Task 5: billing amount clarity) | Task 4+5 | **LOCAL PASS** SIMULATED (Stripe **BLOCKED**) | ID reused with two meanings across prompts |
| M-003 | Missing UTR must not block dashboard | Task 4 checklist | **LOCAL PASS** | vitest unpaid/UTR; prior MTD dashboard screenshots |
| D-001 | Upgrade difference vs catalogue sticker | Task 5 | **LOCAL PASS** SIMULATED (Stripe **BLOCKED**) | vitest 13/13; proof re-run |
| D-004 / D-005 | Super Admin pricing / agreed freeze | Task 5 | **LOCAL PASS** | preserved + packagePricingP0 lineage |
| J-011 | Error during package/SA-upgrade payment flow | Task 5 | **UNVERIFIED** | Original steps absent beyond one-line symptom; not reproduced; hardening LOCAL PASS SIMULATED — see `/opt/cursor/artifacts/j011_investigation_proof_20261006_015906/` |
| D-006–D-010 / M-005 | Additional Work journey | Task 6 | **LOCAL PASS** SIMULATED/MAILPIT (Stripe/external **BLOCKED**) | prior Task 6 ZIP |
| J-007 / J-008 / J-009 | Notifications + reminders + overdue escalation | Task 7 | **LOCAL PASS** MAILPIT (staging/external **BLOCKED**) | prior Task 7 ZIP + specific-ID 03b |
| J-005 | Raw HTML in messages | Task 8 | **LOCAL PASS** | prior Task 8 ZIP |

### Counts (Tasks 1–8 product rows)

| Status | Count |
|---|---:|
| LOCAL PASS (product) | **24** discrete IDs as in `UAT_TASKS_1_8_RECONCILIATION.md` (+ Task 4 checklist C-002/C-003/C-006/C-007/C-008/M-003 already covered) |
| UNVERIFIED | **1** — J-011 |
| FAIL | **0** |
| Env BLOCKED dependencies | Stripe TEST, staging, external inbox |

---

## B. Contract RC Fail/Partial rows (`UAT_TOXSL_IMPACT_MATRIX`) not owned as Tasks 1–8 IDs

These were corrected on earlier contract RC work and **retested this pass** where automation exists:

| ID | Topic | This pass | Notes |
|---|---|---|---|
| F01–F05 | Upload / tracker / messages / docs / MTD download DTOs | **LOCAL PASS** | `clientContractDto` 7/7 |
| A03 | `/dashboard/profile` redirect | **LOCAL PASS** (code present) | `tax_simba_frontend/.../profile/page.js` redirect |
| A05 | Delete/deactivate → closure request | **OMITTED FROM T1–8** / prior Partial | Not reopened; no new FAIL found |
| A06 | Token console.log | **OMITTED FROM T1–8** | Prior static-guard lineage |
| P02 / P03 | MTD subscription mode / billing portal | **LOCAL PASS** API (`releaseAcceptanceApi` 6/6); Stripe **BLOCKED** | |
| N02 | Email CTA routes | **LOCAL PASS** | `assert-email-cta-journeys.mjs` OK |
| Phase 7/8 email footer + HMRC wording | Spot | **LOCAL PASS** static | `assert-no-direct-hmrc-claim.mjs` OK |

---

## C. Triage matrix items outside Tasks 1–8 scope

From `docs/UAT_TRIAGE_MATRIX.md` (INV01, PAG01, MOB01, MOB02, AGR01, COM01, EMAIL-CHANGE, A11Y, G05/G06, etc.): **OMITTED FROM T1–8**. Not treated as open Tasks 1–8 product FAILs. Several were already corrected on `toxel-uat-approved` RC; they remain out of this gap’s actionable fix set unless product reopens them.

---

## D. Actionable product fixes completed this pass

| Item | Result |
|---|---|
| New product code FAIL requiring a code fix | **None found** on Tasks 1–8 scope |
| J-011 original defect | Investigated; **remains UNVERIFIED** (no code change claiming fix) |
| Tasks 1–8 fixes | **Preserved** (no regressions in suites run) |

### Verification commands run this pass

```text
npx vitest run toxelC004DualService saUpgradePricingTask5 toxslBlockersB01toB04
# → 3 files / 25 tests PASS

npx vitest run clientContractDto releaseAcceptanceApi
# → 2 files / 13 tests PASS

node tax_simba_frontend/scripts/assert-email-cta-journeys.mjs  # OK
node tax_simba_frontend/scripts/assert-no-direct-hmrc-claim.mjs # OK

OUT_DIR=/opt/cursor/artifacts/j011_investigation_proof_20261006_015906 \
  npx ts-node --transpile-only scripts/task5SaUpgradeProof.ts
# → J-011 original NOT reproduced; SIMULATED upgrade paths OK
```

---

## E. Remaining actionable list (do before final handover)

1. **J-011** — obtain original Toxel repro (HAR/screenshot/stack) **or** reproduce on **Stripe TEST / staging**; until then keep **UNVERIFIED**.
2. **Stripe TEST** — supply non-empty `sk_test` + webhook secret; retest C-004, D-001/C-009, D-006–D-010/M-005 upgrade/AW checkouts.
3. **Staging deploy + acceptance** — deploy this tip; run `docs/C004_STAGING_ACCEPTANCE_HANDOFF.md` + Task 5/6/7 staging matrices; enable `REMINDERS_ENABLED` on exactly one instance for J-008/J-009 scheduler.
4. **External inbox** — configure real SMTP; re-check J-003/J-004/J-006 branding and Task 6/7 emails in Outlook/Gmail.
5. **Optional reopen** — contract RC A05 Partial / triage OMITTED rows only if product requests them in scope.

**No deploy. No merge. No final handover SHA. No send to Toxel.**
