# Task 7 — Notifications + MTD reminders / overdue escalation (J-007, J-008, J-009)

**Status:** LOCAL PASS — MAILPIT  
**External inbox / staging:** BLOCKED  
**Branch:** `cursor/toxsl-blockers-b01-b04-80a7`  
**Tested tip (full SHA):** `8ff8211d0b0bb85d004a78bde90a8153ecb9dbd3`  
**Fix commit:** `630fe6a577eafc274d7b69d9fa3abd7397a48fb2`  
**J-011:** remains **UNVERIFIED** (Task 5; not reopened)  
**Final Toxel handoff SHA:** deferred  
**Evidence ZIP:** `/opt/cursor/artifacts/task7_notifications_reminders_evidence.zip` (not in git)  
**Agreed behaviour preserved:** **no new client overdue email**

## Acceptance criteria (source)

Original UAT pack rows for J-007/J-008/J-009 were not present as discrete pack IDs in-repo. Criteria taken from the Task 7 prompt plus handover **§15.8** (`memory/NODE_HANDOVER.md`):

| ID | Acceptance criteria |
|---|---|
| **J-007** | Notification content can be opened on client/admin dashboards; title + body visible; link reaches the correct case/service; read status persists after refresh/re-login |
| **J-008** | Eligible reminders for each original UAT state — **open task**, **awaiting information** (`AWAITING_CLIENT`), **awaiting approval** (`AWAITING_CLIENT_APPROVAL` / MTD approval) — plus deadline-window records due; isolation; duplicate prevention; suppression when the relevant task/docs are completed |
| **J-009** | When an MTD period deadline has passed with a **Requested** document still outstanding and period `NOT_STARTED`/`IN_PROGRESS`, **Admin and Super Admin** receive overdue escalation (in-app + email) into `overdue_waiting_client`; no client overdue email (§15.8) |

## Reproduction / root cause

| Item | Detail |
|---|---|
| J-007 | Compat notifications lacked mirrored `link`/`url`; MTD client notifications did not surface title/body/click; admin notifications only read `url` |
| J-008 | Reminder job path needed controlled-date seed + dashboard verification that deadline/task reminders fire |
| J-009 | Overdue escalation must require Requested docs (§15.8); admin lacked MTD Operations page for `overdue_waiting_client` bucket |
| Fixes | Mirror `link`↔`url` in compat; gate overdue escalation on Requested docs; MTD Notifications click+content; admin notifications `url\|link` + UUID→manage-tax; new `/admin/mtd` Operations page |

## Controlled seed

| Field | Value |
|---|---|
| Client | `t7.mtd.1791247928362@example.com` |
| Case | `MTD-2007` / `7eaa7f77-5d12-4390-ac7f-8669a45ba0b8` |
| Approaching deadline | `2026-10-11` (within 14-day reminder window) |
| Overdue deadline | `2026-10-01` + Requested doc on Q2 |
| Task | `Action needed: Upload bank statements (T7)` |

## Automatic reminder scheduler (wired)

| Item | Detail |
|---|---|
| Wired | **Yes** — `backend-node/src/index.ts` calls `startReminderWorker()` on API boot |
| Implementation | `backend-node/src/jobs/reminders.ts` (`runReminders` / `startReminderWorker`) |
| Enable flag | `REMINDERS_ENABLED=true` (default **false**) |
| Schedule | `REMINDER_INTERVAL_MINUTES` (default **60**); first tick immediately on start, then `setInterval` |
| Repeat gap | `REMINDER_REPEAT_DAYS` (default **3**) via atomic `reminder_log` claim |
| Deadline window | `REMINDER_DEADLINE_DAYS` (default **14**) |
| Timezone | **No dedicated TZ env.** Deadline day math uses **UTC midnight** (`YYYY-MM-DD` + `T00:00:00Z` in `daysUntil`). Process clock is host/UTC as deployed. |
| Deployment | Enable on **exactly one** instance (`START_HERE_TOXEL.md`, `NODE_PRODUCTION_READINESS.md` §2, staging example leaves `REMINDERS_ENABLED=false`) |
| Automatic staging execution | **BLOCKED** — not tested on staging |
| Evidence | `api/scheduler_wiring.json` |

Handover §15.3 requires a backend scheduler (not browser-driven); this in-process worker satisfies that architecture.

## UAT checklist

| ID | Criterion | Local | Staging | Evidence references |
|---|---|---|---|---|
| **J-007** | Notification content opens; correct link; read persists | **PASS** | BLOCKED | Before empty list `before/client_notifications.json`. After list `after/01_client_notifications.png` + `after/01_client_notifications_text.json`. Open→`/mtd-dashboard` `after/02_client_notification_opened_nav.png` + `after/02_open_nav.json`. Re-login read `after/03_client_notifications_after_relogin.png` + `after/03_read_persistence.json` (`any_read_persisted: true`). **Specific clicked ID** `d7a56591-e360-4cc7-81ee-68b4f9ff31bc` remains `read: true` after logout/login — `after/03b_specific_notification_id_read_persistence.json` (`pass: true`; tip `3a1c607…`). Admin open→`/admin/mtd?bucket=overdue_waiting_client` `after/05_admin_escalation_opened.png` + `after/05_admin_escalation_nav.json` |
| **J-008** | Open task + awaiting information + awaiting approval (+ deadline due); isolation; dup; suppress | **PASS** (Mailpit / controlled local) | **BLOCKED** (automatic scheduler) | **States:** `api/j008_uat_states_verification.json` — open task / awaiting information / awaiting approval all `local: PASS` (titles hit). Prior pack also: `api/reminder_run.json` open task + `mtd_records_due`; UI `after/03_read_persistence.json`; isolation `api/isolation.json`; dup `api/reminder_run_duplicate.json`; suppress `api/reminder_run_after_suppress.json`; Mailpit `mailpit/t7_related_messages.json`. Vitest: open task + `AWAITING_CLIENT_APPROVAL` + MTD approval in `tests/integration/email.test.ts` |
| **J-009** | Overdue escalation to **Admin + Super Admin** (§15.8); no client overdue email | **PASS** (Mailpit local) | **BLOCKED** | Recipients: `api/j009_recipient_rules.json` (`super_admin_should_receive: true`). Code: `role: { $in: ['ADMIN','SUPER_ADMIN'] }`. Run: `api/reminder_run.json` (`mtd_overdue_escalation:2`). Mailpit to `admin@taxsimba.co.uk` **and** `superadmin@taxsimba.co.uk`. Bucket **MTD-2007** `after/06_admin_mtd_overdue_bucket.png`. `mailpit/summary.json` `client_overdue_emails:0` |

### J-008 original UAT states (detail)

| UAT state | Code path | Counter | Local |
|---|---|---|---|
| Open task | `remindOpenClientTasks` (`tasks.status=OPEN`) | `client_task` | **PASS** — `api/j008_uat_states_verification.json` + T7 `api/reminder_run.json` + vitest |
| Awaiting information | `remindClientCaseActions` (`cases.status=AWAITING_CLIENT`) title *We're waiting for information from you* | `client_case_action` | **PASS** — `api/j008_uat_states_verification.json` |
| Awaiting approval | `remindClientCaseActions` (`AWAITING_CLIENT_APPROVAL`) and/or `remindMtdPeriods` MTD approval | `client_case_action` / `mtd_client_approval` | **PASS** — `api/j008_uat_states_verification.json` + vitest (SA + MTD approval) |

### J-009 recipient rules (detail)

| Recipient | Required (§15.8) | Implemented | Local evidence |
|---|---|---|---|
| ADMIN | Yes (*Admin/Super Admin*) | Yes | Mailpit `admin@taxsimba.co.uk`; escalation count includes admin |
| SUPER_ADMIN | Yes (*Admin/Super Admin*) | Yes — **should receive** | Mailpit `superadmin@taxsimba.co.uk` |
| ACCOUNTANT | No (not the §15.8 standing escalation audience) | Not in overdue fan-out | — |
| CLIENT overdue email | No (agreed: none) | Not sent | `mailpit/summary.json` `client_overdue_emails:0` |

## Additional checks

| Check | Local | Evidence |
|---|---|---|
| Account isolation (other client) | **PASS** | `api/isolation.json` |
| Duplicate reminder prevention | **PASS** | `api/reminder_run_duplicate.json` all zeros |
| Suppression when task/docs done | **PASS** | `api/reminder_run_after_suppress.json` |
| No new client overdue email | **PASS** | `mailpit/summary.json` |
| Scheduler wiring / schedule / TZ | **DOCUMENTED** | `api/scheduler_wiring.json` |
| Automatic staging reminder execution | **BLOCKED** | Not tested on staging (`REMINDERS_ENABLED=false` in staging example) |
| External inbox / staging | **BLOCKED** | Not tested |
| J-011 | **UNVERIFIED** | Task 5 |

## Commands / counts / exit codes

```bash
cd backend-node
npx vitest run tests/integration/email.test.ts
# → 1 file / 12 tests PASS  EXIT 0

npx vitest run tests/integration/email.test.ts tests/integration/additionalWorkTask6.test.ts
# → 2 files / 18 tests PASS  EXIT 0

npm run typecheck   # EXIT 0
npm run build       # EXIT 0

# evidence (against running API + FE :3000/:3001, REMINDERS_ENABLED)
node scripts/t7Evidence.mjs
node scripts/t7BrowserEvidence.mjs

cd ../tax_simba_frontend && npm run build          # EXIT 0
cd ../tax_simba_admin_frontend && npm run build    # EXIT 0
```

See `builds/EXIT_CODES.txt` in the evidence ZIP.

**Label:** Mailpit is **local only**. External inbox / staging remain **BLOCKED**.
