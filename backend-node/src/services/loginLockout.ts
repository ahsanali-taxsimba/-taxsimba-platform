/**
 * Login rate limiting + temporary account lockout (MongoDB-backed, TTL expiry).
 *
 * Only genuine credential failures are counted. Locks are temporary and lift automatically;
 * there is no permanent lock and no admin unlock.
 */
import { Request } from "express";
import ipaddr from "./ipaddr";

import { required } from "../config/env";
import { col } from "../db/mongo";
import { httpError } from "../http/errors";

const WINDOW_MINUTES = 15;
const SCOPES: Record<string, [number, number]> = {
  // scope: [max failures, base lock minutes]
  ip_email: [5, 15],
  account: [10, 15],
  ip: [50, 15],
};
const BACKOFF_MINUTES = [15, 30, 60]; // 1st, 2nd, 3rd+ offence (capped at 60)

function trustedNetworks(): string[] {
  return required("TRUSTED_PROXY_CIDRS")
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

/**
 * Real client IP. X-Forwarded-For is honoured ONLY when the immediate peer is a trusted
 * proxy/ingress, and then only its right-most entry is used.
 */
export function clientIp(req: Request): string {
  const peer = req.socket.remoteAddress ?? "unknown";
  if (!ipaddr.isValid(peer)) return peer;
  if (!trustedNetworks().some((net) => ipaddr.inNetwork(peer, net))) return peer;
  const hops = (req.header("x-forwarded-for") ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter((h) => h.length > 0);
  return hops.length ? hops[hops.length - 1] : peer;
}

function keys(ip: string, email: string): [string, string][] {
  return [
    ["ip_email", `${ip}|${email}`],
    ["account", email],
    ["ip", ip],
  ];
}

function lockMinutes(offences: number): number {
  if (offences <= 0) return BACKOFF_MINUTES[0];
  return BACKOFF_MINUTES[Math.min(offences, BACKOFF_MINUTES.length) - 1];
}

export async function ensureIndexes(): Promise<void> {
  await col("login_attempts").createIndex({ scope: 1, key: 1 }, { unique: true });
  await col("login_attempts").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
  await col("refresh_tokens").createIndex({ jti: 1 }, { unique: true });
  await col("refresh_tokens").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
  try {
    await col("users").createIndex({ email: 1 }, { unique: true });
  } catch (e) {
    // pre-existing duplicates must not block startup
    // eslint-disable-next-line no-console
    console.warn(`users.email unique index skipped: ${String(e)}`);
  }
}

/** Raise 429 with Retry-After if any scope is currently locked. */
export async function enforceLoginAllowed(ip: string, email: string): Promise<void> {
  const now = Date.now();
  for (const [scope, key] of keys(ip, email)) {
    const doc = await col("login_attempts").findOne({ scope, key });
    if (!doc || !doc.locked_until) continue;
    const until = new Date(doc.locked_until).getTime();
    if (until > now) {
      const retry = Math.max(1, Math.floor((until - now) / 1000));
      throw httpError(
        429,
        "Too many failed login attempts. This account is temporarily locked. " +
          `Try again in ${Math.max(1, Math.floor(retry / 60))} minute(s).`,
        { "Retry-After": String(retry) },
      );
    }
  }
}

export async function recordFailure(ip: string, email: string): Promise<void> {
  const now = new Date();
  for (const [scope, key] of keys(ip, email)) {
    const [limit] = SCOPES[scope];
    const doc = await col("login_attempts").findOne({ scope, key });
    const windowStart = doc?.window_start ? new Date(doc.window_start) : null;
    const fresh =
      !doc || !windowStart || now.getTime() - windowStart.getTime() > WINDOW_MINUTES * 60000;
    const count = fresh ? 1 : (doc?.count ?? 0) + 1;
    let offences = fresh ? 0 : (doc?.offences ?? 0);
    const update: Record<string, unknown> = {
      scope,
      key,
      count,
      offences,
      window_start: fresh ? now : windowStart,
      last_failure_at: now,
      expires_at: new Date(now.getTime() + 86400000),
    };
    if (count >= limit) {
      offences += 1;
      const mins = lockMinutes(offences);
      Object.assign(update, {
        count: 0,
        offences,
        window_start: now,
        locked_until: new Date(now.getTime() + mins * 60000),
        expires_at: new Date(now.getTime() + mins * 60000 + 86400000),
      });
    }
    await col("login_attempts").updateOne({ scope, key }, { $set: update }, { upsert: true });
  }
}

/** A successful login clears the applicable counters. */
export async function clearFailures(ip: string, email: string): Promise<void> {
  for (const [scope, key] of keys(ip, email)) {
    await col("login_attempts").deleteOne({ scope, key });
  }
}
