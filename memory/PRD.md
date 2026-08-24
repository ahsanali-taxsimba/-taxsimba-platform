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

## CSRF protection (2026-06)
`_enforce_csrf()` guards the two cookie-authenticated state-changing endpoints, `POST /api/auth/refresh` and `POST /api/auth/logout`.

**Critical infrastructure finding:** the edge proxy in front of this app **rewrites the inbound `Origin` header to its own cluster hostname** (`https://taxsimba-foundation.cluster-3.preview.emergentcf.cloud`), verified by logging live request headers. An attacker sending `Origin: https://attacker.example.com` therefore arrives at the app looking same-origin, so **an Origin-only CSRF defence is silently ineffective behind this proxy**. `Sec-Fetch-Site` and `Referer` were confirmed to pass through untouched, and a pure CLI request arrives with no Origin injected.

Three independent layers are applied:
1. **`Sec-Fetch-Site`** — browser-set and not settable by page script; anything other than `same-origin`/`none` is rejected (`same-site` is also rejected).
2. **`Referer`** — must match the CORS allowlist or the app's own origin (via `_self_origins()`, which accepts `Host`/`X-Forwarded-Host` since the proxy rewrites Origin).
3. **Double-submit token (primary, proxy-independent)** — a readable `csrf_token` cookie must be echoed in the `X-CSRF-Token` header, compared with `secrets.compare_digest`. A third-party origin cannot read that cookie, so it cannot forge the header.

A request with **none** of these browser markers cannot come from a browser document and so cannot be a CSRF vector — non-browser API/CLI clients are unaffected.

The `csrf_token` cookie is intentionally **not** httpOnly (that is how double-submit works) and is `Secure` + `SameSite`. **It is not an authentication credential and grants no access on its own** — `access_token`/`refresh_token` remain httpOnly and invisible to JavaScript. The frontend attaches the header via a request interceptor in `lib/api.js`; the login/session/logout UX is unchanged. Logout clears all three cookies.

### Verification (self-tested)
- 60 hardening tests + 8 adversarial = **68 passed** serially; **full regression 226 passed / 2 skipped / 0 failed**.
- Live probes: legitimate same-origin refresh/logout `200`; cross-site `403`; missing/forged CSRF token `403`; evil Referer `403`; **the victim stayed signed in and their refresh token was never rotated** by any attack sequence.
- Browser-verified for Client, Accountant, Admin and Super Admin: correct landing routes, `csrf_token` readable, `access_token`/`refresh_token` **not** in `document.cookie`, session survives reload, UI sign-out works and blocks protected routes, mobile renders.
- CORS unchanged and not weakened; no production hostnames configured.
- One pre-existing flake (`test_notifications_and_mark_all_read`) fails intermittently under `-n 2` because parallel workers create new notifications between `read-all` and the re-fetch; it passes in isolation and on re-run. Unrelated to CSRF.

## Client Portal correction, data isolation & QA lock (2026-06)

### CRITICAL: cross-client data leakage — root cause and fix
**Symptom:** one logged-in client saw records from many foreign Self Assessment cases (SA-1003, SA-1009, SA-1015, SA-1277 …) in Tasks, Documents, My Services and Completed History. Reproduced before fixing: **Client A owned 35 cases but the API returned 181 tasks spanning 145 non-owned cases and 382 documents across 145 non-owned cases.**

**Root cause:** the client-facing list endpoints authorised on a *denormalised copy of the user id on the child row* (`tasks.owner_id`, `documents.client_user_id`) instead of verifying that the child's **parent case** belonged to the authenticated client. Repeated test runs had written child rows carrying Client A's user id while their `case_id` pointed at other clients' cases, so a single stale field granted cross-client read access. The `service_type` filter compounded it by querying **all** cases globally, and `/my-actions` and `/notifications` shared the same weakness.

**Fix (server-side, `server.py`):** new `_owned_case_ids(user)` derives the authoritative case set from *authenticated user → client record → cases*, and **every** client-facing query is constrained by `case_id ∈ owned`. `_get_case()` now also accepts ownership via the client record, and `download_document` proves ownership against the parent case rather than the document's copied field. Enforcement is entirely in the API layer — no frontend filtering is relied on.

**Verified:** `foreign = 0` on tasks, documents, notifications and my-actions; direct/modified case, task, document, message and download IDs all return 403/404 in both directions (A→B and B→A).

### Other defects found and fixed
- **`GET /api/users` silently truncated** at 500 rows sorted newest-first, so with 900+ accumulated accounts the original demo clients became invisible and staff lookups broke. Added a server-side exact `?email=` filter.
- **`READY_FOR_SUBMISSION` was labelled "Submitted to HMRC"** in `STATUS_META`/`STAGES` — the direct cause of the false "Submitted to HMRC — In Progress" dashboard claim. Stage renamed to **HMRC Submission** and `journey()` now takes `has_submission`, so "Submitted Successfully" requires a real submission record. States: Ready to Submit / Submitting / Submitted Successfully / Submission Failed.
- **Duplicate creation** — `request-from-client` is now idempotent (an open request of the same title is reused, no second task/request/document); `notify()` collapses an identical still-unread notification for the same user+case; completed history is de-duplicated by (action, case, day).
- **Hard-coded deadline** `2026-01-31` on case creation replaced by `deadline_for_tax_year()` (2025/26 → **31 January 2027**), derived from the record so no screen hard-codes a year.
- **`case_id` misuse** — account-level recommendations were writing `recommendation_id` into `case_id`.
- **Malformed history rows** (`Bank statements · · completed`) fixed; history now paginates with **Show more**.
- Client-facing enum leakage removed via `client_status()` / `clientStatusLabel()`; `StatusBadge` gained a `client` prop.

### Client portal changes
Tasks (Action Required / Completed tabs, "No due date" instead of `Due —`), Documents (All / Requested / Uploaded / Final Documents, **mobile card layout** instead of four cramped columns), Messages ("You" on the client's own side, mobile input no longer clipped), Dashboard (correct submission sequence, "Tax Return Deadline"), My Tax Return (no client Submit action — client reviews and approves, TaxSimba submits), My Services (current service + collapsed **Previous Tax Returns**, customer-facing payment statuses Paid/Pending/Failed/Refunded).

**New:** Help Centre (search, 8 categories, 12 seeded FAQs, quick actions) with **Admin/Super-Admin CRUD at `/api/faqs`** so content is maintained without code changes; Settings (change password, 6 notification preferences, privacy/data export and controlled account-closure requests — closure never destroys retained tax records; no fake 2FA/device buttons); Profile (name/phone/address editing, UTR masked with Show, email change via **verified pending request** to Admin/Super Admin since no email sending exists).

### Demo data normalisation
`scripts/fix_demo_data.py` (idempotent, demo clients only) removed 34 duplicate cases, 146 orphan tasks and 306 orphan documents for Client A and reset notifications 94 → 2. **Note:** the Phase 1/1B/2 suites deliberately drive the shared demo accounts and create new cases on every run, so presentation state is asserted in `tests/test_zz_demo_portal_state.py`, which re-runs the normalisation first and should be run last.

### Verification
- **Full regression: 287 passed, 2 skipped, 0 failed** (`--ignore=test_zz_demo_portal_state.py`), then **9/9** demo-state checks.
- New suites: `test_client_portal_isolation.py` (50 tests inc. the A/B security gate), `test_clean_client_journey.py` (**13/13**, full purchase → assignment → request → upload → calculation → admin approval → client approval → authorised submission → completed → final documents, with zero duplicates), `test_zz_demo_portal_state.py` (9).
- Browser: all 11 client pages plus Client B, Accountant, Admin and Super Admin render correctly with **zero** internal enum/placeholder violations; mobile checked at 390px.
- Two transient chunked-read network errors under parallel load were confirmed to pass in isolation (not product defects).

## Final hardening: cross-role QA, demo isolation, production CORS (2026-06)

### 1. Cross-role QA (`tests/test_cross_role_qa.py`, 29 tests)
Real workflow and permission testing on a **disposable** client, not page rendering:
- **Assignment propagation** — assigned Accountant A sees the case; Accountant B gets 403/404 and it is absent from their list; Admin and Super Admin both see it.
- **Status propagation** — an accountant's information request flips the case to `AWAITING_CLIENT` for every staff role and reads *"Waiting for you"* for the client; the client's upload becomes visible to Accountant, Admin and Super Admin and yields exactly **one** document and **one** completed-history entry.
- **Approval gates** — accountant cannot record a submission; client cannot see a calculation before admin approval; client cannot approve before release; accountant cannot approve on the client's behalf; client approval propagates to all staff roles.
- **Submission truth** — while only ready: `has_submission_record` false, journey `Ready to Submit`, label never "Submitted to HMRC"; client cannot record a submission (403); only an admin-recorded authorised submission flips it to `Submitted Successfully`; client and admin never disagree on status.
- **Permission matrix / privacy** — client 403 on 7 staff actions; accountant 403 on admin actions; no `password_hash`, client email or Stripe ids reach an accountant; internal notes never reach the client; Admin contact masked, Super Admin unmasked with mandatory-reason audited reveal and Admin 403.

Note: the sequential steps live in a **single class** on purpose — under `--dist loadscope` separate classes land on different xdist workers, which rebuilds the module fixture and hands later classes a fresh case (a flaw in the test design, fixed).

### 2. Demo data isolation
`tests/qa_clients.py` + `tests/conftest.py` provide dedicated disposable accounts (`qa.client.a@`/`qa.client.b@qa-taxsimba.example.com`, `QaClient@123`), provisioned idempotently and pruned by a session autouse fixture. **All mutating suites** (phase1, phase1b, phase1b_ux, phase2, iteration7) were repointed off the demo accounts — 91 references migrated. `demo_account_counts()` / `assert_demo_accounts_untouched()` give an objective before/after diff, asserted by `TestDemoAccountsUntouched`.
**Proven empirically:** a complete regression left Client A `{cases:1, notifications:2, documents:2, tasks:2, payments:0}` and Client B `{1,0,0,0,0}` **identical** — zero growth on every collection. Client A/B stay clean for manual preview testing.

### 3. Production CORS
`CORS_ORIGINS="https://taxsimba.co.uk,https://www.taxsimba.co.uk"` (production only) is now separate from `CORS_DEV_ORIGINS` (preview only); `_allowed_origins()` merges them and **raises `RuntimeError` on `*` or empty in either**. Verified at the app boundary: both production domains and the preview origin echoed, `attacker.example.com` → **400 with no allow-origin**, no wildcard anywhere.

### Verification (iteration_12, independent)
**328 passed / 2 skipped / 0 failed**, zero critical and zero minor product defects, `retest_needed: false`. All 4 role logins land correctly, all 11 client routes render, mobile 390px has no overflow and Documents renders as stacked cards.

### Still requires external integration/configuration (deliberately NOT faked)
1. **HMRC filing** — no API integration; submissions are recorded manually by authorised staff.
2. **Transactional email** — no provider; email-change verification stays a PENDING staff-reviewed record.
3. **Live Stripe** — TEST/SANDBOX keys only.
4. **Production DNS/ingress** — the preview edge rewrites `Origin` and returns `*` on preflight, so CORS must be re-validated once `taxsimba.co.uk` ingress exists.

## My Tax Return final section corrections (2026-06)
Scoped to the My Tax Return page only — no redesign, no HMRC API.

1. **Final Documents** — empty state reads *"Final documents will appear here once available."*; released documents show name, released date and a **View / Download** action (`final-doc-{id}`, `final-doc-download-{id}`). Case- and client-specific via the existing ownership gate: a foreign client gets 403/404 on the download URL and the id never appears in their list.
2. **Approval wording** — now *"You approved version {n}. Your return is now with your accountant for submission to HMRC."* The number is dynamic: `get_case` returns **`approved_version`** from `db.client_approvals` (null before approval), and the page reads `cs.approved_version ?? calc?.version`. Proven by creating v1+v2, approving v2, and getting 2 back. "authorised submission team" wording removed.
3. **Submission model** — TaxSimba does **not** file via an HMRC API. The accountant files using third-party tax software and records the outcome. Client approval alone never marks the return submitted: `client-approve` inserts a submission record with status **READY**, and case reads only count a **SUBMITTED** record, so the label stays *"Ready for HMRC submission"* with journey *Ready to Submit*. Only an admin/super-admin `record-submission` flips the client label to *"Submitted to HMRC"*, surfacing the recorded **submission date** and reference (journey *Submitted Successfully*). A client calling `record-submission` gets 403.
4. **Deadline** — the hard-coded `payment_deadline: str = "31 January 2026"` default was **removed**. New `payment_deadline_label(tax_year)` derives it (2025/26 → **31 January 2027**, 2024/25 → 31 January 2026); `create_calculation` falls back to it and `list_calculations` **overrides it on read**, so historic rows that stored a stale literal now display the correct derived date without a migration.

### Verification (iteration_13, independent)
18/18 new tests in `tests/test_my_tax_return_final.py`; **full regression 336 passed / 2 skipped**; all 15 matrix rows PASS; zero critical and zero minor product defects; `retest_needed: false`. Desktop and 390px mobile confirmed: "31 January 2027" present, "31 January 2026" absent, "authorised submission team" absent, no raw enums, no console errors.

**Known test-harness flake (not a product defect, P2):** under `-n 2 --dist loadscope` a small number of tests intermittently fail because a second worker seeds data mid-test (`test_iteration7_audit::TestAccountantRBAC::test_accountant_cannot_see_other_accountant_case`, `test_taxsimba_phase1::TestStatsAndAdmin::test_notifications_and_mark_all_read`). Both pass in isolation. Fix pattern: pin sequential steps into a single class so loadscope keeps them on one worker (as done for `TestCrossRoleWorkflow` and `TestApprovalAndSubmissionModel`).

## Known gaps / not built
- MTD quarterly operational workflow, HMRC API, Xero, SimbaX (deliberately deferred).
- **Production hardening: DONE (2026-06)** — explicit CORS allowlist with wildcard fail-fast, login rate limiting + temporary lockout, XFF anti-spoofing, 15-minute access tokens with rotating/revocable refresh tokens. Residual risks listed above (edge CORS rewrite, CSRF on refresh/logout, body-returned access token).
- No outbound email (Resend not implemented); in-app notifications only.
- `server.py` + `phase1b.py` are large and would benefit from being split into routers.

## Backlog
- P1: CSRF token / Origin-Referer check is DONE; remaining auth risk is the edge Origin rewrite (see above)
- P1: pagination/search on `GET /api/users` (exact `?email=` lookup added; the 500-row page cap remains) and `GET /api/recommendations` (300)
- P1: validate the CORS allowlist **and the Origin-rewriting behaviour** on the real production hostname/ingress (the preview edge masks both)
- P2: point the Phase 1/1B/2 suites at dedicated throwaway clients instead of the shared demo accounts, so the preview portal stays clean after a regression run
- P2: pin the remaining xdist-race tests into single classes (`test_iteration7_audit::TestAccountantRBAC::test_accountant_cannot_see_other_accountant_case`, `test_taxsimba_phase1::TestStatsAndAdmin::test_notifications_and_mark_all_read`) — both pass in isolation
- P2: de-flake `test_notifications_and_mark_all_read` (parallel-worker race under `-n 2`)
- P1: Resend email notifications mirroring in-app triggers; deadline-approaching / overdue scheduler
- P2: submission-issue handling flow; message attachments; TaxSimba Support as a separate message thread
- P2: split `server.py`/`phase1b.py` into routers
- Phase 2: MTD quarterly compliance workflow on the same operational core

## 2026-06 Documents view/upload fix
- `frontend/src/lib/api.js` `openDocument()` now opens the new tab synchronously on click, then points it at the authenticated blob URL (download-anchor fallback if popup blocked). Fixes the raw `{"detail":"Not authenticated"}` page from the previous plain <a href> to /api/documents/{id}/download.
- Client Documents + My Tax Return final documents use `openDocument`.
- Staff `pages/staff/CaseWorkspace.jsx` (~line 251) still uses a raw href to the protected endpoint - KNOWN, intentionally out of scope.
- Note: two QA test PDFs (qa_upload.pdf, qa-upload.pdf) were uploaded to Client A during targeted testing; run `python scripts/fix_demo_data.py` to re-normalise the demo portal.

## 2026-06 Client portal final correction pass
Files: backend/server.py (case search by email, task tax_year, task-request deep link, role-aware message notification link + case moves to Needs My Action on client message/upload, profile-change audit, canonical FAQ answers re-synced on boot), backend/phase1b.py (my-payments: unresolved pending >24h reported as cancelled), backend/helpcentre.py (accountant-led HMRC/MTD wording), backend/scripts/fix_demo_data.py (demo-only stray email-change/data-request/unpaid-payment cleanup), frontend: ClientDashboard (full saved name greeting), AuthContext (refresh()), ClientProfile (refresh after save, no pending address shown, approval wording), ClientSettings (confirm before data/closure request, approval wording), ClientPages (task tax year + ?task= highlight), MyServices (title My Services, Cancelled status), CaseTable (mobile cards), AccountantDashboard (case search).
All 12 targeted checks A-L PASS (self-tested, no regression, no testing agent per user instruction).
Known/out of scope: staff CaseWorkspace still uses a raw href for document download; hundreds of historical automated-test cases remain in accountant.a Needs My Action (search added to make the right case findable).

## 2026-06 Accountant workflow correction (case identity)
Root cause 1: case.client_name is a denormalised copy never updated on profile rename (Client A -> Ahsan Ali), so accountant name search missed the case.
Root cause 2: case_ref was generated from cases.count_documents(), so deleted cases re-issued numbers -> 170 duplicate refs (SA-1456 shared with an IT8 test case).
Root cause 3: frontend "Waiting for Client" tab sent bucket=awaiting_client which was not a known bucket, and unknown buckets were silently ignored.
Files: backend/server.py (_next_case_ref counter-based unique refs, name search resolves via client record, profile rename propagates to cases.client_name, awaiting_client bucket alias, unknown bucket -> 400), backend/seed.py (unique index on case_ref), backend/scripts/fix_case_integrity.py (new: reissued 184 duplicate refs keeping the earliest case, resynced client names, seeded counter, created unique index, logged each repair in activity history), frontend CaseWorkspace.jsx (task cards show Case ref + tax year).
All 6 targeted checks PASS. Accountant isolation re-verified: Accountant B gets nothing by name/ref/email and 403 on direct case/task access.

## 2026-06 Accountant workspace cleanup + lock
- backend/testdata.py (new): is_test_email() + OPERATIONAL_ONLY filter. Test addresses = test_*, ux_test_*, qa.*, @qa-taxsimba.example.com; clienta/clientb are genuine.
- backend/scripts/mark_test_data.py (new, run once): flagged 869 automated-test cases and 1195 test clients with is_test (nothing deleted, audit history intact); 2 genuine demo cases marked operational.
- backend/server.py: /cases and every accountant/admin stat + workload count exclude is_test unless ?include_test=true; new cases and client records inherit is_test from the client email; staff notification list drops notifications belonging to test cases.
- Accountant A operational counts now: needs_my_action 1, awaiting_client 1, approved_ready 1, everything else 0 (SA-1456 Ahsan Ali 2025/26, SA-1428 Client B 2025/26).
- Verified: case_ref unique index + counter (no write path mutates case_ref anywhere), internal working documents are staff-only (client list excludes, client download 403, staff 200, uploader+timestamp recorded), Accountant B blocked on search/case/tasks/documents/download/messages/task-complete (403), no client email/phone in accountant case payloads.

## 2026-06 Admin reassignment fix
Root cause: POST /cases/{id}/assign always called transition(..., "ASSIGNED"), which rewrote stage/status/next_action/next_action_owner and cleared waiting_reason. Reassignment now only swaps the accountant (plus priority/instructions/internal deadline), logs "Case reassigned from X to Y" with admin + timestamp + old/new ids, and notifies the outgoing accountant. First assignment still transitions AWAITING_ASSIGNMENT -> ASSIGNED; re-assigning the same accountant just updates assignment details.
Client B SA-1428 workflow state (Documents / Awaiting Client / CLIENT / waiting on Bank statement) was restored with a SYSTEM audit entry after the earlier defect, and the case is back with Ben Carter.
Targeted check PASS: only assigned_accountant_name changed; tasks/docs/messages/notes/document requests/deadlines/approval+submission state untouched; workload counts moved between the two accountants; old accountant 403, new accountant 200.

## 2026-06 Ready for Submission consistency fix
Root cause A: admin-return created an "Admin changes required" ACCOUNTANT task that was never closed when the next version was approved, so a resolved change stayed as an active missing item.
Root cause B: the client message/upload next-action takeover (added earlier) applied at any status, overwriting the READY_FOR_SUBMISSION next action ("Submit return"/ADMIN) with "Review the document the client uploaded"/ACCOUNTANT.
Fixes in backend/server.py: admin-approve closes open "Admin changes required..." tasks with an audit entry (history preserved); client approval only advances to READY_FOR_SUBMISSION when no open items remain; the next-action takeover applies only to ASSIGNED/ACCOUNTANT_REVIEW/AWAITING_CLIENT/CHANGES_REQUIRED; record-submission blocks on ANY open item (was mandatory-only).
SA-1456 repaired: stale admin-change task closed, stale document request resolved, next action restored to Submit return / ADMIN, SYSTEM audit entry added. Note: during checking a submission was accidentally recorded and was fully reverted (status, submission record, activity and notification rows) - SA-1456 is back at READY_FOR_SUBMISSION with submitted_at empty.
Checks 1-5 PASS.

## 2026-06 Record Submission hardening
backend/server.py record_submission: idempotent (already SUBMITTED/COMPLETED returns the existing case, so double-click cannot duplicate), date+reference blank validation, submission record now stores case_id, case_ref, submitted_by, submitted_by_name, submitted_by_role, note, provider, recorded_at timestamp.
Targeted check PASS: status SUBMITTED, date/ref saved, one audit entry (admin name + role + timestamp + note), one client notification to /my-return, repeated request returned the same record with no duplicate, documents/messages/notes/calculations unchanged.
SA-1456 restored to READY_FOR_SUBMISSION after the check (submission record, activity entry and notification reverted).

## 2026-06 Client post-submission display fix
backend/server.py: client case payload reads the stored submission reference from the record field `reference` (it was only checking `submission_reference`, so the real external reference never reached the client view).
frontend MyTaxReturn.jsx: once submitted, the approval line reads "Your return has now been submitted to HMRC."
frontend staff/CaseWorkspace.jsx: submission reference input now hints it is the filing-software reference, not the TaxSimba case ID (the SA-1456 value currently stored was typed by the admin in that field).
Both checks PASS.

## 2026-06 Submission UX polish
frontend staff/CaseWorkspace.jsx: reference field relabelled "HMRC / filing software submission reference" with helper text warning against the TaxSimba case ID (date + reference still required, note optional).
frontend client/MyTaxReturn.jsx: new "Paying your tax" panel shown once a submission is recorded - amount due and payment deadline from the final approved calculation only, payments on account rendered when present in the calc breakdown, "No payment is currently due." when nothing is owed or a refund, plus the "paid directly to HMRC" disclaimer and GOV.UK Sign in to HMRC / Pay HMRC links. No backend changes.
Checks 1-7 PASS.

## 2026-06 Completed case lock
backend/server.py: assign and unassign now reject COMPLETED cases (400, "reopen the case first"); request-from-client was already blocked by the transition rules; reopen stays ADMIN/SUPER_ADMIN only with a required reason and audited entry.
frontend staff/CaseWorkspace.jsx: Assign/Reassign/Unassign and Request from Client hidden when the case is COMPLETED; Add Internal Note, Reopen Case and all history tabs remain.
Checks 1-7 PASS. SA-1456 left COMPLETED with its submission and completion records intact (test note and test reopen audit entry removed).

## 2026-06 Super Admin accountant invitation onboarding
New backend/invites.py: single-use setup tokens (secrets.token_urlsafe, SHA-256 at rest, 72h expiry, revoked on reuse/resend).
backend/server.py: POST /staff-invites (SUPER_ADMIN, creates PENDING user with no password + upserts the accountant profile with specialisms/capacity, returns setup link), POST /staff-invites/{id}/resend (invalidates the previous link), GET /auth/invite/{token}, POST /auth/invite/{token}/accept (invitee sets own password -> ACTIVE), login rejects pending/passwordless accounts, PATCH /users/{id}/active returns active_cases_needing_reassignment and syncs the accountant profile, GET /users hides test accounts unless include_test=true.
frontend: new pages/AcceptInvite.jsx at route /invite/:token; SuperAdmin.jsx invite form (name, work email, role, specialism, capacity) showing the one-time link, Resend invite for pending users, reassignment warning on deactivate. POST /api/users left untouched.
NOTE: no email delivery exists in this app, so the setup link is shown to the Super Admin to pass on (Resend integration would be needed to email it).
Checks 1-10 PASS. Demo staff added during checks: Dana Osei (dana.osei@taxsimba.co.uk / Dana@12345) - see test_credentials.md.

## 2026-06 Super Admin reporting integrity + invite polish
backend/server.py: /overview now applies OPERATIONAL_ONLY everywhere (clients, new this month, SA/MTD/both, open/completed/overdue cases, per-accountant workload) and filters payments to genuine client users for revenue, successful and failed/expired counts; revenue note states SA+MTD are the categories and package upgrades are a SUBSET of SA. /accountants/workload and /users exclude test staff (is_test flag + email pattern, in-query so the cap cannot hide genuine users). /users adds invite_expires_at for pending users (never the token).
Dana Osei flagged is_test (invite/audit history preserved).
frontend SuperAdmin.jsx: invite role follows the tab (Accountants -> ACCOUNTANT with Specialism + labelled Case capacity and helper text; Admins -> ADMIN with accountant fields hidden), button shows the role, Pending invitation shows expiry + Resend, mobile stacked user cards.
Corrected figures: 2 clients (2 new this month, 2 active SA, 0 MTD), 1 open case, 1 completed, 0 overdue; Amara 0/1, Ben 1/0, Accountant C 0/0; revenue this month/year GBP460 = SA 100 + MTD 360, upgrades GBP100 subset of SA, 2 successful payments, 0 failed.
EMAIL DELIVERY NOT CONFIGURED - no SMTP/email provider exists in the project, so no delivery was added; the one-time link is shown to the Super Admin only.
Checks 1-11 PASS.

## 2026-06 Super Admin payments + audit log cleanup
backend/phase1b.py GET /payments: newest first, status filter (successful->paid, failed, expired, refunded), hides transactions belonging to test clients or to clients already cleaned away; include_test=true restores them.
backend/server.py GET /audit-log: newest first, hides activity on test cases (and on test cases already cleaned), keeps genuine SYSTEM events and case-less staff events; filters for case_ref, user_name, action, date_from/date_to; include_test=true restores test history.
frontend SuperAdmin.jsx: payments status filter + "Include test activity" toggle (default OFF) shared with the audit log, audit search row, mobile payment cards, wrapped audit text; load() no longer overwrites the filtered results.
Genuine payments after filtering: 2 (Client B GBP360 + GBP100, both paid = GBP460, reconciles with Business Overview). Audit default view: 33 genuine rows across SA-1456 (12) and SA-1428 (9) plus staff events; nothing deleted (include_test shows 173 payments / 300 audit rows).
Checks 1-11 PASS.

## 2026-06 Additional work payment requests
Reused the existing Stripe checkout, payment_transactions collection, notification and audit infrastructure - no new payment system.
backend/phase1b.py: POST /payment-requests (ADMIN/SUPER_ADMIN only, kind=ADDITIONAL_WORK linked to case+client, records created_by/role, description, amount, optional due date and internal note, notifies the client, audits), GET /payment-requests (client sees only their own and never the internal note; accountant read-only on their own case), POST /payment-requests/{id}/resend, POST /payment-requests/{id}/cancel (blocked once paid), POST /payment-requests/{id}/checkout (client only, reuses an open Stripe session so repeat clicks cannot create a second payable session), _fulfil handles ADDITIONAL_WORK idempotently (claims fulfilled once, then audits and notifies admin+assigned accountant), stale-pending auto-cancel excludes these requests, GET /payments gained a kind filter.
frontend: CaseWorkspace Request Additional Payment modal with confirmation + per-case request list with Resend/Cancel; MyServices client card "Additional work payment required" with Pay securely, Paid state with date and provider reference, and Additional work rows in payment history; SuperAdmin payments type filter (Additional Work / Package upgrade / Service activation) with client, case ref, description, created by, due/paid date and provider reference.
Checks 1-9 PASS. Test rows created during verification were removed afterwards.

## 2026-06 Additional work: accountant recommendation + paid receipt
backend/invoices.py (new): invoice/receipt records (INV-YYYY-NNNN from the counters collection), idempotent create_receipt (one per payment request), printable HTML render with TaxSimba details; no new VAT logic.
backend/phase1b.py: POST /cases/{id}/recommend-additional-work reuses the recommendations collection (type ADDITIONAL_WORK, optional suggested_amount, internal only - no checkout, no client visibility); /payment-requests accepts recommendation_id and marks the recommendation APPROVED with the final amount; existing /recommendations/{id}/decline covers declining; _fulfil creates exactly one receipt, audits it with the receipt number and notifies the client ("Payment received"); GET /payment-requests/{id}/receipt (client owner, admin/super admin, assigned accountant read-only).
frontend CaseWorkspace.jsx: Recommend Additional Work modal (accountant), admin Approve & send charge / Decline on the recommendation, receipt link on paid requests. MyServices.jsx: Payment received + receipt number + View / download receipt, pay button gone once paid.
EMAIL DELIVERY NOT CONFIGURED - RECEIPT AVAILABLE IN PORTAL. The receipt notification event exists in the in-app notification architecture, so a future provider can email it.
Checks 1-10 PASS. Verification rows removed afterwards.

## 2026-06 Security hardening + scale readiness + staff MFA (tested, iteration_14: 28/28 PASS)
NEW FILES: backend/security.py (TOTP helpers, per-step replay protection, bcrypt-hashed single-use recovery codes, single-use JWT 2FA challenge, check_password_strength), backend/protections.py (SecurityHeadersMiddleware, MongoDB-backed RateLimitMiddleware keyed per caller with IP fallback, validate_upload + safe_filename), frontend components/TwoFactorPanel.jsx, frontend pages/staff/StaffSecurity.jsx (route /staff/security).
backend/server.py: /auth/login returns {two_factor_required, challenge} and NO session when 2FA is on; /auth/login/2fa; /auth/2fa/status|enrol|activate|disable (ADMIN/SUPER_ADMIN cannot disable); password policy on change-password and invite acceptance; password change revokes all other refresh tokens; ensure_query_indexes() indexes every hot collection on boot; _decorate/list_tasks/audit_log/all_payments batched (N+1 removed); /cases and /audit-log accept limit+skip; overview revenue aggregated in Mongo.
.env additions: TOTP_FERNET_KEY, TOTP_ISSUER, API_RATE_LIMIT_PER_MINUTE=300, MAX_UPLOAD_MB=25. Deps: pyotp (backend), qrcode.react (frontend).
Perf: audit endpoint 970ms -> ~150ms; cases/payments/tasks all ~110-160ms.
Gotchas learned: HTTPException raised inside middleware returns 500 (must return JSONResponse); in-memory rate limiting does not work behind the ingress because requests spread across replicas (counter must live in Mongo).
All demo accounts left with 2FA OFF so nobody is locked out. SA-1456 COMPLETED / SA-1428 Awaiting Client unchanged.
STILL OUTSTANDING for production: no transactional email provider (invites/receipts are portal-only), live Stripe keys, production DNS/CORS validation.

## 2026-06 Final pre-MTD platform lock (self-tested, no testing_agent per user instruction)
3 genuine defects found and fixed:
1. backend/phase1b.py GET /recommendations - had no operational filter, so all 300 historic QA/test recommendations showed by default in Admin -> Recommendations. Now filtered to genuine cases only (include_test=true still returns all 300; nothing deleted).
2. backend/server.py POST /cases/{id}/record-submission - returned 200 on a COMPLETED case. Now 400 "Completed cases are locked - reopen the case first".
3. backend/phase1b.py POST /payment-requests - allowed an Additional Work charge on a COMPLETED case. Now 400 with the same lock message; reopen (with recorded reason, audited) is required first.
Verified by direct API checks: recs default 0 / include_test 300, accountant+client 403; record-submission 400 with submission record still 1; payment-requests 400; SA-1456 still COMPLETED with its original submission ref/date/completed_at.
Inspection results: complaints/service-issue module MISSING (only client<->staff messaging + data_requests exist). Final Documents GAP - documents have no client-visible "final return copy" designation (is_internal docs get status "Final" but are staff-only). Email delivery still NOT CONFIGURED (no SMTP/Resend/SendGrid key); all notification events exist in-app and are provider-ready.
Genuine counts: 2 clients, 2 cases (SA-1456 COMPLETED, SA-1428 AWAITING_CLIENT), 0 genuine recommendations, 0 open payment requests, 0 invoices, no duplicate case refs.
Temporary lock-check rows removed; demo case states untouched.

## 2026-06 Final SA operational gaps (self-tested, no testing_agent per user instruction)
1. Client Final Documents - backend/server.py: POST /cases/{id}/final-documents (ADMIN/SUPER_ADMIN, only when status is READY_FOR_SUBMISSION/SUBMITTED/COMPLETED; each publish is a new immutable final_version so reopen/re-completion keeps every earlier copy), GET /cases/{id}/final-documents, and GET /documents?filter=final now keys off is_final instead of status=="Final" (internal working papers no longer leak into the Final view). Client Documents page shows Final vN + case ref + tax year + published date; CaseWorkspace Documents tab gained a "Final client documents" panel with "Publish final copy".
2. Service issues / complaints - new collection service_issues. POST /service-issues (CLIENT), GET /service-issues (client own; accountant sees existence only via _issue_for_accountant - id/case/category/status/dates, no subject or description; admin/super admin full, test-filtered), PATCH /service-issues/{id} (ADMIN/SUPER_ADMIN only, RESOLVED requires a client-facing resolution message). OPEN -> IN_REVIEW -> RESOLVED. Every create/status change is written to activity_logs with actor+timestamp and notified. Complaints never touch case status. New frontend/src/pages/ServiceIssues.jsx (ClientServiceIssues at /service-issues, AdminServiceIssues at /admin/service-issues) plus nav entries "Report a Problem" (client) and "Service Issues" (admin).
3. Reopen history - GET /cases/{id}/reopen-history derived entirely from activity_logs (previous_status == COMPLETED), returning reopened_by/role, reopened_at, reason, previous_completed_at and recompleted_at. No second source of truth. Shown as a "Reopen history" block on the CaseWorkspace Overview tab.
Targeted checks all PASS: internal doc hidden from client (list + 403 download); final doc owner 200 / other client 403 / assigned accountant 200 / admin 200; client created an issue and admin set IN_REVIEW then super admin RESOLVED with message (resolve without a message = 400); accountant PATCH 403 and client PATCH 403; other client sees 0 issues; case status/submission/completion unchanged by a complaint; reopen history returned the correct reopened-by/reason/previous+re-completion dates; SA-1456 and SA-1428 unchanged. All verification rows (final doc, internal doc, issue, temp case, temp logs, notifications) deleted afterwards.

## 2026-06 MTD for Income Tax — separate quarterly workflow (self-tested)
Self Assessment, shared permissions/payment/document/audit architecture untouched. MTD reuses the existing case/permission/document/audit foundation and adds its own period-level workflow.
NEW FILE backend/mtd.py (router prefix /api/mtd, collection mtd_periods):
- period_schedule/ensure_periods generate the standard HMRC schedule automatically on MTD activation (Q1 6 Apr-5 Jul due 7 Aug, Q2 6 Jul-5 Oct due 7 Nov, Q3 6 Oct-5 Jan due 7 Feb, Q4 6 Jan-5 Apr due 7 May, plus Final Declaration 6 Apr-5 Apr due 31 Jan following). Idempotent; also exposed as POST /mtd/cases/{id}/generate-periods (admin) and lazily generated on first GET.
- Period status machine (separate from the SA case machine): NOT_STARTED -> IN_PROGRESS -> ADMIN_REVIEW -> AWAITING_CLIENT_APPROVAL -> APPROVED -> SUBMITTED, each with stage_label + next_action/next_action_owner.
- Endpoints: GET /mtd/cases/{id}/periods; POST /mtd/periods/{id}/figures (accountant/admin, income+expenses+note, profit computed, locked once under review/awaiting client/submitted); submit-for-review (accountant); admin-approve and request-changes (admin/super admin only); client-approve (owning client only); record-submission (admin/super admin, requires client approval, then locked - external filing reference and date only, no HMRC API).
- Every step writes to the existing activity_logs with actor + timestamp and raises the existing in-app notifications.
backend/phase1b.py: MTD activation calls ensure_periods(case) right after the MTD case is created. backend/server.py: mtd router included.
frontend: ClientActions.jsx MtdDashboard rewritten - per-case card listing the 4 quarters + Final Declaration with period dates, deadline, stage, income/expenses/profit, accountant note, next action, submission reference, and an "Approve these figures" button when it is the client's turn. CaseWorkspace.jsx gained an MTD-only tab set with an "MTD quarterly periods" panel (enter figures, send for internal review, approve and release, return for changes, record external submission) plus two modals; the case header now labels MTD cases correctly.
Verified with a disposable QA MTD case (MTD-QA01, QA Client A, Accountant A) end to end: schedule dates/deadlines correct; guards 400 before figures / before client approval / before submission; accountant admin-approve 403; admin return for changes then re-review; other client approve 403; figures locked while awaiting client 400; client approve 200; accountant record-submission 403; admin record-submission 200 then resubmit 400; SA case rejected by MTD endpoints (400); other client blocked from MTD periods (403); 8 audit rows with the correct actors; client and staff UI render, no mobile horizontal scroll. SA-1456 / SA-1428 unchanged. QA case, periods, logs and notifications deleted afterwards.

## 2026-06 MTD Phase 2 — client financial view + quarter operations (self-tested)
Self Assessment untouched; MTD stays a separate workflow on the shared foundation.
- Draft vs published separation (backend/mtd.py): accountant saves a STAFF-ONLY draft (total income, allowable expenses, net profit derived from income-expenses unless overridden, optional estimated Income Tax / National Insurance / suggested set-aside, client-facing note). No tax is ever calculated - estimates are only what the accountant typed. GET /mtd/periods/{id}/preview gives staff the exact client view of a draft. Clients never receive the draft/changes_reason fields.
- Controlled release: accountant -> submit-for-review -> ADMIN/SUPER_ADMIN admin-approve which PUBLISHES an immutable snapshot (version, prepared_by, published_by, published_at) into published + published_versions history; republish after request-changes appends v2 and never overwrites v1. Publishing does not submit. Client approve -> admin record-submission (reference, date, provider, outcome) -> locked.
- Client MTD page rewritten as frontend/src/pages/client/MtdQuarters.jsx (route /mtd): mobile-first stacked cards per quarter + Final Declaration under a "Year end" heading, large figure cards, accountant name/note/published date/version, the required "figures prepared by your accountant..." disclaimer, the "your accountant is preparing this quarter" message when nothing is published, per-period document upload/view, client Final Documents list, and the approve button only when it is genuinely the client's turn.
- Quarter documents: documents gained mtd_period_id (upload Form field + list filter + GET /mtd/periods/{id}/documents). Existing permissions unchanged - clients only see non-internal docs, internal working papers stay staff-only.
- Deadline warnings derived from the existing period deadlines: OVERDUE / DUE_3 / DUE_7 / DUE_14 with days_to_deadline, shown as badges to staff; clients get one idempotent in-app reminder when an approval is genuinely outstanding within 14 days (notify() collapses repeats, no spam, no email).
- Admin/Super Admin MTD dashboard: NEW frontend/src/pages/staff/AdminMtd.jsx at /admin/mtd (nav "MTD Operations") backed by GET /mtd/stats and GET /mtd/periods?bucket=... - active MTD clients, not started, preparing, awaiting admin review, waiting for client, ready for submission, submitted, due within 14 days, overdue. Cards filter the period list; rows open the case. Test/QA data excluded by default (include_test available).
- Final Declaration: same journey, separate card, its own deadline/status/submission. POST /cases/{id}/final-documents now accepts MTD cases once the Final Declaration is SUBMITTED (SA rule unchanged), so the final client copy uses the existing Final Documents architecture.
- Staff CaseWorkspace MTD tab now shows draft (staff only) beside published-to-client with version count, warning badge, preview client view, and the full action set.
Targeted checks all PASS: SA workflow unchanged (SA-1456 COMPLETED / SA-1428 AWAITING_CLIENT, SA filter intact, MTD endpoints reject SA cases 400); accountant draft invisible to client; accountant publish 403 and preview 403 for clients; published figures visible to the correct client only; other client 403; unassigned Accountant B 403; v1 preserved after v2 republish; publishing left submission_reference null and status AWAITING_CLIENT_APPROVAL; quarter documents stay on the right period (Q1 1 client-visible / 2 staff, Q2 0), client internal download 403, cross-client download 403, owner 200; deadline warnings correct from the generated deadlines; MTD stats/period list return 0 with test data excluded and 5 with include_test, accountant 403; Final Declaration final copy blocked until submitted (400) then published, owner 200 / other client 403 / accountant 200; no HMRC API/OAuth; no automatic tax calculation; client and staff mobile screens have no horizontal scroll.
QA MTD case (MTD-QA02), its 5 periods, 3 documents, 17 audit rows and notifications all deleted afterwards.

## 2026-06 MTD operational completion — quarter requests + accountant queue + year summary (self-tested)
1. Quarter-specific document requests (backend/mtd.py POST /mtd/periods/{id}/requests, assigned accountant + ADMIN/SUPER_ADMIN): reuses the existing document_requests + placeholder document architecture (status Requested -> Uploaded via the normal /documents/upload with document_id, then Reviewed via the existing PATCH /documents/{id}/status). Carries mtd_period_id/mtd_period_label, document type (Bank statement / Sales records / Expense receipts / Rental statement / Other), note, requested_by, requested_at and optional due date. The MTD case workflow status is deliberately NOT transitioned (unlike the SA request-from-client flow). Client sees the request on the correct quarter card with an Upload action; staff raise it from the CaseWorkspace MTD tab ("Request a document" modal).
2. Accountant MTD workload: GET /mtd/my-workload (ACCOUNTANT only, assigned + operational MTD cases only, drafts stripped) with buckets needs_my_action, waiting_for_client (derived from outstanding Requested docs), awaiting_admin_review, awaiting_client_approval, ready_submission, due_14, overdue, submitted. NEW frontend/src/pages/staff/AccountantMtd.jsx at /work/mtd (nav "MTD Workload"), each row showing client, tax year, quarter, deadline, status and next action. SA accountant counters (/stats/accountant) untouched.
3. Client Year Summary: GET /mtd/cases/{id}/year-summary returns Q1-Q4 with period dates, status and PUBLISHED income/expenses/net only, plus year-to-date totals summed from published figures alone, plus the "accountant-prepared information, not your final tax liability" note. No tax/NI in the summary. Rendered as a Year summary card in MtdQuarters.jsx between the quarters and the Final Declaration (which stays separate below).
Targeted checks all PASS: request lands on the correct quarter (Q1 Bank statement / Q2 Sales records, no cross-contamination); unassigned Accountant B request 403, client request 403; client uploaded against the request (same id, status Uploaded, right period), other client upload 403 and download 403, owner download 200; staff internal doc on Q1 invisible to client and download 403; accountant A queue shows only their assigned genuine MTD work with no draft leakage, accountant B all zeros, admin/client 403; SA accountant stats unchanged and SA cases unchanged; year summary ignored a Q1 draft (0 published) then showed 1 published quarter after admin publish and still ignored the Q2 draft; year summary 403 for other client; no tax/NI keys; no HMRC/OAuth. Client mobile screens no horizontal scroll.
QA case MTD-QA03 with periods, documents, document_requests, audit rows and notifications deleted afterwards. No scheduled/email reminders added.

## 2026-06 MTD client financial summary / publish view (self-tested)
Built on the existing Phase 2 MTD publish architecture - no parallel workflow created. Deltas added in this pass:
- Version-tied client approval: mtd_periods now stores approved_version + approved_snapshot. POST /mtd/periods/{id}/client-approve accepts {"version": n} and returns 409 ("These figures have been updated since you opened them") if it does not match the current published_version. Publishing a new version clears approved_version/client_approved_at so a re-published figure set requires fresh approval. Client card shows "you approved this version" and the approve button names the version.
- Version history surfaced to staff: the CaseWorkspace MTD tab now lists every published version (version, income/expenses/net, published by, timestamp) beside the staff-only draft, plus a "Client approved version n / Not yet approved by client" line. Admin and Super Admin see draft + latest + all previous versions.
- Accountant action relabelled "Publish to client (sends for admin review)" and audited as "published to client for release - sent for admin review", making it explicit that the accountant initiates publication but Admin/Super Admin still perform the release. Publishing remains non-submitting.
Already in place from Phase 2 and re-verified: staff-only drafts, Save Draft / Preview Client View, immutable published_versions history, client cards with income/expenses/net plus optional estimated Income Tax, estimated NI and suggested set-aside (accountant-entered only, no tax engine), the required disclaimer, published-by/date/version, accountant note, the "your accountant is preparing this quarter" empty state, and mobile stacked cards with no horizontal scroll.
Targeted checks all PASS: draft invisible to client (no draft key, published null through ADMIN_REVIEW); published figures visible to owning client with all estimates and disclaimer; other client 403 on periods and 403 on preview; unassigned Accountant B 403 on figures and preview; republish preserved v1 (history [v1 3000 Daniel Mensah, v2 2400 Sarah Owusu]) while the client sees only v2; stale approval on v1 rejected 409 and fresh v2 approval recorded approved_version 2; publishing left submission_reference null and status AWAITING_CLIENT_APPROVAL; admin and super admin both see draft + latest + 2 versions + approval status; no HMRC/OAuth/tax calculation; SA-1456 COMPLETED and SA-1428 AWAITING_CLIENT unchanged; 5-row audit trail with correct actors per publish/approve/submit.
Known gap (not in scope): once a client has approved, Admin cannot return that period for changes - it moves straight to submission. Raising a corrected version after client approval would need an explicit reopen action.
QA case MTD-QA04 and all its data deleted afterwards.

## 2026-06 MTD approved-period reopen / correction lock (self-tested)
Closes the gap flagged in the previous pass. NEW POST /mtd/periods/{id}/reopen (ADMIN/SUPER_ADMIN only, mandatory reason):
- Allowed only when status == APPROVED (client-approved, not yet submitted). A SUBMITTED period returns 400 "already been submitted externally and is locked - a separate correction process is required".
- Preserves everything: the published version stays in published_versions and is stamped superseded_at / superseded_reason / superseded_by_name / client_approved_at; a new approval_history entry records version, approved_at, the approved snapshot, reopened_at, reopened_by_name, reopened_by_role and reason. Nothing is deleted or overwritten and the draft stays intact.
- Clears the active approval (approved_version, approved_snapshot, client_approved_at all null) and returns the period to IN_PROGRESS so the assigned accountant can amend the draft, then the normal chain applies again: submit-for-review -> admin publish (new version) -> fresh client approval.
- Audited as "MTD {label}: reopened for correction (approved version n superseded)" with actor, role, timestamp, case ref, quarter and the reason in comments; notifies the accountant and tells the client a correction is under way.
- Frontend: "Reopen for correction" action on APPROVED periods for admins only (CaseWorkspace MTD tab); version history now always renders and shows the superseded stamp.
Targeted checks all PASS: Admin reopened an approved-not-submitted quarter; Super Admin reopened another; accountant 403, client 403, other client 403; blank reason 400; v1 preserved with superseded stamp and the previous approval kept in approval_history; approval cleared so v1 approval attempt returned 409 and only fresh v2 approval succeeded (approved_version 2); SUBMITTED Q3 stayed locked (400) and kept its reference Q3-SUB-001 and approved_version 1; Q3 and Q4 unaffected by the Q1/Q2 reopens; SA-1456 COMPLETED / SA-1428 AWAITING_CLIENT unchanged; 2 clean reopen audit rows with correct actor and role.
QA case MTD-QA05 and all its data deleted afterwards.

## 2026-06 MTD accountant workload visual check (self-tested)
Changes: per-bucket empty states in frontend/src/pages/staff/AccountantMtd.jsx (e.g. "No MTD quarters currently waiting for client action.") replacing the generic blank panel; each row now shows an explicit "Open MTD periods" action; row click navigates to /work/cases/{id}?tab=MTD%20Periods and CaseWorkspace reads the tab query param so the MTD Periods workflow opens directly (SA cases unaffected - they simply have no MTD tab).
Verified with disposable case MTD-QA06: all 8 buckets present and correct; a real quarterly item showed client name, MTD case ref, quarter/Final Declaration, period dates, deadline, status, next action and Open action; clicking opened the MTD case on the MTD Periods tab with 5 periods; Accountant B saw zero rows; mobile no horizontal scroll. QA case and records deleted afterwards.

## 2026-06 MTD Admin Operations view — core workflow (self-tested)
Changes: /admin/mtd cards realigned to the 7 requested operational counts (Needs Admin Review, Waiting for Client, Awaiting Client Approval, Ready for Submission, Due Within 14 Days, Overdue, Submitted/Completed) plus Active MTD Clients; new waiting_for_client count in GET /mtd/stats and matching bucket in GET /mtd/periods (derived from outstanding Requested quarter documents); admin period rows now carry assigned_accountant_name/id from the case and display client, case ref, accountant, quarter/Final Declaration, period dates, deadline, status, next action + action owner and an explicit "Open MTD period" action; per-bucket empty states replace the blank panel; opening a row goes to /admin/cases/{id}?tab=MTD%20Periods.
Targeted checks all PASS: admin sees MTD workload across accountants with accountant names; test/QA data excluded by default; open lands on the MTD Periods tab (5 periods); admin sees the full accountant draft (income, expenses, net, est. tax, est. NI, set-aside, note) plus version history while the client sees nothing pre-release; return for changes rejected blank reason 400 then returned ownership to ACCOUNTANT with the reason; accountant admin-approve 403; admin approve & release published v1 and the client then saw it; client approval moved the quarter to "Ready for external submission" (ADMIN owner); accountant record-submission 403; Admin recorded MTD-ADM-001 and Super Admin recorded MTD-SA-002, both moving to SUBMITTED with outcome/provider/note captured and no HMRC call; reassignment from Amara Boateng to Ben Carter left every quarter status, published version, client approval, draft, submission reference and deadline byte-identical, moved ownership only (A 0 rows / B 7 rows) and was audited; 13 audit rows with correct actor+role for every publish/approve/return/submit; SA-1456 and SA-1428 unchanged; no HMRC/OAuth/tax engine; admin mobile view no horizontal scroll.
QA case MTD-QA07 with periods, assignments, audit rows and notifications deleted afterwards.

## 2026-06 MTD admin case workflow final core check (verification only, no code changes)
Full journey re-verified end to end on disposable case MTD-QA08: accountant draft -> submit for admin review -> admin review screen (client name, case ref, quarter, assigned accountant, period dates, deadline, status, next action + owner, full draft incl. est. tax/NI/set-aside/note, version history, client approval status) -> return for changes (blank reason 400; with reason ownership back to ACCOUNTANT, draft and history preserved, client saw nothing) -> accountant correction cleared the open change request -> admin release published v1 -> client saw only v1 with no draft field -> wrong-version approval 409, correct version approved -> Ready for external submission (owner ADMIN, no open change request) -> accountant record-submission 403 -> admin recorded MTD-FIN-001 with date/outcome/note -> duplicate submission 400 with the original record intact -> submitted period reopen 400 (locked) -> approved Q2 reopen: blank reason 400, Super Admin reopen preserved v1 with superseded stamp and original approval, cleared the active approval (stale approval 400/409) and required fresh release + fresh approval of v2. 17 audit rows with correct actor and role throughout. SA-1456 / SA-1428 unchanged. No HMRC/OAuth/tax engine.
No code changes were required in this pass. QA case MTD-QA08 and all its records deleted.

## 2026-06 MTD Super Admin oversight final check (self-tested)
One genuine gap found and fixed: the global MTD view had no Final Declaration count. Added final_declarations to GET /mtd/stats (open Final Declarations, i.e. not yet submitted), a final_declaration bucket filter in GET /mtd/periods, and a "Final Declarations Open" card in /admin/mtd. Nothing else changed - no second workflow or duplicate records.
Verified with two disposable cases across two accountants (MTD-QA10 Amara Boateng, MTD-QA11 Ben Carter): global counts accurate (2 active cases, 1 admin_review, 1 ready_submission, 2 final declarations, 8 overdue) and every bucket filter returned matching rows; Super Admin saw all 10 periods across both accountants with client name, case ref, accountant, quarter/Final Declaration, deadline, status and next-action owner; opening a row landed on /admin/cases/{id}?tab=MTD Periods with 5 periods; Super Admin saw the staff-only draft, both published versions with the v1 superseded stamp, client approved version and the submission reference; reopen of an approved unsubmitted period required a reason (blank 400) and preserved v1 + the original approval; Super Admin recorded MTD-SUP-001 with date/outcome/note; duplicate submission 400; submitted-period reopen 400; Accountant A 403 on case 2 and Accountant B 403 on case 1, other client 403, accountant/client 403 on the global list and stats; client saw only published v2 with no draft; 10 audit rows with correct actor and role; Super Admin mobile view and case view had no horizontal scroll; SA-1456/SA-1428 unchanged; no HMRC/OAuth/tax engine.
Both QA cases and all their records deleted afterwards.

## 2026-06 Final MTD client journey lock (self-tested) — 2 genuine defects found and FIXED
Defect 1 (privacy leak, backend/mtd.py): the client period payload still carried staff-only keys published_versions, approval_history, reopened_by_name/reopened_at and is_test. published_versions/approval_history include supersede reasons and staff names, so a client could read internal correction history. _decorate now strips all of them for CLIENT; staff keep full detail (draft, 2 versions, approval_history).
Defect 2 (privacy leak, backend/server.py): GET /cases/{id}/activity was open to any authenticated case owner, so a client could read the raw staff audit log including internal comments (e.g. "internal filing note") and internal document upload events. Now restricted to ACCOUNTANT/ADMIN/SUPER_ADMIN (403 for clients). Verified no client screen used it - client journey screens read cs.journey, and /journey still renders.
Journey verified on disposable case MTD-QA20: MTD shown separately from SA; Q1-Q4 + Final Declaration with correct HMRC dates/deadlines (Q1 6 Apr-5 Jul due 7 Aug etc.) and per-period status/next action; quarter document request appeared on the right quarter and the client upload fulfilled it (status Uploaded, correct period); draft hidden through admin review; after release the card showed income/expenses/net, est. tax, est. NI, set-aside, accountant note, published by, published date, version and disclaimer; stale version approval 409, other client 403, client record-submission 403; valid approval -> "Approved - ready to submit"; reopen + v2 release cleared the old approval (v1 approval 409) and required fresh approval; after Super Admin recorded MTD-CJ-001 the client saw "Submitted" with reference and date only (no internal note); year summary used published figures only; internal working paper invisible and download 403; other client 403 on periods; client 403 on the global MTD list; mobile no horizontal scroll; SA-1456/SA-1428 and SA client screens unchanged.
QA case MTD-QA20 and all its records deleted.

## 2026-06 FINAL SA + MTD functional lock / production readiness (read-only review) — 1 HIGH defect found and FIXED
HIGH defect (backend/server.py get_case): submission_records move READY -> SUBMITTED -> COMPLETED (completing a case sets the record to COMPLETED), but get_case only matched status "SUBMITTED". On a COMPLETED case has_submission_record was therefore False, so the client's journey showed "HMRC Submission: Submitting" forever on a finished return. Fixed to match {"$in": ["SUBMITTED","COMPLETED"]}. Re-checked: SA-1456 now returns has_submission_record True and the journey reads Information/Documents/Accountant Review Completed, Your Approval Approved, HMRC Submission "Submitted Successfully". SA-1428 (AWAITING_CLIENT) and Client B's view unaffected; completed case still rejects re-submission (400) and its single submission record is unchanged.
Read-only results: SA CORE PASS (2 genuine cases correct, completed case locked against re-submission and additional-work charge). MTD CORE PASS (module isolated - only ensure_periods + router imported by SA code, workflow.py has no MTD logic; 0 leftover periods). ROLE SECURITY PASS (accountant 403 on audit-log/users/mtd stats/mtd periods/recommendations and on an unassigned case; client 403 on audit-log/users/my-workload/activity/reviews/reopen-history; cross-client 403; admin and super admin 200 where expected). DATA PRIVACY PASS (client payload carries no draft/version/approval history, internal docs hidden, other clients blocked). PAYMENT/UPGRADE FOUNDATION PASS (5 packages, my-services active, payments view 2 operational rows, recommendations 0 operational with test data filtered). AUDIT/DOCUMENTS/DEADLINES PASS (49 audit rows, notifications, tasks, deadline stats all live). TEST DATA CLEAN PASS (2 genuine cases, 2 genuine clients, 0 mtd_periods, 0 service_issues, 0 rows matching any qa- pattern).
Hygiene note (not a defect, no change made): the unscoped GET /documents list is not used by any UI screen (every client and staff screen passes case_id or mtd_period_id) but returns test-case documents to staff if called directly; child documents/document_requests on legacy test cases were never stamped is_test.
No HMRC API/OAuth and no tax calculation logic anywhere. READY TO FREEZE: YES.
Remaining production dependencies: live email provider, live Stripe keys, production DNS/CORS validation, staff MFA enrollment for real staff accounts, production redeploy of preview changes, and a production load/capacity check (preview timings are not a load test).

## 2026-06 Inner dashboard visual alignment (frontend presentation only)
Functional build stayed locked - git shows only 2 modified files, both presentation primitives: frontend/src/components/StatCard.jsx and frontend/src/components/AppShell.jsx. No backend, API, model, workflow, permission or calculation change.
StatCard: shadow-sm with hover elevation only when clickable, tighter uppercase label, tabular-nums 3xl figure, and a small semantic status dot per tone (green complete/ready, amber waiting/approaching, red overdue, purple admin review, neutral informational). Optional hint line. Panel: shadow-sm, wrapping header, responsive padding. Empty: more breathing room. These propagate the brand look to every dashboard, workspace, MTD, documents, tasks, messages and payments screen without touching them.
AppShell: TS logo mark beside the wordmark, sidebar grouped with "Making Tax Digital" and "Self Assessment & Practice" section labels so the two services read as separate parts of one platform, inset green bar on the active nav item, sticky translucent header (bg-white/90 + backdrop blur), responsive title scale with wrapping, "Signed in as {name}" on mobile, wider mobile drawer with a shadow and an explicit close button.
Visual check (screenshots taken): client dashboard, client My Tax Return, super admin Operations Control Centre, Admin MTD Operations, accountant My Workload, accountant My MTD Workload, plus 390px mobile versions of each and the mobile drawer. No horizontal scrolling anywhere; cards stack cleanly; headings wrap. Spot check after the change: SA-1456 COMPLETED / SA-1428 AWAITING_CLIENT, MTD stats intact, completed case still rejects re-submission (400).
FUNCTIONAL LOGIC UNCHANGED: PASS.

## 2026-06 Final UI consistency polish (presentation only)
Three small presentation fixes: StatCard given min-h-[118px] with flex justify-between so every summary card in a grid is exactly the same height (measured 118px uniformly on admin, super admin, accountant and MTD dashboards); AdminMtd card grid now xl:grid-cols-4 so it aligns with the other dashboards instead of a 3-wide layout; removed a stray space-y-1 on the AppShell main and added w-full so page margins are identical across roles.
Checked: card widths/heights uniform, page margins and heading/subtitle alignment identical across roles, panels sit a consistent distance below the card grids, action buttons (Search, filter chips, Open actions, Sign out) all clearly visible, status colours consistent (green ready/complete, amber waiting, red overdue, purple admin review, neutral informational), mobile cards stack cleanly with no horizontal scrolling on any checked view, and no control or data was removed.
Noted intentionally unchanged: the accountant Self Assessment dashboard uses red for "Needs My Action" (urgency) while the MTD workload uses green for the same bucket - left as-is to avoid touching SA screens.
Only frontend/src/components/StatCard.jsx, frontend/src/components/AppShell.jsx and frontend/src/pages/staff/AdminMtd.jsx modified. FUNCTIONAL LOGIC UNCHANGED: PASS.

## 2026-06 FINAL MTD end-to-end journey test (one disposable case, self-tested) — no defects, no code changes
Activation used the genuine post-payment path (_fulfil with kind SERVICE_ACTIVATION), which created client_service ACTIVE/MTD_ESSENTIAL and case MTD-2001 (2026/27) with Q1 6 Apr-5 Jul due 7 Aug, Q2 due 7 Nov, Q3 due 7 Feb, Q4 due 7 May and Final Declaration 6 Apr-5 Apr due 31 Jan 2028.
Journey verified: admin saw the new AWAITING_ASSIGNMENT case and assigned Amara Boateng (status ASSIGNED, owner ACCOUNTANT); assigned accountant saw the periods while Ben Carter got 403 on both periods and case; accountant requested a Q1 Bank statement (note + due date), the client saw it labelled Quarter 1 and uploaded against it (same request id, status Uploaded), the accountant then saw the uploaded file; accountant draft (90000/27000/net 63000 + est. tax 12500, NI 2300, set aside 14800, client note) stayed invisible to the client; admin review showed client, case ref, accountant, deadline, stage, owner, the full draft and the linked document; return for changes rejected a blank reason (400) then returned ownership to ACCOUNTANT with the reason; after correction admin released v1 (submission_reference still null) and the client saw only v1 (90000/25800/64200, est. tax 12800, published by Daniel Mensah) with no draft, version history, approval history or change reason; wrong-version approval 409, correct version approved -> "Ready for external submission" owned by ADMIN; accountant record-submission 403; Super Admin recorded MTD-J-001 (date, outcome Accepted, internal note) and the client then saw Submitted with reference and date only, no internal note; accountant workload showed 3 needs-my-action + 2 submitted with client/case/quarter/deadline/status/owner; admin+super admin stats showed 1 active MTD client, 1 case, 3 not started, 2 submitted, and the submitted bucket listed both references with dates and who recorded them; Final Declaration ran the same controlled chain (MTD-J-FD) and its final client copy published, owner download 200 / other client 403; other client 403 on periods and case, client 403 on activity, global MTD list and audit log; 18 audit rows with correct actor and role for every draft, review, return, release, approval, submission and final document; SA-1456 COMPLETED / SA-1428 AWAITING_CLIENT unchanged; operational views correctly excluded the test-marked client.
All disposable records deleted: case, 5 periods, documents, request, assignment, audit rows, notifications, client_service, payment transaction, client and user. 0 MTD periods and 0 MTD cases remain; helper script removed.

## 2026-06 Node.js handover specification lock (documentation only)
Created /app/memory/NODE_HANDOVER.md (reference spec of current implemented behaviour: hard statements, env/integrations, role matrix, SA states/transitions/guards, MTD Q1-Q4 + Final Declaration state machine and guards, activation/assignment/reassignment, documents and quarter requests, draft vs published versioning and client/staff visibility, auth/session/MFA, audit/notifications/deadlines/dashboards, payments/packages/recommendations, data model and indexes, test-data isolation, full API surface with roles/fields/guards/errors, frontend-to-API mapping, migration rule) and /app/memory/NODE_MIGRATION_CHECKLIST.md (18-section evidence-based parity checklist).
No application code changed. Ambiguities recorded in the handover: unscoped GET /documents is unused by the UI but returns unstamped legacy test-case documents to staff; no submitted-amendment route exists by design; client deadline reminders fire on portal visit only (no scheduler); email delivery not configured.

## 2026-06-24 — SA-only client MTD informational card
- Added read-only "Making Tax Digital" informational card on client dashboard (`ClientDashboard.jsx`, data-testid `mtd-informational-card`) shown only when the client has an SA case and no ACTIVE MTD_INCOME_TAX service (checked via GET /my-services).
- Informational only: creates no MTD case, no Q1-Q4/Final Declaration periods, no deadlines, no subscription, no charge. Replaced by the normal MTD nav/journey once MTD is ACTIVE. Recommendation/upgrade pathway untouched.
- No backend, workflow or SA/MTD logic changes. Node handover docs (§15.5) and migration checklist (§18) updated.
- Verified: card renders for clienta@example.com (SA-only, MTD NOT_ACTIVE); /api/cases still returns only SA-1456. Active-MTD suppression verified by source (no active MTD client exists). Nothing deployed.

## 2026-06-24 — Frontend↔Node.js integration map (documentation only)
- Created /app/memory/NODE_FRONTEND_API_MAP.md: every client/accountant/admin/super-admin route mapped to endpoints, methods, payloads, response fields, enums, permissions, workflow transitions, audit/notification effects and client-visible vs staff-only rules, plus a final FRONTEND COMPATIBILITY CONTRACT.
- Reference package for Node.js migration = source code + NODE_HANDOVER.md + NODE_MIGRATION_CHECKLIST.md + NODE_FRONTEND_API_MAP.md (frozen; do not alter the exported copy).
- No application code, workflow, testing or deployment changes.

## 2026-06-24 — Service-aware client navigation (MTD activation visibility)
- AppShell now reads both service states from GET /my-services: MTD nav appears automatically when MTD_INCOME_TAX is ACTIVE (no admin unlock); SA-only screens /my-return and /journey are hidden when SELF_ASSESSMENT is not ACTIVE. Shared areas (Documents, Messages, Tasks, Profile, My Services, Help, Settings, Report a Problem) remain common.
- ClientDashboard: MTD-only client (no SA case, MTD ACTIVE) now sees an "Open MTD for Income Tax" card (mtd-portal-card) instead of SA wording; SA-only informational MTD card unchanged.
- Files: frontend/src/components/AppShell.jsx, frontend/src/pages/client/ClientDashboard.jsx, memory/NODE_FRONTEND_API_MAP.md. No backend/workflow change. Verified SA-only client live; MTD-only and both-services verified by source (no MTD-active client exists). Nothing deployed.

## 2026-06-24 — LIVE service-combination routing verification
- Added scripts/qa_service_combos.py (temporary SA-only / MTD-only / SA+MTD clients; MTD activated via genuine paid SERVICE_ACTIVATION fulfilment, no manual unlock). Data removed after the run.
- Added frontend/src/components/ServiceGuard.jsx: /my-return and /journey require an ACTIVE SELF_ASSESSMENT service; /mtd requires an ACTIVE MTD_INCOME_TAX service; otherwise redirect to /dashboard. Wired in App.js.
- ClientDashboard subtitle no longer mentions Self Assessment for MTD-only clients.
- Live preview results: SA-only PASS, MTD-only PASS (no SA nav, no SA pages even by direct URL, Q1-Q4 + Final Declaration visible), SA+MTD PASS (both areas separate under one login). Admin manual unlock required: NO.

## 2026-06-24 — Central service activation (backend)
- Removed automatic SELF_ASSESSMENT=ACTIVE at registration: bootstrap_client_services now creates both SA and MTD rows as NOT_ACTIVE.
- New single source of truth activate_service(client, user, service_type, package_code, ...) in phase1b.py: activates/creates the client_service, creates/links the case (per-service reference allocator), ensures Q1-Q4 + Final Declaration for MTD, keeps the same client/user account, idempotent on replay.
- _fulfil SERVICE_ACTIVATION now delegates to activate_service (no duplicated activation logic); recommendation -> admin approval -> offer route preserved.
- Added POST /api/payments/service-checkout for direct client purchase of SA or MTD (no accountant offer needed); fulfilment uses the same central function. GET /api/my-services unchanged as the frontend source of truth.
- Targeted check (scripts/check_activation.py, self-cleaning): SA-only PASS, MTD-only PASS, second service same account PASS, no duplicates on replay PASS.
