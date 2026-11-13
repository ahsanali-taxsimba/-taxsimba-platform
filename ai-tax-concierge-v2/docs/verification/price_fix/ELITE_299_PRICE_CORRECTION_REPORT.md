# Elite £299 price correction & MTD catalogue reconciliation

**Date:** 2026-11-13 (Europe/London)  
**PR:** [#35](https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/35) — **HOLD** (no merge / no production deploy)  
**Confirmed by product:** Self Assessment Elite is **£299**, not £249.

---

## Decision

| Item | Status |
|------|--------|
| Portal seed Elite £249 → **£299** | **PASS** (code fixed) |
| Portal Mongo sync on boot (`ensure_phase1b_data` always `$set`s price) | **PASS** (code fixed) |
| Stripe Checkout `unit_amount` for Elite = **29900** pence | **PASS** (mocked Session.create) |
| Smart→Elite upgrade delta **£150** / **15000** pence | **PASS** (was incorrectly £100) |
| MTD Starter/Growth/Complete £29.99/£59.99/£89.99 monthly | **PASS** (portal seed reconciled) |
| Legacy MTD Essential/Plus deactivated | **PASS** (code) |
| SIMBA AI catalogue & chat show £299 not £249 | **PASS** |
| Live Stripe **test-mode** session with real secret key | **BLOCKED** — no valid `STRIPE_SECRET_KEY` in this environment (`sk_test_emergent` rejected) |
| Live portal dashboard UI E2E against running Mongo | **BLOCKED** — portal API not running in this VM |
| Production website CMS (if any) | **PASS/N/A** — crawl found no £249 Elite price (SVG path noise only); SA page references 299 |
| Recommendations / checkout enablement | **HOLD** until staging verifies Mongo sync + real Stripe test payment |

---

## Root cause

`backend/phase1b.py` `DEFAULT_PACKAGES` seeded Elite at **£249**.  
`ensure_phase1b_data()` used **`$setOnInsert` only**, so existing Mongo documents never received price corrections. Stripe Checkout builds `unit_amount` from `package.price` (`int(round(amount * 100))`), so stale £249 would have been charged.

---

## Code changes

1. **`backend/phase1b.py`**
   - Elite **299.0**
   - MTD replaced with **MTD_STARTER / MTD_GROWTH / MTD_COMPLETE** at **29.99 / 59.99 / 89.99** per month, VAT included
   - `LEGACY_MTD_CODES` Essential/Plus → `is_active: false`
   - `ensure_phase1b_data()` always syncs approved price/name/billing onto existing rows
2. **Tests/scripts** updated off Essential/Plus and Smart→Elite **£100** → **£150**
3. **`backend/tests/test_approved_catalogue_prices.py`** — Stripe `unit_amount` assertions
4. SIMBA catalogues already had £299 / monthly MTD (unchanged prices)

---

## Evidence

| Artifact | Path |
|----------|------|
| Stripe unit_amount log | [`stripe_unit_amount_verification.json`](./stripe_unit_amount_verification.json) |
| Screenshots | [`screenshots/`](./screenshots/) |
| SIMBA packages API | Elite `price_gbp: 299` on `:8091` |

### Stripe amounts verified (mocked Session.create)

| Charge | GBP | `unit_amount` (pence) |
|--------|----:|----------------------:|
| Elite full purchase | 299.00 | **29900** (not 24900) |
| Smart → Elite upgrade | 150.00 | **15000** (not 10000) |
| MTD Starter / Growth / Complete | 29.99 / 59.99 / 89.99 | 2999 / 5999 / 8999 |

### Toxel staging follow-up (required)

1. Deploy/restart portal so `ensure_phase1b_data()` rewrites Mongo.  
2. Bind a real Stripe **test** secret; create Elite checkout; confirm Checkout UI and `amount_total` = **29900**.  
3. Confirm client dashboard /registration package list shows Elite **£299**.  
4. Keep PR #35 on **HOLD** until that verification is approved.

---

## Approved catalogue (source of truth)

| SKU | Price | Billing |
|-----|------:|---------|
| Simple | £119 | per tax year |
| Smart | £149 | per tax year |
| Elite | **£299** | per tax year |
| MTD Starter | £29.99 | per month, VAT included |
| MTD Growth | £59.99 | per month, VAT included |
| MTD Complete | £89.99 | per month, VAT included |
