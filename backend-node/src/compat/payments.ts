/**
 * Payments / Checkout Session adapter (baseline E5 / E7).
 * Thin map onto existing service-checkout + payments/status → fulfil.
 * Does not create parallel activation logic; VERIFY-BEFORE-PURCHASE stays in native routes.
 */
import { randomUUID } from "crypto";

import { Router } from "express";
import { z } from "zod";

import { clean, col, Doc } from "../db/mongo";
import { MTD, SELF_ASSESSMENT, clientOf } from "../domain/packages";
import { nowIso } from "../domain/workflow";
import { handler, httpError, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import { fulfil } from "../routes/payments";
import { requireVerifiedEmail } from "../services/emailVerification";
import { payments } from "../services/payments";
import { keysToCamel, keysToSnake } from "./caseMap";
import { sendCompatSuccess } from "./envelope";
import { categoryToServiceType } from "./ownership";

export const compatPaymentsRouter = Router();

const CheckoutSessionIn = z.object({
  plan_id: z.string().min(1),
  payment_method: z.string().nullish(),
  origin_url: z.string().nullish(),
  service_type: z.string().nullish(),
});

const CheckoutSuccessIn = z.object({
  session_id: z.string().min(1),
});

async function resolvePackage(planId: string, serviceTypeHint: string | null): Promise<Doc> {
  let pkg = (await col("packages").findOne({ id: planId, is_active: true })) as Doc | null;
  if (!pkg) {
    const q: Doc = { code: planId, is_active: true };
    if (serviceTypeHint) q.service_type = serviceTypeHint;
    pkg = (await col("packages").findOne(q)) as Doc | null;
  }
  if (!pkg && !serviceTypeHint) {
    pkg = (await col("packages").findOne({ code: planId, is_active: true })) as Doc | null;
  }
  if (!pkg) throw httpError(404, "Plan not found");
  return clean(pkg) as Doc;
}

/**
 * Toxel: POST client/subscription/checkout-session { planId, paymentMethod? }
 * → native service-checkout semantics (Checkout Session only).
 */
compatPaymentsRouter.post(
  "/client/subscription/checkout-session",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    // Defence-in-depth — native route also enforces; keep gate at the adapter edge.
    requireVerifiedEmail(me);
    const body = parseBody(CheckoutSessionIn, keysToSnake(req.body ?? {}));
    const hint = categoryToServiceType(body.service_type ?? null);
    const pkg = await resolvePackage(body.plan_id, hint);
    const serviceType = String(pkg.service_type);
    if (![SELF_ASSESSMENT, MTD].includes(serviceType)) {
      throw httpError(400, "Unknown service type");
    }
    const client = await clientOf(me);
    const svc = (await col("client_services").findOne({
      client_id: client.id,
      service_type: serviceType,
    })) as Doc | null;
    if (svc && svc.status === "ACTIVE") throw httpError(400, "This service is already active");

    const origin =
      (body.origin_url && String(body.origin_url)) ||
      req.header("origin") ||
      "https://taxsimba.co.uk";

    const session = await payments().createCheckout(
      Number(pkg.price),
      `${serviceType === MTD ? "MTD for Income Tax" : "Self Assessment"} — ${pkg.name}`,
      origin,
      {
        kind: "SERVICE_ACTIVATION",
        client_id: client.id as string,
        user_id: me.id as string,
        service_type: serviceType,
        to_package: String(pkg.code),
      },
    );
    await col("payment_transactions").insertOne({
      id: randomUUID(),
      session_id: session.id,
      user_id: me.id,
      client_id: client.id,
      kind: "SERVICE_ACTIVATION",
      service_type: serviceType,
      offer_id: null,
      previous_package: null,
      new_package: pkg.code,
      amount: Number(pkg.price),
      currency: "gbp",
      status: "initiated",
      payment_status: "pending",
      fulfilled: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    sendCompatSuccess(
      res,
      keysToCamel({
        checkout_url: session.url,
        session_id: session.id,
        amount: pkg.price,
      }),
      "Checkout session created",
    );
  }),
);

/**
 * Toxel: POST client/subscription/checkout-success { sessionId }
 * → poll Stripe status and fulfil only when paid (never trust the page alone).
 */
compatPaymentsRouter.post(
  "/client/subscription/checkout-success",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(CheckoutSuccessIn, keysToSnake(req.body ?? {}));
    let record = (await col("payment_transactions").findOne({
      session_id: body.session_id,
      user_id: me.id,
    })) as Doc | null;
    if (!record) throw httpError(404, "Transaction not found");

    if (record.payment_status !== "paid") {
      try {
        const s = await payments().retrieveSession(body.session_id);
        if (s.payment_status === "paid" || s.status === "complete") {
          await col("payment_transactions").updateOne(
            { session_id: body.session_id, payment_status: { $ne: "paid" } },
            {
              $set: {
                status: "completed",
                payment_status: "paid",
                stripe_payment_intent_id: s.payment_intent,
                updated_at: nowIso(),
              },
            },
          );
          record = (await col("payment_transactions").findOne({
            session_id: body.session_id,
          })) as Doc | null;
        }
      } catch {
        // Provider unreachable — leave stored state; do not invent paid.
      }
    }

    if (record && record.payment_status === "paid" && !record.fulfilled) {
      await fulfil(record);
      record = (await col("payment_transactions").findOne({
        session_id: body.session_id,
      })) as Doc | null;
    }

    if (!record || record.payment_status !== "paid") {
      throw httpError(400, "Payment is not complete yet");
    }

    const pkg = record.new_package
      ? ((await col("packages").findOne({
          service_type: record.service_type,
          code: record.new_package,
        })) as Doc | null)
      : null;

    sendCompatSuccess(
      res,
      keysToCamel({
        session_id: record.session_id,
        payment_status: record.payment_status,
        fulfilled: record.fulfilled,
        service_type: record.service_type,
        plan: pkg
          ? { id: pkg.id, code: pkg.code, name: pkg.name, price: pkg.price }
          : { code: record.new_package, name: record.new_package },
      }),
      "Purchase finalized",
    );
  }),
);

/** Explicit Elements path — rejected for P0 (baseline D6 / E6). */
compatPaymentsRouter.post(
  "/client/subscription/create",
  auth("CLIENT"),
  handler(async () => {
    throw httpError(
      400,
      "Card Elements / subscription create is disabled for P0. Use Stripe Checkout Session.",
    );
  }),
);
