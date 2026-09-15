/**
 * Ownership helpers for K.3 — derived only from GET my-services ACTIVE rows (baseline D7).
 * Never invent ACTIVE; never treat isSubscriptionBuy as source of truth.
 */
import { Doc } from "../db/mongo";
import { MTD, SELF_ASSESSMENT, clientOf, servicesFor } from "../domain/packages";

export type OwnershipState = "neither" | "sa" | "mtd" | "both";

export interface OwnershipSnapshot {
  hasActiveSa: boolean;
  hasActiveMtd: boolean;
  hasActiveService: boolean;
  ownership: OwnershipState;
  services: Doc[];
}

export function ownershipFromServices(services: Doc[]): OwnershipSnapshot {
  const hasActiveSa = services.some(
    (s) => s.service_type === SELF_ASSESSMENT && s.status === "ACTIVE",
  );
  const hasActiveMtd = services.some((s) => s.service_type === MTD && s.status === "ACTIVE");
  let ownership: OwnershipState = "neither";
  if (hasActiveSa && hasActiveMtd) ownership = "both";
  else if (hasActiveSa) ownership = "sa";
  else if (hasActiveMtd) ownership = "mtd";
  return {
    hasActiveSa,
    hasActiveMtd,
    hasActiveService: hasActiveSa || hasActiveMtd,
    ownership,
    services,
  };
}

/** Load ownership for a CLIENT user via existing domain servicesFor (no parallel entitlement logic). */
export async function ownershipForUser(user: Doc): Promise<OwnershipSnapshot> {
  if (user.role !== "CLIENT") {
    return {
      hasActiveSa: false,
      hasActiveMtd: false,
      hasActiveService: false,
      ownership: "neither",
      services: [],
    };
  }
  const client = await clientOf(user);
  const services = await servicesFor(client);
  return ownershipFromServices(services);
}

/** Map ACTIVE service rows into Toxel-ish subscription list items (ACTIVE only). */
export function activeSubscriptionsFromServices(services: Doc[]): Doc[] {
  return services
    .filter((s) => s.status === "ACTIVE")
    .map((s) => ({
      id: s.id,
      status: "active",
      serviceType: s.service_type,
      packageCode: s.package_code,
      startDate: s.activated_at ?? s.subscription_started_at ?? null,
      plan: {
        id: s.package_code,
        code: s.package_code,
        name: s.package_name ?? s.package_code,
        price: s.agreed_price ?? s.package_price ?? null,
        interval: s.billing_frequency ?? null,
      },
      currency: "gbp",
    }));
}

export function categoryToServiceType(category: string | null | undefined): string | null {
  const c = (category ?? "").trim().toLowerCase();
  if (!c) return null;
  if (c === "taxsimba" || c === "self_assessment" || c === "sa") return SELF_ASSESSMENT;
  if (c === "mtd" || c === "mtd_income_tax") return MTD;
  return null;
}
