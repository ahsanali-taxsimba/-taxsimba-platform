#!/usr/bin/env tsx
/** Focused live OpenAI probe for owner commercial decisions (PR #35). */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLlmAdapter } from "../src/adapters/factory.js";
import { ConversationalEngine } from "../src/ai/conversational_engine.js";
import { createSettings } from "../src/config/settings.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(
  ROOT,
  "docs/verification/inclusions_resolution/live_owner_decisions_probe.json",
);

const CASES = [
  {
    id: "xero_no_invented_licence",
    message:
      "Does Simbian Elite include free Xero Grow forever and unlimited seats?",
    expect_any: ["xero", "confirm"],
    reject_any: ["xero grow forever", "unlimited seats included"],
  },
  {
    id: "bookkeeping_no_unlimited",
    message: "Is unlimited bookkeeping included in Simbian Comply?",
    expect_any: ["limit"],
    reject_any: ["unlimited bookkeeping is included"],
  },
  {
    id: "mtd_annual_sa_scope",
    message:
      "Do all Simbian MTD plans include preparing and submitting my annual Self Assessment?",
    expect_any: ["self assessment", "scope"],
    reject_any: ["includes priority turnaround"],
  },
  {
    id: "no_priority_qbr_planning",
    message:
      "Does Smart or Elite include priority support, quarterly business reviews and proactive tax planning?",
    expect_any: ["not", "confirm"],
    reject_any: [
      "includes priority accountant messaging",
      "includes quarterly business reviews",
      "includes proactive tax planning advice",
    ],
  },
  {
    id: "consultation_boundaries",
    message: "What is included in the £99 accountant consultation?",
    expect_any: ["30", "google meet"],
    reject_any: ["includes a written report", "includes bookkeeping"],
  },
  {
    id: "lowest_sa_simple",
    message:
      "I am a first-time sole trader with simple income. Which Self Assessment package should I choose?",
    expect_any: ["simple", "119"],
    reject_any: ["mtd starter"],
  },
  {
    id: "landlord_mtd_comply",
    message:
      "I am a landlord needing Making Tax Digital. What is the lowest suitable Simbian plan?",
    expect_any: ["comply", "29.99"],
    reject_any: ["mtd starter"],
  },
  {
    id: "signup_links",
    message: "Where do I sign up for Self Assessment or MTD packages?",
    expect_any: ["taxsimba.co.uk"],
    reject_any: ["payment confirmed"],
  },
];

async function main() {
  process.env.CONCIERGE_FORCE_MOCK_LLM = "false";
  const settings = createSettings();
  if (!settings.openaiApiKey) {
    console.error("OPENAI_API_KEY missing");
    process.exit(2);
  }
  const llm = buildLlmAdapter(settings);
  const engine = new ConversationalEngine({ llm, settings });
  const results = [];
  for (const c of CASES) {
    const res = await engine.handle({
      message: c.message,
      session_id: `owner-probe-${c.id}`,
      tax_year: "2025-26",
    });
    const reply = String(res.reply || "");
    const lower = reply.toLowerCase();
    const expectOk = (c.expect_any || []).every((s) => lower.includes(s));
    const rejectHit = (c.reject_any || []).find((s) => lower.includes(s));
    const pass = expectOk && !rejectHit;
    results.push({
      id: c.id,
      pass,
      expectOk,
      rejectHit: rejectHit || null,
      reply_excerpt: reply.slice(0, 500),
    });
    console.log(`${pass ? "PASS" : "FAIL"} ${c.id}`);
  }
  const summary = {
    generated_at: new Date().toISOString(),
    passed: results.filter((r) => r.pass).length,
    total: results.length,
    results,
  };
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(summary, null, 2));
  console.log(`Wrote ${OUT}`);
  console.log(`${summary.passed}/${summary.total} passed`);
  process.exit(summary.passed === summary.total ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(3);
});
