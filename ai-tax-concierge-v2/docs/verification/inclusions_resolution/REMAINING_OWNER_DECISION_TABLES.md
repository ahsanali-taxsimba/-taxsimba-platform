# Remaining owner / accountant decision tables

**Date:** 2026-11-13 (Europe/London) · **PR #35** · **Gate: HOLD**  
Recorded decisions 1–5 are in `OWNER_COMMERCIAL_DECISIONS_2026-11-13.md`. These tables hold **unresolved** commercial terms. SIMBA must not invent answers.

Approver key: **TaxSimba owner** · **Accountant lead** · **Toxel** (ops/integrations only)

---

## 1. Xero licence mapping (price inclusion already APPROVED)

**Do not reopen:** Xero software is included in the advertised Simbian monthly prices (£29.99 / £59.99 / £89.99 VAT incl.). Customers do **not** pay separately for that included licence.

| Proposed wording | Existing evidence | Remaining decision | Approver | Status |
|------------------|-------------------|--------------------|----------|--------|
| Xero included in Simbian monthly subscription prices; no separate customer Xero charge | Owner decision 1 (corrected) | — | TaxSimba owner | **APPROVED** |
| Comply → exact licence (historical “Xero Simple”) | public API MTD_COMPLY | Confirm exact Xero product name, seats, apps | TaxSimba owner | PENDING APPROVAL |
| Growth → exact licence (historical “Xero Ignite”) | public API MTD_GROWTH | Confirm exact product / eligibility | TaxSimba owner | PENDING APPROVAL |
| Elite → exact licence (historical “Xero Grow”) | public API MTD_ELITE | Confirm exact product / eligibility | TaxSimba owner | PENDING APPROVAL |
| Licence duration (while subscribed / fixed term) | none | Define entitlement length and what happens on cancel | TaxSimba owner | PENDING APPROVAL |
| Multi-org / multi-user seats | none | Caps and any *additional-work* seat add-ons (not a separate base Xero charge) | TaxSimba owner + Accountant | PENDING APPROVAL |
| Eligibility (sole trader only, UK only, etc.) | none | Publish eligibility rules | TaxSimba owner | PENDING APPROVAL |

---

## 2. Bookkeeping volume / out-of-scope work for Comply, Growth and Elite

| Proposed wording | Existing evidence | Remaining decision | Approver | Status |
|------------------|-------------------|--------------------|----------|--------|
| No fixed monthly transaction caps on Simbian Comply / Growth / Elite | Owner correction 2026-11-14 | — | TaxSimba owner | **APPROVED** |
| Not a promise of unlimited out-of-scope work | Owner correction 2026-11-14 | — | TaxSimba owner | **APPROVED** |
| Client duties (upload receipts, bank feeds connected) | none | Publish client responsibilities | Accountant lead | PENDING APPROVAL |
| Definition / pricing of out-of-scope bookkeeping | none | Pricing and notice | TaxSimba owner | PENDING APPROVAL |
| Catch-up bookkeeping for prior periods | none | Included vs charged | Accountant lead | PENDING APPROVAL |

**Removed from outstanding decisions:** fixed monthly transaction / bank-feed numerical caps for Comply, Growth and Elite.

---

## 3. Quarterly updates and year-end filing responsibilities

| Proposed wording | Existing evidence | Remaining decision | Approver | Status |
|------------------|-------------------|--------------------|----------|--------|
| Annual SA prep + submission included in all three MTD subs subject to agreed scope and timely client records | Owner decision 3 | Publish agreed scope document | TaxSimba owner + Accountant | APPROVED SUBJECT TO SCOPE |
| Quarterly MTD updates prepared and submitted by accountant | public API (all Simbian) | Approve / reject / condition | Accountant lead | PENDING APPROVAL |
| Client cut-off dates for quarterly & year-end | none | Calendar and late-data rules | Accountant lead | PENDING APPROVAL |
| Late-filing / penalty liability allocation | none | Engagement letter wording | TaxSimba owner + Accountant | PENDING APPROVAL |
| Overlap: standalone SA package vs MTD year-end | catalogue prices | Clarify when SA package is still needed | TaxSimba owner | PENDING APPROVAL |
| MTD registration and setup support | public API | Approve as inclusion | Accountant lead | PENDING APPROVAL |

---

## 4. SA package differentiation and complex-income scope

| Proposed wording | Existing evidence | Remaining decision | Approver | Status |
|------------------|-------------------|--------------------|----------|--------|
| Simple — employed / simple self-employed SA | public API description | Approve description + hard scope limits | Accountant lead | PENDING APPROVAL |
| Smart — several income sources; expenses/allowances check | public API | Define max sources / complexity | Accountant lead | PENDING APPROVAL |
| Elite — thorough SA without planning/priority claims | recovered Elite text partially REMOVED | Approve replacement description | Accountant lead | PENDING APPROVAL |
| “Everything in Simple/Smart” cascade | public API | Approve cascade after Simple/Smart lock | TaxSimba owner | PENDING APPROVAL |
| CIS / landlord / multi-property / foreign income routing | recommendation heuristics only | Confirm which SA tier (or MTD) | Accountant lead | PENDING APPROVAL |
| When to route to consultation vs package | decision 5 + heuristics | Written triage rules | Accountant lead | PENDING APPROVAL |

---

## 5. Amendments, exclusions and additional charges

| Proposed wording | Existing evidence | Remaining decision | Approver | Status |
|------------------|-------------------|--------------------|----------|--------|
| HMRC amendments after filing | none published | Included / limited / charged | TaxSimba owner + Accountant | UNKNOWN → PENDING APPROVAL |
| Explicit SA package exclusions list | UNKNOWN in matrix | Draft and approve | Accountant lead | UNKNOWN |
| Explicit MTD package exclusions list | UNKNOWN in matrix | Draft and approve (phone, volume, prior years, etc.) | Accountant lead | UNKNOWN |
| Additional charges schedule | none | Publish add-ons (catch-up, payroll, companies, etc.) | TaxSimba owner | PENDING APPROVAL |
| VAT on SA / consultation at checkout | catalogue vat_note | Confirm inclusive vs exclusive | TaxSimba owner | PENDING APPROVAL |

---

## 6. Email / dashboard support, operating hours and response expectations

| Proposed wording | Existing evidence | Remaining decision | Approver | Status |
|------------------|-------------------|--------------------|----------|--------|
| Priority support / priority turnaround / priority email | public API; owner decision 4 | Do not reinstate until capability + SLA approved | TaxSimba owner | **REMOVED** |
| Accountant support by email only (Comply) | public API | Approve channel policy | Accountant lead | PENDING APPROVAL |
| Dedicated accountant email support (Growth) | public API | Define “dedicated” staffing model | Accountant lead | PENDING APPROVAL |
| In-app / dashboard messaging | portal messaging exists | Approve as customer promise | TaxSimba owner | PENDING APPROVAL |
| Operating hours (UK) | none | Publish hours | TaxSimba owner | PENDING APPROVAL |
| Standard response expectation (non-priority) | none | e.g. X working days — only if true | Accountant lead | PENDING APPROVAL |
| Phone / WhatsApp / chat | “email only” implies no | Explicitly exclude or offer | TaxSimba owner | PENDING APPROVAL |

---

## 7. Subscription cancellation, upgrades, downgrades and refunds

| Proposed wording | Existing evidence | Remaining decision | Approver | Status |
|------------------|-------------------|--------------------|----------|--------|
| Cancel MTD monthly subscription | none in SIMBA catalogue | Notice period; Xero access end date | TaxSimba owner | PENDING APPROVAL |
| Upgrade / downgrade between Comply/Growth/Elite | none | Proration and mid-cycle Xero change | TaxSimba owner + Toxel | PENDING APPROVAL |
| Switch SA ↔ MTD | none | Credit rules | TaxSimba owner | PENDING APPROVAL |
| Refunds (SA one-off / MTD monthly / consultation) | none | Policy | TaxSimba owner | PENDING APPROVAL |
| Cooling-off / Consumer Contracts regs | none | Legal wording | TaxSimba owner | PENDING APPROVAL |

---

## 8. Consultation scope and booking terms

| Proposed wording | Existing evidence | Remaining decision | Approver | Status |
|------------------|-------------------|--------------------|----------|--------|
| One 30-minute accountant-led Google Meet advice session | Owner decision 5 | — | TaxSimba owner | **APPROVED** |
| No tax return filing, bookkeeping or written report | Owner decision 5 | — | TaxSimba owner | **APPROVED** |
| Calendly booking URL live | booking_status=stub | Connect staging + production URLs | Toxel | PENDING APPROVAL (ops) |
| Prep materials client should send | none | Checklist | Accountant lead | PENDING APPROVAL |
| Reschedule / no-show / refund rules | none | Policy | TaxSimba owner | PENDING APPROVAL |
| Whether package-included calls ever replace £99 session | REMOVED planning claims | Confirm never included in packages until re-approved | TaxSimba owner | PENDING APPROVAL |
| VAT treatment on £99 | vat_note confirm | Inclusive vs exclusive | TaxSimba owner | PENDING APPROVAL |

---

## Priority order for owner action

1. **P0 — Remaining blockers:** Table 1 (exact Xero mapping only — price inclusion already APPROVED) · Table 2 (bookkeeping transaction limits) · Table 3 (quarterly + scope doc) · Table 5 (additional-work exclusions)  
2. **P1 — Customer clarity:** Table 4 (SA differentiation) · Table 5 (exclusions/amendments) · Table 8 remaining booking terms  
3. **P2 — Ops polish:** Table 6 (support hours) · Table 7 (cancel/upgrade/refund) · Toxel Stripe/Calendly E2E
