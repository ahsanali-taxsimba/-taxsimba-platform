/**
 * Scheduled reminder worker.
 *
 * Reminds clients about outstanding actions and approaching deadlines, and escalates overdue
 * items to admins. It only raises notifications that the workflow already defines -- no new
 * business rule, no state change, no status transition.
 *
 * Idempotency has two layers:
 *  1. `reminder_log` holds one row per (kind, subject) with the timestamp of the last send. A
 *     conditional `updateOne` on a unique key claims the send atomically, so two workers, a
 *     restart mid-run, or a tick every minute still produce at most one reminder per subject
 *     per REMINDER_REPEAT_DAYS.
 *  2. `notify()` collapses an unread duplicate, and the email layer is keyed on the resulting
 *     notification id, so nothing downstream can fan out either.
 *
 * Configuration:
 *   REMINDERS_ENABLED         "true" to run the loop (default false)
 *   REMINDER_INTERVAL_MINUTES tick interval, default 60
 *   REMINDER_REPEAT_DAYS      minimum gap between reminders for the same item, default 3
 *   REMINDER_DEADLINE_DAYS    how far ahead a deadline starts being chased, default 14
 */
import { randomUUID } from "crypto";

import { env, intEnv } from "../config/env";
import { col, Doc } from "../db/mongo";
import { OPERATIONAL_ONLY } from "../domain/testdata";
import { notify } from "../domain/workflow";
import { flushEmailQueue } from "../services/email";

export interface ReminderRun {
  client_task: number;
  client_case_action: number;
  mtd_client_approval: number;
  mtd_records_due: number;
  mtd_overdue_escalation: number;
  emails_sent: number;
}

function emptyRun(): ReminderRun {
  return {
    client_task: 0,
    client_case_action: 0,
    mtd_client_approval: 0,
    mtd_records_due: 0,
    mtd_overdue_escalation: 0,
    emails_sent: 0,
  };
}

export async function ensureReminderIndexes(): Promise<void> {
  await col("reminder_log").createIndex({ key: 1 }, { unique: true });
}

function repeatDays(): number {
  return intEnv("REMINDER_REPEAT_DAYS", 3);
}

function deadlineWindowDays(): number {
  return intEnv("REMINDER_DEADLINE_DAYS", 14);
}

/**
 * Atomically claim the right to remind about `key`. Returns false when the same subject was
 * reminded inside the repeat window, which is what stops duplicates.
 */
export async function claimReminder(key: string, now = new Date()): Promise<boolean> {
  const cutoff = new Date(now.getTime() - repeatDays() * 86400 * 1000);
  const claimed = await col("reminder_log").updateOne(
    { key, last_sent_at: { $lte: cutoff } },
    { $set: { last_sent_at: now }, $inc: { sends: 1 } },
  );
  if (claimed.matchedCount === 1) return true;
  try {
    await col("reminder_log").insertOne({
      id: randomUUID(),
      key,
      last_sent_at: now,
      sends: 1,
      created_at: now,
    });
    return true;
  } catch (e) {
    // Unique-key collision: another worker (or an earlier run inside the window) owns it.
    if ((e as Doc)?.code === 11000) return false;
    throw e;
  }
}

function daysUntil(isoDate: string | null | undefined, now: Date): number | null {
  if (!isoDate) return null;
  const due = Date.parse(isoDate.length <= 10 ? `${isoDate}T00:00:00Z` : isoDate);
  if (Number.isNaN(due)) return null;
  return Math.ceil((due - now.getTime()) / 86400000);
}

async function activeUser(userId: string | null | undefined): Promise<Doc | null> {
  if (!userId) return null;
  const user = (await col("users").findOne({ id: userId })) as Doc | null;
  if (!user || user.is_active === false || user.is_test === true) return null;
  return user;
}

/** Open client tasks: "you still owe us something". */
async function remindOpenClientTasks(run: ReminderRun, now: Date): Promise<void> {
  const tasks = (await col("tasks")
    .find({ status: "OPEN", owner_role: "CLIENT" })
    .limit(500)
    .toArray()) as Doc[];
  for (const task of tasks) {
    const kase = (await col("cases").findOne({ id: task.case_id, ...OPERATIONAL_ONLY })) as Doc | null;
    if (!kase) continue;
    const owner = await activeUser(task.owner_id ?? kase.client_user_id);
    if (!owner) continue;
    const due = daysUntil(task.due_date, now);
    if (due !== null && due > deadlineWindowDays()) continue;
    if (!(await claimReminder(`client_task:${task.id}`, now))) continue;
    const when = task.due_date ? ` It was due on ${String(task.due_date).slice(0, 10)}.` : "";
    await notify(
      owner.id,
      `Still needed: ${task.name}`,
      `${kase.case_ref}: we are waiting for this before your return can move forward.${when}`,
      kase.id,
      "/actions",
      "TASK",
    );
    run.client_task += 1;
  }
}

/** Cases parked with the client (documents outstanding, or a calculation awaiting approval). */
async function remindClientCaseActions(run: ReminderRun, now: Date): Promise<void> {
  const cases = (await col("cases")
    .find({
      status: { $in: ["AWAITING_CLIENT", "AWAITING_CLIENT_APPROVAL"] },
      ...OPERATIONAL_ONLY,
    })
    .limit(500)
    .toArray()) as Doc[];
  for (const kase of cases) {
    const client = await activeUser(kase.client_user_id);
    if (!client) continue;
    if (!(await claimReminder(`client_case:${kase.id}:${kase.status}`, now))) continue;
    const approval = kase.status === "AWAITING_CLIENT_APPROVAL";
    await notify(
      client.id,
      approval
        ? `Your ${kase.tax_year ?? ""} return is waiting for your approval`.replace("  ", " ")
        : "We are still waiting for your information",
      approval
        ? `${kase.case_ref}: please review the figures and approve them so we can submit.`
        : `${kase.case_ref}: ${kase.next_action ?? "there are outstanding items on your case"}.`,
      kase.id,
      approval ? "/my-return" : "/actions",
      approval ? "APPROVAL" : "TASK",
    );
    run.client_case_action += 1;
  }
}

/** MTD periods: approvals outstanding, records due, and overdue escalation to admins. */
async function remindMtdPeriods(run: ReminderRun, now: Date): Promise<void> {
  const periods = (await col("mtd_periods")
    .find({
      status: { $in: ["NOT_STARTED", "IN_PROGRESS", "AWAITING_CLIENT_APPROVAL"] },
      ...OPERATIONAL_ONLY,
    })
    .limit(1000)
    .toArray()) as Doc[];
  const admins = (await col("users")
    .find({ role: { $in: ["ADMIN", "SUPER_ADMIN"] }, is_active: true }, { projection: { id: 1 } })
    .toArray()) as Doc[];

  for (const period of periods) {
    const kase = (await col("cases").findOne({ id: period.case_id, ...OPERATIONAL_ONLY })) as Doc | null;
    if (!kase) continue;
    const client = await activeUser(kase.client_user_id);
    const due = daysUntil(period.deadline, now);

    if (period.status === "AWAITING_CLIENT_APPROVAL" && client) {
      if (due === null || due <= deadlineWindowDays()) {
        if (await claimReminder(`mtd_approval:${period.id}`, now)) {
          await notify(
            client.id,
            `Action needed: approve your ${period.label}`,
            `Due ${period.deadline}. Please review and approve the figures.`,
            kase.id,
            "/mtd",
            "APPROVAL",
          );
          run.mtd_client_approval += 1;
        }
      }
      continue;
    }

    if (due !== null && due >= 0 && due <= deadlineWindowDays() && client) {
      if (await claimReminder(`mtd_records:${period.id}`, now)) {
        await notify(
          client.id,
          `${period.label} records due soon`,
          `Your ${period.label} is due on ${period.deadline}. Please send anything still outstanding.`,
          kase.id,
          "/mtd",
          "DEADLINE",
        );
        run.mtd_records_due += 1;
      }
    }

    if (due !== null && due < 0) {
      // Escalation is the existing oversight behaviour, now raised on a schedule instead of
      // only when a staff member happens to open the period list.
      for (const admin of admins) {
        if (!(await claimReminder(`mtd_overdue:${period.id}:${admin.id}`, now))) continue;
        await notify(
          admin.id as string,
          `Overdue — waiting for client: ${period.label}`,
          `${kase.case_ref} (${kase.client_name}) — deadline ${period.deadline} passed with records still outstanding.`,
          kase.id,
          "/admin/mtd?bucket=overdue_waiting_client",
          "DEADLINE",
        );
        run.mtd_overdue_escalation += 1;
      }
    }
  }
}

/** One pass. Safe to call directly (tests, or an operator running it by hand). */
export async function runReminders(now = new Date()): Promise<ReminderRun> {
  const run = emptyRun();
  await remindOpenClientTasks(run, now);
  await remindClientCaseActions(run, now);
  await remindMtdPeriods(run, now);
  // Deliver anything that a provider outage left queued, including this run's own messages.
  run.emails_sent = (await flushEmailQueue()).sent;
  return run;
}

let timer: NodeJS.Timeout | null = null;

export function remindersEnabled(): boolean {
  return (env("REMINDERS_ENABLED") ?? "false").toLowerCase() === "true";
}

/**
 * Start the loop. A single process runs it; if the deployment scales horizontally the extra
 * instances are harmless because every send is claimed through `reminder_log`.
 */
export function startReminderWorker(): void {
  if (timer || !remindersEnabled()) return;
  const minutes = intEnv("REMINDER_INTERVAL_MINUTES", 60);
  const tick = async () => {
    try {
      const run = await runReminders();
      // eslint-disable-next-line no-console
      console.log(`[reminders] ${JSON.stringify(run)}`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`[reminders] tick failed: ${String(e)}`);
    }
  };
  timer = setInterval(tick, minutes * 60_000);
  timer.unref();
  void tick();
}

export function stopReminderWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
