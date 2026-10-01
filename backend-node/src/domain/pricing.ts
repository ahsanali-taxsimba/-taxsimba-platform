/**
 * Date-effective package pricing.
 *
 * A price change with a future `effective_from` is stored as a pending row in
 * `package_price_schedule` instead of being applied immediately. `applyDuePriceSchedules()`
 * materialises a pending row onto the master package once its date has passed, writing the
 * same `pricing_audit` trail an immediate change writes.
 *
 * Materialising into `packages.price` (rather than resolving a price at every call site)
 * keeps every existing consumer — activation, checkout, upgrade options, `/my-services` —
 * unchanged, and keeps the API responses byte-identical to the Python reference.
 *
 * Customers are never affected retroactively: `client_services.agreed_price` is written once
 * at activation and is never re-read from the catalogue.
 */
import { randomUUID } from "crypto";

import { col, Doc } from "../db/mongo";
import { nowIso } from "./workflow";

export type ScheduleActor = Doc;

export async function ensurePricingIndexes(): Promise<void> {
  await col("package_price_schedule").createIndex({ package_id: 1, effective_from: 1 });
  await col("package_price_schedule").createIndex({ status: 1, effective_from: 1 });
}

/** A date is "future" only if it parses and is later than now. Anything else applies now. */
export function futureDate(value: string | null | undefined, now = new Date()): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime() > now.getTime() ? parsed : null;
}

export async function schedulePriceChange(
  pkg: Doc,
  price: number,
  effectiveFrom: Date,
  actor: ScheduleActor,
): Promise<Doc> {
  const row: Doc = {
    id: randomUUID(),
    package_id: pkg.id,
    service_type: pkg.service_type,
    code: pkg.code,
    price,
    previous_price: pkg.price,
    effective_from: effectiveFrom.toISOString(),
    status: "PENDING",
    created_by: String(actor.name),
    role: String(actor.role),
    created_at: nowIso(),
    applied_at: null,
    cancelled_at: null,
    cancelled_by: null,
  };
  await col("package_price_schedule").insertOne({ ...row });
  return row;
}

/**
 * Apply every pending change whose date has passed. Safe to call from several instances and
 * from any request path: each row is claimed with one atomic update before it is applied.
 */
export async function applyDuePriceSchedules(now = new Date()): Promise<number> {
  const due = (await col("package_price_schedule")
    .find({ status: "PENDING", effective_from: { $lte: now.toISOString() } })
    .sort({ effective_from: 1 })
    .limit(200)
    .toArray()) as Doc[];
  let applied = 0;
  for (const row of due) {
    const claim = await col("package_price_schedule").updateOne(
      { id: row.id, status: "PENDING" },
      { $set: { status: "APPLIED", applied_at: nowIso() } },
    );
    if (claim.modifiedCount !== 1) continue;
    try {
      const pkg = (await col("packages").findOne({ id: row.package_id })) as Doc | null;
      if (!pkg) {
        await col("package_price_schedule").updateOne(
          { id: row.id },
          { $set: { status: "ORPHANED", applied_at: null } },
        );
        continue;
      }
      await col("packages").updateOne(
        { id: pkg.id },
        { $set: { price: row.price, effective_from: row.effective_from, updated_at: nowIso() } },
      );
      // Same audit shape as an immediate change, plus the origin of the change.
      await col("pricing_audit").insertOne({
        id: randomUUID(),
        package_id: pkg.id,
        code: pkg.code,
        previous_price: pkg.price,
        new_price: row.price,
        effective_from: row.effective_from,
        changed_by: row.created_by,
        role: row.role,
        created_at: nowIso(),
        source: "SCHEDULED",
        schedule_id: row.id,
      });
      applied += 1;
    } catch (e) {
      // Release the claim so the next run retries rather than losing the change silently.
      await col("package_price_schedule").updateOne(
        { id: row.id },
        { $set: { status: "PENDING", applied_at: null } },
      );
      throw e;
    }
  }
  return applied;
}

export async function pendingSchedule(packageId: string): Promise<Doc[]> {
  return (await col("package_price_schedule")
    .find({ package_id: packageId })
    .sort({ effective_from: 1 })
    .limit(100)
    .toArray()) as Doc[];
}

export async function cancelScheduled(
  entryId: string,
  actor: ScheduleActor,
): Promise<boolean> {
  const res = await col("package_price_schedule").updateOne(
    { id: entryId, status: "PENDING" },
    { $set: { status: "CANCELLED", cancelled_at: nowIso(), cancelled_by: String(actor.name) } },
  );
  return res.modifiedCount === 1;
}
