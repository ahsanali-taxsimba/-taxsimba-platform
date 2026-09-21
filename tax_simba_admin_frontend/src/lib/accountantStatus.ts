/**
 * Shared accountant active/inactive resolver for Manage Accountants
 * table and Accountant Details modal (TS-UAT-029).
 *
 * Supports isActive / is_active booleans and canonical status strings.
 * Does not invent a parallel numeric status==1 SoT.
 */
export type AccountantStatus = "active" | "inactive";

export function isAccountantActive(order: {
  isActive?: boolean;
  is_active?: boolean;
  status?: string | number | boolean | null;
} | null | undefined): boolean {
  if (!order) return false;

  if (typeof order.isActive === "boolean") return order.isActive;
  if (typeof order.is_active === "boolean") return order.is_active;

  if (typeof order.status === "boolean") return order.status;

  const s = String(order.status ?? "").toLowerCase().trim();
  if (s === "active" || s === "1" || s === "true") return true;
  if (
    s === "inactive" ||
    s === "0" ||
    s === "false" ||
    s === "pending" ||
    s === "disabled"
  ) {
    return false;
  }

  // Unknown / missing → inactive (safe default; never treat as Active).
  return false;
}

export function accountantStatusLabel(order: Parameters<typeof isAccountantActive>[0]): string {
  return isAccountantActive(order) ? "Active" : "Inactive";
}

export function accountantStatusToken(
  order: Parameters<typeof isAccountantActive>[0],
): AccountantStatus {
  return isAccountantActive(order) ? "active" : "inactive";
}
