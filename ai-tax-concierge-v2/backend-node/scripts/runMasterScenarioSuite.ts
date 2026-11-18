#!/usr/bin/env tsx
/**
 * Master scenario suite runner — executes 505+ single-turn scenarios and 50 multiturns.
 * Mode: mock LLM + deterministic MTD/catalogue handlers by default.
 * Set CONCIERGE_FORCE_MOCK_LLM=false and OPENAI_API_KEY for live subset.
 *
 * Evidence written under docs/verification/simba_v2_master_evidence/
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLlmAdapter } from "../src/adapters/factory.js";
import { ConversationalEngine } from "../src/ai/conversational_engine.js";
import { createSettings } from "../src/config/settings.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIX = path.join(ROOT, "backend-node/tests/fixtures");
const EVIDENCE = path.join(ROOT, "docs/verification/simba_v2_master_evidence");

type Scenario = {
  id: string;
  category: string;
  intent: string;
  prompt: string;
  expect_any: string[];
  reject_any: string[];
  expect_codes?: string[] | null;
  forbid_codes?: string[];
  hmrc_ref?: string | null;
  notes?: string;
  critical?: boolean;
};

function score(
  reply: string,
  codes: string[],
  s: Scenario,
): { pass: boolean; flags: string[] } {
  const lower = reply.toLowerCase();
  const flags: string[] = [];
  if (s.expect_any?.length) {
    const hit = s.expect_any.some((n) => lower.includes(n.toLowerCase()));
    if (!hit) flags.push(`EXPECT_MISS:${s.expect_any.join("|")}`);
  }
  for (const n of s.reject_any || []) {
    if (lower.includes(n.toLowerCase())) flags.push(`REJECT_HIT:${n}`);
  }
  if (s.expect_codes?.length) {
    if (!s.expect_codes.every((c) => codes.includes(c))) {
      flags.push(`CODE_MISS:${s.expect_codes.join(",")}`);
    }
  }
  for (const c of s.forbid_codes || []) {
    if (codes.includes(c)) flags.push(`CODE_FORBID:${c}`);
  }
  // Hard fail on internal leakage
  for (const leak of [
    "owner_decisions",
    "inclusion_item_statuses",
    "approval_matrix",
    "system prompt:",
  ]) {
    if (lower.includes(leak)) flags.push(`LEAK:${leak}`);
  }
  return { pass: flags.length === 0, flags };
}

async function main() {
  const live =
    process.env.CONCIERGE_FORCE_MOCK_LLM !== "true" &&
    Boolean(process.env.OPENAI_API_KEY);
  const settings = createSettings({
    CONCIERGE_FORCE_MOCK_LLM: live ? "false" : "true",
    CONCIERGE_ENV: "staging",
  });
  const llm = buildLlmAdapter(settings);
  const engine = new ConversationalEngine({ llm, settings });

  const suite = JSON.parse(
    readFileSync(path.join(FIX, "master_scenarios_505.json"), "utf-8"),
  );
  const multiturn = JSON.parse(
    readFileSync(path.join(FIX, "master_multiturn_50.json"), "utf-8"),
  );

  const results: Array<Record<string, unknown>> = [];
  let passed = 0;
  let failed = 0;
  let criticalFailed = 0;

  for (const s of suite.scenarios as Scenario[]) {
    const sid = randomUUID();
    let reply = "";
    let codes: string[] = [];
    let err: string | null = null;
    try {
      const res = await engine.handle({
        session_id: sid,
        message: s.prompt,
        tax_year: "2025-26",
      });
      reply = res.reply || "";
      codes = (res.packages || []).map((p) => p.code);
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
    const scored = score(reply, codes, s);
    if (err) {
      scored.pass = false;
      scored.flags.push(`ERROR:${err}`);
    }
    if (scored.pass) passed += 1;
    else {
      failed += 1;
      if (s.critical) criticalFailed += 1;
    }
    results.push({
      id: s.id,
      category: s.category,
      intent: s.intent,
      prompt: s.prompt,
      expected_behaviour: {
        expect_any: s.expect_any,
        reject_any: s.reject_any,
        expect_codes: s.expect_codes,
        forbid_codes: s.forbid_codes,
      },
      hmrc_ref: s.hmrc_ref || null,
      actual_reply_verbatim: reply,
      package_codes: codes,
      result: scored.pass ? "PASS" : "FAIL",
      flags: scored.flags,
      critical: Boolean(s.critical),
      mode: llm.mode,
      obtained_via: live ? "live_openai_engine" : "mock_llm_deterministic_handlers",
    });
  }

  const mtResults: Array<Record<string, unknown>> = [];
  let mtPass = 0;
  for (const conv of multiturn.conversations as Array<{
    id: string;
    title: string;
    turns: string[];
    final_expect_any?: string[];
    forbid_codes_final?: string[];
  }>) {
    const sid = randomUUID();
    const transcript: Array<{ role: string; content: string }> = [];
    let lastCodes: string[] = [];
    let ok = true;
    const flags: string[] = [];
    for (const turn of conv.turns) {
      const res = await engine.handle({
        session_id: sid,
        message: turn,
        tax_year: "2025-26",
        history: transcript.slice(-12).map((t) => ({
          role: t.role as "user" | "assistant",
          content: t.content,
        })),
      });
      transcript.push({ role: "user", content: turn });
      transcript.push({ role: "assistant", content: res.reply });
      lastCodes = (res.packages || []).map((p) => p.code);
    }
    const last = transcript.filter((t) => t.role === "assistant").pop()?.content || "";
    const lower = last.toLowerCase();
    if ((conv.final_expect_any || []).length) {
      const hit = (conv.final_expect_any || []).some((n) =>
        lower.includes(n.toLowerCase()),
      );
      if (!hit) {
        ok = false;
        flags.push(`EXPECT_MISS:${(conv.final_expect_any || []).join("|")}`);
      }
    }
    for (const c of conv.forbid_codes_final || []) {
      if (lastCodes.includes(c)) {
        ok = false;
        flags.push(`CODE_FORBID:${c}`);
      }
    }
    if (ok) mtPass += 1;
    mtResults.push({
      id: conv.id,
      title: conv.title,
      transcript,
      final_codes: lastCodes,
      result: ok ? "PASS" : "FAIL",
      flags,
      obtained_via: live ? "live_openai_engine" : "mock_llm_deterministic_handlers",
    });
  }

  mkdirSync(path.join(EVIDENCE, "evidence"), { recursive: true });
  mkdirSync(path.join(EVIDENCE, "transcripts"), { recursive: true });

  const summary = {
    generated_at: new Date().toISOString(),
    llm_mode: llm.mode,
    obtained_via: live ? "live_openai_engine" : "mock_llm_deterministic_handlers",
    single_turn: {
      total: results.length,
      passed,
      failed,
      critical_failed: criticalFailed,
    },
    multiturn: {
      total: mtResults.length,
      passed: mtPass,
      failed: mtResults.length - mtPass,
    },
  };

  writeFileSync(
    path.join(EVIDENCE, "evidence/master_suite_summary.json"),
    JSON.stringify(summary, null, 2),
  );
  writeFileSync(
    path.join(EVIDENCE, "evidence/master_suite_results.json"),
    JSON.stringify({ summary, results }, null, 2),
  );
  writeFileSync(
    path.join(EVIDENCE, "transcripts/multiturn_50.json"),
    JSON.stringify({ summary: summary.multiturn, conversations: mtResults }, null, 2),
  );

  // Human-readable matrix excerpt
  const lines = [
    `# Master scenario matrix (executed)`,
    ``,
    `Generated: ${summary.generated_at}`,
    `Mode: ${summary.llm_mode} (${summary.obtained_via})`,
    `Single-turn: ${passed}/${results.length} PASS (critical failures: ${criticalFailed})`,
    `Multiturn: ${mtPass}/${mtResults.length} PASS`,
    ``,
    `| ID | Category | Result | Flags |`,
    `|----|----------|--------|-------|`,
  ];
  for (const r of results) {
    lines.push(
      `| ${r.id} | ${r.category} | ${r.result} | ${(r.flags as string[]).join("; ") || "—"} |`,
    );
  }
  writeFileSync(path.join(EVIDENCE, "evidence/SCENARIO_MATRIX.md"), lines.join("\n"));

  // Verbatim dump (large)
  const verbatim = results
    .map(
      (r) =>
        `## ${r.id} [${r.result}]\n**Prompt:** ${r.prompt}\n\n**Reply:**\n\n${r.actual_reply_verbatim}\n`,
    )
    .join("\n---\n\n");
  writeFileSync(
    path.join(EVIDENCE, "transcripts/single_turn_verbatim.md"),
    `# Verbatim single-turn responses\n\n${verbatim}`,
  );

  console.log(JSON.stringify(summary, null, 2));
  if (criticalFailed > 0 || failed > Math.ceil(results.length * 0.15)) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
