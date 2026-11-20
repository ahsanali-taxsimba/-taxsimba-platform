# Five detailed customer journey reviews

Evaluated against **actual** SIMBA responses (frozen deep chats + focus API retests where noted).  
Heuristic PASS labels alone are **not** treated as tax VERIFIED.  
Professional approval: **NOT OBTAINED**.

Criteria checklist (1–13): correct answer · understands customer · remembers details · explains what applies · relevant questions · practical guidance · SA/MTD/both/neither/advice · TaxSimba service accuracy · no unnecessary packages · justified package · signup/support · respects no-buy · useful ending.

---

## Journey 1 — First-time freelancer + PAYE (£8,000) — D01 / Focus F1

**Customer:** Started freelancing alongside PAYE; ~£8,000 turnover 2025-26; asks about SA then package/signup.

| Criterion | Assessment |
| --- | --- |
| 1 Correct | **PASS (post-fix / F1):** States £8,000 is **above** £1,000 sole-trader threshold; trading allowance ≠ filing exemption. Sources: who-must-send; trading-allowance guidance. |
| 2–3 Understand / remember | PASS — keeps PAYE + freelance context. |
| 4–6 Explain / questions / practical | PASS — register link + distinction of allowance vs duty. |
| 7 SA/MTD | SA usually required; MTD not triggered by £8k alone. |
| 8–10 TaxSimba / packages | Info-first; package only when asked (F1). |
| 11–13 Signup / no-buy / ending | Signup URL given when asked; useful outcome. |

**Risk residual:** Historical incorrect “below £1,000” paths fixed in code; frozen older defects logged under QP-001 / KNOWN_FAILURES.

**Sources:** https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return · https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income

---

## Journey 2 — Landlord + PAYE — D02 / Focus F2

**Customer:** Full-time PAYE; buy-to-let ~£18,000 rent 2024-25; asks SA then MTD.

| Criterion | Assessment |
| --- | --- |
| 1 Correct | **Mostly PASS:** SA for property income is correct (GOV.UK who-must-send / property income). MTD: £18k is **not** more than £50k (2026 cohort) nor more than £30k (2027); later turns discuss bands — verify each turn against “more than” wording. Turn 4 reference to £20k / April 2028 band needs careful reading vs current GOV.UK page (do not invent). |
| 2–3 | PASS — remembers PAYE + rental figure. |
| 4–6 | PASS — practical record-keeping + SA registration. |
| 7 | SA yes; MTD not for £18k under £50k 2024-25 band. |
| 8–10 | Focus F2 respected “do not recommend package”. |
| 11–13 | Useful ending without forced sale. |

**Status for ChatGPT:** Property SA conclusion **source-backed**; MTD band narrative mark **AMBIGUOUS/UNVERIFIED** wherever exact band start dates are paraphrased without matching current GOV.UK text.

**Transcript:** `evidence/review/deep20/D02.md`

---

## Journey 3 — Sole trader MTD memory — D03 / Focus F3

**Customer:** Sole trader; ~£52,000 turnover 2024-25; asks if MTD from April 2026.

| Criterion | Assessment |
| --- | --- |
| 1 Correct | Turn 2 correctly: more than £50k → MTD from 6 April 2026. |
| 3 Remember | **FAIL (frozen turn 3):** Asked again for qualifying income already given — memory defect. **Code fix + mock retest PASS** (KNOWN_FAILURES / independent_audit_fixes). Focus F3 mid-path remembered £52k. |
| 4–7 | Explains turnover not profit; PAYE excluded — correct per qualifying-income guidance. |
| 8–13 | Signup guidance when appropriate; no forced package in early turns. |

**Sources:** https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax · https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax

**Transcript:** `evidence/review/deep20/D03.md`

---

## Journey 4 — Info-only / no purchase — Focus F4 (aligned with D06-style)

**Customer:** Wants information only; explicitly does not want a package.

| Criterion | Assessment |
| --- | --- |
| 1–7 | Tax information path without forcing product. |
| 9–10 Unnecessary package | **PASS** — no SKU after “I do not want a package” (F4). |
| 12 Respects no-buy | **PASS** |
| 13 Ending | Useful GOV.UK-oriented ending. |

**Note:** Frozen D05/D16 heuristic flags for no-buy failures remain in journey audit JSON — do not overwrite with F4 alone; ChatGPT should read those transcripts separately.

---

## Journey 5 — Knows need SA / signup — D10 / Focus F5

**Customer:** “I already know I need Self Assessment help” → package → register link.

| Criterion | Assessment |
| --- | --- |
| 1–7 | SA need accepted; practical register steps. |
| 9 Premature package | **FAIL (frozen D10 turn 1):** Named Simple £119 before customer asked which package. **Code fix:** help-first deterministic reply with **zero packages** until ask (mock retest). |
| 10 Justified package | After “Which package?” + simple first-time sole trader → Simple £119 is catalogue-aligned (business claim VERIFIED against catalogue). |
| 11 Signup | https://www.taxsimba.co.uk/register — coded; live HTTP not probed. |
| 8 Service model | Accountant-led portal; TaxCalc/Xero internal — do not claim direct HMRC filing by platform. |

**Transcript:** `evidence/review/deep20/D10.md` · corrected mock: `KNOWN_FAILURES_CORRECTED_RESPONSES.json` (`D10_turn1`)

---

## Cross-cutting journey scores (frozen deep20 heuristics)

From `JOURNEY_AND_CLAIMS_AUDIT.md`: memory FAIL D03; premature package FAIL D09/D10; no-buy FAIL D05/D16. Multi-turn pack 42/42 heuristic PASS — **not** tax VERIFIED.

**Production:** HOLD until AMBIGUOUS tax rows reviewed and staging claims evidenced.
