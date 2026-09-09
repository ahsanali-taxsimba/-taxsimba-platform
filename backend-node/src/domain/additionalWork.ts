/**
 * Additional-work (AW) payment-request domain — single implementation used by
 * native `/api/payment-requests*` and thin compat aliases.
 * Never activates SA/MTD or creates service entitlement (fulfil handles AW separately).
 */
import { randomUUID } from "crypto";

import { clean, cleanMany, col, Doc } from "../db/mongo";
import { httpError } from "../http/errors";
import { logActivity, notify, nowIso } from "./workflow";
import { requireVerifiedEmail } from "../services/emailVerification";
import { renderHtml } from "../services/invoices";
import { payments } from "../services/payments";

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export type AdditionalWorkCreateInput = {
  case_id: string;
  description: string;
  amount: number;
  due_date?: string | null;
  internal_note?: string | null;
  recommendation_id?: string | null;
  mtd_period_id?: string | null;
  vat_rate?: number | null;
};

export async function createAdditionalWorkRequest(
  me: Doc,
  body: AdditionalWorkCreateInput,
): Promise<Doc> {
  const kase = (await col("cases").findOne({ id: body.case_id })) as Doc | null;
  if (!kase) throw httpError(404, "Case not found");
  if (kase.status === "COMPLETED") {
    throw httpError(400, "Completed cases are locked — reopen the case first");
  }
  if (!body.description.trim()) {
    throw httpError(400, "A description of the additional work is required");
  }
  if (body.amount <= 0) throw httpError(400, "Amount must be greater than zero");
  const total = round2(body.amount);
  const vatRate = body.vat_rate ?? null;
  const net = vatRate ? round2(total / (1 + vatRate / 100)) : total;
  const tx: Doc = {
    id: randomUUID(),
    session_id: null,
    kind: "ADDITIONAL_WORK",
    user_id: kase.client_user_id,
    client_id: kase.client_id,
    case_id: kase.id,
    case_ref: kase.case_ref,
    mtd_period_id: body.mtd_period_id ?? null,
    service_type: kase.service_type,
    tax_year: kase.tax_year ?? null,
    description: body.description.trim(),
    internal_note: body.internal_note ?? null,
    due_date: body.due_date ?? null,
    amount: total,
    currency: "gbp",
    net_amount: net,
    vat_rate: vatRate,
    vat_amount: vatRate ? round2(total - net) : 0.0,
    request_status: "SENT",
    suggested_amount: null,
    approved_amount: total,
    approved_by_name: me.name,
    approved_at: nowIso(),
    status: "sent",
    payment_status: "pending",
    fulfilled: false,
    created_by: me.id,
    created_by_name: me.name,
    created_by_role: me.role,
    sent_at: nowIso(),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  if (body.mtd_period_id) {
    const period = (await col("mtd_periods").findOne({ id: body.mtd_period_id })) as Doc | null;
    if (!period || period.case_id !== kase.id) {
      throw httpError(400, "MTD period does not belong to this case");
    }
    tx.mtd_period_label = period.label;
  }
  await col("payment_transactions").insertOne({ ...tx });
  if (body.recommendation_id) {
    const rec = (await col("recommendations").findOne({
      id: body.recommendation_id,
      type: "ADDITIONAL_WORK",
    })) as Doc | null;
    if (rec) {
      await col("payment_transactions").updateOne(
        { id: tx.id },
        {
          $set: {
            suggested_amount: rec.suggested_amount ?? null,
            requested_by_name: rec.created_by_name ?? null,
            recommendation_id: rec.id,
          },
        },
      );
    }
    await col("recommendations").updateOne(
      { id: body.recommendation_id, type: "ADDITIONAL_WORK" },
      {
        $set: {
          status: "APPROVED",
          reviewed_by: me.name,
          reviewed_at: nowIso(),
          final_amount: tx.amount,
          payment_request_id: tx.id,
        },
      },
    );
  }
  await logActivity(
    kase.id,
    `Additional work payment request sent — £${Number(tx.amount).toFixed(2)}`,
    me,
    {
      payment_request_id: tx.id,
      amount: tx.amount,
      description: tx.description,
      due_date: body.due_date ?? null,
    },
  );
  await notify(
    kase.client_user_id,
    "Additional work payment required",
    `${tx.description} — £${Number(tx.amount).toFixed(2)}`,
    kase.id,
    "/subscription",
    "PAYMENT",
  );
  return clean(tx) as Doc;
}

export async function listPaymentRequests(me: Doc, caseId?: string | null): Promise<Doc[]> {
  const query: Doc = { kind: "ADDITIONAL_WORK" };
  if (me.role === "CLIENT") {
    query.user_id = me.id;
  } else if (me.role === "ACCOUNTANT") {
    if (!caseId) throw httpError(400, "case_id required");
    const kase = (await col("cases").findOne({ id: caseId })) as Doc | null;
    if (!kase || kase.assigned_accountant_id !== me.id) {
      throw httpError(403, "Case not assigned to you");
    }
  }
  if (caseId) query.case_id = caseId;
  const rows = (await col("payment_transactions")
    .find(query)
    .sort({ created_at: -1 })
    .limit(100)
    .toArray()) as Doc[];
  const out: Doc[] = [];
  for (const raw of cleanMany(rows)) {
    const r = raw;
    if (me.role !== "ADMIN" && me.role !== "SUPER_ADMIN") delete r.internal_note;
    if (r.request_status === undefined) {
      r.request_status =
        r.payment_status === "paid"
          ? "PAID"
          : r.payment_status === "cancelled"
            ? "CANCELLED"
            : "SENT";
    }
    const receipt = (await col("invoices").findOne({ payment_request_id: r.id })) as Doc | null;
    r.receipt_number = receipt?.number ?? null;
    out.push(r);
  }
  return out;
}

export async function cancelAdditionalWorkRequest(me: Doc, requestId: string): Promise<void> {
  const request = (await col("payment_transactions").findOne({
    id: requestId,
    kind: "ADDITIONAL_WORK",
  })) as Doc | null;
  if (!request) throw httpError(404, "Payment request not found");
  if (request.payment_status === "paid") {
    throw httpError(400, "A paid request cannot be cancelled or edited");
  }
  await col("payment_transactions").updateOne(
    { id: requestId },
    {
      $set: {
        status: "cancelled",
        payment_status: "cancelled",
        request_status: "CANCELLED",
        cancelled_by_name: me.name,
        cancelled_at: nowIso(),
        updated_at: nowIso(),
      },
    },
  );
  await logActivity(
    request.case_id ?? null,
    `Additional work payment request cancelled — £${Number(request.amount).toFixed(2)}`,
    me,
    { payment_request_id: requestId },
  );
}

export async function resendAdditionalWorkRequest(me: Doc, requestId: string): Promise<void> {
  const request = (await col("payment_transactions").findOne({
    id: requestId,
    kind: "ADDITIONAL_WORK",
  })) as Doc | null;
  if (!request) throw httpError(404, "Payment request not found");
  if (["paid", "cancelled"].includes(String(request.payment_status))) {
    throw httpError(400, "This request is no longer outstanding");
  }
  await col("payment_transactions").updateOne(
    { id: requestId },
    { $set: { sent_at: nowIso(), updated_at: nowIso() } },
  );
  await notify(
    request.user_id,
    "Reminder: additional work payment required",
    `${request.description} — £${Number(request.amount).toFixed(2)}`,
    request.case_id ?? null,
    "/subscription",
    "PAYMENT",
  );
  await logActivity(request.case_id ?? null, "Additional work payment request resent", me, {
    payment_request_id: requestId,
  });
}

export async function getAdditionalWorkReceiptHtml(
  me: Doc,
  requestId: string,
): Promise<{ html: string; number: string }> {
  const receipt = (await col("invoices").findOne({
    payment_request_id: requestId,
  })) as Doc | null;
  if (!receipt) throw httpError(404, "No receipt for this payment");
  if (me.role === "CLIENT" && receipt.client_user_id !== me.id) {
    throw httpError(403, "Not your receipt");
  }
  if (me.role === "ACCOUNTANT") {
    const kase = (await col("cases").findOne({ id: receipt.case_id ?? null })) as Doc | null;
    if (!kase || kase.assigned_accountant_id !== me.id) {
      throw httpError(403, "Case not assigned to you");
    }
  }
  const client = (await col("clients").findOne({ id: receipt.client_id ?? null })) as Doc | null;
  return {
    html: renderHtml(receipt, client?.name ?? "Client"),
    number: String(receipt.number),
  };
}

export async function startAdditionalWorkCheckout(
  me: Doc,
  requestId: string,
  originUrl: string,
): Promise<Doc> {
  requireVerifiedEmail(me);
  const request = (await col("payment_transactions").findOne({
    id: requestId,
    kind: "ADDITIONAL_WORK",
    user_id: me.id,
  })) as Doc | null;
  if (!request) throw httpError(404, "Payment request not found");
  if (request.payment_status === "paid") throw httpError(400, "This request has already been paid");
  if (request.payment_status === "cancelled") throw httpError(400, "This request has been cancelled");
  if (request.session_id) {
    try {
      const s = await payments().retrieveSession(request.session_id);
      if (s.status === "open" && s.url) {
        return {
          checkout_url: s.url,
          session_id: request.session_id,
          amount: request.amount,
          reused: true,
        };
      }
    } catch {
      // fall through and create a fresh session
    }
  }
  const session = await payments().createCheckout(
    request.amount,
    `Additional work — ${String(request.description).slice(0, 80)}`,
    originUrl,
    {
      kind: "ADDITIONAL_WORK",
      client_id: request.client_id,
      user_id: me.id,
      request_id: requestId,
    },
  );
  await col("payment_transactions").updateOne(
    { id: requestId },
    { $set: { session_id: session.id, status: "initiated", updated_at: nowIso() } },
  );
  return { checkout_url: session.url, session_id: session.id, amount: request.amount };
}

/** Client-facing payment history view (includes AW + service txs). */
export async function listMyPayments(me: Doc): Promise<Doc[]> {
  const MY_PAYMENT_FIELDS = [
    "id",
    "kind",
    "service_type",
    "previous_package",
    "new_package",
    "amount",
    "currency",
    "payment_status",
    "created_at",
    "description",
    "case_ref",
  ];
  const rows = (await col("payment_transactions")
    .find({ user_id: me.id })
    .sort({ created_at: -1 })
    .limit(100)
    .toArray()) as Doc[];
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  return cleanMany(rows).map((r) => {
    if (
      r.kind !== "ADDITIONAL_WORK" &&
      ["pending", "open", "unpaid"].includes(String(r.payment_status)) &&
      !r.fulfilled &&
      String(r.created_at ?? "") < cutoff
    ) {
      r.payment_status = "cancelled";
    }
    const view: Doc = {};
    for (const k of MY_PAYMENT_FIELDS) if (k in r) view[k] = r[k];
    return view;
  });
}
