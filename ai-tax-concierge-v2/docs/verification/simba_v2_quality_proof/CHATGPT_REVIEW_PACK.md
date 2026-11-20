# ChatGPT second independent review pack — Ask SIMBA V2

**PR:** #43 (`cursor/simba-v2-quality-proof-6522`) — **HOLD / do not merge or deploy**  
**Asim sign-off:** Removed as completion blocker. This pack is for independent technical + tax-information review.  
**Professional accountant approval:** **NOT OBTAINED**. Do not treat AI verification (including this pack or ChatGPT’s second pass) as regulated professional approval. Escalate questions needing individual advice.

## Concise summary (independent statuses on frozen live T001–T400)

| Metric | Count |
| --- | ---: |
| Independently VERIFIED (source-backed deterministic match) | **25** |
| INCORRECT | **2** |
| INCOMPLETE | **5** |
| UNVERIFIED (individually examined; not auto-PASS) | **345** |
| AMBIGUOUS | **0** |
| REQUIRES PROFESSIONAL ADVICE | **23** |
| BLOCKED | **0** |
| Real OpenAI model executed | **400** |
| Professional approval obtained | **0** |
| Holdout 200 OpenAI | **200** (exact class 64/200) |
| Critical retest / Fresh 30 | **5/5** · **30 OpenAI, 0 premature** |
| Full Vitest after fixes | **561 passed** |

> **400 executed ≠ 400 independently verified.** Primary report: `ASK_SIMBA_FINAL_QUALITY_EVIDENCE.md`. Residuals are **UNVERIFIED**, not passed.

## File map (what to open)

| Deliverable | Path |
| --- | --- |
| All 400 Q + unedited A + expected + sources + statuses (CSV) | `evidence/independent_audit/INDEPENDENT_AUDIT_400.csv` |
| Same (JSON) | `evidence/independent_audit/INDEPENDENT_AUDIT_400.json` |
| Incorrect / incomplete / verified narrative | `evidence/independent_audit/INDEPENDENT_AUDIT_400.md` |
| Counts | `evidence/independent_audit/SUMMARY.json` |
| Known failures: original vs corrected rule + retest | `KNOWN_FAILURES_RETEST.md` |
| Corrected mock responses JSON | `evidence/independent_audit/KNOWN_FAILURES_CORRECTED_RESPONSES.json` |
| All 20 deep-chat transcripts | `evidence/review/deep20/D01.md` … `D20.md` (+ `DEEP20_INDEX.md`) |
| Five detailed customer journey reviews | `FIVE_DETAILED_JOURNEY_REVIEWS.md` |
| Journey heuristics + 42 multi-turn | `evidence/independent_audit/JOURNEY_AND_CLAIMS_AUDIT.md` |
| Business claims | `evidence/independent_audit/BUSINESS_CLAIMS_AUDIT.json` |
| Full answer register (alternate export) | `evidence/review/FULL_ANSWER_REGISTER.csv` |
| Defect log | `DEFECT_LOG.md` |
| Quality proof report | `QUALITY_PROOF_REPORT.md` |

## How ChatGPT should use this pack

1. For each row in `INDEPENDENT_AUDIT_400.csv`, read `customer_question` and `simba_answer_unedited` (frozen LIVE OpenAI — do not treat as expected answer).
2. Establish the correct conclusion from the linked official URLs / legislation; mark UNVERIFIED if the source does not establish the conclusion.
3. Confirm or overturn `verification_status`. Prefer VERIFIED only with working GOV.UK/HMRC citations + rule text.
4. Keep `professional_approval` as NOT_OBTAINED unless a real accountant supplies it.
5. Review deep chats D01–D20 and the five journey reviews against the 13 customer-journey criteria.
6. Do not invent package inclusions, staging, payment, email, Calendly, HMRC monitoring, or mobile evidence.

## Remaining unresolved risks

- **379 AMBIGUOUS** single-turn answers still need case-by-case source matching (not machine-verified).
- Frozen LIVE pack still contains **T303** (PAYE→SA wrong path) and **T329** (trading-allowance wording) as **INCORRECT** in the historical transcript; code fixes proven by unit/mock retest — full LIVE 400 not re-run.
- Deep **D03** forgot income on turn 3 (frozen); **D09/D10** premature package naming (frozen); code mitigations exist for D03 memory + D10 help-first.
- Staging email / Calendly / payment / HMRC monitoring / mobile: **UNVERIFIED** — production remains HOLD.
- Escalation paths for regulated/individual advice must stay visible; never label AI as accountant approval.
