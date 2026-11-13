# SIMBA AI Tax Assistant — Comprehensive Intelligence, Sales & Readiness Audit

**Date:** 2026-11-13 (Europe/London)  
**PR:** [#35](https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/35)  
**Runtime audited:** Node.js `ai-tax-concierge-v2/backend-node` (`node dist/server.js`)  
**Rules:** NO MERGE · NO PRODUCTION DEPLOY · NO PYTHON DELETION  

---

## FINAL READINESS DECISION

### **READY FOR TOXEL STAGING** — not production-ready

Local Node intelligence, package recommendation, pricing honesty, conversion handoff discipline, security probes, Emerald UI and platform isolation **PASS** with executed evidence.

**Do not claim 100% tax accuracy or production readiness.** Coverage is strong for grounded GOV.UK corpus retrieval (51 facts, 150 scenario paraphrases) plus live OpenAI spot probes; catalogue **inclusions remain unspecified** and payment/booking/auth/embed remain **BLOCKED**.

---

## PASS / FAIL / BLOCKED matrix

| # | Area | Status | Evidence |
|---|------|--------|----------|
| 1 | Tax intelligence (≥150 scenarios) | **PASS** 150/150 retrieval | `intelligence_audit/tax_intelligence_150_transcripts.md` · Vitest `tax_intelligence_150.test.ts` |
| 2 | Package journeys (≥50) | **PASS** 50/50 | `intelligence_audit/package_journeys_50_transcripts.md` · Vitest `package_journeys_50.test.ts` |
| 3 | Correct pricing SA/MTD/Consult | **PASS** | Vitest conversion audit + live probes + packages screenshot |
| 4 | Conversion journeys (no false purchase) | **PASS** (handoff honesty) | `conversion_quality_audit.test.ts` · analytics rejects `purchase_completed` |
| 5 | Existing customers → dashboard | **PASS** | Journey + live probe `live-existing` |
| 6 | Conversation quality | **PASS** (automated + live spot) | multiturn, decline-sales, inclusions guard, British prompt rules |
| 7 | Security | **PASS** | existing security suite + conversion audit rate limit / key leak / isolation |
| 8 | Node independent of Python | **PASS** | `:8091` up · `:8090` down · vendored JSON |
| 9 | Website / portal unchanged | **PASS** | 0 files outside `ai-tax-concierge-v2/` |
| 10 | Proof artifacts | **PASS** | logs, transcripts, screenshots, video below |
| — | Stripe / Calendly / registration / dashboard auth / live embed | **BLOCKED** | Needs Toxel HTTPS staging |
| — | Verified package inclusions catalogue | **BLOCKED** | `inclusions_status=not_specified_in_catalog` — SIMBA correctly refuses to invent |

---

## What changed in this audit cycle

1. Expanded HMRC corpus (+20 GOV.UK-grounded facts → **51** total).  
2. Circumstance-based package selection (`package_selection.ts`) — asks/uses qualifying signals; **never Elite/Complete alone**.  
3. Existing-client and “information only” paths suppress paid upsell.  
4. Customer-facing name standardised to **SIMBA AI Tax Assistant** (not Concierge).  
5. Automated suites: **425** Vitest tests (was 212).  

---

## 1. Tax intelligence (150)

| Metric | Result |
|--------|--------|
| Scenarios executed | **150 / 150 PASS** |
| Method | TF-IDF retrieval against curated GOV.UK corpus (not invented figures) |
| Topics | SA, MTD, VAT, landlords, CIS, freelancers/sole traders, directors, employment, multi-income, allowances, deadlines, tax-year, CGT/crypto, NIC, Scottish IT, IR35 overview, pensions, Gift Aid, capital allowances |
| Official refs | Each transcript cites `source_url` on GOV.UK |
| Transcripts | [`tax_intelligence_150_transcripts.md`](./intelligence_audit/tax_intelligence_150_transcripts.md) |
| Fixture | `backend-node/tests/fixtures/tax_intelligence_150.json` |

**Honesty limit:** Answers outside the corpus must refuse to invent figures (prompt + empty-source path). Live OpenAI spot probes confirmed VAT £90k, MTD £30k → 6 April 2027, and inclusions refusal.

Live probes: [`live_openai_sales_probes.md`](./intelligence_audit/live_openai_sales_probes.md)

---

## 2. Package recommendation (50)

| Metric | Result |
|--------|--------|
| Journeys executed | **50 / 50** |
| Behaviour | Qualifying guided paths + free-text circumstance selection |
| Not most expensive by default | Enforced (`primaryRecommendationIsNotMostExpensive`) |
| Inclusions | Always `not_specified_in_catalog` — no invented feature lists |
| Transcripts | [`package_journeys_50_transcripts.md`](./intelligence_audit/package_journeys_50_transcripts.md) |

Examples verified live:

- First-time sole trader → **SA_SIMPLE + SA_SMART** (not Elite alone)  
- Existing client → **no packages**; dashboard messaging  
- Inclusions question → explicit refusal to invent  
- Consultation → **£99 / 30 minutes**

---

## 3. Pricing (approved catalogue)

| Offer | Amount | Status |
|-------|--------|--------|
| SA Simple / Smart / Elite | £119 / £149 / £299 per tax year | **PASS** |
| MTD Starter / Growth / Complete | £29.99 / £59.99 / £89.99 monthly **VAT included** | **PASS** |
| Private accountant consultation | £99 / 30 minutes / Google Meet (booking stub) | **PASS** |

---

## 4–6. Conversion, existing clients, conversation quality

| Check | Status |
|-------|--------|
| Package/registration click ≠ verified purchase | **PASS** |
| No “payment successful” claims without Stripe | **PASS** / Stripe **BLOCKED** |
| Existing client → dashboard messaging | **PASS** |
| Decline sales → no packages | **PASS** |
| Multi-turn memory (MTD £30k → 2027) | **PASS** |
| Uncertainty / not personalised advice disclaimer | **PASS** |

---

## 7. Security (reconfirmed)

| Control | Status |
|---------|--------|
| Prompt injection scrubbing | PASS (suite) |
| PII redaction | PASS |
| Rate limiting | PASS |
| Session isolation / delete | PASS |
| OpenAI key absent from bootstrap | PASS |
| Incorrect analytics conversion events rejected | PASS |

---

## 8–9. Technology & website compatibility

| Check | Status |
|-------|--------|
| Express/TS Node `npm run build && npm start` | PASS |
| Python process required? | **No** (vendored `backend-node/data/**`) |
| Emerald Signature UI / mobile nav retained | PASS |
| Customer-facing name | **SIMBA AI Tax Assistant** |
| Portal / taxotools / auth / checkout / dashboard code | **Unchanged** (0 external files) |

---

## 10. Proof index

| Artifact | Path |
|----------|------|
| This report | `docs/verification/COMPREHENSIVE_INTELLIGENCE_SALES_AUDIT.md` |
| Vitest 425 log | `docs/verification/intelligence_audit/vitest_425_results.txt` |
| Tax 150 transcripts | `docs/verification/intelligence_audit/tax_intelligence_150_transcripts.md` |
| Package 50 transcripts | `docs/verification/intelligence_audit/package_journeys_50_transcripts.md` |
| Live OpenAI probes | `docs/verification/intelligence_audit/live_openai_sales_probes.md` |
| Screenshots | `docs/verification/intelligence_audit/screenshots/` |
| Demo video | `docs/verification/intelligence_audit/simba_intelligence_sales_demo.webm` |
| Toxel handover | `docs/toxel/NODE_DEPLOYMENT_HANDOVER.md` |
| Prior independent verification | `docs/verification/FINAL_INDEPENDENT_VERIFICATION.md` |

---

## Remaining blockers (explicit)

1. **Stripe** checkout + webhooks (verified purchase) — **BLOCKED**  
2. **Calendly / Google Meet** £99 booking confirmation — **BLOCKED**  
3. **Registration / email verification** — **BLOCKED**  
4. **Authenticated dashboard messaging** end-to-end — **BLOCKED**  
5. **Live website embedding** on taxsimba.co.uk — **BLOCKED**  
6. **Approved package inclusions** text from TaxSimba catalogue — **BLOCKED** (assistant correctly refuses to invent)

---

## Recommendation for approval

Approve **controlled Toxel HTTPS staging** of Node `backend-node`.  
Keep Python in-repo. Do **not** merge to production or delete Python until staging acceptance and the BLOCKED integrations are genuinely verified.
