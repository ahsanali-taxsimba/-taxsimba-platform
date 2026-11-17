import { randomBytes } from "node:crypto";
import { sql } from "./db";
import type { ConnectionSetting } from "./types";

export function newWebhookToken(): string {
  return randomBytes(24).toString("hex");
}

export async function findOwnerByToken(
  source: ConnectionSetting["source"],
  token: string,
): Promise<string | null> {
  if (!token.trim()) return null;
  const rows = await sql<{ owner_sub: string }>(
    `select owner_sub from connection_settings
     where source = $1 and enabled = true and config->>'webhook_token' = $2
     limit 1`,
    [source, token.trim()],
  );
  return rows[0]?.owner_sub ?? null;
}

export function extractToken(request: Request): string {
  const url = new URL(request.url);
  return (
    url.searchParams.get("token")?.trim() ||
    request.headers.get("x-lead-inbox-token")?.trim() ||
    ""
  );
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
