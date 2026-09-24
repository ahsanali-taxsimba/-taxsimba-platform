/**
 * Resolve a first name for transactional email greetings.
 * Prefer clients.first_name; fall back to the first token of users.name.
 * Never invent Client / MTD User / email-prefix placeholders.
 */
import { Doc } from "../db/mongo";

export function resolveEmailFirstName(
  user: Doc | null | undefined,
  client?: Doc | null,
): string {
  const fromClient = String(client?.first_name ?? "").trim();
  if (fromClient) return fromClient.split(/\s+/)[0];
  const full = String(user?.name ?? "").trim();
  if (!full) return "";
  return full.split(/\s+/)[0];
}
