# SIMBA V2 — Final Corrected Branch (Audit Remediation)

**Date:** 2026-11-17 (Europe/London)  
**Branch:** `cursor/simba-v2-final-corrected-6522`  
**Baseline:** `cursor/simba-final-toxel-handover-6522` (PR #36 tip `5cea956`)  
**Product path:** `ai-tax-concierge-v2/backend-node/` + `ai-tax-concierge-v2/widget/`  
**Backend version:** `0.4.1`

### Release gates

| Gate | Status |
|------|--------|
| A. Corrected staging branch + audit remediation | **GO for staging review** |
| B. HTTPS staging embed + live integrations | **DEPENDENCY — Toxel** |
| C. Merge to `main` / production / live payments | **HOLD — do not merge / do not deploy to production** |

Do **not** declare production-ready until HTTPS staging, integrations, security checks, tax-answer validation and owner acceptance are completed.

---

## Documents in this package

| File | Purpose |
|------|---------|
| `FINAL_CORRECTED_HANDOVER.md` | Full fixes list, evidence, blockers, HOLD |
| `STAGING_DEPLOYMENT_INSTRUCTIONS.md` | Updated Toxel staging deploy steps |
| `STAGING_ACCEPTANCE_CHECKLIST.md` | Staging acceptance + production HOLD conditions |
| `evidence/` | Pass/fail artefacts (Vitest, typecheck, build, live MTD, smoke) |
