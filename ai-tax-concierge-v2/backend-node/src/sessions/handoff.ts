/**
 * Secure short-lived, single-use workspace handoff tokens.
 * Tokens map to an existing session_id server-side — never put history or
 * reusable session credentials in the URL.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { sessionStore } from "./store.js";

export const HANDOFF_TTL_MS = 120_000;

export type HandoffRecord = {
  token_hash: string;
  session_id: string;
  draft: string;
  created_at: number;
  expires_at: number;
  used: boolean;
};

export type HandoffConsumeResult = {
  session_id: string;
  history: Array<{ role: string; content: string }>;
  draft: string;
  turn_count: number;
};

const handoffs = new Map<string, HandoffRecord>();

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function pruneExpired(now = Date.now()): void {
  for (const [hash, rec] of handoffs) {
    if (rec.expires_at <= now) handoffs.delete(hash);
  }
}

export function createHandoff(input: {
  session_id: string;
  draft?: string | null;
}): { handoff_token: string; expires_in: number } | { error: string } {
  pruneExpired();
  const sid = String(input.session_id || "").trim();
  if (!sid) return { error: "session_id is required" };
  const rec = sessionStore.get(sid);
  if (!rec) return { error: "session_not_found" };

  const token = randomBytes(32).toString("hex");
  const token_hash = hashToken(token);
  const now = Date.now();
  handoffs.set(token_hash, {
    token_hash,
    session_id: sid,
    draft: String(input.draft || "").slice(0, 4000),
    created_at: now,
    expires_at: now + HANDOFF_TTL_MS,
    used: false,
  });
  return { handoff_token: token, expires_in: Math.floor(HANDOFF_TTL_MS / 1000) };
}

export function consumeHandoff(
  token: string,
): { ok: true; data: HandoffConsumeResult } | { ok: false; error: string } {
  pruneExpired();
  const raw = String(token || "").trim();
  if (!/^[a-f0-9]{64}$/i.test(raw)) {
    return { ok: false, error: "invalid_handoff" };
  }
  const token_hash = hashToken(raw);
  const handoff = handoffs.get(token_hash);
  if (!handoff) return { ok: false, error: "invalid_or_expired_handoff" };
  if (handoff.used) return { ok: false, error: "handoff_already_used" };
  if (handoff.expires_at <= Date.now()) {
    handoffs.delete(token_hash);
    return { ok: false, error: "invalid_or_expired_handoff" };
  }

  // Constant-time compare of stored hash vs recomputed (defense in depth).
  const a = Buffer.from(handoff.token_hash, "hex");
  const b = Buffer.from(token_hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: "invalid_or_expired_handoff" };
  }

  handoff.used = true;
  // Keep the used record until TTL so a second redeem returns a clear 409, not "unknown".

  const session = sessionStore.get(handoff.session_id);
  if (!session) return { ok: false, error: "session_not_found" };

  return {
    ok: true,
    data: {
      session_id: session.session_id,
      history: session.history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      draft: handoff.draft,
      turn_count: session.history.length,
    },
  };
}

/** Test helper — clear in-memory handoffs. */
export function resetHandoffsForTests(): void {
  handoffs.clear();
}
