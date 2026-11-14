# SIMBA AI V2 — Final Independent Verification & Evidence Audit

**Date:** 2026-11-13 (Europe/London)  
**PR:** [#35](https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/35)  
**Branch tip (pre-this-doc commit):** see git after push  
**Scope:** Node.js runtime under `ai-tax-concierge-v2/backend-node/`  
**Rules:** NO MERGE · NO DEPLOY · NO PYTHON DELETION  

This audit re-executed checks against the **running compiled Node server** with **Python stopped**.

---

## FINAL DECISION

### **READY FOR TOXEL STAGING** (with explicit BLOCKED integration items)

Local Node parity, live OpenAI accuracy, production build/start without Python process, widget evidence, security probes, and portal-tree isolation all **PASS**.  
Stripe, Calendly/Meet, registration/dashboard auth, and live website embedding remain **BLOCKED** until Toxel HTTPS staging.

---

## 1. Automated tests (re-run)

```bash
cd ai-tax-concierge-v2/backend-node && npm test
```

| Result | Evidence |
|--------|----------|
| **212 passed / 0 failed** (19 files) | [`final_audit/vitest_212_results.txt`](./final_audit/vitest_212_results.txt) |

---

## 2. Live OpenAI (33 scenarios, re-run)

```bash
export CONCIERGE_FORCE_MOCK_LLM=false
npm run live:openai
```

| Metric | Result |
|--------|--------|
| Status | COMPLETED |
| Single-turn | **33 / 33 live** |
| Accuracy flags | **0** |
| Model | `gpt-4o-mini` |
| Key | present (length only logged) |
| Report JSON | [`live_openai_report_20261113T133633Z.json`](./live_openai_report_20261113T133633Z.json) |
| Redacted Q&A | [`final_audit/live_openai_redacted_qa.md`](./final_audit/live_openai_redacted_qa.md) |
| Harness stdout | [`final_audit/live_openai_harness_summary.txt`](./final_audit/live_openai_harness_summary.txt) |

Corpus spot-checks across reply excerpts: **£90,000 present**, **£85,000 absent**, **2027 (MTD £30k band) present**.

---

## 3. Python completely stopped — Node independent

| Check | Result | Evidence |
|-------|--------|----------|
| `http://127.0.0.1:8090/api/v1/health` | **DOWN** | `final_audit/security_runtime_probes.txt` |
| Process | `node dist/server.js` only (no uvicorn/tsx) | `final_audit/production_startup.log` |
| Start command | `npm run build && npm start` (PORT=8091) | same |
| Data files | **Vendored copies** under `backend-node/data/` (symlinks removed this audit) | `find data -type l` → 0 |

---

## 4. Desktop / mobile Emerald Signature UI

Screenshots: [`final_audit/screenshots/`](./final_audit/screenshots/) · also `/opt/cursor/artifacts/audit_*.png`

| # | View | File | Status |
|---|------|------|--------|
| 1 | Launcher closed | `01_launcher_closed.png` | PASS |
| 2 | Launcher open | `02_launcher_open.png` | PASS |
| 3 | Desktop sidebar welcome | `03_desktop_welcome_sidebar.png` | PASS |
| 4 | Guided Help | `04_guided.png` | PASS |
| 5 | Guided journey started | `05_guided_started.png` | PASS |
| 6 | Calculators | `06_calculators.png` | PASS |
| 7 | Packages | `07_packages.png` / `07b_packages_full.png` | PASS |
| 8 | Consultation | `08_consultation.png` | PASS |
| 9 | FAQs | `09_faqs.png` | PASS |
| 10 | Grounded VAT chat | `10_chat_vat_grounded.png` | PASS |
| 11 | Error state | `11_error_state.png` | PASS |
| 12–14 | Mobile welcome / drawer / packages | `12`–`14_*.png` | PASS |

**Video (playable):** [`final_audit/simba_final_audit_e2e_demo.webm`](./final_audit/simba_final_audit_e2e_demo.webm) · `/opt/cursor/artifacts/simba_final_audit_e2e_demo.webm`  
Verified: MTD £30k → **6 April 2027** answer completed; Guided/Packages/Consultation/FAQs/Calculators visited.

**17 calculators:** bootstrap returns **17 / 17** `live_verified` (runtime probe).

**Note (parity, not fail):** Free-text chat while a guided journey is active continues the journey step (same as Python engine). Clean free chat requires no incomplete journey in session.

---

## 5. Prices (runtime bootstrap)

From Node `GET /api/v1/bootstrap` with Python down:

| Offer | Verified |
|-------|----------|
| SA | **£119 / £149 / £299** |
| MTD | **£29.99 / £59.99 / £89.99** · **VAT included** |
| Consultation | **£99** · **30 minutes** |

---

## 6. Official rule checks (corpus + live)

| Rule | Status | Evidence |
|------|--------|----------|
| VAT threshold £90,000 | PASS | Live Q&A + Vitest grounding + screenshot |
| VAT rolling 12-month + 30-day forward look | PASS | Corpus + live VAT answers |
| MTD >£50k → 6 Apr 2026 | PASS | Vitest + live |
| MTD >£30k → 6 Apr 2027 | PASS | Live video + Vitest |
| MTD >£20k → 6 Apr 2028 | PASS | Vitest knowledge suite |
| Stale £85k VAT rejected | PASS | Live corpus check (absent) + grounding guard tests |

---

## 7. Security / privacy / reliability

| Control | Result | Evidence |
|---------|--------|----------|
| Prompt injection (reveal prompt/key) | PASS — answered VAT £90k, no key leak | `final_audit/security_runtime_probes.txt` |
| OpenAI key not in bootstrap/config | PASS | same + curl checks |
| Analytics click ≠ conversion | PASS — `purchase_completed` rejected | same |
| Session delete | PASS | same |
| Multi-turn MTD £30k → 2027 | PASS | same |
| Rate limiter | PASS (Vitest security suite) | vitest log |
| Privacy redaction | PASS (Vitest) | vitest log |
| Widget timeout / offline | PASS (code: AbortController 35s + offline message) | `widget/js/concierge.js` |
| Error UI | PASS | `11_error_state.png` |

---

## 8. Production build / deployment compatibility

| Check | Result |
|-------|--------|
| `npm run build` (`tsc -p tsconfig.build.json`) | PASS — log `final_audit/production_build.txt` |
| `npm start` → `node dist/server.js` | PASS — no `tsx` required at runtime |
| Node ≥20 | PASS |
| JSON data without Python process | PASS after vendoring copies into `backend-node/data/` |
| Widget path via `BACKEND_NODE_ROOT/../widget` | PASS (works from `dist/`) |
| Cursor-specific deps | None required for runtime |
| Symlink dependency on Python tree | **FIXED this audit** (was a staging risk) |

---

## 9. Feature parity matrix (Python vs Node)

| Feature | Python | Node (this audit) | Status |
|---------|--------|-------------------|--------|
| `/api/v1` chat/bootstrap/journeys/sessions/analytics/health | Yes | Yes | **PASS** |
| Live OpenAI + mock | Yes | Yes | **PASS** |
| HMRC grounding + guard | Yes | Yes | **PASS** |
| Guided journeys | Yes | Yes | **PASS** |
| Sidebar / mobile / FAQs / 17 calcs | Yes | Yes | **PASS** |
| Prices SA/MTD/Consult | Yes | Yes | **PASS** |
| Security/privacy/analytics honesty | Yes | Yes | **PASS** |
| Stripe / Calendly / portal auth E2E | Stub | Stub | **BLOCKED** |
| Live website embed | Local only | Local only | **BLOCKED** |

No agreed in-scope feature found **missing** on Node relative to Python for local product behaviour.

---

## 10. Existing TaxSimba platform unchanged

```text
git diff --name-only origin/main...HEAD | grep -v '^ai-tax-concierge-v2/'
→ 0 files (CHANGED_OUTSIDE_SIMBA=0)
```

Portal (`backend/`, `frontend/`), taxotools, auth, checkout, dashboard **not modified** by this PR.

---

## 11. Evidence index (PR paths)

| Artifact | Path |
|----------|------|
| This report | `docs/verification/FINAL_INDEPENDENT_VERIFICATION.md` |
| Vitest log | `docs/verification/final_audit/vitest_212_results.txt` |
| Build log | `docs/verification/final_audit/production_build.txt` |
| Startup log | `docs/verification/final_audit/production_startup.log` |
| Live harness summary | `docs/verification/final_audit/live_openai_harness_summary.txt` |
| Live JSON | `docs/verification/live_openai_report_20261113T133633Z.json` |
| Redacted Q&A | `docs/verification/final_audit/live_openai_redacted_qa.md` |
| Security probes | `docs/verification/final_audit/security_runtime_probes.txt` |
| Screenshots | `docs/verification/final_audit/screenshots/` |
| E2E video | `docs/verification/final_audit/simba_final_audit_e2e_demo.webm` |
| Toxel handover | `docs/toxel/NODE_DEPLOYMENT_HANDOVER.md` |

---

## 12. Toxel handover (summary)

Full doc: [`docs/toxel/NODE_DEPLOYMENT_HANDOVER.md`](../toxel/NODE_DEPLOYMENT_HANDOVER.md)

```bash
cd ai-tax-concierge-v2/backend-node
npm ci
npm run build
export OPENAI_API_KEY=***          # secret store — never commit
export CONCIERGE_FORCE_MOCK_LLM=false
export CONCIERGE_CORS_ORIGINS=https://STAGING_HOST,...
export WEBSITE_BASE_URL=https://www.taxsimba.co.uk
export PORT=8090 HOST=0.0.0.0
npm start
```

Routes: `/api/v1/*`, `/widget/**`. HTTPS at reverse proxy.  
Rollback: point proxy to prior Node image **or** Python uvicorn; Python tree still in repo.

---

## 13. Explicitly BLOCKED until staging integration

| Item | Status |
|------|--------|
| Stripe payments / verified purchase | **BLOCKED** |
| Calendly / Google Meet £99 booking confirmation | **BLOCKED** |
| Registration / email verification | **BLOCKED** |
| Authenticated dashboard messaging | **BLOCKED** |
| Live taxsimba.co.uk website embedding | **BLOCKED** |

---

## Verdict checklist

| Gate | Status |
|------|--------|
| 212 automated tests re-run | **PASS** |
| 33 live OpenAI re-run | **PASS** |
| Node alone (Python stopped) | **PASS** |
| UI desktop/mobile evidence | **PASS** |
| Prices | **PASS** |
| HMRC accuracy checks | **PASS** |
| Security/privacy probes | **PASS** |
| Production build without Python process | **PASS** |
| Platform isolation | **PASS** |
| External integrations | **BLOCKED** |
| Merge / deploy / delete Python | **NOT DONE** (correct) |

### Recommendation for approval

**Approve handoff to Toxel for controlled HTTPS staging** using Node `backend-node`.  
Keep Python in-repo until staging acceptance. Do not merge/deploy to production.
