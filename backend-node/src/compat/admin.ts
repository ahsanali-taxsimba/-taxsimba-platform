/**
 * Admin / accountant / SUPER_ADMIN compat adapters (P0 K.7 / baseline S1–S5, X4).
 * Thin maps onto native users, invites, stats, payments, FAQs, cases.
 * Never unmask contacts for ADMIN/ACCOUNTANT. No HMRC. No CMS (S6 HIDE).
 */
import { Router } from "express";
import { z } from "zod";

import { clean, cleanMany, col, Doc, scrubMany } from "../db/mongo";
import { FAQ_CATEGORIES } from "../domain/helpcentre";
import { OPERATIONAL_ONLY, TEST_EMAIL_REGEX } from "../domain/testdata";
import { nowIso } from "../domain/workflow";
import { handler, httpError, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import { issueInvite } from "../services/invites";
import { emailInvitation } from "../services/email";
import { env } from "../config/env";
import { keysToCamel, keysToSnake } from "./caseMap";
import { sendCompatSuccess } from "./envelope";
import { withTaxReturnId } from "./ids";
import { maskContactsForViewer } from "./privacy";

export const compatAdminRouter = Router();

const STAFF_ADMIN = ["ADMIN", "SUPER_ADMIN"] as const;

function searchNeedle(body: Record<string, unknown>): string {
  return String(body.search ?? body.q ?? body.email ?? "").trim().toLowerCase();
}

function inviteOrigin(req: { get: (h: string) => string | undefined }): string {
  return (req.get("origin") ?? (env("APP_BASE_URL") ?? "").replace(/\/$/, "")).replace(/\/$/, "");
}

// ---------------------------------------------------------------- S2 accountants
compatAdminRouter.post(
  "/admin/accountants",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const me = authed(req);
    const needle = searchNeedle((req.body ?? {}) as Record<string, unknown>);
    const query: Doc = {
      role: "ACCOUNTANT",
      is_test: { $ne: true },
      email: { $not: { $regex: TEST_EMAIL_REGEX } },
    };
    let users = cleanMany(
      (await col("users").find(query).sort({ created_at: -1 }).limit(500).toArray()) as Doc[],
    );
    if (needle) {
      users = users.filter(
        (u) =>
          String(u.name ?? "")
            .toLowerCase()
            .includes(needle) ||
          String(u.email ?? "")
            .toLowerCase()
            .includes(needle),
      );
    }
    // Accountants are staff — masking still applied via viewer rules (no-op for non-CLIENT).
    const masked = maskContactsForViewer(users, me);
    sendCompatSuccess(
      res,
      {
        accountants: masked.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone ?? null,
          isActive: u.is_active !== false,
          status: u.is_active === false ? "inactive" : u.status ?? "active",
          role: u.role,
          createdAt: u.created_at,
        })),
      },
      "OK",
    );
  }),
);

compatAdminRouter.post(
  "/admin/accountants/create",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = keysToSnake(req.body ?? {}) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!name || !email) throw httpError(400, "name and email are required");
    const role = String(body.role ?? "ACCOUNTANT");
    if (!["ACCOUNTANT", "ADMIN"].includes(role)) {
      throw httpError(400, "Only ACCOUNTANT or ADMIN invites are supported here");
    }
    if (await col("users").findOne({ email })) throw httpError(400, "Email already exists");
    const { randomUUID } = await import("crypto");
    const { logActivity } = await import("../domain/workflow");
    const created: Doc = {
      id: randomUUID(),
      email,
      name,
      role,
      password_hash: null,
      phone: null,
      is_active: false,
      status: "PENDING",
      created_at: nowIso(),
    };
    await col("users").insertOne({ ...created });
    if (role === "ACCOUNTANT") {
      await col("accountant_profiles").updateOne(
        { user_id: created.id },
        {
          $set: {
            name,
            email,
            specialisms: Array.isArray(body.specialisms)
              ? body.specialisms
              : ["SELF_ASSESSMENT"],
            capacity: typeof body.capacity === "number" ? body.capacity : 15,
            is_active: false,
          },
          $setOnInsert: { id: randomUUID(), user_id: created.id, created_at: nowIso() },
        },
        { upsert: true },
      );
    }
    const invite = await issueInvite(String(created.id), email, String(me.id));
    await logActivity(null, `Staff invitation sent to ${email}`, me, {
      target_user_id: created.id,
      role,
    });
    const link = `${inviteOrigin(req)}/invite/${invite.token}`;
    try {
      await emailInvitation({
        to: email,
        name,
        role,
        setupLink: link,
        expiresAt: invite.expires_at,
        inviteId: invite.id,
      });
    } catch {
      // Email optional in tests.
    }
    sendCompatSuccess(
      res,
      {
        ok: true,
        inviteId: invite.id,
        userId: created.id,
        email,
        role,
        inviteLink: link,
        expiresAt: invite.expires_at,
      },
      "Invitation created",
      201,
    );
  }),
);

compatAdminRouter.put(
  "/admin/accountants/update/:userId",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const body = keysToSnake(req.body ?? {}) as Record<string, unknown>;
    const user = (await col("users").findOne({
      id: req.params.userId,
      role: { $in: ["ACCOUNTANT", "ADMIN"] },
    })) as Doc | null;
    if (!user) throw httpError(404, "Accountant not found");
    const patch: Doc = { updated_at: nowIso() };
    if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
    if (typeof body.phone === "string") patch.phone = body.phone;
    await col("users").updateOne({ id: user.id }, { $set: patch });
    const updated = await col("users").findOne({ id: user.id });
    sendCompatSuccess(res, keysToCamel(clean(updated as Doc)), "Updated");
  }),
);

compatAdminRouter.post(
  "/admin/accountants/:userId/status",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const status = String(body.status ?? "").toLowerCase();
    const active =
      status === "active" || status === "true" || body.isActive === true || body.is_active === true;
    const inactive =
      status === "inactive" ||
      status === "false" ||
      body.isActive === false ||
      body.is_active === false;
    if (!active && !inactive) throw httpError(400, "status must be active or inactive");
    const user = (await col("users").findOne({
      id: req.params.userId,
      role: { $in: ["ACCOUNTANT", "ADMIN"] },
    })) as Doc | null;
    if (!user) throw httpError(404, "User not found");
    await col("users").updateOne(
      { id: user.id },
      { $set: { is_active: active, updated_at: nowIso() } },
    );
    sendCompatSuccess(res, { ok: true, id: user.id, isActive: active }, "OK");
  }),
);

compatAdminRouter.delete(
  "/admin/accountants/:userId",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    // Soft-deactivate — prefer invites/deactivate over hard delete.
    const user = (await col("users").findOne({
      id: req.params.userId,
      role: { $in: ["ACCOUNTANT", "ADMIN"] },
    })) as Doc | null;
    if (!user) throw httpError(404, "User not found");
    await col("users").updateOne(
      { id: user.id },
      { $set: { is_active: false, updated_at: nowIso() } },
    );
    sendCompatSuccess(res, { ok: true, id: user.id, isActive: false }, "Deactivated");
  }),
);

// ---------------------------------------------------------------- S2 clients
compatAdminRouter.post(
  "/admin/clients",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const me = authed(req);
    const needle = searchNeedle((req.body ?? {}) as Record<string, unknown>);
    const query: Doc = {
      role: "CLIENT",
      is_test: { $ne: true },
      email: { $not: { $regex: TEST_EMAIL_REGEX } },
    };
    let users = cleanMany(
      (await col("users").find(query).sort({ created_at: -1 }).limit(500).toArray()) as Doc[],
    );
    if (needle) {
      users = users.filter(
        (u) =>
          String(u.name ?? "")
            .toLowerCase()
            .includes(needle) ||
          String(u.email ?? "")
            .toLowerCase()
            .includes(needle),
      );
    }
    const masked = maskContactsForViewer(users, me);
    sendCompatSuccess(
      res,
      {
        clients: masked.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone ?? null,
          contactMasked: Boolean(u.contact_masked),
          isActive: u.is_active !== false,
          status: u.is_active === false ? "inactive" : "active",
          role: u.role,
          createdAt: u.created_at,
        })),
      },
      "OK",
    );
  }),
);

compatAdminRouter.put(
  "/admin/clients/:userId/status",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const status = String(body.status ?? "").toLowerCase();
    const active = status === "active" || body.isActive === true;
    const inactive = status === "inactive" || body.isActive === false;
    if (!active && !inactive) throw httpError(400, "status must be active or inactive");
    const user = (await col("users").findOne({
      id: req.params.userId,
      role: "CLIENT",
    })) as Doc | null;
    if (!user) throw httpError(404, "Client not found");
    await col("users").updateOne(
      { id: user.id },
      { $set: { is_active: active, updated_at: nowIso() } },
    );
    sendCompatSuccess(res, { ok: true, id: user.id, isActive: active }, "OK");
  }),
);

/** SUPER_ADMIN-only reveal proxy — preserves audited native path. */
compatAdminRouter.post(
  "/admin/clients/:userId/reveal-contact",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(z.object({ reason: z.string() }), req.body ?? {});
    if (!body.reason.trim()) throw httpError(400, "A reason is required");
    const target = (await col("users").findOne({
      id: req.params.userId,
      role: "CLIENT",
    })) as Doc | null;
    if (!target) throw httpError(404, "Client not found");
    const { randomUUID } = await import("crypto");
    await col("contact_access_audit").insertOne({
      id: randomUUID(),
      client_user_id: req.params.userId,
      client_name: target.name,
      accessed_by: me.name,
      role: me.role,
      reason: body.reason,
      created_at: nowIso(),
    });
    sendCompatSuccess(
      res,
      {
        email: target.email,
        phone: target.phone ?? null,
        name: target.name,
        utr: target.utr ?? null,
      },
      "Revealed",
    );
  }),
);

// ---------------------------------------------------------------- S3 stats
compatAdminRouter.post(
  "/admin/dashboard/stats",
  auth(...STAFF_ADMIN),
  handler(async (_req, res) => {
    const active = { $nin: ["SUBMITTED", "COMPLETED"] };
    const count = (q: Doc) => col("cases").countDocuments({ ...q, ...OPERATIONAL_ONLY });
    const totalClients = await col("users").countDocuments({
      role: "CLIENT",
      is_test: { $ne: true },
      email: { $not: { $regex: TEST_EMAIL_REGEX } },
    });
    const totalAccountants = await col("users").countDocuments({
      role: "ACCOUNTANT",
      is_active: true,
      is_test: { $ne: true },
    });
    const totalCompletedTaxReturns = await count({ status: "COMPLETED" });
    const totalOngoingTaxReturns = await count({ status: active });
    sendCompatSuccess(
      res,
      {
        totalClients,
        totalAccountants,
        totalCompletedTaxReturns,
        totalOngoingTaxReturns,
        // Native bucket fields (best-effort extra).
        new: await count({ status: { $in: ["NEW", "ONBOARDING", "AWAITING_ASSIGNMENT"] } }),
        unassigned: await count({ assigned_accountant_id: null }),
        inProgress: await count({
          status: { $in: ["ASSIGNED", "ACCOUNTANT_REVIEW", "IN_PREPARATION", "CHANGES_REQUIRED"] },
        }),
        adminReview: await count({
          status: { $in: ["READY_FOR_ADMIN_REVIEW", "ADMIN_REVIEW"] },
        }),
      },
      "OK",
    );
  }),
);

compatAdminRouter.post(
  "/accountant/dashboard/stats",
  auth("ACCOUNTANT"),
  handler(async (req, res) => {
    const me = authed(req);
    const base = { assigned_accountant_id: me.id };
    const active = { $nin: ["SUBMITTED", "COMPLETED"] };
    const count = (q: Doc) => col("cases").countDocuments({ ...q, ...OPERATIONAL_ONLY });
    sendCompatSuccess(
      res,
      {
        totalCompletedTaxReturns: await count({
          ...base,
          status: { $in: ["SUBMITTED", "COMPLETED"] },
        }),
        totalOngoingTaxReturns: await count({ ...base, status: active }),
        needsMyAction: await count({
          ...base,
          next_action_owner: "ACCOUNTANT",
          status: active,
        }),
        awaitingClient: await count({ ...base, status: "AWAITING_CLIENT" }),
        changesRequired: await count({ ...base, status: "CHANGES_REQUIRED" }),
      },
      "OK",
    );
  }),
);

// ---------------------------------------------------------------- S4 payments
compatAdminRouter.get(
  "/admin/payments",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const kind = typeof req.query.kind === "string" ? req.query.kind : undefined;
    const query: Doc = {};
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
    const payments = [];
    for (const r of rows) {
      const c = clients.get(r.client_id as string);
      if (!c || c.is_test) continue;
      payments.push({
        id: r.id,
        kind: r.kind,
        paymentStatus: r.payment_status,
        amount: r.amount,
        currency: r.currency ?? "gbp",
        clientId: r.client_id,
        clientName: c.name,
        clientRef: c.client_ref ?? null,
        caseId: r.case_id ?? null,
        createdAt: r.created_at,
        sessionId: r.session_id ?? null,
      });
    }
    sendCompatSuccess(res, { payments, total: payments.length }, "OK");
  }),
);

compatAdminRouter.get(
  "/admin/payments/by-user",
  auth(...STAFF_ADMIN),
  handler(async () => {
    throw httpError(405, "Payments by-user aggregation is deferred in P0");
  }),
);

/** Deferred S4 extras — explicit HIDE rather than inventing analytics. */
compatAdminRouter.get(
  "/admin/payments/stats",
  auth(...STAFF_ADMIN),
  handler(async () => {
    throw httpError(405, "Payment stats are deferred in P0");
  }),
);
compatAdminRouter.get(
  "/admin/payments/export",
  auth(...STAFF_ADMIN),
  handler(async () => {
    throw httpError(405, "Payment export is deferred in P0");
  }),
);

// ---------------------------------------------------------------- S5 FAQs
compatAdminRouter.post(
  "/admin/faqs",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const page = Math.max(1, Number(body.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(body.limit ?? 50) || 50));
    const category = body.category ? String(body.category) : null;
    const query: Doc = {};
    if (category) query.category = category;
    // Staff list includes inactive for management.
    const all = cleanMany(
      (await col("faqs").find(query).sort({ order: 1 }).limit(500).toArray()) as Doc[],
    );
    const total = all.length;
    const faqs = all.slice((page - 1) * limit, page * limit);
    sendCompatSuccess(
      res,
      {
        faqs: keysToCamel(faqs),
        pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
        categories: FAQ_CATEGORIES,
      },
      "OK",
    );
  }),
);

compatAdminRouter.post(
  "/admin/faqs/create",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const body = keysToSnake(req.body ?? {}) as Record<string, unknown>;
    const question = String(body.question ?? "").trim();
    const answer = String(body.answer ?? "").trim();
    if (!question || !answer) throw httpError(400, "question and answer are required");
    const { randomUUID } = await import("crypto");
    const doc: Doc = {
      id: randomUUID(),
      category: String(body.category ?? FAQ_CATEGORIES[0] ?? "General"),
      question,
      answer,
      order: Number(body.order ?? 0) || 0,
      is_active: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await col("faqs").insertOne({ ...doc });
    sendCompatSuccess(res, keysToCamel(doc), "Created", 201);
  }),
);

compatAdminRouter.put(
  "/admin/faqs/update/:faqId",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const body = keysToSnake(req.body ?? {}) as Record<string, unknown>;
    const existing = (await col("faqs").findOne({ id: req.params.faqId })) as Doc | null;
    if (!existing) throw httpError(404, "FAQ not found");
    const patch: Doc = { updated_at: nowIso() };
    if (typeof body.question === "string") patch.question = body.question;
    if (typeof body.answer === "string") patch.answer = body.answer;
    if (typeof body.category === "string") patch.category = body.category;
    if (body.order != null) patch.order = Number(body.order) || 0;
    await col("faqs").updateOne({ id: existing.id }, { $set: patch });
    const updated = await col("faqs").findOne({ id: existing.id });
    sendCompatSuccess(res, keysToCamel(clean(updated as Doc)), "Updated");
  }),
);

compatAdminRouter.put(
  "/admin/faqs/:faqId/status",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const active =
      body.isActive === true ||
      body.is_active === true ||
      String(body.status ?? "").toLowerCase() === "active";
    const existing = (await col("faqs").findOne({ id: req.params.faqId })) as Doc | null;
    if (!existing) throw httpError(404, "FAQ not found");
    await col("faqs").updateOne(
      { id: existing.id },
      { $set: { is_active: active, updated_at: nowIso() } },
    );
    sendCompatSuccess(res, { ok: true, id: existing.id, isActive: active }, "OK");
  }),
);

compatAdminRouter.delete(
  "/admin/faqs/delete/:faqId",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const existing = (await col("faqs").findOne({ id: req.params.faqId })) as Doc | null;
    if (!existing) throw httpError(404, "FAQ not found");
    await col("faqs").updateOne(
      { id: existing.id },
      { $set: { is_active: false, updated_at: nowIso() } },
    );
    sendCompatSuccess(res, { ok: true, id: existing.id }, "Deleted");
  }),
);

// ---------------------------------------------------------------- C3 tax-return lists (admin/accountant)
async function listCasesForStaff(me: Doc, body: Record<string, unknown>): Promise<Doc[]> {
  const query: Doc = { ...OPERATIONAL_ONLY };
  if (me.role === "ACCOUNTANT") query.assigned_accountant_id = me.id;
  const serviceType = body.serviceType ?? body.service_type;
  if (typeof serviceType === "string" && serviceType) query.service_type = serviceType;
  const status = body.status;
  if (typeof status === "string" && status) query.status = { $in: status.split(",") };
  const cases = (await col("cases")
    .find(query)
    .sort({ last_updated: -1 })
    .limit(200)
    .toArray()) as Doc[];
  return scrubMany(cleanMany(cases), me).map((c) =>
    withTaxReturnId({
      ...c,
      tax_return_id: c.id,
      case_id: c.id,
    }),
  );
}

compatAdminRouter.post(
  "/admin/tax-return/files",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const me = authed(req);
    const files = await listCasesForStaff(me, (req.body ?? {}) as Record<string, unknown>);
    sendCompatSuccess(res, { files, taxReturns: files }, "OK");
  }),
);

compatAdminRouter.post(
  "/accountant/tax-return/files",
  auth("ACCOUNTANT"),
  handler(async (req, res) => {
    const me = authed(req);
    const files = await listCasesForStaff(me, (req.body ?? {}) as Record<string, unknown>);
    sendCompatSuccess(res, { files, taxReturns: files }, "OK");
  }),
);

/** Staff case detail — shared shape for admin + accountant manage-tax pages. */
async function staffCaseDetailPayload(me: Doc, taxReturnId: string): Promise<Doc> {
  const { getCase } = await import("../domain/cases");
  const { toCaseId } = await import("./ids");
  const { clientStatus } = await import("../domain/workflow");
  const caseId = toCaseId(taxReturnId);
  const kase = await getCase(caseId, me);

  const clientUser = (await col("users").findOne(
    { id: kase.client_user_id },
    { projection: { password_hash: 0, totp: 0, recovery_code_hashes: 0 } },
  )) as Doc | null;
  const maskedClient = clientUser
    ? (maskContactsForViewer([clean(clientUser) as Doc], me)[0] as Doc)
    : null;
  const nameParts = String(maskedClient?.name ?? kase.client_name ?? "")
    .trim()
    .split(/\s+/);
  const serviceType = String(kase.service_type ?? "SELF_ASSESSMENT");
  const typeName =
    serviceType === "MTD_INCOME_TAX" || serviceType === "MTD"
      ? "Making Tax Digital"
      : "Self Assessment";
  const typeCode =
    serviceType === "MTD_INCOME_TAX" || serviceType === "MTD" ? "MTD" : "SA";

  let accountant: Doc | null = null;
  if (kase.assigned_accountant_id) {
    const acc = (await col("users").findOne(
      { id: kase.assigned_accountant_id },
      { projection: { id: 1, name: 1, email: 1 } },
    )) as Doc | null;
    if (acc) {
      accountant = { id: acc.id, name: acc.name, email: acc.email };
    } else if (kase.assigned_accountant_name) {
      accountant = {
        id: kase.assigned_accountant_id,
        name: kase.assigned_accountant_name,
        email: null,
      };
    }
  }

  const docs = (await col("documents")
    .find({ case_id: caseId, is_deleted: { $ne: true } })
    .sort({ created_at: -1 })
    .limit(500)
    .toArray()) as Doc[];
  const cleanedDocs = scrubMany(cleanMany(docs), me);
  const allFiles = cleanedDocs.map((d) => {
    const requested = d.status === "Requested";
    const category = String(d.document_type ?? "Other");
    return {
      id: d.id,
      filename: d.name ?? "document",
      documentType: category,
      cloudinaryUrl: null,
      cloudinaryPublicId: null,
      fileSize: Number(d.size ?? 0),
      mimeType: d.content_type ?? "application/octet-stream",
      uploadStatus: requested ? "pending" : "completed",
      isRequired: requested || Boolean(d.request_id),
      uploadedBy: d.uploader_id ?? null,
      uploadedAt: d.upload_date ?? d.created_at ?? null,
      updatedAt: d.updated_at ?? d.created_at ?? null,
      thumbnailUrl: null,
      previewUrl: null,
      downloadUrl: `client/documents/${d.id}/download`,
      isInternal: Boolean(d.is_internal),
      isFinal: Boolean(d.is_final),
    };
  });
  const totalSize = allFiles.reduce((sum, f) => sum + Number(f.fileSize || 0), 0);
  const requiredFiles = allFiles.filter((f) => f.isRequired).length;
  const completedFiles = allFiles.filter((f) => f.uploadStatus === "completed").length;
  const pendingFiles = allFiles.filter((f) => f.uploadStatus !== "completed").length;
  const categories: Record<string, Doc[]> = {};
  for (const f of allFiles) {
    const key = String(f.documentType || "Other");
    if (!categories[key]) categories[key] = [];
    categories[key].push(f);
  }

  const taxYearRaw = String(kase.tax_year ?? "");
  const taxYearNum = parseInt(taxYearRaw.split("/")[0] || taxYearRaw, 10);

  const taxReturn = withTaxReturnId({
    id: kase.id,
    taxReturnId: kase.case_ref ?? kase.id,
    taxYear: Number.isFinite(taxYearNum) ? taxYearNum : taxYearRaw,
    status: String(kase.status ?? "").toLowerCase(),
    statusLabel: clientStatus(String(kase.status)),
    serviceType,
    client: {
      id: maskedClient?.id ?? kase.client_user_id,
      name: nameParts[0] || "Client",
      surname: nameParts.slice(1).join(" "),
      email: maskedClient?.email ?? null,
      phone: maskedClient?.phone ?? null,
    },
    type: { typeName, typeCode },
    accountant,
    caseRef: kase.case_ref,
    assignedAccountantId: kase.assigned_accountant_id ?? null,
    internalDeadline: kase.internal_deadline ?? null,
    externalDeadline: kase.external_deadline ?? null,
  });

  const files = {
    totalFiles: allFiles.length,
    totalSize,
    requiredFiles,
    completedFiles,
    pendingFiles,
    completionPercentage:
      requiredFiles > 0
        ? Math.round(
            (allFiles.filter((f) => f.isRequired && f.uploadStatus === "completed").length /
              requiredFiles) *
              100,
          )
        : allFiles.length
          ? Math.round((completedFiles / allFiles.length) * 100)
          : 0,
    categories,
    allFiles,
  };

  return { taxReturn, files };
}

compatAdminRouter.post(
  "/admin/tax-return/:taxReturnId/files",
  auth(...STAFF_ADMIN, "ACCOUNTANT"),
  handler(async (req, res) => {
    const me = authed(req);
    const payload = await staffCaseDetailPayload(me, req.params.taxReturnId);
    sendCompatSuccess(res, payload, "OK");
  }),
);

compatAdminRouter.post(
  "/accountant/tax-return/files/:taxReturnId",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const payload = await staffCaseDetailPayload(me, req.params.taxReturnId);
    sendCompatSuccess(res, payload, "OK");
  }),
);

/** S6 HIDE markers — refuse CMS-style invent-a-backend paths. */
for (const path of [
  "/admin/cms",
  "/admin/partners",
  "/admin/tax-rates",
  "/admin/api-keys",
  "/admin/templates",
  "/admin/global-fee",
  "/admin/yearly-metrics",
  "/admin/status-distribution",
  "/admin/key-management",
  "/admin/fee-settings",
]) {
  compatAdminRouter.all(path, auth(...STAFF_ADMIN), handler(async () => {
    throw httpError(405, "This admin surface is deferred (S6 HIDE) in P0");
  }));
}
