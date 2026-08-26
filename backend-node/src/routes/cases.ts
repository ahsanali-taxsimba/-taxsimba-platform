import { randomUUID } from "crypto";

import { Request, Response, Router } from "express";
import { z } from "zod";

import { clean, cleanMany, col, Doc, scrub, scrubMany } from "../db/mongo";
import { daysLeft, decorate, getCase, ownedCaseIds } from "../domain/cases";
import { isTestEmail, OPERATIONAL_ONLY } from "../domain/testdata";
import {
  ALLOWED_TRANSITIONS,
  clientStatus,
  deadlineForTaxYear,
  isoPlusDays,
  journey,
  logActivity,
  notify,
  nowIso,
  paymentDeadlineLabel,
  STATUS_META,
  transition,
} from "../domain/workflow";
import { handler, httpError, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import { completeTask } from "../services/tasks";

export const casesRouter = Router();

const CaseIn = z.object({
  client_user_id: z.string().nullish().default(null),
  tax_year: z.string().default("2024/25"),
  service_type: z.string().default("SELF_ASSESSMENT"),
});
const AssignIn = z.object({
  accountant_id: z.string(),
  priority: z.string().default("MEDIUM"),
  internal_deadline: z.string().nullish().default(null),
  internal_instructions: z.string().nullish().default(null),
});
const RequestIn = z.object({
  request_type: z.string().default("DOCUMENT"),
  title: z.string(),
  description: z.string().default(""),
  document_required: z.boolean().default(true),
  mandatory: z.boolean().default(false),
  due_date: z.string().nullish().default(null),
  message: z.string().default(""),
});
const CalcIn = z.object({
  total_income: z.number(),
  taxable_income: z.number(),
  tax_due: z.number(),
  is_refund: z.boolean().default(false),
  notes: z.string().default(""),
  payment_deadline: z.string().nullish().default(null),
  breakdown: z.record(z.any()).nullish().default(null),
});
const ChecklistIn = z.object({
  calculation_version_id: z.string(),
  checklist: z.record(z.any()),
  admin_note: z.string().nullish().default(null),
});
const SubmissionIn = z.object({
  submission_date: z.string(),
  submission_reference: z.string(),
  provider: z.string().nullish().default(null),
  evidence_document_id: z.string().nullish().default(null),
  note: z.string().nullish().default(null),
});
const ReasonIn = z.object({ reason: z.string() });
const ApproveIn = z.object({ note: z.string().nullish().default(null) });
const ReturnChangesIn = z.object({ reason: z.string(), instructions: z.string() });

async function notifyAdmins(
  title: string,
  body: string,
  caseId: string,
  link: string,
  ntype = "INFO",
): Promise<void> {
  const admins = await col("users").find({ role: { $in: ["ADMIN", "SUPER_ADMIN"] } }).toArray();
  for (const admin of admins) await notify(admin.id, title, body, caseId, link, ntype);
}

/** GET /api/cases/{case_id} payload, reused as the response of every workflow action. */
async function caseDetail(caseId: string, user: Doc): Promise<Doc | null> {
  const kase = await getCase(caseId, user);
  kase.days_left = daysLeft(kase);
  // The record moves READY -> SUBMITTED -> COMPLETED when the case is completed, so both
  // of the later states count as a genuine recorded submission.
  const submission = await col("submission_records").findOne({
    case_id: caseId,
    status: { $in: ["SUBMITTED", "COMPLETED"] },
  });
  kase.journey = journey(kase.status, !!submission);
  kase.status_label = clientStatus(kase.status);
  kase.has_submission_record = !!submission;
  if (submission) {
    kase.submission_date = submission.submission_date ?? kase.submission_date;
    kase.submission_reference =
      submission.reference ?? submission.submission_reference ?? kase.submission_reference;
  }
  const approval = await col("client_approvals").findOne({ case_id: caseId });
  kase.approved_version = approval ? approval.version : null;
  if (!kase.external_deadline && kase.tax_year) {
    kase.external_deadline = deadlineForTaxYear(kase.tax_year);
  }
  return scrub(kase, user);
}

async function sendCase(res: Response, caseId: string, user: Doc): Promise<void> {
  res.json(await caseDetail(caseId, user));
}

// ---------------------------------------------------------------- list / create
const BUCKETS: Record<string, Doc> = {
  new: { status: { $in: ["NEW", "ONBOARDING", "AWAITING_ASSIGNMENT"] } },
  unassigned: { assigned_accountant_id: null },
  in_progress: {
    status: { $in: ["ASSIGNED", "ACCOUNTANT_REVIEW", "IN_PREPARATION", "CHANGES_REQUIRED"] },
  },
  waiting_client: { status: "AWAITING_CLIENT" },
  awaiting_client: { status: "AWAITING_CLIENT" },
  admin_review: { status: { $in: ["READY_FOR_ADMIN_REVIEW", "ADMIN_REVIEW"] } },
  client_approval: { status: { $in: ["ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL"] } },
  ready_submission: { status: { $in: ["CLIENT_APPROVED", "READY_FOR_SUBMISSION"] } },
  needs_my_action: {
    next_action_owner: "ACCOUNTANT",
    status: { $nin: ["SUBMITTED", "COMPLETED"] },
  },
  ready_for_admin: { status: { $in: ["READY_FOR_ADMIN_REVIEW", "ADMIN_REVIEW"] } },
  admin_changes: { status: "CHANGES_REQUIRED" },
  completed: { status: { $in: ["SUBMITTED", "COMPLETED", "READY_FOR_SUBMISSION"] } },
  // queue buckets
  new_assigned: { status: "ASSIGNED" },
  assigned: { assigned_accountant_id: { $ne: null } },
  changes_required: { status: "CHANGES_REQUIRED" },
  awaiting_admin_review: { status: { $in: ["READY_FOR_ADMIN_REVIEW", "ADMIN_REVIEW"] } },
  awaiting_client_approval: { status: { $in: ["ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL"] } },
  approved_ready: {
    status: {
      $in: [
        "ADMIN_APPROVED",
        "AWAITING_CLIENT_APPROVAL",
        "CLIENT_APPROVED",
        "READY_FOR_SUBMISSION",
      ],
    },
  },
  submitted: { status: { $in: ["SUBMITTED", "SUBMISSION_IN_PROGRESS"] } },
  case_completed: { status: "COMPLETED" },
};

/** Time-relative buckets are evaluated per request so "overdue" is never a stale constant. */
function timeBucket(name: string): Doc | null {
  const open = { $nin: ["SUBMITTED", "COMPLETED"] };
  if (name === "overdue") return { internal_deadline: { $lt: nowIso() }, status: open };
  if (name === "due_today") return { internal_deadline: { $lte: isoPlusDays(1) }, status: open };
  if (name === "due_week") return { internal_deadline: { $lte: isoPlusDays(7) }, status: open };
  if (name === "attention") {
    return {
      $or: [
        { status: "SUBMISSION_ISSUE" },
        { internal_deadline: { $lt: nowIso() }, status: open },
      ],
    };
  }
  return null;
}

function str(req: Request, name: string): string | undefined {
  const v = req.query[name];
  return typeof v === "string" && v.length ? v : undefined;
}

/** Query-string booleans, parsed the way FastAPI parses them. */
function bool(req: Request, name: string): boolean {
  return ["1", "true", "on", "yes"].includes((str(req, name) ?? "").toLowerCase());
}

casesRouter.get(
  "/cases",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const query: Doc = {};
    if (!bool(req, "include_test")) {
      // Automated-test cases stay in the database but never appear in operational views.
      Object.assign(query, OPERATIONAL_ONLY);
    }
    const serviceType = str(req, "service_type");
    if (serviceType) query.service_type = serviceType;
    if (me.role === "CLIENT") query.client_user_id = me.id;
    else if (me.role === "ACCOUNTANT") query.assigned_accountant_id = me.id;

    const status = str(req, "status");
    if (status) query.status = { $in: status.split(",") };
    const accountantId = str(req, "accountant_id");
    if (accountantId) {
      query.assigned_accountant_id = accountantId === "UNASSIGNED" ? null : accountantId;
    }
    const priority = str(req, "priority");
    if (priority) query.priority = priority;
    const taxYear = str(req, "tax_year");
    if (taxYear) query.tax_year = taxYear;

    const bucket = str(req, "bucket");
    if (bucket) {
      const definition = BUCKETS[bucket] ?? timeBucket(bucket);
      // An unknown bucket used to be ignored, which silently returned every case under the
      // wrong status filter.
      if (!definition) throw httpError(400, "Unknown case filter");
      Object.assign(query, definition);
    }

    const q = str(req, "q");
    if (q) {
      // Search by client name, case reference or the client's email address. Email is used
      // to locate the case only -- it is never returned.
      const matched = await col("users")
        .find(
          {
            role: "CLIENT",
            $or: [
              { email: { $regex: q, $options: "i" } },
              { name: { $regex: q, $options: "i" } },
            ],
          },
          { projection: { id: 1 } },
        )
        .toArray();
      query.$or = [
        { client_name: { $regex: q, $options: "i" } },
        { case_ref: { $regex: q, $options: "i" } },
        { client_user_id: { $in: matched.map((u) => u.id) } },
      ];
    }

    const limit = Number(str(req, "limit") ?? 100);
    const skip = Number(str(req, "skip") ?? 0);
    const cases = await col("cases")
      .find(query)
      .sort({ last_updated: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    res.json(scrubMany(await decorate(cases as Doc[]), me));
  }),
);

/**
 * Allocate a unique case reference. Derived from the highest reference ever issued, not from
 * the document count, so deleting a case can never re-issue its reference.
 */
async function nextCaseRef(): Promise<string> {
  for (;;) {
    const counter = await col("counters").findOneAndUpdate(
      { id: "case_ref" },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    const seq = (counter?.value as number) ?? 1;
    if (seq < 1001) {
      let highest = 1000;
      const rows = await col("cases")
        .find({ case_ref: { $regex: "^SA-\\d+$" } }, { projection: { case_ref: 1 } })
        .toArray();
      for (const row of rows) highest = Math.max(highest, parseInt(row.case_ref.split("-")[1], 10));
      await col("counters").updateOne({ id: "case_ref" }, { $set: { value: highest } }, { upsert: true });
      continue;
    }
    const ref = `SA-${seq}`;
    if (!(await col("cases").findOne({ case_ref: ref }))) return ref;
  }
}

casesRouter.post(
  "/cases",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(CaseIn, req.body);
    let clientUserId: string;
    if (me.role === "CLIENT") clientUserId = me.id;
    else {
      if (!body.client_user_id) throw httpError(400, "client_user_id required");
      clientUserId = body.client_user_id;
    }
    const clientUser = await col("users").findOne({ id: clientUserId, role: "CLIENT" });
    if (!clientUser) throw httpError(404, "Client not found");
    const client = await col("clients").findOne({ user_id: clientUserId });
    const [stage, nextAction, owner] = STATUS_META.AWAITING_ASSIGNMENT;
    const kase: Doc = {
      id: randomUUID(),
      case_ref: await nextCaseRef(),
      is_test: isTestEmail(clientUser.email),
      client_id: client ? client.id : null,
      client_user_id: clientUserId,
      client_name: clientUser.name,
      service_type: body.service_type,
      tax_year: body.tax_year,
      assigned_accountant_id: null,
      assigned_accountant_name: null,
      admin_reviewer_id: null,
      admin_reviewer_name: null,
      status: "AWAITING_ASSIGNMENT",
      current_stage: stage,
      next_action: nextAction,
      next_action_owner: owner,
      priority: "MEDIUM",
      internal_deadline: isoPlusDays(14),
      external_deadline: deadlineForTaxYear(body.tax_year),
      internal_instructions: null,
      waiting_reason: null,
      approved_version_id: null,
      created_at: nowIso(),
      last_updated: nowIso(),
    };
    await col("cases").insertOne({ ...kase });
    await logActivity(kase.id, "Case created", me);
    await notifyAdmins(
      "New case awaiting assignment",
      `${kase.client_name} — ${kase.case_ref}`,
      kase.id,
      `/admin/cases/${kase.id}`,
    );
    res.json(clean(kase));
  }),
);

casesRouter.get(
  "/cases/:caseId",
  auth(),
  handler(async (req, res) => {
    await sendCase(res, req.params.caseId, authed(req));
  }),
);

// ---------------------------------------------------------------- assignment
casesRouter.post(
  "/cases/:caseId/assign",
  auth("ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = req.params.caseId;
    const body = parseBody(AssignIn, req.body);
    const kase = await getCase(caseId, me);
    if (kase.status === "COMPLETED") {
      throw httpError(400, "Completed cases are locked — reopen the case first");
    }
    const acc = await col("users").findOne({
      id: body.accountant_id,
      role: "ACCOUNTANT",
      is_active: true,
    });
    if (!acc) throw httpError(404, "Accountant not found");
    await col("assignments").insertOne({
      id: randomUUID(),
      case_id: caseId,
      accountant_id: acc.id,
      accountant_name: acc.name,
      assigned_by: me.id,
      assigned_by_name: me.name,
      priority: body.priority,
      internal_deadline: body.internal_deadline,
      internal_instructions: body.internal_instructions,
      created_at: nowIso(),
    });
    const extra: Doc = {
      assigned_accountant_id: acc.id,
      assigned_accountant_name: acc.name,
      priority: body.priority,
      internal_instructions: body.internal_instructions,
    };
    if (body.internal_deadline) extra.internal_deadline = body.internal_deadline;
    const previousId = kase.assigned_accountant_id;
    if (previousId && previousId !== acc.id) {
      // Reassignment changes ownership only. The workflow state (stage, status, next-action
      // owner, waiting reason) belongs to the case, not the accountant, so it is left alone.
      await col("cases").updateOne({ id: caseId }, { $set: { ...extra, last_updated: nowIso() } });
      await logActivity(
        caseId,
        `Case reassigned from ${kase.assigned_accountant_name} to ${acc.name}`,
        me,
        {
          previous_accountant_id: previousId,
          previous_accountant_name: kase.assigned_accountant_name,
          new_accountant_id: acc.id,
          new_accountant_name: acc.name,
        },
      );
      await notify(
        previousId,
        "Case reassigned",
        `${kase.client_name} — ${kase.case_ref} is now with ${acc.name}`,
        caseId,
        "/work",
        "ASSIGNMENT",
      );
    } else if (previousId === acc.id) {
      await col("cases").updateOne({ id: caseId }, { $set: { ...extra, last_updated: nowIso() } });
      await logActivity(caseId, `Assignment details updated for ${acc.name}`, me, extra);
    } else {
      await transition(kase, "ASSIGNED", me, `Assigned to ${acc.name}`, { extra });
    }
    await notify(
      acc.id,
      "New case assigned",
      `${kase.client_name} — ${kase.case_ref} (${kase.tax_year})`,
      caseId,
      `/work/cases/${caseId}`,
      "ASSIGNMENT",
    );
    await sendCase(res, caseId, me);
  }),
);

casesRouter.post(
  "/cases/:caseId/unassign",
  auth("ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = req.params.caseId;
    const body = parseBody(ReasonIn, req.body);
    const kase = await getCase(caseId, me);
    if (kase.status === "COMPLETED") {
      throw httpError(400, "Completed cases are locked — reopen the case first");
    }
    if (!kase.assigned_accountant_id) throw httpError(400, "Case is not assigned");
    const previous = kase.assigned_accountant_name;
    await col("assignments").updateMany(
      { case_id: caseId, ended_at: null },
      { $set: { ended_at: nowIso(), ended_by: me.name, end_reason: body.reason } },
    );
    await col("cases").updateOne(
      { id: caseId },
      {
        $set: {
          assigned_accountant_id: null,
          assigned_accountant_name: null,
          status: "AWAITING_ASSIGNMENT",
          current_stage: "Information",
          next_action: "Assign an accountant",
          next_action_owner: "ADMIN",
          last_updated: nowIso(),
        },
      },
    );
    await logActivity(caseId, `Case unassigned from ${previous}`, me, null, {
      previousStatus: kase.status,
      newStatus: "AWAITING_ASSIGNMENT",
      comments: body.reason,
    });
    await sendCase(res, caseId, me);
  }),
);

casesRouter.get(
  "/cases/:caseId/assignments",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    await getCase(req.params.caseId, me);
    const rows = await col("assignments")
      .find({ case_id: req.params.caseId })
      .sort({ created_at: -1 })
      .limit(100)
      .toArray();
    res.json(scrubMany(cleanMany(rows as Doc[]), me));
  }),
);

// ---------------------------------------------------------------- accountant work
casesRouter.post(
  "/cases/:caseId/start-review",
  auth("ACCOUNTANT"),
  handler(async (req, res) => {
    const me = authed(req);
    const kase = await getCase(req.params.caseId, me);
    if (
      !["ASSIGNED", "AWAITING_CLIENT", "CHANGES_REQUIRED", "ACCOUNTANT_REVIEW"].includes(
        kase.status,
      )
    ) {
      throw httpError(400, "Not allowed at this stage");
    }
    await transition(kase, "ACCOUNTANT_REVIEW", me, "Accountant started review");
    await sendCase(res, req.params.caseId, me);
  }),
);

casesRouter.post(
  "/cases/:caseId/mark-reviewed",
  auth("ACCOUNTANT"),
  handler(async (req, res) => {
    const me = authed(req);
    const kase = await getCase(req.params.caseId, me);
    await transition(kase, "IN_PREPARATION", me, "Information marked as reviewed");
    await sendCase(res, req.params.caseId, me);
  }),
);

casesRouter.post(
  "/cases/:caseId/request-from-client",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = req.params.caseId;
    const body = parseBody(RequestIn, req.body);
    const kase = await getCase(caseId, me);
    if (!(ALLOWED_TRANSITIONS[kase.status] ?? []).includes("AWAITING_CLIENT")) {
      throw httpError(
        400,
        `Information cannot be requested from the client at this stage (${kase.status})`,
      );
    }
    const reqId = randomUUID();
    const taskId = randomUUID();
    // Idempotency: one genuine request produces one genuine task/request/document. A repeated
    // click, refresh or retry for the same still-open item reuses the existing records.
    const existingTask = await col("tasks").findOne({
      case_id: caseId,
      name: body.title,
      owner_role: "CLIENT",
      status: "OPEN",
    });
    if (existingTask) {
      await transition(kase, "AWAITING_CLIENT", me, `Requested from client: ${body.title}`, {
        waitingReason: body.title,
      });
      res.json({ ok: true, task_id: existingTask.id, duplicate_prevented: true });
      return;
    }
    await col("tasks").insertOne({
      id: taskId,
      case_id: caseId,
      case_ref: kase.case_ref,
      name: body.title,
      description: body.description,
      owner_role: "CLIENT",
      owner_id: kase.client_user_id,
      due_date: body.due_date,
      status: "OPEN",
      mandatory: body.mandatory,
      created_by: me.id,
      created_by_name: me.name,
      created_at: nowIso(),
      completed_date: null,
      request_id: reqId,
    });
    if (body.document_required) {
      await col("document_requests").insertOne({
        id: reqId,
        case_id: caseId,
        client_user_id: kase.client_user_id,
        title: body.title,
        description: body.description,
        task_id: taskId,
        status: "Requested",
        requested_by: me.id,
        requested_by_name: me.name,
        due_date: body.due_date,
        created_at: nowIso(),
      });
      await col("documents").insertOne({
        id: randomUUID(),
        case_id: caseId,
        client_user_id: kase.client_user_id,
        tax_year: kase.tax_year,
        document_type: body.title,
        name: body.title,
        status: "Requested",
        request_id: reqId,
        task_id: taskId,
        storage_path: null,
        uploader_id: null,
        uploader_name: null,
        content_type: null,
        size: 0,
        is_internal: false,
        created_at: nowIso(),
        upload_date: null,
      });
    }
    if (body.message) {
      await col("messages").insertOne({
        id: randomUUID(),
        case_id: caseId,
        sender_id: me.id,
        sender_name: me.name,
        sender_role: me.role,
        recipient_id: kase.client_user_id,
        body: body.message,
        is_read: false,
        created_at: nowIso(),
      });
    }
    await notify(
      kase.client_user_id,
      `Action required: ${body.title}`,
      body.description || "Your accountant needs information from you.",
      caseId,
      `/tasks?task=${taskId}`,
      "TASK",
    );
    await transition(kase, "AWAITING_CLIENT", me, `Requested from client: ${body.title}`, {
      waitingReason: body.title,
    });
    res.json({ ok: true, task_id: taskId, request_id: reqId });
  }),
);

// ---------------------------------------------------------------- calculations
casesRouter.post(
  "/cases/:caseId/calculations",
  auth("ACCOUNTANT"),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = req.params.caseId;
    const body = parseBody(CalcIn, req.body);
    const kase = await getCase(caseId, me);
    if (["SUBMITTED", "COMPLETED"].includes(kase.status)) throw httpError(400, "This case is locked");
    const count = await col("calculation_versions").countDocuments({ case_id: caseId });
    const calc: Doc = {
      id: randomUUID(),
      case_id: caseId,
      version: count + 1,
      total_income: body.total_income,
      taxable_income: body.taxable_income,
      tax_due: body.tax_due,
      is_refund: body.is_refund,
      notes: body.notes,
      payment_deadline: body.payment_deadline || paymentDeadlineLabel(kase.tax_year),
      breakdown: body.breakdown ?? {},
      created_by: me.id,
      created_by_name: me.name,
      is_locked: false,
      is_approved: false,
      created_at: nowIso(),
    };
    await col("calculation_versions").insertOne({ ...calc });
    await transition(kase, "IN_PREPARATION", me, `Calculation V${calc.version} created`);
    res.json(clean(calc));
  }),
);

casesRouter.get(
  "/cases/:caseId/calculations",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = req.params.caseId;
    const kase = await getCase(caseId, me);
    const query: Doc = { case_id: caseId };
    // Client may only ever see admin-approved versions.
    if (me.role === "CLIENT") query.is_approved = true;
    const calcs = (await col("calculation_versions")
      .find(query)
      .sort({ version: -1 })
      .limit(100)
      .toArray()) as Doc[];
    // The payment deadline is always derived from the case tax year, so historic records that
    // stored an older literal still display the correct date.
    const derived = paymentDeadlineLabel(kase.tax_year);
    for (const c of calcs) c.payment_deadline = derived;
    res.json(scrubMany(cleanMany(calcs), me));
  }),
);

// ---------------------------------------------------------------- review / approval
casesRouter.post(
  "/cases/:caseId/submit-for-admin-review",
  auth("ACCOUNTANT"),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = req.params.caseId;
    const body = parseBody(ChecklistIn, req.body);
    const kase = await getCase(caseId, me);
    const required = [
      "client_information_reviewed",
      "required_documents_reviewed",
      "income_checked",
      "allowable_expenses_checked",
      "tax_calculation_checked",
      "supporting_documents_attached",
      "return_ready",
    ];
    const missing = required.filter((k) => !body.checklist[k]);
    if (missing.length) throw httpError(400, `Checklist incomplete: ${missing.join(", ")}`);
    const calc = await col("calculation_versions").findOne({
      id: body.calculation_version_id,
      case_id: caseId,
    });
    if (!calc) throw httpError(404, "Calculation version not found");
    await col("calculation_versions").updateOne({ id: calc.id }, { $set: { is_locked: true } });
    await col("reviews").insertOne({
      id: randomUUID(),
      case_id: caseId,
      calculation_version_id: calc.id,
      version: calc.version,
      checklist: body.checklist,
      submitted_by: me.id,
      submitted_by_name: me.name,
      submitted_at: nowIso(),
      outcome: null,
      reviewer_id: null,
      reviewer_name: null,
      reason: null,
      instructions: null,
      decided_at: null,
    });
    await transition(
      kase,
      "READY_FOR_ADMIN_REVIEW",
      me,
      `Calculation V${calc.version} sent to admin for review`,
      { comments: body.admin_note },
    );
    if (body.admin_note) {
      await col("internal_notes").insertOne({
        id: randomUUID(),
        case_id: caseId,
        body: `Note for Admin review: ${body.admin_note}`,
        author_id: me.id,
        author_name: me.name,
        author_role: me.role,
        created_at: nowIso(),
      });
      await col("reviews").updateOne(
        { case_id: caseId, calculation_version_id: calc.id },
        { $set: { accountant_note: body.admin_note } },
      );
    }
    await notifyAdmins(
      "Admin review required",
      `${kase.client_name} — V${calc.version} submitted by ${me.name}`,
      caseId,
      `/admin/review/${caseId}`,
      "REVIEW",
    );
    res.json({ ok: true });
  }),
);

casesRouter.post(
  "/cases/:caseId/admin-approve",
  auth("ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = req.params.caseId;
    const body = req.body ? parseBody(ApproveIn, req.body) : { note: null };
    const kase = await getCase(caseId, me);
    if (!["READY_FOR_ADMIN_REVIEW", "ADMIN_REVIEW"].includes(kase.status)) {
      throw httpError(400, "Case is not awaiting admin review");
    }
    const review = await col("reviews").findOne(
      { case_id: caseId, outcome: null },
      { sort: { submitted_at: -1 } },
    );
    if (!review) throw httpError(400, "No submitted work to approve");
    const adminNote = body.note ?? null;
    await col("calculation_versions").updateOne(
      { id: review.calculation_version_id },
      {
        $set: {
          is_approved: true,
          is_locked: true,
          approved_by: me.name,
          approved_at: nowIso(),
        },
      },
    );
    await col("reviews").updateOne(
      { id: review.id },
      {
        $set: {
          outcome: "APPROVED",
          reviewer_id: me.id,
          reviewer_name: me.name,
          admin_note: adminNote,
          decided_at: nowIso(),
        },
      },
    );
    await transition(kase, "ADMIN_APPROVED", me, `Admin approved V${review.version}`, {
      comments: adminNote,
      extra: {
        approved_version_id: review.calculation_version_id,
        admin_reviewer_id: me.id,
        admin_reviewer_name: me.name,
        admin_approved_at: nowIso(),
        admin_approved_by: me.name,
      },
    });
    // The approved version supersedes any earlier admin change request, so its task is
    // resolved. The original return-for-changes stays in the activity history.
    const closed = await col("tasks").updateMany(
      { case_id: caseId, status: "OPEN", name: { $regex: "^Admin changes required" } },
      { $set: { status: "COMPLETED", completed_at: nowIso(), completed_by_name: me.name } },
    );
    if (closed.modifiedCount) {
      await logActivity(caseId, "Admin change request resolved by the approved version", me, {
        tasks_closed: closed.modifiedCount,
      });
    }
    await transition(
      kase,
      "AWAITING_CLIENT_APPROVAL",
      me,
      "Approved calculation released to client for review",
    );
    await notify(
      kase.client_user_id,
      "Your tax return is ready to review",
      "Your Self Assessment calculation has been approved and is ready for your review.",
      caseId,
      "/my-return",
      "APPROVAL",
    );
    if (kase.assigned_accountant_id) {
      await notify(
        kase.assigned_accountant_id,
        "Admin approved your work",
        `V${review.version} approved for ${kase.client_name}`,
        caseId,
        `/work/cases/${caseId}`,
        "APPROVAL",
      );
    }
    await sendCase(res, caseId, me);
  }),
);

casesRouter.post(
  "/cases/:caseId/admin-return",
  auth("ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = req.params.caseId;
    const body = parseBody(ReturnChangesIn, req.body);
    const kase = await getCase(caseId, me);
    const review = await col("reviews").findOne(
      { case_id: caseId, outcome: null },
      { sort: { submitted_at: -1 } },
    );
    if (!review) throw httpError(400, "No submitted work to return");
    await col("reviews").updateOne(
      { id: review.id },
      {
        $set: {
          outcome: "CHANGES_REQUIRED",
          reviewer_id: me.id,
          reviewer_name: me.name,
          reason: body.reason,
          instructions: body.instructions,
          decided_at: nowIso(),
        },
      },
    );
    await col("tasks").insertOne({
      id: randomUUID(),
      case_id: caseId,
      case_ref: kase.case_ref,
      name: `Admin changes required: ${body.reason}`,
      description: body.instructions,
      owner_role: "ACCOUNTANT",
      owner_id: kase.assigned_accountant_id ?? null,
      due_date: null,
      status: "OPEN",
      created_by: me.id,
      created_by_name: me.name,
      created_at: nowIso(),
      completed_date: null,
    });
    await transition(
      kase,
      "CHANGES_REQUIRED",
      me,
      `Admin returned V${review.version} for changes: ${body.reason}`,
      { comments: body.instructions },
    );
    if (kase.assigned_accountant_id) {
      await notify(
        kase.assigned_accountant_id,
        "Admin returned changes",
        `${kase.client_name}: ${body.reason}`,
        caseId,
        `/work/cases/${caseId}`,
        "CHANGES",
      );
    }
    await sendCase(res, caseId, me);
  }),
);

casesRouter.post(
  "/cases/:caseId/client-approve",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = req.params.caseId;
    const kase = await getCase(caseId, me);
    if (!["ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL"].includes(kase.status)) {
      throw httpError(400, "Return is not ready for your approval");
    }
    const calc = await col("calculation_versions").findOne({ id: kase.approved_version_id });
    await col("client_approvals").insertOne({
      id: randomUUID(),
      case_id: caseId,
      client_user_id: me.id,
      client_name: me.name,
      calculation_version_id: kase.approved_version_id,
      version: calc ? calc.version : null,
      confirmation:
        "I confirm the information is complete and correct to the best of my knowledge.",
      approved_at: nowIso(),
    });
    await transition(kase, "CLIENT_APPROVED", me, `Client approved V${calc ? calc.version : ""}`, {
      extra: { client_approved_at: nowIso() },
    });
    const blocking = await col("tasks").countDocuments({ case_id: caseId, status: "OPEN" });
    if (blocking) {
      // Client approval stands, but the case cannot be ready for submission while work is open.
      await sendCase(res, caseId, me);
      return;
    }
    await transition(kase, "READY_FOR_SUBMISSION", me, "Case ready for submission");
    await col("submission_records").insertOne({
      id: randomUUID(),
      case_id: caseId,
      status: "READY",
      calculation_version_id: kase.approved_version_id,
      reference: null,
      created_at: nowIso(),
    });
    if (kase.assigned_accountant_id) {
      await notify(
        kase.assigned_accountant_id,
        "Client approved the return",
        `${kase.client_name} approved their tax return.`,
        caseId,
        `/work/cases/${caseId}`,
        "APPROVAL",
      );
    }
    await notifyAdmins(
      "Ready for submission",
      `${kase.client_name} — ${kase.case_ref}`,
      caseId,
      `/admin/cases/${caseId}`,
      "SUBMISSION",
    );
    await sendCase(res, caseId, me);
  }),
);

// ---------------------------------------------------------------- submission
/** Records an out-of-band submission. Requires admin approval AND client approval. */
casesRouter.post(
  "/cases/:caseId/record-submission",
  auth("ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = req.params.caseId;
    const body = parseBody(SubmissionIn, req.body);
    const kase = await getCase(caseId, me);
    if (kase.status === "COMPLETED") {
      throw httpError(400, "Completed cases are locked — reopen the case first");
    }
    if (kase.status === "SUBMITTED") {
      // Idempotent: a double-click or repeated request returns the existing record rather
      // than creating a second submission.
      await sendCase(res, caseId, me);
      return;
    }
    if (!body.submission_date.trim() || !body.submission_reference.trim()) {
      throw httpError(400, "Submission date and submission reference are required");
    }
    const review = await col("reviews").findOne({ case_id: caseId, outcome: "APPROVED" });
    const approval = await col("client_approvals").findOne({ case_id: caseId });
    if (!review || !kase.approved_version_id) throw httpError(400, "Admin approval is not complete");
    if (!approval) throw httpError(400, "Client approval is not complete");
    if (kase.status !== "READY_FOR_SUBMISSION") {
      throw httpError(400, `Case must be READY_FOR_SUBMISSION (currently ${kase.status})`);
    }
    const blocking = await col("tasks").countDocuments({ case_id: caseId, status: "OPEN" });
    if (blocking) {
      throw httpError(
        400,
        `${blocking} item(s) are still outstanding on this case — ` +
          "these must be resolved before a submission can be recorded",
      );
    }
    await col("submission_records").updateOne(
      { case_id: caseId },
      {
        $set: {
          status: "SUBMITTED",
          case_id: caseId,
          case_ref: kase.case_ref,
          submission_date: body.submission_date,
          reference: body.submission_reference,
          submitted_by: me.id,
          submitted_by_name: me.name,
          submitted_by_role: me.role,
          note: body.note,
          provider: body.provider,
          evidence_document_id: body.evidence_document_id,
          calculation_version_id: kase.approved_version_id,
          recorded_at: nowIso(),
        },
      },
      { upsert: true },
    );
    await transition(
      kase,
      "SUBMITTED",
      me,
      `Submission recorded (ref ${body.submission_reference}` +
        `${body.provider ? `, via ${body.provider}` : ""})`,
      {
        comments: body.note,
        extra: {
          submission_reference: body.submission_reference,
          submission_date: body.submission_date,
          submission_provider: body.provider,
          submitted_by_name: me.name,
        },
      },
    );
    await notify(
      kase.client_user_id,
      "Your tax return has been submitted",
      `Submission reference ${body.submission_reference}`,
      caseId,
      "/my-return",
      "SUBMISSION",
    );
    if (kase.assigned_accountant_id) {
      await notify(
        kase.assigned_accountant_id,
        "Submission recorded",
        `${kase.client_name} — ref ${body.submission_reference}`,
        caseId,
        `/work/cases/${caseId}`,
        "SUBMISSION",
      );
    }
    await sendCase(res, caseId, me);
  }),
);

casesRouter.post(
  "/cases/:caseId/complete",
  auth("ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = req.params.caseId;
    const body = req.body ? parseBody(ApproveIn, req.body) : { note: null };
    const kase = await getCase(caseId, me);
    if (kase.status !== "SUBMITTED") throw httpError(400, "Case must be SUBMITTED before completion");
    await transition(kase, "COMPLETED", me, "Case marked completed", {
      comments: body.note ?? null,
      extra: {
        completed_at: nowIso(),
        completed_by_name: me.name,
        completed_by_id: me.id,
      },
    });
    await col("submission_records").updateOne(
      { case_id: caseId },
      { $set: { status: "COMPLETED", completed_at: nowIso() } },
    );
    await notify(
      kase.client_user_id,
      "Your Self Assessment is complete",
      "Your case has been completed by TaxSimba.",
      caseId,
      "/my-return",
      "INFO",
    );
    await sendCase(res, caseId, me);
  }),
);

casesRouter.get(
  "/cases/:caseId/submission",
  auth(),
  handler(async (req, res) => {
    await getCase(req.params.caseId, authed(req));
    const rec = await col("submission_records").findOne({ case_id: req.params.caseId });
    res.json(rec ? clean(rec as Doc) : null);
  }),
);

/** Completed cases are locked; reopening requires a reason and is audited. */
casesRouter.post(
  "/cases/:caseId/reopen",
  auth("ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = req.params.caseId;
    const body = parseBody(ReasonIn, req.body);
    const kase = await getCase(caseId, me);
    if (kase.status !== "COMPLETED") throw httpError(400, "Only completed cases can be reopened");
    if (!body.reason.trim()) throw httpError(400, "A reason is required to reopen a case");
    const target = kase.assigned_accountant_id ? "ACCOUNTANT_REVIEW" : "ASSIGNED";
    await transition(kase, target, me, `Case reopened by ${me.name}`, { comments: body.reason });
    if (kase.assigned_accountant_id) {
      await notify(
        kase.assigned_accountant_id,
        "Case reopened",
        `${kase.client_name}: ${body.reason}`,
        caseId,
        `/work/cases/${caseId}`,
        "CHANGES",
      );
    }
    await sendCase(res, caseId, me);
  }),
);

// ---------------------------------------------------------------- tasks
casesRouter.get(
  "/tasks",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = str(req, "case_id");
    const serviceType = str(req, "service_type");
    const query: Doc = {};
    if (me.role === "CLIENT") {
      // Scoped by owned CASES, not by the task's own owner_id copy.
      query.case_id = { $in: await ownedCaseIds(me, serviceType) };
      query.owner_id = me.id;
      query.owner_role = "CLIENT";
    } else {
      if (serviceType) {
        const ids = await col("cases")
          .find({ service_type: serviceType }, { projection: { id: 1 } })
          .toArray();
        query.case_id = { $in: ids.map((c) => c.id) };
      }
      if (me.role === "ACCOUNTANT" && !caseId) query.owner_id = me.id;
    }
    if (caseId) {
      await getCase(caseId, me);
      query.case_id = caseId;
      if (me.role === "CLIENT") {
        query.owner_role = "CLIENT";
        query.owner_id = me.id;
      }
    }
    const status = str(req, "status");
    if (status) query.status = status;
    const tasks = cleanMany(
      (await col("tasks").find(query).sort({ created_at: -1 }).limit(300).toArray()) as Doc[],
    );
    // Tax year comes from the parent case; fetched in one query for the whole page.
    const ids = Array.from(new Set(tasks.map((t) => t.case_id).filter(Boolean)));
    const years: Record<string, string> = {};
    const rows = await col("cases")
      .find({ id: { $in: ids } }, { projection: { id: 1, tax_year: 1 } })
      .toArray();
    for (const row of rows) years[row.id as string] = row.tax_year;
    for (const t of tasks) t.tax_year = years[t.case_id] ?? null;
    res.json(scrubMany(tasks, me));
  }),
);

casesRouter.post(
  "/tasks/:taskId/complete",
  auth(),
  handler(async (req, res) => {
    await completeTask(req.params.taskId, authed(req));
    res.json({ ok: true });
  }),
);
