/**
 * Admin / accountant / SUPER_ADMIN compat adapters (P0 K.7 / baseline S1–S5, X4).
 * Thin maps onto native users, invites, stats, payments, FAQs, cases.
 * Never unmask contacts for ADMIN/ACCOUNTANT. No HMRC. No CMS (S6 HIDE).
 */
import { Router } from "express";
import { z } from "zod";

import { clean, cleanMany, col, Doc, scrubMany } from "../db/mongo";
import { FAQ_CATEGORIES } from "../domain/helpcentre";
import { SELF_ASSESSMENT, servicesFor } from "../domain/packages";
import {
  intentFromClient,
  resolveClientServiceState,
  serviceStateLabel,
  type ClientServiceState,
  type OnboardingIntent,
} from "../domain/onboardingIntent";
import { OPERATIONAL_ONLY, TEST_EMAIL_REGEX } from "../domain/testdata";
import { nowIso } from "../domain/workflow";
import { currentMtdObligation } from "../domain/obligation";
import { isAssignedToAccountant } from "../domain/accountantIdentity";
import { handler, httpError, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import { issueInvite } from "../services/invites";
import { emailInvitation } from "../services/email";
import { env } from "../config/env";
import { keysToCamel, keysToSnake } from "./caseMap";
import { sendCompatSuccess } from "./envelope";
import { withTaxReturnId } from "./ids";
import { activeSubscriptionsFromServices } from "./ownership";
import { maskContactsForViewer } from "./privacy";

export const compatAdminRouter = Router();

const STAFF_ADMIN = ["ADMIN", "SUPER_ADMIN"] as const;

/** Map Node case status → Toxel manage-tax / assignment list keys. */
function nodeToToxelListStatus(status: string): string {
  switch (String(status || "").toUpperCase()) {
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
      return String(status || "pending_assignment").toLowerCase();
  }
}

/**
 * Stable assignment DTO for admin Manage Tax + accountant "Assigned to Me".
 * IDs remain string UUIDs end-to-end.
 */
async function toAssignmentDto(kase: Doc): Promise<Doc> {
  const serviceType = String(kase.service_type ?? "SELF_ASSESSMENT");
  const isMtd = serviceType === "MTD_INCOME_TAX" || serviceType === "MTD";
  const nameParts = String(kase.client_name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const obligation = await currentMtdObligation(kase);
  const packageCode = kase.package_code ?? null;
  let packageName = packageCode;
  if (packageCode) {
    const pkg = (await col("packages").findOne({
      service_type: serviceType,
      code: packageCode,
    })) as Doc | null;
    if (pkg?.name) packageName = pkg.name;
  }
  const toxelStatus = nodeToToxelListStatus(String(kase.status));
  return withTaxReturnId({
    id: String(kase.id),
    taxReturnId: kase.case_ref ?? kase.id,
    caseId: kase.id,
    taxYear: kase.tax_year ?? null,
    status: toxelStatus,
    workflowStatus: kase.status,
    priority: String(kase.priority ?? "MEDIUM").toLowerCase(),
    assignedAt: kase.assigned_at ?? null,
    createdAt: kase.created_at ?? null,
    submittedAt: kase.application_submitted_at ?? kase.created_at ?? null,
    mtdQuarter: obligation.quarterLabel,
    mtdQuarterDueDate: obligation.deadline,
    deadline: obligation.deadline ?? kase.internal_deadline ?? kase.external_deadline ?? null,
    daysToDeadline: obligation.daysToDeadline,
    deadlineWarning: obligation.deadlineWarning,
    isOverdue: obligation.isOverdue,
    hasObligation: obligation.hasObligation,
    serviceType,
    package: packageName,
    packageCode,
    assignedAccountantId: kase.assigned_accountant_id ?? null,
    assignedAccountantName: kase.assigned_accountant_name ?? null,
    client: {
      id: String(kase.client_user_id ?? kase.client_id ?? ""),
      name: nameParts[0] || "Client",
      surname: nameParts.slice(1).join(" "),
      email: null,
      userRole: isMtd ? "MTD" : "SA",
    },
    TaxReturnType: {
      typeName: isMtd ? "Making Tax Digital" : "Self Assessment",
      typeCode: isMtd ? "MTD" : "SA",
    },
    type: {
      typeName: isMtd ? "Making Tax Digital" : "Self Assessment",
      typeCode: isMtd ? "MTD" : "SA",
    },
    accountant: kase.assigned_accountant_id
      ? {
          id: String(kase.assigned_accountant_id),
          name: kase.assigned_accountant_name ?? "Accountant",
        }
      : null,
    documents: [],
    // Preserve raw case fields for manage-tax mapper compatibility.
    client_name: kase.client_name,
    client_user_id: kase.client_user_id,
    client_id: kase.client_id,
    case_ref: kase.case_ref,
    service_type: serviceType,
    assigned_accountant_id: kase.assigned_accountant_id,
    assigned_accountant_name: kase.assigned_accountant_name,
  });
}

function searchNeedle(body: Record<string, unknown>): string {
  return String(body.search ?? body.q ?? body.email ?? "").trim().toLowerCase();
}

function inviteOrigin(req: { get: (h: string) => string | undefined }): string {
  return (req.get("origin") ?? (env("APP_BASE_URL") ?? "").replace(/\/$/, "")).replace(/\/$/, "");
}

/** Split "First Last..." into name + surname for Toxel FE columns. */
function splitPersonName(full: unknown): { name: string; surname: string } {
  const parts = String(full ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { name: "", surname: "" };
  if (parts.length === 1) return { name: parts[0], surname: "" };
  return { name: parts[0], surname: parts.slice(1).join(" ") };
}

function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Validate accountant create/update field payload (TS-UAT-031/034). */
function parseAccountantProfileFields(body: Record<string, unknown>, opts: { requireAll: boolean }) {
  const rawName = String(body.name ?? "").trim();
  const rawSurname = String(body.surname ?? body.last_name ?? body.lastName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? body.mobile ?? "").trim();
  const qualification = String(body.qualification ?? "").trim();
  const experienceRaw = String(body.experience ?? "").trim();

  if (opts.requireAll || rawName !== undefined) {
    if (opts.requireAll && !rawName) throw httpError(400, "First Name is required");
  }
  if (opts.requireAll) {
    if (!rawSurname) throw httpError(400, "Last Name is required");
  }
  if (opts.requireAll || email) {
    if (opts.requireAll && !email) throw httpError(400, "Email is required");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw httpError(400, "Please enter a valid email address");
    }
  }
  if (opts.requireAll) {
    if (!phone) throw httpError(400, "Phone is required");
  }
  if (phone) {
    if (!/^[\d\s+\-()]+$/.test(phone)) {
      throw httpError(
        400,
        "Phone can only contain digits, spaces, +, -, and parentheses",
      );
    }
    const digits = phoneDigits(phone);
    if (digits.length < 7 || digits.length > 15) {
      throw httpError(400, "Phone must contain 7–15 digits");
    }
    if (phone.length > 20) throw httpError(400, "Phone must be at most 20 characters");
  }
  if (qualification) {
    if (qualification.length < 2 || qualification.length > 120) {
      throw httpError(400, "Qualification must be between 2 and 120 characters");
    }
  }
  let experience: string | null = experienceRaw || null;
  if (experienceRaw) {
    const asNum = Number(experienceRaw);
    if (!Number.isFinite(asNum) || asNum < 0 || asNum > 60) {
      throw httpError(400, "Experience must be a number of years between 0 and 60");
    }
    experience = String(Math.round(asNum));
  }

  const displayName = rawSurname ? `${rawName} ${rawSurname}`.trim() : rawName;
  return {
    name: rawName,
    surname: rawSurname,
    displayName,
    email,
    phone: phone || null,
    qualification: qualification || null,
    experience,
  };
}

async function loadAccountantProfile(userId: string): Promise<Doc | null> {
  return (await col("accountant_profiles").findOne({ user_id: userId })) as Doc | null;
}

/** Canonical list/details DTO — one status SoT (isActive + status string). */
async function serializeAccountant(u: Doc): Promise<Doc> {
  const profile = await loadAccountantProfile(String(u.id));
  const { name, surname } = u.surname
    ? { name: String(u.name ?? ""), surname: String(u.surname ?? "") }
    : splitPersonName(u.name);
  // Single SoT: boolean is_active (status endpoint flips this). Do not use status==1.
  const active = u.is_active !== false;
  const phone = u.phone ?? null;
  const qualification = profile?.qualification ?? u.qualification ?? null;
  const experience = profile?.experience ?? u.experience ?? null;
  const onboardedAt = profile?.onboarded_at ?? profile?.created_at ?? u.created_at ?? null;
  return {
    id: u.id,
    name,
    surname,
    email: u.email,
    phone,
    mobile: phone,
    isActive: active,
    // Canonical string only — do not emit numeric status==1.
    status: active ? "active" : "inactive",
    role: u.role,
    createdAt: u.created_at,
    onboardedAt,
    qualification,
    experience,
    Accountant: {
      qualification,
      experience,
      onboardedAt,
      employeeId: profile?.employee_id ?? null,
      isAvailable: profile?.is_active !== false,
    },
  };
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
    const accountants = [];
    for (const u of masked) {
      accountants.push(await serializeAccountant(u));
    }
    sendCompatSuccess(res, { accountants }, "OK");
  }),
);

compatAdminRouter.post(
  "/admin/accountants/create",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = keysToSnake(req.body ?? {}) as Record<string, unknown>;
    // Accept camelCase mobile/qualification before snake conversion gaps.
    const merged: Record<string, unknown> = {
      ...body,
      ...(req.body as Record<string, unknown>),
    };
    const fields = parseAccountantProfileFields(merged, { requireAll: false });
    if (!fields.name || !fields.email) {
      throw httpError(400, "First Name and Email are required");
    }
    const role = String(merged.role ?? body.role ?? "ACCOUNTANT");
    if (!["ACCOUNTANT", "ADMIN"].includes(role)) {
      throw httpError(400, "Only ACCOUNTANT or ADMIN invites are supported here");
    }
    if (await col("users").findOne({ email: fields.email })) {
      throw httpError(400, "Email already exists");
    }
    const { randomUUID } = await import("crypto");
    const { logActivity } = await import("../domain/workflow");
    const created: Doc = {
      id: randomUUID(),
      email: fields.email,
      name: fields.displayName,
      surname: fields.surname,
      role,
      password_hash: null,
      phone: fields.phone,
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
            name: fields.displayName,
            email: fields.email,
            phone: fields.phone,
            qualification: fields.qualification,
            experience: fields.experience,
            onboarded_at: nowIso(),
            specialisms: Array.isArray(merged.specialisms)
              ? merged.specialisms
              : Array.isArray(body.specialisms)
                ? body.specialisms
                : ["SELF_ASSESSMENT"],
            capacity: typeof merged.capacity === "number" ? merged.capacity : 15,
            is_active: false,
          },
          $setOnInsert: { id: randomUUID(), user_id: created.id, created_at: nowIso() },
        },
        { upsert: true },
      );
    }
    const invite = await issueInvite(String(created.id), fields.email, String(me.id));
    await logActivity(null, `Staff invitation sent to ${fields.email}`, me, {
      target_user_id: created.id,
      role,
    });
    const link = `${inviteOrigin(req)}/invite/${invite.token}`;
    try {
      await emailInvitation({
        to: fields.email,
        name: fields.displayName,
        role,
        setupLink: link,
        expiresAt: invite.expires_at,
        inviteId: invite.id,
      });
    } catch {
      // Email optional in tests.
    }
    const dto = await serializeAccountant(created);
    sendCompatSuccess(
      res,
      {
        ...dto,
        ok: true,
        inviteId: invite.id,
        userId: created.id,
        inviteLink: link,
        expiresAt: invite.expires_at,
      },
      "Accountant added successfully.",
      201,
    );
  }),
);

compatAdminRouter.put(
  "/admin/accountants/update/:userId",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const body = keysToSnake(req.body ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = {
      ...body,
      ...(req.body as Record<string, unknown>),
    };
    const user = (await col("users").findOne({
      id: req.params.userId,
      role: { $in: ["ACCOUNTANT", "ADMIN"] },
    })) as Doc | null;
    if (!user) throw httpError(404, "Accountant not found");

    const fields = parseAccountantProfileFields(
      {
        name: merged.name ?? splitPersonName(user.name).name,
        surname: merged.surname ?? user.surname ?? splitPersonName(user.name).surname,
        email: merged.email ?? user.email,
        phone: merged.phone ?? merged.mobile ?? user.phone ?? "",
        qualification: merged.qualification ?? "",
        experience: merged.experience ?? "",
      },
      { requireAll: true },
    );

    const patch: Doc = {
      updated_at: nowIso(),
      name: fields.displayName,
      surname: fields.surname,
      phone: fields.phone,
    };
    await col("users").updateOne({ id: user.id }, { $set: patch });
    await col("accountant_profiles").updateOne(
      { user_id: user.id },
      {
        $set: {
          name: fields.displayName,
          phone: fields.phone,
          qualification: fields.qualification,
          experience: fields.experience,
          updated_at: nowIso(),
        },
        $setOnInsert: {
          id: (await import("crypto")).randomUUID(),
          user_id: user.id,
          email: user.email,
          created_at: nowIso(),
          onboarded_at: nowIso(),
          specialisms: ["SELF_ASSESSMENT"],
          capacity: 15,
          is_active: user.is_active !== false,
        },
      },
      { upsert: true },
    );
    const updated = (await col("users").findOne({ id: user.id })) as Doc;
    sendCompatSuccess(
      res,
      await serializeAccountant(updated),
      "Accountant details updated successfully.",
    );
  }),
);

compatAdminRouter.post(
  "/admin/accountants/:userId/status",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const status = String(body.status ?? "").toLowerCase();
    const active =
      status === "active" ||
      status === "true" ||
      status === "1" ||
      body.status === 1 ||
      body.isActive === true ||
      body.is_active === true;
    const inactive =
      status === "inactive" ||
      status === "false" ||
      status === "0" ||
      body.status === 0 ||
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
    sendCompatSuccess(
      res,
      { ok: true, id: user.id, isActive: active },
      "Accountant status updated successfully.",
    );
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
    const clientIds = masked.map((u) => u.id);
    const clientRows = cleanMany(
      (await col("clients")
        .find({ user_id: { $in: clientIds } })
        .limit(500)
        .toArray()) as Doc[],
    );
    const clientByUserId = new Map(clientRows.map((c) => [String(c.user_id), c]));

    const clientsOut = [];
    for (const u of masked) {
      const emailVerified = Boolean(u.email_verified_at);
      const isActive = u.is_active !== false;
      let lifecycle = "INACTIVE";
      if (isActive && emailVerified) lifecycle = "ACTIVE";
      else if (isActive && !emailVerified) lifecycle = "PENDING_VERIFICATION";

      let subscription: Doc | null = null;
      let subscriptions: Doc[] = [];
      let serviceState: ClientServiceState = "NO_ACTIVE_SERVICE";
      let onboardingIntent: OnboardingIntent | null = null;
      const clientDoc = clientByUserId.get(String(u.id));
      if (clientDoc) {
        onboardingIntent = intentFromClient(clientDoc);
        try {
          const services = await servicesFor(clientDoc);
          const subs = activeSubscriptionsFromServices(services);
          subscriptions = subs as Doc[];
          const hasActiveSa = subs.some((s) => s.serviceType === SELF_ASSESSMENT);
          const hasActiveMtd = subs.some((s) => s.serviceType === "MTD_INCOME_TAX");
          serviceState = resolveClientServiceState(
            onboardingIntent,
            hasActiveSa,
            hasActiveMtd,
          );
          // Prefer SA for legacy Plan column when both; otherwise first ACTIVE.
          const primary =
            subs.find((s) => s.serviceType === SELF_ASSESSMENT) || subs[0] || null;
          if (primary) subscription = primary as Doc;
        } catch {
          subscription = null;
          serviceState = resolveClientServiceState(onboardingIntent, false, false);
        }
      }

      clientsOut.push({
        id: u.id,
        name: u.name,
        username:
          u.username ??
          (u.email ? String(u.email).split("@")[0] : null) ??
          null,
        email: u.email,
        phone: u.phone ?? null,
        mobile: u.phone ?? null,
        location: u.location ?? u.address ?? null,
        address: u.address ?? null,
        contactMasked: Boolean(u.contact_masked),
        isActive,
        emailVerified,
        emailVerifiedAt: u.email_verified_at ?? null,
        // Canonical display lifecycle — distinct from SA/MTD entitlement.
        lifecycle,
        status:
          lifecycle === "ACTIVE"
            ? "active"
            : lifecycle === "PENDING_VERIFICATION"
              ? "pending_verification"
              : "inactive",
        role: u.role,
        // RBAC role remains CLIENT; service journey is separate.
        userRole: u.role,
        onboardingIntent,
        serviceState,
        serviceStateLabel: serviceStateLabel(serviceState),
        createdAt: u.created_at,
        // Purchased plan for Plan column / Client Details (ACTIVE entitlements only).
        subscription,
        subscriptions,
      });
    }

    sendCompatSuccess(
      res,
      {
        clients: clientsOut,
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
    // Authoritative scope matches Manage Tax (OPERATIONAL_ONLY cases).
    const totalTaxReturns = await count({});
    const totalCompletedTaxReturns = await count({ status: "COMPLETED" });
    const totalOngoingTaxReturns = await count({ status: active });
    const pendingAssignment = await count({
      $or: [
        { status: { $in: ["NEW", "ONBOARDING", "AWAITING_ASSIGNMENT"] } },
        { assigned_accountant_id: null, status: { $nin: ["COMPLETED", "SUBMITTED"] } },
      ],
    });
    const assignedActive = await count({
      assigned_accountant_id: { $ne: null },
      status: {
        $in: [
          "ASSIGNED",
          "ACCOUNTANT_REVIEW",
          "AWAITING_CLIENT",
          "IN_PREPARATION",
          "READY_FOR_ADMIN_REVIEW",
          "ADMIN_REVIEW",
          "CHANGES_REQUIRED",
          "ADMIN_APPROVED",
          "AWAITING_CLIENT_APPROVAL",
          "CLIENT_APPROVED",
          "READY_FOR_SUBMISSION",
          "SUBMISSION_IN_PROGRESS",
          "SUBMITTED",
          "SUBMISSION_ISSUE",
        ],
      },
    });
    sendCompatSuccess(
      res,
      {
        totalClients,
        totalAccountants,
        totalTaxReturns,
        totalCompletedTaxReturns,
        totalOngoingTaxReturns,
        pendingAssignment,
        assignedActive,
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
    const needle = String(body.search ?? "")
      .trim()
      .toLowerCase();
    const query: Doc = {};
    if (category) query.category = category;
    // Staff list includes inactive for management; hard-deleted rows are gone.
    let all = cleanMany(
      (await col("faqs").find(query).sort({ order: 1 }).limit(500).toArray()) as Doc[],
    );
    if (needle) {
      all = all.filter(
        (f) =>
          String(f.question ?? "")
            .toLowerCase()
            .includes(needle) ||
          String(f.answer ?? "")
            .toLowerCase()
            .includes(needle) ||
          (f.is_active === false ? "inactive" : "active").includes(needle),
      );
    }
    const total = all.length;
    const faqs = all.slice((page - 1) * limit, page * limit).map((f) => ({
      ...f,
      // FE historically reads `status` boolean; keep is_active + status alias.
      status: f.is_active !== false,
    }));
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
    sendCompatSuccess(
      res,
      keysToCamel({ ...doc, status: true }),
      "Created",
      201,
    );
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
    const statusRaw = body.status;
    const active =
      body.isActive === true ||
      body.is_active === true ||
      statusRaw === true ||
      String(statusRaw ?? "").toLowerCase() === "active" ||
      String(statusRaw ?? "").toLowerCase() === "true" ||
      statusRaw === 1 ||
      statusRaw === "1";
    const inactiveExplicit =
      body.isActive === false ||
      body.is_active === false ||
      statusRaw === false ||
      String(statusRaw ?? "").toLowerCase() === "inactive" ||
      String(statusRaw ?? "").toLowerCase() === "false" ||
      statusRaw === 0 ||
      statusRaw === "0";
    if (!active && !inactiveExplicit) {
      throw httpError(400, "status must be active or inactive");
    }
    const existing = (await col("faqs").findOne({ id: req.params.faqId })) as Doc | null;
    if (!existing) throw httpError(404, "FAQ not found");
    await col("faqs").updateOne(
      { id: existing.id },
      { $set: { is_active: active, updated_at: nowIso() } },
    );
    sendCompatSuccess(res, { ok: true, id: existing.id, isActive: active, status: active }, "OK");
  }),
);

compatAdminRouter.delete(
  "/admin/faqs/delete/:faqId",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const existing = (await col("faqs").findOne({ id: req.params.faqId })) as Doc | null;
    if (!existing) throw httpError(404, "FAQ not found");
    // Hard delete so admin list no longer shows the row (soft-delete looked like Inactive).
    await col("faqs").deleteOne({ id: existing.id });
    sendCompatSuccess(res, { ok: true, id: existing.id }, "Deleted");
  }),
);

// ---------------------------------------------------------------- C3 tax-return lists (admin/accountant)
async function listCasesForStaff(me: Doc, body: Record<string, unknown>): Promise<Doc[]> {
  const query: Doc = { ...OPERATIONAL_ONLY };
  // Strict JWT user id match — never OR with profile id (prevents cross-accountant leakage).
  if (me.role === "ACCOUNTANT") {
    query.assigned_accountant_id = String(me.id);
  }
  const serviceType = body.serviceType ?? body.service_type;
  if (typeof serviceType === "string" && serviceType) query.service_type = serviceType;
  const status = body.status;
  if (typeof status === "string" && status) query.status = { $in: status.split(",") };
  const cases = (await col("cases")
    .find(query)
    .sort({ last_updated: -1 })
    .limit(200)
    .toArray()) as Doc[];
  const scrubbed = scrubMany(cleanMany(cases), me);
  const dtos: Doc[] = [];
  for (const c of scrubbed) {
    // Defence in depth for accountant: skip any row that somehow doesn't match JWT.
    if (me.role === "ACCOUNTANT" && !isAssignedToAccountant(c, String(me.id))) continue;
    dtos.push(await toAssignmentDto(c));
  }
  return dtos;
}

compatAdminRouter.post(
  "/admin/tax-return/files",
  auth(...STAFF_ADMIN),
  handler(async (req, res) => {
    const me = authed(req);
    const files = await listCasesForStaff(me, (req.body ?? {}) as Record<string, unknown>);
    sendCompatSuccess(res, { files, taxReturns: files, assignments: files }, "OK");
  }),
);

compatAdminRouter.post(
  "/accountant/tax-return/files",
  auth("ACCOUNTANT"),
  handler(async (req, res) => {
    const me = authed(req);
    const files = await listCasesForStaff(me, (req.body ?? {}) as Record<string, unknown>);
    // `assignments` is the accountant FE SoT; files/taxReturns kept for parity.
    sendCompatSuccess(res, { files, taxReturns: files, assignments: files }, "OK");
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
