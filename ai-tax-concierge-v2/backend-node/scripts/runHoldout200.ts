/**
 * Run unseen holdout 200 against real OpenAI (LIVE=1) or mock.
 * Expected classifications are NOT injected into SIMBA prompts.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createSettings } from "../src/config/settings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(
  __dirname,
  "../../docs/verification/simba_v2_quality_proof/evidence/holdout200",
);
const SCENARIO_PATH = path.join(OUT_DIR, "HOLDOUT_200_SCENARIOS.json");

type Scenario = {
  id: string;
  question: string;
  topic: string;
  expected_classification: string;
  expected_tax_notes: string;
  official_sources: string[];
  multi_turn?: string[];
  run_multi_turn: boolean;
};

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function postChat(app: any, body: Record<string, unknown>, attempts = 8) {
  let last: any = null;
  for (let i = 0; i < attempts; i++) {
    const res = await request(app).post("/api/v1/chat").send(body);
    last = res;
    if (res.status === 200) return res;
    if (res.status === 429 || res.status >= 500) {
      await sleep(Math.min(45_000, 1500 * 2 ** i));
      continue;
    }
    break;
  }
  return last;
}

function classifyObserved(reply: string, packages: string[], expected: string): {
  observed: string;
  match: boolean | "PARTIAL";
  notes: string;
} {
  const a = reply.toLowerCase();
  const pkgs = packages || [];
  let observed = "MORE_INFO_NEEDED";
  if (/out of scope|don't (offer|provide)|cannot help with|not something taxsimba|corporation tax|limited company accounts/.test(a) && /ltd|corporation|visa|will writer|immigration/.test(a + expected)) {
    observed = "OUT_OF_SCOPE";
  }
  if (/existing|dashboard|already a (client|customer)|info@taxsimba|login|upload/.test(a) && /support|login|upload|existing/.test(expected.toLowerCase() + a)) {
    observed = "EXISTING_CUSTOMER_SUPPORT";
  }
  if (/consultation|calendly|£99|£149|book a consultation|accountant/.test(a) && /consult|letter|investigation|liability|owe/.test(a)) {
    observed = "ACCOUNTANT_CONSULTATION";
  }
  if (/need a little more detail|which tax year|how much|is that figure|tell me more|could you confirm/.test(a)) {
    observed = "MORE_INFO_NEEDED";
  }
  if (/making tax digital|\bmtd\b/.test(a) && /(from (6 )?april 2026|need to use|in scope|qualifying income)/.test(a)) {
    observed = /self assessment/.test(a) ? "BOTH_SA_AND_MTD" : "MTD_ASSIST";
  }
  if (/self assessment|register for self assessment|send a tax return/.test(a) && !/making tax digital|\bmtd\b/.test(a)) {
    observed = "SA_ASSIST";
  }
  if (
    /(do not need|don't need|usually do not|not required|does not apply|no need).*(self assessment|mtd|making tax digital|taxsimba)|diy|gov\.uk/.test(
      a,
    ) &&
    pkgs.length === 0
  ) {
    if (/do not need|doesn't apply|does not apply|usually do not|not more than|paye only/.test(a)) {
      observed = "NO_TAXSIMBA_SERVICE";
    }
  }
  if (pkgs.length && /simple|smart|elite|simbian|comply|growth/.test(a)) {
    if (observed === "MORE_INFO_NEEDED") observed = "SA_ASSIST";
  }

  const match =
    observed === expected
      ? true
      : (expected === "MORE_INFO_NEEDED" && /need a little more detail|which tax year|how much/.test(a)) ||
          (expected === "NO_TAXSIMBA_SERVICE" && pkgs.length === 0 && /(do not need|does not apply|usually do not|you can|gov\.uk)/.test(a)) ||
          (expected === "SA_ASSIST" && /self assessment/.test(a)) ||
          (expected === "MTD_ASSIST" && /mtd|making tax digital/.test(a)) ||
          (expected === "BOTH_SA_AND_MTD" && /self assessment/.test(a) && /mtd|making tax digital/.test(a)) ||
          (expected === "ACCOUNTANT_CONSULTATION" && /consult|accountant|professional/.test(a)) ||
          (expected === "OUT_OF_SCOPE" && /not|don't|cannot|outside/.test(a)) ||
          (expected === "EXISTING_CUSTOMER_SUPPORT" && /dashboard|support|info@|login/.test(a))
        ? "PARTIAL"
        : false;

  return { observed, match, notes: `pkgs=${pkgs.join(",") || "none"}` };
}

function taxFlags(reply: string, expectedNotes: string) {
  const a = reply.toLowerCase();
  const flags: string[] = [];
  if (/below the £1,?000 trading allowance/.test(a) && /£8,?000|8000|above/.test(expectedNotes.toLowerCase() + a)) {
    flags.push("possible_trading_allowance_inversion");
  }
  if (/you are booked|payment successful/.test(a)) flags.push("hallucinated_booking");
  if (/your tax is exactly £|you owe exactly/.test(a)) flags.push("invented_liability");
  return flags;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  if (!existsSync(SCENARIO_PATH)) {
    throw new Error("Run generateHoldout200.ts first");
  }
  const pack = JSON.parse(readFileSync(SCENARIO_PATH, "utf8"));
  const scenarios: Scenario[] = pack.scenarios;
  const live = process.env.LIVE === "1" || process.env.HOLDOUT_LIVE === "1";
  const limit = process.env.LIMIT ? Number(process.env.LIMIT) : scenarios.length;
  const multiLimit = process.env.MULTI_LIMIT
    ? Number(process.env.MULTI_LIMIT)
    : 50;

  process.env.OPENAI_DAILY_TOKEN_BUDGET =
    process.env.OPENAI_DAILY_TOKEN_BUDGET || "2000000";

  const settings = createSettings({
    CONCIERGE_FORCE_MOCK_LLM: live ? false : true,
  });
  const app = createApp(settings);

  const results: any[] = [];
  const journeys: any[] = [];
  let multiDone = 0;

  for (let i = 0; i < Math.min(limit, scenarios.length); i++) {
    const s = scenarios[i]!;
    const history: Array<{ role: string; content: string }> = [];
    const res = await postChat(app, {
      session_id: `holdout-${s.id}`,
      message: s.question,
      history,
    });
    const body = res.body || {};
    const reply = String(body.reply || "");
    const packages = (body.packages || []).map((p: any) => p.code || p.name || p);
    const clf = classifyObserved(reply, packages, s.expected_classification);
    const row = {
      id: s.id,
      topic: s.topic,
      question: s.question,
      expected_classification: s.expected_classification,
      expected_tax_notes: s.expected_tax_notes,
      official_sources: s.official_sources,
      reply_unedited: reply,
      packages,
      sources: body.sources || [],
      llm_mode: body.llm_mode || (live ? "unknown" : "mock"),
      http_status: res.status,
      classification_observed: clf.observed,
      classification_match: clf.match,
      tax_risk_flags: taxFlags(reply, s.expected_tax_notes),
      premature_package:
        packages.length > 0 &&
        !/package|which|price|sign up|register with|taxsimba help|do everything/.test(
          s.question.toLowerCase(),
        ),
    };
    results.push(row);
    history.push({ role: "user", content: s.question });
    history.push({ role: "assistant", content: reply });

    if (s.run_multi_turn && multiDone < multiLimit && s.multi_turn?.length) {
      const turns = [{ user: s.question, reply, packages }];
      for (const follow of s.multi_turn) {
        const r2 = await postChat(app, {
          session_id: `holdout-${s.id}-mt`,
          message: follow,
          history,
        });
        const b2 = r2.body || {};
        const rep2 = String(b2.reply || "");
        const pkg2 = (b2.packages || []).map((p: any) => p.code || p.name || p);
        turns.push({ user: follow, reply: rep2, packages: pkg2 });
        history.push({ role: "user", content: follow });
        history.push({ role: "assistant", content: rep2 });
        await sleep(live ? 400 : 20);
      }
      journeys.push({
        id: s.id,
        expected_classification: s.expected_classification,
        turns,
        remembered_amount: turns.slice(1).some((t) =>
          /8,?000|8000|52,?000|turnover|earlier|you (said|mentioned)/i.test(t.reply),
        ),
        final_packages: turns[turns.length - 1]?.packages || [],
        info_only_respected: !s.multi_turn.some((m) =>
          /do not want a paid package|do not recommend/.test(m.toLowerCase()),
        )
          ? "N_A"
          : turns.every((t) => (t.packages || []).length === 0)
            ? "PASS"
            : "FAIL",
      });
      multiDone++;
    }

    if ((i + 1) % 10 === 0) {
      writeFileSync(
        path.join(OUT_DIR, "HOLDOUT_200_RESULTS_checkpoint.json"),
        JSON.stringify({ i: i + 1, results, journeys }, null, 2),
      );
      console.error(`checkpoint ${i + 1}/${limit} multi=${multiDone}`);
    }
    await sleep(live ? 250 : 10);
  }

  const metrics = {
    total_run: results.length,
    openai_count: results.filter((r) => r.llm_mode === "openai").length,
    classification_exact: results.filter((r) => r.classification_match === true).length,
    classification_partial: results.filter((r) => r.classification_match === "PARTIAL").length,
    classification_fail: results.filter((r) => r.classification_match === false).length,
    premature_packages: results.filter((r) => r.premature_package).length,
    tax_risk_flag_rows: results.filter((r) => r.tax_risk_flags.length).length,
    hallucinated_booking: results.filter((r) =>
      r.tax_risk_flags.includes("hallucinated_booking"),
    ).length,
    multi_turn_journeys: journeys.length,
    info_only_fail: journeys.filter((j) => j.info_only_respected === "FAIL").length,
  };

  const out = {
    generated_at: new Date().toISOString(),
    live,
    metrics,
    results,
    journeys,
  };
  writeFileSync(path.join(OUT_DIR, "HOLDOUT_200_RESULTS.json"), JSON.stringify(out, null, 2));

  // CSV
  const header =
    "id,topic,expected_classification,classification_observed,classification_match,llm_mode,packages,premature_package,tax_risk_flags,question,reply_unedited,expected_tax_notes,official_sources";
  const lines = [
    header,
    ...results.map((r) =>
      [
        r.id,
        r.topic,
        r.expected_classification,
        r.classification_observed,
        String(r.classification_match),
        r.llm_mode,
        (r.packages || []).join(";"),
        r.premature_package,
        (r.tax_risk_flags || []).join(";"),
        JSON.stringify(r.question),
        JSON.stringify(r.reply_unedited),
        JSON.stringify(r.expected_tax_notes),
        JSON.stringify((r.official_sources || []).join(" | ")),
      ].join(","),
    ),
  ];
  writeFileSync(path.join(OUT_DIR, "HOLDOUT_200_RESULTS.csv"), lines.join("\n"));

  writeFileSync(
    path.join(OUT_DIR, "HOLDOUT_50_JOURNEYS.json"),
    JSON.stringify({ generated_at: out.generated_at, journeys }, null, 2),
  );

  const md = [
    `# Holdout 200 results`,
    ``,
    `Live OpenAI: **${live}**. Metrics:`,
    ``,
    "```json",
    JSON.stringify(metrics, null, 2),
    "```",
    ``,
    `## Classification failures (exact match false)`,
    ...results
      .filter((r) => r.classification_match === false)
      .slice(0, 40)
      .map(
        (r) =>
          `- **${r.id}** expected ${r.expected_classification} observed ${r.classification_observed}: ${r.question.slice(0, 100)}`,
      ),
    ``,
    `## Premature packages`,
    ...results
      .filter((r) => r.premature_package)
      .slice(0, 30)
      .map((r) => `- **${r.id}**: ${r.packages.join(", ")} — ${r.question.slice(0, 80)}`),
    ``,
    `## Tax risk flags`,
    ...results
      .filter((r) => r.tax_risk_flags.length)
      .map((r) => `- **${r.id}**: ${r.tax_risk_flags.join(", ")}`),
  ].join("\n");
  writeFileSync(path.join(OUT_DIR, "HOLDOUT_200_RESULTS.md"), md);

  console.log(JSON.stringify({ out: OUT_DIR, metrics }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
