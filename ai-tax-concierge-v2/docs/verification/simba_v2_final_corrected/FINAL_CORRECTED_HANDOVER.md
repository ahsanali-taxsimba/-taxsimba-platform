# SIMBA V2 — Final Corrected Handover (Audit Remediation)

**Date:** 2026-11-17 (Europe/London)  
**Branch:** `cursor/simba-v2-final-corrected-6522`  
**Baseline:** PR #36 `cursor/simba-final-toxel-handover-6522` @ `5cea956`  
**Commit SHA:** *(filled after commit — see git tip of this branch)*  
**PR base:** `cursor/simba-final-toxel-handover-6522`  
**Production:** **HOLD** — do not merge to `main`, do not deploy production.

Preserves valid PR #35/#36 runtime: `knowledge/monitor/*` and `catalog/sync/*` (no duplicate engines). TaxSimba portal and unrelated backend services were not modified.

---

## 1. Full list of fixes

### 1.1 Public catalogue / bootstrap / package cards — metadata allowlist
- Added `src/catalog/public.ts` with an explicit customer-approved field allowlist.
- Public `/api/v1/catalog/packages`, bootstrap package payload and package cards strip: `owner_decisions`, inclusion status maps, approval-matrix / remaining-decision / proposed-copy docs, internal code notes, raw disclaimers, workflow statuses.
- Package cards expose only approved inclusion lines; public `inclusions_status` is `approved` or `not_listed` (no internal workflow labels).
- Bootstrap no longer exposes internal counters / logo provenance fields customers should not see.
- Consultation honesty: `booking_available: false` until `CONSULTATION_BOOKING_LIVE=true` with a non-example URL; `free_callback_available: false`.

### 1.2 Customer-facing LLM catalogue context
- `packageCatalogText()` rewritten to approved customer facts only (Simbian names, prices, VAT-included MTD, Xero mapping, booking honesty).
- Removed internal mapping language (`MTD_STARTER` labels as customer names, raw disclaimers, owner-decision prose).
- `scrubCustomerReply()` strips accidental internal phrases from model output.

### 1.3 Deterministic MTD eligibility (model cannot override)
- New `src/knowledge/mtd_eligibility.ts`:
  - Exact £50,000 / £30,000 / £20,000 are **not** “more than” (exclusive thresholds).
  - Band mapping: >£50k in 2024-25 → 6 Apr 2026; >£30k in 2025-26 → 6 Apr 2027; >£20k in 2026-27 → 6 Apr 2028.
  - Qualifying income = gross/turnover (not profit) — asks one clarifying question when profit is cited.
  - PAYE-only and limited-company boundaries handled deterministically.
- `ConversationalEngine` short-circuits handled MTD eligibility **before** LLM generation.

### 1.4 Conversation quality
- Prompts: concise British English, answer first, one clarifying question, natural lowest-suitable package suggestion, no internal implementation leakage.
- Honest consultation / free-callback replies (no live booking or free callback advertising).
- VAT grounding restored: £90,000 — do not use remembered £85,000.

### 1.5 Package prices / inclusions / VAT / Xero
- Verified prices retained: SA £119 / £149 / £299; Simbian £29.99 / £59.99 / £89.99 VAT included.
- Xero mapping: Comply→Simple, Growth→Ignite, Elite→Grow; customers do not pay separately.
- Will not invent forever-free Xero, phone helpline, priority support, QBRs, proactive tax planning, free callbacks.

### 1.6 Environment / auth / CORS / rate limit / monitoring
- Staging/production refuse wildcard CORS (`*`).
- `safePublicConfig()` omits model id in production-like envs; never exposes secrets; payment unavailable; free callback false.
- Public catalogue routes use `publicApiLimiter`.
- Version `0.4.1`.
- HMRC monitor + catalogue sync architecture **preserved** under existing paths (scheduling, ops token auth, safe publication, failure handling unchanged in design).

### 1.7 Branding
- TaxSimba logo / SIMBA AI naming / widget desktop+mobile paths retained.

---

## 2. Automated test evidence

| Suite | Result | Evidence |
|-------|--------|----------|
| Vitest full | **502/502 PASS** | `evidence/vitest_full.txt` |
| Typecheck (`tsc --noEmit`) | **PASS** | `evidence/typecheck.txt` |
| Build (`tsc -p tsconfig.build.json`) | **PASS** | `evidence/build.txt` |
| Security suite | **26/26 PASS** | `evidence/remediation_regression.txt` |
| Public allowlist regression | **5/5 PASS** | same |
| Deterministic MTD unit | **10/10 PASS** | same |
| Conversation quality remediation | **5/5 PASS** | same |
| Live MTD eligibility probe (engine + OpenAI adapter configured) | **8/8 PASS** | `evidence/live_mtd_eligibility_latest.json` |
| Catalogue/bootstrap leak + multi-turn smoke | **PASS** (0 leaks) | `evidence/catalogue_bootstrap_multiturn_smoke.json` |

### New / updated regression tests
- `tests/mtd_eligibility.test.ts`
- `tests/public_catalogue_allowlist.test.ts`
- `tests/conversation_quality_remediation.test.ts`
- Existing suite expectations updated for approved public inclusions (no longer expect null inclusions + internal status strings).

### Live MTD cases (all PASS)
1. Exact £50k 2024-25 — not in scope  
2. Over £50k → April 2026  
3. Exact £30k 2025-26 — exclusive  
4. Over £30k → April 2027 (not 2026)  
5. Exact £20k 2026-27 — exclusive  
6. PAYE-only — out of scope  
7. Limited company — boundary  
8. Profit cited — asks for gross/qualifying income  

Note: handled eligibility answers are deterministic short-circuits (correct by design — the model cannot override). Adapter was live OpenAI-capable (`llm_mode: openai`).

---

## 3. Remaining external dependencies (blockers for production)

1. **HTTPS staging host** with TLS terminator and approved CORS origins (not yet owned by this branch).
2. **Toxel** to wire live Calendly / booking (`CONSULTATION_BOOKING_LIVE` + real URL) before advertising booking.
3. **Ops token + runtime dir** on staging with HMRC monitor + catalogue sync **enabled** (live www previously had them off / env=development).
4. **Owner acceptance** of package copy, consultation flow, and tax answers on HTTPS staging.
5. **Broader live OpenAI tax-answer validation** beyond MTD boundary probe (`npm run live:openai`) on staging with non-mock key.
6. **No live payments** — payment remains unavailable by design until separately approved.

---

## 4. Architecture preservation check

| System | Path | Status |
|--------|------|--------|
| HMRC / GOV.UK knowledge monitor | `src/knowledge/monitor/*` | Preserved |
| Catalogue synchronisation | `src/catalog/sync/*` | Preserved |
| Widget / branding | `widget/` + bootstrap logo | Preserved |
| TaxSimba portal / unrelated services | — | **Not modified** |

---

## 5. Production HOLD conditions

Do **not** merge to `main` or deploy production until **all** of:
- [ ] HTTPS staging embed verified (desktop + mobile widget)
- [ ] CORS locked to exact origins (no `*`)
- [ ] HMRC monitor + catalogue sync enabled with ops auth and alert path tested
- [ ] Live OpenAI tax suite + MTD probe green on staging
- [ ] Catalogue/bootstrap leak scan green on staging URL
- [ ] Owner sign-off on packages, consultation honesty, and MTD answers
- [ ] Explicit written lift of this HOLD
