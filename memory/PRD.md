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
