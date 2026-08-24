# TaxSimba — Frontend ↔ Backend Integration Map (frozen reference for Node.js migration)

Companion documents: `NODE_HANDOVER.md` (behaviour spec), `NODE_MIGRATION_CHECKLIST.md` (parity proof).
Scope: every existing Client / Accountant / Admin / Super Admin screen and the exact API surface it uses.
Nothing in this document may be simplified, renamed or merged during migration.

Conventions used below:
- All paths are prefixed **`/api`** (e.g. `/cases` = `GET /api/cases`). Frontend base URL: `REACT_APP_BACKEND_URL`.
- Roles: `CLIENT`, `ACCOUNTANT`, `ADMIN`, `SUPER_ADMIN`. `ADMIN` capabilities are also held by `SUPER_ADMIN`.
- "Audit" = row appended to the case activity / audit log. "Notify" = in-app notification row.
- **Client-visible** = safe to return to a CLIENT. **Staff-only** = must never appear in a client payload.
- Accountants only see **assigned** cases; unassigned access = 403.

---

## 0. Global shell and transport

| Item | Detail |
|---|---|
| Frontend transport | `src/lib/api.js` — axios instance on `REACT_APP_BACKEND_URL`, `withCredentials`, refresh-on-401 retry, `openDocument(id, name)` authenticated blob download (never a raw `<a href>` to a protected file) |
| Shell | `components/AppShell.jsx` — all roles. Calls `GET /auth/me`, `GET /notifications`, `GET /notifications/unread-count` (20s poll), and for CLIENT `GET /my-services` for **service-aware navigation**: the "MTD for Income Tax" item appears automatically when an `MTD_INCOME_TAX` service is `ACTIVE` (no admin unlock step), and the SA-only items `/my-return` and `/journey` are hidden when `SELF_ASSESSMENT` is not `ACTIVE`. Shared areas (Documents, Messages, Tasks, Profile, My Services, Help, Settings, Report a Problem) stay common. `/dashboard` shows an "Open MTD for Income Tax" card (`data-testid="mtd-portal-card"`) for MTD-only clients |
| Route guard | `App.js` `<Guard roles={...}>` — client-side convenience only. **Every rule is re-enforced server-side**; the Node backend must not rely on the frontend guard |
| Errors | Backend returns `{ "detail": ... }`; frontend renders via `apiError()`. Preserve `detail` shape and HTTP codes (400 rule violation, 401 session, 403 permission, 404 not found, 409 version mismatch, 429 rate limit/lockout) |

### Route → page → role
| Route | Page/component | Role |
|---|---|---|
| `/login` | `Login.jsx` | public |
| `/invite/:token` | `AcceptInvite.jsx` | public (invited staff) |
| `/` | `Landing.jsx` | public |
| `/dashboard` | `client/ClientDashboard.jsx` | CLIENT |
| `/my-return` | `client/MyTaxReturn.jsx` | CLIENT |
| `/documents` | `client/ClientPages.jsx → ClientDocuments` | CLIENT |
| `/messages` | `client/ClientPages.jsx → ClientMessages` | CLIENT |
| `/tasks` | `client/ClientPages.jsx → ClientTasks` | CLIENT |
| `/journey` | `client/ClientPages.jsx → ClientJourneyPage` | CLIENT |
| `/profile` | `client/ClientProfile.jsx` | CLIENT |
| `/subscription` | `client/MyServices.jsx` | CLIENT |
| `/payment/success`, `/payment/cancel` | `client/PaymentSuccess/Cancel` | CLIENT |
| `/actions` | `client/ClientActions.jsx → ActionRequired` | CLIENT |
| `/recommendation/:offerId` | `client/ClientActions.jsx → RecommendationReview` | CLIENT |
| `/mtd` | `client/MtdQuarters.jsx` | CLIENT (nav shown only when MTD ACTIVE) |
| `/help` | `client/HelpCentre.jsx` | CLIENT |
| `/settings` | `client/ClientSettings.jsx` | CLIENT |
| `/service-issues` | `ServiceIssues.jsx (client mode)` | CLIENT |
| `/work` | `staff/AccountantDashboard.jsx` | ACCOUNTANT (+ADMIN/SUPER_ADMIN) |
| `/work/mtd` | `staff/AccountantMtd.jsx` | ACCOUNTANT |
| `/work/cases/:id`, `/admin/cases/:id`, `/admin/review/:id` | `staff/CaseWorkspace.jsx` | ACCOUNTANT (assigned) / ADMIN / SUPER_ADMIN |
| `/admin` | `staff/AdminPages.jsx → AdminDashboard` | ADMIN/SUPER_ADMIN |
| `/admin/cases` | `staff/AdminPages.jsx → AdminCases` | ADMIN/SUPER_ADMIN |
| `/admin/accountants` | `staff/AdminPages.jsx → AdminAccountants` | ADMIN/SUPER_ADMIN |
| `/admin/recommendations` | `staff/AdminRecommendations.jsx` | ADMIN/SUPER_ADMIN |
| `/admin/mtd` | `staff/AdminMtd.jsx` | ADMIN/SUPER_ADMIN |
| `/admin/service-issues` | `ServiceIssues.jsx (admin mode)` | ADMIN/SUPER_ADMIN |
| `/staff/security` | `staff/StaffSecurity.jsx` + `components/TwoFactorPanel.jsx` | ACCOUNTANT/ADMIN/SUPER_ADMIN |
| `/super` | `staff/SuperAdmin.jsx` | SUPER_ADMIN |

---

## 1. Registration / login / session / MFA

Screens: `Login.jsx`, `AcceptInvite.jsx`, `StaffSecurity.jsx`, `TwoFactorPanel.jsx`, `ClientSettings.jsx`.

| Endpoint | Method | Role | Request | Response | Notes |
|---|---|---|---|---|---|
| `/auth/register` | POST | public | `{name, email, password, phone?, ...}` | `{user}` + session cookies | Creates CLIENT user. Password policy: 12+ chars, 3 of 4 classes, not containing email local part/name |
| `/auth/login` | POST | public | `{email, password}` | `{user}` or `{two_factor_required: true, challenge}` | Browser callers get **no token in the body** (httpOnly cookie only); non-browser callers also get `access_token`. Rate limits: 5/IP+email → 15 min lock, 10/account, 50/IP → 429 + `Retry-After` |
| `/auth/login/2fa` | POST | public (challenge) | `{challenge, code}` | `{user}` + cookies | TOTP second factor |
| `/auth/2fa/status` | GET | staff/client | — | `{enabled}` | |
| `/auth/2fa/enrol` | POST | authenticated | — | `{secret, otpauth_url}` | QR rendered by `qrcode.react` |
| `/auth/2fa/activate` | POST | authenticated | `{code}` | `{enabled: true}` | Audit: 2FA enabled |
| `/auth/2fa/disable` | POST | authenticated | `{code \| password}` | `{enabled: false}` | Audit |
| `/auth/refresh` | POST | refresh cookie | — | new cookies | Rotates + revokes prior refresh token. Requires `X-CSRF-Token` matching `csrf_token` cookie for browser callers |
| `/auth/logout` | POST | authenticated | — | `{ok}` | Revokes refresh token; CSRF-protected |
| `/auth/me` | GET | authenticated | — | `{id, name, email, role, is_active, two_factor_enabled, ...}` | Drives nav + guards |
| `/auth/invite/{token}` | GET | public | — | `{email, name, role, valid}` | Staff invitation preview |
| `/auth/invite/{token}/accept` | POST | public | `{password, ...}` | `{user}` + session | Activates invited staff user. Audit |

Session model: access token ~15 min, refresh 7 days rotated, httpOnly/Secure/SameSite configurable (`COOKIE_SECURE`, `COOKIE_SAMESITE`). Client-visible: own identity only. Staff-only: role/permission internals, invitation tokens.

---

## 2. Client onboarding, profile, settings, help

| Endpoint | Method | Role | Request | Response / fields | Notes |
|---|---|---|---|---|---|
| `/my-profile` | GET | CLIENT | — | name, email, phone, address, `utr_masked`, `preferences` | UTR masked by default |
| `/my-profile/utr` | GET | CLIENT | — | `{utr}` | Own UTR reveal |
| `/my-profile` | PATCH | CLIENT | `{name, phone, address...}` | updated profile | Audit |
| `/my-profile/email-change` | POST | CLIENT | `{new_email}` | `{status}` | Requires verification; audit + staff notification |
| `/my-profile/change-password` | POST | CLIENT | `{current_password, new_password}` | `{ok}` | Password policy enforced |
| `/my-preferences` | PATCH | CLIENT | `{preferences}` | `{preferences}` | Notification prefs |
| `/my-data-requests` | POST / GET | CLIENT | `{kind}` | list of requests with `status` | GDPR export/erasure request trail; audit + admin notify |
| `/faqs`, `/faq-categories` | GET | any | `?category=` | published FAQs | Client sees published only |
| `/faqs`, `/faqs/{id}` | POST/PATCH/DELETE | ADMIN/SUPER_ADMIN | FAQ body | FAQ | Audit |
| `/service-issues` | POST | CLIENT | `{case_id, category, description}` | issue with `status` | "Report a Problem". Notify admin, audit |
| `/service-issues` | GET | CLIENT (own) / ADMIN (all, `?status=`) | — | issues | Client sees own only |
| `/service-issues/{id}` | PATCH | ADMIN/SUPER_ADMIN | `{status, resolution?}` | issue | Audit; client notified |

Onboarding case creation: `POST /cases` (staff/system) creates a case at `NEW`/`ONBOARDING`; the client-facing "provide your information" state is expressed through case status + tasks, not a separate questionnaire service. Client-visible: own profile, own issues, published FAQs. Staff-only: internal issue notes, other clients' data.

---

## 3. Cases — shared SA + MTD read surface

| Endpoint | Method | Role | Request | Response fields | Notes |
|---|---|---|---|---|---|
| `/cases` | GET | all (scoped) | `?service_type=SELF_ASSESSMENT\|MTD_INCOME_TAX`, `?status=`, `?include_test=true` | list: `id, case_ref, client_name*, tax_year, service_type, status, stage, next_action, next_action_owner, external_deadline, days_to_deadline, deadline_flag, assigned_accountant*` | CLIENT sees own only (client-safe status label); ACCOUNTANT sees assigned only; ADMIN/SUPER_ADMIN all. `OPERATIONAL_ONLY` filter excludes test-marked records by default |
| `/cases` | POST | ADMIN/SUPER_ADMIN (or activation flow) | `{client_user_id, service_type, tax_year, ...}` | case | Audit: case created |
| `/cases/{id}` | GET | case-scoped | — | full case + `journey` (5 stages), `has_submission_record`, `waiting_reason`, financial summary (published only for CLIENT) | CLIENT payload must not contain draft figures, internal notes, accountant identity internals |
| `/cases/{id}/activity` | GET | ACCOUNTANT/ADMIN/SUPER_ADMIN | — | activity/audit rows | **Staff-only** (client access blocked) |
| `/cases/{id}/notes` | GET/POST | ACCOUNTANT/ADMIN/SUPER_ADMIN | `{body}` | notes | Staff-only internal notes |
| `/cases/{id}/reviews` | GET | staff | — | admin review history | Staff-only |
| `/cases/{id}/assignments` | GET | staff | — | assignment history | Staff-only |
| `/cases/{id}/reopen-history` | GET | staff | — | reopen reasons/timestamps | Staff-only |
| `/cases/{id}/final-documents` | GET | case-scoped incl. CLIENT | — | `[{id, name, final_version, uploaded_at}]` | Client-visible final documents only |
| `/cases/{id}/final-documents` | POST | ADMIN/SUPER_ADMIN | multipart file | document | Publishes a versioned client-visible final doc. Audit + client notify |

SA statuses (`workflow.STATUSES`): `NEW, ONBOARDING, AWAITING_ASSIGNMENT, ASSIGNED, ACCOUNTANT_REVIEW, AWAITING_CLIENT, IN_PREPARATION, READY_FOR_ADMIN_REVIEW, ADMIN_REVIEW, CHANGES_REQUIRED, ADMIN_APPROVED, AWAITING_CLIENT_APPROVAL, CLIENT_APPROVED, READY_FOR_SUBMISSION, SUBMISSION_IN_PROGRESS, SUBMITTED, SUBMISSION_ISSUE, COMPLETED`.
Journey stages: `Information, Documents, Accountant Review, Your Approval, HMRC Submission`.
Client labels come from `CLIENT_STATUS_LABELS` — **a client screen must never render the raw enum**.
Transitions are whitelisted by `ALLOWED_TRANSITIONS`; anything else = 400.

---

## 4. Admin assignment / reassignment

Screen: `CaseWorkspace.jsx` (admin mode), `AdminPages.jsx → AdminAccountants`.

| Endpoint | Method | Role | Request | Result | Workflow | Audit / Notify |
|---|---|---|---|---|---|---|
| `/cases/{id}/assign` | POST | ADMIN/SUPER_ADMIN | `{accountant_id, note?}` | assignment record | `AWAITING_ASSIGNMENT → ASSIGNED` (reassignment allowed from active states) | Audit: assigned/reassigned; notify accountant |
| `/cases/{id}/unassign` | POST | ADMIN/SUPER_ADMIN | `{reason}` | case unassigned | back to `AWAITING_ASSIGNMENT` | Audit with reason; notify prior accountant |
| `/accountants/workload` | GET | ADMIN/SUPER_ADMIN | — | `[{id, name, specialisms, capacity, active_cases, sa_cases, mtd_cases}]` | — | — |

**Rule to preserve:** an accountant has no access to a case until an ADMIN assigns it. Unassigned accountant calling any case endpoint = 403.

---

## 5. Documents, uploads, document requests

| Endpoint | Method | Role | Request/params | Response | Notes |
|---|---|---|---|---|---|
| `/documents` | GET | scoped | `case_id`, `mtd_period_id`, `filter=final`, `status` | `[{id, name, document_type, status, uploaded_by, uploaded_at, client_visible, mtd_period_id, case_id}]` | **Node.js: must always be scoped** to case / client / MTD period / explicit authorised scope; no unscoped global listing. Client sees own + client-visible only |
| `/documents/upload` | POST | CLIENT (own case) / staff | multipart: `case_id`, `document_type`, `mtd_period_id?`, `document_id?` (fulfils a request), `file` | document | Chunk/size limits and type validation. Audit; notify counterparty |
| `/documents/{id}/status` | PATCH | ACCOUNTANT/ADMIN/SUPER_ADMIN | `?status=` (`Requested`, `Received`, `Accepted`, `Rejected`) | document | Audit; client notified on rejection/request |
| `/documents/{id}/download` | GET | authorised only | — | file stream | Must be fetched authenticated (blob), never a raw href. Cross-client = 403 |
| `/cases/{id}/request-from-client` | POST | ACCOUNTANT/ADMIN/SUPER_ADMIN | `{items[], note?}` | requests + tasks created | SA: `→ AWAITING_CLIENT` with `waiting_reason` | Audit; client notify |
| `/mtd/periods/{period_id}/requests` | POST | ACCOUNTANT/ADMIN/SUPER_ADMIN | `{document_type, note?}` | request row (`status: "Requested"`) | Feeds MTD `waiting_for_client` bucket | Audit; client notify |
| `/mtd/periods/{period_id}/documents` | GET | scoped | — | period documents | Period-scoped |

Staff-only: internal working documents (not `client_visible`), staff uploader identity details, rejection internals.

---

## 6. Tasks, messages, notifications, deadlines

| Endpoint | Method | Role | Request | Response | Notes |
|---|---|---|---|---|---|
| `/tasks` | GET | scoped | `?status=OPEN`, `?service_type=`, `?case_id=` | `[{id, title, description, status, due_date, case_id, service_type}]` | Client sees own tasks only |
| `/tasks/{id}/complete` | POST | CLIENT (own) / staff | — | task | Audit; may release `AWAITING_CLIENT` back to `ACCOUNTANT_REVIEW` when all items in. Notify accountant |
| `/messages` | GET/POST | case-scoped | `?case_id=` / `{case_id, body}` | messages | Client↔staff thread. Notify recipient |
| `/notifications` | GET | authenticated | — | `[{id, title, body, read, created_at, link?}]` | Own notifications only |
| `/notifications/{id}/read`, `/notifications/read-all` | POST | authenticated | — | `{ok}` | |
| `/notifications/unread-count` | GET | authenticated | — | `{count}` | 20s poll in `AppShell` |
| `/my-actions` | GET | CLIENT | — | outstanding tasks, approvals, document requests, offers, payment requests | Powers `/actions` |

Deadlines: derived server-side from `tax_year` (SA: 31 January following year end) and MTD period rules. Flags: `OVERDUE`, `DUE_3`, `DUE_7`, `DUE_14` with `days_to_deadline`; suppressed once submitted. **Node.js: reminder dispatch must be scheduler/worker-driven, not triggered by a client opening the portal.**

---

## 7. Packages, services, purchase/activation (SA and MTD)

Screens: `client/MyServices.jsx`, `client/ClientActions.jsx`, `staff/SuperAdmin.jsx`, `staff/AdminRecommendations.jsx`, `staff/CaseWorkspace.jsx`.

| Endpoint | Method | Role | Request | Response | Notes |
|---|---|---|---|---|---|
| `/packages` | GET | any authenticated | `?service_type=` | `[{id, code, name, price, service_type, features}]` | SA: SIMPLE/SMART/ELITE. MTD: MTD_ESSENTIAL/MTD_PLUS |
| `/packages` | POST, `/packages/{id}/price` PATCH | SUPER_ADMIN | `{price}` etc. | package | Audit; respects package lock |
| `/settings/package-lock` | GET (ADMIN) / PATCH (SUPER_ADMIN) | | `{locked}` | lock state | Audit |
| `/services` | GET | SUPER_ADMIN | — | service catalogue | |
| `/my-services` | GET | CLIENT | — | `{services: [{service_type: "SELF_ASSESSMENT"\|"MTD_INCOME_TAX", status: "ACTIVE"\|"NOT_ACTIVE"\|..., package_code, package_name, price, started_at}]}` | Drives MTD nav, MTD dashboard vs SA-only informational MTD card |
| `/clients/{client_user_id}/services` | GET | ADMIN/SUPER_ADMIN | — | that client's services | Staff view |
| `/my-upgrade-options` | GET | CLIENT | — | available upgrade(s) + price difference | Every client starts on SMART; ELITE is the visible upgrade |
| `/payments/upgrade-checkout` | POST | CLIENT | `{package_code, origin_url}` | `{url, session_id}` | Stripe test mode |
| `/payments/offer-checkout` | POST | CLIENT | `{offer_id, origin_url}` | `{url, session_id}` | Accepting a recommendation (incl. MTD activation) |
| `/payments/status/{session_id}` | GET | CLIENT | — | `{status, payment_status, fulfilled}` | Polled on `/payment/success`. **Idempotent fulfilment** |
| `/stripe/webhook` | POST | Stripe | signed event | `{received: true}` | Same idempotent fulfilment path |
| `/my-payments` | GET | CLIENT | — | payments/receipts | Client-visible own payments |
| `/payments` | GET | ADMIN/SUPER_ADMIN | filters | all payments | Staff oversight |
| `/clients/{client_user_id}/override-package` | POST | ADMIN/SUPER_ADMIN | `{package_code, reason}` | service | Manual override, audited |

**Activation rule:** a service becomes `ACTIVE` only after a confirmed payment (or an audited admin override). MTD activation then permits `POST /mtd/cases/{case_id}/generate-periods`. Activation must never happen implicitly from viewing a screen.

---

## 8. Recommendations / upgrades / additional work

| Endpoint | Method | Role | Request | Workflow | Audit / Notify |
|---|---|---|---|---|---|
| `/cases/{id}/recommend-additional-work` | POST | ACCOUNTANT/ADMIN/SUPER_ADMIN | `{description, amount, ...}` | recommendation `PENDING_ADMIN` | Audit |
| `/cases/{id}/recommend-package` | POST | staff | `{package_code, reason}` | recommendation | Audit |
| `/cases/{id}/recommend-mtd` | POST | staff | `{reason}` | MTD recommendation | Audit |
| `/cases/{id}/recommendations` | GET | staff | — | case recommendations | Staff-only until offered |
| `/recommendations` | GET | ADMIN/SUPER_ADMIN | `?status=` | queue | |
| `/recommendations/{id}/approve` | POST | ADMIN/SUPER_ADMIN | `{price?, note?}` | approved | Audit |
| `/recommendations/{id}/reject` / `/decline` | POST | ADMIN/SUPER_ADMIN | `{reason}` | rejected/declined | Audit |
| `/recommendations/{id}/send-offer` | POST | ADMIN/SUPER_ADMIN | — | offer visible to client | Notify client |
| `/my-offers`, `/my-offers/{offer_id}` | GET | CLIENT | — | offer detail (name, price, reason wording) | Client-visible only after admin release |

The accountant → admin approval → client offer pathway must be preserved exactly; accountants cannot make a priced offer visible to a client on their own.

---

## 9. Additional-work payment requests and receipts

| Endpoint | Method | Role | Request | Response | Notes |
|---|---|---|---|---|---|
| `/payment-requests` | POST | ADMIN/SUPER_ADMIN | `{case_id, description, amount, due_date?}` | request (`status: UNPAID`) | Audit; notify client |
| `/payment-requests` | GET | CLIENT (own) / staff (`?case_id=`) | — | requests with `status` (`UNPAID`, `PAID`, `CANCELLED`) | |
| `/payment-requests/{id}/checkout` | POST | CLIENT | `{origin_url}` | `{url, session_id}` | Stripe test |
| `/payment-requests/{id}/cancel` | POST | ADMIN/SUPER_ADMIN | — | cancelled (stays in history) | Audit |
| `/payment-requests/{id}/resend` | POST | ADMIN/SUPER_ADMIN | — | re-notified | Audit; notify client |
| `/payment-requests/{id}/receipt` | GET | client (own) / staff | — | printable receipt (`invoices.py`) | Client-visible receipt |

---

## 10. Accountant Self Assessment preparation

Screens: `staff/AccountantDashboard.jsx` (`/stats/accountant`, `/cases`, `/tasks`), `staff/CaseWorkspace.jsx`.

| Endpoint | Method | Role | Request | Workflow transition | Audit / Notify |
|---|---|---|---|---|---|
| `/cases/{id}/start-review` | POST | ACCOUNTANT (assigned) | — | `ASSIGNED → ACCOUNTANT_REVIEW` | Audit |
| `/cases/{id}/mark-reviewed` | POST | ACCOUNTANT | — | `→ IN_PREPARATION` | Audit |
| `/cases/{id}/request-from-client` | POST | ACCOUNTANT/ADMIN/SUPER_ADMIN | `{items[], note?}` | `→ AWAITING_CLIENT` (+`waiting_reason`) | Audit; notify client |
| `/cases/{id}/calculations` | POST | ACCOUNTANT | `{income, expenses, tax_due, note, ...}` | new **draft** calculation version | Audit. **Staff-only until released** |
| `/cases/{id}/calculations` | GET | staff (all versions) / client (released only) | — | version history | Client sees the released version only |
| `/cases/{id}/submit-for-admin-review` | POST | ACCOUNTANT | `{calculation_version_id}` | `→ READY_FOR_ADMIN_REVIEW` | Audit; notify admin |

There is **no automatic tax calculation engine**: all figures are entered manually by the accountant and are informational.

---

## 11. Admin review / return / approval / release (SA)

| Endpoint | Method | Role | Request | Workflow | Audit / Notify |
|---|---|---|---|---|---|
| `/cases/{id}/admin-approve` | POST | ADMIN/SUPER_ADMIN | `{note?}` | `READY_FOR_ADMIN_REVIEW\|ADMIN_REVIEW → ADMIN_APPROVED → AWAITING_CLIENT_APPROVAL` (released to client) | Audit; notify client |
| `/cases/{id}/admin-return` | POST | ADMIN/SUPER_ADMIN | `{reason}` | `→ CHANGES_REQUIRED` | Audit with reason; notify accountant |
| `/cases/{id}/client-approve` | POST | CLIENT (own) | — | `AWAITING_CLIENT_APPROVAL → CLIENT_APPROVED → READY_FOR_SUBMISSION` | Audit; notify staff |
| `/cases/{id}/record-submission` | POST | **ADMIN/SUPER_ADMIN only** | `{submission_reference, submission_date, provider?, outcome?, note?}` | `→ SUBMITTED` | Audit; notify client. Accountant/client = 403 |
| `/cases/{id}/submission` | GET | case-scoped incl. CLIENT | — | `{submission_reference, submission_date, status}` | Client-visible confirmation |
| `/cases/{id}/complete` | POST | ADMIN/SUPER_ADMIN | `{note?}` | `SUBMITTED → COMPLETED` | Audit; notify client |
| `/cases/{id}/reopen` | POST | ADMIN/SUPER_ADMIN | `{reason}` | `COMPLETED → ACCOUNTANT_REVIEW/ASSIGNED` (audited only) | Audit with reason |

**Frontend contract note (regression-sensitive):** `GET /cases/{id}` must set `has_submission_record: true` for submission records with status `SUBMITTED` **or** `COMPLETED`, otherwise the client journey shows "Submitting" forever. The client dashboard only claims a successful HMRC submission when `status ∈ {SUBMITTED, COMPLETED}` **and** `has_submission_record` is true.

---

## 12. MTD for Income Tax — quarterly workflow

Screens: `client/MtdQuarters.jsx`, `staff/CaseWorkspace.jsx` (MTD panel), `staff/AccountantMtd.jsx`, `staff/AdminMtd.jsx`.

Period statuses: `NOT_STARTED, IN_PROGRESS, ADMIN_REVIEW, AWAITING_CLIENT_APPROVAL, APPROVED, SUBMITTED`.
Period kinds: `QUARTER` (Q1–Q4) and `FINAL_DECLARATION`.
Client stage labels (`STAGE_LABEL`): `Preparing`, `Under review`, `Awaiting your approval`, `Approved — ready to submit`, `Submitted`; staff labels come from `STAFF_STAGE_LABEL`. Figure fields: `income, expenses, net_profit, estimated_income_tax, estimated_national_insurance, suggested_set_aside, note` plus the standing informational `DISCLAIMER`.

| Endpoint | Method | Role | Request | Response / effect | Errors | Audit / Notify |
|---|---|---|---|---|---|---|
| `/mtd/cases/{case_id}/generate-periods` | POST | ADMIN/SUPER_ADMIN | — | `{created}` — Q1–Q4 + Final Declaration | idempotent | Audit |
| `/mtd/cases/{case_id}/periods` | GET | case-scoped | — | `[{id, kind, label, period_start, period_end, deadline, status, stage_label, next_action_owner, published{...}, approved_version}]` | 403 other client | — |
| `/mtd/cases/{case_id}/year-summary` | GET | case-scoped | — | published quarters + YTD totals | 403 other client | — |
| `/mtd/periods/{id}/figures` | POST | ACCOUNTANT/ADMIN/SUPER_ADMIN | figure fields | **draft** saved (staff-only) | 400 locked state/negative; 403 unassigned | Audit |
| `/mtd/periods/{id}/preview` | GET | staff | — | client-shaped preview of the draft | 400 no draft; 403 client | — |
| `/mtd/periods/{id}/submit-for-review` | POST | ACCOUNTANT/ADMIN/SUPER_ADMIN | — | `→ ADMIN_REVIEW` | 400 no draft/wrong state | Audit; notify admin |
| `/mtd/periods/{id}/admin-approve` | POST | ADMIN/SUPER_ADMIN | — | publishes a **new version**, `→ AWAITING_CLIENT_APPROVAL` | 400 wrong state/no draft; 403 accountant | Audit; notify client |
| `/mtd/periods/{id}/request-changes` | POST | ADMIN/SUPER_ADMIN | `{reason}` | `→ IN_PROGRESS` + reason | 400 blank reason/wrong state | Audit; notify accountant |
| `/mtd/periods/{id}/client-approve` | POST | CLIENT (own) | `{version}` | `→ APPROVED`, `approved_version` stored | 400 wrong state; **409 version mismatch**; 403 other client | Audit; notify staff |
| `/mtd/periods/{id}/reopen` | POST | ADMIN/SUPER_ADMIN | `{reason}` | `APPROVED → IN_PROGRESS`, active approval cleared, history preserved | 400 blank reason / not APPROVED / **SUBMITTED locked**; 403 | Audit with reason; notify |
| `/mtd/periods/{id}/record-submission` | POST | **ADMIN/SUPER_ADMIN only** | `{submission_reference, submission_date, provider?, outcome?, note?}` | `→ SUBMITTED` (locked) | 400 not APPROVED / already SUBMITTED / missing fields; **403 accountant and client** | Audit; notify client |
| `/mtd/periods` | GET | ADMIN/SUPER_ADMIN | `?bucket=` (incl. `waiting_for_client`, `final_declaration`) | operations queue rows | — | — |
| `/mtd/stats` | GET | ADMIN/SUPER_ADMIN | — | counts incl. `final_declarations` | — | — |
| `/mtd/my-workload` | GET | ACCOUNTANT | — | assigned MTD periods by state/deadline | — | — |

**Version locking:** the client approves an exact published `version`; a newer publish invalidates the prior approval and requires fresh client approval. Publishing a new version never auto-submits or auto-completes a period.
**Locking:** a `SUBMITTED` quarter or Final Declaration is final — no figure edit, reopen, re-approval or amendment route exists (amendments are a future Phase 2 item).
**SA-only clients:** a client with an SA case and no ACTIVE `MTD_INCOME_TAX` service sees the informational "Making Tax Digital" card on `/dashboard` (`data-testid="mtd-informational-card"`) — no case, no periods, no deadlines, no charge. It disappears once MTD is ACTIVE.

---

## 13. Admin operations and Super Admin oversight

| Endpoint | Method | Role | Response | Notes |
|---|---|---|---|---|
| `/stats/admin` | GET | ADMIN/SUPER_ADMIN | SA + MTD counters (kept **separate**), review queue, deadline buckets | Excludes test data by default |
| `/stats/accountant` | GET | ACCOUNTANT | own assigned-case counters | |
| `/accountants/workload` | GET | ADMIN/SUPER_ADMIN | per-accountant capacity/load | |
| `/users` | GET | ADMIN/SUPER_ADMIN | `?role=`, `?q=` — users with **masked** client contact details for standard ADMIN | Masking is mandatory |
| `/clients/{client_user_id}/reveal-contact` | POST | **SUPER_ADMIN only** | full contact details | Audited reveal |
| `/contact-access-log` | GET | SUPER_ADMIN | reveal history | |
| `/users` | POST | SUPER_ADMIN | created user | Audit |
| `/users/{id}/active` | PATCH | SUPER_ADMIN | `?active=` | Audit; deactivation blocks login |
| `/staff-invites`, `/staff-invites/{user_id}/resend` | POST | SUPER_ADMIN | invitation | Audit; invite link/token |
| `/workflow/settings` | GET | ADMIN/SUPER_ADMIN | statuses/transitions metadata | Drives staff UI labels |
| `/audit-log` | GET | ADMIN/SUPER_ADMIN | filtered audit trail | Append-only |
| `/overview` | GET | SUPER_ADMIN | business overview (cases, revenue, services, staff) | Excludes test data |
| `/payments` | GET | ADMIN/SUPER_ADMIN | all payments/receipts | |

Test-data isolation: `OPERATIONAL_ONLY` is the default on lists/stats/workloads/recommendations; `include_test=true` is an explicit staff opt-in. A test-marked client must never appear in operational output.

---

## 14. FRONTEND COMPATIBILITY CONTRACT

The Node.js backend MUST preserve all of the following so the existing React frontend works unchanged and no approved user journey is altered.

### 14.1 Paths and methods
Every path listed in §1–§13 must exist at the same URL, under the `/api` prefix, with the same HTTP method, the same path/query parameter names (`service_type`, `status`, `case_id`, `mtd_period_id`, `filter=final`, `bucket`, `include_test`, `role`, `q`, `session_id`, `active`, `origin_url`) and the same request body field names. No renaming, versioning, pluralisation change or route consolidation.

### 14.2 Response field names
`id`, `case_ref`, `tax_year`, `service_type`, `status`, `stage`, `stage_label`, `next_action`, `next_action_owner`, `journey`, `external_deadline`, `days_to_deadline`, `deadline_flag`, `waiting_reason`, `has_submission_record`, `submission_reference`, `submission_date`, `assigned_accountant`, `client_visible`, `document_type`, `final_version`, `published`, `version`, `approved_version`, `income`, `expenses`, `net_profit`, `estimated_income_tax`, `estimated_national_insurance`, `suggested_set_aside`, `services`, `package_code`, `price`, `unread`/`count`, `detail` (errors). Same names, same nesting, same types.

### 14.3 Enums/statuses
- SA case statuses: the 18 values in §3, with `STATUS_META` stage/next-action/owner mapping and `CLIENT_STATUS_LABELS` client wording.
- SA journey stages: `Information, Documents, Accountant Review, Your Approval, HMRC Submission`.
- MTD period statuses: `NOT_STARTED, IN_PROGRESS, ADMIN_REVIEW, AWAITING_CLIENT_APPROVAL, APPROVED, SUBMITTED`; kinds `QUARTER`, `FINAL_DECLARATION`; client stage labels exactly as in §12.
- Document statuses: `Requested, Received, Accepted, Rejected`. Service statuses: `ACTIVE`, `NOT_ACTIVE`. Payment request statuses: `UNPAID, PAID, CANCELLED`.
- Roles: `CLIENT, ACCOUNTANT, ADMIN, SUPER_ADMIN`.

### 14.4 Behaviour that must be preserved
1. **SA and MTD remain separate workflows** sharing cases, documents, permissions, audit, notifications and assignments. MTD actions are never merged into SA return actions; SA and MTD counters stay separate.
2. **Role permissions** enforced server-side for `CLIENT / ACCOUNTANT / ADMIN / SUPER_ADMIN`; the frontend guard is cosmetic.
3. **Client-visible vs staff-only** rules: drafts, internal notes, case activity, staff previews, other clients' data and raw status enums are never returned to a CLIENT.
4. **Admin assignment before accountant access**: unassigned accountant = 403 on every case, document, task and MTD period endpoint.
5. **MTD Q1–Q4 + Final Declaration** structure, labels, deadlines and idempotent generation.
6. **Accountant preparation → Admin review/release → client approval → manual submission recording**, in that order, with whitelisted transitions only.
7. **Published-version history and exact-version approval** (`409` on version mismatch); a new publish invalidates the previous client approval.
8. **Submitted/completed locking** for SA cases and MTD periods; reopen only by ADMIN/SUPER_ADMIN with a mandatory reason and only where not submitted.
9. **No HMRC API/OAuth** — none exists and none may be introduced.
10. **No automatic tax calculation engine** — all figures are manually entered and informational.
11. **External filing happens outside TaxSimba** using approved third-party software.
12. **ADMIN/SUPER_ADMIN record the external submission manually** (`reference` + `date`); ACCOUNTANT and CLIENT are blocked with 403.
13. Session/CSRF/rate-limit behaviour of §1, including no token in browser login bodies and refresh-on-401 compatibility.
14. Authenticated blob document download; no raw protected `href`.
15. Test-data exclusion by default on all operational lists, stats and workloads.
16. Document retrieval always scoped (§5) — no unscoped global document listing in Node.js.
17. Reminders dispatched by a backend scheduler/worker; transactional email configured from deployment environment variables alongside in-app notifications.

**Migration rule:** reproduce this contract first and prove parity with `NODE_MIGRATION_CHECKLIST.md`. Only after every box is ticked with evidence may any simplification or redesign be proposed, and only with separate approval.
