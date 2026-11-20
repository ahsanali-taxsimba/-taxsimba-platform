# SIMBA V2 — Requirement Traceability Matrix (Audit Completion)

**Baseline:** PR #39 tip `e2b2d6fe5eddf438b372c1c87624e872d73d3856` (`cursor/simba-v2-final-corrected-6522`)  
**Work branch:** `cursor/simba-v2-audit-completion-6522`  
**Authoritative engine:** Node `ConversationalEngine` (`ai-tax-concierge-v2/backend-node`)  
**Date:** 2026-11-20 (Europe/London)

Statuses: **Working** / **Defective** / **Blocked** / **Not applicable**  
Final status after this pass: **Working** / **Working (code; staging pending)** / **Blocked** / **Not applicable**

| Req ID | Expected customer behaviour | Implementation | Status | Root cause (if defective) | Required correction | Test ID | Expected result | Actual evidence | Final status |
|--------|----------------------------|----------------|--------|---------------------------|---------------------|---------|-----------------|-----------------|--------------|
| R1-01 | Compact chat and full workspace share one conversation | Same Node engine; secure handoff | Defective → fixed | Client passed weak/session URL params; no single-use server handoff | `sessions/handoff.ts` + create/consume API + widget consume without auto-send | TH-01..03 | Same session_id + history; token single-use; no history in URL | `tests/session_handoff.test.ts` PASS | Working (code) |
| R1-02 | Preserve facts, history, latest reply, draft; no auto-answer on open | Handoff returns history + draft; `auto_send: false` | Defective → fixed | Workspace re-sent last message | Widget consume restores history/draft only | TH-01, widget review | No duplicate assistant turn on open | Unit + code path | Working (code); mobile browser **Blocked** staging |
| R1-03 | No cross-customer session access via URL | Opaque 32-byte token hashed at rest; TTL 120s; single-use | Defective → fixed | Reusable session ids in URLs | Hash lookup + expiry + used flag | TH-02 | Second consume 409; expired 400 | session_handoff tests | Working (code) |
| R2-01 | Direct answer → brief reason → qualification → one next step | `prompts.ts` system shape + scrub | Working (improved) | Verbose / sales-first replies | Prompt + lean sources/packages | TQ-* | Lean reply shape | Vitest + live T001–T008 | Working (code) |
| R2-02 | Do not auto-show package catalogue | `wantsServiceRecommendation` + decline memory | Defective → fixed | `mockPackageReply` keyed on word “package”; sales on circumstance alone | Gate cards; expand NO_BUY; honour history decline | T305, owner_commercial | Info-only → zero packages | Mock 400: T305 RECORDED; commercial tests | Working (code) |
| R2-03 | Deterministic handlers override conflicting LLM | MTD eligibility / SA / CIS handlers before LLM | Working | — | Keep precedence; never invent figures | tax_intelligence_150 | Deterministic where coded | 152 tests PASS | Working |
| R2-04 | No low-confidence auto consult spam | Engine skips consult cards on low confidence alone | Defective → fixed | Confidence→consult coupling | Precedence only on explicit consult intent | helpful_first tests | No consult dump | Vitest PASS | Working |
| R3-01 | MTD vs SA; gross qualifying income ≠ PAYE; profit ≠ turnover | Handlers + corpus | Working (rules in code) | — | Accountant sign-off on consequential answers | tax_intelligence_150 + live sample | Threshold boundaries correct | Automated PASS; Asim review **Blocked** | Working (code); tax sign-off **Blocked** |
| R3-02 | Never invent citations / calculations / facts | Retrieval verify + prompts | Working | — | Keep | privacy + retrieval tests | No fabricated booking/citations | Vitest + heuristics | Working |
| R4-01 | HMRC monitor: registry→schedule→detect→quarantine→approve→overlay | `knowledge/monitor/*`, ops routes | Working (code); ops **Blocked** | Monitor off / no staging token cycle | Enable on staging; header-only ops auth | Ops cycle | Controlled run evidence | Code present; staging cycle **not run** | Blocked (staging) |
| R4-02 | Ops token never in query/frontend | `ops/auth.ts` header `x-concierge-ops-token` only | Defective → fixed | Query token acceptance risk | Remove query acceptance; CORS allow header | security_suite / review | 401 without header | Code + health flag | Working (code) |
| R5-01 | Real OpenAI in staging (not mock) | `adapters` + settings | Working in agent env | Staging config separate | Toxel sets key on staging | Live LIMIT=8 | `llm_mode=openai` | `simba_400_results_live_latest.json` | Working (agent); staging **Blocked** |
| R5-02 | Safe fallback when OpenAI/HMRC unavailable | Mock/force flags; no invented tax | Working | — | Never fabricate | api/adapters tests | Honest unavailable behaviour | Vitest | Working |
| R6-01 | Compact + workspace same answers | Shared engine | Working after handoff | Client handoff | See R1 | TH-* | Same session | Tests | Working (code) |
| R6-02 | No internal/approval jargon in customer replies | scrub + heuristics | Working (improved) | Occasional jargon | Heuristic gate in 400 runner | 400 heuristics | no_internal_jargon | Mock 400 0 heuristic fails | Working |
| R7-01 | SA £119/£149/£299; MTD £29.99/£59.99/£89.99 VAT incl. | `data/catalog/packages.json` | Working | — | Verify before recommend | owner_commercial + catalog | Exact prices | Verified in catalogue | Working |
| R7-02 | Consult £99/20m + £149/40m; Calendly pay → Meet | packages + consultation helpers | Working (copy); live booking **Blocked** | Staging Calendly/live flag | `CONSULTATION_BOOKING_LIVE` when approved | consultation_booking tests | Correct options; no fake booked | Unit PASS; live booking **Blocked** | Blocked (live booking) |
| R7-03 | Portal registration + checkout unchanged | Links to taxsimba.co.uk paths | Working (links); E2E **Blocked** | No staging credentials | Toxel E2E | Journey L4 | Real checkout | Not run | Blocked |
| R8-01 | General Q without compulsory email | Chat routes | Working | — | Keep | api + leads tests | Chat without lead | Vitest | Working |
| R8-02 | Lead only with follow-up permission; SMTP/outbox | `leads/store.ts` | Working (filesystem); multi-instance risk | FS not shared across instances | Recommend durable store for multi-node; keep outbox | leads tests | Permission required; dedupe | Unit PASS; staging SMTP **Blocked** | Working (code); durability **Blocked** multi-node |
| R9-01 | Import T001–T400; multi-turn T301–T320 | Pack + `runSimba400Pack.ts` | Working | Pack had questions only | Acceptance criteria + accountant review | Pack import | 400 IDs; 20 multi-turn | Pack + mock 400 RECORDED | Working (recorded ≠ tax PASS) |
| R9-02 | Do not claim 400/400 tax accuracy without evidence | Report honesty | Working | — | Asim review | — | Explicit non-PASS | This report | Working (process) |
| R10-01 | Staging integrations classified honestly | Matrix § integrations | Mixed | Access missing | Handover blockers | — | PASS/FAIL/BLOCKED/MOCK | See completion report | Blocked items listed |
| R11-01 | Preserve PR #39; dependency-aware merge | Stack #35⊂#36⊂#39⊂this | Working | — | Merge this onto #39 tip after review | — | No unrelated rebuild | Diff scoped | Working |
| R12-01 | Production HOLD until gates | GO/NO-GO | Blocked | Staging + Asim + Toxel | Complete blockers | Gates | NO-GO until gates | Completion report | **NO-GO** |

## Consolidated genuine blockers

1. **Staging host access** — cannot verify HTTPS embed, CORS production-like, mobile/desktop browsers on TaxSimba staging.  
2. **`CONCIERGE_OPS_TOKEN` + `CONCIERGE_HMRC_MONITOR_ENABLED` on staging** — controlled HMRC monitor cycle not executed here.  
3. **SMTP credentials** — lead email delivery not verified end-to-end.  
4. **Calendly live + consultation payment + Google Meet** — not authorised / not configured for live test.  
5. **Portal registration, email verification, package checkout, dashboard** — no approved staging test accounts.  
6. **Asim accountant approval** — tax-sensitive expected answers for T001–T400 and consequential rules.  
7. **Toxel deployment approval** — staging deploy + rollback drill.  
8. **Multi-instance lead store** — filesystem under `DATA_DIR/runtime/leads` unsuitable if staging runs multiple nodes without shared volume; durable DB not approved/implemented in this pass.
