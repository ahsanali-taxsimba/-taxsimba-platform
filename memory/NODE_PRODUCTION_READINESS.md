# Node backend production readiness

Scope: production-readiness work carried out on `nodejs-migration` after parity (124-step harness) and
browser UAT were signed off. Nothing here changes the frontend, the SA/MTD state machines, role
permissions, contact masking, document scoping or any request/response contract.

---

## 1. Transactional email

Implementation: `backend-node/src/services/email.ts`.

* Provider is chosen by `EMAIL_DRIVER`:
  * `none` (default) — nothing is queued, in-app notifications are unaffected.
  * `log` — logs the rendered message (development).
  * `smtp` — Nodemailer, using `SMTP_*`.
  * `resend` — Resend HTTP API, using `RESEND_API_KEY`.
* All credentials come from environment variables. No secret, host or key is committed.
* Email is a **secondary channel**. `notify()` writes the in-app notification first, then queues the
  message; the actual send is fire-and-forget and every provider error is swallowed and logged, so a
  slow, failing or unconfigured provider can never block or delay a workflow transition.
* Every existing `notify()` call site therefore gains email automatically, which covers the requested
  events: document requests, client action requests, calculation/figures ready, admin return/change
  requests, client approvals, payment and additional-work notices, submission/completion updates and
  service notices. Staff and client invitations are emailed explicitly from the invite routes
  (`emailInvitation`), in addition to the `setup_link` still returned in the API response.
* Deduplication: `email_messages.dedupe_key` is unique (`notification:<id>`, `invite:<id>`), so a retry
  or a duplicated event never produces a second email.
* Delivery: attempts are recorded on the row; failures back off `1, 5, 15, 60, 240` minutes up to
  `EMAIL_MAX_ATTEMPTS` (default 5) and are retried by `flushEmailQueue()`, which the reminder tick runs.
* Suppression: inactive users, addresses that look like test/QA data, and client notification
  preferences (`accountant_message`, `document_requested`, `calculation_ready`, `approval_required`,
  `submission_update`, `payment_update`) suppress **email only** — the in-app notification is always
  written.

## 2. Scheduled reminders

Implementation: `backend-node/src/jobs/reminders.ts`, started from `src/index.ts`.

* Disabled by default (`REMINDERS_ENABLED=false`); enable on exactly one instance.
* Tick interval `REMINDER_INTERVAL_MINUTES` (default 60). Covers: open client tasks, cases waiting on
  the client, cases awaiting client approval, MTD periods awaiting client approval, MTD periods due
  within `REMINDER_DEADLINE_DAYS`, and overdue MTD periods escalated to admins. It also flushes the
  email retry queue.
* Idempotency: every reminder has a deterministic key stored in `reminder_log`, with a unique index on
  `key`. A send is *claimed* with a single atomic update (or insert) before anything is delivered, so
  two instances ticking simultaneously cannot both send. A reminder repeats only after
  `REMINDER_REPEAT_DAYS` (default 3).
* Reminders only read operational records; `is_test` cases/users are excluded. No workflow state is
  changed by the worker — it only notifies.

## 3. Production environment checklist (names only)

| Group | Variables | Notes |
|---|---|---|
| Database | `MONGO_URL`, `DB_NAME` | Same database Python uses at cutover |
| Session | `JWT_SECRET` | **Reuse the existing value** or all live sessions are invalidated |
| MFA | `TOTP_FERNET_KEY`, `TOTP_ISSUER` | **Reuse the existing key.** A new key makes enrolled MFA secrets undecryptable |
| CORS/cookies | `CORS_ORIGINS`, `CORS_DEV_ORIGINS`, `COOKIE_SECURE=true`, `COOKIE_SAMESITE` | `CORS_ORIGINS` must include `https://taxsimba.co.uk` (not needed if same-origin proxy) |
| Proxy | `TRUSTED_PROXY_CIDRS` | Must be set; otherwise client-IP resolution rejects proxied requests |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Test keys in staging, live keys + a new webhook endpoint/secret in production |
| Storage | `STORAGE_DRIVER=s3`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `MAX_UPLOAD_MB` | Bucket private, no public ACLs |
| Email | `APP_BASE_URL`, `EMAIL_DRIVER`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_MAX_ATTEMPTS`, and either `SMTP_HOST`/`SMTP_PORT`/`SMTP_SECURE`/`SMTP_USER`/`SMTP_PASSWORD` or `RESEND_API_KEY` | `APP_BASE_URL` is used for invite links when there is no `Origin` header |
| Reminders | `REMINDERS_ENABLED`, `REMINDER_INTERVAL_MINUTES`, `REMINDER_REPEAT_DAYS`, `REMINDER_DEADLINE_DAYS` | Enable on one instance only |
| Rate limit | `API_RATE_LIMIT_PER_MINUTE` | |
| Seeding | `SEED_DEMO_DATA=false` | Mandatory in production — otherwise demo accounts are created |

Placeholders live in `backend-node/.env.example`. No real value is committed anywhere.

## 4. Document/storage migration (Emergent object store → S3)

1. Freeze nothing yet: with Python still live, run a full copy of every object from the Emergent store
   into the target bucket **with the object key byte-identical**. `documents.storage_path` is stored in
   Mongo and is used verbatim by the Node S3 adapter, so preserved keys mean no database rewrite.
2. Verify: for a sample across old and recent documents, `HEAD` each key in S3 and compare size against
   the source; then download a historical document through a staging Node instance pointed at the
   bucket (read-only credentials are enough for this check).
3. Re-sync incrementally immediately before cutover to pick up anything uploaded by Python in the
   meantime (same keys, overwrite-if-newer).
4. Bucket stays private; access only through the backend's signed/streamed download route, which keeps
   the existing per-role scope checks.
5. Rollback: Python continues to read the Emergent store, so a proxy rollback works for every file that
   existed before cutover. Files uploaded **while Node was live** exist only in S3 — before rolling
   back, copy objects created after the cutover timestamp back into the Emergent store (same keys).
   Keep the cutover timestamp recorded so this delta is unambiguous.
6. No production or customer file is used in any automated test; tests use the local storage adapter.

## 5. Database indexes

All indexes are created at startup by `startup()` in `src/app.ts`, and are now applied **independently
of seeding**:

* `ensureCoreIndexes()` (new) — unique `users.email`, unique `cases.case_ref`, unique `services.code`,
  `cases.id`. Previously these lived inside `seed()`, which is skipped when `SEED_DEMO_DATA=false`, so a
  production boot would have started without them. This was the one real production code gap found.
* `ensureLoginIndexes()` — login attempt/lockout, refresh tokens.
* `ensureMfaIndexes()` — used 2FA challenge replay protection.
* `ensureRateIndexes()` — API rate buckets (TTL).
* `ensureQueryIndexes()` — hot query paths for cases, documents, mtd_periods, tasks, messages,
  notifications, activity_logs, payment_transactions, clients, client_services, calculation_versions,
  document_requests, case_notes, recommendations, service_issues, faqs, invoices, packages, offers,
  pricing_audit, staff_invites, users.
* `ensureEmailIndexes()` — unique `email_messages.dedupe_key`, `(status, next_attempt_at)`.
* `ensureReminderIndexes()` — unique `reminder_log.key`.

Pre-cutover: take a Mongo backup, boot one Node instance against production **before** traffic is
switched so index builds complete, and confirm the unique indexes applied cleanly (a duplicate in live
data would otherwise surface as a warning in the boot log).

## 6. Frontend cutover

* No frontend code change is required. Everything goes through
  `const API = ${process.env.REACT_APP_BACKEND_URL}/api` plus `withCredentials`, and document/receipt
  links are built from the same variable.
* Preferred: keep `REACT_APP_BACKEND_URL=https://taxsimba.co.uk` and switch `/api/*` at the reverse
  proxy from the Python upstream to the Node upstream. Rollback is reverting that one rule; no rebuild.
* Cookies (`access_token`, `refresh_token`, readable `csrf_token`), the `X-CSRF-Token` double-submit
  header, refresh rotation on 401, CORS behaviour, status codes and the `{detail: …}` error envelope
  (including pydantic-shaped 422 arrays) are all identical to Python — verified by the parity harness
  and the browser UAT.
* Health check: `GET /api/` (returns `{"message": "TaxSimba API"}`, same as Python) through the proxy,
  plus one authenticated call such as `GET /api/cases` to prove Mongo — see §9 of
  `NODE_PRODUCTION_CUTOVER_PLAN.md`.

## 7. Dynamic pricing audit

| Question | Answer |
|---|---|
| Which prices can Super Admin change without code? | Every package in the `packages` collection: SA `SIMPLE`/`SMART`/`ELITE`, MTD `MTD_ESSENTIAL`/`MTD_PLUS`, and any package created later via `POST /api/packages`. `PATCH /api/packages/:id/price` and `PATCH /api/packages/:id` are SUPER_ADMIN-only. |
| Do edits survive a restart? | Yes — the seeded defaults use `$setOnInsert`, so boot never overwrites an edited price, name or flag. |
| Do existing customers keep their agreed price? | Yes. `client_services.agreed_price` is written once at activation and never re-read from the catalogue; re-activation preserves it. `/my-services` returns both `agreed_price` and `current_master_price` so a change is visible without applying it. |
| Do new customers get the latest price? | Yes — activation and checkout read the current package row. |
| Price history | Every price change writes an append-only `pricing_audit` row (`previous_price`, `new_price`, `effective_from`, `changed_by`, `role`, `created_at`), exposed read-only at `GET /api/packages/:id/price-history` to ADMIN/SUPER_ADMIN. Nothing deletes or rewrites it. |
| Billing type / frequency / VAT treatment | Editable fields on the master package (`billing_type`, `billing_frequency`, `vat_treatment`); the values recorded on an existing `client_services` row are not rewritten. |
| Effective date | **Stored and audited, not enforced.** `effective_from` is persisted on the package and on the audit row, but activation always reads the row's current `price`. There is no date-scheduled price engine: a future-dated change takes effect the moment it is saved. |

Nothing about historical pricing integrity was weakened; no pricing code path was modified in this
stage.

## 8. Content/wording audit (nothing changed)

Database/config driven today:

* Package `name`, `price`, `rank`, `billing_type`, `billing_frequency`, `vat_treatment`, `is_active` —
  editable by Super Admin; the frontend renders `package_name` / `current_package.name` from the API.
  There is **no package description/feature field** in either backend, so package marketing copy does
  not exist as data.
* Help Centre: 12 seeded FAQs (`src/domain/helpcentre.ts`) plus categories, fully CRUD-able by
  ADMIN/SUPER_ADMIN at `/api/faqs`. This is the only genuinely editable client-facing copy today.
* Staff-authored per-case text: document request titles/notes, task titles and descriptions, messages,
  case notes, return-for-changes reasons and instructions, additional-work descriptions, service-issue
  text, submission references. All stored and rendered verbatim.
* Package-change lock statuses (`settings.package_change_lock`) and client notification preferences.

Hard-coded (unchanged):

* React: headings, buttons, labels, helper text, empty states and toasts across all 24 page/component
  files — e.g. the client status pages in `frontend/src/pages/client/ClientPages.jsx`, service and
  upgrade wording in `MyServices.jsx`, staff workspace labels in `CaseWorkspace.jsx`.
* Node/Python backend wording: `STATUS_META` and `CLIENT_STATUS_LABELS` in
  `backend-node/src/domain/workflow.ts`, the titles/bodies of the ~46 `notify()` call sites, receipt and
  invoice text, and ~147 `httpError(...)` messages across the route modules (all matching Python
  verbatim, which is what parity is measured against).

So: package text is dynamic (name/price/billing only); client-facing wording overall is **not** fully
dynamic.

## 9. Future "Content & Pricing Settings" for Super Admin

Assessment: **safe to add later, as a thin layer over what already exists** — not implemented now.

* Already possible with zero new risk: package price/name/billing/VAT/active, FAQ content, package
  change-lock statuses. These are all DB-backed, SUPER_ADMIN-gated and audited.
* Would need new storage: a small `content_strings` collection keyed by a stable ID with a code default
  fallback, used only for client-facing marketing/instruction copy. Renderers keep the hard-coded string
  as the default so a missing/rolled-back override can never blank a screen.
* Must stay out of scope for such an area: security and authentication messages, workflow/state names
  and transitions, API field names, audit/pricing history, historical `agreed_price` values, permission
  rules, and any status label the state machine keys on. Enforce with an allow-list of editable keys
  server-side, not by hiding controls in the UI.
* Every edit should write an audit row in the same style as `pricing_audit`.

## 10. Verification for this stage

Targeted, on disposable Mongo only, no production data:

* `tests/integration/email.test.ts` — 11 tests (email dispatch, dedupe, provider failure leaving the
  in-app notification intact, retry/backoff, preferences, invitations, test-address suppression,
  reminder dedupe/repeat/escalation, test-case exclusion).
* Full Node suite: 140 tests.
* `npm run typecheck`, `npm run lint`, `npm run build`.
* Python-vs-Node parity harness rerun: 124 steps, 0 status mismatches, 0 shape diffs, with the one
  approved B4 document-scoping difference.
