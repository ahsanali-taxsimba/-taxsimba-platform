# SIMBA AI — Python vs Node.js Parity Report

**PR:** [#35](https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/35)  
**Date:** 2026-11-13 (Europe/London)  
**Node path:** `ai-tax-concierge-v2/backend-node/`  
**Python path (retained):** `ai-tax-concierge-v2/backend/`  
**Widget (unchanged):** `ai-tax-concierge-v2/widget/`  

**Release:** DO NOT MERGE · DO NOT DEPLOY · DO NOT DELETE PYTHON

---

## Executive result

| Gate | Result |
|------|--------|
| Node Vitest (mapped to Python behaviours) | **212 passed / 0 failed** |
| Node live OpenAI harness | **33/33 live**, accuracy flags **0** |
| Widget served from Node `/widget` | **PASS** |
| `/api/v1` contract preserved | **PASS** |
| Shared JSON corpora/catalogues (symlinks) | **PASS** |
| SA £119/£149/£299 · MTD £29.99/£59.99/£89.99 VAT incl. · Consult £99 | **PASS** |
| Stripe / Calendly / registration / dashboard / live embed | **BLOCKED** (Toxel staging) |
| Overall Node parity for in-scope product | **PASS** (local) |
| Production cutover | **HOLD** |

---

## A. Architecture comparison

| Layer | Python | Node |
|-------|--------|------|
| Runtime | FastAPI + uvicorn `:8090` | Express + TypeScript `:8091` (dual-run default) |
| Validation | Pydantic | Zod (422 on chat validation) |
| LLM | `openai` AsyncOpenAI | `openai` Node SDK |
| Knowledge | `app/knowledge/**` + corpus JSON | Port + **symlinks** to same JSON |
| Catalogs / journeys / routes | JSON under `backend/app/` | Same files via `backend-node/data/*` |
| Widget | Mounted `/widget` | Mounted `/widget` (same files) |
| Tests | pytest | Vitest + Supertest |

---

## B. Feature parity matrix

Statuses: **PASS** / **FAIL** / **BLOCKED** / **PARTIAL**

| Feature | Python | Node | Status |
|---------|--------|------|--------|
| Live OpenAI chat | PASS | PASS (33/33) | **PASS** |
| Mock LLM | PASS | PASS | **PASS** |
| HMRC/GOV.UK grounding + guard | PASS | PASS (Vitest + live) | **PASS** |
| Tax-year awareness | PASS | PASS | **PASS** |
| MTD £50k/2026, £30k/2027, £20k/2028 | PASS | PASS | **PASS** |
| VAT £90k + rolling / 30-day | PASS | PASS | **PASS** |
| Guided journeys | PASS | PASS | **PASS** |
| Sidebar panels (6) via widget | PASS | PASS (Node-served) | **PASS** |
| Mobile nav / drawer | PASS | PASS | **PASS** |
| 17 calculators live_verified | PASS | PASS | **PASS** |
| Package recommendations / prices | PASS | PASS | **PASS** |
| £99 consultation hint (stub booking) | PASS | PASS | **PASS** |
| FAQs / existing-client guidance (widget) | PASS | PASS | **PASS** |
| Privacy redaction + session delete | PASS | PASS | **PASS** |
| Injection scrub + rate limit | PASS | PASS | **PASS** |
| Analytics clicks ≠ conversions | PASS | PASS | **PASS** |
| Emerald Signature UI | PASS | Unchanged | **PASS** |
| Stripe checkout E2E | BLOCKED | BLOCKED | **BLOCKED** |
| Calendly / Google Meet E2E | BLOCKED | BLOCKED | **BLOCKED** |
| Registration / email verify | BLOCKED | BLOCKED | **BLOCKED** |
| Authenticated dashboard | BLOCKED | BLOCKED | **BLOCKED** |
| Live taxsimba.co.uk embed | BLOCKED | BLOCKED | **BLOCKED** |

---

## C. Automated tests

### Python (reference — still available)
```bash
cd ai-tax-concierge-v2/backend && source .venv/bin/activate
pytest -q
# Prior evidence: 212 passed
```

### Node (parity suite)
```bash
cd ai-tax-concierge-v2/backend-node
npm test
# 2026-11-13: Test Files 19 passed · Tests 212 passed
```
Log: `/tmp/node_vitest_pr35.txt`

Suites include: API, regression, phase2, journeys, knowledge accuracy, grounding VAT/MTD fixes, recommendations/prices, helpful-first, security, privacy, tax year, conversational engine, multiturn, widget accessibility/sidebar markers.

---

## D. Live OpenAI (Node)

```bash
cd ai-tax-concierge-v2/backend-node
export CONCIERGE_FORCE_MOCK_LLM=false   # and OPENAI_API_KEY set server-side
npm run live:openai
```

| Metric | Result |
|--------|--------|
| Report | `docs/verification/live_openai_report_20261113T132409Z.json` |
| Single-turn | **33 / 33 live** |
| Accuracy flags | **0** |
| Connectivity | OK · `gpt-4o-mini` |
| Key | Present (length only; never logged in full) |

Regression covered: VAT £90k (not £85k), MTD £30k → 6 April 2027 (not 2026), package prices, no invented inclusions.

---

## E. Visual evidence (Node-served widget)

Screenshots: `docs/verification/screenshots-node/`  
Also under `/opt/cursor/artifacts/node-*.png`

| Evidence | File |
|----------|------|
| Launcher closed/open | `node-desktop-launcher-closed.png`, `node-desktop-launcher-open.png` |
| Sidebar welcome | `node-desktop-sidebar-welcome.png` |
| Grounded long answer | `node-desktop-long-answer.png` |
| Packages / consultation / calculators / guided | `node-desktop-*.png` |
| Mobile welcome / drawer | `node-mobile-welcome.png`, `node-mobile-drawer.png` |
| Journey recording | `docs/verification/recordings/simba_node_visitor_journey_demo.webm` · `/opt/cursor/artifacts/simba_node_visitor_journey_demo.webm` |

Health at capture: `llm_mode=openai`, `version=0.3.0`, port **8091**.

---

## F. Dual-run commands

```bash
# Terminal A — Python reference (optional)
cd ai-tax-concierge-v2/backend && source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8090

# Terminal B — Node (recommended primary for next staging)
cd ai-tax-concierge-v2/backend-node
export CONCIERGE_FORCE_MOCK_LLM=false
PORT=8091 npm start
# Preview: http://127.0.0.1:8091/widget/preview.html
```

Python is **not** deleted.

---

## G. Remaining Toxel work (BLOCKED)

1. HTTPS staging host pointing at **Node** SIMBA (`backend-node`)  
2. Embed `embed.js` with staging `data-api-base` on staging website (not production)  
3. Stripe test checkout + webhook → verified conversion events only  
4. Calendly £99 / 30-min Google Meet  
5. Portal registration / email verify / existing-client messaging  
6. Confirm soft routes + package inclusions  
7. Cutover plan: Node PORT 8090 (or ingress) → retire Python only after staging sign-off  

Handover: `docs/toxel/NODE_DEPLOYMENT_HANDOVER.md`

---

## H. Recommendation

**Approve Node as the SIMBA runtime for controlled staging.**  
Keep Python in-repo as behavioural fallback until Toxel staging E2E passes.  
**Do not merge to production main as “live”, do not deploy to taxsimba.co.uk, do not delete Python yet.**
