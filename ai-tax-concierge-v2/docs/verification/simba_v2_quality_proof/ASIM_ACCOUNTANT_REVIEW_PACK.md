# Accountant / professional review pack (optional — not a blocker)

**Product:** Ask SIMBA V2 · **PR:** #43 · **HOLD / do not merge to production**  
**Process change:** Asim’s sign-off is **not** required to complete the independent evidence-based evaluation.  
Primary second review pack for ChatGPT: **`CHATGPT_REVIEW_PACK.md`**.

**Rule:** Do not treat REAL MODEL EXECUTED, heuristic PASS, or AI review as tax accuracy or as professional accountant approval.

| Bucket | Meaning |
|--------|---------|
| INDEPENDENTLY VERIFIED | Deterministic rule + official source establishes conclusion |
| AMBIGUOUS / UNVERIFIED | Needs case-by-case source matching |
| INCORRECT / INCOMPLETE | Confirmed in frozen transcript or missing material facts |
| REQUIRES PROFESSIONAL ADVICE | Escalate — not general published guidance |
| ACCOUNTANT APPROVED | Only if a real professional supplies it (currently **NOT OBTAINED**) |

---

## P0 — Confirmed transcript failures (engineering fixed; LIVE pack historical)

| Ref | Issue | Evidence | Fix evidence |
|-----|-------|----------|--------------|
| **T329** | Trading-allowance / MTD wording | Independent audit INCORRECT | `KNOWN_FAILURES_RETEST.md` + unit/mock |
| **T303** | PAYE-only steered to SA | Independent audit INCORRECT | sa_eligibility + clarifier tests |
| **QP-006 / T057** | Exact £50k vs more than | Incomplete clarifier in frozen pack | `amountStatedAsMoreThan` + tests |
| **D03** | Forgot £52k on follow-up | `deep20/D03.md` turn 3 | History-aware MTD extract |
| **D10** | Premature Simple package | `deep20/D10.md` turn 1 | Help-first zero-SKU reply |

---

## Optional professional register (if supplied later)

| Batch | Decision | Date (Europe/London) | Initials |
|-------|----------|----------------------|----------|
| P0 threshold FAILS + fixes | ☐ | | |
| Sample eligibility IDs | ☐ | | |
| Deep D01–D05, D12 | ☐ | | |
| Commercial claims | ☐ | | |
| Production tax clearance | ☐ GO / ☐ **NO-GO** | | |

Until a real professional completes this table, keep **Professional approval = NOT OBTAINED** and **production = HOLD**.
