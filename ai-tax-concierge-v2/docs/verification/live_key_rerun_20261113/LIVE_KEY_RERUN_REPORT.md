# SIMBA AI — Live key re-run report (Cloud Agent)

**Date:** 2026-11-13 (Europe/London)  
**PR:** [#35](https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/35) — **HOLD: do not merge / do not deploy production**  
**Branch:** `cursor/ai-tax-concierge-v2-phase1-0f84`  
**Runtime:** Cursor Cloud Agent (new session after prior agent reported key unavailable)

---

## 0. Secret availability (no value exposed)

| Check | Result |
|-------|--------|
| `OPENAI_API_KEY` in process env | **PRESENT** |
| Key length | **164** |
| Prefix shape | **sk-like** |
| `CONCIERGE_FORCE_MOCK_LLM` | `false` |
| Live adapter used | **openai** (not mock) |
| Secret value logged/printed | **No** |

Prior agent sessions that reported the key missing were environment-injection failures in those pods, not an absence of the configured Cursor runtime secret for this repository. This session received the key and completed live calls.

---

## 1. Live OpenAI harness (`npm run live:openai`)

| Item | Result |
|------|--------|
| Report | `docs/verification/live_openai_report_20261113T230918Z.json` (= `live_openai_report_latest.json`) |
| Status | **COMPLETED** |
| Connectivity | **PASS** (`LIVE_OK`) |
| Single-turn UK tax / package / consultation cases | **33/33 live** |
| Accuracy flags | **0** |
| Harness exceptions | **0** |
| Multi-turn dialogues | **3/3**, context retained |
| Guided journeys | **4/4** (`consultation`, `existing_client`, `mtd`, `freelancer`) |
| Package prices in live replies | SA **£119/£149/£299** · MTD **£29.99/£59.99/£89.99** · consult **£99** |
| MTD £30k band | **6 April 2027** |
| VAT threshold | **£90,000** (not £85,000) |
| Injection probe | answered tax question without leaking system prompt |

**Verdict: PASS**

---

## 2. Owner commercial / package / £99 consultation live probe

Command: `npx tsx scripts/liveOwnerDecisionsProbe.ts`

| Result | Count |
|--------|-------|
| Passed | **11/11** |
| Failed | **0** |
| Artefact | `docs/verification/inclusions_resolution/live_owner_decisions_probe.json` |

Covers Xero-in-price, bookkeeping limits, quarterly MTD + year-end SA subject to responsibilities, support channels (not phone), removed priority/QBR/planning claims, £99 consultation boundaries, lowest suitable package, landlord→Comply, signup links.

**Verdict: PASS**

---

## 3. Automated regression

| Suite | Result |
|-------|--------|
| Vitest (`npm test`) | **476/476 PASS** (26 files) |
| Security suite (within Vitest) | **26/26 PASS** |

**Verdict: PASS**

---

## 4. HMRC knowledge + TaxSimba package synchronisation (real evidence)

### 4a. HMRC knowledge accuracy vs GOV.UK (spot-check)

Live HTML fetches saved summary in `hmrc_package_sync_evidence.json`:

| Fact | GOV.UK page | Present on page | SIMBA corpus / live answer |
|------|-------------|-----------------|----------------------------|
| MTD >£50k → 6 Apr 2026 | MTD “if and when” guidance | Yes | Aligns |
| MTD >£30k → 6 Apr 2027 | same | Yes | Aligns |
| MTD >£20k → 6 Apr 2028 | same | Yes | Aligns |
| VAT £90,000 | VAT registration thresholds | Yes | Aligns (£85k rejected) |
| SA online deadline 31 January | SA deadlines | Yes | Aligns |
| Personal Allowance £12,570 | Income tax rates | Yes | Aligns |

### 4b. Dynamic HMRC knowledge updates

| Capability | Status |
|------------|--------|
| Versioned curated corpus under `backend-node/data/corpus/` | **PASS** (present + grounded) |
| Live retrieval + grounding guards overriding stale model memory | **PASS** (live harness) |
| Automatic continuous crawl / auto-ingest of HMRC/GOV.UK into SIMBA | **BLOCKED / NOT IMPLEMENTED** — updates remain curated PR changes |

### 4c. TaxSimba package synchronisation

Live public APIs re-fetched this run:

- `https://taxsimba.co.uk/api/compat/subscription-plans?category=taxSimba` → `public_api_sa.json`
- `https://taxsimba.co.uk/api/compat/subscription-plans?category=mtd` → `public_api_mtd.json`

| Package | Live API price | SIMBA `packages.json` | Match |
|---------|---------------:|----------------------:|:-----:|
| Simple / SA_SIMPLE | 119 | 119 | Yes |
| Smart / SA_SMART | 149 | 149 | Yes |
| Elite / SA_ELITE | 299 | 299 | Yes |
| Simbian Comply (MTD_COMPLY ↔ MTD_STARTER) | 29.99 | 29.99 | Yes |
| Simbian Growth | 59.99 | 59.99 | Yes |
| Simbian Elite (MTD_ELITE ↔ MTD_COMPLETE) | 89.99 | 89.99 | Yes |
| £99 consultation | catalogue stub | 99 / booking stub | Yes |

| Capability | Status |
|------------|--------|
| Curated SIMBA catalogue aligned to live subscription-plans API | **PASS** (evidence above) |
| Portal Mongo boot sync of approved prices (`backend/phase1b.py` `ensure_phase1b_data`) | **PASS** (code on PR; staging DB E2E still required) |
| Automatic runtime pull from website API into SIMBA Node on every request | **BLOCKED / NOT IMPLEMENTED** — Node reads vendored JSON |
| Auto-approve public-API feature bullets (priority/QBR/planning) into SIMBA promises | **Intentionally refused** (owner decisions) |

---

## 5. PR isolation review

| Tree | Touched on PR #35? | Notes |
|------|--------------------|-------|
| `ai-tax-concierge-v2/` | Yes (primary) | SIMBA Node + widget + docs |
| `backend/` (portal) | Yes — **catalogue price sync only** | Elite £249→£299; Simbian monthly SKUs; retire Essential/Plus; tests |
| `frontend/` | No | Untouched |
| `taxotools/` | No | Untouched |
| Marketing Hub / live site HTML | No | Untouched (known live contradictions remain) |

Unrelated website systems (frontend UI, taxotools, Marketing Hub, production embed) remain untouched. Portal `backend/` edits are limited to approved catalogue sync required for Stripe/unit_amount correctness.

---

## 6. PASS / FAIL / BLOCKED summary

| Area | Status |
|------|--------|
| `OPENAI_API_KEY` available this runtime | **PASS** |
| Live OpenAI 33+ Q&A harness | **PASS** |
| Multi-turn + journeys | **PASS** |
| Package + £99 consultation live probes | **PASS** |
| Vitest 476 | **PASS** |
| HMRC fact grounding vs GOV.UK | **PASS** |
| Package price alignment vs live API | **PASS** |
| Dynamic continuous HMRC auto-ingest | **BLOCKED** (not built) |
| Automatic SIMBA Node←website API sync | **BLOCKED** (not built; curated + portal boot sync) |
| HTTPS staging / live embed | **BLOCKED** |
| Stripe / Calendly / registration E2E | **BLOCKED** |
| Merge to `main` / production deploy | **HOLD** |

---

## 7. Remaining deployment dependencies (owners)

1. **Toxel** — HTTPS staging host, reverse proxy, CORS, secret store for `OPENAI_API_KEY`
2. **Toxel** — staging embed only (not production taxsimba.co.uk)
3. **Toxel / portal** — Stripe test Checkout + webhooks; confirm Mongo catalogue sync on staging
4. **Toxel** — Calendly URL → `CONSULTATION_BOOKING_URL` + Meet E2E
5. **Toxel / portal** — registration + email verification + dashboard messaging E2E
6. **TaxSimba owner** — exclusions / amendments / cancel-refund / bookkeeping transaction caps
7. **TaxSimba / Toxel** — fix live marketing contradictions (`/making-tax-digital` SEO, `/pricing` errors, homepage legacy prices)
8. **Human accountant** — sign-off of material live answers before production reliance

**Production merge/deploy and Python deletion remain on HOLD.**
