/** Controlled workflow engine for TaxSimba cases (service-type aware, shared with MTD). */
import { randomUUID } from "crypto";

import { col, Doc } from "../db/mongo";
import { httpError } from "../http/errors";
import { emailNotification } from "../services/email";

export const STATUSES = [
  "NEW",
  "ONBOARDING",
  "AWAITING_ASSIGNMENT",
  "ASSIGNED",
  "ACCOUNTANT_REVIEW",
  "AWAITING_CLIENT",
  "IN_PREPARATION",
  "READY_FOR_ADMIN_REVIEW",
  "ADMIN_REVIEW",
  "CHANGES_REQUIRED",
  "ADMIN_APPROVED",
  "AWAITING_CLIENT_APPROVAL",
  "CLIENT_APPROVED",
  "READY_FOR_SUBMISSION",
  "SUBMISSION_IN_PROGRESS",
  "SUBMITTED",
  "SUBMISSION_ISSUE",
  "COMPLETED",
];

/** status -> [stage label, next action, next action owner] */
export const STATUS_META: Record<string, [string, string, string]> = {
  NEW: ["Information", "Complete client onboarding", "CLIENT"],
  ONBOARDING: ["Information", "Client to provide initial information", "CLIENT"],
  AWAITING_ASSIGNMENT: ["Information", "Assign an accountant", "ADMIN"],
  ASSIGNED: ["Accountant Review", "Accountant to start review", "ACCOUNTANT"],
  ACCOUNTANT_REVIEW: ["Accountant Review", "Accountant reviewing information", "ACCOUNTANT"],
  AWAITING_CLIENT: ["Documents", "Client to provide requested items", "CLIENT"],
  IN_PREPARATION: ["Accountant Review", "Accountant preparing calculation", "ACCOUNTANT"],
  READY_FOR_ADMIN_REVIEW: ["Accountant Review", "Admin to review submitted work", "ADMIN"],
  ADMIN_REVIEW: ["Accountant Review", "Admin reviewing submitted work", "ADMIN"],
  CHANGES_REQUIRED: ["Accountant Review", "Accountant to action admin changes", "ACCOUNTANT"],
  ADMIN_APPROVED: ["Your Approval", "Release calculation to client", "ADMIN"],
  AWAITING_CLIENT_APPROVAL: ["Your Approval", "Client to review and approve return", "CLIENT"],
  CLIENT_APPROVED: ["Your Approval", "Prepare for submission", "ADMIN"],
  READY_FOR_SUBMISSION: ["HMRC Submission", "Submit return", "ADMIN"],
  SUBMISSION_IN_PROGRESS: ["HMRC Submission", "Submission in progress", "ADMIN"],
  SUBMITTED: ["HMRC Submission", "Awaiting confirmation", "ADMIN"],
  SUBMISSION_ISSUE: ["HMRC Submission", "Resolve submission issue", "ADMIN"],
  COMPLETED: ["HMRC Submission", "No action required", "NONE"],
};

export const STAGES = [
  "Information",
  "Documents",
  "Accountant Review",
  "Your Approval",
  "HMRC Submission",
];

/** Plain-English, client-facing wording for every internal status. */
export const CLIENT_STATUS_LABELS: Record<string, string> = {
  NEW: "Getting started",
  ONBOARDING: "Getting started",
  AWAITING_ASSIGNMENT: "With TaxSimba",
  ASSIGNED: "With your accountant",
  ACCOUNTANT_REVIEW: "With your accountant",
  AWAITING_CLIENT: "Waiting for you",
  IN_PREPARATION: "Being prepared",
  READY_FOR_ADMIN_REVIEW: "In internal review",
  ADMIN_REVIEW: "In internal review",
  CHANGES_REQUIRED: "Being updated",
  ADMIN_APPROVED: "Ready for your approval",
  AWAITING_CLIENT_APPROVAL: "Ready for your approval",
  CLIENT_APPROVED: "Approved by you",
  READY_FOR_SUBMISSION: "Ready for HMRC submission",
  SUBMISSION_IN_PROGRESS: "Submitting to HMRC",
  SUBMITTED: "Submitted to HMRC",
  SUBMISSION_ISSUE: "Submission issue",
  COMPLETED: "Completed",
};

/** Client-safe label. Falls back to sentence case rather than exposing an enum. */
export function clientStatus(status: string): string {
  if (CLIENT_STATUS_LABELS[status]) return CLIENT_STATUS_LABELS[status];
  const s = status.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * UK online filing/payment deadline: 31 January following the end of the tax year.
 * 2025/26 -> 31 January 2027.
 */
export function deadlineForTaxYear(taxYear: string | null | undefined): string | null {
  const head = String(taxYear ?? "").split("/")[0];
  const start = parseInt(head, 10);
  if (Number.isNaN(start)) return null;
  return `${start + 2}-01-31T23:59:00+00:00`;
}

export function paymentDeadlineLabel(taxYear: string): string {
  const iso = deadlineForTaxYear(taxYear);
  return iso ? `31 January ${iso.slice(0, 4)}` : "31 January";
}

/**
 * Server-side workflow guard. A transition not listed here is rejected, so no API request
 * can skip a stage even if the frontend is bypassed.
 */
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  NEW: ["ONBOARDING", "AWAITING_ASSIGNMENT"],
  ONBOARDING: ["AWAITING_ASSIGNMENT"],
  AWAITING_ASSIGNMENT: ["ASSIGNED"],
  ASSIGNED: ["ACCOUNTANT_REVIEW", "ASSIGNED"],
  ACCOUNTANT_REVIEW: ["AWAITING_CLIENT", "IN_PREPARATION", "READY_FOR_ADMIN_REVIEW", "ASSIGNED"],
  AWAITING_CLIENT: ["ACCOUNTANT_REVIEW", "AWAITING_CLIENT", "ASSIGNED"],
  IN_PREPARATION: ["AWAITING_CLIENT", "IN_PREPARATION", "READY_FOR_ADMIN_REVIEW", "ASSIGNED"],
  READY_FOR_ADMIN_REVIEW: ["ADMIN_REVIEW", "CHANGES_REQUIRED", "ADMIN_APPROVED"],
  ADMIN_REVIEW: ["CHANGES_REQUIRED", "ADMIN_APPROVED"],
  CHANGES_REQUIRED: [
    "ACCOUNTANT_REVIEW",
    "IN_PREPARATION",
    "AWAITING_CLIENT",
    "READY_FOR_ADMIN_REVIEW",
    "ASSIGNED",
  ],
  ADMIN_APPROVED: ["AWAITING_CLIENT_APPROVAL"],
  AWAITING_CLIENT_APPROVAL: ["CLIENT_APPROVED", "AWAITING_CLIENT_APPROVAL"],
  CLIENT_APPROVED: ["READY_FOR_SUBMISSION"],
  READY_FOR_SUBMISSION: ["SUBMISSION_IN_PROGRESS", "SUBMITTED"],
  SUBMISSION_IN_PROGRESS: ["SUBMITTED", "SUBMISSION_ISSUE"],
  SUBMITTED: ["COMPLETED", "SUBMISSION_ISSUE"],
  SUBMISSION_ISSUE: ["SUBMISSION_IN_PROGRESS", "SUBMITTED"],
  // Completed cases are locked; only an audited admin reopen can move them.
  COMPLETED: ["ACCOUNTANT_REVIEW", "ASSIGNED"],
};

/** Python's datetime.now(timezone.utc).isoformat() — microseconds, +00:00 offset. */
export function nowIso(): string {
  const d = new Date();
  const micros = String(d.getUTCMilliseconds()).padStart(3, "0") + "000";
  return (
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-` +
    `${String(d.getUTCDate()).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}:` +
    `${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}.` +
    `${micros}+00:00`
  );
}

export function isoPlusDays(days: number): string {
  const d = new Date(Date.now() + days * 86400000);
  const micros = String(d.getUTCMilliseconds()).padStart(3, "0") + "000";
  return `${d.toISOString().slice(0, 19)}.${micros}+00:00`;
}

/** Client-facing journey derived automatically from case status. */
export function journey(status: string, hasSubmission = false): { step: string; state: string }[] {
  const order = STATUSES;
  const idx = order.indexOf(status) >= 0 ? order.indexOf(status) : 0;
  const reached = (s: string) => idx >= order.indexOf(s);

  let info: string;
  if (reached("AWAITING_ASSIGNMENT")) info = "Completed";
  else if (reached("ONBOARDING")) info = "In Progress";
  else info = "Not Started";

  let docs: string;
  if (status === "AWAITING_CLIENT") docs = "Documents Required";
  else if (reached("IN_PREPARATION")) docs = "Completed";
  else if (reached("ASSIGNED")) docs = "In Progress";
  else docs = "Not Started";

  let review: string;
  if (reached("ADMIN_APPROVED")) review = "Completed";
  else if (["READY_FOR_ADMIN_REVIEW", "ADMIN_REVIEW", "CHANGES_REQUIRED"].includes(status))
    review = "In Review";
  else if (reached("ASSIGNED")) review = "In Review";
  else review = "Waiting";

  let approval: string;
  if (reached("CLIENT_APPROVED")) approval = "Approved";
  else if (["ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL"].includes(status))
    approval = "Action Required";
  else approval = "Waiting";

  let submission: string;
  if (status === "SUBMISSION_ISSUE") submission = "Submission Failed";
  else if (["SUBMITTED", "COMPLETED"].includes(status) && hasSubmission)
    submission = "Submitted Successfully";
  else if (["SUBMITTED", "COMPLETED"].includes(status)) submission = "Submitting";
  else if (status === "SUBMISSION_IN_PROGRESS") submission = "Submitting";
  else if (["CLIENT_APPROVED", "READY_FOR_SUBMISSION"].includes(status))
    submission = "Ready to Submit";
  else submission = "Not Started";

  return [
    { step: "Information", state: info },
    { step: "Documents", state: docs },
    { step: "Accountant Review", state: review },
    { step: "Your Approval", state: approval },
    { step: "HMRC Submission", state: submission },
  ];
}

export async function logActivity(
  caseId: string | null,
  action: string,
  user: Doc | null,
  meta: Doc | null = null,
  opts: { previousStatus?: string | null; newStatus?: string | null; comments?: string | null } = {},
): Promise<void> {
  await col("activity_logs").insertOne({
    id: randomUUID(),
    case_id: caseId,
    action,
    user_id: user ? user.id : null,
    user_name: user ? user.name : "System",
    role: user ? user.role : "SYSTEM",
    previous_status: opts.previousStatus ?? null,
    new_status: opts.newStatus ?? null,
    comments: opts.comments ?? null,
    meta: meta ?? {},
    created_at: nowIso(),
  });
}

/**
 * Idempotent notification: one genuine event produces one genuine notification. A repeated
 * call raising the same still-unread notification is collapsed instead of stacking up.
 */
export async function notify(
  userId: string,
  title: string,
  body: string,
  caseId: string | null = null,
  link: string | null = null,
  ntype = "INFO",
): Promise<void> {
  const duplicate = await col("notifications").findOne({
    user_id: userId,
    title,
    case_id: caseId,
    is_read: false,
  });
  if (duplicate) {
    await col("notifications").updateOne(
      { id: duplicate.id },
      { $set: { body, created_at: nowIso() } },
    );
    return;
  }
  const notification: Doc = {
    id: randomUUID(),
    user_id: userId,
    title,
    body,
    case_id: caseId,
    link,
    type: ntype,
    is_read: false,
    created_at: nowIso(),
  };
  await col("notifications").insertOne({ ...notification });
  // Email is a second delivery channel for the same event, keyed on the notification id so a
  // collapsed repeat never produces a second message. Failures are swallowed inside
  // emailNotification(): the in-app notification above is the system of record.
  await emailNotification(notification);
}

/** Single controlled entry point for every status change, validated server-side. */
export async function transition(
  kase: Doc,
  newStatus: string,
  user: Doc,
  actionLabel: string,
  opts: { waitingReason?: string | null; extra?: Doc | null; comments?: string | null } = {},
): Promise<Doc> {
  if (!STATUSES.includes(newStatus)) throw httpError(400, `Unknown status ${newStatus}`);
  const previous = kase.status;
  if (!(ALLOWED_TRANSITIONS[previous] ?? []).includes(newStatus)) {
    throw httpError(400, `Workflow rule: cannot move from ${previous} to ${newStatus}`);
  }
  const [stage, nextAction, owner] = STATUS_META[newStatus];
  const update: Doc = {
    status: newStatus,
    current_stage: stage,
    next_action: nextAction,
    next_action_owner: owner,
    waiting_reason: opts.waitingReason ?? null,
    last_updated: nowIso(),
    ...(opts.extra ?? {}),
  };
  await col("cases").updateOne({ id: kase.id }, { $set: update });
  await logActivity(kase.id, actionLabel, user, { status: newStatus }, {
    previousStatus: previous,
    newStatus,
    comments: opts.comments ?? null,
  });
  Object.assign(kase, update);
  return kase;
}
