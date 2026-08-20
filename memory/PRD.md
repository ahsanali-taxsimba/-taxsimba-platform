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

## Known gaps / not built
- MTD quarterly operational workflow, HMRC API, Xero, SimbaX (deliberately deferred).
- CORS is `*`; no login brute-force lockout; no outbound email.
- `server.py` + `phase1b.py` are large and would benefit from being split into routers.

## Backlog
- P1: production hardening (explicit CORS origins, login rate limiting/lockout)
- P1: Resend email notifications mirroring in-app triggers; deadline-approaching / overdue scheduler
- P2: submission-issue handling flow; message attachments; TaxSimba Support as a separate message thread
- P2: split `server.py`/`phase1b.py` into routers
- Phase 2: MTD quarterly compliance workflow on the same operational core
