/**
 * Surgical correction evidence: live multi-turn memory + wording checks.
 * LIVE=1 uses OpenAI; otherwise mock (label clearly — do not call mock “live”).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createSettings } from "../src/config/settings.js";
import { answerSaEligibility } from "../src/knowledge/sa_eligibility.js";
import { answerAmbiguousIntent } from "../src/knowledge/intent_clarifier.js";
import { answerMtdEligibility } from "../src/knowledge/mtd_eligibility.js";
import { answerMtdOperationsQuestion } from "../src/knowledge/mtd_operations.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(
  __dirname,
  "../../docs/verification/simba_v2_quality_proof/evidence/surgical_memory_wording",
);

type Turn = { role: "user" | "assistant"; content: string };

async function postChat(
  app: any,
  session_id: string,
  message: string,
  history: Turn[],
) {
  for (let i = 0; i < 4; i++) {
    try {
      const res = await request(app)
        .post("/api/v1/chat")
        .send({ session_id, message, history })
        .timeout({ deadline: 90000, response: 90000 });
      if (res.status === 200 && String(res.body?.reply || "").trim()) return res;
      await new Promise((r) => setTimeout(r, 1500 * 2 ** i));
    } catch {
      await new Promise((r) => setTimeout(r, 1500 * 2 ** i));
    }
  }
  return null;
}

async function runJourney(
  app: any,
  id: string,
  title: string,
  userTurns: string[],
) {
  const history: Turn[] = [];
  const transcript: Turn[] = [];
  for (let i = 0; i < userTurns.length; i++) {
    const msg = userTurns[i]!;
    const res = await postChat(app, `surg-${id}-${i}`, msg, history);
    const reply = String(res?.body?.reply || "");
    const packages = (res?.body?.packages || []).map(
      (p: any) => p.code || p.name || p,
    );
    transcript.push({ role: "user", content: msg });
    transcript.push({ role: "assistant", content: reply });
    history.push({ role: "user", content: msg });
    history.push({ role: "assistant", content: reply });
    if (packages.length) {
      transcript.push({
        role: "assistant",
        content: `[packages: ${packages.join(", ")}]`,
      });
    }
  }
  return { id, title, transcript_unedited: transcript };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const live = process.env.LIVE === "1";
  process.env.OPENAI_DAILY_TOKEN_BUDGET =
    process.env.OPENAI_DAILY_TOKEN_BUDGET || "2000000";
  const app = createApp(
    createSettings({ CONCIERGE_FORCE_MOCK_LLM: live ? false : true }),
  );

  // Deterministic before/after for the known memory defect (no LLM required).
  const defectHistory = [
    { role: "user" as const, content: "hi I work as a roofer" },
    { role: "assistant" as const, content: "Hello!" },
    { role: "user" as const, content: "also a bit of side cash" },
    { role: "assistant" as const, content: "ok" },
    { role: "user" as const, content: "main job PAYE around 32k" },
    { role: "assistant" as const, content: "ok" },
    { role: "user" as const, content: "side maybe £1675" },
    { role: "assistant" as const, content: "casual or trading?" },
    { role: "user" as const, content: "side was 2025-26 before expenses" },
    {
      role: "assistant" as const,
      content:
        "Since your side income of £1,675 from roofing in the 2025-26 tax year exceeds the £1,000 threshold, you will need to register for Self Assessment.",
    },
  ];
  const saAfter = answerSaEligibility("sa?", defectHistory);
  const mtdAfter = answerMtdEligibility("mtd?", defectHistory);
  const saEdu = answerAmbiguousIntent(
    "what even is self assessment without the jargon",
  );
  const mtdEdu = answerAmbiguousIntent(
    "tell me about making tax digital for income tax please",
  );
  const mtdAnnual = answerMtdOperationsQuestion(
    "do quarterly updates replace the tax return under MTD?",
  );
  const mtdQiWording = answerMtdEligibility(
    "rent £12,400 + freelance £19,800 2025-26 before expenses. qi for mtd?",
  );

  const journeysSpec: Array<{ id: string; title: string; turns: string[] }> = [
    {
      id: "J01",
      title: "PAYE + side → SA → MTD",
      turns: [
        "hi I work as a roofer",
        "also a bit of side cash",
        "main job PAYE around 32k",
        "side maybe £1675",
        "regular trading — side was 2025-26 before expenses",
        "sa?",
        "mtd?",
      ],
    },
    {
      id: "J02",
      title: "property + freelance QI",
      turns: [
        "rent £12,400 + freelance £19,800 2025-26 before expenses. qi for mtd?",
      ],
    },
    {
      id: "J03",
      title: "customer changes income amount",
      turns: [
        "freelance £2,000 2025-26 before expenses — sa?",
        "sorry — freelance was actually £900 before expenses 2025-26",
        "sa?",
      ],
    },
    {
      id: "J04",
      title: "customer corrects tax year",
      turns: [
        "qualifying income £55,000 turnover before expenses 2024-25 — mtd?",
        "actually that £55,000 was for 2025-26 not 2024-25",
        "mtd?",
      ],
    },
    {
      id: "J05",
      title: "second income source later",
      turns: [
        "freelance £19,800 before expenses 2025-26",
        "also rent £12,400 before expenses same year — qi for mtd?",
      ],
    },
    {
      id: "J06",
      title: "PAYE-only MTD",
      turns: ["PAYE-only £46k — making tax digital?"],
    },
    {
      id: "J07",
      title: "marketplace personal possessions",
      turns: ["sold random stuff on depop from the cupboard — in trouble?"],
    },
    {
      id: "J08",
      title: "future business intention",
      turns: [
        "thinking of starting garage clear-outs — do I need sa before I begin?",
      ],
    },
    {
      id: "J09",
      title: "what is Self Assessment?",
      turns: ["what even is self assessment without the jargon"],
    },
    {
      id: "J10",
      title: "what is MTD?",
      turns: ["tell me about making tax digital for income tax please"],
    },
    {
      id: "J11",
      title: "no package recommendation",
      turns: [
        "I refuse packages. contracting £3,050 2025-26 before expenses — sa?",
      ],
    },
    {
      id: "J12",
      title: "later asks cheapest SA package",
      turns: [
        "dont sell me anything — sole trader £6,800 before expenses 2024-25 — file?",
        "ok what's the cheapest sa package",
      ],
    },
    {
      id: "J13",
      title: "TaxSimba service vs independent software",
      turns: [
        "does simbian monthly already include xero or separate?",
        "what if I just want independent xero myself",
      ],
    },
    {
      id: "J14",
      title: "compact→full continuity (session history)",
      turns: [
        "PAYE job plus freelance about £8,000 before expenses for 2025-26",
        "Do I need to register for Self Assessment?",
      ],
    },
    {
      id: "J15",
      title: "long then short sa?/mtd?",
      turns: [
        "landlord rent £15,200 2025-26",
        "also a bit of freelance on the side maybe £2,200 before expenses same year",
        "regular trading",
        "sa?",
        "mtd?",
      ],
    },
  ];

  const journeys = [];
  for (const j of journeysSpec) {
    console.error("run", j.id, j.title);
    journeys.push(await runJourney(app, j.id, j.title, j.turns));
  }

  const report = {
    generated_at: new Date().toISOString(),
    live_openai: live,
    mock_mode: !live,
    note: live
      ? "Live OpenAI execution for journey turns below."
      : "MOCK evaluation only — do not treat as live-verified.",
    deterministic: {
      memory_defect_after: {
        input_followup: "sa?",
        trading_income_gbp: saAfter?.trading_income_gbp ?? null,
        must_usually_file: saAfter?.must_usually_file ?? null,
        needs_more_info: saAfter?.needs_more_info ?? null,
        reply_unedited: saAfter?.customer_reply ?? null,
      },
      mtd_followup_after: {
        input_followup: "mtd?",
        in_scope: mtdAfter?.in_scope ?? null,
        reply_unedited: mtdAfter?.customer_reply ?? null,
      },
      general_sa_after: saEdu?.customer_reply ?? null,
      general_mtd_after: mtdEdu?.customer_reply ?? null,
      mtd_annual_return_ops_after: mtdAnnual,
      mtd_qi_annual_return_wording: mtdQiWording?.customer_reply ?? null,
    },
    journeys,
  };

  writeFileSync(path.join(OUT, "EVIDENCE.json"), JSON.stringify(report, null, 2));

  const md: string[] = [];
  md.push("# Surgical memory + wording evidence");
  md.push("");
  md.push(`Generated: ${report.generated_at}`);
  md.push(
    live
      ? "**Mode: LIVE OpenAI**"
      : "**Mode: MOCK — not live-verified**",
  );
  md.push("");
  md.push("## Before / after — memory defect (`sa?`)");
  md.push("");
  md.push("**Before (from blind_v3 VJ006 evidence):** after establishing £1,675 / 2025-26, `sa?` re-asked amount and tax year.");
  md.push("");
  md.push("**After (deterministic SA handler):**");
  md.push("");
  md.push("```");
  md.push(saAfter?.customer_reply || "(null)");
  md.push("```");
  md.push("");
  md.push(`needs_more_info=${saAfter?.needs_more_info} trading_income_gbp=${saAfter?.trading_income_gbp} must_usually_file=${saAfter?.must_usually_file}`);
  md.push("");
  md.push("## General Self Assessment answer (after)");
  md.push("");
  md.push("```");
  md.push(saEdu?.customer_reply || "(null)");
  md.push("```");
  md.push("");
  md.push("## MTD annual-return wording (after)");
  md.push("");
  md.push("### Operations question");
  md.push("```");
  md.push(mtdAnnual || "(null)");
  md.push("```");
  md.push("");
  md.push("### Educational MTD");
  md.push("```");
  md.push(mtdEdu?.customer_reply || "(null)");
  md.push("```");
  md.push("");
  md.push("## Live/mock journeys (unedited)");
  for (const j of journeys) {
    md.push("");
    md.push(`### ${j.id} — ${j.title}`);
    for (const t of j.transcript_unedited) {
      md.push("");
      md.push(`**${t.role.toUpperCase()}:**`);
      md.push(t.content);
    }
  }
  writeFileSync(path.join(OUT, "EVIDENCE.md"), md.join("\n"));
  console.log(
    JSON.stringify(
      {
        generated_at: report.generated_at,
        live_openai: live,
        journeys: journeys.length,
        sa_memory_ok:
          saAfter?.needs_more_info === false &&
          saAfter?.trading_income_gbp === 1675,
        out: OUT,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
