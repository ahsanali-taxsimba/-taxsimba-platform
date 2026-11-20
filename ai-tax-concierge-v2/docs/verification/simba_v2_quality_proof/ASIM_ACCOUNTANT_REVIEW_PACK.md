# Accountant Review Pack — Asim

**Product:** Ask SIMBA V2 (Node `ConversationalEngine`)  
**Purpose:** Independent professional review of tax-sensitive live OpenAI answers.  
**Rule:** Do not treat “REAL MODEL EXECUTED” or heuristic PASS as tax accuracy approval.

## Review status legend

| Label | Meaning |
|-------|---------|
| REAL MODEL EXECUTED | Live OpenAI response captured |
| INDEPENDENTLY VERIFIED | Deterministic rule / official threshold checked in code or by non-AI review |
| AWAITING ACCOUNTANT REVIEW | Needs Asim judgement |
| ACCOUNTANT APPROVED | Signed by Asim (none yet) |
| FAIL | Confirmed incorrect |
| BLOCKED | Could not execute / missing dependency |

## A. Priority tax-sensitive items (review first)

| Ref | Scenario | Why sensitive | Evidence | Expected conclusion (for challenge) | Official sources | Status |
|-----|----------|---------------|----------|--------------------------------------|------------------|--------|
| D01 / SA-£8k | PAYE + £8,000 freelance 2025-26 — need SA? | Trading allowance vs filing duty often confused | `evidence/deep20/D01_openai.json` + smoke fix | Sole-trader trading income **more than £1,000** usually requires SA registration/filing. Trading allowance ≠ exemption from filing when income is £8,000. | [Who must send a return](https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return); [Trading allowance](https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income) | **INDEPENDENTLY VERIFIED** on retest for £1k rule; still review surrounding PAYE wording |
| D02 | Landlord + PAYE | Property income + employment | `evidence/deep20/D02_openai.json` | Property income can trigger SA; PAYE does not remove duty | GOV.UK who-must-send | AWAITING |
| D03 | Sole trader near MTD | “More than” thresholds | `evidence/deep20/D03_openai.json` | Bands: >£50k 2024-25 → 6 Apr 2026; >£30k 2025-26 → 6 Apr 2027; >£20k 2026-27 → 6 Apr 2028 | [MTD if/when](https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax) | AWAITING (handlers exist; live wording to confirm) |
| D04 | Multiple income sources | Mixed SA complexity | `evidence/deep20/D04_openai.json` | Clarify; may need accountant consult | GOV.UK SA | AWAITING |
| D05 | Unsure whether to file | Ambiguous facts | `evidence/deep20/D05_openai.json` | Must ask clarifying questions; not guess | GOV.UK who-must-send | AWAITING |
| D12 | Late tax return | Penalties / next steps | `evidence/deep20/D12_openai.json` | General penalty info + professional help; no invented figures | [SA penalties](https://www.gov.uk/self-assessment-tax-returns/penalties) | AWAITING |
| J-MTD / pack | Exact £50k / £30k / £20k boundaries | Exclusive “more than” wording | Journeys40 + pack400 | Exact threshold ≠ “more than” | MTD GOV.UK | AWAITING sample review |
| T050, T059, T371 | Scorer VERIFIED_PASS | Narrow positioning / rule hits | tax_scored JSON | Confirm still correct | See scorer reasons | INDEPENDENTLY VERIFIED (narrow) |

## B. Full live 400 pack

- **File:** `evidence/pack400/simba_400_results_live_latest.json` (verbatim `question`, `turns`, `reply`, `packages`, `llm_mode`, `sources`)
- **Register:** `evidence/pack400/EXECUTION_REGISTER.md` + `.csv`
- **Independent scorer:** `…_tax_scored.json`

| Category | Count |
|----------|------:|
| REAL MODEL EXECUTED | 400 |
| INDEPENDENTLY VERIFIED PASS | 3 |
| FAIL | 0 |
| BLOCKED | 0 |
| AWAITING ACCOUNTANT REVIEW | 397 |
| ACCOUNTANT APPROVED | 0 |

## C. Multi-turn journeys (42) + deep conversations (20)

- Journeys: `evidence/journeys40/live40_journeys_openai_latest.json` — 42/42 `llm_mode=openai` (heuristic pass ≠ tax pass)
- Deep 8–15 turn chats: `evidence/deep20/D01`–`D20_openai.json` + `SCOREBOARD.json`

## D. Approved TaxSimba commercial claims to verify

Confirm against live catalogue / website (do not invent):

| Claim | Expected (from approved catalogue in code) | Review |
|-------|--------------------------------------------|--------|
| SA Simple / Smart / Elite | £119 / £149 / £299 per tax year | ☐ |
| Simbian Comply / Growth / Elite | £29.99 / £59.99 / £89.99 per month VAT included | ☐ |
| Xero on Simbian | Included in monthly price (not sold separately by default) | ☐ |
| Consultations | £99 / 20 min; £149 / 40 min; Google Meet; Calendly pay; no free callback | ☐ |
| Support | Email `info@taxsimba.co.uk` + client dashboard; no phone onboarding | ☐ |
| Portal | Registration/payment/docs/messaging — **not** direct HMRC filing | ☐ |
| TaxCalc / Xero | Internal accountant tools; do not push DIY purchase | ☐ |

## E. Sign-off register

| Item batch | Reviewer | Date (Europe/London) | Decision | Notes |
|------------|----------|----------------------|----------|-------|
| D01 SA £8k rule (post-fix) | — | — | ☐ APPROVED / ☐ REJECT | |
| Deep D02–D20 tax conclusions | — | — | ☐ | |
| Journeys J01–J42 tax conclusions | — | — | ☐ | |
| Pack T001–T400 consequential sample | — | — | ☐ | |
| Commercial / package claims | — | — | ☐ | |
| **Production readiness (tax)** | — | — | ☐ GO / ☐ NO-GO | Requires zero unresolved critical tax fails + sign-offs |

**Current production recommendation from engineering evidence alone:** **NO-GO** until Asim completes sign-offs (397 pack answers + journey tax content remain AWAITING).
