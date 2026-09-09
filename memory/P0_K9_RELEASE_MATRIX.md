# P0 K.9 Release Matrix

**Branch:** `taxsimba-p0-integration`  
**K.9 tip:** (see latest commit on branch)  
**K.8 checkpoint:** `9d5251d`  
**SoT:** Node `backend-node/` + Toxel FE on integration branch  
**Protected tips (must remain unchanged):**  
- `main` `b37f6b6`  
- `node-only-production` `12ec791`  
- `toxel-frontend-reference` `e13d6e9`

**Legend:** `PASS` | `FAIL` | `DEFERRED` | `BLOCKED`  
**Release rule:** no staging/production until every **CRITICAL** row is `PASS`.

---

## CRITICAL (must PASS)

| ID | Criterion | Evidence | Status |
|---|---|---|---|
| D4 / VBP | All paid checkouts require verified email (service, AW, upgrade) | `compatK9` G2; K.2/K.3/K.8 | **PASS** |
| D5 / C* | Case entitlement via compat (unpaid/SA-only/dual) | `compatK9` G3; K.5 | **PASS** |
| D6 / E10 | Activation only via fulfil spine | `compatK9` G1; K.3 checkout-success | **PASS** |
| D7 / E1 | Ownership = ACTIVE services; never invent `isSubscriptionBuy` | K.3; auth payload | **PASS** |
| AW* | AW create → pay; fulfil never activates SA/MTD / no new case | `compatK9` G1; K.8 AW5 | **PASS** |
| X4 | Contact masking; SUPER_ADMIN reveal | `compatK9` G4; K.7 | **PASS** |
| PROT | Protected domain call-only / additive guards | code review: adapters call domain/`fulfil`/getCase | **PASS** |
| E2E | Continuous compat gate register→buy→engage→case→AW | `compatK9` G1 | **PASS** |
| SEC | Role isolation (CLIENT/ACCOUNTANT/ADMIN/SUPER_ADMIN) | `compatK9` G4; K.7/K.8 | **PASS** |

---

## P0 IN-SCOPE (PASS expected)

| Area | Notes | Status |
|---|---|---|
| K.1 compat infra | envelope, Bearer, IDs | **PASS** |
| K.2 verify/reset | native + gates | **PASS** |
| K.3 Checkout-only | Elements rejected | **PASS** |
| K.4 engagement | accept-engagement-letter | **PASS** |
| K.5 cases/docs/messages | entitlement + adapters | **PASS** |
| K.6 MTD aggregates | start-next-quarter HIDE | **PASS** |
| K.7 admin/SUPER_ADMIN | masking, stats, FAQs | **PASS** |
| K.8 AW FE wire | admin create / client pay | **PASS** |
| A8 change-password | `/auth/change-password` compat | **PASS** |
| P1 update profile | `/auth/update-account-settings` | **PASS** |
| M1 staff messages | admin/accountant send + log | **PASS** |
| D2 request docs | accountant request-documents | **PASS** |
| D1 staff uploads | draft / final-certificate | **PASS** |
| E8 upgrade | upgrade-options + upgrade-checkout; planlist fallback | **PASS** |
| S1–S5 admin surfaces | users/stats/payments/FAQs | **PASS** |

---

## DEFERRED / HIDE (not FAIL)

| Item | Reason |
|---|---|
| OTP / Google login | D1/D2 product hide |
| Card Elements / portal / cancel | E6/E9 |
| Notification DELETE | M4 → 405 |
| start-next-quarter | T3 HIDE |
| S6 CMS/partners/tax-rates/api-keys/templates/fees | HIDE 405 |
| Payment stats/export/by-user | deferred 405 |
| Staff profile photo/UTR edit | P3 HIDE |
| HMRC submission/API | out of P0 |
| Yearly metrics / status-distribution | S6 |
| Non-AW VAT PDF invoice | P0 HTML receipt for AW only |

---

## BLOCKED checklist (ops)

| Check | Status |
|---|---|
| `NEXT_PUBLIC_API_URL` points at `…/api/compat` (trailing slash per FE) | Ops config (documented) |
| Any CRITICAL FAIL | **None** |
| Protected branch tip drift | **None** at K.9 acceptance |

---

## Full regression

- `npm run typecheck` — required PASS  
- `npm test` — required PASS (all integration + unit suites)

## Stop

K.9 complete. **Do not** start staging/production cutover until this matrix is explicitly accepted.
