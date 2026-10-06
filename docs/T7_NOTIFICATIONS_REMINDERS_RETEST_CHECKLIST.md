# Task 7 — Notifications + MTD reminders / overdue escalation (J-007, J-008, J-009)

**Status:** LOCAL PASS — MAILPIT  
**External inbox / staging:** BLOCKED  
**Branch:** `cursor/toxsl-blockers-b01-b04-80a7`  
**Tested tip (full SHA):** 
**Fix commit:** 
**J-011:** remains **UNVERIFIED** (Task 5; not reopened)  
**Final Toxel handoff SHA:** deferred  
**Evidence ZIP:** `/opt/cursor/artifacts/task7_notifications_reminders_evidence.zip` (not in git)  
**Agreed behaviour preserved:** **no new client overdue email**

## Acceptance criteria (source)

Original UAT pack rows for J-007/J-008/J-009 were not present as discrete pack IDs in-repo. Criteria taken from the Task 7 prompt plus handover **§15.8** (`memory/NODE_HANDOVER.md`):

| ID | Acceptance criteria |
|---|---|
| **J-007** | Notification content can be opened on client/admin dashboards; title + body visible; link reaches the correct case/service; read status persists after refresh/re-login |
| **J-008** | Eligible MTD deadline and client-task reminders appear (in-app + email) when controlled dates fall inside reminder window; account isolation; duplicate prevention; suppression when the relevant task is completed |
| **J-009** | When an MTD period deadline has passed with a **Requested** document still outstanding and period `NOT_STARTED`/`IN_PROGRESS`, Admin/Super Admin receive overdue escalation (in-app + email) into `overdue_waiting_client`; correct admin recipients; no client overdue email |

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

## UAT checklist

| ID | Criterion | Local | Staging | Evidence references |
|---|---|---|---|---|
| **J-007** | Notification content opens; correct link; read persists | **PASS** | BLOCKED | Before empty list `before/client_notifications.json`. After list `after/01_client_notifications.png` + `after/01_client_notifications_text.json`. Open→`/mtd-dashboard` `after/02_client_notification_opened_nav.png` + `after/02_open_nav.json`. Re-login read `after/03_client_notifications_after_relogin.png` + `after/03_read_persistence.json` (`any_read_persisted: true`). Admin open→`/admin/mtd?bucket=overdue_waiting_client` `after/05_admin_escalation_opened.png` + `after/05_admin_escalation_nav.json` |
| **J-008** | Eligible deadline/task reminders appear; isolation; dup; suppress | **PASS** (Mailpit local) | BLOCKED | Reminder run `api/reminder_run.json` (`client_task:1`, `mtd_records_due:1`). Client UI shows both titles `after/03_read_persistence.json`. Isolation `api/isolation.json` (`leaked_count:0`). Dup re-run zeros `api/reminder_run_duplicate.json`. Suppress after task COMPLETED + Requested→Uploaded zeros `api/reminder_run_after_suppress.json`. Mailpit deadline/task emails in `mailpit/t7_related_messages.json` |
| **J-009** | Overdue MTD admin escalation (§15.8); correct admin; no client overdue email | **PASS** (Mailpit local) | BLOCKED | `api/reminder_run.json` (`mtd_overdue_escalation:2`). Admin notifications `after/04_admin_notifications.png`. Bucket with **MTD-2007** `after/06_admin_mtd_overdue_bucket.png` + `after/06_admin_mtd_bucket.json`. Mailpit to `admin@` + `superadmin@` subjects `Overdue — waiting for client: Quarter 2`. `mailpit/summary.json` `client_overdue_emails:0` |

## Additional checks

| Check | Local | Evidence |
|---|---|---|
| Account isolation (other client) | **PASS** | `api/isolation.json` |
| Duplicate reminder prevention | **PASS** | `api/reminder_run_duplicate.json` all zeros |
| Suppression when task/docs done | **PASS** | `api/reminder_run_after_suppress.json` |
| No new client overdue email | **PASS** | `mailpit/summary.json` |
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
