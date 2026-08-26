/** Phase 1B routes: package catalogue, client services, checkouts, additional-work payments. */
import { randomUUID } from "crypto";

import { Request, Router } from "express";
import { z } from "zod";

import { clean, cleanMany, col, Doc, update } from "../db/mongo";
import {
  activateService,
  clientOf,
  DEFAULT_LOCK_STATUSES,
  lockState,
  MTD,
  packageOr404,
  saCase,
  SELF_ASSESSMENT,
  SERVICE_LABELS,
  servicesFor,
  notifyAdmins,
} from "../domain/packages";
import { contentMap } from "../domain/content";
import {
  applyDuePriceSchedules,
  cancelScheduled,
  futureDate,
  pendingSchedule,
  schedulePriceChange,
} from "../domain/pricing";
import { logActivity, notify, nowIso } from "../domain/workflow";
import { handler, httpError, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import { createReceipt, renderHtml } from "../services/invoices";
import { payments } from "../services/payments";

export const paymentsRouter = Router();

const STAFF_ADMIN = ["ADMIN", "SUPER_ADMIN"] as const;

const PackageIn = z.object({
  service_type: z.string(),
  code: z.string(),
  name: z.string(),
  price: z.number(),
  rank: z.number(),
  billing_frequency: z.string().default("Per tax year"),
  billing_type: z.string().default("ONE_OFF"),
  vat_treatment: z.string().default("VAT_INCLUSIVE"),
  effective_from: z.string().nullish().default(null),
});
const PriceIn = z.object({
  price: z.number(),
  effective_from: z.string().nullish().default(null),
});
const ScheduleIn = z.object({
  price: z.number(),
  effective_from: z.string(),
});
const PackageUpdateIn = z.object({
  name: z.string().nullish().default(null),
  price: z.number().nullish().default(null),
  billing_type: z.string().nullish().default(null),
  billing_frequency: z.string().nullish().default(null),
  vat_treatment: z.string().nullish().default(null),
  is_active: z.boolean().nullish().default(null),
  effective_from: z.string().nullish().default(null),
});
const LockIn = z.object({ locked_statuses: z.array(z.string()) });
const UpgradeCheckoutIn = z.object({ package_code: z.string(), origin_url: z.string() });
const OfferCheckoutIn = z.object({ offer_id: z.string(), origin_url: z.string() });
const ServiceCheckoutIn = z.object({
  service_type: z.string(),
  package_code: z.string(),
  origin_url: z.string(),
});
const PayRequestIn = z.object({ origin_url: z.string() });
const AdditionalWorkIn = z.object({
  case_id: z.string(),
  description: z.string(),
  amount: z.number(),
  due_date: z.string().nullish().default(null),
  internal_note: z.string().nullish().default(null),
  recommendation_id: z.string().nullish().default(null),
  mtd_period_id: z.string().nullish().default(null),
  vat_rate: z.number().nullish().default(null),
});

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function queryString(req: Request, name: string): string | undefined {
  const v = req.query[name];
  return typeof v === "string" && v ? v : undefined;
}

function queryBool(req: Request, name: string): boolean {
  const v = req.query[name];
  return typeof v === "string" && ["1", "true", "yes"].includes(v.toLowerCase());
}

// ------------------------------------------------------------------ packages
paymentsRouter.get(
  "/packages",
  auth(),
  handler(async (req, res) => {
    await applyDuePriceSchedules();
    const q: Doc = { is_active: true };
    const serviceType = queryString(req, "service_type");
    if (serviceType) q.service_type = serviceType;
    const rows = cleanMany(
      (await col("packages").find(q).sort({ rank: 1 }).limit(100).toArray()) as Doc[],
    );
    // Marketing copy is opt-in so the default response stays identical to the Python contract.
    if (!queryBool(req, "include_content")) {
      res.json(rows);
      return;
    }
    const content = await contentMap();
    res.json(
      rows.map((p) => ({
        ...p,
        description: content[`package.${String(p.code)}.description`] || null,
        features: (content[`package.${String(p.code)}.features`] ?? "")
          .split("\n")
          .filter((line) => line.trim()),
      })),
    );
  }),
);

paymentsRouter.post(
  "/packages",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const body = parseBody(PackageIn, req.body);
    if (await col("packages").findOne({ service_type: body.service_type, code: body.code })) {
      throw httpError(400, "Package code already exists for this service");
    }
    const doc: Doc = { ...body, id: randomUUID(), is_active: true, created_at: nowIso() };
    await col("packages").insertOne({ ...doc });
    res.json(clean(doc));
  }),
);

paymentsRouter.patch(
  "/packages/:packageId/price",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(PriceIn, req.body);
    const p = (await col("packages").findOne({ id: req.params.packageId })) as Doc | null;
    if (!p) throw httpError(404, "Package not found");
    // A future effective date defers the change; new customers keep paying today's price
    // until it falls due. Existing customers are unaffected either way.
    const scheduled = futureDate(body.effective_from);
    if (scheduled) {
      await schedulePriceChange(p, body.price, scheduled, me);
      res.json({ ok: true });
      return;
    }
    await col("packages").updateOne(
      { id: req.params.packageId },
      { $set: { price: body.price, effective_from: body.effective_from, updated_at: nowIso() } },
    );
    await col("pricing_audit").insertOne({
      id: randomUUID(),
      package_id: req.params.packageId,
      code: p.code,
      previous_price: p.price,
      new_price: body.price,
      effective_from: body.effective_from,
      changed_by: me.name,
      role: me.role,
      created_at: nowIso(),
    });
    res.json({ ok: true });
  }),
);

/**
 * Master catalogue maintenance. Changing a master package never alters an existing
 * customer's agreed price, billing frequency, start date or payment references.
 */
paymentsRouter.patch(
  "/packages/:packageId",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(PackageUpdateIn, req.body);
    const p = (await col("packages").findOne({ id: req.params.packageId })) as Doc | null;
    if (!p) throw httpError(404, "Package not found");
    const fields: Doc = {};
    for (const [k, v] of Object.entries(body)) if (v !== null && v !== undefined) fields[k] = v;
    if (!Object.keys(fields).length) throw httpError(400, "Nothing to update");
    // A future-dated price is scheduled; the remaining catalogue fields apply immediately.
    const deferred = "price" in fields ? futureDate(body.effective_from) : null;
    if (deferred) {
      await schedulePriceChange(p, fields.price as number, deferred, me);
      delete fields.price;
      delete fields.effective_from;
    }
    if (!Object.keys(fields).length) {
      res.json(clean((await col("packages").findOne({ id: req.params.packageId })) as Doc));
      return;
    }
    await col("packages").updateOne(
      { id: req.params.packageId },
      { $set: { ...fields, updated_at: nowIso() } },
    );
    if ("price" in fields && fields.price !== p.price) {
      await col("pricing_audit").insertOne({
        id: randomUUID(),
        package_id: req.params.packageId,
        code: p.code,
        previous_price: p.price,
        new_price: fields.price,
        effective_from: fields.effective_from ?? null,
        changed_by: me.name,
        role: me.role,
        created_at: nowIso(),
      });
    }
    res.json(clean((await col("packages").findOne({ id: req.params.packageId })) as Doc));
  }),
);

paymentsRouter.get(
  "/packages/:packageId/price-history",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const rows = (await col("pricing_audit")
      .find({ package_id: req.params.packageId })
      .sort({ created_at: -1 })
      .limit(200)
      .toArray()) as Doc[];
    res.json(cleanMany(rows));
  }),
);

/**
 * Scheduled (future-dated) price changes. Additive endpoints — no existing response changes.
 * A pending row becomes the master price automatically once its date passes.
 */
paymentsRouter.get(
  "/packages/:packageId/price-schedule",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    await applyDuePriceSchedules();
    res.json(cleanMany(await pendingSchedule(req.params.packageId)));
  }),
);

paymentsRouter.post(
  "/packages/:packageId/price-schedule",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(ScheduleIn, req.body);
    const p = (await col("packages").findOne({ id: req.params.packageId })) as Doc | null;
    if (!p) throw httpError(404, "Package not found");
    const when = futureDate(body.effective_from);
    if (!when) throw httpError(400, "effective_from must be a valid future date");
    res.json(clean(await schedulePriceChange(p, body.price, when, me)));
  }),
);

paymentsRouter.delete(
  "/packages/:packageId/price-schedule/:entryId",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    if (!(await cancelScheduled(req.params.entryId, me))) {
      throw httpError(404, "No pending scheduled price change with that id");
    }
    res.json({ ok: true });
  }),
);

paymentsRouter.get(
  "/settings/package-lock",
  auth(...STAFF_ADMIN),
  handler(async (_req, res) => {
    const s = (await col("settings").findOne({ key: "package_change_lock" })) as Doc | null;
    res.json({ locked_statuses: s?.locked_statuses ?? DEFAULT_LOCK_STATUSES });
  }),
);

paymentsRouter.patch(
  "/settings/package-lock",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const body = parseBody(LockIn, req.body);
    await col("settings").updateOne(
      { key: "package_change_lock" },
      { $set: { locked_statuses: body.locked_statuses } },
      { upsert: true },
    );
    res.json({ ok: true });
  }),
);

// ------------------------------------------------------------------ my services
paymentsRouter.get(
  "/my-services",
  auth("CLIENT"),
  handler(async (req, res) => {
    const client = await clientOf(authed(req));
    res.json({ client_ref: client.client_ref ?? null, services: await servicesFor(client) });
  }),
);

paymentsRouter.get(
  "/clients/:clientUserId/services",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const client = (await col("clients").findOne({ user_id: req.params.clientUserId })) as Doc | null;
    if (!client) throw httpError(404, "Client not found");
    const cleaned = clean(client) as Doc;
    res.json({
      client_ref: cleaned.client_ref ?? null,
      client_name: cleaned.name,
      services: await servicesFor(cleaned),
    });
  }),
);

paymentsRouter.get(
  "/my-upgrade-options",
  auth("CLIENT"),
  handler(async (req, res) => {
    await applyDuePriceSchedules();
    const client = await clientOf(authed(req));
    const svc = (await col("client_services").findOne({
      client_id: client.id,
      service_type: SELF_ASSESSMENT,
    })) as Doc | null;
    if (!svc) throw httpError(404, "No Self Assessment service");
    const current = (await col("packages").findOne({
      service_type: SELF_ASSESSMENT,
      code: svc.package_code ?? null,
    })) as Doc | null;
    const [locked, caseStatus] = await lockState(client.id);
    const options: Doc[] = [];
    if (current) {
      const rows = (await col("packages")
        .find({ service_type: SELF_ASSESSMENT, is_active: true, rank: { $gt: current.rank } })
        .sort({ rank: 1 })
        .toArray()) as Doc[];
      for (const p of rows) {
        const due = round2(Math.max(p.price - current.price, 0));
        options.push({
          code: p.code,
          name: p.name,
          upgrade_price: p.price,
          current_package_credit: current.price,
          additional_amount_payable: due,
          total_due_now: due,
        });
      }
    }
    res.json({
      current_package: current
        ? { code: current.code, name: current.name, price: current.price }
        : null,
      is_highest: Boolean(current) && !options.length,
      locked,
      lock_reason: locked ? `Your return has reached ${caseStatus}` : null,
      options,
    });
  }),
);

// ------------------------------------------------------------------ checkouts
/**
 * One payable checkout at a time per business key — reuse the open session instead of
 * creating a second payable one.
 */
async function inflight(query: Doc): Promise<Doc | null> {
  const rec = (await col("payment_transactions").findOne({
    ...query,
    payment_status: "pending",
    status: "initiated",
  })) as Doc | null;
  if (!rec) return null;
  let session;
  try {
    session = await payments().retrieveSession(rec.session_id);
  } catch {
    return null;
  }
  if (session.status === "open" && session.url) {
    return {
      checkout_url: session.url,
      session_id: rec.session_id,
      amount: rec.amount,
      reused: true,
    };
  }
  await col("payment_transactions").updateOne(
    { session_id: rec.session_id },
    {
      $set: {
        status: session.status || "expired",
        payment_status: session.payment_status || "expired",
        updated_at: nowIso(),
      },
    },
  );
  return null;
}

paymentsRouter.post(
  "/payments/upgrade-checkout",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(UpgradeCheckoutIn, req.body);
    const client = await clientOf(me);
    const svc = (await col("client_services").findOne({
      client_id: client.id,
      service_type: SELF_ASSESSMENT,
    })) as Doc | null;
    if (!svc || svc.status !== "ACTIVE") throw httpError(400, "No active Self Assessment service");
    const current = await packageOr404(SELF_ASSESSMENT, svc.package_code);
    const target = await packageOr404(SELF_ASSESSMENT, body.package_code);
    if (target.rank <= current.rank) {
      throw httpError(400, "Downgrades are not permitted once a package is active");
    }
    const [locked, caseStatus] = await lockState(client.id);
    if (locked) throw httpError(400, `Package changes are locked at this stage (${caseStatus})`);
    const amount = round2(Math.max(target.price - current.price, 0));
    if (amount <= 0) throw httpError(400, "No additional amount payable");
    const reuse = await inflight({
      client_id: client.id,
      kind: "SA_UPGRADE",
      new_package: target.code,
    });
    if (reuse) {
      res.json(reuse);
      return;
    }
    const session = await payments().createCheckout(
      amount,
      `Self Assessment upgrade — ${current.name} to ${target.name}`,
      body.origin_url,
      {
        kind: "SA_UPGRADE",
        client_id: client.id,
        user_id: me.id,
        from_package: current.code,
        to_package: target.code,
      },
    );
    await col("payment_transactions").insertOne({
      id: randomUUID(),
      session_id: session.id,
      user_id: me.id,
      client_id: client.id,
      kind: "SA_UPGRADE",
      service_type: SELF_ASSESSMENT,
      previous_package: current.code,
      new_package: target.code,
      amount,
      currency: "gbp",
      status: "initiated",
      payment_status: "pending",
      fulfilled: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    res.json({ checkout_url: session.url, session_id: session.id, amount });
  }),
);

paymentsRouter.post(
  "/payments/offer-checkout",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(OfferCheckoutIn, req.body);
    const offer = (await col("offers").findOne({
      id: body.offer_id,
      client_user_id: me.id,
    })) as Doc | null;
    if (!offer) throw httpError(404, "Offer not found");
    if (offer.status !== "PENDING") throw httpError(400, "Offer is no longer available");
    const reuse = await inflight({ offer_id: offer.id, kind: "SERVICE_ACTIVATION" });
    if (reuse) {
      res.json(reuse);
      return;
    }
    const label = `${SERVICE_LABELS[offer.service_type] ?? offer.service_type} — ${offer.package_name}`;
    const session = await payments().createCheckout(offer.amount_due, label, body.origin_url, {
      kind: "SERVICE_ACTIVATION",
      offer_id: offer.id,
      client_id: offer.client_id,
      user_id: me.id,
      service_type: offer.service_type,
      to_package: offer.package_code,
    });
    await col("payment_transactions").insertOne({
      id: randomUUID(),
      session_id: session.id,
      user_id: me.id,
      client_id: offer.client_id,
      kind: "SERVICE_ACTIVATION",
      service_type: offer.service_type,
      offer_id: offer.id,
      previous_package: null,
      new_package: offer.package_code,
      amount: Number(offer.amount_due),
      currency: "gbp",
      status: "initiated",
      payment_status: "pending",
      fulfilled: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    res.json({ checkout_url: session.url, session_id: session.id, amount: offer.amount_due });
  }),
);

/** Direct client purchase of a service — no accountant-created offer required. */
paymentsRouter.post(
  "/payments/service-checkout",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(ServiceCheckoutIn, req.body);
    if (![SELF_ASSESSMENT, MTD].includes(body.service_type)) {
      throw httpError(400, "Unknown service type");
    }
    const client = await clientOf(me);
    const svc = (await col("client_services").findOne({
      client_id: client.id,
      service_type: body.service_type,
    })) as Doc | null;
    if (svc && svc.status === "ACTIVE") throw httpError(400, "This service is already active");
    const pkg = await packageOr404(body.service_type, body.package_code);
    const reuse = await inflight({
      client_id: client.id,
      kind: "SERVICE_ACTIVATION",
      service_type: body.service_type,
    });
    if (reuse) {
      res.json(reuse);
      return;
    }
    const label = `${SERVICE_LABELS[body.service_type] ?? body.service_type} — ${pkg.name}`;
    const session = await payments().createCheckout(pkg.price, label, body.origin_url, {
      kind: "SERVICE_ACTIVATION",
      client_id: client.id,
      user_id: me.id,
      service_type: body.service_type,
      to_package: pkg.code,
    });
    await col("payment_transactions").insertOne({
      id: randomUUID(),
      session_id: session.id,
      user_id: me.id,
      client_id: client.id,
      kind: "SERVICE_ACTIVATION",
      service_type: body.service_type,
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
    res.json({ checkout_url: session.url, session_id: session.id, amount: pkg.price });
  }),
);

// ------------------------------------------------------------------ fulfilment
/** Idempotent post-payment business logic. */
export async function fulfil(tx: Doc): Promise<void> {
  if (tx.fulfilled) return;
  const client = (await col("clients").findOne({ id: tx.client_id })) as Doc | null;
  const user = (await col("users").findOne({ id: tx.user_id })) as Doc | null;
  const actor = user ? { id: user.id, name: user.name, role: "CLIENT" } : null;

  if (tx.kind === "ADDITIONAL_WORK") {
    const claimed = await col("payment_transactions").updateOne(
      { id: tx.id, fulfilled: { $ne: true } },
      {
        $set: {
          fulfilled: true,
          request_status: "PAID",
          paid_at: nowIso(),
          updated_at: nowIso(),
        },
      },
    );
    // already confirmed -- never notify or audit the same payment twice
    if (!claimed.modifiedCount) return;
    const kase = (await col("cases").findOne({ id: tx.case_id ?? null })) as Doc | null;
    const receipt = await createReceipt({ ...tx, paid_at: nowIso() });
    const ref = tx.stripe_payment_intent_id ?? tx.session_id;
    await logActivity(
      tx.case_id ?? null,
      `Additional work payment received — £${Number(tx.amount).toFixed(2)} ` +
        `(ref ${ref}, receipt ${receipt ? receipt.number : "existing"})`,
      actor,
      {
        payment_request_id: tx.id,
        amount: tx.amount,
        receipt_number: receipt ? receipt.number : null,
      },
    );
    if (receipt) {
      await notify(
        tx.user_id,
        "Payment received",
        `Receipt ${receipt.number} for ${tx.description} — £${Number(tx.amount).toFixed(2)}. ` +
          "Available in My Services.",
        tx.case_id ?? null,
        "/subscription",
        "RECEIPT",
      );
    }
    const recipients = new Set<string>();
    if (kase?.assigned_accountant_id) recipients.add(kase.assigned_accountant_id as string);
    for (const admin of await col("users")
      .find({ role: { $in: ["ADMIN", "SUPER_ADMIN"] } }, { projection: { id: 1 } })
      .toArray()) {
      recipients.add(admin.id as string);
    }
    for (const uid of recipients) {
      await notify(
        uid,
        "Additional work payment received",
        `${kase?.client_name ?? "Client"} paid £${Number(tx.amount).toFixed(2)} for ` +
          `${tx.description ?? "additional work"}`,
        tx.case_id ?? null,
        `/work/cases/${tx.case_id}`,
        "PAYMENT",
      );
    }
    return;
  }

  if (tx.kind === "SA_UPGRADE") {
    const svc = (await col("client_services").findOne({
      client_id: tx.client_id,
      service_type: SELF_ASSESSMENT,
    })) as Doc | null;
    if (svc && svc.package_code === tx.new_package) {
      // Business-key idempotency: this upgrade has already been applied.
      await col("payment_transactions").updateOne(
        { session_id: tx.session_id },
        { $set: { fulfilled: true, duplicate: true, updated_at: nowIso() } },
      );
      return;
    }
    const kase = await saCase(tx.client_id);
    await col("client_services").updateOne(
      { id: svc?.id },
      update({
        $set: { package_code: tx.new_package, updated_at: nowIso() },
        $push: {
          package_history: {
            previous_package: tx.previous_package,
            new_package: tx.new_package,
            changed_at: nowIso(),
            changed_by: user ? user.name : "Client",
            reason: "Client upgrade",
            payment_session: tx.session_id,
            amount_paid: tx.amount,
          },
        },
      }),
    );
    if (kase) {
      await logActivity(
        kase.id,
        `Package upgraded ${tx.previous_package} → ${tx.new_package} ` +
          `(£${Number(tx.amount).toFixed(2)} paid)`,
        actor,
        { amount: tx.amount },
        { comments: `Payment session ${tx.session_id}` },
      );
    }
    await notifyAdmins(
      "Self Assessment package upgraded",
      `${client?.name} upgraded ${tx.previous_package} → ${tx.new_package}`,
      kase ? (kase.id as string) : null,
      "/admin/recommendations",
      "UPGRADE",
    );
  } else if (tx.kind === "SERVICE_ACTIVATION") {
    if (tx.offer_id) {
      const offerNow = (await col("offers").findOne({ id: tx.offer_id })) as Doc | null;
      if (offerNow && offerNow.status === "PAID") {
        await col("payment_transactions").updateOne(
          { session_id: tx.session_id },
          { $set: { fulfilled: true, duplicate: true, updated_at: nowIso() } },
        );
        return;
      }
    }
    const already = (await col("client_services").findOne({
      client_id: tx.client_id,
      service_type: tx.service_type,
      status: "ACTIVE",
    })) as Doc | null;
    if (already && already.package_code === tx.new_package) {
      await col("payment_transactions").updateOne(
        { session_id: tx.session_id },
        { $set: { fulfilled: true, duplicate: true, updated_at: nowIso() } },
      );
      return;
    }
    // Single source of truth for activation (service + case + MTD periods).
    await activateService(clean(client) as Doc, user, tx.service_type, tx.new_package, {
      paymentSession: tx.session_id,
      amount: tx.amount,
    });
    if (tx.offer_id) {
      await col("offers").updateOne(
        { id: tx.offer_id },
        { $set: { status: "PAID", paid_at: nowIso() } },
      );
      const offer = (await col("offers").findOne({ id: tx.offer_id })) as Doc | null;
      if (offer?.recommendation_id) {
        await col("recommendations").updateOne(
          { id: offer.recommendation_id },
          { $set: { status: "ACTIVATED" } },
        );
      }
    }
  }

  await col("payment_transactions").updateOne(
    { session_id: tx.session_id },
    { $set: { fulfilled: true, updated_at: nowIso() } },
  );
}

paymentsRouter.get(
  "/payments/status/:sessionId",
  handler(async (req, res) => {
    const sessionId = req.params.sessionId;
    let record = (await col("payment_transactions").findOne({
      session_id: sessionId,
    })) as Doc | null;
    if (!record) throw httpError(404, "Transaction not found");
    if (record.payment_status !== "paid") {
      try {
        const s = await payments().retrieveSession(sessionId);
        if (s.payment_status === "paid" || s.status === "complete") {
          await col("payment_transactions").updateOne(
            { session_id: sessionId, payment_status: { $ne: "paid" } },
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
            session_id: sessionId,
          })) as Doc | null;
        }
      } catch {
        // the provider is unreachable; the stored state stands until the webhook lands
      }
    }
    if (record && record.payment_status === "paid" && !record.fulfilled) {
      await fulfil(record);
      record = (await col("payment_transactions").findOne({
        session_id: sessionId,
      })) as Doc | null;
    }
    res.json({
      session_id: record?.session_id,
      status: record?.status,
      payment_status: record?.payment_status,
    });
  }),
);

paymentsRouter.post(
  "/stripe/webhook",
  handler(async (req, res) => {
    const signature = req.header("stripe-signature") ?? "";
    let event;
    try {
      event = payments().parseWebhook(req.body as Buffer, signature);
    } catch {
      throw httpError(400, "Invalid signature");
    }
    const obj = event.object;
    if (event.type === "checkout.session.completed") {
      await col("payment_transactions").updateOne(
        { session_id: obj.id, payment_status: { $ne: "paid" } },
        {
          $set: {
            status: "completed",
            payment_status: obj.payment_status ?? "paid",
            stripe_payment_intent_id: obj.payment_intent ?? null,
            updated_at: nowIso(),
          },
        },
      );
      const tx = (await col("payment_transactions").findOne({
        session_id: obj.id,
      })) as Doc | null;
      if (tx && tx.payment_status === "paid") await fulfil(tx);
    } else if (event.type === "checkout.session.expired") {
      await col("payment_transactions").updateOne(
        { session_id: obj.id },
        { $set: { status: "expired", payment_status: "expired", updated_at: nowIso() } },
      );
    } else if (event.type === "checkout.session.async_payment_failed") {
      await col("payment_transactions").updateOne(
        { session_id: obj.id },
        { $set: { status: "failed", payment_status: "failed", updated_at: nowIso() } },
      );
    }
    res.json({ status: "ok" });
  }),
);

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

paymentsRouter.get(
  "/my-payments",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const rows = (await col("payment_transactions")
      .find({ user_id: me.id })
      .sort({ created_at: -1 })
      .limit(100)
      .toArray()) as Doc[];
    // A checkout that was never completed must not sit as "Pending" forever. Anything still
    // unresolved after 24 hours is reported as cancelled; confirmed payments are untouched.
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const out = cleanMany(rows).map((r) => {
      if (
        r.kind !== "ADDITIONAL_WORK" &&
        ["pending", "open", "unpaid"].includes(r.payment_status) &&
        !r.fulfilled &&
        String(r.created_at ?? "") < cutoff
      ) {
        r.payment_status = "cancelled";
      }
      const view: Doc = {};
      for (const k of MY_PAYMENT_FIELDS) if (k in r) view[k] = r[k];
      return view;
    });
    res.json(out);
  }),
);

// ---------------------------------------------------- additional work payment requests
/**
 * Admin-raised charge for work outside the client's package. Reuses the existing Stripe
 * checkout, transaction record, notification and audit infrastructure.
 */
paymentsRouter.post(
  "/payment-requests",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(AdditionalWorkIn, req.body);
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
      mtd_period_id: body.mtd_period_id,
      service_type: kase.service_type,
      tax_year: kase.tax_year ?? null,
      description: body.description.trim(),
      internal_note: body.internal_note,
      due_date: body.due_date,
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
      // The accountant's recommendation is approved by this send; history is preserved.
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
        due_date: body.due_date,
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
    res.json(clean(tx));
  }),
);

/** Admin/accountant see requests for a case; a client only ever sees their own. */
paymentsRouter.get(
  "/payment-requests",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = queryString(req, "case_id");
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
    res.json(out);
  }),
);

paymentsRouter.post(
  "/payment-requests/:requestId/cancel",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const me = authed(req);
    const request = (await col("payment_transactions").findOne({
      id: req.params.requestId,
      kind: "ADDITIONAL_WORK",
    })) as Doc | null;
    if (!request) throw httpError(404, "Payment request not found");
    if (request.payment_status === "paid") {
      throw httpError(400, "A paid request cannot be cancelled or edited");
    }
    await col("payment_transactions").updateOne(
      { id: req.params.requestId },
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
      { payment_request_id: req.params.requestId },
    );
    res.json({ ok: true });
  }),
);

paymentsRouter.post(
  "/payment-requests/:requestId/resend",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const me = authed(req);
    const request = (await col("payment_transactions").findOne({
      id: req.params.requestId,
      kind: "ADDITIONAL_WORK",
    })) as Doc | null;
    if (!request) throw httpError(404, "Payment request not found");
    if (["paid", "cancelled"].includes(request.payment_status)) {
      throw httpError(400, "This request is no longer outstanding");
    }
    await col("payment_transactions").updateOne(
      { id: req.params.requestId },
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
      payment_request_id: req.params.requestId,
    });
    res.json({ ok: true });
  }),
);

/** Paid receipt as a printable/downloadable document. Read-only for every role. */
paymentsRouter.get(
  "/payment-requests/:requestId/receipt",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const receipt = (await col("invoices").findOne({
      payment_request_id: req.params.requestId,
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
    res.setHeader("Content-Type", "text/html");
    res.setHeader("Content-Disposition", `inline; filename="${receipt.number}.html"`);
    res.send(renderHtml(receipt, client?.name ?? "Client"));
  }),
);

paymentsRouter.post(
  "/payment-requests/:requestId/checkout",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(PayRequestIn, req.body);
    const request = (await col("payment_transactions").findOne({
      id: req.params.requestId,
      kind: "ADDITIONAL_WORK",
      user_id: me.id,
    })) as Doc | null;
    if (!request) throw httpError(404, "Payment request not found");
    if (request.payment_status === "paid") throw httpError(400, "This request has already been paid");
    if (request.payment_status === "cancelled") throw httpError(400, "This request has been cancelled");
    if (request.session_id) {
      // Repeated clicks reuse the open session instead of creating a second payable one.
      try {
        const s = await payments().retrieveSession(request.session_id);
        if (s.status === "open" && s.url) {
          res.json({
            checkout_url: s.url,
            session_id: request.session_id,
            amount: request.amount,
            reused: true,
          });
          return;
        }
      } catch {
        // fall through and create a fresh session
      }
    }
    const session = await payments().createCheckout(
      request.amount,
      `Additional work — ${String(request.description).slice(0, 80)}`,
      body.origin_url,
      {
        kind: "ADDITIONAL_WORK",
        client_id: request.client_id,
        user_id: me.id,
        request_id: req.params.requestId,
      },
    );
    await col("payment_transactions").updateOne(
      { id: req.params.requestId },
      { $set: { session_id: session.id, status: "initiated", updated_at: nowIso() } },
    );
    res.json({ checkout_url: session.url, session_id: session.id, amount: request.amount });
  }),
);

paymentsRouter.get(
  "/payments",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const status = queryString(req, "status");
    const kind = queryString(req, "kind");
    const includeTest = queryBool(req, "include_test");
    const query: Doc = {};
    // Existing statuses only -- Successful maps to the stored "paid".
    if (status) query.payment_status = status === "successful" ? "paid" : status;
    if (kind) query.kind = kind;
    const rows = cleanMany(
      (await col("payment_transactions")
        .find(query)
        .sort({ created_at: -1 })
        .limit(500)
        .toArray()) as Doc[],
    );
    const clientIds = [...new Set(rows.map((r) => r.client_id).filter(Boolean))];
    const clients = new Map<string, Doc>();
    for (const c of await col("clients")
      .find({ id: { $in: clientIds } }, {
        projection: { id: 1, name: 1, client_ref: 1, is_test: 1 },
      })
      .toArray()) {
      clients.set(c.id as string, c as Doc);
    }
    const out: Doc[] = [];
    for (const r of rows) {
      const c = clients.get(r.client_id);
      // Automated-test transactions (including ones whose test client was already cleaned
      // away) stay in the database but out of the normal list.
      if (!includeTest && (!c || c.is_test)) continue;
      r.client_name = c ? c.name : null;
      r.client_ref = c ? (c.client_ref ?? null) : null;
      out.push(r);
    }
    res.json(out);
  }),
);
