#!/usr/bin/env tsx
/**
 * 20 live OpenAI-backed multi-turn customer journeys.
 * Exit 2 if OPENAI_API_KEY missing / mock forced.
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

type Journey = {
  id: string;
  title: string;
  turns: string[];
  expect_final_any?: string[];
  reject_any?: string[];
};

const JOURNEYS: Journey[] = [
  {
    id: "LJ-01",
    title: "Self Assessment first-time filer → Simple",
    turns: [
      "Do I need to send a Self Assessment tax return if I started freelancing this year?",
      "It is simple income, first time — what is the cheapest suitable package?",
      "Ok I’m ready to register",
    ],
    expect_final_any: ["119", "simple", "self-assessment", "register"],
  },
  {
    id: "LJ-02",
    title: "MTD exact £50k then correction to £55k",
    turns: [
      "My qualifying income was exactly £50,000 in 2024-25. Do I need MTD from April 2026?",
      "Sorry — it was actually £55,000 qualifying income in 2024-25",
    ],
    expect_final_any: ["6 april 2026", "april 2026"],
  },
  {
    id: "LJ-03",
    title: "Freelancer package compare",
    turns: [
      "I’m a freelancer with a few clients — Self Assessment or MTD?",
      "Turnover about £22,000 in 2025-26 before expenses",
    ],
    expect_final_any: ["self assessment", "making tax", "qualifying", "22"],
  },
  {
    id: "LJ-04",
    title: "Landlord + PAYE",
    turns: [
      "I have a PAYE salary of £40,000 and £25,000 rental income turnover in 2025-26. Do I need MTD?",
      "What Self Assessment package would fit a single residential let plus salary?",
    ],
    expect_final_any: ["paye", "25,000", "self assessment", "119", "149"],
  },
  {
    id: "LJ-05",
    title: "PAYE plus self-employment",
    turns: [
      "I earn £45,000 PAYE and £18,000 sole-trader turnover. Do I need Making Tax Digital?",
      "So which package for the side income only?",
    ],
    expect_final_any: ["18", "paye", "119", "simple", "self assessment"],
  },
  {
    id: "LJ-06",
    title: "Limited company director",
    turns: [
      "I am a limited company director. Company turnover is over £100,000. When do I need Making Tax Digital for Income Tax?",
      "I also take a PAYE salary from the company",
    ],
    expect_final_any: ["limited compan", "paye", "self assessment", "compan"],
  },
  {
    id: "LJ-07",
    title: "Crypto",
    turns: [
      "I trade crypto",
      "I sold some bitcoin for a gain last year — Self Assessment?",
    ],
    expect_final_any: ["crypto", "capital gains", "self assessment", "gain"],
  },
  {
    id: "LJ-08",
    title: "CIS construction",
    turns: [
      "I’m a CIS subcontractor — which Self Assessment package?",
      "Also, do I need MTD?",
    ],
    expect_final_any: ["cis", "self assessment", "qualifying", "turnover", "119", "smart"],
  },
  {
    id: "LJ-09",
    title: "Multiple income sources",
    turns: [
      "I have employment, a small freelance side, and one rental property",
      "Keep it simple — lowest suitable package please",
    ],
    expect_final_any: ["self assessment", "119", "149", "smart", "simple"],
  },
  {
    id: "LJ-10",
    title: "Existing accountant",
    turns: [
      "I already have an accountant",
      "Just explain the SA online deadline for 2025-26 — no sales",
    ],
    expect_final_any: ["january"],
    reject_any: ["you must buy"],
  },
  {
    id: "LJ-11",
    title: "Package comparison Simbian",
    turns: [
      "What’s the difference between Simbian Comply and Growth?",
      "Does either include free Xero Grow forever?",
    ],
    expect_final_any: ["xero", "29.99", "59.99"],
    reject_any: ["xero grow forever"],
  },
  {
    id: "LJ-12",
    title: "Buy immediately",
    turns: [
      "I’m ready to sign up for Self Assessment Simple now — give me the link",
    ],
    expect_final_any: ["self-assessment", "register", "119"],
  },
  {
    id: "LJ-13",
    title: "Information only",
    turns: [
      "Don’t sell me anything. When is the Self Assessment online filing deadline for 2025-26?",
      "Thanks, that’s all",
    ],
    expect_final_any: ["january"],
  },
  {
    id: "LJ-14",
    title: "Challenge answer",
    turns: [
      "Is the VAT threshold still £85,000?",
      "Are you sure? I’ve seen £85k online",
    ],
    expect_final_any: ["90"],
    reject_any: ["still £85,000"],
  },
  {
    id: "LJ-15",
    title: "Change circumstances mid-conversation",
    turns: [
      "Qualifying income £28,000 in 2025-26 — MTD?",
      "Actually wait — it was £35,000 qualifying income in 2025-26",
    ],
    expect_final_any: ["6 april 2027", "april 2027"],
  },
  {
    id: "LJ-16",
    title: "Free callback refused → email/consult",
    turns: [
      "Can I get a free accountant callback?",
      "What’s the £99 option then?",
    ],
    expect_final_any: ["99", "20", "info@taxsimba.co.uk"],
    reject_any: ["free callback is available"],
  },
  {
    id: "LJ-17",
    title: "Extended consultation £149",
    turns: [
      "I need a longer accountant consultation for a complex situation",
      "Tell me about the £149 option",
    ],
    expect_final_any: ["149", "40"],
    reject_any: ["30-minute", "30 minute"],
  },
  {
    id: "LJ-18",
    title: "Ambiguous £60k",
    turns: ["I earn £60,000.", "It’s PAYE salary only"],
    expect_final_any: ["paye"],
  },
  {
    id: "LJ-19",
    title: "Online selling clarification",
    turns: [
      "I sell things online",
      "It’s an Etsy shop buying materials and selling handmade goods, turnover about £15,000",
    ],
    expect_final_any: ["self assessment", "sole", "15", "trade"],
  },
  {
    id: "LJ-20",
    title: "Guarantee refund refused",
    turns: [
      "If I buy Elite will you guarantee a tax refund?",
      "Ok just explain packages without guarantees",
    ],
    expect_final_any: ["119", "299", "guarantee"],
    reject_any: ["i guarantee a refund"],
  },
];

async function main() {
  if (!process.env.OPENAI_API_KEY) {
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
  if (llm.mode !== "openai") {
    console.error("BLOCKED: adapter mode is", llm.mode);
    process.exit(2);
  }
  const engine = new ConversationalEngine({ llm, settings });

  const conversations: Array<Record<string, unknown>> = [];
  let passed = 0;
  let failed = 0;

  for (const j of JOURNEYS) {
    const sid = randomUUID();
    const transcript: Array<Record<string, unknown>> = [];
    const history: Array<{ role: "user" | "assistant"; content: string }> = [];
    let last = "";
    let err: string | null = null;
    const t0 = performance.now();
    try {
      for (const turn of j.turns) {
        const turnT0 = performance.now();
        const res = await engine.handle({
          session_id: sid,
          message: turn,
          tax_year: "2025-26",
          history,
        });
        last = res.reply || "";
        history.push({ role: "user", content: turn });
        history.push({ role: "assistant", content: last });
        transcript.push({
          user: turn,
          assistant: last,
          packages: (res.packages || []).map((p) => ({
            code: p.code,
            name: p.name,
            price_gbp: p.price_gbp,
          })),
          llm_mode: res.llm_mode,
          latency_ms: Math.round(performance.now() - turnT0),
          sources: (res.sources || []).slice(0, 2).map((s) => ({
            id: s.id,
            title: s.title,
            url: s.url,
          })),
        });
      }
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
    // Score the whole journey transcript, not only the last courtesy turn —
    // otherwise info-only closers ("Thanks") false-fail on earlier correct answers.
    const journeyText = transcript
      .map((t) => String(t.assistant || ""))
      .join("\n")
      .toLowerCase();
    const flags: string[] = [];
    if (err) flags.push(`ERROR:${err}`);
    if ((j.expect_final_any || []).length) {
      const hit = (j.expect_final_any || []).some((n) =>
        journeyText.includes(n.toLowerCase()),
      );
      if (!hit) flags.push(`EXPECT_MISS:${(j.expect_final_any || []).join("|")}`);
    }
    for (const n of j.reject_any || []) {
      if (journeyText.includes(n.toLowerCase())) flags.push(`REJECT_HIT:${n}`);
    }
    const pass = flags.length === 0;
    if (pass) passed += 1;
    else failed += 1;
    conversations.push({
      id: j.id,
      title: j.title,
      result: pass ? "PASS" : "FAIL",
      flags,
      total_ms: Math.round(performance.now() - t0),
      obtained_via: "real_openai_api",
      llm_mode: llm.mode,
      model: settings.openaiModel,
      transcript,
    });
    console.log(`${pass ? "PASS" : "FAIL"} ${j.id} ${j.title}`);
  }

  const summary = {
    generated_at: new Date().toISOString(),
    obtained_via: "real_openai_api",
    model: settings.openaiModel,
    llm_mode: llm.mode,
    total: JOURNEYS.length,
    passed,
    failed,
  };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    path.join(OUT, "live_openai_journeys_20.json"),
    JSON.stringify({ summary, conversations }, null, 2),
  );
  writeFileSync(
    path.join(OUT, "live_openai_journeys_20_summary.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log(JSON.stringify(summary, null, 2));
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(3);
});
