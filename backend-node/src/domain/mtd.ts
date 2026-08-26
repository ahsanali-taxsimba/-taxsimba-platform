/**
 * MTD for Income Tax — a separate quarterly workflow built on the shared foundation.
 *
 * Self Assessment is untouched. MTD reuses the existing case, permission, document, payment
 * and audit architecture and adds its own period-level workflow: four quarterly updates plus a
 * Final Declaration, each prepared by the accountant (staff-only draft), reviewed and published
 * by admin, approved by the client and then recorded as an external submission. TaxSimba never
 * files to HMRC directly and never calculates tax — any tax/NI estimate shown to a client is
 * typed in and confirmed by the accountant.
 */
import { randomUUID } from "crypto";

import { clean, col, Doc } from "../db/mongo";
import { logActivity, nowIso } from "./workflow";

export const MTD = "MTD_INCOME_TAX";

export const NOT_STARTED = "NOT_STARTED";
export const IN_PROGRESS = "IN_PROGRESS";
export const ADMIN_REVIEW = "ADMIN_REVIEW";
export const AWAITING_CLIENT = "AWAITING_CLIENT_APPROVAL";
export const APPROVED = "APPROVED";
export const SUBMITTED = "SUBMITTED";

export const STAFF_STAGE_LABEL: Record<string, string> = {
  [NOT_STARTED]: "Not started",
  [IN_PROGRESS]: "Accountant preparing",
  [ADMIN_REVIEW]: "Awaiting admin review",
  [AWAITING_CLIENT]: "Waiting for client approval",
  [APPROVED]: "Ready for external submission",
  [SUBMITTED]: "Submitted",
};
const NEXT_ACTION: Record<string, [string, string]> = {
  [NOT_STARTED]: ["Accountant to enter the quarterly figures", "ACCOUNTANT"],
  [IN_PROGRESS]: ["Accountant to finish and send for admin review", "ACCOUNTANT"],
  [ADMIN_REVIEW]: ["Admin to review and publish the figures", "ADMIN"],
  [AWAITING_CLIENT]: ["Client to approve the published figures", "CLIENT"],
  [APPROVED]: ["Admin to submit externally and record the reference", "ADMIN"],
  [SUBMITTED]: ["Nothing — this period is filed", "NONE"],
};
export const DISCLAIMER =
  "These figures have been prepared by your accountant using the information currently " +
  "available. Your final tax position may change as further information is added and at the " +
  "end of the tax year.";

// 6 Apr - 5 Jul, 6 Jul - 5 Oct, 6 Oct - 5 Jan, 6 Jan - 5 Apr
const QUARTERS: [number, [number, number], [number, number], number][] = [
  [1, [4, 6], [7, 5], 0],
  [2, [7, 6], [10, 5], 0],
  [3, [10, 6], [1, 5], 1],
  [4, [1, 6], [4, 5], 1],
];

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function startYear(taxYear: string): number {
  return parseInt(String(taxYear).split("/")[0], 10);
}

/** HMRC quarterly deadline: the 7th of the month after the month the period ends in. */
function deadlineFor(periodEnd: string): string {
  const [y, m] = periodEnd.split("-").map((p) => parseInt(p, 10));
  const month = m + 1;
  return month > 12 ? iso(y + 1, month - 12, 7) : iso(y, month, 7);
}

export interface PeriodTemplate {
  kind: string;
  quarter: number | null;
  label: string;
  period_start: string;
  period_end: string;
  deadline: string;
}

export function periodSchedule(taxYear: string): PeriodTemplate[] {
  const y = startYear(taxYear);
  const rows: PeriodTemplate[] = QUARTERS.map(([q, [sm, sd], [em, ed], endOffset]) => {
    const start = iso(y + (sm === 1 ? 1 : 0), sm, sd);
    const end = iso(y + endOffset, em, ed);
    return {
      kind: "QUARTER",
      quarter: q,
      label: `Quarter ${q}`,
      period_start: start,
      period_end: end,
      deadline: deadlineFor(end),
    };
  });
  rows.push({
    kind: "FINAL_DECLARATION",
    quarter: null,
    label: "Final Declaration",
    period_start: iso(y, 4, 6),
    period_end: iso(y + 1, 4, 5),
    deadline: iso(y + 2, 1, 31),
  });
  return rows;
}

/** Idempotent: generates the four quarters plus the Final Declaration for an MTD case. */
export async function ensurePeriods(kase: Doc): Promise<number> {
  if (kase.service_type !== MTD || !kase.tax_year) return 0;
  let created = 0;
  for (const row of periodSchedule(kase.tax_year)) {
    const existing = await col("mtd_periods").findOne({
      case_id: kase.id,
      kind: row.kind,
      quarter: row.quarter,
    });
    if (existing) continue;
    await col("mtd_periods").insertOne({
      id: randomUUID(),
      case_id: kase.id,
      case_ref: kase.case_ref,
      client_id: kase.client_id,
      client_user_id: kase.client_user_id,
      client_name: kase.client_name ?? null,
      tax_year: kase.tax_year,
      is_test: Boolean(kase.is_test),
      ...row,
      status: NOT_STARTED,
      // staff-only working figures; never returned to a client
      draft: null,
      draft_saved_by: null,
      draft_saved_at: null,
      // published, client-visible snapshots -- history is never overwritten
      published: null,
      published_version: 0,
      published_versions: [],
      changes_reason: null,
      client_approved_at: null,
      approved_version: null,
      approved_snapshot: null,
      approval_history: [],
      reopened_by_name: null,
      reopened_at: null,
      submission_reference: null,
      submission_date: null,
      submitted_by_name: null,
      submitted_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    created += 1;
  }
  return created;
}

export function daysToDeadline(deadline: string): number {
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  return Math.round((new Date(deadline).getTime() - today) / 86400000);
}

export function warning(row: Doc): { deadline_warning: string | null; days_to_deadline: number | null } {
  if (row.status === SUBMITTED) return { deadline_warning: null, days_to_deadline: null };
  const days = daysToDeadline(row.deadline);
  const level =
    days < 0 ? "OVERDUE" : days <= 3 ? "DUE_3" : days <= 7 ? "DUE_7" : days <= 14 ? "DUE_14" : null;
  return { deadline_warning: level, days_to_deadline: days };
}

/** Client-facing wording only — backend states are never changed by this. */
export function clientStage(row: Doc, kase: Doc | null, awaitingDocs: boolean): string {
  if (row.prior_to_taxsimba) return "Submitted before joining TaxSimba";
  if (row.status === SUBMITTED) return "Submitted";
  if (row.status === APPROVED) return "Approved";
  if (row.status === AWAITING_CLIENT) return "Ready for your approval";
  if (row.status === ADMIN_REVIEW) return "Under review";
  if (awaitingDocs) {
    return warning(row).deadline_warning === "OVERDUE"
      ? "Action required — overdue"
      : "Action required";
  }
  if (row.status === NOT_STARTED && kase !== null && !kase.assigned_accountant_id) {
    return "Getting started";
  }
  return "Preparing";
}

const CLIENT_HIDDEN = [
  "draft",
  "draft_saved_by",
  "draft_saved_at",
  "changes_reason",
  "published_versions",
  "approval_history",
  "reopened_by_name",
  "reopened_at",
  "is_test",
];

export function decorate(row: Doc, user: Doc, kase: Doc | null = null, awaitingDocs = false): Doc {
  let [action, owner] = NEXT_ACTION[row.status];
  const isClient = user.role === "CLIENT";
  const warn = warning(row);
  // A deadline that passes while the client still owes records is not the accountant's delay:
  // the period escalates as overdue but the client stays the action owner.
  const overdueWaiting = Boolean(
    awaitingDocs &&
      warn.deadline_warning === "OVERDUE" &&
      [NOT_STARTED, IN_PROGRESS].includes(row.status),
  );
  const awaitingAssignment = Boolean(
    kase !== null && !kase.assigned_accountant_id && row.status === NOT_STARTED,
  );
  const staffLabel = overdueWaiting
    ? "Overdue — waiting for client"
    : awaitingAssignment
      ? "Awaiting assignment"
      : STAFF_STAGE_LABEL[row.status];
  if (overdueWaiting) [action, owner] = ["Client to provide the outstanding records", "CLIENT"];
  else if (awaitingAssignment) [action, owner] = ["Assign an accountant", "ADMIN"];
  const out: Doc = {
    ...row,
    ...warn,
    stage_label: isClient ? clientStage(row, kase, awaitingDocs) : staffLabel,
    awaiting_documents: awaitingDocs,
    awaiting_assignment: awaitingAssignment,
    overdue_waiting_for_client: overdueWaiting,
    delay_attributed_to: overdueWaiting ? "CLIENT" : null,
    escalated_to_admin: overdueWaiting,
    next_action: action,
    next_action_owner: owner,
    disclaimer: row.published ? DISCLAIMER : null,
  };
  if (isClient) {
    // A client only ever sees published figures -- drafts and staff-only review metadata
    // stay internal.
    for (const key of CLIENT_HIDDEN) delete out[key];
  }
  return out;
}

export async function advance(
  row: Doc,
  kase: Doc,
  status: string | null,
  action: string,
  user: Doc,
  extra: Doc = {},
  comments: string | null = null,
): Promise<Doc> {
  const update: Doc = { updated_at: nowIso(), ...extra };
  if (status) update.status = status;
  await col("mtd_periods").updateOne({ id: row.id }, { $set: update });
  await logActivity(
    kase.id,
    `MTD ${row.label}: ${action}`,
    user,
    { mtd_period_id: row.id, period_status: status ?? row.status, service: "MTD" },
    { comments },
  );
  return decorate({ ...row, ...update }, user);
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Cleans a period row for the caller (drops Mongo internals). */
export function cleanPeriod(row: Doc): Doc {
  return clean(row) as Doc;
}
