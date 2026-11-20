# Asim — prioritised accountant review pack (concise)

**Product:** Ask SIMBA V2 · **PR:** #43 · **HOLD / do not merge to production**  
**Rule:** Do not treat REAL MODEL EXECUTED or heuristic PASS as tax accuracy.

Machine re-score of the existing live pack (no full re-run): see `evidence/review/COUNTS.json` and `INDEPENDENT_VERIFICATION_SUMMARY.md`.

| Bucket | Meaning |
|--------|---------|
| INDEPENDENTLY VERIFIED | Deterministic rule / catalogue claim checked in code or by non-AI inspection |
| AWAITING YOUR SIGN-OFF | Needs professional judgement |
| FAIL (evidence) | Confirmed wrong in the frozen live transcript |
| ACCOUNTANT APPROVED | Your sign-off (none yet) |

---

## P0 — Failures / threshold risks (review first)

| Ref | Why | Evidence | Expected | Sources | Your decision |
|-----|-----|----------|----------|---------|---------------|
| **T329** (live pack) | LLM said £1,000 freelance is “below the £1,000 trading allowance” and no SA/MTD | `FULL_ANSWER_REGISTER.json` / pack latest | PAYE excluded from MTD; £1,000 freelance is **not more than** MTD bands; do **not** say “below trading allowance”. Exact £1,000 SA is a boundary (“more than £1,000”). | [Who must send](https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return); [MTD if/when](https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax) | ☐ Approve fix path / ☐ Reject |
| **QP-006** | “more than £50,000” was treated as exact £50k | Defect log + unit tests | More than £50k in 2024-25 → from **6 April 2026** | MTD GOV.UK | ☐ |
| **D01 £8k** | Trading allowance vs filing duty | `deep20/D01.md` (post QP-001) | £8,000 **above** £1,000 → usually must register/file | Who must send; trading allowance guidance | ☐ |

---

## P1 — High tax-risk live answers (sample first 15 from eligibility / landlords / MTD / calculations)

Full list: `evidence/review/INDEPENDENT_VERIFICATION_SUMMARY.md` § P1.  
Complete Q&A: `evidence/review/FULL_ANSWER_REGISTER.md` (or per-category files).

Priority IDs to open first:

- **T001, T121** — PAYE-only SA / MTD  
- **T010, T114, T376** — trading allowance  
- **T057, T182, T329** — £50k / expenses / PAYE+freelance  
- **D02, D03, D04, D05, D12** — deep chats with property / MTD / multi-income / late filing  

For each: read **Customer question**, **Actual SIMBA response**, **Expected conclusion**, then mark APPROVED / REJECT / NEEDS MORE FACTS.

---

## P2 — Commercial / service claims

Confirm against live catalogue (do not invent):

| Claim | Code expectation | ☐ |
|-------|------------------|---|
| SA Simple / Smart / Elite | £119 / £149 / £299 per tax year | |
| Simbian Comply / Growth / Elite | £29.99 / £59.99 / £89.99 pcm VAT incl. | |
| Xero on Simbian | Included — not bought separately by default | |
| Portal | Not direct HMRC filing | |
| Consultations | £99 / 20 min; £149 / 40 min; Calendly; no free callback | |
| Support | info@taxsimba.co.uk + dashboard; no phone onboarding | |

Evidence: D08 / D10 / pack TaxSimba packages category.

---

## P3 — Conversation quality (not statutory)

- D06 info-only: no packages — good  
- D10: verbal package on turn 1 — early sell  
- D03: forgotten turnover (code fix pending retest of transcript)  
- QP-004 catalogue dump on inclusions  

---

## Sign-off register

| Batch | Decision | Date (Europe/London) | Initials |
|-------|----------|----------------------|----------|
| P0 threshold FAILS + fixes | ☐ GO tax / ☐ HOLD | | |
| P1 eligibility sample (min 20 IDs) | ☐ | | |
| P1 deep D01–D05, D12 | ☐ | | |
| P2 commercial claims | ☐ | | |
| **Production tax clearance** | ☐ GO / ☐ **NO-GO** | | |

**Engineering stance:** **NO-GO** until P0/P1 sign-offs complete. 400 executed ≠ 400 accurate.
