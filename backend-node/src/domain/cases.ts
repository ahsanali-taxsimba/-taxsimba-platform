import { clean, col, Doc } from "../db/mongo";
import { httpError } from "../http/errors";

export async function clientRecord(user: Doc): Promise<Doc | null> {
  return (await col("clients").findOne({ user_id: user.id })) as Doc | null;
}

/**
 * The authoritative set of case ids the authenticated client owns.
 *
 * Ownership is derived from the CASE (authenticated user -> client record -> cases), never
 * from a denormalised copy of the user id on a child row. Child records such as tasks and
 * documents carry their own `owner_id`/`client_user_id` fields, and a stale or incorrectly
 * written value on one of those rows must never grant a client access to another client's
 * data, so every client-facing query is constrained by this set.
 */
export async function ownedCaseIds(user: Doc, serviceType?: string | null): Promise<string[]> {
  const client = await clientRecord(user);
  let query: Doc = client
    ? { $or: [{ client_user_id: user.id }, { client_id: client.id }] }
    : { client_user_id: user.id };
  if (serviceType) query = { $and: [query, { service_type: serviceType }] };
  const rows = await col("cases").find(query, { projection: { id: 1 } }).toArray();
  return rows.map((c) => c.id as string);
}

export async function getCase(caseId: string, user: Doc): Promise<Doc> {
  const found = (await col("cases").findOne({ id: caseId })) as Doc | null;
  if (!found) throw httpError(404, "Case not found");
  if (user.role === "CLIENT") {
    const client = await clientRecord(user);
    const owns =
      found.client_user_id === user.id || (client !== null && found.client_id === client.id);
    if (!owns) throw httpError(403, "Not your case");
  }
  if (user.role === "ACCOUNTANT" && found.assigned_accountant_id !== user.id) {
    throw httpError(403, "Case not assigned to you");
  }
  return clean(found) as Doc;
}

export function daysLeft(kase: Doc): number | null {
  const deadline = kase.internal_deadline;
  if (!deadline) return null;
  const parsed = Date.parse(deadline);
  if (Number.isNaN(parsed)) return null;
  return Math.floor((parsed - Date.now()) / 86400000);
}

/** Adds days_left and the latest activity to a page of cases using one aggregate query. */
export async function decorate(cases: Doc[]): Promise<Doc[]> {
  const out = cases.map((c) => clean(c) as Doc);
  const ids = out.map((c) => c.id);
  const latest: Record<string, Doc> = {};
  if (ids.length) {
    const rows = await col("activity_logs")
      .aggregate([
        { $match: { case_id: { $in: ids } } },
        { $sort: { created_at: -1 } },
        { $group: { _id: "$case_id", doc: { $first: "$$ROOT" } } },
      ])
      .toArray();
    for (const row of rows) latest[row._id as string] = clean(row.doc) as Doc;
  }
  for (const c of out) {
    c.days_left = daysLeft(c);
    c.last_activity = latest[c.id] ?? null;
  }
  return out;
}
