# Python vs Node parity harness

Runs the same scripted journeys against the frozen Python backend and the Node backend and
compares status codes and response shapes.

```bash
./parity/run-parity.sh
```

The script starts Python on `:8001` and Node on `:8002`, each against its own disposable
`taxsimba_parity_*` database, runs `harness.mjs`, then drops both databases and stops both
servers. It never touches production data or the operational database. It refuses to start if
either port is already serving.

Artifacts (git-ignored): `PARITY_REPORT.md`, `python-run.json`, `node-run.json`, `python.log`,
`node.log`.

## Coverage

`journeys.mjs` drives 124 steps as browser-like cookie sessions (CSRF headers included) for six
actors — super admin, admin, accountant, demo client, a newly created client and an invited staff
member:

- role/security: unauthenticated access, wrong password, cross-role refusals on the user
  directory, audit log, admin stats, overview, FAQ authoring, contact reveal and user creation
- Self Assessment: case creation and validation failures, assignment, review start, client
  requests and task completion, calculations, checklist enforcement, admin return and rework,
  admin approval, client approval, external submission, idempotent replay, completion, reopen,
  activity/reviews/reopen history
- MTD: case creation, five-period schedule, negative-figure and client-entry refusals, drafts,
  preview, review, request changes, republish, stale-version 409, client approval, reopen, year
  summary, oversight buckets, stats, workload, prior submissions
- admin/help centre/onboarding: users and masking, contact reveal plus access log, FAQ CRUD,
  audit filtering, staff invitations (issue, inspect, accept, single use), profile, security,
  data requests, service issues, document scoping

Volatile values (ids, tokens, timestamps, references, invite links) are normalised before
comparison, and a run is rejected if fewer than half the steps return 200 — that guards against a
false "parity" where both backends merely reject everything.

## Documented intentional differences

| Area | Python | Node | Why |
| ---- | ------ | ---- | --- |
| `GET /api/documents` without a scope | 200, every document in the database | 400 | Decision B4: document reads must be scoped by case, client or period; test-data documents stay out of operational listings |
| Transactional email | not implemented | not implemented | Deferred to the production-readiness stage |
| Scheduled reminder worker | not implemented | not implemented | Deferred to the production-readiness stage |
| Stripe Tax head-office write on boot | performed at startup | not performed | Provider-side account configuration, not application behaviour |
| Object storage | Emergent integrations proxy | S3-compatible adapter (local driver for tests) | Decision B1 |

The harness treats the first row as an approved deviation; every other step must match exactly.
