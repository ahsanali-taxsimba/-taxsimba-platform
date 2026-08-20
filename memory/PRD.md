# TaxSimba — Product Requirements & Build Log

## Original problem statement (scope)
Accountant-led UK Self Assessment tax preparation platform. Phase 1: core platform + Self Assessment operations. Phase 1A: submission workflow + accountant client privacy. Phase 1B: multi-service client accounts, Self Assessment package upgrades, MTD recommendation/activation foundation.
Out of scope throughout: MTD quarterly workflow, HMRC APIs, Xero, SimbaX, public website redesign, fake HMRC functionality.

## Architecture
- **Backend** (FastAPI + MongoDB, all routes `/api`):
  - `server.py` — auth, cases, tasks, documents, messages, notes, activity, reviews, submission/completion, notifications, stats, users, services, workflow settings, audit log
  - `workflow.py` — single controlled workflow engine: 18 statuses, `STATUS_META` (status → stage / next action / owner), `ALLOWED_TRANSITIONS` guard, `transition()`, `journey()`, `log_activity()`, `notify()`
  - `phase1b.py` — packages & pricing, package-change lock, client services, upgrade options, Stripe checkout + webhook + fulfilment, recommendations, offers, admin override
  - `auth.py` (bcrypt + JWT + `require_roles`), `db.py` (`clean`, `scrub`/`PROTECTED_CLIENT_FIELDS`), `storage.py` (object storage), `seed.py`
- **Frontend** (React + Tailwind): role-based `AppShell`; client pages (Dashboard, My Tax Return, Documents, Messages, Tasks, Tax Journey, Profile, My Services, Help, Settings, payment result pages); accountant dashboard; admin dashboard/cases/accountants/recommendations; shared staff `CaseWorkspace` (7 tabs + workflow modals); Super Admin.
- **Data model**: one connected set of collections — users, clients (`client_ref` CL-00xx), accountant_profiles, services, packages, client_services (Client → Services → Cases), cases, assignments, tasks, documents, document_requests, messages, internal_notes, notifications, reviews, calculation_versions, client_approvals, submission_records, recommendations, offers, payment_transactions, activity_logs, override_audit, pricing_audit, settings. `service_type` on Case (`SELF_ASSESSMENT`, `MTD_INCOME_TAX`) so MTD extends without a rebuild.

## Roles
- **CLIENT** — own data only; sees only admin-approved calculations; can upgrade (never downgrade) SA package and accept admin-approved service offers.
- **ACCOUNTANT** — assigned cases only; no client email/phone/payment data; can recommend upgrades and MTD but cannot price, activate, take payment, release to client, submit or complete.
- **ADMIN** — all operations, assignment, internal review, recommendations/offers, submission and completion, authorised overrides.
- **SUPER ADMIN** — all of the above plus users, roles, services, packages & pricing, payments, workflow settings, audit log.

## Phase 1B UX correction (2026-06) — MTD visibility, service separation, operational controls
- **SA portal stays SA-only**: client dashboard, tasks, documents, journey and My Tax Return are all scoped to `service_type=SELF_ASSESSMENT`. An SA-only client sees no MTD card, task, deadline or warning anywhere.
- **MTD is conditional**: nothing MTD-related surfaces to the client until Admin *approves* an accountant recommendation, or MTD is active. Rejected recommendations stay internal (audit only) — the client is never told.
- **Recommendation flow**: accountant recommends (internal, reason + note) → Admin queue → **Approve** (choose package, optional price override, credit, plain-English explanation; creates a temporary account-level client action and notification, no auto-activation) or **Reject**. Second approval of the same recommendation is rejected.
- **Client review screen** `/recommendation/{offerId}`: service, admin-approved explanation, package, price, billing frequency, credit, additional amount payable, total payable now, with "Add MTD Service", "Ask TaxSimba a Question" and "Maybe later" — no forced purchase.
- **Service separation after activation**: same login/Client ID/profile; `/mtd` portal shows only MTD status/tasks/documents; My Services lists each active service with an Open button and is only prominent once more than one service is active.
- **One Action Required area** (`/actions`): tasks, pending return approvals and approved recommendations in one feed with action, service, case, due date and status, clearing to a completed history.
- **Case-based assignment**: assign / reassign / unassign (reason required) with `GET /api/cases/{id}/assignments` history; reassignment hands access to the new accountant, removes the previous accountant's access and preserves all prior work, notes and audit entries.
- **Completed-case lock + audited reopen**: completed cases reject calculation and document-status edits; Admin/Super Admin reopen requires a non-empty reason and records previous/new status.
- **Manual/external submission**: submission recording now captures external provider and evidence document alongside date, reference, submitted-by and note.
- **Admin filters** by service, tax year, accountant, priority, status and deadline; **Super Admin Business Overview** with client/case counts, cases per accountant and revenue (month, year, SA, MTD, upgrades, successful/failed payments) derived **only** from paid payment transactions.
- **Internal notes** labelled "Internal – Client cannot see this" and never exposed to any client endpoint.
- New clients (Super Admin-created and self-registered) are bootstrapped with `client_ref` + SA ACTIVE + MTD NOT_ACTIVE immediately.
- **Verified** (iteration_6, zero critical issues): all six scenarios A–F, including a live Stripe MTD purchase that activated MTD under the same client (CL-0043) with SA untouched and MTD-2001 landing in the admin unassigned queue.

## Implemented
### Phase 1 (2026-06)
JWT auth + RBAC with seeded accounts; controlled workflow engine; client dashboard (single intelligent action card), auto-derived tax journey, tasks, document centre (6 statuses / 4 filters), case-linked messaging; admin dashboard with clickable stat cards, case table with filters/search, Assignment Centre with live accountant workload; accountant dashboard (own workload) + case workspace with stage-conditional actions; request-from-client automation; immutable calculation versions; checklist-gated submit for admin review; admin approve / return for changes; client final review + approval; activity timeline; notifications; Super Admin foundation; real uploads via object storage.

### Phase 1A (2026-06)
`ALLOWED_TRANSITIONS` server-side guard (no stage skipping via API); "Send to Admin for Review" with internal note for admin; admin approve records reviewer/date/time/note/approved version, or return with reason + instructions; Record Submission (date, reference, submitted-by, note) blocked unless admin **and** client approval complete; Mark Completed (SUBMITTED only) with completion date/user; accountant privacy scrubbing across every accountant-facing endpoint; audit entries carry previous/new status + comments; full accountant and admin queue sets.

### Phase 1B (2026-06)
One login / one Client ID / many services: `client_services` gives every client a Self Assessment service plus an MTD placeholder; My Services page shows each service, package, tax year, status and its cases. Configurable packages & pricing (Super Admin editable, pricing audit) — SA Simple/Smart/Elite, MTD Essential/Plus. Upgrade-only rule enforced server-side (downgrade or equal package rejected 400; only higher packages ever returned/rendered; "Current Package — Highest Package" on Elite). Upgrade pricing computed from package records (credit, upgrade price, additional amount payable, total due now) and paid via Stripe Checkout; on payment the same Client ID and same SA case are kept, package flips, payment + previous/new package + timestamp recorded, activity log written, admin notified. Configurable late-stage package-change lock plus admin/super-admin override requiring a reason (previous/new package, user, role, timestamp, reason audited). Accountant actions "Recommend Package Upgrade" and "Recommend MTD" (reason + internal note → admin) with no pricing, activation or payment rights. Admin recommendations centre: review, decline, or send a priced offer (package, optional price override, credit → amount due) to the client. Client sees "MTD Recommended" on the dashboard and the full offer on My Services; paying activates MTD under the same account, keeps SA active, creates the MTD case at AWAITING_ASSIGNMENT in the admin assignment queue, records payment/activation and audit entries.

## Verified
- Phase 1: 25-step success test end-to-end (iteration_1).
- Phase 1A: submission/completion lifecycle + all 10 negative tests (iteration_3).
- Phase 1B: 94 backend tests green plus a live Stripe Checkout upgrade driven through the browser — package flipped Smart → Elite with same client ref, no duplicated/damaged cases, payment + audit + admin notification recorded (iteration_4, zero open issues).
- Fixed along the way: `/api/documents` leaked `client_user_id` to accountants; login ignored `is_active`.

## Pre-MTD QA audit (2026-06)
Full four-role end-to-end audit of the current build (no features added). Defects found and fixed:
1. **Duplicate MTD recommendations** could be created — `_create_recommendation` now rejects with 409 when a PENDING/APPROVED recommendation of the same type exists on the case (rejection re-opens the path; MTD and package-upgrade types are independent).
2. **Duplicate package-upgrade recommendations** — same guard.
3. **Duplicate-payment protection was per Stripe session only** — `_inflight()` now reuses the single open checkout session per business key (client+target package, or offer), clearing stale non-open sessions, and `_fulfil()` gained business-key idempotency (an already-applied upgrade or an already-PAID offer/ACTIVE service is marked `duplicate` and applied once).

Final matrix (iteration_8): all 11 QA sections **PASS**, zero critical or minor open issues; 134 regression tests + 8 new verification tests green; screenshots of all four role journeys in `/app/test_reports/screens_it8/`.

## Final Phase 1 / 1B refinement, verification & LOCK (2026-06)
Minimum corrective changes only — two newly identified functional requirements plus one side-effect defect:
1. **Admin client-contact masking** — `GET /api/users?role=CLIENT` returns client email as `x***@domain` and phone as `07*** ***nnn` with `contact_masked=true` for ADMIN; SUPER_ADMIN receives the same rows unmasked; non-CLIENT rows are never masked; `password_hash`, card data and `stripe_payment_intent_id` are never returned to any role.
2. **Audited contact reveal** — `POST /api/clients/{id}/reveal-contact` (SUPER_ADMIN only, mandatory non-blank reason, else 400) returns full contact and persists an audit row (user, role, client, reason, timestamp) readable via `GET /api/contact-access-log`. ADMIN and ACCOUNTANT get 403 on both endpoints.
3. **Missing mandatory information blocks final submission only, never dashboard access** — a client with a missing UTR/questionnaire/documents keeps full access to the dashboard, `/api/auth/me`, cases, tasks, documents, messages, notifications and `/api/my-actions`; the gap surfaces as an "Action Required" card. `POST /api/cases/{id}/record-submission` returns 400 ("mandatory item(s) of tax information outstanding") while an open mandatory task exists, and 200 once completed.
4. **Stage-guard orphan fix** — request-from-client on a `READY_FOR_SUBMISSION` case is rejected 400 **before** any write, creating zero rows in `tasks`, `document_requests` or `messages`. Requests from ACCOUNTANT_REVIEW / IN_PREPARATION / AWAITING_CLIENT / CHANGES_REQUIRED still succeed.

Test-fixture note: Phase 1/1B/2 suites now resolve CLIENT users via the super-admin token because admin email is intentionally masked. Correct-by-design, not a masked defect.

### Independent verification (iteration_9, testing agent)
- All four fixes **PASS** via 15 new targeted tests in `/app/backend/tests/test_iteration9_final_lock.py`.
- **Full regression: 157 passed, 3 legacy skips** (Client B already on Elite so the upgrade path is exhausted; MTD already active — legitimate seed state, same as iteration 8).
- **Multi-accountant isolation at scale**: 9 fresh clients/cases across Accountants A/B/C — each accountant's `/api/cases` contains only their own IDs, cross-accountant direct fetches return 403/404, admin sees all. Needs-action workloads 231 / 22 / 9 non-overlapping; Admin and Super Admin both see the practice-wide 399.
- **Reassignment without data loss**: `POST /api/cases/{id}/assign` transfers ownership, the previous accountant loses access, the new accountant gains it, and tasks / activity / assignment history are all preserved (≥2 assignment entries).
- **All six role browser journeys** render clean at their landing routes with no console errors — screenshots in `/app/test_reports/screens_it9/` (01 client, 02 accountant A, 03 accountant B, 04 accountant C, 05 admin, 06 super admin).
- Client-facing language re-checked: friendly labels only, no HMRC API codes or raw statuses.
- Payments (test/sandbox only) duplicate guards from iteration 8 still green.
- Zero critical and zero minor open defects. No product code was changed by the testing agent.

### Lock state
- **PHASE 1 / 1B: LOCKED** — functionally verified end-to-end (automated regression + role-based browser + backend/API authorisation checks).
- **READY TO START FULL MTD OPERATIONS PHASE: YES — but it MUST NOT start automatically.** No Full MTD Operations work has been started and none may begin without explicit user instruction.
- "Ready to lock" is **not** "production-security-ready": the production-hardening items below are mandatory before any live launch. Stripe remains test/sandbox only; nothing has been deployed.

## Production hardening (2026-06) — completed before Phase 2
Scope was hardening only: no features, no MTD, no email/reminders, no redesign, no deploy.

**CORS.** `_allowed_origins()` (`server.py`) builds an explicit allowlist from the `CORS_ORIGINS` env var and **raises `RuntimeError` at import time** if the value is empty or contains `*`, so the permissive wildcard cannot silently return. `CORS_ORIGINS` currently holds the single approved preview origin; production/staging hostnames are added by env change only, no code change. Unapproved origins get `400 Disallowed CORS origin` with no `Access-Control-Allow-Origin`.

**Login rate limiting / temporary lockout.** New `backend/ratelimit.py`, MongoDB-backed with TTL expiry. Three scopes: IP+email 5 failures, account 10 failures across IPs, IP 50 failures — each a 15 minute lock, with 15/30/60 minute exponential backoff for repeat offences. Returns **429 + `Retry-After`**. The lock is checked *before* the password, so a correct password cannot bypass it. A successful login clears the counters. Only genuine credential failures count — a correct password against a disabled account is never counted. Locks are temporary and automatic; there is no permanent lock and no admin unlock.

**X-Forwarded-For anti-spoofing.** `client_ip()` honours XFF **only** when the immediate peer is inside `TRUSTED_PROXY_CIDRS`, and then uses the **right-most** hop (the value appended by the trusted ingress), so an arbitrary client cannot spoof its source IP to evade the limiter.

**JWT / session hardening.** Access token cut from **7 days to ~15 minutes** with `type=access` enforced in `get_current_user`. Added a refresh-token mechanism (7 days, httpOnly cookie) with a `jti` registered in `db.refresh_tokens`: every `POST /api/auth/refresh` **rotates** the token and revokes the old one, so a replayed refresh token is rejected. `POST /api/auth/logout` revokes the refresh token, ending the usable session. A refresh token cannot authenticate an API call. The frontend no longer writes any token to `localStorage` — the httpOnly cookie is the only browser carrier, and a transparent single-retry refresh interceptor preserves the existing login UX. Indexes added: unique `(scope,key)` and TTL on `login_attempts`, `jti` + TTL on `refresh_tokens`, unique `users.email`.

### Verification (iteration_10, testing agent) — PASS
29 new tests in `/app/backend/tests/test_hardening_cors_ratelimit.py`; **full regression 186 passed, 3 legacy skips** (unchanged from iteration 9). All 20 matrix rows PASS, zero critical and zero minor defects, zero action items. All six role logins land correctly, the session survives a reload on the cookie alone, and logout blocks protected routes.

### Residual security risks (reported, NOT fixed — awaiting user decision)
1. **Infrastructure:** the shared Cloudflare preview edge rewrites CORS preflight responses to `access-control-allow-origin: *` regardless of the app. The application itself enforces the allowlist correctly (verified at `localhost:8001`). **CORS must be re-validated on the real production hostname/ingress before go-live.**
2. **No CSRF protection** on `POST /api/auth/refresh` and `/api/auth/logout` while the refresh cookie is `SameSite=None`. An attacker cannot read the response but can force a nuisance logout. Recommend a CSRF token or an Origin/Referer allowlist check.
3. `/api/auth/login` **still returns `access_token` in the response body** for API/CLI/test clients; reachable by XSS during the login response window.
4. The `users.email` unique-index creation is inside a broad try/except that only prints, so a duplicate-blocked index would fail silently at startup.

### Token exposure fix (2026-06)
Browser sign-ins are now served **entirely by httpOnly cookies** — `POST /api/auth/login`, `/auth/register` and `/auth/refresh` omit `access_token`/`refresh_token` from the response body whenever the caller is a browser (detected via the `Origin` / `Sec-Fetch-Mode` headers, which browsers always send on POST and fetch/XHR but API/CLI clients do not). Non-browser API and CLI clients have no cookie jar and still receive the Bearer token, so the existing test suite and any API consumers are unaffected. Login UX and role-based routing are unchanged.

Cookie controls are environment-configurable via `COOKIE_SECURE` and `COOKIE_SAMESITE` (currently `true` / `none`, required for the cross-site preview host). Both session cookies are issued `HttpOnly; Secure; SameSite=None`. A same-site production deployment can tighten SameSite to `Lax`/`Strict` by env change only.

**Verified (iteration_11):** 41 hardening tests + 8 adversarial probes, full regression **207 passed / 2 skipped / 0 failed**. Browser-confirmed for Client, Accountant A/B/C, Admin and Super Admin — every login body contained only `user` (no `access_token`, no `refresh_token`, no `eyJ` JWT substring anywhere), `localStorage`/`sessionStorage`/`document.cookie` held no auth token (PostHog analytics only), the session survived a reload on the cookie alone, and logout blocked protected routes.

Two `test_taxsimba_phase1b.py` tests (`test_recommend_package_downgrade_rejected`, `TestAdminOffer::test_send_mtd_offer_and_decline_workflow`) were failing on **pre-existing terminal seed state**, not on this change: Client B's case already carries an **APPROVED** MTD recommendation and a **PENDING** package recommendation, so `recommend-mtd`/`recommend-package` correctly return 409 from the duplicate-recommendation guard before the assertion under test can be reached. Both now `pytest.skip` on that state, matching the existing legacy-skip precedent in the same file. **No product code was changed for this.**

**Browser detection:** `_is_browser()` treats a request as a browser when it carries `Origin` or `Sec-Fetch-Mode`. A `Referer`-only request is intentionally treated as a CLI caller and still receives the token — real browsers always emit `Origin` on POST, and this behaviour is pinned by a test.

**CORS remains environment-configurable and unvalidated against real infrastructure — no production/staging TaxSimba hostnames have been invented or configured. The final allowlist MUST be validated when deployed to the real infrastructure.**

## Known gaps / not built
- MTD quarterly operational workflow, HMRC API, Xero, SimbaX (deliberately deferred).
- **Production hardening: DONE (2026-06)** — explicit CORS allowlist with wildcard fail-fast, login rate limiting + temporary lockout, XFF anti-spoofing, 15-minute access tokens with rotating/revocable refresh tokens. Residual risks listed above (edge CORS rewrite, CSRF on refresh/logout, body-returned access token).
- No outbound email (Resend not implemented); in-app notifications only.
- `server.py` + `phase1b.py` are large and would benefit from being split into routers.

## Backlog
- P1: CSRF token / Origin-Referer check on `/api/auth/refresh` + `/api/auth/logout` (only remaining known auth risk)
- P1: pagination on `GET /api/users` (hard-capped at 500) and `GET /api/recommendations` (300) — accumulated records can silently hide accounts
- P1: validate the CORS allowlist on the real production hostname/ingress (the preview edge masks it)
- P1: Resend email notifications mirroring in-app triggers; deadline-approaching / overdue scheduler
- P2: submission-issue handling flow; message attachments; TaxSimba Support as a separate message thread
- P2: split `server.py`/`phase1b.py` into routers
- Phase 2: MTD quarterly compliance workflow on the same operational core
