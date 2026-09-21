/**
 * Shared client account lifecycle for Manage Clients table + details modal.
 *
 * Distinct from SA/MTD entitlement — derived from isActive + emailVerified.
 */
export type ClientLifecycle = "ACTIVE" | "INACTIVE" | "PENDING_VERIFICATION";

export function clientLifecycle(order: {
  lifecycle?: string;
  status?: string | number;
  isActive?: boolean;
  is_active?: boolean;
  emailVerified?: boolean;
  email_verified_at?: string | null;
} | null | undefined): ClientLifecycle {
  if (!order) return "INACTIVE";

  const explicit = String(order.lifecycle ?? "").toUpperCase();
  if (
    explicit === "ACTIVE" ||
    explicit === "INACTIVE" ||
    explicit === "PENDING_VERIFICATION"
  ) {
    return explicit as ClientLifecycle;
  }

  const status = String(order.status ?? "").toLowerCase();
  if (status === "pending_verification" || status === "pending") {
    return "PENDING_VERIFICATION";
  }
  if (status === "inactive" || status === "0") return "INACTIVE";
  if (status === "active" || status === "1") {
    if (order.emailVerified === false) return "PENDING_VERIFICATION";
    return "ACTIVE";
  }

  const isActive =
    typeof order.isActive === "boolean"
      ? order.isActive
      : typeof order.is_active === "boolean"
        ? order.is_active
        : order.status == 1;

  if (!isActive) return "INACTIVE";

  const emailVerified =
    typeof order.emailVerified === "boolean"
      ? order.emailVerified
      : Boolean(order.email_verified_at);

  if (!emailVerified) return "PENDING_VERIFICATION";
  return "ACTIVE";
}

export function lifecycleLabel(lifecycle: ClientLifecycle): string {
  switch (lifecycle) {
    case "PENDING_VERIFICATION":
      return "Pending verification";
    case "ACTIVE":
      return "Active";
    default:
      return "Inactive";
  }
}

/** Badge colour token used by admin Badge component. */
export function lifecycleBadgeColor(
  lifecycle: ClientLifecycle,
): "success" | "warning" | "error" {
  switch (lifecycle) {
    case "ACTIVE":
      return "success";
    case "PENDING_VERIFICATION":
      return "warning";
    default:
      return "error";
  }
}
