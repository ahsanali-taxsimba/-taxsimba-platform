/** Phase 1B recommendations, client offers and admin package overrides. */
import { randomUUID } from "crypto";

import { Router } from "express";
import { z } from "zod";

import { clean, cleanMany, col, Doc, scrub, scrubMany, update } from "../db/mongo";
import {
  MTD,
  notifyAdmins,
  packageOr404,
  saCase,
  SELF_ASSESSMENT,
  SERVICE_LABELS,
} from "../domain/packages";
import { OPERATIONAL_ONLY } from "../domain/testdata";
import { logActivity, notify, nowIso } from "../domain/workflow";
import { handler, httpError, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";

export const recommendationsRouter = Router();

const STAFF = ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"] as const;
const STAFF_ADMIN = ["ADMIN", "SUPER_ADMIN"] as const;

const RecommendIn = z.object({
  recommended_package: z.string().nullish().default(null),
  reason: z.string(),
  note: z.string().nullish().default(null),
  suggested_amount: z.number().nullish().default(null),
});
const ReviewIn = z.object({
  recommended_package: z.string().nullish().default(null),
  reason: z.string().nullish().default(null),
  note: z.string().nullish().default(null),
  suggested_amount: z.number().nullish().default(null),
});
const OfferIn = z.object({
  package_code: z.string(),
  price: z.number().nullish().default(null),
  credit: z.number().default(0),
  message: z.string().nullish().default(null),
  explanation: z.string().nullish().default(null),
});
const OverrideIn = z.object({
  service_type: z.string().default(SELF_ASSESSMENT),
  package_code: z.string(),
  reason: z.string(),
});

type Recommend = z.infer<typeof RecommendIn>;

async function accountantCase(caseId: string, user: Doc): Promise<Doc> {
  const kase = (await col("cases").findOne({ id: caseId })) as Doc | null;
  if (!kase) throw httpError(404, "Case not found");
  if (user.role === "ACCOUNTANT" && kase.assigned_accountant_id !== user.id) {
    throw httpError(403, "Case not assigned to you");
  }
  return clean(kase) as Doc;
}

async function createRecommendation(
  kase: Doc,
  user: Doc,
  rtype: string,
  body: Recommend,
): Promise<Doc> {
  const existing = (await col("recommendations").findOne({
    case_id: kase.id,
    type: rtype,
    status: { $in: ["PENDING", "APPROVED"] },
  })) as Doc | null;
  if (existing && rtype !== "ADDITIONAL_WORK") {
    throw httpError(
      409,
      `${rtype === "PACKAGE_UPGRADE" ? "A package upgrade" : "An MTD"} recommendation is ` +
        `already ${String(existing.status).toLowerCase()} on this case`,
    );
  }
  if (rtype === "PACKAGE_UPGRADE") {
    const svc = (await col("client_services").findOne({
      client_id: kase.client_id,
      service_type: SELF_ASSESSMENT,
    })) as Doc | null;
    const current = (await col("packages").findOne({
      service_type: SELF_ASSESSMENT,
      code: svc?.package_code ?? null,
    })) as Doc | null;
    const target = await packageOr404(SELF_ASSESSMENT, body.recommended_package ?? null);
    if (current && target.rank <= current.rank) {
      throw httpError(400, "Only higher packages can be recommended");
    }
  }
  const rec: Doc = {
    id: randomUUID(),
    type: rtype,
    case_id: kase.id,
    case_ref: kase.case_ref,
    client_id: kase.client_id,
    client_user_id: kase.client_user_id,
    client_name: kase.client_name,
    service_type: rtype === "PACKAGE_UPGRADE" ? SELF_ASSESSMENT : MTD,
    recommended_package: body.recommended_package ?? null,
    suggested_amount: body.suggested_amount ?? null,
    reason: body.reason,
    note: body.note ?? null,
    raised_by_id: user.id,
    raised_by_name: user.name,
    raised_by_role: user.role,
    status: "PENDING",
    created_at: nowIso(),
  };
  await col("recommendations").insertOne({ ...rec });
  if (body.note) {
    await col("internal_notes").insertOne({
      id: randomUUID(),
      case_id: kase.id,
      body: `${rtype === "PACKAGE_UPGRADE" ? "Package upgrade" : "MTD"} recommendation: ${body.note}`,
      author_id: user.id,
      author_name: user.name,
      author_role: user.role,
      created_at: nowIso(),
    });
  }
  const label =
    rtype === "PACKAGE_UPGRADE"
      ? `Package upgrade recommended: ${body.recommended_package ?? ""}`
      : rtype === "ADDITIONAL_WORK"
        ? "Additional work recommended"
        : "MTD service recommended";
  await logActivity(kase.id, label, user, null, { comments: body.reason });
  await notifyAdmins(
    rtype === "PACKAGE_UPGRADE"
      ? "Package upgrade recommended"
      : rtype === "ADDITIONAL_WORK"
        ? "Additional work recommended"
        : "MTD recommended",
    `${kase.client_name} — raised by ${user.name}: ${body.reason}`,
    kase.id,
    rtype === "ADDITIONAL_WORK" ? `/work/cases/${kase.id}` : "/admin/recommendations",
    "RECOMMENDATION",
  );
  return clean(rec) as Doc;
}

/** Internal recommendation only -- no checkout, no charge, no client visibility. */
recommendationsRouter.post(
  "/cases/:caseId/recommend-additional-work",
  auth(...STAFF),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(RecommendIn, req.body);
    const kase = await accountantCase(req.params.caseId, me);
    res.json(scrub(await createRecommendation(kase, me, "ADDITIONAL_WORK", body), me));
  }),
);

recommendationsRouter.post(
  "/cases/:caseId/recommend-package",
  auth(...STAFF),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(RecommendIn, req.body);
    if (!body.recommended_package) throw httpError(400, "recommended_package is required");
    const kase = await accountantCase(req.params.caseId, me);
    res.json(scrub(await createRecommendation(kase, me, "PACKAGE_UPGRADE", body), me));
  }),
);

recommendationsRouter.post(
  "/cases/:caseId/recommend-mtd",
  auth(...STAFF),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(RecommendIn, req.body);
    const kase = await accountantCase(req.params.caseId, me);
    res.json(scrub(await createRecommendation(kase, me, "MTD", body), me));
  }),
);

recommendationsRouter.get(
  "/cases/:caseId/recommendations",
  auth(...STAFF),
  handler(async (req, res) => {
    const me = authed(req);
    await accountantCase(req.params.caseId, me);
    const rows = (await col("recommendations")
      .find({ case_id: req.params.caseId })
      .sort({ created_at: -1 })
      .limit(100)
      .toArray()) as Doc[];
    res.json(scrubMany(cleanMany(rows), me));
  }),
);

recommendationsRouter.get(
  "/recommendations",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const includeTest = ["1", "true", "yes"].includes(
      String(req.query.include_test ?? "").toLowerCase(),
    );
    const rows = cleanMany(
      (await col("recommendations")
        .find(status ? { status } : {})
        .sort({ created_at: -1 })
        .limit(300)
        .toArray()) as Doc[],
    );
    if (includeTest) {
      res.json(rows);
      return;
    }
    // Same genuine-record rule as every other operational list; nothing is deleted.
    const caseIds = [...new Set(rows.map((r) => r.case_id).filter(Boolean))];
    const genuine = new Set(
      (
        await col("cases")
          .find({ id: { $in: caseIds }, ...OPERATIONAL_ONLY }, { projection: { id: 1 } })
          .toArray()
      ).map((c) => c.id as string),
    );
    res.json(rows.filter((r) => genuine.has(r.case_id)));
  }),
);

async function approveAndOffer(rec: Doc, body: z.infer<typeof OfferIn>, user: Doc): Promise<Doc> {
  const pkg = await packageOr404(rec.service_type, body.package_code);
  const price = body.price ?? pkg.price;
  const amountDue = Math.round(Math.max(price - body.credit, 0) * 100) / 100;
  const offer: Doc = {
    id: randomUUID(),
    recommendation_id: rec.id,
    client_id: rec.client_id,
    client_user_id: rec.client_user_id,
    client_name: rec.client_name,
    service_type: rec.service_type,
    service_name: SERVICE_LABELS[rec.service_type] ?? null,
    package_code: pkg.code,
    package_name: pkg.name,
    billing_frequency: pkg.billing_frequency,
    price,
    credit: body.credit,
    amount_due: amountDue,
    message: body.message ?? null,
    explanation: body.explanation ?? rec.reason ?? null,
    status: "PENDING",
    created_by: user.id,
    created_by_name: user.name,
    created_at: nowIso(),
  };
  await col("offers").insertOne({ ...offer });
  await col("recommendations").updateOne(
    { id: rec.id },
    {
      $set: {
        status: "APPROVED",
        reviewed_by: user.name,
        reviewed_at: nowIso(),
        offer_id: offer.id,
      },
    },
  );
  await logActivity(
    rec.case_id,
    `Recommendation approved and released to client: ${pkg.name} (£${amountDue.toFixed(2)} due)`,
    user,
    null,
    { comments: body.explanation ?? body.message ?? null },
  );
  await notify(
    rec.client_user_id,
    "Additional service recommended",
    "Your accountant has recommended a service for you to review.",
    rec.case_id,
    `/recommendation/${offer.id}`,
    "RECOMMENDATION",
  );
  return clean(offer) as Doc;
}

async function approve(recId: string, body: z.infer<typeof OfferIn>, user: Doc): Promise<Doc> {
  const rec = (await col("recommendations").findOne({ id: recId })) as Doc | null;
  if (!rec) throw httpError(404, "Recommendation not found");
  if (rec.status !== "PENDING") throw httpError(400, "Recommendation has already been reviewed");
  return approveAndOffer(rec, body, user);
}

recommendationsRouter.post(
  "/recommendations/:recId/approve",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    res.json(await approve(req.params.recId, parseBody(OfferIn, req.body), authed(req)));
  }),
);

/** Alias of /approve kept for compatibility — approving is what releases the offer. */
recommendationsRouter.post(
  "/recommendations/:recId/send-offer",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    res.json(await approve(req.params.recId, parseBody(OfferIn, req.body), authed(req)));
  }),
);

/** Rejected recommendations stay internal — the client is never told. */
async function closeRecommendation(
  recId: string,
  user: Doc,
  status: "REJECTED" | "DECLINED",
  reason: string | null,
): Promise<void> {
  const rec = (await col("recommendations").findOne({ id: recId })) as Doc | null;
  if (!rec) throw httpError(404, "Recommendation not found");
  await col("recommendations").updateOne(
    { id: recId },
    { $set: { status, reviewed_by: user.name, reviewed_at: nowIso(), review_reason: reason } },
  );
  await logActivity(
    rec.case_id,
    status === "REJECTED"
      ? "Recommendation rejected by admin (internal only)"
      : "Recommendation declined by admin",
    user,
    null,
    { comments: reason },
  );
}

recommendationsRouter.post(
  "/recommendations/:recId/reject",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const body = parseBody(ReviewIn, req.body ?? {});
    await closeRecommendation(req.params.recId, authed(req), "REJECTED", body.reason ?? null);
    res.json({ ok: true });
  }),
);

recommendationsRouter.post(
  "/recommendations/:recId/decline",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const body = parseBody(ReviewIn, req.body ?? {});
    await closeRecommendation(req.params.recId, authed(req), "DECLINED", body.reason ?? null);
    res.json({ ok: true });
  }),
);

recommendationsRouter.get(
  "/my-offers",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const rows = cleanMany(
      (await col("offers")
        .find({ client_user_id: me.id, status: "PENDING" })
        .sort({ created_at: -1 })
        .limit(50)
        .toArray()) as Doc[],
    );
    // One live recommendation per service — later approvals supersede earlier ones.
    const seen = new Set<string>();
    const latest: Doc[] = [];
    for (const r of rows) {
      if (seen.has(r.service_type)) continue;
      seen.add(r.service_type);
      latest.push(r);
    }
    res.json(latest);
  }),
);

recommendationsRouter.get(
  "/my-offers/:offerId",
  auth("CLIENT"),
  handler(async (req, res) => {
    const offer = (await col("offers").findOne({
      id: req.params.offerId,
      client_user_id: authed(req).id,
    })) as Doc | null;
    if (!offer) throw httpError(404, "Recommendation not found");
    res.json(clean(offer));
  }),
);

// ------------------------------------------------------------------ admin override
recommendationsRouter.post(
  "/clients/:clientUserId/override-package",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(OverrideIn, req.body);
    const client = (await col("clients").findOne({
      user_id: req.params.clientUserId,
    })) as Doc | null;
    if (!client) throw httpError(404, "Client not found");
    if (!body.reason.trim()) throw httpError(400, "A reason is required for an override");
    const svc = (await col("client_services").findOne({
      client_id: client.id,
      service_type: body.service_type,
    })) as Doc | null;
    if (!svc) throw httpError(404, "Client does not hold this service");
    const pkg = await packageOr404(body.service_type, body.package_code);
    const previous = svc.package_code ?? null;
    const entry: Doc = {
      previous_package: previous,
      new_package: pkg.code,
      changed_at: nowIso(),
      changed_by: me.name,
      changed_by_role: me.role,
      reason: body.reason,
      override: true,
    };
    await col("client_services").updateOne(
      { id: svc.id },
      update({
        $set: { package_code: pkg.code, updated_at: nowIso() },
        $push: { package_history: entry },
      }),
    );
    const kase = body.service_type === SELF_ASSESSMENT ? await saCase(client.id as string) : null;
    if (kase) {
      await logActivity(
        kase.id as string,
        `Admin override: package ${previous} → ${pkg.code}`,
        me,
        { override: true },
        { comments: body.reason },
      );
    }
    await col("override_audit").insertOne({
      id: randomUUID(),
      client_id: client.id,
      client_user_id: req.params.clientUserId,
      ...entry,
      service_type: body.service_type,
    });
    res.json({ ok: true, package_code: pkg.code });
  }),
);
