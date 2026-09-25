/**
 * Canonical accountant identity — always the users.id UUID string.
 * Assignment storage, JWT subject, notifications and "assigned to me" filters
 * must all use this same identifier. Never Number()-coerce.
 */
import { col, Doc } from "../db/mongo";
import { httpError } from "../http/errors";

export type ResolvedAccountant = {
  userId: string;
  name: string;
  email: string;
  isActive: boolean;
};

/**
 * Resolve an ACTIVE accountant by users.id (canonical).
 * Rejects profile ids that are not user ids, inactive accountants, and non-accountants.
 */
export async function resolveActiveAccountantUserId(
  rawId: unknown,
): Promise<ResolvedAccountant> {
  const id = typeof rawId === "string" ? rawId.trim() : "";
  if (!id || id === "NaN" || id === "undefined" || id === "null") {
    throw httpError(400, "accountantId is required");
  }
  if (typeof rawId === "number") {
    throw httpError(400, "accountantId must be a string UUID");
  }

  const user = (await col("users").findOne({
    id,
    role: "ACCOUNTANT",
  })) as Doc | null;

  if (!user) {
    // Do not accept accountant_profiles.id as a substitute — that would store
    // a non-JWT identity on the case and break "assigned to me".
    const profile = (await col("accountant_profiles").findOne({ id })) as Doc | null;
    if (profile?.user_id) {
      throw httpError(
        400,
        "accountantId must be the accountant user id, not a profile id",
      );
    }
    throw httpError(404, "Accountant not found");
  }

  if (user.is_active === false) {
    throw httpError(400, "Cannot assign an inactive accountant");
  }

  return {
    userId: String(user.id),
    name: String(user.name ?? "Accountant"),
    email: String(user.email ?? ""),
    isActive: true,
  };
}

/** Strict equality for assigned_accountant_id vs JWT subject — no OR / loose match. */
export function isAssignedToAccountant(kase: Doc, accountantUserId: string): boolean {
  return String(kase.assigned_accountant_id ?? "") === String(accountantUserId);
}

/** Shown when SUPER_ADMIN tries to deactivate/remove an accountant who still owns open cases. */
export const ACCOUNTANT_ACTIVE_CASES_BLOCK_MESSAGE =
  "This accountant has active cases. An Admin must reassign them before deactivation.";

export type ActiveCasesNeedingReassignment = {
  count: number;
  caseIds: string[];
};

/**
 * Open (non-completed) operational cases still assigned to this accountant user id.
 * Used to block SUPER_ADMIN deactivate/remove until ADMIN reassigns every active case.
 */
export async function listActiveCasesForAccountant(
  accountantUserId: string,
): Promise<ActiveCasesNeedingReassignment> {
  const { OPERATIONAL_ONLY } = await import("./testdata");
  const rows = (await col("cases")
    .find({
      assigned_accountant_id: accountantUserId,
      status: { $nin: ["COMPLETED", "SUBMITTED"] },
      ...OPERATIONAL_ONLY,
    })
    .project({ id: 1 })
    .toArray()) as Doc[];
  const caseIds = rows.map((r) => String(r.id));
  return { count: caseIds.length, caseIds };
}

/**
 * Throw HTTP 409 with active case IDs/count when deactivation/removal would leave
 * open cases on an inactive accountant. Makes no database changes.
 */
export async function assertNoActiveCasesBeforeDeactivate(
  accountantUserId: string,
): Promise<void> {
  const active = await listActiveCasesForAccountant(accountantUserId);
  if (active.count <= 0) return;
  throw httpError(409, {
    msg: ACCOUNTANT_ACTIVE_CASES_BLOCK_MESSAGE,
    activeCasesNeedingReassignment: active,
  });
}
