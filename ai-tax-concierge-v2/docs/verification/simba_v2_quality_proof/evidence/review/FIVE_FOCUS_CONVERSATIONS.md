# Five representative deep conversations — detailed review

**Source:** existing live OpenAI transcripts in `evidence/deep20/` (unedited).  
**Readable full text:** `deep20/D01.md` … `D10.md`.  
**Environment:** local cloud-agent API (`llm_mode=openai`), not staging, not a physical customer device.

---

## 1. D01 — First-time Self Assessment customer

**Outcome class:** Customer guided to appropriate signup  
**Tax status:** Independently verified for the £8k / £1k SA rule (post-fix); broader wording still for Asim

| Question | Assessment |
|----------|------------|
| Was the first answer correct? | **Mostly.** Opening turn correctly flagged the £1,000 sole-trader trigger. Slight tax-year framing risk (mentioned 2026-27 while customer later used 2025-26). |
| Understand & remember circumstances? | **Yes after fix.** PAYE + £8,000 freelance 2025-26 retained; follow-up SA question reused £8,000. |
| Follow-ups useful? | **Mixed.** Useful income probe early; later “expanding freelance?” style prompts are soft. |
| Correct next steps? | **Yes** for registration obligation + optional SA Simple + register URL / onboarding steps. |
| Package too early? | **No.** Package only after customer asked which SA package fits. |
| Final outcome helpful? | **Yes** — obligation clear, optional paid help, signup path, respectful close. |
| What would improve? | Pin tax year consistently; on “what’s included?” avoid dumping the full catalogue (QP-004); shorter answer when asked only for the registration link. |

**Critical check:** £8,000 treated as **above** £1,000 (not below trading allowance). Covered by `tests/sa_eligibility.test.ts` + `tests/threshold_comparison_regressions.test.ts`.

---

## 2. D02 — Landlord with PAYE employment

**Outcome class:** Customer requires further clarification  
**Tax status:** AWAITING ACCOUNTANT REVIEW (property + MTD band language)

| Question | Assessment |
|----------|------------|
| Was the first answer correct? | **Yes** — PAYE alone does not remove SA if other untaxed income exists; asked about other income. |
| Understand & remember? | **Yes** — retained buy-to-let £18,000 rent 2024-25 and PAYE employment. |
| Follow-ups useful? | **Yes** — natural path from employment → property → SA → MTD. |
| Correct next steps? | **Mostly.** SA for rental income is right. MTD explanation for £18k / under £50k in 2024-25 is directionally right (not in April 2026 £50k band) but wording about “2026-27 / £20k / April 2028” needs Asim confirmation of clarity. |
| Package too early? | **No** — customer said “do not recommend a package yet”; no cards. |
| Final outcome helpful? | **Partially** — obligations explained; conversation paused without a crisp “you’re done” summary. |
| What would improve? | One short summary of SA yes / MTD not yet for stated figures; avoid repeating MTD URLs three times. |

---

## 3. D03 — Sole trader approaching MTD

**Outcome class:** Customer guided to appropriate signup  
**Tax status:** AWAITING ACCOUNTANT REVIEW (live transcript); **memory defect noted**

| Question | Assessment |
|----------|------------|
| Was the first answer correct? | **Adequate** — sole trader → SA; MTD foreshadowed. |
| Understand & remember? | **Fail on one turn.** After customer stated ~£52,000 turnover for 2024-25 (and SIMBA correctly said MTD from 6 April 2026), the next ask “Do I need Making Tax Digital from April 2026?” **re-asked for amount/year** (lost context). |
| Follow-ups useful? | Turnover vs profit and PAYE exclusion answers were **correct and useful**. |
| Correct next steps? | **Yes** once figures applied: >£50k in 2024-25 → 6 April 2026; Xero included on Simbian. |
| Package too early? | **No** — software/MTD help discussed after tax answer. |
| Final outcome helpful? | **Mostly**, undermined by the forgotten figure. |
| What would improve? | History-aware MTD eligibility (fix landed in this pass: `answerMtdEligibility(message, history)` + regressions). Re-run D03 after deploy to evidence. |

---

## 4. D06 — Customer who does not need a paid service

**Outcome class:** Question answered, no purchase necessary  
**Tax status:** AWAITING ACCOUNTANT REVIEW (PAYE-only caveats)

| Question | Assessment |
|----------|------------|
| Was the first answer correct? | **Directionally yes** — PAYE-only usually no SA; points to GOV.UK. |
| Understand & remember? | **Yes** — later SA question recalled PAYE-only. |
| Follow-ups useful? | Light; offered further questions without pressure. |
| Correct next steps? | **Yes** — check GOV.UK if circumstances change; no signup push. |
| Package too early? | **No** — zero packages throughout (sales-pressure score 9). |
| Final outcome helpful? | **Yes** — information-only journey resolved without purchase. |
| What would improve? | Explicitly list common *other* SA triggers in one short bullet list so PAYE-only isn’t over-simplified. |

---

## 5. D10 — Customer who needs help signing up

**Outcome class:** Customer guided to appropriate signup  
**Tax status:** Commercial path OK; tax content light

| Question | Assessment |
|----------|------------|
| Was the first answer correct? | **Weak commercially.** Customer said they already know they need SA help — SIMBA immediately recommended Simple £119 **without** confirming complexity (premature package verbal recommend; no card until later). |
| Understand & remember? | **Partial** — remembered first-time / one income stream when confirming Simple. |
| Follow-ups useful? | Short; customer was decisive. |
| Correct next steps? | **Yes** — `https://www.taxsimba.co.uk/register`, email verify before pay, dashboard/accountant-led onboarding. |
| Package too early? | **Yes (verbal) on turn 1**; card only when asked “Which package?” |
| Final outcome helpful? | **Yes** for a ready-to-buy customer. |
| What would improve? | First turn: confirm simplicity in one question *or* give register link + “Simple is usual for one income stream” without hard-locking the SKU until asked. |

---

## Cross-cutting defects found while reviewing existing evidence

| ID | Issue | Status |
|----|-------|--------|
| QP-001 | £8k vs £1k SA inversion | Fixed + regression tests |
| QP-006 | “more than £50,000” parsed as exact £50k → wrong MTD refusal | **Fixed this pass** + regressions |
| QP-007 | `freelance` matched `/file/` and skipped MTD eligibility (T329 went to LLM → FAIL) | **Fixed this pass** |
| QP-008 | MTD follow-up forgot prior turnover (D03) | **Fixed this pass** (history wiring) |
| Live T329 | Historical FAIL in pack evidence (pre-fix LLM answer) | Documented; deterministic path now correct — optional single-ID retest |
| QP-004 | Catalogue dump on inclusions | Open (CX) |
