# Toxel staging handover — PASS / FAIL / BLOCKED report

**Date:** 2026-11-13 (Europe/London)  
**PR:** [#35](https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/35)  
**Scope:** Controlled **staging** handover only  
**Rules observed:** No merge · No production deploy · No Python deletion · No invented inclusions · Prices unchanged  

---

## Decision

### **READY FOR TOXEL HTTPS STAGING PREPARATION**

Local Node evidence is accepted. Staging integrations and **approved package inclusions** remain **BLOCKED** until Toxel/TaxSimba supply and verify them.

**Not production-ready.** Do not claim 100% tax accuracy or live conversion capability.

---

## Matrix

| Area | Status | Evidence / notes |
|------|--------|------------------|
| Automated Vitest | **PASS** (476) | 2026-11-13 live key re-run: `npm test` 26 files |
| Live OpenAI harness | **PASS** (33/33, flags 0) | `live_openai_report_20261113T230918Z.json` |
| Owner commercial live probe | **PASS** (11/11) | package / Xero / £99 consultation |
| Tax intelligence 150 | **PASS** | Accepted prior evidence |
| Package journeys 50 | **PASS** | Price-tier suggestions only; feature-level recs blocked |
| Node without Python | **PASS** | Vendored data; `npm run build && npm start` |
| Emerald + SIMBA AI Tax Assistant branding | **PASS** | Widget + bootstrap subtitle |
| Portal/website code isolation | **PASS** (with note) | SIMBA in `ai-tax-concierge-v2/`; portal catalogue sync only in `backend/phase1b.py` |
| Approved SA/MTD **inclusions** | **BLOCKED** | Search exhausted — see supply request |
| Detailed feature-based package recommendations | **BLOCKED** | Catalogue `detailed_recommendations_status` |
| Stripe checkout + webhooks | **BLOCKED** | Staging E2E required |
| Calendly / Google Meet £99 | **BLOCKED** | Staging E2E required |
| Registration / email verification | **BLOCKED** | Staging E2E required |
| Authenticated dashboard messaging | **BLOCKED** | Staging E2E required |
| Live taxsimba.co.uk embed | **BLOCKED** | After staging sign-off only |
| Production merge / Python deletion | **BLOCKED** | Separate approval |

---

## Package inclusions resolution

**Attempted sources:** SIMBA catalogues, portal `DEFAULT_PACKAGES`, live taxsimba.co.uk pricing/SA/MTD pages.  

**Outcome:** No authoritative per-SKU inclusion lists for SA Simple/Smart/Elite or MTD Starter/Growth/Complete.  
**Price sync (follow-up):** Portal Elite **£249 → £299** fixed; MTD Essential/Plus retired in favour of Starter/Growth/Complete monthly — see [`price_fix/ELITE_299_PRICE_CORRECTION_REPORT.md`](./price_fix/ELITE_299_PRICE_CORRECTION_REPORT.md).

**Action taken:**
- Did **not** invent inclusions; prices unchanged  
- Catalogue marked `blocked_pending_taxsimba_approval`  
- Supply form: [`docs/toxel/PACKAGE_INCLUSIONS_SUPPLY_REQUEST.md`](../toxel/PACKAGE_INCLUSIONS_SUPPLY_REQUEST.md)  
- Inclusions answers explicitly state **blocked** until approved text is supplied  

---

## Handover package for Toxel

| Doc | Path |
|-----|------|
| **Complete staging handover** | [`docs/toxel/TOXEL_STAGING_HANDOVER.md`](../toxel/TOXEL_STAGING_HANDOVER.md) |
| Inclusions supply form | [`docs/toxel/PACKAGE_INCLUSIONS_SUPPLY_REQUEST.md`](../toxel/PACKAGE_INCLUSIONS_SUPPLY_REQUEST.md) |
| Node deploy (short) | [`docs/toxel/NODE_DEPLOYMENT_HANDOVER.md`](../toxel/NODE_DEPLOYMENT_HANDOVER.md) |
| Embedding | [`docs/toxel/EMBEDDING.md`](../toxel/EMBEDDING.md) |
| Integration contracts | [`docs/toxel/INTEGRATION_CONTRACTS.md`](../toxel/INTEGRATION_CONTRACTS.md) |
| Security checklist | [`docs/toxel/SECURITY_CHECKLIST.md`](../toxel/SECURITY_CHECKLIST.md) |
| Prior intelligence audit | [`COMPREHENSIVE_INTELLIGENCE_SALES_AUDIT.md`](./COMPREHENSIVE_INTELLIGENCE_SALES_AUDIT.md) |
| Prior independent verification | [`FINAL_INDEPENDENT_VERIFICATION.md`](./FINAL_INDEPENDENT_VERIFICATION.md) |

Staging acceptance tests (A must-pass / B blocked integrations) are listed in `TOXEL_STAGING_HANDOVER.md` §9.

---

## Reproducible local commands

```bash
cd ai-tax-concierge-v2/backend-node
npm ci
npm test
npm run build
CONCIERGE_FORCE_MOCK_LLM=false PORT=8091 npm start
curl -s http://127.0.0.1:8091/api/v1/health
curl -s http://127.0.0.1:8091/api/v1/catalog/packages | head
```

---

## Outstanding for Toxel before unblocking sales depth

1. Complete **PACKAGE_INCLUSIONS_SUPPLY_REQUEST.md** and sign off.  
2. Deploy Node behind HTTPS; run acceptance suite **A**.  
3. Wire Stripe, Calendly, registration, dashboard; run suite **B**.  
4. Seek separate approval before production embed, merge, or Python deletion.
