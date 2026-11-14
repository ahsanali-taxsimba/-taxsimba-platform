# SIMBA AI Concierge V2 — Final audit & pre-deployment handover

**Date:** 2026-11-13 (Europe/London)  
**Repository:** `ahsanali-taxsimba/-taxsimba-platform`  
**PR:** [#35](https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/35) — **do not merge / do not deploy**  
**Scope respected:** SIMBA under `ai-tax-concierge-v2/`; portal catalogue price sync only in `backend/phase1b.py` (+ tests). Frontend / taxotools / Marketing Hub untouched.  
**Latest live key re-run:** [`live_key_rerun_20261113/LIVE_KEY_RERUN_REPORT.md`](./live_key_rerun_20261113/LIVE_KEY_RERUN_REPORT.md)

---

## 1. Executive verdict

**NOT production-ready.**  
Core AI concierge, TaxSimba branding, tax grounding and calculator link map are in good shape for **controlled staging embedding** after Toxel wires Stripe/Calendly/portal.

| Gate | Status |
|------|--------|
| Automated regression (Node Vitest, 2026-11-14) | **PASS — 482 passed / 0 failed** |
| Live OpenAI tax Q&A (Node harness re-run) | **PASS — 33/33, accuracy flags 0** (MTD £30k / VAT £90k) |
| HMRC risk-based auto-publish (owner approval) | **PASS** — Content API + live OpenAI overlay marker proof |
| Catalogue auto-sync without redeploy | **PASS** — implemented + evidenced |
| Brand match TaxSimba.co.uk / design tokens | **PASS** (official logo + `#006B3C` / `#078A4B` / Manrope / Public Sans) |
| Checkout / payment E2E | **BLOCKED** |
| Calendly booking E2E | **BLOCKED** |
| Registration / authenticated dashboard E2E | **BLOCKED** |
| Live website staging embed | **BLOCKED** (local preview only) |

**Release recommendation:** **HOLD.** Approve staging embed only after Toxel completes L4 integrations listed below.

---

## 2. What changed in this audit iteration

- Replaced invented emerald/gold + lion emblem UI with **official TaxSimba logo** and design-system colours/fonts  
- Aligned **17 calculators** to real `taxsimba.co.uk/calculators/*` paths (title-verified)  
- Helpful-first: suppress packages/consultation when visitor declines to buy  
- Route registry now distinguishes `live_verified` / `soft_or_generic` / `stub`  
- Traceability, journey matrix, security review, embedding guide updated  

---

## 3. Automated & live test results

| Suite | Result |
|-------|--------|
| Node `npm test` (Vitest) | **476 passed / 0 failed** |
| Live OpenAI harness (Node, `live_openai_report_20261113T230918Z.json`) | 33 singles + 3 multiturn + 4 journeys; accuracy flags **0** |
| Owner commercial / package / £99 live probe | **11/11 PASS** |
| Helpful-first unit/API tests | **PASS** |
| Public calculator HTTP title checks | **17/17 live_verified** |
| Stripe / Calendly / portal staging E2E | **BLOCKED — not simulated** |

---

## 4. Supporting documents

| Doc | Path |
|-----|------|
| Requirements matrix | `docs/verification/REQUIREMENTS_TRACEABILITY.md` |
| Journey matrix | `docs/verification/CUSTOMER_JOURNEY_MATRIX.md` |
| Security/privacy | `docs/verification/SECURITY_PRIVACY_REVIEW.md` |
| Live OpenAI evidence | `docs/verification/LIVE_OPENAI_EVIDENCE.md` |
| Embedding | `docs/toxel/EMBEDDING.md` |
| Screenshots | `/opt/cursor/artifacts/simba-*.png` (real UI captures) |

---

## 5. External dependencies for Toxel

1. Staging host + HTTPS for API/widget  
2. `OPENAI_API_KEY` in staging secret store (already proven in Cloud Agent)  
3. Stripe test mode + webhooks  
4. Calendly event for £99 / 30-min Google Meet  
5. Portal staging users (new + existing)  
6. Confirm soft routes: `/book-consultation`, `/faqs`, `/articles`, `/register`, `/login`  
7. Monitoring/alerting without PII  

---

## 6. Rollback & monitoring

- Rollback: remove embed script / revert PR branch deploy; force `CONCIERGE_FORCE_MOCK_LLM=true` or unset key  
- Monitor: `/api/v1/health` (`llm_mode`), OpenAI usage budget, 4xx/5xx rates, rate-limit hits  
- Never treat chat package clicks as paid conversions  

---

## 7. Open issues by severity

| Severity | Issue | Status |
|----------|-------|--------|
| High | Payment / booking / portal E2E unverified | Open — BLOCKED |
| High | Human accountant sign-off still advised | Open |
| Medium | Soft/generic marketing routes | Open |
| Medium | In-memory sessions/analytics | Open |
| Low | Unused legacy emblem file retained | Open |

---

## 8. Approval wait

No merge. No deploy. Awaiting approval for any staging host install.
