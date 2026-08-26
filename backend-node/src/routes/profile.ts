/** Client profile and preferences, the Action Required feed, service issues and reopen history. */
import { randomUUID } from "crypto";

import { Request, Router } from "express";
import { z } from "zod";

import { clean, cleanMany, col, Doc } from "../db/mongo";
import { clientRecord, getCase, ownedCaseIds } from "../domain/cases";
import { OPERATIONAL_ONLY } from "../domain/testdata";
import { logActivity, notify, nowIso } from "../domain/workflow";
import { handler, httpError, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import { hashPassword, verifyPassword } from "../services/auth";
import { SERVICE_LABELS } from "../services/clientServices";
import { checkPasswordStrength } from "../services/security";

export const profileRouter = Router();

const ProfileIn = z.object({
  name: z.string().nullish().default(null),
  phone: z.string().nullish().default(null),
  address: z.string().nullish().default(null),
});
const EmailChangeIn = z.object({ new_email: z.string() });
const PasswordChangeIn = z.object({ current_password: z.string(), new_password: z.string() });
const PrefsIn = z.object({ preferences: z.record(z.unknown()) });
const DataRequestIn = z.object({ kind: z.string(), reason: z.string().nullish().default(null) });
const ServiceIssueIn = z.object({
  category: z.string(),
  subject: z.string(),
  description: z.string(),
  case_id: z.string().nullish().default(null),
});
const ServiceIssueUpdate = z.object({
  status: z.string(),
  resolution: z.string().nullish().default(null),
});

export const NOTIFICATION_PREF_KEYS = [
  "accountant_message",
  "document_requested",
  "calculation_ready",
  "approval_required",
  "submission_update",
  "payment_update",
];

const ISSUE_STATUSES = ["OPEN", "IN_REVIEW", "RESOLVED"];

function str(req: Request, name: string): string | undefined {
  const v = req.query[name];
  return typeof v === "string" && v.length ? v : undefined;
}

function boolQuery(req: Request, name: string): boolean {
  const v = req.query[name];
  return typeof v === "string" && ["true", "1", "yes", "on"].includes(v.toLowerCase());
}

function maskUtr(utr: string | null | undefined): string | null {
  if (!utr) return null;
  const value = String(utr);
  return `${"*".repeat(Math.max(value.length - 4, 0))}${value.slice(-4)}`;
}

async function profilePayload(me: Doc): Promise<Doc> {
  const client = await clientRecord(me);
  const prefs = ((await col("notification_preferences").findOne({ user_id: me.id })) ??
    {}) as Doc;
  const pendingEmail = (await col("email_change_requests").findOne({
    user_id: me.id,
    status: "PENDING",
  })) as Doc | null;
  const stored: Doc = prefs.preferences ?? {};
  const preferences: Doc = {};
  for (const k of NOTIFICATION_PREF_KEYS) preferences[k] = stored[k] ?? true;
  return {
    name: me.name,
    email: me.email,
    phone: client?.phone ?? null,
    address: client?.address ?? null,
    client_ref: client?.client_ref ?? null,
    // UTR is masked by default and is never casually editable by the client.
    utr_masked: maskUtr(client?.utr),
    utr_on_record: Boolean(client?.utr),
    pending_email_change: pendingEmail ? pendingEmail.new_email : null,
    preferences,
  };
}

profileRouter.get(
  "/my-profile",
  auth("CLIENT"),
  handler(async (req, res) => {
    res.json(await profilePayload(authed(req)));
  }),
);

profileRouter.get(
  "/my-profile/utr",
  auth("CLIENT"),
  handler(async (req, res) => {
    const client = await clientRecord(authed(req));
    res.json({ utr: client?.utr ?? null });
  }),
);

profileRouter.patch(
  "/my-profile",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(ProfileIn, req.body);
    if (body.name) await col("users").updateOne({ id: me.id }, { $set: { name: body.name } });
    const updates: Doc = {};
    if (body.phone !== null && body.phone !== undefined) updates.phone = body.phone;
    if (body.address !== null && body.address !== undefined) updates.address = body.address;
    if (body.name) updates.name = body.name;
    if (Object.keys(updates).length) {
      await col("clients").updateOne({ user_id: me.id }, { $set: updates });
    }
    if (body.name) {
      // The client's name is denormalised onto their cases for staff views -- keep every copy
      // in step so one client always resolves to the same identity everywhere.
      await col("cases").updateMany(
        { client_user_id: me.id },
        { $set: { client_name: body.name } },
      );
    }
    if (Object.keys(updates).length) {
      // Audit who changed which personal details and when -- values themselves are not logged.
      await col("activity_logs").insertOne({
        id: randomUUID(),
        case_id: null,
        action: "Personal details updated",
        user_id: me.id,
        user_name: body.name || me.name,
        role: me.role,
        meta: { fields: Object.keys(updates).sort() },
        created_at: nowIso(),
      });
    }
    const fresh = ((await col("users").findOne({ id: me.id })) ?? me) as Doc;
    res.json(await profilePayload(fresh));
  }),
);

/** Email changes are verified, never applied straight away. */
profileRouter.post(
  "/my-profile/email-change",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(EmailChangeIn, req.body);
    const newEmail = body.new_email.trim().toLowerCase();
    if (!newEmail.includes("@")) throw httpError(400, "Enter a valid email address");
    if (await col("users").findOne({ email: newEmail })) {
      throw httpError(400, "That email address is already in use");
    }
    const existing = (await col("email_change_requests").findOne({
      user_id: me.id,
      status: "PENDING",
    })) as Doc | null;
    if (existing) {
      await col("email_change_requests").updateOne(
        { id: existing.id },
        { $set: { new_email: newEmail, created_at: nowIso() } },
      );
      res.json({ ok: true, status: "PENDING", duplicate_prevented: true });
      return;
    }
    await col("email_change_requests").insertOne({
      id: randomUUID(),
      user_id: me.id,
      current_email: me.email,
      new_email: newEmail,
      status: "PENDING",
      created_at: nowIso(),
    });
    for (const admin of (await col("users")
      .find({ role: { $in: ["ADMIN", "SUPER_ADMIN"] } })
      .toArray()) as Doc[]) {
      await notify(
        admin.id as string,
        "Email change verification requested",
        `${me.name} asked to change their sign-in email.`,
        null,
        "/admin",
        "SECURITY",
      );
    }
    res.json({ ok: true, status: "PENDING" });
  }),
);

profileRouter.post(
  "/my-profile/change-password",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(PasswordChangeIn, req.body);
    const full = (await col("users").findOne({ id: me.id })) as Doc | null;
    if (!full || !verifyPassword(body.current_password, full.password_hash)) {
      throw httpError(400, "Your current password is not correct");
    }
    if (body.new_password.length < 8) {
      throw httpError(400, "Choose a password of at least 8 characters");
    }
    checkPasswordStrength(body.new_password, me.email ?? "", me.name ?? "");
    await col("users").updateOne(
      { id: me.id },
      { $set: { password_hash: hashPassword(body.new_password) } },
    );
    // A password change ends every other session, so a stolen session cannot survive it.
    await col("refresh_tokens").updateMany(
      { user_id: me.id, revoked_at: null },
      { $set: { revoked_at: new Date() } },
    );
    await col("activity_logs").insertOne({
      id: randomUUID(),
      case_id: null,
      action: "Password changed",
      user_id: me.id,
      user_name: me.name,
      role: me.role,
      meta: {},
      created_at: nowIso(),
    });
    res.json({ ok: true });
  }),
);

profileRouter.patch(
  "/my-preferences",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(PrefsIn, req.body);
    const prefs: Doc = {};
    for (const k of NOTIFICATION_PREF_KEYS) prefs[k] = Boolean(body.preferences[k] ?? true);
    await col("notification_preferences").updateOne(
      { user_id: me.id },
      { $set: { user_id: me.id, preferences: prefs } },
      { upsert: true },
    );
    res.json({ preferences: prefs });
  }),
);

/**
 * Data export / account closure requests are controlled. Closure never destroys records that
 * must be retained for tax and accounting purposes.
 */
profileRouter.post(
  "/my-data-requests",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(DataRequestIn, req.body);
    if (!["DATA_EXPORT", "ACCOUNT_CLOSURE"].includes(body.kind)) {
      throw httpError(400, "Unknown request type");
    }
    const existing = await col("data_requests").findOne({
      user_id: me.id,
      kind: body.kind,
      status: "PENDING",
    });
    if (existing) {
      res.json({ ok: true, status: "PENDING", duplicate_prevented: true });
      return;
    }
    await col("data_requests").insertOne({
      id: randomUUID(),
      user_id: me.id,
      user_name: me.name,
      kind: body.kind,
      reason: body.reason ?? null,
      status: "PENDING",
      created_at: nowIso(),
    });
    for (const admin of (await col("users")
      .find({ role: { $in: ["ADMIN", "SUPER_ADMIN"] } })
      .toArray()) as Doc[]) {
      await notify(
        admin.id as string,
        "Client data request",
        `${me.name} submitted a ${body.kind.replace("_", " ").toLowerCase()} request.`,
        null,
        "/admin",
        "REQUEST",
      );
    }
    res.json({ ok: true, status: "PENDING" });
  }),
);

profileRouter.get(
  "/my-data-requests",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const rows = (await col("data_requests")
      .find({ user_id: me.id })
      .sort({ created_at: -1 })
      .limit(20)
      .toArray()) as Doc[];
    res.json(cleanMany(rows));
  }),
);

/** Single Action Required feed for the client across every service. */
profileRouter.get(
  "/my-actions",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const outstanding: Doc[] = [];
    const history: Doc[] = [];
    const owned = await ownedCaseIds(me);
    const seenHistory = new Set<string>();

    const tasks = (await col("tasks")
      .find({ owner_id: me.id, case_id: { $in: owned } })
      .sort({ created_at: -1 })
      .toArray()) as Doc[];
    for (const t of tasks) {
      const kase = (await col("cases").findOne({ id: t.case_id })) as Doc | null;
      const item: Doc = {
        id: t.id,
        type: "TASK",
        action: t.name,
        description: t.description ?? null,
        service_type: kase ? kase.service_type : null,
        service_name: kase ? (SERVICE_LABELS[kase.service_type as string] ?? null) : null,
        case_id: t.case_id,
        case_ref: t.case_ref ?? null,
        due_date: t.due_date ?? null,
        status: t.status,
        mtd_period_label: t.mtd_period_label ?? null,
        link: t.mtd_period_id ? "/mtd" : "/tasks",
        completed_date: t.completed_date ?? null,
        created_at: t.created_at,
      };
      if (t.status === "COMPLETED") {
        // One completed request must produce exactly one completed-history entry.
        const key = `${t.name}|${t.case_id}|${String(t.completed_date ?? "").slice(0, 10)}`;
        if (seenHistory.has(key)) continue;
        seenHistory.add(key);
        history.push(item);
      } else {
        outstanding.push(item);
      }
    }

    const approvals = (await col("cases")
      .find({
        client_user_id: me.id,
        id: { $in: owned },
        status: { $in: ["ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL"] },
      })
      .toArray()) as Doc[];
    for (const c of approvals) {
      outstanding.push({
        id: `approve-${c.id}`,
        type: "APPROVAL",
        action: "Review and approve your tax return",
        description:
          "Your return has been approved internally and is ready for your approval.",
        service_type: c.service_type,
        service_name: SERVICE_LABELS[c.service_type as string] ?? null,
        case_id: c.id,
        case_ref: c.case_ref,
        due_date: c.external_deadline ?? null,
        status: "OPEN",
        link: "/my-return",
        created_at: c.last_updated,
      });
    }

    const offers = (await col("offers")
      .find({ client_user_id: me.id, status: "PENDING" })
      .toArray()) as Doc[];
    for (const o of offers) {
      outstanding.push({
        id: o.id,
        type: "RECOMMENDATION",
        action: `Review recommended service: ${o.service_name}`,
        description:
          "Your accountant recommended this and our team has approved it for review.",
        service_type: o.service_type,
        service_name: o.service_name ?? null,
        // A recommendation is account-level, not tied to a case.
        case_id: null,
        recommendation_id: o.recommendation_id ?? null,
        case_ref: null,
        due_date: null,
        status: "OPEN",
        link: `/recommendation/${o.id}`,
        created_at: o.created_at,
      });
    }

    res.json({ outstanding, history });
  }),
);

// ------------------------------------------------- service issues / complaints
/** An accountant may see that an issue exists on their case, never manage it. */
function issueForAccountant(row: Doc): Doc {
  const out: Doc = {};
  for (const k of ["id", "case_id", "case_ref", "category", "status", "created_at", "resolved_at"]) {
    if (k in row) out[k] = row[k];
  }
  return out;
}

profileRouter.post(
  "/service-issues",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(ServiceIssueIn, req.body);
    if (!body.subject.trim() || !body.description.trim()) {
      throw httpError(400, "A subject and description are required");
    }
    const kase = body.case_id ? await getCase(body.case_id, me) : null;
    const row: Doc = {
      id: randomUUID(),
      client_user_id: me.id,
      client_name: me.name,
      case_id: body.case_id ?? null,
      case_ref: kase ? kase.case_ref : null,
      service_type: kase ? kase.service_type : null,
      category: body.category,
      subject: body.subject.trim(),
      description: body.description.trim(),
      status: "OPEN",
      resolution: null,
      resolved_at: null,
      resolved_by_name: null,
      handled_by_name: null,
      is_test: Boolean(me.is_test),
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await col("service_issues").insertOne({ ...row });
    // Complaints are recorded alongside the case history but never change its workflow.
    await logActivity(body.case_id ?? null, `Service issue raised by client: ${row.subject}`, me, {
      service_issue_id: row.id,
      category: body.category,
    });
    for (const admin of (await col("users")
      .find({ role: { $in: ["ADMIN", "SUPER_ADMIN"] }, is_active: true })
      .toArray()) as Doc[]) {
      await notify(
        admin.id as string,
        "Service issue raised",
        `${me.name}: ${row.subject}`,
        body.case_id ?? null,
        "/admin/service-issues",
        "CHANGES",
      );
    }
    res.json(clean(row));
  }),
);

profileRouter.get(
  "/service-issues",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const query: Doc = {};
    const status = str(req, "status");
    const caseId = str(req, "case_id");
    if (status) query.status = status;
    if (caseId) query.case_id = caseId;
    if (me.role === "CLIENT") {
      query.client_user_id = me.id;
    } else if (me.role === "ACCOUNTANT") {
      const ids = (
        (await col("cases")
          .find({ assigned_accountant_id: me.id }, { projection: { id: 1 } })
          .toArray()) as Doc[]
      ).map((c) => c.id as string);
      query.case_id = caseId ?? { $in: ids };
      if (caseId && !ids.includes(caseId)) throw httpError(403, "Not allowed");
    } else if (!boolQuery(req, "include_test")) {
      Object.assign(query, OPERATIONAL_ONLY);
    }
    const rows = cleanMany(
      (await col("service_issues")
        .find(query)
        .sort({ created_at: -1 })
        .limit(300)
        .toArray()) as Doc[],
    );
    res.json(me.role === "ACCOUNTANT" ? rows.map(issueForAccountant) : rows);
  }),
);

profileRouter.patch(
  "/service-issues/:issueId",
  auth("ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(ServiceIssueUpdate, req.body);
    const row = (await col("service_issues").findOne({ id: req.params.issueId })) as Doc | null;
    if (!row) throw httpError(404, "Service issue not found");
    if (!ISSUE_STATUSES.includes(body.status)) throw httpError(400, "Invalid status");
    if (body.status === "RESOLVED" && !(body.resolution ?? "").trim()) {
      throw httpError(400, "A resolution message for the client is required");
    }
    const updates: Doc = {
      status: body.status,
      updated_at: nowIso(),
      handled_by_name: me.name,
    };
    if (body.resolution !== null && body.resolution !== undefined) {
      updates.resolution = body.resolution.trim() || null;
    }
    if (body.status === "RESOLVED") {
      updates.resolved_at = nowIso();
      updates.resolved_by_name = me.name;
    }
    await col("service_issues").updateOne({ id: req.params.issueId }, { $set: updates });
    await logActivity(
      row.case_id ?? null,
      `Service issue '${row.subject}' set to ${body.status}`,
      me,
      { service_issue_id: req.params.issueId },
      { comments: body.resolution ?? null },
    );
    await notify(
      row.client_user_id as string,
      body.status !== "RESOLVED"
        ? "Update on your service issue"
        : "Your service issue has been resolved",
      row.subject as string,
      row.case_id ?? null,
      "/service-issues",
      "INFO",
    );
    res.json(clean({ ...row, ...updates }));
  }),
);

/** Derived from the existing activity log — no second source of truth is stored. */
profileRouter.get(
  "/cases/:caseId/reopen-history",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    await getCase(req.params.caseId, me);
    const logs = (await col("activity_logs")
      .find({ case_id: req.params.caseId })
      .sort({ created_at: 1 })
      .limit(500)
      .toArray()) as Doc[];
    const completedAt = logs
      .filter((l) => l.new_status === "COMPLETED")
      .map((l) => l.created_at as string);
    const out: Doc[] = [];
    for (const l of logs) {
      if (l.previous_status === "COMPLETED" && l.new_status !== "COMPLETED") {
        const before = completedAt.filter((c) => c <= (l.created_at as string));
        const after = completedAt.filter((c) => c > (l.created_at as string));
        out.push({
          reopened_by: l.user_name ?? null,
          reopened_by_role: l.role ?? null,
          reopened_at: l.created_at,
          reason: l.comments ?? null,
          action: l.action ?? null,
          new_status: l.new_status ?? null,
          previous_completed_at: before.length ? before[before.length - 1] : null,
          recompleted_at: after.length ? after[0] : null,
        });
      }
    }
    res.json(out);
  }),
);
