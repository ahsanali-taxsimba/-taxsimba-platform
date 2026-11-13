# SIMBA AI — Python → Node.js Architecture Audit & Migration Plan

**Status:** PLAN ONLY — awaiting Toxel / stakeholder approval  
**PR:** [#35](https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/35)  
**Branch:** `cursor/ai-tax-concierge-v2-phase1-0f84`  
**Date:** 2026-11-13 (Europe/London)  
**Hard rules:** Do **not** start the large migration until this plan is approved. Do **not** merge or deploy PR #35.

---

## 0. Executive verdict

| Question | Answer |
|----------|--------|
| Is SIMBA’s backend Python today? | **Yes** — FastAPI + uvicorn under `ai-tax-concierge-v2/backend/` |
| Is the widget Node/React? | **No** — vanilla JS/CSS/HTML (`widget/`). Keep as-is. |
| Does TaxSimba already have a production Node portal API? | **No** — portal API is still Python FastAPI (`/backend`). Node is a **planned** port (`memory/NODE_*.md`). |
| What Node exists in-repo today? | **Taxotools** only (Express + Next.js) — different product; do not absorb SIMBA into it. |
| Safest migration? | Port SIMBA API to an **isolated Node service** with **byte-stable `/api/v1` contract**, reuse JSON corpora/catalogues, **freeze the widget**, retire Python only after parity gates pass. |
| Start coding now? | **No** — approval gate first. |

---

## 1. Current architecture audit (file-level evidence)

### 1.1 Language inventory (`ai-tax-concierge-v2/`)

| Language | Role | Approx. files | Keep / migrate |
|----------|------|---------------|----------------|
| **Python** | Entire API, AI engine, grounding, journeys, security, analytics, pytest, scripts | **68** `.py` | **Migrate** (backend only) |
| **JavaScript** | Widget + embed | **2** (`widget/js/concierge.js`, `widget/embed.js`) | **Keep** |
| **CSS / HTML** | Emerald Signature UI | `concierge.css`, `index.html`, `preview.html` | **Keep** |
| **JSON** | Corpus, packages, calculators, journeys, routes | **15** product/config JSON | **Keep** (language-agnostic) |
| **Markdown** | Docs / evidence | docs/** | Keep; add this plan |

No TypeScript, no React, no `package.json` inside SIMBA today.

### 1.2 Runtime today

```
Browser ──▶ embed.js ──iframe──▶ widget/index.html + concierge.js
                                      │
                                      ▼  HTTP /api/v1/*
                              Python FastAPI (uvicorn :8090)
                                      │
                    ┌─────────────────┼──────────────────┐
                    ▼                 ▼                  ▼
              OpenAI adapter    Knowledge JSON     Catalog / journeys JSON
              (server key)      + grounding        + in-memory sessions
```

Start command (current):

```bash
cd ai-tax-concierge-v2/backend
uvicorn app.main:app --host 127.0.0.1 --port 8090
```

### 1.3 Python components (must be ported)

| Responsibility | Paths | Notes |
|----------------|-------|-------|
| App entry / CORS / static widget mount | `backend/app/main.py` | Serves `/widget` + `/api/v1` |
| Config / env | `backend/app/core/config.py` | pydantic-settings |
| Errors / privacy | `backend/app/core/errors.py`, `privacy.py` | PII redaction |
| Schemas | `backend/app/models/schemas.py` | Request/response contracts |
| API routes | `backend/app/api/routes/{health,chat,journeys,catalog,sessions,analytics}.py` | `/api/v1/*` |
| Conversational engine | `backend/app/ai/conversational_engine.py` | Orchestration |
| Prompts | `backend/app/ai/prompts.py` | System + welcome |
| Recommendations | `backend/app/ai/recommendations.py` | Catalog-only; no invented inclusions |
| LLM adapters | `backend/app/adapters/{base,factory,llm_openai,llm_mock,stubs}.py` | OpenAI + stubs |
| Knowledge | `backend/app/knowledge/{loader,retrieval,verification,grounding,tax_year}.py` | Accuracy protections |
| Corpus JSON | `backend/app/knowledge/corpus/*.json` | **Port as data, not rewrite** |
| Journeys | `backend/app/journeys/engine.py` + `definitions.json` | Guided help |
| Catalog / routes | `backend/app/catalog/*`, `routes_registry/*` | Packages, 17 calcs, website links |
| Security | `backend/app/security/{injection,ratelimit}.py` | Injection + rate limit |
| Sessions / analytics | `backend/app/sessions/store.py`, `analytics/events.py` | In-memory |
| Tests | `backend/tests/test_*.py` (19 suites, **212** passing) | Reimplement as Node tests |
| Live harness | `backend/scripts/live_openai_verification.py` | Reimplement in Node |
| Evidence script | `scripts/capture_final_evidence.py` | Can stay Python *or* move to Playwright JS later |

### 1.4 Frontend / JS (do not rewrite)

| Path | Contract |
|------|----------|
| `widget/embed.js` | Launcher; `data-api-base`; iframe; `POST /api/v1/analytics/track` (`launcher_open`) |
| `widget/js/concierge.js` | `GET /bootstrap`, `POST /chat`, journeys start/advance, sessions delete, analytics track |
| `widget/css/concierge.css` | Emerald Signature |
| `widget/index.html` / `preview.html` | Shell + host preview |
| `widget/assets/taxsimba-logo.*` | Official logo |

**Migration invariant:** Node backend must preserve these paths, methods, and response shapes so the widget needs **zero functional rewrite**.

### 1.5 Stable HTTP contract (parity surface)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/health` | status, `llm_mode`, tax year |
| GET | `/api/v1/config` | Safe public config (no secrets) |
| GET | `/api/v1/bootstrap` | Packages, calculators, routes, welcome |
| POST | `/api/v1/chat` | Grounded conversation |
| GET | `/api/v1/journeys` | Journey list |
| POST | `/api/v1/journeys/start` | Start guided journey |
| POST | `/api/v1/journeys/advance` | Advance step |
| POST | `/api/v1/sessions/delete` | Chat deletion |
| GET | `/api/v1/sessions/{id}` | Session inspect (ops) |
| POST | `/api/v1/analytics/track` | Engagement only (not conversions) |
| GET | `/api/v1/analytics/summary` | Ops summary |
| Static | `/widget/**` | Unchanged assets |

---

## 2. Comparison with TaxSimba / Toxel Node direction

### 2.1 What exists today in the monorepo

| Area | Stack today | Relevance to SIMBA |
|------|-------------|--------------------|
| TaxSimba portal API (`/backend`) | **Python FastAPI + MongoDB** | Behavioural source of truth for client portal; **not** Node yet |
| TaxSimba portal UI (`/frontend`) | CRA React | Existing-client dashboard (SIMBA only deep-links / guides) |
| Toxel Node portal port | Spec only: `memory/NODE_HANDOVER.md`, `NODE_MIGRATION_CHECKLIST.md`, `NODE_FRONTEND_API_MAP.md` | Defines future portal Node conventions |
| Taxotools | Express JS + Next.js TS + Vitest | Only live Node backends — **different product** |
| SIMBA (`ai-tax-concierge-v2`) | Python FastAPI + vanilla widget | This migration target |

### 2.2 Implications (honest)

1. Toxel’s “TaxSimba backend should be Node.js” is a **platform direction**, not an already-shipped Node portal.
2. SIMBA should **not** wait for full portal Node migration, and should **not** be merged into taxotools.
3. SIMBA Node should align with **shared conventions** where they exist (env hygiene, CORS allowlists, no secrets in browser, snake_case API fields, staging HTTPS) while remaining an **isolated service**.
4. Portal JWT/cookie auth is **out of scope** for public SIMBA until authenticated client context is deliberately designed (today: stub + existing-client guidance copy).

### 2.3 Conventions to reuse from Toxel Node specs + taxotools patterns

| Convention | Source | Apply to SIMBA Node |
|------------|--------|---------------------|
| Secrets server-only | NODE_HANDOVER + SIMBA today | Keep `OPENAI_API_KEY` server-only |
| Explicit CORS allowlist (no `*`) | Portal + SIMBA | Keep `CONCIERGE_CORS_ORIGINS` |
| snake_case JSON | Portal Node checklist | Keep SIMBA response field names |
| Structured errors | Portal `{ detail }` / SIMBA error shape | Preserve SIMBA widget-compatible errors |
| Vitest / Node ≥20 | taxotools | Recommended for SIMBA Node tests |
| Docker / Fly-style deploy optional | taxotools | Optional later; not required for parity |
| Do not invent tax engines / HMRC OAuth | NODE_HANDOVER hard statements | SIMBA already complies — preserve |

---

## 3. Recommended Node.js implementation approach

### 3.1 Chosen shape (for approval)

**Isolated Node service inside the same product root**, API-compatible with today’s Python service:

```
ai-tax-concierge-v2/
  widget/                 ← UNCHANGED (JS/CSS/HTML/assets)
  shared/                 ← NEW: move JSON corpora/catalogues here (optional tidy)
    knowledge/
    catalog/
    journeys/
    routes/
  backend-node/           ← NEW: TypeScript Node API (parity target)
    src/
      server.ts
      routes/
      ai/
      knowledge/
      adapters/
      security/
      …
    package.json
    vitest.config.ts
  backend/                ← Python kept until Node parity PASS, then deprecate
  docs/
```

**Framework recommendation:** **Fastify (TypeScript)** *or* **Express (TypeScript)** — either is fine; prefer **Fastify + Zod** for schema validation analogous to Pydantic, or Express + Zod if Toxel standardises on Express from taxotools.

**Decision needed from Toxel (approval question A):** Fastify+Zod vs Express+Zod.

Default if no preference: **Express + TypeScript + Zod + Vitest** (closest to existing taxotools Express familiarity).

### 3.2 What stays frozen

- Widget UX, Emerald Signature, sidebar, mobile drawer, embed launcher
- `/api/v1` paths and payloads
- JSON facts (MTD/VAT thresholds, packages prices, 17 calculator URLs)
- Stub semantics for Stripe / Calendly / portal (no fake “paid/booked”)
- Privacy: clicks ≠ conversions; PII redaction; session delete

### 3.3 Port strategy (safest sequence)

| Phase | Work | Exit criteria |
|-------|------|---------------|
| **P0 Approval** | This document reviewed | Written GO from Toxel |
| **P1 Scaffold** | `backend-node` package, health + static `/widget`, env loader | Widget loads against Node health |
| **P2 Data layer** | Load same JSON files; tax year; catalogs; routes | Bootstrap parity vs Python |
| **P3 Knowledge** | Retrieval + verification + grounding guard (port algorithms) | Deterministic threshold tests PASS |
| **P4 LLM** | OpenAI + mock adapters; prompts; engine | Mock chat parity; live harness 33 cases |
| **P5 Journeys / security / analytics / sessions** | Full route set | Feature-parity checklist green |
| **P6 Dual-run** | Python + Node side-by-side; contract diff harness | No widget changes required |
| **P7 Cutover** | Docs/scripts point to Node; Python marked deprecated | Staging uses Node only |
| **P8 Retire Python** | Remove or archive `backend/` after approval | Separate change set |

**Do not** big-bang delete Python on day one.

### 3.4 Mapping Python → Node modules

| Python | Proposed Node |
|--------|---------------|
| `app/main.py` | `src/server.ts` + static middleware |
| `core/config.py` | `src/config.ts` (`dotenv` + zod env schema) |
| `api/routes/*.py` | `src/routes/*.ts` |
| `ai/*.py` | `src/ai/*.ts` |
| `adapters/llm_openai.py` | `openai` official Node SDK |
| `knowledge/*.py` | `src/knowledge/*.ts` (same JSON) |
| `journeys/engine.py` | `src/journeys/engine.ts` |
| `security/*.py` | `src/security/*.ts` |
| `sessions/store.py` | `src/sessions/store.ts` (memory → later Redis) |
| `analytics/events.py` | `src/analytics/events.ts` |
| `pytest` suites | `vitest` suites mirroring cases |
| `live_openai_verification.py` | `scripts/liveOpenAIVerification.ts` |

### 3.5 Dependencies (proposed Node)

| Package | Purpose |
|---------|---------|
| `express` or `fastify` | HTTP server |
| `typescript`, `tsx` | TS runtime/build |
| `zod` | Request/env validation |
| `openai` | Chat Completions |
| `cors`, `helmet` | CORS + security headers |
| `dotenv` | Env loading |
| `vitest` (+ `supertest`) | Unit/API tests |
| `pino` (optional) | Structured logs |

**Remove after cutover:** `fastapi`, `uvicorn`, `pydantic`, `pytest`, Python `openai` (from SIMBA runtime).

### 3.6 Environment variables (preserve names)

Keep existing SIMBA names for ops continuity:

- `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_TIMEOUT_SECONDS`
- `CONCIERGE_ENV`, `CONCIERGE_CORS_ORIGINS`, `CONCIERGE_FORCE_MOCK_LLM`, `CONCIERGE_LOG_LEVEL`
- `WEBSITE_BASE_URL`, `CONSULTATION_BOOKING_URL`

Optional later (align with portal Node): Redis URL for shared rate-limit/session durability — **not** required for parity MVP.

---

## 4. Feature-parity checklist (gate before retiring Python)

Mark PASS only with automated or dual-run evidence.

### 4.1 API / contract
- [ ] Every `/api/v1` route exists with same method
- [ ] Bootstrap packages: SA £119/£149/£299; MTD £29.99/£59.99/£89.99 VAT incl.; consultation £99/30 min
- [ ] 17 calculators with same paths / `live_verified` metadata
- [ ] Widget loads from Node-served `/widget` without JS edits
- [ ] Health exposes `llm_mode` (`openai`|`mock`) and `current_tax_year`
- [ ] No API key in bootstrap/health/widget

### 4.2 AI / tax accuracy
- [ ] Mock mode deterministic grounded replies
- [ ] Live OpenAI 33-case harness ≥ prior bar (0 critical accuracy flags)
- [ ] MTD £50k→6 Apr 2026; £30k→6 Apr 2027; £20k→6 Apr 2028
- [ ] VAT £90k + rolling 12-month + 30-day forward look
- [ ] Grounding guard prefers corpus figures over model memory
- [ ] Sources are GOV.UK/HMRC only when cited
- [ ] Helpful-first / no invented inclusions / no HMRC endorsement claims

### 4.3 Journeys & UX backend support
- [ ] All guided journeys start/advance parity
- [ ] Existing-client guidance behaviour preserved
- [ ] Recommendations only from catalogues

### 4.4 Security / privacy
- [ ] Prompt-injection scrubbing
- [ ] Rate limiting
- [ ] PII redaction for analytics
- [ ] Analytics allowlist; clicks ≠ conversions
- [ ] Session isolation + delete
- [ ] CORS allowlist enforced

### 4.5 Integrations (still stubs until Toxel wires them)
- [ ] Payment adapter unavailable (no fake paid)
- [ ] Calendly stub / configured URL behaviour identical
- [ ] Portal stub identical

### 4.6 Tests to port (Python → Vitest equivalents)

| Python suite | Node equivalent focus |
|--------------|----------------------|
| `test_api*.py`, `test_phase2_api.py` | HTTP contract |
| `test_conversational_engine.py`, `test_conversation_multiturn.py` | Engine + history |
| `test_knowledge_accuracy.py`, `test_grounding_accuracy_fixes.py` | Thresholds / VAT / MTD |
| `test_retrieval_and_verification.py` | Sources |
| `test_journeys*.py` | Guided flows |
| `test_recommendations*.py`, `test_helpful_first_no_pressure.py` | Selling rules |
| `test_security_suite.py`, `test_privacy.py` | Security/privacy |
| `test_tax_year.py` | Tax year math |
| `test_adapters.py` | Mock/OpenAI factory |
| `test_accessibility_widget.py`, `test_workspace_sidebar.py` | Static widget markers (unchanged files) |
| Live harness script | Live OpenAI Node harness |

**Parity bar:** Node suite must cover the same behaviours; target **≥212** automated assertions or explicit mapped checklist with zero critical gaps.

---

## 5. Exact migration scope (in / out)

### In scope (after approval)
- New `backend-node` TypeScript service under `ai-tax-concierge-v2/`
- Port of Python SIMBA API + AI/knowledge/journeys/security/analytics/sessions
- Vitest + live OpenAI verification script
- Dual-run contract tests vs frozen Python responses
- Docs: embedding/runbooks updated to Node start command
- Keep widget unchanged except trivial `data-api-base` examples if port changes

### Out of scope (explicit)
- Rewriting Emerald Signature UI / sidebar / CSS
- Merging SIMBA into taxotools
- Implementing TaxSimba portal Node migration (`memory/NODE_*`)
- Live Stripe / Calendly / portal auth E2E (still Toxel staging)
- Changing live taxsimba.co.uk
- Merge/deploy of PR #35

### Optional tidy (approve separately)
- Move JSON corpora to `shared/` consumed by Node (and temporarily by Python)
- Redis for durable sessions/rate limits
- Playwright evidence scripts in JS

---

## 6. Deployment implications & risks

### 6.1 Deployment
| Topic | Impact |
|-------|--------|
| Process | Replace `uvicorn` with `node`/`tsx` (or compiled `node dist/server.js`) |
| Port | Keep **8090** locally for widget docs continuity |
| Static files | Node must serve `/widget` identically |
| Secrets | Same env names; staging secret store update only for runtime image |
| Hosting | Still needs Toxel HTTPS staging host — language change does not remove this blocker |
| CI | Add Node test job; keep Python tests until cutover |

### 6.2 Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Tax-figure drift during port | **High** | Share JSON corpora; deterministic grounding tests first |
| Subtle `/api/v1` response shape drift breaks widget | **High** | Dual-run golden fixtures from Python; freeze widget |
| Prompt/behaviour drift vs approved live 33/33 | **High** | Port prompts verbatim; re-run live harness |
| Starting migration before portal Node standards locked | **Medium** | Keep SIMBA isolated; avoid premature auth coupling |
| Dual backends confuse staging | **Medium** | Single active runtime flag; clear docs |
| Scope creep into portal rewrite | **High** | Hard out-of-scope list above |
| Temporary two stacks to maintain | **Medium** | Time-box dual-run; retire Python after parity |

### 6.3 Rollback
- Keep Python `backend/` until Node parity signed off
- Staging rollback = point reverse proxy / process manager back to uvicorn image
- Widget unchanged ⇒ frontend rollback not required

---

## 7. Effort characterisation (technical, not calendar)

| Workstream | Nature |
|------------|--------|
| HTTP + static + config | Moderate — mechanical port |
| Catalog/journeys/session/analytics | Moderate — logic is clear |
| Knowledge retrieval + grounding guard | Higher — accuracy-critical; needs golden tests first |
| Conversational engine + prompts + OpenAI adapter | Higher — behaviour-sensitive |
| Security/privacy | Moderate — must not weaken |
| Test port + live harness | Higher — acceptance gate |
| Widget | **Minimal / none** |

---

## 8. Approval questions for Toxel / stakeholders

Please confirm before any migration coding:

1. **Proceed with isolated `backend-node` under `ai-tax-concierge-v2/`?** (Recommended: YES)
2. **Framework:** Express+TS+Zod+Vitest *(default)* vs Fastify+TS+Zod+Vitest?
3. **Keep Python until Node parity PASS, then deprecate?** (Recommended: YES)
4. **Freeze widget (no UI rewrite) during backend port?** (Recommended: YES)
5. **Defer portal JWT integration until after public SIMBA Node parity?** (Recommended: YES)
6. **Any mandatory alignment with a future portal Node monorepo layout** beyond isolation?

---

## 9. Recommendation

**Approve the plan, then execute a parity-preserving Node port of the SIMBA API only.**  
Treat the current Python SIMBA backend as the **behavioural reference implementation** (same role Python portal plays in `memory/NODE_HANDOVER.md`).  
Do **not** merge/deploy PR #35, and do **not** start the large migration until questions in §8 are answered.

**Until approval:** PR #35 remains a Python+widget preview with HOLD on production.

---

## 10. Related documents

- `docs/ARCHITECTURE.md` — current Python architecture
- `docs/FINAL_ACCEPTANCE_EVIDENCE.md` — Python-era acceptance evidence
- `docs/toxel/HANDOVER.md` / `EMBEDDING.md` / `INTEGRATION_CONTRACTS.md`
- Repo root `memory/NODE_HANDOVER.md` — TaxSimba **portal** Node port lock (separate workstream)
