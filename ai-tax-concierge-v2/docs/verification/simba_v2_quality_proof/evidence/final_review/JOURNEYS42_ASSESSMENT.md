# Journeys42 assessment (live OpenAI pack)

**Source:** `evidence/journeys40/live40_journeys_openai_latest.json`
**Generated (review):** 2026-11-20T14:02Z
**Pack metadata:** generated_at=2026-11-20T06:01:07.478Z; total=42; heuristic pass=42; fail=0; mode=openai

**Important:** Heuristic PASS ≠ tax VERIFIED. All journeys remain `accountant_review: AWAITING_PROFESSIONAL_REVIEW`. This assessment does **not** invent tax accuracy or claim accountant approval.

## Headline

- **42 / 42** automated journey heuristics PASS (OpenAI).
- **8** multi-turn journeys (J02, J04, J19, J20, J25, J33, J39, J41); **34** single-turn.
- **11** journeys showed at least one package card.
- Human CX re-read finds **material failure patterns** that heuristics missed — especially **conversation memory** on MTD follow-ups (J41 mirrors D03).

## Success examples (actual reply excerpts)

### J02 — Freelance SA then package (when asked)

> **Customer T1:** I am employed and earned £8,000 freelance turnover in 2025-26. Do I need Self Assessment?
> **SIMBA:** Yes, you will need to send a Self Assessment tax return for the 2025-26 tax year. Since you earned untaxed income of £8,000 from freelance work…
> **Customer T2:** Which Self Assessment package do you recommend?
> **SIMBA:** …I recommend the **Self Assessment Simple** package at £119 per tax year…

Why this works for CX: tax answer first with **no package on T1**; SKU only after the customer asked. (Tax conclusion still AWAITING_PROFESSIONAL_REVIEW.)

### J19 — Decline package then continue

> **Customer T1:** I want general information only.
> **SIMBA:** Of course! Please let me know what specific tax-related information you're interested in…
> **Customer T2:** Explain Self Assessment deadlines. Do not recommend a package.
> **SIMBA:** For the 2026-27 tax year, the deadlines… Paper… 31 October 2027… Online… 31 January 2028…
> **Packages:** none

Why this works: respects information-only + explicit no-package instruction.

### J25 — Facts change mid-conversation (correction handled)

> **Customer T1:** My rental income was £20,000 before expenses in 2024-25. Do I need MTD from April 2026?
> **SIMBA:** Based on qualifying income of £20,000 for 2024-25, you are not brought into Making Tax Digital by the £50,000 / 6 April 2026 band…
> **Customer T2:** Sorry — it was actually £55,000 before expenses in 2024-25. Please reassess.
> **SIMBA:** With a rental income of £55,000… you will need to use Making Tax Digital… from 6 April 2026…

Why this works for CX: revises conclusion when the customer corrects the figure. (Band conclusions still AWAITING_PROFESSIONAL_REVIEW.)

### J30 — Exact £50,000 boundary

> **Customer:** My qualifying income for 2024-25 was exactly £50,000. Do I need Making Tax Digital from 6 April 2026?
> **SIMBA:** No — qualifying income of exactly £50,000 for 2024-25 does not bring you into Making Tax Digital under that band. HMRC’s wording is “more than £50,000”…

Why this works: precise threshold wording. Still not accountant-approved.

### J08 / J11 / J15 / J31 / J40 — service & safety

- **J08:** PAYE-only → “you may not require a TaxSimba package” (no package cards).
- **J11:** “You do not need to buy Xero separately… Xero is included in the Simbian monthly price…”
- **J15:** “The TaxSimba portal… is not itself a direct HMRC filing integration.”
- **J31:** Existing client → dashboard / email; “you usually do not need to buy a new public package.”
- **J40:** Prompt injection → “I'm sorry, but I can't assist with that.”

## Failure / weak examples (actual reply excerpts)

### J41 — Workspace continuity FAILED (mirrors D03)

> **Customer T1:** Remember I am a landlord with £55k qualifying income in 2024-25.
> **SIMBA T1:** Since your qualifying income as a landlord is £55,000 for the 2024-25 tax year, you will need to use Making Tax Digital… from 6 April 2026…
> **Customer T2:** Based on what I already told you, when does MTD start for me?
> **SIMBA T2:** I can work out your Making Tax Digital start date once I know your qualifying income… What was that amount, and which tax year was it for…?

**Human FAIL #3 remembers details** — heuristics still marked PASS. Same defect family as deep **D03**.

### J33 — Package then decline (success after decline; note early sell is OK because asked)

> **Customer T1:** Which Self Assessment package for a first-time simple sole trader?
> **SIMBA:** …**Self Assessment Simple** package at £119…
> **Customer T2:** No thanks — information only from now on. Do not recommend a package.
> **SIMBA:** Understood! If you have any questions…
> **Customer T3:** When is the Self Assessment deadline for 2025-26?
> **SIMBA:** …31 January 2027 for online filing…

Decline path succeeds; contrast with deep **D05/D08** where package *cards* still appeared after no-buy.

### Heuristic blind spots vs deep20

| Pattern | Deep ID | Journey ID | Heuristic pack | Human CX |
|---|---|---|---|---|
| Forgot prior MTD income | D03 (also D04/D09/D17) | **J41** | PASS | **FAIL** |
| Premature package name | D09, D10 | (not identical single-turn pack) | N/A | FAIL in deep |
| No-buy + package card | D05, D08 | J19/J33 OK | PASS | Deep FAIL |
| Invented onboarding timeline | D15 | — | — | FAIL service accuracy |

## Per-journey summary table

| ID | Turns | Title | Packages | Heuristic | Human CX note |
|---|---:|---|---|---|---|
| J01 | 1 | General SA question — no sales | — | PASS | PAYE-only SA answer; no sales — solid info path |
| J02 | 2 | Freelance SA eligibility then one package | SA_SIMPLE | PASS | SUCCESS: SA then Simple only when asked |
| J03 | 1 | MTD landlord eligibility | — | PASS | MTD landlord eligibility — awaiting review |
| J04 | 2 | MTD then one Simbian recommendation | MTD_STARTER | PASS | SUCCESS: MTD answer then Simbian when asked |
| J05 | 1 | Low self-employment — trading allowance context | — | PASS | Trading allowance context — awaiting review |
| J06 | 1 | Mixed PAYE + rental | — | PASS | Mixed PAYE+rental — awaiting review |
| J07 | 1 | Both SA and MTD obligations explained | — | PASS | SA+MTD both explained — awaiting review |
| J08 | 1 | Neither service — employment only ask for package | — | PASS | SUCCESS: correctly says package likely not needed |
| J09 | 1 | Complex overseas + HMRC letters → consultation | ACCOUNTANT_CONSULT_149,ACCOUNTANT_CONSULT_99 | PASS | Consultation cards for complex overseas — appropriate escalation |
| J10 | 1 | Best package ask with facts | SA_SIMPLE | PASS | Best package with facts → Simple |
| J11 | 1 | Do I need to buy Xero? | — | PASS | SUCCESS: Xero included (catalogue-aligned claim) |
| J12 | 1 | What is TaxCalc? | — | PASS | TaxCalc internal positioning |
| J13 | 1 | HMRC-compatible software | — | PASS | HMRC-compatible software DIY path |
| J14 | 1 | Does TaxSimba handle filing? | — | PASS | Filing handled via accountant-led model |
| J15 | 1 | Portal direct HMRC filing? | — | PASS | SUCCESS: portal not direct HMRC filing |
| J16 | 1 | Already have an accountant | — | PASS | Already has accountant — fair boundary |
| J17 | 1 | Already using Xero | — | PASS | Already using Xero |
| J18 | 1 | Compare packages | SA_ELITE,SA_SIMPLE,SA_SMART | PASS | Compare SA packages (customer asked) |
| J19 | 2 | Decline package then continue | — | PASS | SUCCESS: info-only + no package after decline |
| J20 | 2 | Ready to sign up | SA_SIMPLE | PASS | Ready to sign up → register URL |
| J21 | 1 | What happens after payment | — | PASS | After payment steps |
| J22 | 1 | Email support | — | PASS | Email support path |
| J23 | 1 | Accountant advice request | ACCOUNTANT_CONSULT_99 | PASS | Accountant advice → consult card |
| J24 | 1 | Independent software options | — | PASS | Independent software options |
| J25 | 2 | Facts change mid-conversation | — | PASS | SUCCESS: revises MTD after corrected figure |
| J26 | 1 | CIS subcontractor SA | — | PASS | CIS subcontractor SA — awaiting review |
| J27 | 1 | Crypto gains | — | PASS | Crypto gains — awaiting review |
| J28 | 1 | Outside scope politely | — | PASS | Outside scope polite refusal |
| J29 | 1 | Dividend + salary company director SA | — | PASS | Director dividend+salary SA — awaiting review |
| J30 | 1 | Threshold boundary £50,000 exact | — | PASS | SUCCESS: exact £50k not in scope wording |
| J31 | 1 | Existing TaxSimba client | — | PASS | SUCCESS: existing client → dashboard, no repurchase |
| J32 | 1 | Missed deadline / HMRC letter | — | PASS | Missed deadline / HMRC letter triage |
| J33 | 3 | SA package then decline | SA_SIMPLE | PASS | Package when asked then decline respected |
| J34 | 1 | Both obligations — no duplicate force-buy | — | PASS | Both obligations without force-buy |
| J35 | 1 | Pension income only | — | PASS | Pension income only — awaiting review |
| J36 | 1 | Capital gains property | — | PASS | CGT property — awaiting review |
| J37 | 1 | MTD prices overview compare | MTD_GROWTH,MTD_STARTER | PASS | MTD price compare (customer asked) |
| J38 | 1 | Consultation difference | ACCOUNTANT_CONSULT_149,ACCOUNTANT_CONSULT_99 | PASS | Consultation difference (customer asked) |
| J39 | 2 | Registration path after recommendation | SA_SIMPLE | PASS | Recommendation → onboarding/register steps |
| J40 | 1 | Prompt injection refused | — | PASS | SUCCESS: refuses prompt injection |
| J41 | 2 | Workspace continuity facts (same session) | — | PASS | FAILURE: forgets £55k on follow-up (memory) |
| J42 | 1 | No automatic catalogue on tax year ask | — | PASS | No automatic catalogue on tax-year ask |

## Cross-link to Deep20 scores

- Deep20 average `overall_cx`: **6.65**
- Top deep failures: D03 — Forgot prior qualifying income on MTD follow-up (FAIL #3 remembers details); D10 — Named package SKU before customer asked which package (FAIL #9 premature/unnecessary package); D05 — Package card after explicit no-buy / no-package-cards request (FAIL #12 respects no-buy)
- Journeys42 strongest parallel failure: **J41** memory wipe.

## Verdict for quality proof

- Pack is useful as **OpenAI path / CX heuristic evidence**, not as tax sign-off.
- Do **not** treat 42/42 heuristic PASS as production GO.
- Memory regression (J41/D03 family) and no-buy package-card leaks (D05/D08) remain the highest CX blockers for “quality proof”.
