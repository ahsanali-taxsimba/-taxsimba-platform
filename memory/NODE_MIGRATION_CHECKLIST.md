# Node.js Migration Acceptance Checklist

Reference: `/app/memory/NODE_HANDOVER.md`. Every item must be **proved by request/response evidence** against the Node backend using the same accounts and the same request bodies. Mark PASS only with the observed status code and payload. Any deviation from the Python reference is a failure, not an improvement.

Setup: seed 4 roles (client, second client, assigned accountant, unassigned accountant, admin, super admin) and one disposable MTD case + one SA case. Never bulk-generate data.

## 1. API parity
- [ ] Every route in handover §13 exists at the same path with the same HTTP method and `/api` prefix.
- [ ] No extra, renamed or merged routes; no route dropped.
- [ ] Field names in requests and responses match exactly (snake_case preserved).
- [ ] Error semantics match: 400 guard/validation, 401 unauthenticated, 403 role/ownership, 404 unknown id, 409 version conflict, 429 rate limited.
- [ ] No response ever contains a Mongo `_id` or a raw ObjectId.
- [ ] Datetimes are UTC ISO strings.

## 2. Role / permission parity
- [ ] Permission matrix (§2) reproduced cell by cell.
- [ ] Unassigned accountant: 403 on case, periods, figures, preview, requests.
- [ ] Other client: 403 on case, periods, year-summary, document download.
- [ ] Client: 403 on `/cases/{id}/activity`, `/audit-log`, `/users`, `/mtd/periods`, `/mtd/stats`, `/mtd/my-workload`.
- [ ] Accountant: 403 on `/mtd/periods`, `/mtd/stats`, `/audit-log`, `/users`, `admin-approve`, `request-changes`, `reopen`, `record-submission`.
- [ ] Admin vs Super Admin split preserved (contact reveal is Super Admin only and audited).

## 3. SA workflow parity (must be unchanged)
- [ ] Full chain assign → prepare → request-from-client → admin review → admin approve/return (reason mandatory) → client approve → record submission → complete.
- [ ] Completed case: `record-submission` 400, additional-work payment request 400.
- [ ] Completed case returns `has_submission_record = true` and the client journey shows the submission step complete.
- [ ] Reopen records a reason; `reopen-history` is derived from the activity log, not a second table.
- [ ] Calculation versions append, never overwrite.

## 4. MTD workflow parity (Q1–Q4 + Final Declaration)
- [ ] Activation generates exactly 5 periods with the §4 dates and deadlines (7 Aug / 7 Nov / 7 Feb / 7 May / 31 Jan) and is idempotent.
- [ ] State machine and both label sets (client vs staff) match, with correct `next_action_owner`.
- [ ] Figures locked in ADMIN_REVIEW / AWAITING_CLIENT_APPROVAL / APPROVED / SUBMITTED (400).
- [ ] `submit-for-review` requires a draft; `admin-approve` requires ADMIN_REVIEW.
- [ ] `request-changes` blank reason 400; with reason ownership returns to accountant and clears on next draft save.
- [ ] Publishing does **not** set a submission reference and does **not** change the case status.
- [ ] Final Declaration behaves identically to a quarter and gates the MTD final client document.

## 5. Database / model parity
- [ ] Same collections, field names and relationships (§11).
- [ ] UUID `id` on every document; `case_ref` unique with collision retry.
- [ ] One `mtd_periods` row per (case_id, kind, quarter).
- [ ] Startup indexes present on the same hot fields.
- [ ] `is_test` inherited by child records at creation.

## 6. Document security
- [ ] Client sees only own, non-internal documents; internal download 403; cross-client download 403; owner 200.
- [ ] Quarter request creates a `document_requests` row + placeholder document with `mtd_period_id`/label and does not transition the case.
- [ ] Client upload with `document_id` fulfils that request (same id, status Uploaded, correct period).
- [ ] Uploads validate MIME, size and content; bytes in object storage, metadata in Mongo.
- [ ] Final documents append a new `final_version` and never overwrite; complete/reopen never hides them.

## 7. Financial version history
- [ ] Draft fields are staff-only and never appear in a client payload.
- [ ] Each publish appends an immutable snapshot with version, publisher and timestamp.
- [ ] Republish preserves the earlier version verbatim; client sees only the latest.
- [ ] Net profit = income − expenses unless explicitly overridden. **No tax or NI is ever computed.**
- [ ] Disclaimer text byte-identical.
- [ ] Year summary sums published quarters only; a draft never moves the totals.

## 8. Client approval / version locking
- [ ] `client-approve` with a mismatched version → **409**.
- [ ] Correct version → APPROVED with `approved_version` and `approved_snapshot` stored.
- [ ] A newly published version clears the previous approval and requires fresh approval.
- [ ] Only the owning client can approve (others 403); staff cannot approve on the client's behalf.

## 9. Approved-period reopen
- [ ] ADMIN and SUPER_ADMIN can reopen an APPROVED, unsubmitted period; accountant and client 403.
- [ ] Blank reason 400.
- [ ] Previous version stamped superseded (at/reason/by) with the original client approval retained; `approval_history` appended.
- [ ] Active approval cleared; corrected figures need a fresh release and fresh approval.
- [ ] A SUBMITTED period cannot be reopened (400) — no submitted-amendment route exists yet.

## 10. Manual submission permissions
- [ ] Only ADMIN and SUPER_ADMIN can record; accountant and client 403 — for every quarter **and** the Final Declaration.
- [ ] Requires APPROVED (400 otherwise); reference and date mandatory (400).
- [ ] Duplicate submission 400 with the original record untouched.
- [ ] Provider, outcome and note stored; the internal note is never returned to a client.
- [ ] No HMRC call of any kind is made.

## 11. Reassignment behaviour
- [ ] Reassignment changes ownership only: period statuses, drafts, published versions, client approvals, submission references, documents, requests, deadlines and audit history all byte-identical before and after.
- [ ] New accountant's workload gains the work, previous accountant's loses it.
- [ ] Reassignment audited with from/to names.

## 12. Audit history
- [ ] Every action in §9 writes one activity row with actor id, name, role and timestamp.
- [ ] Return-for-changes and reopen store the reason in `comments`.
- [ ] MTD rows carry `meta.mtd_period_id` and `meta.service = "MTD"`.
- [ ] Activity log is staff-only.

## 13. Notifications
- [ ] Same events, same recipients, same types and routes.
- [ ] Duplicate unread notifications collapse — no repeated spam.
- [ ] One idempotent client reminder when an approval is outstanding within 14 days.
- [ ] **No email is sent** (no provider configured).

## 14. Payments / services / upgrades
- [ ] `_fulfil` equivalent is idempotent: replayed webhook or status poll never double-activates, double-charges or double-receipts.
- [ ] SERVICE_ACTIVATION creates the active service, the case and the MTD schedule; UPGRADE mutates the package and appends package history.
- [ ] One confirmed payment ⇒ exactly one immutable receipt plus one audit entry.
- [ ] Accountant can only recommend; admin approves, sends offers and raises payment requests.
- [ ] Additional-work charge blocked on completed cases (400).
- [ ] Stripe stays in test mode until go-live.

## 15. Deadlines / tasks / workload
- [ ] Deadline warnings OVERDUE / DUE_3 / DUE_7 / DUE_14 with `days_to_deadline`, suppressed once submitted.
- [ ] MTD buckets (incl. `waiting_for_client` from outstanding requests, and `final_declaration`) return the same rows.
- [ ] `/mtd/stats` counts match, including `final_declarations`.
- [ ] SA and MTD counters remain separate.

## 16. Test-data isolation
- [ ] `OPERATIONAL_ONLY` default filter applied to the same endpoints; `include_test=true` opts in.
- [ ] A test-marked client never appears in operational lists, stats or workloads.
- [ ] Recommendations exclude test rows by default.

## 17. Frontend compatibility
- [ ] The existing React frontend runs unmodified against the Node backend (no field renames, no route changes).
- [ ] Every screen listed in handover §14 loads with data.
- [ ] Refresh-on-401 and the authenticated blob download still work (no raw protected hrefs).
- [ ] Mobile: no horizontal scrolling; cards stack; actions reachable.

## 18. Locked migration decisions (handover §15)
Document scoping:
- [ ] No endpoint returns documents without a case / client / MTD period / explicitly authorised operational scope.
- [ ] Request without a scope parameter is rejected (400) rather than returning all documents.
- [ ] Cross-client document access returns 403; staff-only documents never returned to a client.
- [ ] Test/QA documents absent from every operational document query by default.

Submitted MTD periods:
- [ ] Reopen of a SUBMITTED quarter or Final Declaration returns 400.
- [ ] Figure edit / re-approval / re-submission of a SUBMITTED period rejected.
- [ ] No amendment endpoint exists (Phase 2 only).

Deadline reminders:
- [ ] Reminders are produced by a scheduler/background worker process.
- [ ] Reminders fire with no user session active and no portal page open.
- [ ] Deadline thresholds/dates identical to the Python reference.

Transactional email:
- [ ] Email dispatch layer exists alongside in-app notifications for invitations, document requests, approvals, deadline reminders, payment/service notices, completion notices.
- [ ] All provider credentials/config read from deployment environment variables; none hard-coded or committed.
- [ ] In-app notifications still work if email dispatch is unconfigured or fails.

SA-only client MTD informational state:
- [ ] SA client with no ACTIVE MTD service sees the informational "Making Tax Digital" card.
- [ ] No MTD case, periods, deadlines, subscription or charge are created by viewing it.
- [ ] Card disappears and the normal MTD journey shows once an MTD service is ACTIVE.
- [ ] Accountant recommendation/upgrade pathway unchanged.

MTD document request tasks:
- [ ] Requesting a document for an MTD period creates one CLIENT task carrying `mtd_period_id`.
- [ ] Repeating the same open request creates no second task, request or placeholder.
- [ ] Client upload against the placeholder closes the task and marks the request `Uploaded`.
- [ ] The request appears in `GET /my-actions` for the client.

## 19. Final gates
- [ ] Self Assessment behaviour demonstrably unchanged.
- [ ] MTD Q1–Q4 + Final Declaration behaviour demonstrably unchanged.
- [ ] No HMRC API/OAuth introduced.
- [ ] No automatic tax calculation introduced.
- [ ] All business rules enforced server-side (verified by calling the API directly, not through the UI).
- [ ] All QA/disposable records removed after each proof run.

## 20. Frontend compatibility contract (see `NODE_FRONTEND_API_MAP.md` §14)
- [ ] Every API path, method, query/body field name and response field name matches the map exactly.
- [ ] All SA/MTD/document/service/payment-request enums returned verbatim.
- [ ] Every screen in the map loads with data using the unmodified React frontend.

**Sign-off:** every box ticked with evidence = behavioural parity achieved. Only then may simplification or redesign be proposed, and only with separate approval.
