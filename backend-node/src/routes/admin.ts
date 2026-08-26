/** Staff directory, invitations, help centre, statistics, audit log and business overview. */
import { randomUUID } from "crypto";

import { Request, Router } from "express";
import { z } from "zod";

import { clean, cleanMany, col, Doc, maskContactMany } from "../db/mongo";
import { FAQ_CATEGORIES } from "../domain/helpcentre";
import { isTestEmail, OPERATIONAL_ONLY, TEST_EMAIL_REGEX } from "../domain/testdata";
import {
  isoPlusDays,
  logActivity,
  nowIso,
  STATUS_META,
  STATUSES,
} from "../domain/workflow";
import { handler, httpError, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import { hashPassword } from "../services/auth";
import { bootstrapClientServices } from "../services/clientServices";
import { consumeInvite, findValidInvite, issueInvite } from "../services/invites";
import { checkPasswordStrength } from "../services/security";

export const adminRouter = Router();

const STAFF_ADMIN = ["ADMIN", "SUPER_ADMIN"] as const;

const CreateUserIn = z.object({
  email: z.string().email(),
  password: z.string(),
  name: z.string(),
  phone: z.string().nullish().default(null),
  role: z.string(),
});
const StaffInviteIn = z.object({
  name: z.string(),
  email: z.string(),
  role: z.string().default("ACCOUNTANT"),
  specialisms: z.array(z.string()).default(["SELF_ASSESSMENT"]),
  capacity: z.number().nullish().default(null),
});
const AcceptInviteIn = z.object({ password: z.string() });
const ReasonIn = z.object({ reason: z.string() });
const FaqIn = z.object({
  category: z.string(),
  question: z.string(),
  answer: z.string(),
  order: z.number().default(0),
});

function str(req: Request, name: string): string | undefined {
  const v = req.query[name];
  return typeof v === "string" && v.length ? v : undefined;
}

function boolQuery(req: Request, name: string): boolean {
  const v = req.query[name];
  return typeof v === "string" && ["true", "1", "yes", "on"].includes(v.toLowerCase());
}

function intQuery(req: Request, name: string, fallback: number): number {
  const v = str(req, name);
  const parsed = v === undefined ? NaN : Number(v);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Case counts always exclude automated-test records, exactly as the Python helper does. */
async function count(query: Doc): Promise<number> {
  return col("cases").countDocuments({ ...query, ...OPERATIONAL_ONLY });
}

// ---------------------------------------------------------------- help centre
adminRouter.get(
  "/faqs",
  auth(),
  handler(async (req, res) => {
    const query: Doc = { is_active: true };
    const category = str(req, "category");
    if (category) query.category = category;
    let rows = cleanMany(
      (await col("faqs").find(query).sort({ order: 1 }).limit(300).toArray()) as Doc[],
    );
    const q = str(req, "q");
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter(
        (r) =>
          String(r.question).toLowerCase().includes(needle) ||
          String(r.answer).toLowerCase().includes(needle) ||
          String(r.category).toLowerCase().includes(needle),
      );
    }
    res.json(rows);
  }),
);

adminRouter.get(
  "/faq-categories",
  auth(),
  handler(async (_req, res) => {
    res.json(FAQ_CATEGORIES);
  }),
);

adminRouter.post(
  "/faqs",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(FaqIn, req.body);
    const row: Doc = {
      id: randomUUID(),
      category: body.category,
      question: body.question,
      answer: body.answer,
      order: body.order,
      is_active: true,
      updated_by: me.name,
      created_at: nowIso(),
    };
    await col("faqs").insertOne({ ...row });
    res.json(clean(row));
  }),
);

adminRouter.patch(
  "/faqs/:faqId",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(FaqIn, req.body);
    const result = await col("faqs").updateOne(
      { id: req.params.faqId },
      {
        $set: {
          category: body.category,
          question: body.question,
          answer: body.answer,
          order: body.order,
          updated_by: me.name,
          updated_at: nowIso(),
        },
      },
    );
    if (!result.matchedCount) throw httpError(404, "FAQ not found");
    res.json({ ok: true });
  }),
);

adminRouter.delete(
  "/faqs/:faqId",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    await col("faqs").updateOne({ id: req.params.faqId }, { $set: { is_active: false } });
    res.json({ ok: true });
  }),
);

// ---------------------------------------------------------------- stats
adminRouter.get(
  "/stats/admin",
  auth(...STAFF_ADMIN),
  handler(async (_req, res) => {
    const active = { $nin: ["SUBMITTED", "COMPLETED"] };
    const adminReview = { status: { $in: ["READY_FOR_ADMIN_REVIEW", "ADMIN_REVIEW"] } };
    const clientApproval = { status: { $in: ["ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL"] } };
    res.json({
      new: await count({ status: { $in: ["NEW", "ONBOARDING", "AWAITING_ASSIGNMENT"] } }),
      unassigned: await count({ assigned_accountant_id: null }),
      in_progress: await count({
        status: { $in: ["ASSIGNED", "ACCOUNTANT_REVIEW", "IN_PREPARATION", "CHANGES_REQUIRED"] },
      }),
      waiting_client: await count({ status: "AWAITING_CLIENT" }),
      admin_review: await count(adminReview),
      client_approval: await count(clientApproval),
      awaiting_admin_review: await count(adminReview),
      awaiting_client_approval: await count(clientApproval),
      ready_submission: await count({
        status: { $in: ["CLIENT_APPROVED", "READY_FOR_SUBMISSION"] },
      }),
      assigned: await count({ assigned_accountant_id: { $ne: null }, status: active }),
      changes_required: await count({ status: "CHANGES_REQUIRED" }),
      submitted: await count({ status: { $in: ["SUBMITTED", "SUBMISSION_IN_PROGRESS"] } }),
      case_completed: await count({ status: "COMPLETED" }),
      attention: await count({
        $or: [
          { status: "SUBMISSION_ISSUE" },
          { internal_deadline: { $lt: nowIso() }, status: active },
        ],
      }),
      overdue: await count({ internal_deadline: { $lt: nowIso() }, status: active }),
    });
  }),
);

adminRouter.get(
  "/stats/accountant",
  auth("ACCOUNTANT"),
  handler(async (req, res) => {
    const me = authed(req);
    const base = { assigned_accountant_id: me.id };
    const active = { $nin: ["SUBMITTED", "COMPLETED"] };
    const week = isoPlusDays(7);
    const today = isoPlusDays(1);
    const readyForAdmin = { $in: ["READY_FOR_ADMIN_REVIEW", "ADMIN_REVIEW"] };
    res.json({
      needs_my_action: await count({ ...base, next_action_owner: "ACCOUNTANT", status: active }),
      due_today: await count({ ...base, internal_deadline: { $lte: today }, status: active }),
      due_week: await count({ ...base, internal_deadline: { $lte: week }, status: active }),
      awaiting_client: await count({ ...base, status: "AWAITING_CLIENT" }),
      new_assigned: await count({ ...base, status: "ASSIGNED" }),
      in_progress: await count({
        ...base,
        status: { $in: ["ACCOUNTANT_REVIEW", "IN_PREPARATION"] },
      }),
      changes_required: await count({ ...base, status: "CHANGES_REQUIRED" }),
      awaiting_admin_review: await count({ ...base, status: readyForAdmin }),
      approved_ready: await count({
        ...base,
        status: {
          $in: [
            "ADMIN_APPROVED",
            "AWAITING_CLIENT_APPROVAL",
            "CLIENT_APPROVED",
            "READY_FOR_SUBMISSION",
          ],
        },
      }),
      case_completed: await count({ ...base, status: { $in: ["SUBMITTED", "COMPLETED"] } }),
      ready_for_admin: await count({ ...base, status: readyForAdmin }),
      admin_changes: await count({ ...base, status: "CHANGES_REQUIRED" }),
      completed: await count({
        ...base,
        status: { $in: ["SUBMITTED", "COMPLETED", "READY_FOR_SUBMISSION"] },
      }),
    });
  }),
);

adminRouter.get(
  "/accountants/workload",
  auth(...STAFF_ADMIN),
  handler(async (_req, res) => {
    const week = isoPlusDays(7);
    const active = { $nin: ["SUBMITTED", "COMPLETED"] };
    const out: Doc[] = [];
    const accountants = (await col("users")
      .find({ role: "ACCOUNTANT", is_active: true, ...OPERATIONAL_ONLY })
      .toArray()) as Doc[];
    for (const acc of accountants) {
      const base = { assigned_accountant_id: acc.id };
      const profile = (await col("accountant_profiles").findOne({ user_id: acc.id })) as Doc | null;
      const capacity: number = profile?.capacity ?? 15;
      const activeCases = await count({ ...base, status: active });
      out.push({
        id: acc.id,
        name: acc.name,
        email: acc.email,
        active_cases: activeCases,
        waiting_client: await count({ ...base, status: "AWAITING_CLIENT" }),
        due_this_week: await count({
          ...base,
          internal_deadline: { $lte: week },
          status: active,
        }),
        overdue: await count({ ...base, internal_deadline: { $lt: nowIso() }, status: active }),
        capacity,
        availability: activeCases < capacity ? "Available" : "At Capacity",
      });
    }
    res.json(out);
  }),
);

// ---------------------------------------------------------------- super admin
adminRouter.get(
  "/users",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const me = authed(req);
    const query: Doc = {};
    const role = str(req, "role");
    const email = str(req, "email");
    if (role) query.role = role;
    if (email) query.email = email.trim().toLowerCase();
    if (!boolQuery(req, "include_test")) {
      // Automated-test accounts stay in the database but leave the operational directory.
      query.email = query.email ?? { $not: { $regex: TEST_EMAIL_REGEX } };
      query.is_test = { $ne: true };
    }
    const users = cleanMany(
      (await col("users").find(query).sort({ created_at: -1 }).limit(500).toArray()) as Doc[],
    );
    for (const u of users) {
      if (u.status === "PENDING") {
        const invite = (await col("staff_invites").findOne(
          { user_id: u.id, used_at: null, revoked_at: null },
          { sort: { created_at: -1 } },
        )) as Doc | null;
        // Only the expiry is exposed -- never the token.
        u.invite_expires_at = invite ? invite.expires_at : null;
      }
    }
    res.json(maskContactMany(users, me));
  }),
);

adminRouter.post(
  "/clients/:clientUserId/reveal-contact",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(ReasonIn, req.body);
    if (!body.reason.trim()) throw httpError(400, "A reason is required");
    const target = (await col("users").findOne({
      id: req.params.clientUserId,
      role: "CLIENT",
    })) as Doc | null;
    if (!target) throw httpError(404, "Client not found");
    await col("contact_access_audit").insertOne({
      id: randomUUID(),
      client_user_id: req.params.clientUserId,
      client_name: target.name,
      accessed_by: me.name,
      role: me.role,
      reason: body.reason,
      created_at: nowIso(),
    });
    res.json({
      email: target.email,
      phone: target.phone ?? null,
      name: target.name,
      utr: target.utr ?? null,
    });
  }),
);

adminRouter.get(
  "/contact-access-log",
  auth("SUPER_ADMIN"),
  handler(async (_req, res) => {
    const rows = (await col("contact_access_audit")
      .find({})
      .sort({ created_at: -1 })
      .limit(200)
      .toArray()) as Doc[];
    res.json(cleanMany(rows));
  }),
);

adminRouter.post(
  "/users",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const body = parseBody(CreateUserIn, req.body);
    if (!["CLIENT", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"].includes(body.role)) {
      throw httpError(400, "Invalid role");
    }
    const email = body.email.toLowerCase();
    if (await col("users").findOne({ email })) throw httpError(400, "Email already exists");
    const created: Doc = {
      id: randomUUID(),
      email,
      name: body.name,
      role: body.role,
      password_hash: hashPassword(body.password),
      phone: body.phone ?? null,
      is_active: true,
      created_at: nowIso(),
    };
    await col("users").insertOne({ ...created });
    if (body.role === "CLIENT") {
      const client: Doc = {
        id: randomUUID(),
        user_id: created.id,
        name: body.name,
        email,
        phone: body.phone ?? null,
        is_test: isTestEmail(email),
        created_at: nowIso(),
      };
      const total = await col("clients").countDocuments({});
      client.client_ref = `CL-${String(42 + total).padStart(4, "0")}`;
      await col("clients").insertOne({ ...client });
      await bootstrapClientServices(client);
    }
    if (body.role === "ACCOUNTANT") {
      await col("accountant_profiles").insertOne({
        id: randomUUID(),
        user_id: created.id,
        name: body.name,
        email,
        specialisms: ["SELF_ASSESSMENT"],
        capacity: 15,
        is_active: true,
        created_at: nowIso(),
      });
    }
    res.json(clean({ ...created }));
  }),
);

adminRouter.patch(
  "/users/:userId/active",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const raw = str(req, "is_active");
    if (raw === undefined) {
      throw httpError(422, [
        { loc: ["query", "is_active"], msg: "field required", type: "missing" },
      ]);
    }
    const isActive = ["true", "1", "yes", "on"].includes(raw.toLowerCase());
    await col("users").updateOne({ id: req.params.userId }, { $set: { is_active: isActive } });
    // Deactivation keeps every historical record; only the login and new assignments stop.
    let openCases = 0;
    if (!isActive) {
      openCases = await col("cases").countDocuments({
        assigned_accountant_id: req.params.userId,
        status: { $nin: ["COMPLETED", "SUBMITTED"] },
        ...OPERATIONAL_ONLY,
      });
      await col("accountant_profiles").updateOne(
        { user_id: req.params.userId },
        { $set: { is_active: false } },
      );
      await logActivity(null, "Staff account deactivated", me, {
        target_user_id: req.params.userId,
        active_cases: openCases,
      });
    } else {
      await col("accountant_profiles").updateOne(
        { user_id: req.params.userId },
        { $set: { is_active: true } },
      );
    }
    res.json({ ok: true, active_cases_needing_reassignment: openCases });
  }),
);

// ---------------------------------------------------------- staff invitations
adminRouter.post(
  "/staff-invites",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(StaffInviteIn, req.body);
    if (!["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"].includes(body.role)) {
      throw httpError(400, "Invalid role");
    }
    const email = body.email.trim().toLowerCase();
    if (await col("users").findOne({ email })) throw httpError(400, "Email already exists");
    const created: Doc = {
      id: randomUUID(),
      email,
      name: body.name.trim(),
      role: body.role,
      password_hash: null,
      phone: null,
      is_active: false,
      status: "PENDING",
      created_at: nowIso(),
    };
    await col("users").insertOne({ ...created });
    if (body.role === "ACCOUNTANT") {
      await col("accountant_profiles").updateOne(
        { user_id: created.id },
        {
          $set: {
            name: created.name,
            email,
            specialisms: body.specialisms,
            capacity: body.capacity ?? 15,
            is_active: false,
          },
          $setOnInsert: { id: randomUUID(), user_id: created.id, created_at: nowIso() },
        },
        { upsert: true },
      );
    }
    const invite = await issueInvite(created.id, email, me.id);
    await logActivity(null, `Staff invitation sent to ${email}`, me, {
      target_user_id: created.id,
      role: body.role,
    });
    const origin = req.get("origin") ?? "";
    res.json({
      user: clean({ ...created }),
      setup_link: `${origin}/invite/${invite.token}`,
      expires_at: invite.expires_at,
    });
  }),
);

adminRouter.post(
  "/staff-invites/:userId/resend",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const target = (await col("users").findOne({ id: req.params.userId })) as Doc | null;
    if (!target) throw httpError(404, "User not found");
    if (target.status !== "PENDING") throw httpError(400, "This account is already active");
    const invite = await issueInvite(req.params.userId, target.email, me.id);
    await logActivity(null, `Staff invitation resent to ${target.email}`, me, {
      target_user_id: req.params.userId,
    });
    const origin = req.get("origin") ?? "";
    res.json({ setup_link: `${origin}/invite/${invite.token}`, expires_at: invite.expires_at });
  }),
);

adminRouter.get(
  "/auth/invite/:token",
  handler(async (req, res) => {
    const invite = await findValidInvite(req.params.token);
    if (!invite) throw httpError(400, "This invitation is no longer valid");
    const target = (await col("users").findOne({ id: invite.user_id })) as Doc | null;
    res.json({ name: target?.name, email: target?.email, role: target?.role });
  }),
);

adminRouter.post(
  "/auth/invite/:token/accept",
  handler(async (req, res) => {
    const invite = await findValidInvite(req.params.token);
    if (!invite) throw httpError(400, "This invitation is no longer valid");
    const body = parseBody(AcceptInviteIn, req.body);
    if (body.password.length < 8) throw httpError(400, "Password must be at least 8 characters");
    checkPasswordStrength(body.password);
    await col("users").updateOne(
      { id: invite.user_id },
      {
        $set: {
          password_hash: hashPassword(body.password),
          is_active: true,
          status: "ACTIVE",
          activated_at: nowIso(),
        },
      },
    );
    await col("accountant_profiles").updateOne(
      { user_id: invite.user_id },
      { $set: { is_active: true } },
    );
    await consumeInvite(invite.id as string);
    const target = (await col("users").findOne({ id: invite.user_id })) as Doc | null;
    await logActivity(null, "Staff account activated via invitation", target, {
      target_user_id: invite.user_id,
    });
    res.json({ ok: true });
  }),
);

adminRouter.get(
  "/services",
  auth(),
  handler(async (_req, res) => {
    res.json(cleanMany((await col("services").find({}).limit(50).toArray()) as Doc[]));
  }),
);

adminRouter.get(
  "/workflow/settings",
  auth(...STAFF_ADMIN),
  handler(async (_req, res) => {
    const meta: Doc = {};
    for (const [k, v] of Object.entries(STATUS_META)) {
      meta[k] = { stage: v[0], next_action: v[1], owner: v[2] };
    }
    res.json({ statuses: STATUSES, meta });
  }),
);

// ---------------------------------------------------------------- audit log
adminRouter.get(
  "/audit-log",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const query: Doc = {};
    const userName = str(req, "user_name");
    const action = str(req, "action");
    const dateFrom = str(req, "date_from");
    const dateTo = str(req, "date_to");
    const caseRef = str(req, "case_ref");
    const limit = intQuery(req, "limit", 100);
    const skip = intQuery(req, "skip", 0);
    if (userName) query.user_name = { $regex: userName, $options: "i" };
    if (action) query.action = { $regex: action, $options: "i" };
    if (dateFrom || dateTo) {
      const range: Doc = {};
      if (dateFrom) range.$gte = dateFrom;
      if (dateTo) range.$lte = `${dateTo}T23:59:59`;
      query.created_at = range;
    }
    // Audit and payment lists page through the data instead of loading everything.
    const logs = cleanMany(
      (await col("activity_logs")
        .find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit + 200)
        .toArray()) as Doc[],
    );
    const caseIds = [...new Set(logs.filter((l) => l.case_id).map((l) => l.case_id as string))];
    const cases = new Map<string, Doc>();
    for (const c of (await col("cases")
      .find(
        { id: { $in: caseIds } },
        { projection: { id: 1, case_ref: 1, client_name: 1, is_test: 1 } },
      )
      .toArray()) as Doc[]) {
      cases.set(c.id as string, c);
    }
    const includeTest = boolQuery(req, "include_test");
    const out: Doc[] = [];
    for (const l of logs) {
      const kase = l.case_id ? cases.get(l.case_id as string) : undefined;
      // Test-case activity, including activity whose test case has already been cleaned.
      if (!includeTest && l.case_id && (!kase || kase.is_test)) continue;
      l.case_ref = kase ? kase.case_ref : null;
      l.client_name = kase ? kase.client_name : null;
      if (caseRef && String(l.case_ref ?? "").toLowerCase() !== caseRef.trim().toLowerCase()) {
        continue;
      }
      out.push(l);
    }
    res.json(out.slice(0, limit));
  }),
);

// ---------------------------------------------------------------- overview
adminRouter.get(
  "/overview",
  auth("SUPER_ADMIN"),
  handler(async (_req, res) => {
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0),
    ).toISOString();
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0)).toISOString();
    const active = { $nin: ["SUBMITTED", "COMPLETED"] };
    // Reporting uses the same genuine-record rule as the operational Admin/accountant views.
    const clients = (await col("clients")
      .find(OPERATIONAL_ONLY, { projection: { id: 1, user_id: 1 } })
      .toArray()) as Doc[];
    const genuineClients = new Set(clients.map((c) => c.id as string));
    const genuineClientUsers = clients.map((c) => c.user_id as string);

    const activeOf = async (serviceType: string): Promise<Set<string>> => {
      const rows = (await col("client_services")
        .find({ service_type: serviceType, status: "ACTIVE" })
        .toArray()) as Doc[];
      return new Set(
        rows
          .map((r) => r.client_id as string)
          .filter((id) => genuineClients.has(id)),
      );
    };
    const saActive = await activeOf("SELF_ASSESSMENT");
    const mtdActive = await activeOf("MTD_INCOME_TAX");

    const paid = (await col("payment_transactions")
      .find(
        { payment_status: "paid", user_id: { $in: genuineClientUsers } },
        { projection: { amount: 1, created_at: 1, service_type: 1, kind: 1 } },
      )
      .toArray()) as Doc[];
    const total = (rows: Doc[]): number =>
      Math.round(rows.reduce((sum, r) => sum + (r.amount ?? 0), 0) * 100) / 100;

    const perAccountant: Doc[] = [];
    for (const a of (await col("users")
      .find({ role: "ACCOUNTANT", is_active: true, ...OPERATIONAL_ONLY })
      .toArray()) as Doc[]) {
      perAccountant.push({
        name: a.name,
        open_cases: await count({ assigned_accountant_id: a.id, status: active }),
        completed_cases: await count({ assigned_accountant_id: a.id, status: "COMPLETED" }),
      });
    }

    const failed = await col("payment_transactions").countDocuments({
      payment_status: { $in: ["failed", "expired"] },
      user_id: { $in: genuineClientUsers },
    });

    res.json({
      clients: {
        total: await col("clients").countDocuments(OPERATIONAL_ONLY),
        new_this_month: await col("clients").countDocuments({
          created_at: { $gte: monthStart },
          ...OPERATIONAL_ONLY,
        }),
        active_self_assessment: saActive.size,
        active_mtd: mtdActive.size,
        both_services: [...saActive].filter((id) => mtdActive.has(id)).length,
      },
      cases: {
        open: await count({ status: active }),
        completed: await count({ status: "COMPLETED" }),
        overdue: await count({ internal_deadline: { $lt: nowIso() }, status: active }),
        per_accountant: perAccountant,
      },
      revenue: {
        this_month: total(paid.filter((p) => String(p.created_at) >= monthStart)),
        this_year: total(paid.filter((p) => String(p.created_at) >= yearStart)),
        self_assessment: total(paid.filter((p) => p.service_type === "SELF_ASSESSMENT")),
        mtd: total(paid.filter((p) => p.service_type === "MTD_INCOME_TAX")),
        package_upgrades: total(paid.filter((p) => p.kind === "SA_UPGRADE")),
        successful_payments: paid.length,
        failed_payments: failed,
        note:
          "Revenue is summed from unique genuine successful payment transactions only. " +
          "Self Assessment and MTD are the service categories and add up to the total; " +
          "package upgrades are a subset of Self Assessment revenue, not additional " +
          "revenue. Automated-test transactions are excluded.",
      },
    });
  }),
);
