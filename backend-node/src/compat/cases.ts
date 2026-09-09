/**
 * Cases / tax-return compat adapters (P0 K.5 / baseline C1–C7).
 * Thin path/field maps — calls getCase, workflow.transition, existing case routes logic.
 */
import { Router } from "express";
import multer from "multer";
import { z } from "zod";

import { clean, col, Doc } from "../db/mongo";
import {
  assertClientCanAccessService,
  preferExistingServiceCase,
} from "../domain/caseEntitlement";
import { getCase } from "../domain/cases";
import { MTD, SELF_ASSESSMENT } from "../domain/packages";
import {
  ALLOWED_TRANSITIONS,
  STATUSES,
  clientStatus,
  journey,
  transition,
} from "../domain/workflow";
import { handler, httpError, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import { categoryToServiceType } from "./ownership";
import { keysToCamel, keysToSnake } from "./caseMap";
import { sendCompatSuccess } from "./envelope";
import { toCaseId, withTaxReturnId } from "./ids";

export const compatCasesRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

function serviceTypeFromBody(body: Record<string, unknown>): string {
  const raw =
    body.service_type ??
    body.serviceType ??
    body.category ??
    body.tax_return_type ??
    body.taxReturnType ??
    null;
  if (typeof raw === "string" && raw.trim()) {
    const mapped = categoryToServiceType(raw) ?? raw.trim().toUpperCase();
    if (mapped === SELF_ASSESSMENT || mapped === "SELF_ASSESSMENT" || mapped === "SA") {
      return SELF_ASSESSMENT;
    }
    if (mapped === MTD || mapped === "MTD_INCOME_TAX" || mapped === "MTD") return MTD;
    if (mapped === SELF_ASSESSMENT || mapped === MTD) return mapped;
  }
  return SELF_ASSESSMENT;
}

function decorateCase(kase: Doc): Doc {
  return withTaxReturnId({
    ...kase,
    tax_return_id: kase.id,
    case_id: kase.id,
    status_label: clientStatus(String(kase.status)),
  });
}

/** Prefer activation-created case; CLIENT must be ACTIVE for service_type. */
compatCasesRouter.post(
  "/client/apply-tax-return",
  auth("CLIENT"),
  upload.any(),
  handler(async (req, res) => {
    const me = authed(req);
    const body = {
      ...(typeof req.body === "object" && req.body ? req.body : {}),
    } as Record<string, unknown>;
    const serviceType = serviceTypeFromBody(keysToSnake(body) as Record<string, unknown>);
    await assertClientCanAccessService(me, serviceType);

    const existing = await preferExistingServiceCase(me, serviceType);
    if (!existing) {
      throw httpError(
        400,
        "No service case found. Complete purchase activation before applying a tax return.",
      );
    }
    // Prefer fulfilment spine — do not create a second case here.
    const kase = await getCase(String(existing.id), me);
    sendCompatSuccess(
      res,
      {
        taxReturn: decorateCase(kase),
        preferredExisting: true,
      },
      "Tax return ready",
      201,
    );
  }),
);

compatCasesRouter.post(
  "/client/all-tax-returns",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    // Reuse list semantics: only ACTIVE-entitlement cases.
    const { activeServiceTypesForClient } = await import("../domain/caseEntitlement");
    const activeTypes = await activeServiceTypesForClient(me);
    if (!activeTypes.length) {
      sendCompatSuccess(res, [], "OK");
      return;
    }
    const client = await col("clients").findOne({ user_id: me.id });
    const query: Doc = {
      service_type: { $in: activeTypes },
      $or: client
        ? [{ client_user_id: me.id }, { client_id: client.id }]
        : [{ client_user_id: me.id }],
    };
    const cases = (await col("cases")
      .find(query)
      .sort({ last_updated: -1 })
      .limit(100)
      .toArray()) as Doc[];
    sendCompatSuccess(
      res,
      cases.map((c) => decorateCase(clean(c) as Doc)),
      "OK",
    );
  }),
);

compatCasesRouter.post(
  "/tax-return/:taxReturnId/progress",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = toCaseId(req.params.taxReturnId);
    const kase = await getCase(caseId, me);
    const submission = await col("submission_records").findOne({
      case_id: caseId,
      status: { $in: ["SUBMITTED", "COMPLETED"] },
    });
    sendCompatSuccess(res, await buildProgressPayload(kase, me, !!submission), "OK");
  }),
);

/** Map Node case status → Toxel progress step keys used by admin/accountant FE. */
function nodeToToxelStatus(status: string): string {
  switch (String(status)) {
    case "NEW":
    case "ONBOARDING":
    case "AWAITING_ASSIGNMENT":
      return "pending_assignment";
    case "ASSIGNED":
      return "assigned";
    case "ACCOUNTANT_REVIEW":
    case "AWAITING_CLIENT":
    case "IN_PREPARATION":
    case "READY_FOR_ADMIN_REVIEW":
    case "ADMIN_REVIEW":
    case "CHANGES_REQUIRED":
      return "preparation_started";
    case "ADMIN_APPROVED":
    case "AWAITING_CLIENT_APPROVAL":
    case "CLIENT_APPROVED":
    case "READY_FOR_SUBMISSION":
      return "draft_ready";
    case "SUBMISSION_IN_PROGRESS":
    case "SUBMITTED":
    case "SUBMISSION_ISSUE":
      return "final_submitted";
    case "COMPLETED":
      return "completed";
    default:
      return "pending_assignment";
  }
}

function toxelToPreferredNodeStatus(toxel: string, currentNodeStatus?: string): string | null {
  const s = String(toxel || "").toLowerCase();
  const current = String(currentNodeStatus || "");
  const map: Record<string, string> = {
    pending_payment: "AWAITING_ASSIGNMENT",
    pending_assignment: "AWAITING_ASSIGNMENT",
    assigned: "ASSIGNED",
    preparation_started: "IN_PREPARATION",
    draft_ready: "AWAITING_CLIENT_APPROVAL",
    final_submitted: "SUBMITTED",
    completed: "COMPLETED",
  };
  let preferred: string | null = map[s] ?? null;
  if (!preferred) {
    const upper = String(toxel || "").toUpperCase();
    preferred = STATUSES.includes(upper) ? upper : null;
  }
  if (!preferred) return null;
  // Whitelist-aware soft map: ASSIGNED cannot jump to IN_PREPARATION.
  if (preferred === "IN_PREPARATION" && current === "ASSIGNED") {
    return "ACCOUNTANT_REVIEW";
  }
  if (preferred === "AWAITING_CLIENT_APPROVAL" && current === "ADMIN_APPROVED") {
    return "AWAITING_CLIENT_APPROVAL";
  }
  const allowed = ALLOWED_TRANSITIONS[current] ?? [];
  if (allowed.includes(preferred)) return preferred;
  // Prefer any allowed status that lands in the same Toxel bucket.
  const bucket = nodeToToxelStatus(preferred);
  const alt = allowed.find((st) => nodeToToxelStatus(st) === bucket);
  return alt ?? preferred;
}

async function buildProgressPayload(kase: Doc, me: Doc, hasSubmission: boolean): Promise<Doc> {
  const toxelStatus = nodeToToxelStatus(String(kase.status));
  const stepsDef = [
    { key: "pending_assignment", label: "Assignment Pending", order: 0 },
    { key: "assigned", label: "Assigned", order: 1 },
    { key: "preparation_started", label: "Preparation Started", order: 2 },
    { key: "draft_ready", label: "Draft Ready", order: 3 },
    // Accountant-led: external filing recorded in TaxSimba — not HMRC API.
    { key: "final_submitted", label: "External Submission Recorded", order: 4 },
    { key: "completed", label: "Completed", order: 5 },
  ];
  const currentOrder = stepsDef.find((s) => s.key === toxelStatus)?.order ?? 0;
  const progressSteps = stepsDef.map((s) => ({
    ...s,
    completed: s.order < currentOrder,
    current: s.key === toxelStatus,
  }));
  const completedCount = progressSteps.filter((s) => s.completed).length;
  const progressPercentage = Math.round(
    ((completedCount + (toxelStatus === "completed" ? 1 : 0.5)) / progressSteps.length) * 100,
  );

  const clientUser = (await col("users").findOne(
    { id: kase.client_user_id },
    { projection: { password_hash: 0, totp: 0, recovery_code_hashes: 0 } },
  )) as Doc | null;
  const nameParts = String(clientUser?.name ?? kase.client_name ?? "")
    .trim()
    .split(/\s+/);
  const canUpdate =
    me.role === "ADMIN" ||
    me.role === "SUPER_ADMIN" ||
    (me.role === "ACCOUNTANT" && kase.assigned_accountant_id === me.id);

  let accountant: Doc | null = null;
  if (kase.assigned_accountant_id) {
    const acc = (await col("users").findOne(
      { id: kase.assigned_accountant_id },
      { projection: { id: 1, name: 1, email: 1, phone: 1 } },
    )) as Doc | null;
    accountant = acc
      ? { name: acc.name, email: acc.email, mobile: acc.phone ?? "", avatar: null }
      : { name: kase.assigned_accountant_name ?? "Accountant", email: null, mobile: "" };
  }

  const journeySteps = journey(String(kase.status), hasSubmission).map((j) =>
    j.step === "HMRC Submission"
      ? { ...j, step: "External Submission" }
      : j,
  );

  return {
    ...decorateCase(kase),
    status: toxelStatus,
    statusLabel: clientStatus(String(kase.status)),
    nodeStatus: kase.status,
    priority: String(kase.priority ?? "MEDIUM").toLowerCase(),
    submissionDeadline: kase.external_deadline ?? kase.internal_deadline ?? null,
    taxReturnId: kase.case_ref ?? kase.id,
    taxYear: kase.tax_year,
    progressPercentage: Math.min(100, Math.max(0, progressPercentage)),
    createdAt: kase.created_at,
    assignedAt: kase.assigned_at ?? null,
    progressSteps,
    journey: journeySteps,
    meta: { canUpdate: Boolean(canUpdate) && toxelStatus !== "completed" },
    client: {
      id: clientUser?.id ?? kase.client_user_id,
      name: nameParts[0] || "Client",
      surname: nameParts.slice(1).join(" "),
      email: null, // contacts never unmasked here — use reveal-contact
    },
    accountant,
    adminNotes: kase.internal_instructions ?? null,
    submissionReference: kase.submission_reference ?? null,
  };
}

/** C6 — staff progress status write (Toxel path). Maps to whitelist transitions only. */
async function handleProgressWrite(req: import("express").Request, res: import("express").Response) {
  const me = authed(req);
  const caseId = toCaseId(req.params.taxReturnId);
  const kase = await getCase(caseId, me);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const requested = String(body.status ?? body.action ?? "").trim();
  if (!requested) throw httpError(400, "status is required");

  const target = toxelToPreferredNodeStatus(requested, String(kase.status));
  if (!target) throw httpError(400, `Unknown status ${requested}`);

  if (target === String(kase.status)) {
    const submission = await col("submission_records").findOne({
      case_id: caseId,
      status: { $in: ["SUBMITTED", "COMPLETED"] },
    });
    sendCompatSuccess(res, await buildProgressPayload(kase, me, !!submission), "OK");
    return;
  }

  // SUBMITTED must go through record-submission (external filing reference).
  if (target === "SUBMITTED") {
    throw httpError(
      400,
      "Record an external submission reference before marking submitted (accountant-led filing)",
    );
  }

  if (!(ALLOWED_TRANSITIONS[String(kase.status)] ?? []).includes(target)) {
    throw httpError(
      400,
      `Invalid workflow transition from ${kase.status} to ${target}`,
    );
  }
  await transition(kase, target, me, `Status updated via progress (${requested})`);
  const updated = await getCase(caseId, me);
  const submission = await col("submission_records").findOne({
    case_id: caseId,
    status: { $in: ["SUBMITTED", "COMPLETED"] },
  });
  sendCompatSuccess(res, await buildProgressPayload(updated, me, !!submission), "Updated");
}

compatCasesRouter.post(
  "/admin/tax-return/:taxReturnId/progress",
  auth("ADMIN", "SUPER_ADMIN", "ACCOUNTANT"),
  handler(handleProgressWrite),
);

compatCasesRouter.post(
  "/accountant/tax-return/:taxReturnId/progress",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(handleProgressWrite),
);

/** External filing record (accountant-led) — calls native record-submission gates. */
compatCasesRouter.post(
  "/admin/tax-return/:taxReturnId/record-submission",
  auth("ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = toCaseId(req.params.taxReturnId);
    const snake = keysToSnake(req.body ?? {}) as Record<string, unknown>;
    const submissionDate = String(snake.submission_date ?? "").trim();
    const submissionReference = String(snake.submission_reference ?? "").trim();
    const provider = snake.provider != null ? String(snake.provider) : null;
    const note = snake.note != null ? String(snake.note) : null;
    if (!submissionDate || !submissionReference) {
      throw httpError(400, "submissionDate and submissionReference are required");
    }

    // Reuse native route semantics via direct domain calls (same as routes/cases.ts).
    const kase = await getCase(caseId, me);
    if (kase.status === "COMPLETED") {
      throw httpError(400, "Completed cases are locked — reopen the case first");
    }
    if (kase.status === "SUBMITTED") {
      sendCompatSuccess(res, decorateCase(kase), "Already submitted");
      return;
    }
    const review = await col("reviews").findOne({ case_id: caseId, outcome: "APPROVED" });
    const approval = await col("client_approvals").findOne({ case_id: caseId });
    if (!review || !kase.approved_version_id) {
      throw httpError(400, "Admin approval is not complete");
    }
    if (!approval) throw httpError(400, "Client approval is not complete");
    if (kase.status !== "READY_FOR_SUBMISSION") {
      throw httpError(400, `Case must be READY_FOR_SUBMISSION (currently ${kase.status})`);
    }
    const blocking = await col("tasks").countDocuments({ case_id: caseId, status: "OPEN" });
    if (blocking) {
      throw httpError(400, `${blocking} open item(s) must be resolved before recording submission`);
    }
    const { randomUUID } = await import("crypto");
    const { nowIso, notify } = await import("../domain/workflow");
    await col("submission_records").updateOne(
      { case_id: caseId },
      {
        $set: {
          id: randomUUID(),
          status: "SUBMITTED",
          case_id: caseId,
          case_ref: kase.case_ref,
          submission_date: submissionDate,
          reference: submissionReference,
          submitted_by: me.id,
          submitted_by_name: me.name,
          submitted_by_role: me.role,
          note,
          provider,
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
      `Submission recorded (ref ${submissionReference}${provider ? `, via ${provider}` : ""})`,
      {
        comments: note,
        extra: {
          submission_reference: submissionReference,
          submission_date: submissionDate,
          submission_provider: provider,
          submitted_by_name: me.name,
        },
      },
    );
    if (kase.client_user_id) {
      await notify(
        kase.client_user_id as string,
        "Tax return submitted",
        `Submission reference ${submissionReference}`,
        caseId,
        "/dashboard",
        "SUBMISSION",
      );
    }
    const updated = await getCase(caseId, me);
    sendCompatSuccess(res, decorateCase(updated), "Submission recorded");
  }),
);

const AssignIn = z.object({
  accountant_id: z.string().optional(),
  accountantId: z.string().optional(),
  tax_return_id: z.string().optional(),
  taxReturnId: z.string().optional(),
  case_id: z.string().optional(),
  caseId: z.string().optional(),
  priority: z.string().default("MEDIUM"),
  internal_deadline: z.string().nullish().optional(),
  internalDeadline: z.string().nullish().optional(),
  deadline: z.string().nullish().optional(),
  notes: z.string().nullish().optional(),
  internal_instructions: z.string().nullish().optional(),
});

/** C5 — map Toxel admin/assign → existing assign semantics via transition whitelist. */
compatCasesRouter.post(
  "/admin/assign",
  auth("ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(AssignIn, req.body ?? {});
    const taxReturnId =
      body.taxReturnId ?? body.tax_return_id ?? body.caseId ?? body.case_id ?? null;
    if (!taxReturnId) throw httpError(400, "taxReturnId is required");
    const accountantId = body.accountantId ?? body.accountant_id;
    if (!accountantId) throw httpError(400, "accountantId is required");
    const caseId = toCaseId(String(taxReturnId));
    const kase = await getCase(caseId, me);
    if (kase.status === "COMPLETED") {
      throw httpError(400, "Completed cases are locked — reopen the case first");
    }
    const acc = await col("users").findOne({
      id: accountantId,
      role: "ACCOUNTANT",
      is_active: true,
    });
    if (!acc) throw httpError(404, "Accountant not found");

    const { randomUUID } = await import("crypto");
    const { nowIso, logActivity, notify } = await import("../domain/workflow");
    await col("assignments").insertOne({
      id: randomUUID(),
      case_id: caseId,
      accountant_id: acc.id,
      accountant_name: acc.name,
      assigned_by: me.id,
      assigned_by_name: me.name,
      priority: body.priority ?? "MEDIUM",
      internal_deadline:
        body.internalDeadline ?? body.internal_deadline ?? body.deadline ?? null,
      internal_instructions: body.notes ?? body.internal_instructions ?? null,
      created_at: nowIso(),
    });
    const extra: Doc = {
      assigned_accountant_id: acc.id,
      assigned_accountant_name: acc.name,
      priority: body.priority ?? "MEDIUM",
    };
    const deadline = body.internalDeadline ?? body.internal_deadline ?? body.deadline;
    if (deadline) {
      extra.internal_deadline = deadline;
    }
    if (body.notes ?? body.internal_instructions) {
      extra.internal_instructions = body.notes ?? body.internal_instructions;
    }
    // Only transition to ASSIGNED when the whitelist allows it; reassignment keeps status.
    if ((ALLOWED_TRANSITIONS[String(kase.status)] ?? []).includes("ASSIGNED")) {
      await transition(kase, "ASSIGNED", me, `Assigned to ${acc.name}`, { extra });
    } else {
      await col("cases").updateOne(
        { id: caseId },
        { $set: { ...extra, last_updated: nowIso() } },
      );
      await logActivity(caseId, `Reassigned to ${acc.name}`, me);
    }
    await notify(
      String(acc.id),
      "Case assigned to you",
      `${kase.client_name} — ${kase.case_ref}`,
      caseId,
      `/work/cases/${caseId}`,
      "ASSIGNMENT",
    );
    const updated = await getCase(caseId, me);
    sendCompatSuccess(res, decorateCase(updated), "Assigned");
  }),
);

const ReviewIn = z.object({
  action: z.string().optional(),
  status: z.string().optional(),
  note: z.string().nullish().optional(),
  reason: z.string().nullish().optional(),
  instructions: z.string().nullish().optional(),
});

/**
 * C6 — progress/manage-review: only whitelist transitions / existing approve|return actions.
 * Unknown free-form status updates are rejected.
 */
async function handleManageReview(req: import("express").Request, res: import("express").Response) {
  const me = authed(req);
  const snake = keysToSnake(req.body ?? {}) as Record<string, unknown>;
  // Prefer explicit case id; if reviewId is a reviews-doc id, resolve case_id from it.
  let taxReturnId = String(
    req.params.taxReturnId ??
      snake.tax_return_id ??
      snake.case_id ??
      snake.taxReturnId ??
      snake.caseId ??
      "",
  ).trim();
  if (!taxReturnId && req.params.reviewId) {
    const reviewDoc = (await col("reviews").findOne({ id: req.params.reviewId })) as Doc | null;
    if (reviewDoc?.case_id) taxReturnId = String(reviewDoc.case_id);
    else taxReturnId = String(req.params.reviewId);
  }
  if (!taxReturnId) throw httpError(400, "taxReturnId is required");
  const caseId = toCaseId(taxReturnId);
  const body = parseBody(ReviewIn, req.body ?? {});
  const action = String(body.action ?? "").toLowerCase();
  const requestedStatus = String(body.status ?? "").toUpperCase();

  if (action === "approve" || action === "admin-approve" || action === "admin_approve") {
    if (!["ADMIN", "SUPER_ADMIN"].includes(String(me.role))) {
      throw httpError(403, "Insufficient permissions");
    }
    const kase = await getCase(caseId, me);
    if (!(ALLOWED_TRANSITIONS[String(kase.status)] ?? []).includes("ADMIN_APPROVED")) {
      throw httpError(400, `Cannot admin-approve from status ${kase.status}`);
    }
    await transition(kase, "ADMIN_APPROVED", me, body.note ?? "Admin approved");
    const updated = await getCase(caseId, me);
    sendCompatSuccess(res, decorateCase(updated), "Approved");
    return;
  }

  if (
    action === "return" ||
    action === "reject" ||
    action === "admin-return" ||
    action === "admin_return"
  ) {
    if (!["ADMIN", "SUPER_ADMIN"].includes(String(me.role))) {
      throw httpError(403, "Insufficient permissions");
    }
    const reason = String(body.reason ?? body.note ?? "").trim();
    if (!reason) throw httpError(400, "reason is required");
    const kase = await getCase(caseId, me);
    if (!(ALLOWED_TRANSITIONS[String(kase.status)] ?? []).includes("CHANGES_REQUIRED")) {
      throw httpError(400, `Cannot return case from status ${kase.status}`);
    }
    await transition(kase, "CHANGES_REQUIRED", me, reason, {
      waitingReason: reason,
      extra: { internal_instructions: body.instructions ?? reason },
    });
    const updated = await getCase(caseId, me);
    sendCompatSuccess(res, decorateCase(updated), "Returned");
    return;
  }

  if (requestedStatus) {
    const kase = await getCase(caseId, me);
    if (!(ALLOWED_TRANSITIONS[String(kase.status)] ?? []).includes(requestedStatus)) {
      throw httpError(
        400,
        `Invalid workflow transition from ${kase.status} to ${requestedStatus}`,
      );
    }
    await transition(kase, requestedStatus, me, body.note ?? `Moved to ${requestedStatus}`);
    const updated = await getCase(caseId, me);
    sendCompatSuccess(res, decorateCase(updated), "Updated");
    return;
  }

  throw httpError(400, "Unknown review action — only whitelist transitions are allowed");
}

compatCasesRouter.post(
  "/admin/manage-review",
  auth("ADMIN", "SUPER_ADMIN", "ACCOUNTANT"),
  handler(handleManageReview),
);

compatCasesRouter.post(
  "/admin/manage-review/:reviewId",
  auth("ADMIN", "SUPER_ADMIN", "ACCOUNTANT"),
  handler(handleManageReview),
);

async function handleGetReview(req: import("express").Request, res: import("express").Response) {
  const me = authed(req);
  const caseId = toCaseId(req.params.taxReturnId);
  const kase = await getCase(caseId, me);
  const reviews = await col("reviews")
    .find({ case_id: caseId })
    .sort({ submitted_at: -1 })
    .limit(50)
    .toArray();
  sendCompatSuccess(
    res,
    {
      case: decorateCase(kase),
      reviews: keysToCamel(reviews),
      allowedTransitions: ALLOWED_TRANSITIONS[String(kase.status)] ?? [],
    },
    "OK",
  );
}

compatCasesRouter.get(
  "/admin/get-review/:taxReturnId",
  auth("ADMIN", "SUPER_ADMIN", "ACCOUNTANT"),
  handler(handleGetReview),
);

/** FE uses POST for get-review. */
compatCasesRouter.post(
  "/admin/get-review/:taxReturnId",
  auth("ADMIN", "SUPER_ADMIN", "ACCOUNTANT"),
  handler(handleGetReview),
);

compatCasesRouter.post(
  "/accountant/get-review/:taxReturnId",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(handleGetReview),
);
