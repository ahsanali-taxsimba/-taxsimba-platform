/**
 * Long-conversation context packing.
 * Keeps recent turns verbatim and compresses older turns into a memory note
 * so SIMBA does not "forget" or stall after ~6–8 exchanges.
 */

import type { ChatMessage } from "../models/schemas.js";

/** Recent messages kept verbatim (user+assistant pairs). */
export const RECENT_MESSAGE_LIMIT = 40; // 20 full turns
/** Absolute cap stored per session. */
export const SESSION_HISTORY_CAP = 120; // 60 turns

export function packConversationHistory(
  messages: ChatMessage[],
): ChatMessage[] {
  const cleaned = (messages || []).filter(
    (m) => m && (m.role === "user" || m.role === "assistant") && m.content,
  );
  if (cleaned.length <= RECENT_MESSAGE_LIMIT) return cleaned;

  const older = cleaned.slice(0, -RECENT_MESSAGE_LIMIT);
  const recent = cleaned.slice(-RECENT_MESSAGE_LIMIT);
  const memory = summariseOlderTurns(older);
  return [
    {
      role: "system",
      content:
        "Earlier conversation memory (do not re-ask facts already stated):\n" +
        memory,
    },
    ...recent,
  ];
}

function summariseOlderTurns(older: ChatMessage[]): string {
  const facts: string[] = [];
  const seen = new Set<string>();
  for (const m of older) {
    if (m.role !== "user") continue;
    const text = m.content.replace(/\s+/g, " ").trim();
    if (text.length < 8) continue;
    const key = text.toLowerCase().slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    facts.push(`- Customer said: ${text.slice(0, 180)}`);
    if (facts.length >= 24) break;
  }
  if (!facts.length) {
    return "- Prior turns occurred; continue helpfully without inventing details.";
  }
  return facts.join("\n");
}
