# TaxSimba — Node.js Handover Specification (Reference Implementation Lock)

Describes the **current implemented behaviour** of the verified Python/FastAPI + MongoDB + React build.
The Node.js port must reproduce this behaviour exactly before any change is proposed.

## 0. Hard statements (must be preserved verbatim in the port)
- **NO HMRC API / OAuth is used anywhere.** No HMRC calls, tokens, scopes or fraud-prevention headers exist.
- **NO automatic tax calculation engine exists.** Nothing derives tax or NI.
- Accountant-entered estimated Income Tax, estimated National Insurance and suggested set-aside are **informational values typed in by staff**.
- **External tax filing happens outside TaxSimba** using approved third-party software.
- **ADMIN and SUPER_ADMIN record the external submission reference/date/outcome manually.**
- **ACCOUNTANT and CLIENT can never record a submission.**
- Frontend communicates **only** through backend APIs.
- All sensitive permissions and business logic stay **backend-enforced**.
- **Self Assessment (SA) and MTD are separate workflows** sharing platform infrastructure (auth, cases, documents, audit, notifications, payments).
- **Existing frontend behaviour and UX must remain unchanged** during migration.

## 1. Runtime and environment
- Backend FastAPI on `0.0.0.0:8001`; every route is prefixed `/api`. Frontend React on `3000`. Ingress routes `/api/*` to backend.
- Routers: `server.py` (`/api`), `phase1b.py` (`/api`), `mtd.py` (`/api/mtd`).
- Env vars — backend: `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `COOKIE_SECURE`, `COOKIE_SAMESITE`, `CORS_ORIGINS`, `TRUSTED_PROXY_CIDRS`, `STRIPE_API_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_ACCOUNT_ID`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MODE`, object-storage keys used by `storage.py`. Frontend: `REACT_APP_BACKEND_URL`.
- External integrations: MongoDB, managed object storage, Stripe (**test mode**). **No email provider configured** — all notifications are in-app only.

## 2. Roles and permission matrix
Roles: `CLIENT`, `ACCOUNTANT`, `ADMIN`, `SUPER_ADMIN`.

| Capability | CLIENT | ACCOUNTANT | ADMIN | SUPER_ADMIN |
|---|---|---|---|---|
| See own cases only | yes | — | — | — |
| See assigned cases only | — | yes | — | — |
| See all cases | — | — | yes | yes |
| Assign / reassign accountant | no | no | yes | yes |
| SA prepare calculation, submit for admin review | no | yes | yes | yes |
| SA admin approve / return | no | no | yes | yes |
| SA client approve | yes (own) | no | no | no |
| SA / MTD record external submission | **no (403)** | **no (403)** | **yes** | **yes** |
| SA complete / reopen case | no | no | yes | yes |
| MTD save draft figures, submit for review | no | yes (assigned) | yes | yes |
| MTD approve & publish, return for changes, reopen approved period | no | **no (403)** | yes | yes |
| MTD client approve published version | yes (own, exact version) | no | no | no |
| Request quarter document | no | yes (assigned) | yes | yes |
| View staff drafts / version history / internal notes / audit log | **never** | assigned cases | yes | yes |
| Global MTD ops list + stats (`/mtd/periods`, `/mtd/stats`) | 403 | 403 | yes | yes |
| Accountant MTD workload (`/mtd/my-workload`) | 403 | yes (own) | 403 | 403 |
| Users list, staff invites | 403 | 403 | yes | yes (create/deactivate) |
| Audit log (`/audit-log`) | 403 | 403 | yes | yes |
| Reveal client contact details | — | never | masked | yes (audited) |
| Payment request (additional work) | no | recommend only | yes | yes |
| Service issue create | yes | existence only, cannot alter | manage | manage |

## 3. Self Assessment workflow (unchanged, do not redesign)
States: `AWAITING_ASSIGNMENT → ASSIGNED → IN_PROGRESS → AWAITING_CLIENT → ACCOUNTANT_REVIEW → ADMIN_REVIEW → CLIENT_APPROVAL → READY_FOR_SUBMISSION → SUBMITTED → COMPLETED`, plus `SUBMISSION_ISSUE`.
Each state maps to `current_stage`, `next_action`, `next_action_owner` via a status-meta table.

Transitions and guards:
- `POST /cases/{id}/assign` (ADMIN/SUPER_ADMIN) → ASSIGNED, writes an `assignments` row and audit entry.
- `POST /cases/{id}/request-from-client` (staff) → AWAITING_CLIENT with `waiting_reason`; creates document requests/tasks.
- `POST /cases/{id}/calculations` (accountant) creates a new `calculation_versions` row (never overwrites).
- `POST /cases/{id}/submit-for-admin-review` (accountant) → ADMIN_REVIEW.
- `POST /cases/{id}/admin-approve` (ADMIN/SUPER_ADMIN) → CLIENT_APPROVAL, sets `approved_version_id`.
- `POST /cases/{id}/admin-return` (ADMIN/SUPER_ADMIN) → back to accountant, **reason mandatory**.
- `POST /cases/{id}/client-approve` (CLIENT, own) → READY_FOR_SUBMISSION.
- `POST /cases/{id}/record-submission` (ADMIN/SUPER_ADMIN) → SUBMITTED; writes a `submission_records` row (status `SUBMITTED`); **400 if the case is COMPLETED** (completed cases are locked).
- `POST /cases/{id}/complete` (ADMIN/SUPER_ADMIN) → COMPLETED; the submission record becomes status `COMPLETED`.
- `POST /cases/{id}/reopen` (ADMIN/SUPER_ADMIN) — reason recorded; history preserved. `GET /cases/{id}/reopen-history` derives reopen events from `activity_logs` where `previous_status == COMPLETED` (no second source of truth).
- `has_submission_record` on `GET /cases/{id}` matches submission record status **in `["SUBMITTED","COMPLETED"]`** (a completed case must show its submission as done).
- Completed cases also reject new `ADDITIONAL_WORK` payment requests (400).
- Client journey steps are computed server-side (`journey` array) — clients never read `activity_logs`.

## 4. MTD workflow (Q1–Q4 + Final Declaration)
Schedule generated automatically on activation, idempotent, from the case `tax_year` (start year Y):
Q1 6 Apr Y – 5 Jul Y due 7 Aug; Q2 6 Jul – 5 Oct due 7 Nov; Q3 6 Oct – 5 Jan Y+1 due 7 Feb; Q4 6 Jan – 5 Apr due 7 May; Final Declaration 6 Apr Y – 5 Apr Y+1 due 31 Jan Y+2. Deadline rule = 7th of the month after the period-end month.

Period states (separate machine from the SA case machine):
`NOT_STARTED → IN_PROGRESS → ADMIN_REVIEW → AWAITING_CLIENT_APPROVAL → APPROVED → SUBMITTED`.
Owners: NOT_STARTED/IN_PROGRESS = ACCOUNTANT, ADMIN_REVIEW = ADMIN, AWAITING_CLIENT_APPROVAL = CLIENT, APPROVED = ADMIN, SUBMITTED = NONE.
Client-facing labels: Preparing / Under review / Awaiting your approval / Approved — ready to submit / Submitted. Staff labels differ (Not started / Accountant preparing / Awaiting admin review / Waiting for client approval / Ready for external submission / Submitted).

Guards:
- `figures` (accountant/admin) rejected with 400 when state is ADMIN_REVIEW, AWAITING_CLIENT_APPROVAL, APPROVED or SUBMITTED; negative income/expenses 400. Saving clears any open `changes_reason`.
- `submit-for-review` requires IN_PROGRESS **and** an existing draft.
- `admin-approve` requires ADMIN_REVIEW and a draft; ADMIN/SUPER_ADMIN only; **publishing is not submission**.
- `request-changes` allowed from ADMIN_REVIEW or AWAITING_CLIENT_APPROVAL; **reason mandatory** (blank → 400); returns to IN_PROGRESS with ownership to the accountant.
- `client-approve` requires AWAITING_CLIENT_APPROVAL; body `{version}` must equal `published_version` else **409**.
- `reopen` requires `APPROVED`; **400 if SUBMITTED** ("already been submitted externally and is locked"); reason mandatory.
- `record-submission` requires `APPROVED` (400 otherwise), **400 if already SUBMITTED** (duplicate protection), reference and date mandatory, ADMIN/SUPER_ADMIN only. Identical for all quarters and the Final Declaration (no kind-specific branch).
- Final Declaration additionally gates the MTD final client document: `POST /cases/{id}/final-documents` on an MTD case requires the Final Declaration to be `SUBMITTED`.

## 5. Activation, assignment, reassignment
- Activation path: confirmed Stripe payment → `_fulfil(tx)`; `kind = "SERVICE_ACTIVATION"` with `new_package` upserts `client_services` to ACTIVE, then creates a case `MTD-{2000+seq}` (unique `case_ref`, retried on collision) in `AWAITING_ASSIGNMENT`, `is_test` inherited from the client, then generates the 5 MTD periods. `kind = "UPGRADE"` mutates the package and pushes `package_history`. `_fulfil` is **idempotent** (`fulfilled` / `duplicate` flags), so replayed webhooks never double-activate or double-receipt.
- `POST /cases/{id}/assign` sets accountant, writes `assignments`, notifies. Reassignment **changes ownership only**: period statuses, drafts, published versions, client approvals, submission references, documents, requests, deadlines and audit history are all untouched (verified byte-identical).
- `POST /cases/{id}/unassign` exists for staff.

## 6. Documents and requests
- Uploads via `POST /documents/upload` (multipart): `case_id`, `document_type`, optional `document_id` (fulfils a request → status `Uploaded`), optional `task_id`, optional `mtd_period_id`, `is_internal` (staff only). MIME/size/content validated; bytes stored in object storage, metadata in `documents`.
- Access: clients see only their own case documents with `is_internal = false`; downloads are authenticated and authorised (other client → 403, client internal → 403). No raw href links.
- Quarter requests: `POST /mtd/periods/{id}/requests` creates a `document_requests` row plus a placeholder `documents` row with `status = "Requested"`, `mtd_period_id`, `mtd_period_label`, note, due date and requester. Case status is deliberately **not** transitioned.
- Final client documents: `POST /cases/{id}/final-documents` (ADMIN/SUPER_ADMIN) inserts a new immutable `final_version` each time (`is_final = true`, `is_internal = false`, `status = "Final"`, `published_at`, `case_ref`, `tax_year`). Previous final documents are never overwritten, and completing or reopening a case never hides them. `GET /documents?filter=final` keys off `is_final`.

## 7. Financial versioning and visibility
- Draft (`draft`) is **staff-only**: income, expenses, net_profit (income − expenses unless explicitly overridden), estimated_income_tax, estimated_national_insurance, suggested_set_aside, client_note, prepared_by_name. Plus `draft_saved_by`, `draft_saved_at`.
- Publishing appends an immutable snapshot to `published_versions` (`version`, all figures, `published_by_name`, `published_at`) and sets `published` to the latest; it also clears `approved_version`, `approved_snapshot` and `client_approved_at` so a new version needs **fresh approval**.
- Reopen stamps the superseded version with `superseded_at`, `superseded_reason`, `superseded_by_name` and the original `client_approved_at`, and appends an `approval_history` entry (version, approved_at, snapshot, reopened_at/by/role, reason).
- **Client-visible period fields:** id, case/quarter identity, label, period_start, period_end, deadline, status, stage_label, next_action, next_action_owner, deadline_warning, days_to_deadline, `published` (latest snapshot only), `approved_version`, submission_reference, submission_date, disclaimer.
- **Stripped for clients:** `draft`, `draft_saved_by`, `draft_saved_at`, `changes_reason`, `published_versions`, `approval_history`, `reopened_by_name`, `reopened_at`, `is_test`. Internal notes, working papers and `activity_logs` are never client-readable.
- Fixed disclaimer text shown with published figures: "These figures have been prepared by your accountant using the information currently available. Your final tax position may change as further information is added and at the end of the tax year."
- `GET /mtd/cases/{id}/year-summary` totals **published quarters only** (drafts excluded), returns per-quarter dates/status/figures plus year-to-date income, expenses and net profit and the "accountant-prepared information, not your final tax liability" note. No tax/NI totals.

## 8. Auth, session, MFA
- App-managed JWT: short-lived access token, refresh rotation and revocation (`refresh_tokens`), CSRF cookie, tokens hidden from the browser where applicable, login rate limiting (`login_attempts`), password change revokes sessions.
- Staff TOTP MFA (`pyotp`): `/auth/2fa/status|enrol|activate|disable`, `/auth/login/2fa`, recovery codes, secrets encrypted. Forced for ADMIN/SUPER_ADMIN; clients unaffected.
- Staff onboarding: `POST /staff-invites` creates a PENDING user with no password hash and a hashed one-time token with expiry; `GET/POST /auth/invite/{token}` completes setup and only then activates the user. Resend and revoke supported.
- Cluster-wide MongoDB-backed API rate limiting (`api_rate_buckets`) returning 429 (must be a response, never an exception inside middleware). Security headers applied globally.

## 9. Audit, notifications, deadlines, dashboards
- `activity_logs`: `case_id`, `action`, `user_id`, `user_name`, `role`, `previous_status`, `new_status`, `comments`, `meta`, `created_at`. Every material action writes one: assignment, reassignment, calculation, review, approval, return (with reason), submission recording, completion, reopen, document upload/request, final document publish, MTD draft save / publish / return / client approval / reopen / submission, service issue create and status change. MTD entries carry `meta.mtd_period_id` and `meta.service = "MTD"`.
- `notifications`: user-targeted, typed (REVIEW, CHANGES, SUBMISSION, UPLOAD, UPGRADE, INFO), with case link and route; duplicate unread notifications collapse (no spam). **In-app only — no email.**
- Deadline warnings derived from period deadlines: `OVERDUE`, `DUE_3`, `DUE_7`, `DUE_14`, plus `days_to_deadline`; suppressed once SUBMITTED. Clients get one idempotent in-app reminder when an approval is genuinely outstanding within 14 days. No scheduled jobs.
- Dashboards: `/stats/admin`, `/stats/accountant`, `/accountants/workload`, `/overview`, `/my-actions` (SA side); `/mtd/stats`, `/mtd/periods?bucket=…`, `/mtd/my-workload` (MTD side). MTD buckets: `not_started`, `preparing`, `admin_review`, `client_action`, `ready_submission`, `submitted`, `waiting_for_client` (outstanding Requested quarter documents), `due_14`, `overdue`, `final_declaration`. SA and MTD counters are never mixed.

## 10. Payments, packages, services, recommendations
- `packages` (per service_type, price, code), `client_services` (status ACTIVE/NOT_ACTIVE, package_code, tax_year, package_history), `payment_transactions` (session_id, kind NEW_SERVICE/SERVICE_ACTIVATION/UPGRADE/ADDITIONAL_WORK, payment_status, fulfilled/duplicate), `invoices` (immutable receipts), `offers`, `recommendations`, `pricing_audit`, `override_audit`.
- Checkout endpoints create Stripe sessions; `/payments/status/{session_id}` and `/stripe/webhook` both funnel into the idempotent `_fulfil`. One confirmed payment ⇒ exactly one receipt and one audit entry.
- Accountants may only **recommend** (`recommend-additional-work`, `recommend-package`, `recommend-mtd`); ADMIN/SUPER_ADMIN approve, reject, send offers and raise `payment-requests`. Additional-work charges are rejected on COMPLETED cases (400).
- Admin recommendation listing filters test data by default (`include_test=true` reveals it).

## 11. Data model highlights
Key collections: `users`, `clients`, `accountant_profiles`, `cases`, `assignments`, `calculation_versions`, `client_approvals`, `reviews`, `submission_records`, `mtd_periods`, `tasks`, `documents`, `document_requests`, `internal_notes`, `messages`, `activity_logs`, `notifications`, `notification_preferences`, `packages`, `client_services`, `payment_transactions`, `invoices`, `offers`, `recommendations`, `service_issues`, `staff_invites`, `refresh_tokens`, `login_attempts`, `api_rate_buckets`, `data_requests`, `faqs`, `settings`, `counters`, `contact_access_audit`, `pricing_audit`, `override_audit`.
Relationships: `users(id) ← clients.user_id`; `clients(id) ← cases.client_id`, `cases.client_user_id → users.id`; `cases(id) ← mtd_periods.case_id`, `documents.case_id`, `document_requests.case_id`, `tasks.case_id`, `activity_logs.case_id`, `service_issues.case_id`; `documents.mtd_period_id → mtd_periods.id`; `documents.request_id → document_requests.id`.
Uniqueness/identity: application-generated UUID `id` on every document (never expose Mongo `_id`); `case_ref` unique (collision-retry on generation); one `mtd_periods` row per `(case_id, kind, quarter)`; `payment_transactions.session_id` unique in effect via idempotent fulfilment; one `client_services` row per `(client_id, service_type)`.
Indexes are created at startup over the hot query fields of each collection (e.g. `cases`: client_id, client_user_id, assigned_accountant_id, status, service_type; `documents`: case_id, client_user_id, is_internal, is_deleted; `document_requests`: case_id, status; `activity_logs`: case_id, created_at; `notifications`: user_id, is_read).
**Never return raw Mongo documents** — strip `_id`, coerce ObjectId → string, and use `datetime.now(timezone.utc)`/ISO strings.

## 12. Test-data isolation
- `is_test` on users, clients, cases, mtd_periods, service_issues, recommendations, payment transactions. Child records inherit it at creation.
- An `OPERATIONAL_ONLY` filter (`is_test != true`) is applied by default to admin/super-admin list and stat endpoints (cases, recommendations, service issues, `/mtd/periods`, `/mtd/stats`, `/mtd/my-workload`, audit views); `include_test=true` opts in. Test emails are recognised by a regex helper.
- Known gap to reproduce or improve deliberately: the **unscoped** `GET /documents` list is not used by any screen (every caller passes `case_id` or `mtd_period_id`) and legacy test-case child documents were never stamped `is_test`.

## 13. API surface
All routes are `/api/...` (MTD routes `/api/mtd/...`). Common errors: **400** guard/state/validation, **401** unauthenticated, **403** role or ownership, **404** unknown id, **409** version conflict, **429** rate limited.

### Auth
| Method | Route | Roles | Notes |
|---|---|---|---|
| POST | /auth/register | public | client self-registration |
| POST | /auth/login | public | returns access token; staff with MFA get a challenge |
| POST | /auth/login/2fa | public | TOTP or recovery code |
| GET/POST | /auth/2fa/status, /enrol, /activate, /disable | staff | MFA lifecycle |
| POST | /auth/refresh, /auth/logout | authenticated | rotation / revocation |
| GET | /auth/me | authenticated | current identity |
| GET/POST | /auth/invite/{token}, /auth/invite/{token}/accept | public (token) | staff onboarding |

### Cases and SA workflow
`GET /cases` (role-scoped; `service_type`, `status`, `include_test`), `POST /cases` (staff), `GET /cases/{id}` (owner/assigned/staff; adds `journey`, `has_submission_record`), `POST /cases/{id}/assign|unassign` (ADMIN/SUPER_ADMIN), `POST /cases/{id}/start-review|mark-reviewed|request-from-client|calculations|submit-for-admin-review` (accountant/staff), `GET /cases/{id}/calculations`, `POST /cases/{id}/admin-approve|admin-return|complete|reopen|record-submission` (ADMIN/SUPER_ADMIN), `POST /cases/{id}/client-approve` (CLIENT own), `GET /cases/{id}/submission|assignments|reviews|notes|reopen-history` (staff; `notes` and `activity` staff-only), `POST /cases/{id}/notes` (staff), `GET /cases/{id}/activity` (**ACCOUNTANT/ADMIN/SUPER_ADMIN only**).

### Documents, tasks, messages, notifications, profile
`GET /documents` (filters `case_id`, `filter=requested|uploaded|final`, `service_type`, `mtd_period_id`), `POST /documents/upload`, `PATCH /documents/{id}/status` (staff), `GET /documents/{id}/download` (authorised), `POST|GET /cases/{id}/final-documents` (publish ADMIN/SUPER_ADMIN; read owner/staff), `GET /tasks`, `POST /tasks/{id}/complete`, `GET|POST /messages`, `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`, `GET /notifications/unread-count`, `GET|PATCH /my-profile`, `GET /my-profile/utr`, `POST /my-profile/email-change`, `POST /my-profile/change-password`, `PATCH /my-preferences`, `POST|GET /my-data-requests`.

### Staff, admin, oversight
`GET /stats/admin`, `GET /stats/accountant`, `GET /accountants/workload`, `GET /users` (ADMIN/SUPER_ADMIN), `POST /users`, `PATCH /users/{id}/active`, `POST /staff-invites`, `POST /staff-invites/{user_id}/resend`, `POST /clients/{client_user_id}/reveal-contact` (SUPER_ADMIN, audited), `GET /contact-access-log`, `GET /audit-log` (staff), `GET /overview`, `GET /my-actions`, `GET /services`, `GET /workflow/settings`, `GET|POST|PATCH|DELETE /faqs*`, `POST|GET|PATCH /service-issues*` (create CLIENT; manage ADMIN/SUPER_ADMIN; accountant sees existence only).

### Payments, packages, recommendations (phase1b)
`GET|POST /packages`, `PATCH /packages/{id}/price`, `GET|PATCH /settings/package-lock`, `GET /my-services`, `GET /clients/{id}/services`, `GET /my-upgrade-options`, `POST /payments/upgrade-checkout`, `POST /payments/offer-checkout`, `GET /payments/status/{session_id}`, `POST /stripe/webhook`, `GET /my-payments`, `POST|GET /payment-requests`, `POST /payment-requests/{id}/cancel|resend|checkout`, `GET /payment-requests/{id}/receipt`, `GET /payments`, `POST /cases/{id}/recommend-additional-work|recommend-package|recommend-mtd`, `GET /cases/{id}/recommendations`, `GET /recommendations` (operational-only by default), `POST /recommendations/{id}/approve|reject|send-offer|decline`, `GET /my-offers`, `GET /my-offers/{id}`, `POST /clients/{id}/override-package`.

### MTD (`/api/mtd`)
| Method | Route | Roles | Key request | Key response | Guards / errors |
|---|---|---|---|---|---|
| GET | /cases/{case_id}/periods | client(own)/assigned accountant/admin/super | — | 5 decorated periods | 400 non-MTD case, 403 other client / unassigned accountant |
| GET | /periods | ADMIN/SUPER_ADMIN | `bucket`, `include_test` | rows + accountant name | 403 others |
| GET | /stats | ADMIN/SUPER_ADMIN | — | operational counts incl. `final_declarations` | 403 others |
| GET | /periods/{id}/documents | case-scoped roles | — | docs (client: non-internal only) | 403 |
| POST | /periods/{id}/requests | assigned accountant/admin/super | document_type, note, due_date | placeholder document | 400 blank type, 403 |
| GET | /my-workload | ACCOUNTANT | — | counts + buckets (no drafts) | 403 others |
| GET | /cases/{id}/year-summary | case-scoped roles | — | published-only quarters + YTD totals | 403 other client |
| POST | /cases/{id}/generate-periods | ADMIN/SUPER_ADMIN | — | `{created}` | idempotent |
| POST | /periods/{id}/figures | accountant/admin/super | income, expenses, optional net/tax/NI/set-aside/note | draft echoed | 400 locked state or negative, 403 unassigned |
| GET | /periods/{id}/preview | staff | — | client-shaped preview of draft | 400 no draft, 403 client |
| POST | /periods/{id}/submit-for-review | accountant/admin/super | — | ADMIN_REVIEW | 400 no draft / wrong state |
| POST | /periods/{id}/admin-approve | ADMIN/SUPER_ADMIN | — | new published version | 400 wrong state / no draft, 403 accountant |
| POST | /periods/{id}/request-changes | ADMIN/SUPER_ADMIN | reason | IN_PROGRESS + reason | 400 blank reason / wrong state |
| POST | /periods/{id}/client-approve | CLIENT (own) | version | APPROVED + approved_version | 400 wrong state, **409 version mismatch**, 403 other client |
| POST | /periods/{id}/reopen | ADMIN/SUPER_ADMIN | reason | IN_PROGRESS, approval cleared, history stamped | 400 blank reason / not APPROVED / **SUBMITTED locked**, 403 |
| POST | /periods/{id}/record-submission | **ADMIN/SUPER_ADMIN only** | submission_reference, submission_date, provider?, outcome?, note? | SUBMITTED | 400 not APPROVED / already SUBMITTED / missing fields, **403 accountant and client** |

## 14. Frontend ↔ backend boundary
- `components/AppShell.jsx` — `/auth/me`, `/notifications`, `/notifications/unread-count`; role-based nav.
- `components/StatCard.jsx` — presentation only.
- `pages/client/ClientDashboard.jsx` — `/cases`, `/my-actions`, case `journey`.
- `pages/client/ClientPages.jsx` — `/cases`, `/documents` (incl. `filter=final`), `/tasks`, `/messages`, `/my-profile`, `/my-payments`, `/my-services`.
- `pages/client/ClientActions.jsx` — `/my-actions`, `/my-offers`, recommendation decline/checkout.
- `pages/client/MtdQuarters.jsx` — `/cases?service_type=MTD_INCOME_TAX`, `/mtd/cases/{id}/periods`, `/mtd/cases/{id}/year-summary`, `/cases/{id}/final-documents`, `/documents?mtd_period_id=`, `/documents/upload`, `/mtd/periods/{id}/client-approve`.
- `pages/ServiceIssues.jsx` — `/service-issues` (client create/list; admin list/patch), `/cases`.
- `pages/staff/AccountantDashboard.jsx` — `/stats/accountant`, `/cases`, `/tasks`.
- `pages/staff/AccountantMtd.jsx` — `/mtd/my-workload`.
- `pages/staff/AdminPages.jsx` — `/stats/admin`, `/cases` (SA/MTD filter), `/accountants/workload`, `/audit-log`, `/users`, `/recommendations`, `/payments`.
- `pages/staff/AdminMtd.jsx` — `/mtd/stats`, `/mtd/periods?bucket=…`.
- `pages/staff/CaseWorkspace.jsx` — `/cases/{id}`, `/tasks`, `/documents`, `/messages`, `/cases/{id}/notes|activity|reviews|calculations|assignments|reopen-history|final-documents`, `/payment-requests`, `/service-issues?case_id=`, all SA transition endpoints, and all MTD period endpoints (`figures`, `preview`, `submit-for-review`, `admin-approve`, `request-changes`, `reopen`, `record-submission`, `requests`).
- `pages/staff/StaffSecurity.jsx` + `components/TwoFactorPanel.jsx` — `/auth/2fa/*`.
- `pages/AcceptInvite.jsx` — `/auth/invite/{token}*`.
- `lib/api.js` — axios instance on `REACT_APP_BACKEND_URL`, refresh-on-401, `openDocument()` authenticated blob download (never a raw href).

## 15. Locked migration decisions (ambiguities resolved)
These four points are decided and must be implemented as stated in the Node.js version.

**15.1 Document retrieval — no unscoped global listing.**
The legacy/unsafe unscoped `GET /documents` behaviour must NOT be carried over. Every document read in Node.js must be permission-scoped to a specific case, client, MTD period, or an explicitly authorised operational scope, and must be authorisation-checked per request. Cross-client access denied; staff-only/internal documents never returned to clients; client-visible only when explicitly marked. Test/QA documents must never appear in genuine operational queries (operational-only by default, explicit opt-in only for staff test views).

**15.2 Submitted MTD periods stay locked.**
Preserve current parity: an externally submitted/completed MTD quarter or Final Declaration is locked — no reopen, no figure edits, no re-approval. Do NOT build a submitted-amendment workflow during migration. Amendment of submitted periods is a future post-migration (Phase 2) feature only, requiring separate approval.

**15.3 Deadline reminders — backend scheduler.**
Node.js production reminders must be dispatched by a backend scheduler/background worker. They must not depend on a client (or staff member) opening the portal or on any browser/session event. Existing deadline rules, thresholds and dates are unchanged — this is an execution-architecture requirement only.

**15.4 Transactional email capability.**
Node.js production must support provider-configured transactional email in addition to in-app notifications, covering: staff/client invitations, document requests, approvals, deadline reminders, payment/service notices, and completion notices. Provider credentials and configuration must come from deployment environment variables only and must never be hard-coded or committed. No provider is chosen or integrated at this documentation stage.

## 16. Migration rule
Reproduce this behaviour first. Do not simplify, reinterpret, merge, rename or redesign workflow states, transitions, permissions, guards, data relationships, API behaviour or client/staff visibility rules until full behavioural parity is proven and a change is separately approved.
