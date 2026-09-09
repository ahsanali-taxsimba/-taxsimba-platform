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
    sendCompatSuccess(
      res,
      {
        ...decorateCase(kase),
        journey: journey(String(kase.status), !!submission),
        statusLabel: clientStatus(String(kase.status)),
      },
      "OK",
    );
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
  const taxReturnId = String(
    req.params.taxReturnId ??
      req.params.reviewId ??
      snake.tax_return_id ??
      snake.case_id ??
      snake.id ??
      "",
  ).trim();
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
