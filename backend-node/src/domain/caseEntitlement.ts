/**
 * Narrow case entitlement + open-case duplicate helpers (P0 K.5 / baseline D5, C2, C7, N4).
 *
 * Calls existing package/service domain — does not rewrite activation or workflow.
 */
import { col, Doc } from "../db/mongo";
import { httpError } from "../http/errors";
import { MTD, SELF_ASSESSMENT, clientOf, servicesFor } from "./packages";

export const ENTITLED_SERVICE_TYPES = [SELF_ASSESSMENT, MTD] as const;

/** Statuses that count as a closed service case for duplicate prevention. */
export const CLOSED_CASE_STATUSES = ["SUBMITTED", "COMPLETED"] as const;

export function isEntitledServiceType(serviceType: string): boolean {
  return (ENTITLED_SERVICE_TYPES as readonly string[]).includes(serviceType);
}

/** True when the CLIENT has an ACTIVE entitlement for the given service_type. */
export async function clientHasActiveService(
  user: Doc,
  serviceType: string,
): Promise<boolean> {
  if (user.role !== "CLIENT") return true;
  if (!isEntitledServiceType(serviceType)) return false;
  try {
    const client = await clientOf(user);
    const services = await servicesFor(client);
    return services.some((s) => s.service_type === serviceType && s.status === "ACTIVE");
  } catch {
    return false;
  }
}

/**
 * CLIENT must hold ACTIVE entitlement for the case's service_type.
 * Staff roles are not gated by client entitlement.
 */
export async function assertClientCanAccessService(
  user: Doc,
  serviceType: string,
): Promise<void> {
  if (user.role !== "CLIENT") return;
  if (!isEntitledServiceType(serviceType)) {
    throw httpError(403, "Unknown or unsupported service type for case access");
  }
  const ok = await clientHasActiveService(user, serviceType);
  if (!ok) {
    throw httpError(
      403,
      `An active ${serviceType} service is required to access or create this case`,
    );
  }
}

/** ACTIVE service_types the CLIENT may see/list. */
export async function activeServiceTypesForClient(user: Doc): Promise<string[]> {
  if (user.role !== "CLIENT") return [...ENTITLED_SERVICE_TYPES];
  try {
    const client = await clientOf(user);
    const services = await servicesFor(client);
    return services.filter((s) => s.status === "ACTIVE").map((s) => String(s.service_type));
  } catch {
    return [];
  }
}

/**
 * Find an open (non-closed) service case for client + service_type + tax_year.
 * Used for C7 duplicate prevention; does not invent cases.
 */
export async function findOpenServiceCase(opts: {
  clientUserId: string;
  clientId?: string | null;
  serviceType: string;
  taxYear: string;
}): Promise<Doc | null> {
  const owner: Doc = opts.clientId
    ? { $or: [{ client_user_id: opts.clientUserId }, { client_id: opts.clientId }] }
    : { client_user_id: opts.clientUserId };
  return (await col("cases").findOne(
    {
      $and: [
        owner,
        { service_type: opts.serviceType },
        { tax_year: opts.taxYear },
        { status: { $nin: [...CLOSED_CASE_STATUSES] } },
      ],
    },
    { sort: { created_at: -1 } },
  )) as Doc | null;
}

/**
 * Prefer the fulfilment/activation case for a CLIENT's ACTIVE service
 * (latest case for that service_type, any tax year).
 */
export async function preferExistingServiceCase(
  user: Doc,
  serviceType: string,
): Promise<Doc | null> {
  if (user.role !== "CLIENT") return null;
  const client = await clientOf(user);
  return (await col("cases").findOne(
    {
      $or: [{ client_user_id: user.id }, { client_id: client.id }],
      service_type: serviceType,
    },
    { sort: { created_at: -1 } },
  )) as Doc | null;
}
