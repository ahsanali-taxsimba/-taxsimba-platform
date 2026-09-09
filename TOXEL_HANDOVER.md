# TOXEL HANDOVER — Ready for Toxel Staging

**Verdict:** A. READY FOR TOXEL STAGING  
**Readiness class:** **2) READY FOR TOXEL STAGING** — **not** PRODUCTION READY  
**Branch:** `taxsimba-p0-integration` (base: `node-only-production`)  
**Final freeze tip (branch HEAD):** `5ce01ecc9a460eafd81d0322622b94a8d4658703`  
**Gate feature tip:** `308111e1bc4549db7b9eee771067c9f50b05d2e7`  
**K.9 baseline:** `38549faa0d2b71da3fc8c98fd240222c279971b1`  
**K.8 checkpoint:** `9d5251d`  
**PR:** https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/2  

**This is not a production-ready declaration.** Production readiness requires deployed staging/UAT. Do not merge protected branches from this gate.

---

## Architecture (binding)

TaxSimba is an **accountant-led** platform.

### HMRC APIs — OUT OF SCOPE / NOT REQUIRED BY ARCHITECTURE

- Do **not** build HMRC APIs, HMRC OAuth, HMRC submission endpoints, or require HMRC credentials.
- Absence of HMRC is **not** deferred debt, failure, or a blocker.
- SA / MTD filings are completed externally; TaxSimba records workflow + submission reference only.

---

## Final gate evidence (this freeze)

| Check | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm test` | **PASS** |
| Test files | **29** |
| Tests | **299** |
| Failures | **0** |
| Final journey/security suite | `tests/integration/finalHandoverGate.test.ts` (8) |
| Prior handover suite | `tests/integration/handoverAudit.test.ts` (9) |
| K.0–K.9 suites | included in full regression |

### PASS/FAIL table

| Area | Status |
|---|---|
| A. Client journeys | **PASS** |
| B. Accountant journeys | **PASS** |
| C. Admin journeys | **PASS** |
| D. Super Admin journeys | **PASS** |
| E. Security / IDOR / role isolation | **PASS** |
| F. Payments and activation | **PASS** |
| G. SA/MTD entitlement isolation | **PASS** |
| H. Documents / messages | **PASS** |
| I. Frontend / API contract coverage | **PASS** (live launch paths; deferred UI-safe) |
| J. Full regression / typecheck | **PASS** |

---

## Protected tips (unchanged)

| Branch | SHA |
|---|---|
| `main` | `b37f6b60f8b80ef7631773ae853b620f33b24c8f` |
| `node-only-production` | `12ec7915b537b7086d24cfe22062f82bedcc40ff` |
| `toxel-frontend-reference` | `e13d6e973424e8e74f65ce07b156d2217f621b61` |

---

## Repository structure

```
/
├── backend-node/                 # Node SoT + /api/compat
├── tax_simba_frontend/           # Client Next.js
├── tax_simba_admin_frontend/     # Admin / accountant / SUPER_ADMIN Next.js
├── frontend/                     # Legacy CRA (not Toxel launch FE)
├── memory/                       # P0 contracts + audit notes
└── TOXEL_HANDOVER.md
```

---

## `/api/compat` configuration

```text
NEXT_PUBLIC_API_URL=https://<staging-api-host>/api/compat/
```

Trailing slash **required**. Stripe webhook remains `POST /api/stripe/webhook` (native).

---

## Environment / Stripe / storage

See prior sections and `backend-node/.env.example`:

- Mongo staging DB; indexes at boot  
- Stripe **test** keys + Checkout Session only  
- `STORAGE_DRIVER=s3` or `local`  
- CORS exact origins; Bearer auth for FE  

---

## Build / run / test

```bash
cd backend-node && npm ci && npm run typecheck && npm test && npm run build && npm start
cd tax_simba_frontend && npm ci && npm run build
cd tax_simba_admin_frontend && npm ci && npm run build
```

---

## Role matrix

| Capability | CLIENT | ACCOUNTANT | ADMIN | SUPER_ADMIN |
|---|---|---|---|---|
| Purchase / AW pay | ✓ verified | — | — | — |
| Own cases/docs/messages | ✓ | assigned | all ops | all |
| Progress whitelist | — | assigned | ✓ | ✓ |
| External submission record | — | — | ✓ | ✓ |
| Contact reveal (audited) | — | ✗ | ✗ | ✓ |
| Invite accountants | — | — | contract-limited | ✓ |

---

## Intentionally deferred (SAFE)

| Item | Notes |
|---|---|
| **HMRC APIs** | OUT OF SCOPE |
| OTP / Google | UI gated |
| Elements / portal / cancel | Checkout-only; live plan UI has no Elements |
| Start Next Quarter | Hidden; periods on activation |
| S6 CMS / fee CMS / templates / api-keys | nav `p0Hide` / 405 |
| Payment export / stats / by-user | Export hidden |
| Notification DELETE | Trash hidden |
| Star-review CMS / Audit log FE | nav `p0Hide` |
| Flags CMS | not loaded on case detail |
| Marketing CMS depth | non-critical |

**Genuine blockers remaining:** **none** for Toxel staging.

---

## Staging smoke checklist

1. Register → verify → Checkout SA/MTD → ACTIVE  
2. Unverified checkout blocked; unpaid success does not activate  
3. Engagement → dashboard; entitlement-gated cases  
4. Docs upload/download; messages; AW pay without entitlement change  
5. Admin assign + progress; SUPER_ADMIN reveal audited  
6. Record external submission when READY_FOR_SUBMISSION  
7. Confirm no live Elements / Start Next Quarter / Export / flags fetch  

---

## Rollback

| Checkpoint | SHA |
|---|---|
| K.8 | `9d5251d` |
| K.9 | `38549fa` |
| Prior audit feature | `b572172` |
| Gate feature | `308111e1bc4549db7b9eee771067c9f50b05d2e7` |
| This freeze (docs + tip stamp) | `5ce01ecc9a460eafd81d0322622b94a8d4658703` |

---

## Explicit non-goals

Do not merge, deploy staging/production, or start K.10 from this agent.  
Do not invent HMRC or parallel payment/entitlement systems.
