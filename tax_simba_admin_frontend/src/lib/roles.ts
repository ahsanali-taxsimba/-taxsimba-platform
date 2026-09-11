/** P0 K.7 — staff role helpers. SUPER_ADMIN is first-class (never collapsed to ADMIN). */

export function isAdminRole(role?: string | null): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isAccountantRole(role?: string | null): boolean {
  return role === "ACCOUNTANT";
}

export function isStaffRole(role?: string | null): boolean {
  return isAdminRole(role) || isAccountantRole(role);
}

export function isSuperAdminRole(role?: string | null): boolean {
  return role === "SUPER_ADMIN";
}
