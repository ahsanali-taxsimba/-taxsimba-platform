# SIMBA AI — Final Architecture Decision Record (Node.js)

**Decision status:** PROPOSED — awaiting Toxel / stakeholder approval  
**PR:** [#35](https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/35)  
**Branch tip reference:** `cursor/ai-tax-concierge-v2-phase1-0f84`  
**Date:** 2026-11-13 (Europe/London)  

**Hard rules for this document**
- Do **not** begin the Node migration until this ADR is approved.
- Do **not** merge or deploy PR #35.
- Detailed file mapping and checklists: [`PYTHON_TO_NODE_MIGRATION_PLAN.md`](./PYTHON_TO_NODE_MIGRATION_PLAN.md).

---

## Decision summary (recommended)

| Decision | Recommendation |
|----------|----------------|
| Target runtime | **Node.js ≥ 20** (TypeScript) for SIMBA API |
| Framework | **Express + Zod + Vitest** (matches existing Toxel Node Express usage in taxotools) |
| Layout | Isolated `ai-tax-concierge-v2/backend-node/` — **not** merged into portal or taxotools on day one |
| UI | **Freeze** `widget/` (vanilla JS/CSS/HTML) — preserve Emerald Signature + sidebar |
| Contract | Preserve `/api/v1/*` and `/widget/**` exactly |
| Data | Reuse existing JSON corpora/catalogues/journeys unchanged |
| Cutover | Dual-run vs Python reference → parity PASS → retire Python SIMBA backend |
| Portal integration | **Later**: optional mount behind same ingress / shared auth when portal Node exists; not a blocker for SIMBA Node parity |

---

## 1. Exact backend architecture and language inventory

### 1.1 TaxSimba platform (comparison baseline)

| Component | Path | Language / stack today |
|-----------|------|------------------------|
| Client portal API | `/backend` (`server.py`, `mtd.py`, `phase1b.py`, …) | **Python FastAPI + MongoDB** |
| Client portal UI | `/frontend` | React (CRA) |
| Planned portal Node port | `memory/NODE_HANDOVER.md` + checklist/map | **Spec only — not implemented** |
| Taxotools API | `taxotools/taxotools-backend` | **Node Express (ESM)** |
| Taxotools SaaS | `taxotools/apps/*` | **Node ≥20, Next.js/TS, Vitest** |
| SIMBA concierge | `ai-tax-concierge-v2/` | **Python FastAPI API + vanilla JS widget** |

**Critical fact for approval:** TaxSimba’s **production portal backend is still Python**. Toxel’s Node.js mandate is the **target platform direction**. SIMBA must move to Node now as an isolated service that is compatible with that direction — without waiting for, or blocking on, the full portal Node rewrite.

### 1.2 SIMBA today (evidence)

```
Website / preview page
   └─ widget/embed.js  (JS) ──iframe──▶ widget/index.html + concierge.js + CSS
                                              │
                                              ▼  /api/v1/*
                                    Python FastAPI (uvicorn :8090)
                                       ├─ OpenAI adapter (server key)
                                       ├─ Knowledge JSON + grounding
                                       ├─ Journeys / catalogs / routes
                                       ├─ Sessions + analytics (in-memory)
                                       └─ Security (injection, rate limit, privacy)
```

| Language | SIMBA role | Count / evidence |
|----------|------------|------------------|
| Python | Entire backend + tests + scripts | **68** `.py` files |
| JavaScript | Embed + concierge UI logic | **2** files (`embed.js`, `concierge.js`) |
| HTML/CSS | Shell + Emerald Signature | `index.html`, `preview.html`, `concierge.css` |
| JSON | Tax facts, packages, calculators, journeys, routes | **8** product data files under `backend/app/` |

---

## 2. All Python modules requiring migration to Node.js

### 2.1 Runtime application (must port)

| Area | Python paths |
|------|----------------|
| Entry / static mount | `backend/app/main.py` |
| Config / errors / privacy | `backend/app/core/{config,errors,privacy}.py` |
| Schemas | `backend/app/models/schemas.py` |
| HTTP routes | `backend/app/api/routes/{health,chat,journeys,catalog,sessions,analytics}.py` |
| Conversation engine | `backend/app/ai/{conversational_engine,prompts,recommendations}.py` |
| LLM + stubs | `backend/app/adapters/{base,factory,llm_openai,llm_mock,stubs}.py` |
| HMRC grounding | `backend/app/knowledge/{loader,retrieval,verification,grounding,tax_year}.py` |
| Guided journeys | `backend/app/journeys/engine.py` |
| Catalogs / website routes | `backend/app/catalog/service.py`, `backend/app/routes_registry/service.py` |
| Security | `backend/app/security/{injection,ratelimit}.py` |
| Sessions / analytics | `backend/app/sessions/store.py`, `backend/app/analytics/events.py` |

### 2.2 Tests & scripts (must reimplement as Node equivalents)

- `backend/tests/conftest.py` + all `test_*.py` (19 suites; **212** pytest assertions currently green)
- `backend/scripts/live_openai_verification.py` (33 live cases)
- Optional later: `scripts/capture_final_evidence.py` (Playwright; may remain Python tooling or move to JS)

### 2.3 Do **not** “migrate” (keep as shared data / UI)

| Asset | Reason |
|-------|--------|
| `widget/**` | Already JS; approved UX |
| `*/packages.json`, `calculators.json`, `starters.json` | Language-agnostic |
| `journeys/definitions.json` | Language-agnostic |
| `routes_registry/routes.json` | Language-agnostic |
| `knowledge/corpus/*.json` | Language-agnostic — **source of tax-rule truth** |

---

## 3. Recommended Node.js framework and TaxSimba backend integration

### 3.1 Framework choice

**Recommend: Express + TypeScript + Zod + Vitest + official `openai` SDK**

| Option | Pros | Cons |
|--------|------|------|
| **Express + TS (recommended)** | Already used by Toxel in `taxotools-backend`; simple static + API; wide ops familiarity | Slightly more boilerplate than Fastify |
| Fastify + TS | Strong schemas/perf | Extra framework vs current Toxel Express footprint |
| NestJS | Heavy structure | Overkill for isolated concierge; slower port |

### 3.2 Integration with existing TaxSimba backend

**Phase A — Isolated service (approve now)**  
- Deploy SIMBA Node beside portal (separate process/port, e.g. 8090).  
- Ingress routes `/simba/api/*` or host `simba-api…` → Node; `/widget` static from same service.  
- Website embed uses `data-api-base` → SIMBA Node origin.  
- **No** coupling to portal Mongo/JWT for public chat.

**Phase B — Platform alignment (after portal Node exists)**  
- Optionally reverse-proxy SIMBA under the same TaxSimba API host.  
- Optionally add authenticated “existing client” mode using portal JWT cookies — **only** when portal Node auth is live and contracted.  
- Shared secrets store / CORS / logging conventions from `memory/NODE_HANDOVER.md`.

**Do not** implement SIMBA inside `/backend` Python, and **do not** put it inside taxotools.

---

## 4. How capabilities are preserved

| Capability | Preservation method |
|------------|---------------------|
| **OpenAI** | Port `llm_openai` / `llm_mock` / factory; server-only `OPENAI_API_KEY`; same model env defaults (`gpt-4o-mini`); never expose key via bootstrap/health |
| **HMRC grounding** | Keep corpus JSON byte-identical; port retrieval → verification → grounding guard; cite GOV.UK/HMRC only |
| **Tax rules** | Deterministic tests for MTD £50k/£30k/£20k dates, VAT £90k + rolling/30-day, SA deadlines, Personal Allowance facts already in corpus |
| **Guided journeys** | Keep `definitions.json`; port `journeys/engine.py` step machine 1:1 |
| **Security** | Port injection scrubbing, in-memory (then optional Redis) rate limit, CORS allowlist, security headers, PII redaction |
| **Analytics** | Port allowlisted engagement events; **clicks ≠ conversions**; same meta scrubbing |
| **Conversation management** | Port session store, history on chat requests, session delete endpoint; widget continues to send `session_id` |
| **Packages / calcs / consultation** | Same catalogue JSON + stub adapters (no fake paid/booked) |
| **UI / sidebar / embed** | Unchanged widget files; Node serves `/widget` statically |

---

## 5. Migration strategy (feature parity + existing UI)

```
Approve ADR
   → Scaffold backend-node (Express/TS)
   → Port data loaders + /health + /bootstrap (widget boots)
   → Port knowledge + grounding tests (accuracy first)
   → Port chat engine + OpenAI/mock
   → Port journeys, security, sessions, analytics
   → Dual-run contract tests vs frozen Python responses
   → Vitest suite parity + live OpenAI 33-case harness
   → Staging cutover to Node
   → Deprecate/remove Python SIMBA backend (separate approval)
```

**UI rule:** no Emerald Signature / sidebar redesign during the port. Widget changes only if a documented contract bug is found.

**Python rule:** keep `ai-tax-concierge-v2/backend` as behavioural reference until Node parity is signed off.

---

## 6. Equivalent Node.js automated and live AI testing

| Python today | Node equivalent |
|--------------|-----------------|
| `pytest` (212 passed) | **Vitest** + `supertest` HTTP tests |
| Knowledge / grounding / tax-year unit tests | Same cases in `*.test.ts` |
| Journey / recommendations / helpful-first | Same behavioural asserts |
| Security / privacy suites | Same injection, rate-limit, redaction cases |
| Widget marker tests (sidebar/a11y strings) | Keep reading static `widget/` files |
| `live_openai_verification.py` (33/33, 0 flags) | `scripts/liveOpenAIVerification.ts` — identical case IDs + accuracy flags |
| Playwright evidence script | Optional `playwright` npm later; not a migration blocker |

**Acceptance bar before retiring Python**
1. Vitest green with mapped coverage of all critical Python suites.  
2. Live harness: **33/33 live**, **0** critical accuracy flags (or documented residual).  
3. Dual-run: widget against Node needs **no** functional JS rewrite.  
4. Security: key never in client; analytics still non-conversion.

---

## 7. Risks, estimated scope, deployment dependencies

### Scope (technical)
| Stream | Size | Notes |
|--------|------|-------|
| HTTP + static + config | Small–moderate | Mechanical |
| Catalogs / journeys / sessions / analytics | Moderate | Clear Python reference |
| Knowledge + grounding | **Higher** | Accuracy-critical |
| Conversational engine + prompts + OpenAI | **Higher** | Behaviour-sensitive |
| Test/live harness port | **Higher** | Gate for cutover |
| Widget | **None / trivial** | Freeze |

### Risks
| Risk | Mitigation |
|------|------------|
| Tax-figure drift | Shared JSON + golden threshold tests before LLM work |
| API shape drift breaks widget | Freeze OpenAPI/golden fixtures from Python |
| Prompt drift vs approved 33/33 | Copy prompts verbatim; re-run live harness |
| Premature portal auth coupling | Phase A isolation |
| Dual-stack confusion | Single active runtime in staging docs |

### Deployment dependencies (Toxel)
1. Node ≥20 runtime on staging host  
2. HTTPS staging URL for API + widget  
3. Secret store: `OPENAI_API_KEY`, CORS origins, website/consultation URLs  
4. Process manager / reverse proxy (same patterns as other Node services)  
5. Still blocked for E2E: Stripe, Calendly, portal registration (unchanged by language)

---

## 8. Evidence of compatibility with Toxel’s infrastructure

| Evidence | Why it matters |
|----------|----------------|
| Repo description explicitly includes “Node.js migration” | Platform direction |
| `memory/NODE_HANDOVER.md` + `NODE_MIGRATION_CHECKLIST.md` | Portal Node behavioural lock — SIMBA aligns on secrets, CORS, snake_case, no invented tax engines |
| `taxotools/taxotools-backend` uses **Express** + `dotenv` + Node scripts | Proves Toxel already operates Express Node services in this monorepo |
| `taxotools` `engines.node: >=20` + Vitest | Matches recommended SIMBA Node toolchain |
| SIMBA already uses env-based secrets + CORS allowlist + stub integrations | Same ops model as portal handover (no wildcard CORS; server-side keys) |
| Widget is already a static embed (`data-api-base`) | Host-agnostic; works behind any Node HTTPS origin Toxel provides |
| Isolation under `ai-tax-concierge-v2/` | Does not disturb portal Python or taxotools during SIMBA Node port |

**Compatibility conclusion:** An isolated Express/TS SIMBA service is the lowest-risk fit for Toxel’s current Node footprint and the future portal Node port, without requiring portal Mongo/JWT on day one.

---

## Approval checklist (reply to unblock coding)

Please confirm:

- [ ] **ADR approved** — proceed to scaffold `backend-node` only after written GO  
- [ ] Framework: **Express + TS + Zod + Vitest** (or name an alternative)  
- [ ] Keep Python SIMBA until Node parity PASS  
- [ ] Freeze widget during backend port  
- [ ] Defer portal JWT / Mongo integration to a later phase  
- [ ] PR #35 remains **unmerged / undeployed** until Node parity + staging gates

---

## Related docs

- [`PYTHON_TO_NODE_MIGRATION_PLAN.md`](./PYTHON_TO_NODE_MIGRATION_PLAN.md) — full module map, parity checklist, phased plan  
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — current Python architecture  
- [`FINAL_ACCEPTANCE_EVIDENCE.md`](./FINAL_ACCEPTANCE_EVIDENCE.md) — Python-era behavioural reference evidence  
- Repo `memory/NODE_HANDOVER.md` — TaxSimba **portal** Node port (separate workstream)
