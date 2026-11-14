# Final six-package website reconciliation & pre-Toxel audit

**Date:** 2026-11-13 (Europe/London)  
**PR:** [#35](https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/35) — **HOLD** (no merge / production deploy / live payments / Python deletion)  
**Evidence root:** `ai-tax-concierge-v2/docs/verification/final_website_reconciliation/`

---

## 1. Live website / API recovery (authoritative catalogue source)

Recovered from public APIs (saved snapshots):

| Source | Path |
|--------|------|
| SA plans API | `public_api_sa.json` ← `https://taxsimba.co.uk/api/compat/subscription-plans?category=taxSimba` |
| MTD plans API | `public_api_mtd.json` ← `https://taxsimba.co.uk/api/compat/subscription-plans?category=mtd` |
| HTML captures | `sa_page.html`, `mtd_page.html` + `screenshots/` |

### Self Assessment (API)

| API code | API name | Price | Billing | VAT | Description (recovered) | Features (recovered) | Exclusions |
|----------|----------|------:|---------|-----|-------------------------|----------------------|------------|
| SIMPLE | Tax Simba Simple | **£119** | Per tax year | INCLUSIVE | Straightforward SA for employed / simple SE, prepared & checked by qualified accountant | SA by accountant; secure upload; review before submission; email & in-app updates | **None published** |
| SMART | Tax Simba Smart | **£149** | Per tax year | INCLUSIVE | Several income sources; allowances/expenses reviewed in detail | Everything in Simple; multiple income sources; expenses/allowances check; **Priority accountant messaging** | **None published** |
| ELITE | Tax Simba Elite | **£299** | Per tax year | INCLUSIVE | Thorough SA incl. planning conversations + full year review | Everything in Smart; full tax-position review; **Tax planning conversation**; **Priority turnaround** | **None published** |

### Making Tax Digital / Simbian (API)

| API code | Name | Price | VAT | Description (recovered) | Key features (recovered) | Exclusions |
|----------|------|------:|-----|-------------------------|--------------------------|------------|
| MTD_COMPLY | **Simbian Comply** | **£29.99**/mo | INCLUSIVE | Accountant maintains records; quarterly updates; year-end return | **Xero Simple** included; MTD setup; bookkeeping; quarterly updates; year-end ITSA; reminders; secure docs; **email only** | **None published** |
| MTD_GROWTH | **Simbian Growth** | **£59.99**/mo | INCLUSIVE | Dedicated accountant; filings; *reviews business each quarter* | **Xero Ignite** included; bookkeeping; quarterly; year-end; dedicated email; **Quarterly business reviews**; expenses check; docs/reminders | **None published** |
| MTD_ELITE | **Simbian Elite** | **£89.99**/mo | INCLUSIVE | Dedicated care; filings; *proactive tax planning* | **Xero Grow** included; bookkeeping; quarterly; year-end; **priority email**; **QBR**; expenses; full review; **proactive tax planning**; docs/reminders | **None published** |

**Note:** Marketing HTML pages do **not** currently render these package cards/prices in static HTML. Catalogue truth for this audit is the **public subscription-plans API**.

---

## 2. Preserved approved owner decisions (applied in SIMBA)

| Decision | Status in SIMBA |
|----------|-----------------|
| Xero included in all three MTD monthly prices; customers do **not** pay separately | **APPROVED BY OWNER** |
| Website mapping Comply→Xero Simple, Growth→Xero Ignite, Elite→Xero Grow | **VERIFIED FROM WEBSITE** + used in SIMBA |
| Bookkeeping within agreed package limits | **APPROVED BY OWNER**; **transaction caps UNDECIDED** |
| Quarterly MTD updates + year-end SA in all three MTD packages, subject to documented customer responsibilities | **APPROVED BY OWNER** |
| Remove priority support / quarterly business reviews / premium planning from SIMBA promises | **APPROVED BY OWNER** (REMOVED in SIMBA even where website still lists them) |
| £99 consultation = 30-min Google Meet advice; no filing / bookkeeping / written report | **APPROVED BY OWNER** |
| Support via email + client-dashboard messaging; not telephone onboarding | **APPROVED BY OWNER** |

Prices unchanged: SA £119/£149/£299 · Simbian £29.99/£59.99/£89.99 VAT incl. · Internal SKUs unchanged.

---

## 3. Reclassified 54-item matrix (summary)

Full table: `RECLASSIFIED_54_ITEM_MATRIX.md`

Classification key used for this audit:

| Class | Meaning |
|-------|---------|
| **VERIFIED FROM WEBSITE** | Present on public API/pages as evidence only |
| **APPROVED BY OWNER** | Explicit owner commercial decision for SIMBA |
| **REQUIRES CLARIFICATION** | Website evidence exists but not owner-approved as SIMBA promise, or wording incomplete |
| **NOT IMPLEMENTED** | Missing from website and product ops (e.g. published exclusions, refunds) |

**Bookkeeping transaction limits for Comply / Growth / Elite:** **UNDECIDED** (called out explicitly; not invented).

Genuine outstanding commercial gaps (no invented policy):

- Package **exclusions** lists (API returns none)
- **Extra-work / overage** charges
- **Amendments** after filing
- **Cancellation / upgrade / downgrade / refund** conditions for packages
- Documented **customer responsibilities** text for quarterly/year-end
- SA feature bullets beyond prices (website-verified but not fully owner-approved for SIMBA contracts)
- Live HTML package pages / SEO alignment (technical + content ownership)

---

## 4. Cross-system reconciliation

| System | Finding | Action |
|--------|---------|--------|
| Public API catalogue | Names/prices/Xero mapping match approved catalogue | SIMBA aligned |
| Portal `backend/phase1b.py` DEFAULT_PACKAGES | Simbian names + correct prices; codes MTD_STARTER/GROWTH/COMPLETE | **Consistent** |
| SIMBA `packages.json` | Updated to website reconciliation + owner decisions | **Updated in PR** |
| `/self-assessment` HTML | Marketing page; prices not in static HTML; API is source | Flag for Toxel/web |
| `/making-tax-digital` HTML | **SEO/content mismatch** — title/body are general SA “Tax Return Information”; **no Simbian packages/prices** | **Contradiction — needs website fix (Toxel/web)** |
| `/pricing` | Live capture showed **service connection error** | **Bug — Toxel/web** |
| Homepage static prices | Legacy **£100 / £169** still appear in homepage HTML | **Outdated — commercial/web approval to change live site** |
| SA API display names | “Tax Simba Simple/Smart/Elite” vs SIMBA “Self Assessment Simple/Smart/Elite” | Naming variance — **REQUIRES CLARIFICATION** for brand consistency (prices match) |
| Stripe | Portal derives `unit_amount` from package.price; no duplicate SKUs changed | **Not live-verified in this audit** (Toxel) |
| Registration | `https://www.taxsimba.co.uk/register` returns 200 | Link OK; E2E auth **untested** |
| Consultation booking | SIMBA `booking_status: stub` | Calendly **untested** |
| SEO / JSON-LD on SA page | FAQPage schema present; MTD page schema/meta wrong for Simbian product | Flag |

**Corrected within authorised SIMBA scope:** catalogue facts, prompts, recommendations, tests.  
**Not modified:** live website HTML, portal billing live config, Stripe live products, unrelated TaxSimba apps.

---

## 5. QA results (actual)

| Suite | Result | Evidence |
|-------|--------|----------|
| Vitest | **476/476** pass | `cd ai-tax-concierge-v2/backend-node && npm test` |
| Security suite | **26/26** | `tests/security_suite.test.ts` |
| Website reconciliation tests | **4/4** | `tests/website_reconciliation.test.ts` |
| Live OpenAI owner/website probe | run with commit | `inclusions_resolution/live_owner_decisions_probe.json` |
| Local widget desktop/mobile screenshots | Captured | `screenshots/01_*.png` … `03_*.png` |
| Live SA / MTD / pricing screenshots | Captured | `screenshots/04_*.png` … `08_*.png` |
| UI audit notes | See | `screenshots/../UI_AUDIT_REPORT.md` (if present) / computer-use report |
| Stripe test checkout | **Not tested** | — |
| Calendly / Google Meet booking | **Not tested** | — |
| Production embed E2E | **Not tested** | Launcher visible on live site screenshots only |
| Registration + dashboard auth E2E | **Not tested** | — |

---

## 6. Remaining bugs / contradictions

1. **`/making-tax-digital` page content/SEO does not present Simbian Comply/Growth/Elite** (API does).  
2. **`/pricing` service error** in live capture.  
3. **Homepage legacy prices (£100/£169)** contradict approved catalogue.  
4. Public API still lists **priority / QBR / proactive planning** bullets that owner removed from SIMBA promises — do not auto-approve.  
5. **No published exclusions** on API for any of the six packages.  
6. SA public names “Tax Simba …” vs SIMBA “Self Assessment …” wording difference.  
7. Consultation Calendly still stub; Stripe checkout not staging-verified.

---

## 7. Toxel staging checklist (exact)

See updated `docs/toxel/TOXEL_STAGING_HANDOVER.md`. Must still verify:

1. HTTPS staging Node deploy + `/api/v1/health` openai mode  
2. Staging embed only (launcher + welcome + chat)  
3. Stripe **test** Checkout for SA 11900/14900/29900 and MTD 2999/5999/8999  
4. Calendly → Google Meet for £99 consultation  
5. Registration + email verification  
6. Authenticated dashboard messaging  
7. Website fixes for MTD page / pricing service / homepage legacy prices (**separate web ticket**; not silently changed here)

---

## 8. Readiness verdict

### **READY FOR CONTROLLED STAGING** (SIMBA Node + staging embed)

**Reasons yes:**
- Six package names/prices reconciled to public API + portal seed  
- Owner decisions encoded; SIMBA refuses removed premium claims  
- Automated tests green (476) + live OpenAI probe executed  
- Local widget desktop/mobile evidenced  

### **BLOCKED for production / merge / live payments**

**Reasons blocked:**
- Live website package-page / pricing contradictions unresolved  
- Bookkeeping transaction limits UNDECIDED  
- Exclusions / amendments / cancel-refund policies missing  
- Stripe test, Calendly, register, dashboard E2E not signed by Toxel  
- PR release gate forbids merge/deploy/live payments/Python deletion  

**Await owner approval** on website HTML fixes and remaining commercial gaps before any production discussion.
