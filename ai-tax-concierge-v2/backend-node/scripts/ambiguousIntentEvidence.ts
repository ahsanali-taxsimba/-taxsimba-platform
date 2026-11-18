#!/usr/bin/env tsx
/**
 * Ambiguous / intelligence probe — prefers live OpenAI when configured.
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { buildLlmAdapter } from "../src/adapters/factory.js";
import { ConversationalEngine } from "../src/ai/conversational_engine.js";
import { createSettings } from "../src/config/settings.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "docs/verification/simba_v2_master_evidence/evidence");

const QUESTIONS = [
  "I make £4,000 profit from online trading.",
  "I earn £60,000.",
  "My business makes £100,000.",
  "I have a company and a normal job.",
  "I sell things online.",
  "I trade crypto.",
  "I have rental income.",
  "I already have an accountant.",
  "Can you guarantee a tax refund?",
  "I want the cheapest package.",
];

async function main() {
  const live = Boolean(process.env.OPENAI_API_KEY) &&
    process.env.CONCIERGE_FORCE_MOCK_LLM !== "true";
  const settings = createSettings({
    CONCIERGE_FORCE_MOCK_LLM: live ? "false" : "true",
    CONCIERGE_ENV: "staging",
  });
  const llm = buildLlmAdapter(settings);
  const engine = new ConversationalEngine({ llm, settings });

  const rows = [];
  for (const q of QUESTIONS) {
    const t0 = performance.now();
    const res = await engine.handle({
      message: q,
      session_id: randomUUID(),
      tax_year: "2025-26",
      history: [],
    });
    rows.push({
      question: q,
      reply_verbatim: res.reply,
      packages: (res.packages || []).map((p) => ({
        code: p.code,
        name: p.name,
        price_gbp: p.price_gbp,
      })),
      llm_mode: res.llm_mode,
      latency_ms: Math.round(performance.now() - t0),
      obtained_via:
        res.llm_mode === "openai"
          ? "real_openai_api"
          : "deterministic_short_circuit_or_mock",
    });
    console.log("OK", q.slice(0, 48), "mode=", res.llm_mode);
  }

  mkdirSync(OUT, { recursive: true });
  const payload = {
    generated_at: new Date().toISOString(),
    openai_configured: live,
    model: settings.openaiModel,
    adapter_mode: llm.mode,
    total: rows.length,
    questions: rows,
  };
  writeFileSync(
    path.join(OUT, "ambiguous_intent_live.json"),
    JSON.stringify(payload, null, 2),
  );
  console.log(JSON.stringify({ total: rows.length, adapter_mode: llm.mode }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(3);
});
