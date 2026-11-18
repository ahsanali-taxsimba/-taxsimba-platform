#!/usr/bin/env tsx
/**
 * Live-model MTD eligibility remediation probe.
 * Deterministic engine short-circuits handled cases; still exercises full ConversationalEngine
 * with a live OpenAI adapter so inconsistent model answers cannot override boundaries.
 *
 * Exit: 0 all pass | 1 failures | 2 blocked (no key / mock forced)
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
const OUT = path.join(
  ROOT,
  "docs/verification/simba_v2_final_corrected/evidence",
);

type CaseDef = {
  id: string;
  message: string;
  expect_any: string[];
  reject_any?: string[];
};

const CASES: CaseDef[] = [
  {
    id: "exact_50k_2024_25_not_in_scope",
    message:
      "My qualifying income was exactly £50,000 in the 2024-25 tax year. Do I need Making Tax Digital from April 2026?",
    expect_any: ["exactly", "more than"],
    reject_any: [
      "you need to use making tax digital for income tax from 6 april 2026",
      "you must start from 6 april 2026",
    ],
  },
  {
    id: "over_50k_april_2026",
    message:
      "My qualifying income was £55,000 in 2024-25. When do I need Making Tax Digital for Income Tax?",
    expect_any: ["6 april 2026", "april 2026"],
  },
  {
    id: "exact_30k_2025_26",
    message:
      "Qualifying income exactly £30,000 in 2025-26 — am I in scope for MTD from April 2027?",
    expect_any: ["exactly", "more than"],
    reject_any: ["you need to use making tax digital from 6 april 2027"],
  },
  {
    id: "over_30k_april_2027",
    message:
      "Qualifying income £35,000 in 2025-26. When does MTD for Income Tax start?",
    expect_any: ["6 april 2027", "april 2027"],
    reject_any: ["april 2026"],
  },
  {
    id: "exact_20k_2026_27",
    message:
      "My qualifying income was exactly £20,000 in 2026-27. Do I need MTD from April 2028?",
    expect_any: ["exactly", "more than"],
  },
  {
    id: "paye_only",
    message:
      "I only have PAYE employment income of £70,000. Do I need Making Tax Digital for Income Tax?",
    expect_any: ["paye"],
    reject_any: ["you need to start making tax digital"],
  },
  {
    id: "limited_company",
    message:
      "I run a limited company turning over £80,000. When do I need Making Tax Digital for Income Tax?",
    expect_any: ["limited compan"],
  },
  {
    id: "profit_not_gross",
    message: "My profit is £55,000. Do I need MTD from April 2026?",
    expect_any: ["gross", "turnover", "qualifying"],
  },
];

async function main() {
  const key = process.env.OPENAI_API_KEY || "";
  if (!key) {
    console.error("BLOCKED: OPENAI_API_KEY missing");
    process.exit(2);
  }
  if (process.env.CONCIERGE_FORCE_MOCK_LLM === "true") {
    console.error("BLOCKED: CONCIERGE_FORCE_MOCK_LLM=true");
    process.exit(2);
  }

  const settings = createSettings({
    CONCIERGE_FORCE_MOCK_LLM: "false",
    CONCIERGE_ENV: "staging",
  });
  const llm = buildLlmAdapter(settings);
  const engine = new ConversationalEngine({ llm, settings });

  const results: Array<Record<string, unknown>> = [];
  let failed = 0;

  for (const c of CASES) {
    const t0 = performance.now();
    const session = randomUUID();
    let reply = "";
    let err: string | null = null;
    try {
      const res = await engine.handle({
        session_id: session,
        message: c.message,
        tax_year: "2025-26",
      });
      reply = res.reply || "";
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
    const lower = reply.toLowerCase();
    const missing = c.expect_any.filter((s) => !lower.includes(s.toLowerCase()));
    const leaked = (c.reject_any || []).filter((s) =>
      lower.includes(s.toLowerCase()),
    );
    const pass = !err && missing.length === 0 && leaked.length === 0;
    if (!pass) failed += 1;
    results.push({
      id: c.id,
      pass,
      ms: Math.round(performance.now() - t0),
      missing,
      leaked,
      error: err,
      reply_preview: reply.slice(0, 400),
    });
    console.log(`${pass ? "PASS" : "FAIL"} ${c.id}`);
  }

  mkdirSync(OUT, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const report = {
    generated_at: new Date().toISOString(),
    llm_mode: llm.mode,
    total: CASES.length,
    passed: CASES.length - failed,
    failed,
    results,
  };
  const outPath = path.join(OUT, `live_mtd_eligibility_${stamp}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  writeFileSync(
    path.join(OUT, "live_mtd_eligibility_latest.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(`Wrote ${outPath}`);
  console.log(`Summary: ${report.passed}/${report.total} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(3);
});
