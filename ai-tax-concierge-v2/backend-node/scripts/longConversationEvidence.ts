#!/usr/bin/env tsx
/**
 * Single continuous OpenAI-backed conversation: 20 then 50 turns.
 * Proves SIMBA does not stop after ~7–8 questions.
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { buildLlmAdapter } from "../src/adapters/factory.js";
import { ConversationalEngine } from "../src/ai/conversational_engine.js";
import { createSettings } from "../src/config/settings.js";

const OUT = path.join(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
  "docs/verification/simba_v2_master_evidence/evidence",
);

const QUESTIONS = [
  "Hi SIMBA — I’m a bit nervous about tax. Can you help gently?",
  "I started freelancing this tax year alongside a PAYE job.",
  "My salary is about £32,000 and freelancing turnover is about £8,000.",
  "Do I need Self Assessment?",
  "When do I need to register by?",
  "What is the online filing deadline for 2025-26?",
  "Is my freelancing turnover the same as profit?",
  "I also had about £1,200 bank interest.",
  "Does that change anything?",
  "What records should I keep?",
  "I’m worried I’ll get something wrong — what should I do first?",
  "What is Making Tax Digital in plain English?",
  "With £8,000 freelancing turnover, do I need MTD from April 2026?",
  "What if next year my freelancing turnover is £55,000?",
  "Would that be gross income or profit for the MTD test?",
  "I also might rent a room later — does Rent a Room matter?",
  "Actually ignore rental for now — stick to PAYE + freelance.",
  "What’s the lowest suitable Self Assessment package for me?",
  "Why that package rather than Elite?",
  "Where do I register if I choose Simple?",
  "Can you explain CIS briefly even though I’m not in construction?",
  "I once sold some crypto — does that always mean Self Assessment?",
  "I only disposed of a small amount once.",
  "Please don’t sell me anything else — just confirm the SA deadline again.",
  "Thanks. Can you remember my salary figure from earlier?",
  "And my freelancing turnover?",
  "If I become a limited company next year, does MTD for Income Tax apply the same way?",
  "Good. What’s TaxCalc used for at TaxSimba?",
  "And Xero?",
  "Does TaxSimba file directly to HMRC with its own software?",
  "I might want an accountant consultation later — what are the options?",
  "Not booking yet. Just checking prices.",
  "Can someone from TaxSimba email me about Self Assessment when I leave details?",
  "I’m still only information-gathering.",
  "What if HMRC guidance changes mid-year?",
  "How does SIMBA stay up to date?",
  "Please summarise my situation in two short sentences.",
  "What one clarification would you still ask me?",
  "My freelancing is graphic design, not selling goods.",
  "Does that change the package advice?",
  "I’m feeling more confident now — thank you.",
  "If I pause for a week and come back, can we continue from these facts?",
  "One more check: exact £50,000 qualifying income — in or out of the April 2026 MTD band?",
  "And £50,001?",
  "PAYE of £60,000 alone — does that force MTD for Income Tax?",
  "Ok, back to my real figures: £32k PAYE + £8k freelance turnover.",
  "Any final practical next step for me this week?",
  "Could you keep the answer short?",
  "Brilliant — last question: are you a human accountant?",
  "End of long conversation test — please acknowledge turn fifty.",
];

async function runTurns(engine: ConversationalEngine, n: number) {
  const sid = randomUUID();
  const history: Array<{ role: "user" | "assistant"; content: string }> = [];
  const transcript = [];
  let failures = 0;
  for (let i = 0; i < n; i++) {
    const message = QUESTIONS[i % QUESTIONS.length] + (i >= QUESTIONS.length ? ` (turn ${i + 1})` : "");
    const t0 = performance.now();
    try {
      const res = await engine.handle({
        session_id: sid,
        message,
        tax_year: "2025-26",
        history,
      });
      const reply = res.reply || "";
      if (!reply.trim()) failures += 1;
      history.push({ role: "user", content: message });
      history.push({ role: "assistant", content: reply });
      transcript.push({
        turn: i + 1,
        user: message,
        assistant: reply,
        llm_mode: res.llm_mode,
        latency_ms: Math.round(performance.now() - t0),
        packages: (res.packages || []).map((p) => p.code),
      });
      console.log(`OK turn ${i + 1}/${n} ${Math.round(performance.now() - t0)}ms mode=${res.llm_mode}`);
    } catch (e) {
      failures += 1;
      transcript.push({
        turn: i + 1,
        user: message,
        error: e instanceof Error ? e.message : String(e),
        latency_ms: Math.round(performance.now() - t0),
      });
      console.log(`FAIL turn ${i + 1}`, e);
    }
  }
  // Memory check: salary recalled?
  const mem = await engine.handle({
    session_id: sid,
    message: "Quick memory check — what salary figure did I mention earlier?",
    tax_year: "2025-26",
    history,
  });
  return {
    session_id: sid,
    turns: n,
    failures,
    passed: failures === 0,
    memory_probe: {
      question: "what salary figure did I mention earlier?",
      reply: mem.reply,
      mentions_32000: /32,?000|32000/.test(mem.reply || ""),
    },
    transcript,
  };
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("BLOCKED: OPENAI_API_KEY missing");
    process.exit(2);
  }
  const settings = createSettings({
    CONCIERGE_FORCE_MOCK_LLM: "false",
    CONCIERGE_ENV: "staging",
  });
  const llm = buildLlmAdapter(settings);
  if (llm.mode !== "openai") {
    console.error("BLOCKED: not openai mode");
    process.exit(2);
  }
  const engine = new ConversationalEngine({ llm, settings });
  mkdirSync(OUT, { recursive: true });

  console.log("=== 20-turn continuous conversation ===");
  const twenty = await runTurns(engine, 20);
  writeFileSync(
    path.join(OUT, "long_conversation_20.json"),
    JSON.stringify({ generated_at: new Date().toISOString(), obtained_via: "real_openai_api", model: settings.openaiModel, ...twenty }, null, 2),
  );

  console.log("=== 50-turn continuous conversation ===");
  const fifty = await runTurns(engine, 50);
  writeFileSync(
    path.join(OUT, "long_conversation_50.json"),
    JSON.stringify({ generated_at: new Date().toISOString(), obtained_via: "real_openai_api", model: settings.openaiModel, ...fifty }, null, 2),
  );

  const summary = {
    generated_at: new Date().toISOString(),
    obtained_via: "real_openai_api",
    model: settings.openaiModel,
    root_cause_fixed:
      "Client and OpenAI adapter previously truncated history to 12 messages (~6 turns). Now packConversationHistory keeps 40 recent messages + compressed earlier memory; session store keeps 120; chat rate limit raised.",
    twenty: {
      passed: twenty.passed,
      failures: twenty.failures,
      memory_ok: twenty.memory_probe.mentions_32000,
    },
    fifty: {
      passed: fifty.passed,
      failures: fifty.failures,
      memory_ok: fifty.memory_probe.mentions_32000,
    },
  };
  writeFileSync(path.join(OUT, "long_conversation_summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  process.exit(twenty.passed && fifty.passed ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(3);
});
