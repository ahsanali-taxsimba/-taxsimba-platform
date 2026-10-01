import os from "node:os";
import { getSupabase } from "../supabase/client.js";
import { logger } from "../utils/logger.js";
import { env } from "../utils/env.js";

const log = logger("claimFirms");

export function workerId() {
  return (
    process.env.FLY_MACHINE_ID ||
    process.env.FLY_ALLOC_ID ||
    process.env.HOSTNAME ||
    `host-${os.hostname()}-${process.pid}`
  );
}

/**
 * Claim firms exclusively for this worker (safe across many Fly machines).
 */
export async function claimFirmsForCrawl({
  limit = env.continuousFirmBatch,
  leaseSeconds = Number(process.env.CRAWL_CLAIM_LEASE_SECONDS || 1800),
} = {}) {
  const worker = workerId();
  const { data, error } = await getSupabase().rpc("claim_firms_for_crawl", {
    p_limit: limit,
    p_worker: worker,
    p_lease_seconds: leaseSeconds,
  });

  if (error) {
    log.warn("claim RPC failed — falling back to list", { error: error.message });
    return null;
  }

  log.info("claimed firms", { worker, count: (data || []).length });
  return data || [];
}

export async function releaseFirmClaim(domain, { status = "pending" } = {}) {
  const { error } = await getSupabase()
    .from("accountancy_firms")
    .update({
      crawl_status: status,
      claimed_by: null,
      claimed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("domain", domain);
  if (error) log.warn("release claim failed", { domain, error: error.message });
}
