# Requirements Traceability Matrix

Status legend: **PASS** / **FAIL** / **BLOCKED** / **NOT APPLICABLE**

| ID | Requirement | Status | Evidence / notes |
|----|-------------|--------|------------------|
| R1 | Preserve website/portal/calculators/auth/payments | PASS | No unrelated rewrites; Node SIMBA only |
| R2 | Node runtime + API | PASS | Express `/api/v1/*`, Node ≥20, smoke log |
| R3 | Dynamic HMRC monitoring | PASS | `src/knowledge/dynamic/*`, registry, scheduler |
| R4 | Verify/quarantine/publish/rollback | PASS | `evidence/dynamic_hmrc_knowledge_proof.json` |
| R5 | Answer-time tax-year grounding | PASS | retrieval + knowledge tests; proof step 5 |
| R6 | Mandatory tax topics coverage | PASS | corpus + tax_intelligence_150 + knowledge_accuracy |
| R7 | MTD/VAT regression risks | PASS | validators + grounding_accuracy_fixes |
| R8 | Dynamic package catalogue | PASS | `catalog/sync.ts` + staging proof JSON |
| R9 | Staging Growth price test | PASS | £59.99→£64.99→restore; prod refused |
| R10 | Owner MTD/SA/support/consult rules | PASS | packages.json v6 + owner tests |
| R11 | No fixed monthly txn caps | PASS | catalogue + recommendations updated |
| R12 | Legal/policy consistency review | PASS (audit) | Open items table — no silent policy edits |
| R13 | Conversational CX | PASS | journeys + conversion/helpful tests |
| R14 | Premium widget UI/mobile | PASS | screenshots/; prior launcher work on PR #35 |
| R15 | Registration E2E | BLOCKED | Needs Toxel staging credentials |
| R16 | Stripe E2E | BLOCKED | Test-mode keys + webhook wiring |
| R17 | Calendly/Meet E2E | BLOCKED | Real event URL + payment sequencing |
| R18 | Portal auth/data isolation E2E | BLOCKED | Portal staging access |
| R19 | Security suite | PASS | `tests/security_suite.test.ts` (automated) |
| R20 | Live OpenAI probes | BLOCKED | Requires staging `OPENAI_API_KEY` this run |
| R21 | Website reconciliation | PASS (issues filed) | Compat API OK; HTML/SEO Toxel |
| R22 | Handover package complete | PASS | This directory |
| R23 | Production ready | HOLD | Explicit owner gate |
| R24 | Python deletion | NOT APPLICABLE | Retained by policy |
