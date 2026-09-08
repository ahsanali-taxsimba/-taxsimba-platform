# TaxSimba P0 Contract Baseline

**Branch:** `taxsimba-p0-integration`  
**Backend SoT:** `origin/node-only-production` Node domain (`backend-node/`)  
**Frontend SoT:** `origin/toxel-frontend-reference` → `TaxSimba_Toxel_Frontend_GitHub_Reference.zip`  
  (`tax_simba_frontend/` + `tax_simba_admin_frontend/`)  
**Status:** Documentation only — **no product code changes in this commit**  
**Purpose:** Integration acceptance baseline before implementation

---

## 0. Locked product decisions

| ID | Decision | Rule |
|---|---|---|
| D1 | OTP | **Hide** for P0. Password is a usable core path (`Use password`). OTP is not required for login/session. No visible broken OTP. |
| D2 | Google | **Hide** for P0. |
| D3 | Additional payment requests | **In P0.** Admin creates AW request; client sees + pays; staff see status. Must **not** activate SA/MTD or duplicate cases. Reuse Node `ADDITIONAL_WORK` + Stripe Checkout. |
| D4 | Email verification | **VERIFY-BEFORE-PURCHASE.** Login/pre-purchase dashboard allowed unverified. Paid checkout + activation require verified email **server-side**. Unverified → never ACTIVE entitlement. |
| D5 | Case entitlement | CLIENT SA/MTD case create/access requires matching ACTIVE entitlement. Enforce server-side. Prefer activation-created cases. Staff workflows preserved without accidental duplicate service cases. |
| D6 | Payment architecture | Stripe **Checkout Session only**. No Elements `subscription/create` for P0. Activation only via verified `fulfil` → `activateService` (+ `ensurePeriods` for MTD). |
| D7 | Ownership SoT | `GET /api/my-services` ACTIVE rows. Four states: neither / SA / MTD / both. Never `isSubscriptionBuy`. |
| D8 | Registration | Account only → both services `NOT_ACTIVE`. Never activate in register adapter. |

### Classifications

- **MATCH** — works against Node as-is  
- **ADAPTER** — thin path/body/envelope/field/ID map calling existing Node domain  
- **FRONTEND CHANGE** — Toxel must change (unsafe or impossible to fake in adapter)  
- **BACKEND GAP** — new minimal Node capability required for P0  
- **HIDE/DEFER** — hide UI; out of P0 or explicitly deferred  

---

## 1. Cross-cutting contracts

| ID | FE page/component | FE API | Method | Toxel path | Request | Expected FE response | Node endpoint/service | Node request | Node response | Class | Solution | Affected files |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| X1 | All axios callers | — | * | * | camelCase bodies | `{ success, data, message }` | Native routes | snake_case | raw JSON / `{ detail }` | ADAPTER | Compat envelope + case mapper | New `backend-node/src/compat/**`; `app.ts` |
| X2 | NextAuth + clientAxios | Bearer | * | * | `Authorization: Bearer` | Session `accessToken` | `middleware/auth.ts`, `http/session.ts` | Cookie or Bearer | `{ user, access_token? }` | ADAPTER | Non-browser login returns `access_token`; map to `accessToken` | Client `frontend-api/auth/[...nextauth]/route.js`; admin `lib/authOptions.ts`; compat auth |
| X3 | `middleware.js` | Session gate | — | — | `isSubscriptionBuy` boolean | Dashboard access | `GET /my-services` | — | `{ client_ref, services[{service_type,status,…}] }` | FRONTEND CHANGE | Replace with ACTIVE SA/MTD checks (four states) | `tax_simba_frontend/src/middleware.js`, login/register, subscriptions, NextAuth callbacks |
| X4 | Privacy | List/detail | GET | various | — | May show email/phone | `maskContactMany`, `reveal-contact` | role-aware | Masked unless SUPER_ADMIN reveal | ADAPTER must preserve | Never unmask in compat for ADMIN/ACCOUNTANT | `db/mongo.ts`, `routes/admin.ts`; admin FE SUPER_ADMIN role |

---

## 2. Auth / session / registration

| ID | FE page/component | FE API | Method | Toxel path | Request shape | Expected FE response | Node | Node request | Node response | Class | Solution | Affected files |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A1 | `register/page.client.js`, `GetStarted.jsx`, `lib/api.js` | Register | POST | `auth/register` | `{ name, surname, email, mobile, password, confirmPassword, userRole }` | `{ success, data: { isSubscriptionBuy:false, … }, message }` | `POST /api/auth/register` → `bootstrapClientServices` | `{ email, password, name, phone? }` | `{ user }` (+ cookies) | ADAPTER | Concat name; `mobile`→`phone`; ignore confirm/userRole; force non-active; start verify token issue | `compat/auth`; `routes/auth.ts`; `services/clientServices.ts` (**call only**) |
| A2 | NextAuth authorize | Login | POST | `auth/login` | `{ email, password }` | `{ success, data: { accessToken, user:{ id, email, firstName, lastName, roles, … } } }` | `POST /api/auth/login` | `{ email, password }` | `{ user }` or `{ two_factor_required, challenge }` + optional `access_token` | ADAPTER + FE | Map token/user fields; staff 2FA separate from customer OTP | NextAuth routes; `compat/auth`; `routes/auth.ts` |
| A3 | `lib/api.js` | Logout | POST | `auth/logout` | `{}` + Bearer | 200 | `POST /api/auth/logout` | CSRF + refresh cookie | `{ ok: true }` | ADAPTER | Accept Bearer revoke path | `compat/auth`; `http/session.ts` |
| A4 | `verify-email/page.client.js` | Verify | POST | `auth/verify-email?token=` | query `token` | `{ success, message }` | **none today** | — | — | BACKEND GAP | Minimal email_verify tokens; mark `email_verified_at`; server enforce before checkout | New verify module; `services/email.ts` |
| A5 | login / verify | Resend | POST | `auth/re-verify-email` | `{ email }` | `{ success, message }` | **none** | — | — | BACKEND GAP | Resend using email queue | same |
| A6 | `forgot-password/page.client.js` | Forgot | POST | `auth/forget-password` | `{ email }` | `{ message }` | **none** | — | — | BACKEND GAP | Reset token + email | New reset module |
| A7 | `reset-password/page.client.js` | Reset | POST | `auth/reset-password` | `{ token, password, confirmPassword }` | 200 | **none** | — | — | BACKEND GAP | Consume token; set password | same |
| A8 | `ChangeProfilePassword.jsx` | Change pw | POST | `auth/change-password` | `{ currentPassword, newPassword, confirmNewPassword }` | 200 | `POST /api/my-profile/change-password` | `{ current_password, new_password }` | ok | ADAPTER | Field rename | `compat/auth`; `routes/profile.ts` |
| A9 | `fetchData.js`, dashboards | Account | POST | `auth/get-account-details` | `{}` | Fat `data` incl. subscription flags | `GET /auth/me` + `GET /my-profile` + `GET /my-services` | — | user + profile + services | ADAPTER | Compose; expose explicit SA/MTD ACTIVE; never invent ACTIVE | `compat/account` |
| A10 | login/register Google buttons | Google | — | `auth/google` / `signIn('google')` | — | — | none | — | — | HIDE | Hide Google entry points | login + register pages |
| A11 | `UseCodeSection`, login-with-code | OTP | POST | `auth/login-with-code` | `{ email, action, code }` | login session | none (≠ staff TOTP) | — | — | HIDE | Hide OTP UI; default password path | `login/page.client.js`, `UseCodeSection.jsx`, admin sign-in OTP |
| A12 | Staff 2FA (admin security) | TOTP | various | staff 2FA panels if present | challenge/code | — | `/auth/login/2fa`, `/auth/2fa/*` | existing | existing | ADAPTER if staff FE uses legacy names | Keep Node TOTP; not customer OTP | `routes/auth.ts` |

**VERIFY-BEFORE-PURCHASE enforcement (server):**

| Checkpoint | Rule |
|---|---|
| Register | Create user + NOT_ACTIVE services; issue verification email; do **not** require verify to complete register |
| Login | Allowed if password ok (even if unverified) |
| Pre-purchase dashboard | Allowed unverified; show verification-required banner + resend |
| `POST /payments/service-checkout`, upgrade-checkout, offer-checkout, payment-request checkout | **403/400 if `email_verified_at` missing** |
| `fulfil` → `activateService` | Refuse activation if user email unverified (defence in depth) |
| Unverified | Never set `client_services.status = ACTIVE` |

---

## 3. Profile / UTR

| ID | FE | Method / path | Request | Expected | Node | Class | Solution | Files |
|---|---|---|---|---|---|---|---|---|
| P1 | `EditProfile.jsx` | PUT `auth/update-account-settings` | name, surname, mobile, address, utr?, photo? | 200 | `PATCH /my-profile` `{ name, phone, address }` | ADAPTER + FE | Map name fields; **UTR optional — no block**; no client UTR write unless product later; photo = hide or GAP | `compat/profile`; `routes/profile.ts` |
| P2 | Profile UTR reveal | — | — | utr | `GET /my-profile/utr` | FE CHANGE if needed | Reveal-only; missing UTR must not block dashboard/journey | profile pages; middleware |
| P3 | Admin profile edit | PUT update-account-settings | staff fields | 200 | CLIENT-only my-profile | HIDE or BACKEND GAP | Prefer hide staff photo/UTR edit for P0 | admin profile sections |

---

## 4. Entitlements / packages / purchase / activation

| ID | FE | Method / path | Request | Expected | Node | Class | Solution | Files |
|---|---|---|---|---|---|---|---|---|
| E1 | Ownership SoT | (replace isSubscriptionBuy) | — | four states | `GET /api/my-services` | FRONTEND CHANGE | ACTIVE `SELF_ASSESSMENT` / `MTD_INCOME_TAX` | middleware, subscriptions, login |
| E2 | `planlist/page.jsx`, pricing, MTD pricing | GET `subscription-plans?category=` | `taxSimba` / `mtd` | plans camelCase | `GET /packages?service_type=` | ADAPTER | Map category→service_type; marketing field aliases | `compat/packages` |
| E3 | `planlist/[id]/page.jsx` | GET `subscription-plans/:id` | — | plan | packages | ADAPTER | Lookup by id/code | same |
| E4 | `MySubscriptionsClient.jsx` | GET `client/active/subscription/list` | — | subscription-like list | `GET /my-services` | ADAPTER | Map ACTIVE only; both services possible | `compat/entitlements` |
| E5 | `planlist/[id]/page.jsx` | POST `client/subscription/checkout-session` | `{ planId, paymentMethod? }` | `{ data: { checkoutUrl } }` | `POST /payments/service-checkout` `{ service_type, package_code, origin_url }` | ADAPTER | Map plan→package; require verified email server-side; return `checkoutUrl`←`checkout_url` | `compat/payments`; **call** `payments.ts` |
| E6 | `planlist/[id]/page.jsx` Elements | POST `client/subscription/create` | planId, paymentMethodId, priceId | PaymentIntent/subscription | — | FRONTEND CHANGE | **Disable/remove** for P0 | `planlist/[id]/page.jsx` |
| E7 | `checkout-success/page.jsx` | POST `client/subscription/checkout-success` | `{ sessionId }` | purchase info | `GET /payments/status/:sessionId` → `fulfil` | ADAPTER | Poll/fulfil only if Stripe paid; **never trust page alone**; FE must refresh my-services not set isSubscriptionBuy | `compat/payments`; `payments.fulfil`; FE checkout-success |
| E8 | Upgrade UX | navigate planlist | — | upgrade | `GET /my-upgrade-options`, `POST /payments/upgrade-checkout` | FRONTEND CHANGE | Wire upgrade-only; no downgrade UI | `MySubscriptionsUI.jsx` |
| E9 | Portal/cards/cancel | various | — | — | none | HIDE | Hide | MySubscriptionsUI, planlist cards |
| E10 | Activation spine | (server) | paid session | ACTIVE + case (+ periods) | `fulfil` → `activateService` → `ensurePeriods` | PROTECTED | Adapters call only; no duplicate logic | `payments.ts`, `packages.ts`, `mtd.ts` |

**Idempotency:** `tx.fulfilled`, business-key duplicates, `ensurePeriods` skip existing quarters — preserved.

**Failed/cancelled/incomplete payments:** must not call `activateService`.

---

## 5. Additional / custom payment requests (P0 IN SCOPE)

Node already implements ADDITIONAL_WORK without service activation:

| ID | Actor | Method / path (Node native preferred) | Request | Response | Class | Solution | Files |
|---|---|---|---|---|---|---|---|
| AW1 | Admin/Staff | `POST /api/payment-requests` | `{ case_id, description, amount, vat_rate?, due_date?, mtd_period_id?, recommendation_id?, internal_note? }` | request tx `kind=ADDITIONAL_WORK` | FRONTEND CHANGE + thin ADAPTER if path alias needed | Wire admin UI to **existing** Node route; optional compat alias `/admin/payment-requests` | `routes/payments.ts` (protected); **new admin FE page/section** |
| AW2 | Client | `GET /api/payment-requests` (scoped) / my-actions / my-payments | — | pending AW | FRONTEND CHANGE | Surface in client actions/billing | client actions / billing |
| AW3 | Client | `POST /api/payment-requests/:id/checkout` `{ origin_url }` | `{ checkout_url, session_id, amount }` | ADAPTER optional | Same Checkout Session infra | `payments.ts` |
| AW4 | Staff | list/status via `GET /payment-requests`, `GET /payments` | filters | statuses | ADAPTER if admin legacy path | Show payment_status; no activateService | admin payments UI |
| AW5 | Server | `fulfil` when `kind === ADDITIONAL_WORK` | paid tx | marks paid/fulfilled only | PROTECTED | **Must not** call `activateService` / create entitlement/case | `payments.ts` fulfil ADDITIONAL_WORK branch |

**Tests required:** AW pay does not create SA/MTD ACTIVE; does not duplicate case; SERVICE_ACTIVATION still activates correctly.

---

## 6. Engagement / client-care agreement (P0)

| ID | FE | Method / path | Request | Expected | Node | Class | Solution | Files |
|---|---|---|---|---|---|---|---|---|
| G1 | `engagement-letter/page.jsx`, middleware | POST `client/accept-engagement-letter` | `{ signature, accepted }` | success | **none** | BACKEND GAP | Minimal record: user_id, service_type/case_id, agreement_version, status, accepted_at, audit | New `engagement` module |
| G2 | middleware force after purchase | — | — | redirect until accepted | check status API | FE + GAP | After ACTIVE entitlement, require accept before journey continue; not before purchase | middleware; engagement page |
| G3 | `submit-tax-info` | POST `client/submit-tax-info` | FormData / answers | success | `POST /mtd/cases/:id/onboarding` and/or profile | ADAPTER | Map questionnaire; no activation | `mtdOnboarding.ts` |

---

## 7. Cases / workflow / assignment / review

| ID | FE | Method / path | Request | Expected | Node | Class | Solution | Files |
|---|---|---|---|---|---|---|---|---|
| C1 | ID strategy | — | `taxReturnId` | case payloads | `caseId` | ADAPTER | Stable taxReturnId ↔ caseId map (case.id as taxReturnId) | `compat/ids` |
| C2 | Client create case | POST `client/apply-tax-return` etc. | rich FormData | taxReturn | `POST /api/cases` | ADAPTER + **BACKEND hardening** | CLIENT create/access **requires ACTIVE entitlement** for service_type; prefer fulfilment-created cases; reject unpaid/unverified | `routes/cases.ts` entitlement gate; compat |
| C3 | Lists | POST `client/all-tax-returns`, admin/accountant `tax-return/files` | filters | list | `GET /cases` | ADAPTER | Role-scoped; CLIENT filtered by entitlement | `cases.ts` |
| C4 | Detail | `…/files/:id` | — | detail+files | `GET /cases/:id` + documents | ADAPTER | Ownership checks | same |
| C5 | Assign | POST `/admin/assign` | taxReturnId, accountantId, notes, deadline, priority | success | `POST /cases/:caseId/assign` | ADAPTER | Field map; ADMIN/SUPER_ADMIN only | `cases.ts` |
| C6 | Progress / review | progress, manage-review, get-review | free-form status / approve|reject | success | whitelist transitions, admin-approve/return | ADAPTER | Map to whitelist only; reject unknown | `workflow.ts` (**call only**) |
| C7 | Staff duplicate prevention | staff POST /cases | client_user_id, service_type | case | POST /cases | BACKEND hardening | Staff must not create second open service case if one exists for client+service+tax_year; activation path remains preferred | `cases.ts` / domain helper |

### Case entitlement security tests (mandatory)

1. Unverified/unpaid client cannot create SA case  
2. Unverified/unpaid client cannot create MTD case  
3. SA-only cannot access/create MTD case  
4. MTD-only cannot access/create SA case  
5. Dual can access both  
6. Duplicate case creation prevented  
7. Direct API cannot bypass entitlement checks  
8. Authorised staff workflows still work  

---

## 8. Documents

| ID | FE | Method / path | Class | Node | Solution |
|---|---|---|---|---|---|
| D1 | my-files / uploads / final-certificate | various client/admin upload & list | ADAPTER | `routes/documents.ts`, storage | Map multipart fields; scoped list; no logic copy |
| D2 | request documents | accountant request-documents | ADAPTER | `POST /cases/:id/request-from-client` (+ MTD period requests) | Field map |
| D3 | Viewing/download | download links | ADAPTER | `GET /documents/:id/download` | Auth blob; ownership |

Launch journeys: client upload; staff request; view; case-linked; final docs where in P0.

---

## 9. Messages / notifications

| ID | FE | Method / path | Class | Node | Solution |
|---|---|---|---|---|---|
| M1 | communication-log / send-to-* | POST | ADAPTER | `GET|POST /messages` | taxReturn→case; body map |
| M2 | all-notifications | POST body filters | ADAPTER | `GET /notifications` | Remap `is_read`↔`read` |
| M3 | mark read / read-all | PATCH | ADAPTER | `POST …/read`, `POST …/read-all` | Method/path map |
| M4 | delete notification | DELETE | HIDE | none | Hide UI action |

---

## 10. MTD

| ID | FE | Method / path | Class | Node | Solution |
|---|---|---|---|---|---|
| T1 | mtd/dashboard-overview, compliance, documents | GET/POST | ADAPTER | `mtd.ts`, periods, documents | Aggregate over ACTIVE MTD case; call `ensurePeriods` only via existing domain paths |
| T2 | mtd/documents/upload | POST multipart | ADAPTER | `documents/upload` | Field map + period/case ids |
| T3 | start-next-quarter | POST | HIDE/DEFER | periods already on activation | Hide modal; no HMRC |
| T4 | onboarding | submit-tax-info / onboarding | ADAPTER | `mtdOnboarding.ts` | Map answers |

---

## 11. Admin / accountant / SUPER_ADMIN ops

| ID | FE | Method / path | Class | Node | Solution |
|---|---|---|---|---|---|
| S1 | Role gates ADMIN only | middleware/hooks | FRONTEND CHANGE | roles include SUPER_ADMIN | First-class SUPER_ADMIN; do not collapse to ADMIN |
| S2 | accountants/clients CRUD-ish | `/admin/accountants*`, `/admin/clients*` | ADAPTER | `/users`, `/staff-invites`, `PATCH …/active` | Prefer invites; mask contacts |
| S3 | dashboard stats | `/admin/dashboard/stats` etc. | ADAPTER (best-effort) | `/stats/admin`, `/stats/accountant` | Field map; defer exotic yearly metrics |
| S4 | payments list | `/admin/payments` | ADAPTER | `GET /payments` | Include AW + service txs; defer stats/export |
| S5 | FAQs | `/admin/faqs*` | ADAPTER | existing FAQ routes | Shape map |
| S6 | CMS/partners/tax-rates/api-keys/templates | many | HIDE/DEFER | none / content keys only | Out of P0 |

---

## 12. Protected Node domain (do not rewrite)

- `services/clientServices.ts` — `bootstrapClientServices`  
- `domain/packages.ts` — `activateService`, `servicesFor`, `serviceView`  
- `routes/payments.ts` — `fulfil`, checkouts, webhook, payment-requests  
- `domain/mtd.ts` — `ensurePeriods`  
- `routes/mtd.ts`, `routes/mtdOnboarding.ts`  
- `domain/cases.ts`, `domain/workflow.ts`  
- `routes/cases.ts` (may **add** entitlement/duplicate guards only)  
- `routes/documents.ts`, `services/storage.ts`  
- `routes/collaboration.ts`  
- `routes/recommendations.ts`  
- `db/mongo.ts` masking; `admin.ts` reveal-contact  
- `middleware/auth.ts`, CSRF, session, security  

---

## 13. Classification counts (updated for product decisions)

| Class | Count | Notes |
|---|---|---|
| MATCH | **0** | Unchanged |
| ADAPTER | **62** | +AW aliases / payment-request surface maps |
| FRONTEND CHANGE | **16** | +AW admin/client UI wire; entitlement gate; Checkout-only; SUPER_ADMIN; hide OTP/Google; engagement middleware; checkout-success |
| BACKEND GAP | **6** | email verify, resend, password forgot, password reset, engagement accept (+ optional staff profile hide instead of gap) |
| HIDE/DEFER | **~35** | OTP, Google, portal/cards, notif delete, start-next-quarter, CMS/marketing, payment analytics |
| CRITICAL hardening | **1 area** | Case entitlement + duplicate prevention on `POST /cases` / CLIENT access |

**P0 issue total (actionable):** ~84 (0 + 62 + 16 + 6), excluding pure marketing CMS deferrals.

---

## 14. Newly discovered / confirmed conflicts

| ID | Conflict | Resolution |
|---|---|---|
| N1 | OTP UI is default chooser (`isUsePassword=false`) but password path exists and is sufficient | **Hide OTP**; land on / encourage password path — product decision D1 |
| N2 | VERIFY-BEFORE-PURCHASE vs no Node verify fields | **BACKEND GAP** — add `email_verified_at` + enforce on checkout/fulfil |
| N3 | Engagement required vs no Node store | **BACKEND GAP** — minimal acceptance record |
| N4 | `POST /cases` has **no** ACTIVE entitlement check today (`cases.ts` L276–327) | **CRITICAL hardening** — server-side gate for CLIENT; duplicate prevention for staff |
| N5 | checkout-success sets `isSubscriptionBuy: true` client-side | FE must stop; activation only via `fulfil` |
| N6 | AW fulfil already safe (no activateService) | Reuse; wire FE; add regression tests |
| N7 | Toxel has no AW UI today | **FRONTEND CHANGE** to call existing Node AW APIs — in P0 per D3 |

---

## 15. Hour estimate (updated)

| Phase | Scope | Hours |
|---|---|---|
| K.0 | Baseline lock, decisions recorded, security checklist | 4–6 |
| K.1 | Compat infra (envelope, auth bridge, ID map) | 16–20 |
| K.2 | Email verify + password reset + verify-before-purchase enforcement | 18–22 |
| K.3 | Entitlements FE + Checkout-only + fulfil adapters + hide Elements/OTP/Google | 26–32 |
| K.4 | Engagement acceptance (Node + FE) | 10–14 |
| K.5 | Case entitlement hardening + cases/docs/messages/notifications adapters | 32–40 |
| K.6 | MTD aggregate adapters; hide start-next-quarter | 14–18 |
| K.7 | Admin assign/review/users + SUPER_ADMIN FE + payments list | 18–24 |
| K.8 | **Additional-work payment-request FE wire** + AW regression tests | 16–22 |
| K.9 | Automated + E2E gate (incl. entitlement + AW + verify-before-purchase) + release matrix | 30–38 |
| **Total** | | **~184–236h** |

---

## 16. Final K.0–K.9 implementation sequence (code only after explicit approval)

1. **K.0** — No product code; this baseline + decision log (done with this doc).  
2. **K.1** — `compat/` mount + envelope + Bearer auth map + taxReturnId↔caseId.  
3. **K.2** — Verify/reset Node modules; checkout/fulfil verify gates; FE banner/resend.  
4. **K.3** — Replace isSubscriptionBuy; Checkout Session only; status poll adapter; hide OTP/Google/Elements.  
5. **K.4** — Engagement accept API + FE + middleware after purchase.  
6. **K.5** — Entitlement-gate `POST /cases` + CLIENT access; workflow/docs/messages/notifications adapters; duplicate case prevention.  
7. **K.6** — MTD overview adapters; hide start-next-quarter; no HMRC.  
8. **K.7** — Admin/accountant adapters; SUPER_ADMIN role FE; contact masking preserved.  
9. **K.8** — Admin create AW payment-request; client pay; staff status; prove no entitlement side effects.  
10. **K.9** — Full test matrix + release PASS/FAIL/DEFERRED/BLOCKED; no prod until CRITICAL pass.

---

## 17. Branch integrity

| Branch | Policy |
|---|---|
| `taxsimba-p0-integration` | Only branch for P0 work |
| `main` | **Untouched** |
| `node-only-production` | **Untouched** |
| `toxel-frontend-reference` | **Untouched** (read-only zip reference) |

---

## 18. Stop condition

This file is the acceptance baseline.  
**No implementation / product code until explicit approval.**
