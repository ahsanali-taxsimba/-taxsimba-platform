# TaxSimba — Product Requirements & Build Log

## Original problem statement (verbatim scope)
Build **Phase 1 only** of TaxSimba: an accountant-led UK Self Assessment tax preparation platform.
Explicitly out of scope: MTD, Xero, SimbaX, public website redesign, fake HMRC functionality, any unrequested feature.

Operating model: Client purchases Self Assessment → Admin receives & assigns → Accountant reviews, requests info, prepares calculation → Admin performs final internal review → Client receives the ADMIN-APPROVED calculation and approves → case becomes Ready for Submission. One connected database and workflow, no disconnected per-role systems.

## Architecture
- **Backend** (FastAPI + MongoDB, all routes under `/api`):
  - `server.py` — all routes (auth, cases, tasks, documents, messages, notes, activity, reviews, notifications, stats, users, services, workflow settings, audit log)
  - `workflow.py` — the single controlled workflow engine: 18 statuses, `STATUS_META` maps status → stage / next action / next action owner; `transition()` is the only way a status changes and always updates the case, writes an Activity Log entry and (where relevant) notifications; `journey()` derives the client-facing 5-step journey from status
  - `auth.py` — bcrypt + JWT, `require_roles()` RBAC; `db.py`; `storage.py` (Emergent object storage); `seed.py` (demo users, accountant profiles, clients, Self Assessment service, 2 cases)
- **Frontend** (React + Tailwind, role-based shell): `AppShell` (role nav + notification bell), client pages (Dashboard, My Tax Return, Documents, Messages, Tasks, Your Tax Journey, Profile, Subscription, Help Centre, Settings), Accountant dashboard, Admin dashboard/cases/accountants, shared staff `CaseWorkspace` (7 tabs + all workflow modals), Super Admin.
- **Data entities**: User, Client, Accountant Profile, Service, Case, Assignment, Task, Document, Document Request, Message, Internal Note, Notification, Review, Calculation Version, Client Approval, Submission Record, Activity Log. `service_type` is a field on Case (`SELF_ASSESSMENT`) so MTD can be added later without rebuilding.

## Roles / personas
- **CLIENT** — sees only their own case, tasks, documents, messages and *admin-approved* calculations.
- **ACCOUNTANT** — sees only cases assigned to them; full workspace incl. internal notes and tax working.
- **ADMIN** — all operational cases, assignment centre, internal review (approve / return for changes).
- **SUPER ADMIN** — everything plus users, roles, services, workflow settings, audit log.

## Implemented (2026-06)
- JWT email/password auth with RBAC, seeded demo accounts, deactivated accounts rejected at login
- Controlled workflow engine (18 statuses) — every transition updates case, stage, next action, owner, activity log, notifications
- Client dashboard with a single intelligent action card, auto-derived Tax Journey, tasks, document centre (6 statuses, 4 filters), case-linked messaging
- Admin dashboard with 8 clickable stat cards, full case table with filters + search, Assignment Centre showing live accountant workload/capacity
- Accountant dashboard (own workload only) with 7 cards + 6 tabs, and case workspace with stage-conditional actions
- Request-from-Client automation (task + document request + notification + AWAITING_CLIENT), auto-return to accountant queue when client responds
- Tax working area: immutable calculation versions, version + review history, internal notes, internal working documents (client-invisible)
- Submit-for-Admin-Review with mandatory 7-item checklist and version locking; Admin approve / return-for-changes with reason + instructions
- Client final review of the approved version and client approval → CLIENT_APPROVED → READY_FOR_SUBMISSION + Submission Record
- Activity timeline per case, notification bell, Super Admin screens (Users, Accountants, Admins, Roles, Services, Workflow Settings, Audit Log)
- Real file uploads via Emergent object storage; downloads gated by role

## Verified
25-step Phase 1 success test passes end-to-end (API + UI). Role isolation verified: Accountant B cannot see or open Accountant A's cases (403); client cannot read internal notes (403) or unapproved calculation versions.

## Not built in Phase 1 (deferred, by design / noted to user)
- HMRC submission (workflow deliberately stops at READY_FOR_SUBMISSION — no fake HMRC)
- Stripe checkout for purchasing the service (user selected it; deferred as it is not part of the Phase 1 spec sections)
- Email notifications via Resend (user selected it; in-app notifications only in Phase 1)
- MTD, Xero, SimbaX

## Backlog
- P0: submission workflow (SUBMISSION_IN_PROGRESS → SUBMITTED → COMPLETED) with submission records and issue handling
- P1: Stripe checkout for Self Assessment purchase; Resend email notifications mirroring in-app triggers; deadline-approaching / overdue notification scheduler
- P1: message attachments; TaxSimba Support as a distinct message thread
- P2: brute-force lockout + password reset; explicit CORS origins; split `server.py` into routers
- P2 (Phase 2+): MTD service type, Xero integration, SimbaX
