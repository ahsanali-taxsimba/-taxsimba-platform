/**
 * Additional-work payment-request compat adapters (P0 K.8 / baseline AW1–AW4).
 * Thin camelCase aliases onto domain/additionalWork — same data model as native routes.
 * VERIFY-BEFORE-PURCHASE and fulfil ADDITIONAL_WORK behaviour stay in domain/native.
 */
import { Router } from "express";
import { z } from "zod";

import {
  cancelAdditionalWorkRequest,
  createAdditionalWorkRequest,
  getAdditionalWorkReceiptHtml,
  listMyPayments,
  listPaymentRequests,
  resendAdditionalWorkRequest,
  startAdditionalWorkCheckout,
} from "../domain/additionalWork";
import { handler, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import { keysToCamel, keysToSnake } from "./caseMap";
import { sendCompatSuccess } from "./envelope";
import { toCaseId } from "./ids";

export const compatAwRouter = Router();

const STAFF_ADMIN = ["ADMIN", "SUPER_ADMIN"] as const;

const CreateAwIn = z.object({
  case_id: z.string().min(1),
  description: z.string(),
  amount: z.number(),
  due_date: z.string().nullish().optional(),
  internal_note: z.string().nullish().optional(),
  recommendation_id: z.string().nullish().optional(),
  mtd_period_id: z.string().nullish().optional(),
  vat_rate: z.number().nullish().optional(),
});

const CheckoutIn = z.object({
  origin_url: z.string().min(1),
});

function resolveCaseId(raw: Record<string, unknown>): string {
  const id =
    raw.case_id ??
    raw.caseId ??
    raw.tax_return_id ??
    raw.taxReturnId ??
    null;
  if (!id) return "";
  return toCaseId(String(id));
}

/** AW1 — admin create (Toxel path alias). */
compatAwRouter.post(
  "/admin/payment-requests",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const me = authed(req);
    const snake = keysToSnake(req.body ?? {}) as Record<string, unknown>;
    const caseId = resolveCaseId(snake);
    const body = parseBody(CreateAwIn, {
      ...snake,
      case_id: caseId || snake.case_id,
      amount: Number(snake.amount),
    });
    const tx = await createAdditionalWorkRequest(me, {
      ...body,
      case_id: toCaseId(body.case_id),
    });
    sendCompatSuccess(res, keysToCamel(tx), "Payment request created", 201);
  }),
);

/** AW4 — staff list (optional case filter). Also accepts POST for Toxel-style clients. */
async function staffList(req: import("express").Request, res: import("express").Response) {
  const me = authed(req);
  const qCase =
    (typeof req.query.case_id === "string" && req.query.case_id) ||
    (typeof req.query.caseId === "string" && req.query.caseId) ||
    (typeof req.query.taxReturnId === "string" && req.query.taxReturnId) ||
    null;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const bodyCase = resolveCaseId(keysToSnake(body) as Record<string, unknown>) || null;
  const caseId = qCase ? toCaseId(qCase) : bodyCase;
  const rows = await listPaymentRequests(me, caseId || null);
  sendCompatSuccess(res, { paymentRequests: keysToCamel(rows) }, "OK");
}

compatAwRouter.get("/admin/payment-requests", auth(...STAFF_ADMIN), handler(staffList));
compatAwRouter.post("/admin/payment-requests/list", auth(...STAFF_ADMIN), handler(staffList));

compatAwRouter.post(
  "/admin/payment-requests/:requestId/cancel",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    await cancelAdditionalWorkRequest(authed(req), req.params.requestId);
    sendCompatSuccess(res, { ok: true }, "Cancelled");
  }),
);

compatAwRouter.post(
  "/admin/payment-requests/:requestId/resend",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    await resendAdditionalWorkRequest(authed(req), req.params.requestId);
    sendCompatSuccess(res, { ok: true }, "Resent");
  }),
);

/** Accountant case-scoped list (AW4). */
compatAwRouter.get(
  "/accountant/payment-requests",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId =
      typeof req.query.case_id === "string"
        ? toCaseId(req.query.case_id)
        : typeof req.query.taxReturnId === "string"
          ? toCaseId(req.query.taxReturnId)
          : null;
    const rows = await listPaymentRequests(me, caseId);
    sendCompatSuccess(res, { paymentRequests: keysToCamel(rows) }, "OK");
  }),
);

/** AW2 — client pending / all AW requests. */
compatAwRouter.get(
  "/client/payment-requests",
  auth("CLIENT"),
  handler(async (req, res) => {
    const rows = await listPaymentRequests(authed(req), null);
    sendCompatSuccess(res, { paymentRequests: keysToCamel(rows) }, "OK");
  }),
);

/** AW2 — map billing history list onto my-payments (includes AW). */
compatAwRouter.get(
  "/client/transaction/list",
  auth("CLIENT"),
  handler(async (req, res) => {
    const rows = await listMyPayments(authed(req));
    const transactions = rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      amount: r.amount,
      currency: r.currency ?? "gbp",
      description:
        r.kind === "ADDITIONAL_WORK"
          ? r.description || "Additional work"
          : r.kind === "SA_UPGRADE"
            ? `Package upgrade${r.new_package ? `: ${r.new_package}` : ""}`
            : r.description || "Service activation",
      status:
        r.payment_status === "paid"
          ? "succeeded"
          : r.payment_status === "cancelled"
            ? "cancelled"
            : r.payment_status,
      paymentStatus: r.payment_status,
      createdAt: r.created_at,
      caseRef: r.case_ref ?? null,
      modeOfPayment: "stripe_checkout",
    }));
    sendCompatSuccess(res, { transactions }, "OK");
  }),
);

/** AW3 — client Checkout Session start (verified email enforced in domain). */
compatAwRouter.post(
  "/client/payment-requests/:requestId/checkout",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(CheckoutIn, keysToSnake(req.body ?? {}));
    const result = await startAdditionalWorkCheckout(me, req.params.requestId, body.origin_url);
    sendCompatSuccess(res, keysToCamel(result), "Checkout session created");
  }),
);

/** Receipt HTML (same as native). */
compatAwRouter.get(
  "/client/payment-requests/:requestId/receipt",
  auth("CLIENT", "ADMIN", "SUPER_ADMIN", "ACCOUNTANT"),
  handler(async (req, res) => {
    const { html, number } = await getAdditionalWorkReceiptHtml(
      authed(req),
      req.params.requestId,
    );
    res.setHeader("Content-Type", "text/html");
    res.setHeader("Content-Disposition", `inline; filename="${number}.html"`);
    res.send(html);
  }),
);

/** Invoice download for paid txs — HTML receipt when AW; 405 for unsupported legacy PDF. */
compatAwRouter.get(
  "/client/transaction/:transactionId/invoice/download",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    try {
      const { html, number } = await getAdditionalWorkReceiptHtml(me, req.params.transactionId);
      res.setHeader("Content-Type", "text/html");
      res.setHeader("Content-Disposition", `attachment; filename="${number}.html"`);
      res.send(html);
    } catch {
      // Non-AW or missing receipt — deferred PDF path.
      const { httpError } = await import("../http/errors");
      throw httpError(405, "Invoice download for this transaction is not available in P0");
    }
  }),
);
