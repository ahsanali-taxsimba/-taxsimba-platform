# Final commercial decisions — controlled approval implementation

**Date:** 2026-11-13 (Europe/London) · **PR #35** · **Verdict: HOLD**

## A. Owner decisions recorded

See `OWNER_COMMERCIAL_DECISIONS_2026-11-13.md` (five decisions applied in catalogue + prompts).

## B. Catalogue preserved

| Package | Price | Internal code |
|---------|------:|---------------|
| SA Simple / Smart / Elite | £119 / £149 / £299 per tax year | SA_SIMPLE / SA_SMART / SA_ELITE |
| Simbian Comply / Growth / Elite | £29.99 / £59.99 / £89.99 /mo VAT incl. | MTD_STARTER / MTD_GROWTH / MTD_COMPLETE |
| Consultation | £99 / 30 min | ACCOUNTANT_CONSULT_99 |

No duplicate Stripe products; amounts unchanged.

## C. SIMBA behaviour

- Speaks approved names/prices  
- Speaks **Xero-in-price as APPROVED** (no separate customer Xero charge); exact licence mapping still pending  
- Speaks bookkeeping / MTD year-end SA with **subject-to-scope** wording  
- Consultation boundaries APPROVED  
- Never invents limits, named Xero plan details, SLAs, tax-planning benefits or separate Xero charges  
- Removed premium claims never promised  
- Lowest suitable recommendation; SA vs MTD explained; one question at a time; correct package/register links  

## D. Matrix + remaining tables

| Artefact | Path |
|----------|------|
| Updated 54-item matrix | `SIX_PACKAGE_APPROVAL_MATRIX.md` |
| Remaining decision tables 1–8 | `REMAINING_OWNER_DECISION_TABLES.md` |
| Proposed descriptions/exclusions | `PROPOSED_FINAL_PACKAGE_COPY.md` |

### Matrix counts (54 rows)

| Status | Count |
|--------|------:|
| APPROVED | 5 |
| APPROVED SUBJECT TO SCOPE | 6 |
| REMOVED | 10 |
| PENDING APPROVAL | 27 |
| UNKNOWN | 6 |

## E. Verification evidence

| Check | Result | Path / command |
|-------|--------|----------------|
| Vitest | **471/471** pass | `cd ai-tax-concierge-v2/backend-node && npm test` |
| Security suite | **26/26** (inside Vitest) | `tests/security_suite.test.ts` |
| Owner-decision tests | **13/13** | `tests/owner_commercial_decisions.test.ts` |
| Typecheck | pass | `npm run typecheck` |
| Live OpenAI owner-decisions probe | **9/9** pass | `docs/verification/inclusions_resolution/live_owner_decisions_probe.json` |
| Portal display names | Simbian + prices unchanged | `backend/phase1b.py` |
| Stripe mappings | codes/amounts unchanged | no SKU/price edits |

## F. Staging handover checklist (Toxel)

Exact steps remain in `docs/toxel/TOXEL_STAGING_HANDOVER.md`. Must still verify:

1. HTTPS staging Node deploy + health  
2. Widget embed on staging only  
3. Stripe **test** Checkout end-to-end (no live payments)  
4. Calendly / Google Meet for £99 consultation  
5. Registration + email verification  
6. Authenticated client dashboard messaging  
7. No production website embed until A+B suite pass  

## GO / HOLD verdict

**HOLD**

Reasons:
- Remaining commercial items unresolved: exact Xero mapping, bookkeeping transaction limits, additional-work exclusions, quarterly duties, SA differentiation, amendments, support hours, cancel/refund, consultation booking extras  
- Xero-in-price commercial decision is **closed / APPROVED** — do not reopen or imply separate Xero payment  
- Toxel E2E (Stripe test, Calendly, register, dashboard, production embed) not signed  
- Release gate forbids merge, production deploy, live payment activation, and deletion of existing components  

Controlled HTTPS staging preparation is **permitted**.
