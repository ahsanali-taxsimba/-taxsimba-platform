/** Deterministic mock LLM for tests and keyless local development. */

import type { LLMAdapter } from "./base.js";
import type { ChatMessage } from "../models/schemas.js";

export class MockLLMAdapter implements LLMAdapter {
  mode = "mock";

  async complete(args: {
    system_prompt: string;
    messages: ChatMessage[];
    user_message: string;
  }): Promise<string> {
    const { system_prompt, user_message } = args;
    let grounded = "";
    if (system_prompt.includes("VERIFIED FACTS:")) {
      grounded = system_prompt.split("VERIFIED FACTS:")[1]!.trim();
      for (const marker of [
        "GROUNDING RULES",
        "TAXSIMBA CATALOGUE",
        "CONVERSATION RULES",
        "INSTRUCTIONS:",
        "GUIDED JOURNEY CONTEXT",
      ]) {
        if (grounded.includes(marker)) {
          grounded = grounded.split(marker)[0]!.trim();
        }
      }
    }

    if (grounded && !grounded.startsWith("- No verified corpus match")) {
      let lines = grounded
        .split("\n")
        .map((ln) => ln.trim())
        .filter(
          (ln) => ln && (ln.startsWith("-") || ln.startsWith("[")),
        )
        .map((ln) => ln.replace(/^-+/, "").trim());

      if (!lines.length) {
        lines = grounded
          .split("\n")
          .map((ln) => ln.trim().replace(/^-+/, "").trim())
          .filter(Boolean);
      }

      const q = user_message.toLowerCase().replace(/,/g, "");
      let best = lines[0] || "";
      let bestScore = -1;
      for (const ln of lines) {
        const low = ln.toLowerCase().replace(/,/g, "");
        let score = 0;
        for (const token of q.split(/\s+/)) {
          if (token.length > 3 && low.includes(token)) score += 1;
        }
        for (const [needle, weight] of [
          ["vat", 5],
          ["90000", 8],
          ["30000", 8],
          ["50000", 6],
          ["20000", 6],
          ["april 2027", 8],
          ["april 2026", 4],
          ["april 2028", 6],
          ["mtd", 3],
          ["making tax digital", 4],
        ] as const) {
          if (q.includes(needle) && low.includes(needle)) score += weight;
        }
        if (score > bestScore) {
          bestScore = score;
          best = ln;
        }
      }
      return (
        `Based on verified HMRC / GOV.UK guidance: ${best}\n\n` +
        "This is general information, not personal tax advice. " +
        "If your situation is complex, TaxSimba can arrange a £99 " +
        "accountant consultation."
      );
    }

    return (
      "I could not find a verified HMRC source in my knowledge base for " +
      "that specific question. I recommend checking GOV.UK or booking a " +
      "£99 TaxSimba accountant consultation for tailored guidance."
    );
  }
}
