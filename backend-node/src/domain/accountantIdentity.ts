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
