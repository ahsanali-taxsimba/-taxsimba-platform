# Six-package approval matrix — final owner register (PR #35)

**Date:** 2026-11-13 (Europe/London)  
**Source decisions:** `OWNER_COMMERCIAL_DECISIONS_2026-11-13.md`  
**Rule:** Only **APPROVED** content may be stated as an unconditional customer promise. **APPROVED SUBJECT TO SCOPE** must be spoken with conditions. **REMOVED** must not appear in customer-facing copy. **PENDING APPROVAL** / **UNKNOWN** require TaxSimba confirmation — never invent.

### Status legend

| Status | Meaning |
|--------|---------|
| **APPROVED** | Explicitly supported by owner decisions and/or previous verified approvals |
| **APPROVED SUBJECT TO SCOPE** | Broad entitlement approved; numerical limits or delivery conditions unresolved |
| **REMOVED** | Unapproved premium claim withdrawn from customer-facing copy |
| **PENDING APPROVAL** | Precise operational or commercial decision still required |
| **UNKNOWN** | No verified source or decision |

### Catalogue already APPROVED (not part of the 54 feature rows)

| Item | Value | Status |
|------|-------|--------|
| SA names | Simple / Smart / Elite | APPROVED |
| SA prices | £119 / £149 / £299 per tax year | APPROVED |
| MTD names | Simbian Comply / Growth / Elite | APPROVED |
| MTD prices | £29.99 / £59.99 / £89.99 per month, VAT included | APPROVED |
| Internal MTD codes | `MTD_STARTER` / `MTD_GROWTH` / `MTD_COMPLETE` | APPROVED (unchanged) |
| Consultation name/price/duration/meeting | £99 / 30 min / Google Meet | APPROVED |
| Consultation booking | stub until Calendly | APPROVED (status) |

---

## 54-item register (descriptions, inclusions, exclusions)

### Self Assessment Simple — £119 / tax year

| # | Field | Proposed / recovered wording | Evidence | Status |
|---|-------|------------------------------|----------|--------|
| 1 | `description` | A straightforward Self Assessment for employed and simple self-employed income, prepared and checked by a qualified accountant. | public API taxSimba | **PENDING APPROVAL** |
| 2 | `inclusion` | Self Assessment prepared by an accountant | public API taxSimba | **PENDING APPROVAL** |
| 3 | `inclusion` | Secure document upload | public API taxSimba; portal upload | **PENDING APPROVAL** |
| 4 | `inclusion` | Review and approval before submission | public API taxSimba; portal workflow | **PENDING APPROVAL** |
| 5 | `inclusion` | Email and in-app updates | public API taxSimba | **PENDING APPROVAL** |
| 6 | `exclusions` | (none published) | not found | **UNKNOWN** |

### Self Assessment Smart — £149 / tax year

| # | Field | Proposed / recovered wording | Evidence | Status |
|---|-------|------------------------------|----------|--------|
| 7 | `description` | For clients with several income sources who want their allowances and expenses reviewed in detail before filing. | public API taxSimba | **PENDING APPROVAL** |
| 8 | `inclusion` | Everything in Simple | public API taxSimba | **PENDING APPROVAL** |
| 9 | `inclusion` | Multiple income sources reviewed | public API taxSimba | **PENDING APPROVAL** |
| 10 | `inclusion` | Expenses and allowances check | public API taxSimba | **PENDING APPROVAL** |
| 11 | `inclusion` | Priority accountant messaging | public API taxSimba; owner decision 4 | **REMOVED** |
| 12 | `exclusions` | (none published) | not found | **UNKNOWN** |

### Self Assessment Elite — £299 / tax year

| # | Field | Proposed / recovered wording | Evidence | Status |
|---|-------|------------------------------|----------|--------|
| 13 | `description` | Our most thorough Self Assessment service, including planning conversations and a full review of your position for the year. | public API taxSimba; planning claim conflicts with decision 4 | **REMOVED** (planning claim); replacement description **PENDING APPROVAL** |
| 14 | `inclusion` | Everything in Smart | public API taxSimba | **PENDING APPROVAL** |
| 15 | `inclusion` | Full review of your tax position | public API taxSimba | **PENDING APPROVAL** |
| 16 | `inclusion` | Tax planning conversation | public API taxSimba; owner decision 4 | **REMOVED** |
| 17 | `inclusion` | Priority turnaround | public API taxSimba; owner decision 4 | **REMOVED** |
| 18 | `exclusions` | (none published) | not found | **UNKNOWN** |

### Simbian Comply — £29.99 / month (VAT included) · code `MTD_STARTER`

| # | Field | Proposed / recovered wording | Evidence | Status |
|---|-------|------------------------------|----------|--------|
| 19 | `description` | Your accountant maintains your records and handles your quarterly updates and year-end tax return. | public API mtd; partially superseded by decisions 2–3 | **PENDING APPROVAL** (use subject-to-scope safe wording meantime) |
| 20 | `inclusion` | Xero Simple subscription included | public API mtd; owner decision 1 | **APPROVED SUBJECT TO SCOPE** (Xero licence in price; exact “Simple” mapping still pending) |
| 21 | `inclusion` | MTD registration and setup support | public API mtd | **PENDING APPROVAL** |
| 22 | `inclusion` | Accountant-maintained bookkeeping and digital records | public API mtd; owner decision 2 | **APPROVED SUBJECT TO SCOPE** (limits not approved) |
| 23 | `inclusion` | Quarterly MTD updates prepared and submitted | public API mtd | **PENDING APPROVAL** |
| 24 | `inclusion` | Year-end Income Tax return prepared and submitted | public API mtd; owner decision 3 | **APPROVED SUBJECT TO SCOPE** |
| 25 | `inclusion` | Automated tax deadline reminders | public API mtd | **PENDING APPROVAL** |
| 26 | `inclusion` | Secure digital document exchange | public API mtd; portal | **PENDING APPROVAL** |
| 27 | `inclusion` | Accountant support by email only | public API mtd | **PENDING APPROVAL** |
| 28 | `exclusions` | (none published) | not found | **UNKNOWN** |

### Simbian Growth — £59.99 / month (VAT included) · code `MTD_GROWTH`

| # | Field | Proposed / recovered wording | Evidence | Status |
|---|-------|------------------------------|----------|--------|
| 29 | `description` | A dedicated accountant maintains your records, handles your filings and reviews your business each quarter. | public API mtd; QBR conflicts with decision 4 | **REMOVED** (quarterly review claim); replacement **PENDING APPROVAL** |
| 30 | `inclusion` | Xero Ignite subscription included | public API mtd; owner decision 1 | **APPROVED SUBJECT TO SCOPE** (licence in price; exact “Ignite” mapping pending) |
| 31 | `inclusion` | MTD registration and setup support | public API mtd | **PENDING APPROVAL** |
| 32 | `inclusion` | Accountant-maintained bookkeeping and digital records | public API mtd; owner decision 2 | **APPROVED SUBJECT TO SCOPE** |
| 33 | `inclusion` | Quarterly MTD updates prepared and submitted | public API mtd | **PENDING APPROVAL** |
| 34 | `inclusion` | Year-end Income Tax return prepared and submitted | public API mtd; owner decision 3 | **APPROVED SUBJECT TO SCOPE** |
| 35 | `inclusion` | Dedicated accountant support by email only | public API mtd | **PENDING APPROVAL** |
| 36 | `inclusion` | Quarterly business reviews | public API mtd; owner decision 4 | **REMOVED** |
| 37 | `inclusion` | Expenses and allowances check | public API mtd | **PENDING APPROVAL** |
| 38 | `inclusion` | Secure document exchange and deadline reminders | public API mtd | **PENDING APPROVAL** |
| 39 | `exclusions` | (none published) | not found | **UNKNOWN** |

### Simbian Elite — £89.99 / month (VAT included) · code `MTD_COMPLETE`

| # | Field | Proposed / recovered wording | Evidence | Status |
|---|-------|------------------------------|----------|--------|
| 40 | `description` | Dedicated accountant care with maintained records, complete agreed filings and proactive tax planning. | public API mtd; planning conflicts with decision 4 | **REMOVED** (proactive planning claim); replacement **PENDING APPROVAL** |
| 41 | `inclusion` | Xero Grow subscription included | public API mtd; owner decision 1 | **APPROVED SUBJECT TO SCOPE** (licence in price; exact “Grow” mapping pending) |
| 42 | `inclusion` | MTD registration and setup support | public API mtd | **PENDING APPROVAL** |
| 43 | `inclusion` | Accountant-maintained bookkeeping and digital records | public API mtd; owner decision 2 | **APPROVED SUBJECT TO SCOPE** |
| 44 | `inclusion` | Quarterly MTD updates prepared and submitted | public API mtd | **PENDING APPROVAL** |
| 45 | `inclusion` | Year-end Income Tax return prepared and submitted | public API mtd; owner decision 3 | **APPROVED SUBJECT TO SCOPE** |
| 46 | `inclusion` | Dedicated accountant with priority email support | public API mtd; owner decision 4 | **REMOVED** |
| 47 | `inclusion` | Quarterly business reviews | public API mtd; owner decision 4 | **REMOVED** |
| 48 | `inclusion` | Expenses and allowances check | public API mtd | **PENDING APPROVAL** |
| 49 | `inclusion` | Full review of your tax position | public API mtd | **PENDING APPROVAL** |
| 50 | `inclusion` | Proactive tax planning advice | public API mtd; owner decision 4 | **REMOVED** |
| 51 | `inclusion` | Secure document exchange and deadline reminders | public API mtd | **PENDING APPROVAL** |
| 52 | `exclusions` | (none published) | not found | **UNKNOWN** |

### Private accountant consultation — £99 / 30 minutes

| # | Field | Proposed / recovered wording | Evidence | Status |
|---|-------|------------------------------|----------|--------|
| 53 | `inclusions` | One 30-minute accountant-led Google Meet advice session | owner decision 5 | **APPROVED** |
| 54 | `exclusions` | No tax return filing, bookkeeping or written report | owner decision 5 | **APPROVED** |

---

## Counts (54 feature rows)

| Status | Count |
|--------|------:|
| APPROVED | 2 |
| APPROVED SUBJECT TO SCOPE | 9 |
| REMOVED | 10 |
| PENDING APPROVAL | 27 |
| UNKNOWN | 6 |
| **Total** | **54** |

Notes on count: row 13 counted as REMOVED (planning description withdrawn); replacement SA Elite description is tracked as pending in proposed copy, not as a second matrix row. Rows 29 and 40 counted REMOVED for withdrawn QBR/planning descriptions.

## Controlled customer-facing facts SIMBA may use now

1. **Names & prices** — APPROVED.  
2. **Xero** — “A Xero software licence is included in the Simbian monthly price; TaxSimba must confirm the exact licence and entitlements.” — APPROVED SUBJECT TO SCOPE.  
3. **Bookkeeping** — “TaxSimba maintains digital bookkeeping records within defined tier limits; the numerical limits are not yet published.” — APPROVED SUBJECT TO SCOPE.  
4. **MTD year-end SA** — “Annual Self Assessment preparation and submission are included in all three Simbian subscriptions, subject to agreed scope and timely client records.” — APPROVED SUBJECT TO SCOPE.  
5. **Consultation** — decision 5 wording — APPROVED.  
6. **Must not say** — priority support/turnaround, quarterly business reviews, proactive tax planning (or equivalent).

## Release gate

**HOLD** — staging prep allowed; no merge, production deploy, live payments, or deletion of existing components until remaining commercial tables are approved and Toxel completes Stripe/Calendly/embed/register/dashboard E2E.
