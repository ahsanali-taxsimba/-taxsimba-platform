# Node.js/TypeScript migration — final status

Branch: `nodejs-migration` (PR #1). `main` is untouched and remains the frozen Python
reference. Nothing has been deployed and no production data or operational database was used.

Scope covered: stages 0–6 (runtime/auth/security, cases + Self Assessment workflow,
tasks/documents/collaboration/notifications, MTD periods and submissions, packages/pricing/
payments/recommendations, admin/users/audit/help centre/invites/profile) plus a
Python-vs-Node parity harness and a browser UAT of the unchanged React frontend against Node.

## 1. Automated verification

| Check | Result |
| --- | --- |
| Node test suite (`npm test`, disposable Mongo) | 129 passed |
| Typecheck / ESLint / build | clean |
| Python-vs-Node parity harness | **124 steps compared, 0 status mismatches, 0 response-shape mismatches**, 1 intentional documented difference |

The harness (`parity/`) boots the frozen Python backend on :8001 and Node on :8002, each
against its own disposable database, replays the same journey through both with a real cookie
jar and CSRF/origin headers, and diffs status codes plus normalised response shapes. Run it with
`parity/run-parity.sh`; it writes `parity/PARITY_REPORT.md` and per-backend JSON run artifacts
(git-ignored because they contain per-run identifiers, not because they are secret).

Coverage: authentication and lockout, RBAC refusals for every role pair, user administration,
Self Assessment case lifecycle (assign → review → calculation → checklist → return → resubmit →
approve → client approve → record submission → complete → reopen), MTD periods Q1–Q4 and Final
Declaration (figures → publish → request changes → revision → approve → client approve → stale
version 409 → external and prior submissions → year summary), documents and tasks, packages and
services, payment requests and receipts, help centre, invites, profile and security.

## 2. Browser UAT (unchanged React frontend against Node only)

Environment: unchanged CRA frontend on :3000 with a temporary, uncommitted
`REACT_APP_BACKEND_URL=http://localhost:8002`; `backend-node` on :8002; disposable Mongo database
`taxsimba_uat_1787754251`; local file storage. Python was not running. No frontend or backend
source was modified for the run and the temporary config was removed afterwards.

**23 checks passed, 2 intentionally untested.**

Passed:

1. Client login
2. SA client dashboard, journey and case surfaces
3. Assignment, reassignment and reassignment back (both recorded in activity)
4. Document request → client task appears
5. Client upload → task completion
6. Staff view / open / download of the uploaded document
7. Accountant calculation, checklist and submit for admin review
8. Admin return for changes, with reason and instructions shown verbatim to the accountant
9. Accountant resubmission (version 2)
10. Admin approval
11. Client approval
12. Manual external SA submission recorded (reference `HMRC-UAT-001`) and visible to the client
13. SA completion, reopen, and the reopen-history panel
14. MTD dashboard: Quarters 1–4 and Final Declaration
15. MTD figures saved and published
16. MTD admin request changes → accountant revision → approve/publish (version 2)
17. MTD client approval
18. MTD external/prior submission (reference `MTD-UAT-Q1`) and year summary totals
19. Super-admin overview, users and audit log including filtered search
20. Staff invite → invite link → password set → new accountant logs in at `/work`
21. RBAC redirects: accountant off `/admin`, admin off `/super`; staff-only actions hidden
22. Package/service entitlement visibility and additional-work request visibility
23. User-facing error handling: 401 invalid credentials, 409 MTD stale version, 422 validation —
    all rendered as readable sentences, no `[object Object]` and no blank messages

Intentionally untested:

1. **Hosted Stripe checkout completion** — no Stripe test secret was configured in the UAT
   environment, so clicking Pay returned `STRIPE_SECRET_KEY is not configured` (HTTP 500). The
   frozen Python backend fails the same way when unconfigured. This is a staging configuration
   requirement, not a Node defect; no Node code was changed for it.
2. **Super-admin contact masking / reveal-with-reason** — the current frontend exposes no control
   for it (the only masking reference in the frontend source is `utr_masked`). The Node API
   implements masking, the mandatory reveal reason and the access log identically to Python, and
   both are covered by the parity harness and the admin test suite.

Also verified in the browser: **no screen makes an unscoped `GET /api/documents` call.** Every
admin-session request carried `case_id`; super-admin screens issue none; client and accountant
screens send only `service_type`, which the backend scopes by ownership. The browser console was
clean apart from the React DevTools notice.

## 3. Approved B4 document-scoping difference

The single deliberate behavioural difference from Python (harness step 121):

| Request | Python | Node |
| --- | --- | --- |
| `GET /api/documents` with no scope (staff) | 200 with every document in the database | 400 `A case, client or period must be specified to list documents` |

Document reads must be scoped by case, client or MTD period, test/QA documents are excluded from
operational retrieval, and downloads are scope-checked per role. This is the security correction
already identified in the handover, enforced server-side, and confirmed above to break no screen.

## 4. Staging configuration requirements

All configuration is environment-variable based; nothing below exists in the repository.

- `MONGO_URL`, `DB_NAME` — staging database (never the operational Emergent database)
- `JWT_SECRET`
- `TOTP_FERNET_KEY` — **must be the existing production key** if enrolled staff MFA secrets are to
  remain decryptable; rotating it requires a separate re-enrolment procedure
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — **test mode**; required before hosted checkout can
  be validated
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
  `S3_FORCE_PATH_STYLE` with `STORAGE_DRIVER=s3`
- `CORS_ORIGINS`, `TRUSTED_PROXY_CIDRS` (must be set for the deployment's proxy or requests fail),
  `COOKIE_SECURE`, `COOKIE_SAMESITE`
- Stripe Tax head-office configuration is provider-side account setup and is not re-applied at boot
  by Node

See `backend-node/.env.example` for the full placeholder list.

## 5. Deferred production items

- Transactional email — no working Python implementation exists; deliberately not invented
- Scheduled reminder worker — same
- No CI is configured in this repository; tests, typecheck, lint and build are run manually

## 6. Frontend unchanged

The branch diff against `main` touches only `backend-node/`, `parity/`, `memory/` and six lines of
`.gitignore`. No frontend route, label, action button, API path, request body or response field was
changed, and no Python backend file was modified.

## 7. Secrets and test data

No secrets, credentials or connection strings are committed; `backend-node/.env.example` contains
placeholders only. Automated tests create a throwaway `taxsimba_test_<uuid>` database per run and
drop it afterwards; the parity harness uses `taxsimba_parity_py_*` / `taxsimba_parity_node_*`; the
browser UAT used `taxsimba_uat_1787754251`. No fixture data or database dump is committed.
