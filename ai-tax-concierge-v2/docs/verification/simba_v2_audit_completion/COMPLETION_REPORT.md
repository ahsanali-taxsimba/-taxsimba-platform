# SIMBA V2 — Audit-Based Completion Report

**Product baseline:** PR #39 @ `e2b2d6fe5eddf438b372c1c87624e872d73d3856`  
**Completion branch:** `cursor/simba-v2-audit-completion-6522`  
**Depends on:** PR #35 → PR #36 → PR #39  
**Engine of record:** Node `ConversationalEngine` (Python tree = legacy, not competing)  
**Date:** 2026-11-20 (Europe/London)

---

## 1. Requirement traceability matrix

See [`REQUIREMENT_TRACEABILITY_MATRIX.md`](./REQUIREMENT_TRACEABILITY_MATRIX.md).

---

## 2. Confirmed defects and root causes

| Defect | Root cause | Fix |
|--------|------------|-----|
| Compact → workspace lost / duplicated conversation | Client handoff used insecure/weak URL patterns; workspace could auto-drive a turn | Server single-use handoff (`handoff.ts`); widget create/consume; `auto_send: false` |
| Automatic package catalogue on informational asks | `mockPackageReply` triggered on the word “package”; circumstance selection attached cards without ask | Gate via `wantsServiceRecommendation`; expand `NO_BUY`; honour history decline; skip mock catalogue on decline |
| Low-confidence → consultation pressure | Engine attached consult cards when confidence low | Precedence: only explicit consult/callback intent |
| Ops token via query string risk | Auth accepted query token (log/Referer leak) | Header-only `x-concierge-ops-token`; CORS allowlist header |
| T305 heuristic fail (info-only still sold) | Same catalogue path | Fixed; mock 400 now 400/400 **RECORDED** (not tax-PASS) |

---

## 3. Exact code changes

| Path | Change |
|------|--------|
| `backend-node/src/sessions/handoff.ts` | **New** — TTL 120s, SHA-256 hashed token, single-use, draft, used retained until expiry |
| `backend-node/src/routes/sessions.ts` | `POST /handoff`, `POST /handoff/consume` |
| `backend-node/tests/session_handoff.test.ts` | **New** — unit + HTTP round-trip |
| `widget/js/chat-panel.js` | Create handoff before opening workspace; token in `?handoff=` only |
| `widget/js/concierge.js` | Consume once, restore history/draft, strip param, no auto-send |
| `backend-node/src/ai/recommendations.ts` | Recommendation gating + stronger decline language |
| `backend-node/src/ai/prompts.ts` | Decline-aware `mockPackageReply`; answer-shape guidance |
| `backend-node/src/ai/conversational_engine.ts` | History-aware decline; no low-confidence consult dump; lean packages/sources |
| `backend-node/src/ops/auth.ts` | Ops token header-only |
| `backend-node/src/app.ts` | CORS `X-Concierge-Ops-Token` |
| `backend-node/tests/owner_commercial_decisions.test.ts` | Expect no auto-sell without ask |
| `backend-node/scripts/runSimba400Pack.ts` | **New** — mock/live 400 runner |
| `docs/verification/simba_v2_audit_completion/**` | Pack, evidence, matrix, this report |

---

## 4. Tax-rule validation

- Automated corpus/handler suite: **`tax_intelligence_150` 152 tests PASS**.  
- Catalogue prices match intended SA/MTD/consult figures (verified from `packages.json`).  
- Live OpenAI sample T001–T008 recorded with `llm_mode=openai` — **not** accountant-signed.  
- **Asim review required** before any consequential tax claim is production-approved.  
- Rule version / official sources for consequential answers remain those in the Node knowledge corpus + GOV.UK URLs attached by retrieval/handlers — no new invented rules in this pass.

---

## 5. HMRC monitor operational evidence

| Check | Result |
|-------|--------|
| Implementation present | PASS (code) — `knowledge/monitor/service.ts`, ops routes |
| Scheduler / staging cycle | **BLOCKED** — no staging deploy + ops token cycle in this environment |
| Quarantine / approve / reject / rollback / overlay | Code paths exist; **BLOCKED** operational proof |
| Ops auth | PASS (code) — header-only token; not exposed in bootstrap |
| Accountant approval for material statutory change | Process unchanged — required |

**Deployment instruction:** set `CONCIERGE_HMRC_MONITOR_ENABLED=true`, `CONCIERGE_OPS_TOKEN`, writable `CONCIERGE_RUNTIME_DIR`; run `POST /api/v1/ops/hmrc/run` with header `x-concierge-ops-token`; retain audit logs under runtime history. Do **not** claim PASS until that cycle is evidenced on staging.

---

## 6. OpenAI staging evidence

| Environment | Result |
|-------------|--------|
| Cloud Agent (this run) | **PASS** — `LIMIT=8 LIVE=1` → 8/8 RECORDED, `llm_mode=openai` (`evidence/simba_400_results_live_latest.json`) |
| TaxSimba staging host | **BLOCKED** — separate config; not accessible here |

Model default remains `gpt-4o-mini` unless owner-approved change. Credentials not logged.

---

## 7. Package catalogue verification

| Code | Name | Price | Billing | Note |
|------|------|-------|---------|------|
| SA_SIMPLE | Self Assessment Simple | £119 | per tax year | |
| SA_SMART | Self Assessment Smart | £149 | per tax year | |
| SA_ELITE | Self Assessment Elite | £299 | per tax year | |
| MTD_STARTER | Simbian Comply | £29.99 | per month | VAT included |
| MTD_GROWTH | Simbian Growth | £59.99 | per month | VAT included |
| MTD_COMPLETE | Simbian Elite | £89.99 | per month | VAT included |
| ACCOUNTANT_CONSULT_99 | Quick Tax Advice | £99 | one-off | 20 minutes |
| ACCOUNTANT_CONSULT_149 | Extended Tax Consultation | £149 | one-off | 40 minutes |

Recommendations use approved catalogue only; cards attach when customer asks (or consult intent), not on bare circumstance facts.

---

## 8. Security and privacy review

| Topic | Status |
|-------|--------|
| Handoff token opacity / single-use / TTL | PASS (code + tests) |
| No conversation body in URL | PASS |
| Ops token not in query / not in frontend bootstrap | PASS (code) |
| Prompt-injection / privacy unit tests | PASS (`security_suite`, `privacy`) |
| Lead follow-up permission required | PASS (code) |
| SMTP contents | Avoids dumping full tax detail; summary fields capped |
| Multi-instance lead FS durability | **BLOCKED** recommendation — shared volume or approved DB before multi-node |
| PII redaction / session isolation | Unit coverage PASS; staging access review **Blocked** |

---

## 9. Complete 400-question results

| Mode | Total | RECORDED | HEURISTIC_FAIL | ERROR | Evidence |
|------|-------|----------|----------------|-------|----------|
| Mock (full) | 400 | 400 | 0 | 0 | `evidence/simba_400_results_mock_latest.json` (+ compact) |
| Live OpenAI sample | 8 | 8 | 0 | 0 | `evidence/simba_400_results_live_latest.json` |

- Pack: `packs/simba_400_questions.json` — IDs **T001–T400**; multi-turn **T301–T320**.  
- Pack contains **questions only** — no verified answer key.  
- **RECORDED ≠ tax-accuracy PASS.** Accountant acceptance criteria still required.  
- Running the pack does **not** train OpenAI.

Acceptance criteria stub: [`ACCEPTANCE_CRITERIA_400.md`](./ACCEPTANCE_CRITERIA_400.md).

---

## 10. Integration PASS / FAIL / BLOCKED / MOCK

| Integration | Classification | Notes |
|-------------|----------------|-------|
| OpenAI (agent env) | **PASS** | Live sample evidence |
| OpenAI (staging host) | **BLOCKED** | No staging access |
| HMRC monitoring cycle | **BLOCKED** | Code only |
| Secure HMRC ops auth | **PASS** (code) | Operational use **BLOCKED** |
| SMTP lead mail | **BLOCKED** | Outbox path unit-tested |
| Lead persistence (single node FS) | **PASS** (code) | Multi-node **BLOCKED** |
| Calendly | **BLOCKED** | |
| Consultation payment | **BLOCKED** | |
| Google Meet confirmation | **BLOCKED** | |
| Portal registration / email verify / checkout / dashboard | **BLOCKED** | |
| Catalogue configuration | **PASS** | Prices verified |
| HTTPS / CORS / embed on staging | **BLOCKED** | |
| Mobile / desktop real browsers | **BLOCKED** | Automated widget tests only |
| Vitest suite | **PASS** | 524/524 |
| Mock LLM paths | **MOCK** | Intentional for regression |

---

## 11. Mobile and desktop evidence

- Automated widget/accessibility tests: **PASS** (unit).  
- Real device / staging browser matrix (refresh, back, multi-tab, mobile keyboard): **BLOCKED** — requires staging URL.

---

## 12. Remaining genuine blockers

Listed in the matrix “Consolidated genuine blockers” — staging access, HMRC ops cycle, SMTP, Calendly/payment/Meet, portal E2E, Asim tax sign-off, Toxel deploy approval, multi-node leads.

---

## 13. GitHub merge plan

1. Keep **PR #39** as product baseline; do not merge Python competing backends.  
2. Merge/stack **this completion PR** onto `cursor/simba-v2-final-corrected-6522` after review.  
3. Ensure #35 and #36 (or their landed equivalents) remain ancestors of #39 before production promote.  
4. Do **not** merge to `main` / production without Toxel + Asim gates.  
5. Rollback: redeploy previous #39 tip `e2b2d6f` image/commit; disable monitor via env; revoke `CONCIERGE_OPS_TOKEN` if compromised.

---

## 14. Toxel deployment and rollback handover

Follow existing staging instructions in `docs/verification/simba_v2_final_corrected/STAGING_DEPLOYMENT_INSTRUCTIONS.md`, plus:

```bash
git fetch origin cursor/simba-v2-audit-completion-6522
git checkout cursor/simba-v2-audit-completion-6522
cd ai-tax-concierge-v2/backend-node
npm ci && npm test && npm run build
# set staging secrets (names only — never commit values)
# CONCIERGE_FORCE_MOCK_LLM=false
# OPENAI_API_KEY, CONCIERGE_OPS_TOKEN, CONCIERGE_HMRC_MONITOR_ENABLED=true
# CONCIERGE_CORS_ORIGINS=<exact origins>, CONSULTATION_BOOKING_LIVE=false until approved
npm start
```

**Post-deploy checks:** `/api/v1/health` → `llm_mode=openai`; handoff create/consume; one live chat; ops HMRC run with header token; no ops token in browser network for widget calls.

**Rollback:** redeploy image/commit `e2b2d6fe5eddf438b372c1c87624e872d73d3856`; confirm health; flush CDN if widget assets cached.

---

## 15. Final GO / NO-GO

### **NO-GO for production**

Critical automated regressions for this completion pass are green (524 tests; mock 400 heuristics; handoff; live OpenAI sample). Staging operational gates, accountant tax sign-off, and real customer-journey E2E remain open. Production stays on **HOLD** until §13 gates in the command are met.
