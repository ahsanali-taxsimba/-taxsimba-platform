/**
 * Resume multi-turn + score-20 after single-500 completed.
 * Shorter timeouts; progress every journey; checkpoint every 5.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createSettings } from "../src/config/settings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(
  __dirname,
  "../../docs/verification/simba_v2_quality_proof/evidence/general_intelligence_blind600",
);

type Turn = { role: "user" | "assistant"; content: string };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postChat(
  app: any,
  body: { session_id: string; message: string; history: Turn[] },
) {
  for (let i = 0; i < 4; i++) {
    try {
      const res = await request(app)
        .post("/api/v1/chat")
        .send(body)
        .timeout({ deadline: 25000, response: 25000 });
      if (res.status === 200) return res;
      if (res.status === 429 || res.status >= 500) {
        await sleep(Math.min(15000, 800 * 2 ** i));
        continue;
      }
      return res;
    } catch {
      await sleep(Math.min(15000, 800 * 2 ** i));
    }
  }
  return null;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const live = process.env.LIVE !== "0";
  const app = createApp(
    createSettings({ CONCIERGE_FORCE_MOCK_LLM: live ? false : true }),
  );

  const multiPack = JSON.parse(
    readFileSync(path.join(OUT, "BLIND_100_MULTI_SCENARIOS.json"), "utf8"),
  );
  const multi = multiPack.scenarios as Array<{
    id: string;
    title: string;
    turns: string[];
    expected_outcome: string;
    adversarial?: boolean;
  }>;

  const mResults: any[] = [];
  for (let i = 0; i < multi.length; i++) {
    const s = multi[i]!;
    const history: Turn[] = [];
    const transcript: Turn[] = [];
    let lastPkgs: string[] = [];
    for (const msg of s.turns) {
      const res = await postChat(app, {
        session_id: `gi100-${s.id}`,
        message: msg,
        history,
      });
      const body = res?.body || {};
      const reply = String(body.reply || "[NO_REPLY_TIMEOUT]");
      lastPkgs = (body.packages || []).map((p: any) => p.code || p.name || p);
      transcript.push({ role: "user", content: msg });
      transcript.push({ role: "assistant", content: reply });
      history.push({ role: "user", content: msg });
      history.push({ role: "assistant", content: reply });
      await sleep(live ? 40 : 5);
    }
    const asst = transcript.filter((t) => t.role === "assistant");
    const memoryDefect =
      asst.filter((t) =>
        /are you self-?employ|are you a landlord|how much did you earn/i.test(
          t.content,
        ),
      ).length >= 3;
    const noBuy = /no package|dont want|don't want|refuse|no buy|dont sell|no sell|no signup/i.test(
      s.turns.join(" "),
    );
    mResults.push({
      id: s.id,
      title: s.title,
      expected_outcome: s.expected_outcome,
      turns: s.turns.length,
      transcript_unedited: transcript,
      final_packages: lastPkgs,
      memory_defect: memoryDefect,
      premature_on_nobuy: noBuy && lastPkgs.length > 0,
      timeouts: asst.filter((t) => t.content.includes("[NO_REPLY_TIMEOUT]")).length,
      adversarial: s.adversarial,
    });
    console.error(`multi ${i + 1}/${multi.length} ${s.id}`);
    if ((i + 1) % 5 === 0) {
      writeFileSync(
        path.join(OUT, "BLIND_100_MULTI_RESULTS.checkpoint.json"),
        JSON.stringify(
          { generated_at: new Date().toISOString(), completed: mResults.length, results: mResults },
          null,
          2,
        ),
      );
    }
  }

  writeFileSync(
    path.join(OUT, "BLIND_100_MULTI_RESULTS.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        live,
        metrics: {
          total: mResults.length,
          deep_8plus: mResults.filter((r) => r.turns >= 8).length,
          memory_defects: mResults.filter((r) => r.memory_defect).length,
          premature_on_nobuy: mResults.filter((r) => r.premature_on_nobuy).length,
          timeouts: mResults.reduce((a, r) => a + (r.timeouts || 0), 0),
        },
        results: mResults,
      },
      null,
      2,
    ),
  );

  // Score 20 from SCORE20 in parent script shape — reload from a compact list
  const SCORE20 = JSON.parse(
    readFileSync(path.join(OUT, "SCORE20_SCENARIOS.json"), "utf8"),
  ).journeys as Array<{ id: string; title: string; turns: string[] }>;

  const scored: any[] = [];
  for (const s of SCORE20) {
    const history: Turn[] = [];
    const transcript: Turn[] = [];
    for (const msg of s.turns) {
      const res = await postChat(app, {
        session_id: `gi20-${s.id}`,
        message: msg,
        history,
      });
      const body = res?.body || {};
      const reply = String(body.reply || "[NO_REPLY_TIMEOUT]");
      transcript.push({ role: "user", content: msg });
      transcript.push({ role: "assistant", content: reply });
      history.push({ role: "user", content: msg });
      history.push({ role: "assistant", content: reply });
      await sleep(live ? 40 : 5);
    }
    scored.push({ id: s.id, title: s.title, transcript_unedited: transcript });
    console.error(`score20 ${s.id}`);
  }

  const md = [`# 20 representative unedited conversations`, ``];
  for (const j of scored) {
    md.push(`## ${j.id} — ${j.title}`, ``);
    for (const t of j.transcript_unedited) {
      md.push(`**${t.role === "user" ? "Customer" : "SIMBA"}:** ${t.content}`, ``);
    }
    md.push(`---`, ``);
  }
  writeFileSync(path.join(OUT, "SCORE20_UNEDITED.md"), md.join("\n"));
  writeFileSync(
    path.join(OUT, "SCORE20_JOURNEYS.json"),
    JSON.stringify({ generated_at: new Date().toISOString(), journeys: scored }, null, 2),
  );

  const single = JSON.parse(
    readFileSync(path.join(OUT, "BLIND_500_RESULTS.json"), "utf8"),
  );
  const summary = {
    generated_at: new Date().toISOString(),
    live,
    single_500: single.metrics,
    multi_100: {
      total: mResults.length,
      deep_8plus: mResults.filter((r) => r.turns >= 8).length,
      memory_defects: mResults.filter((r) => r.memory_defect).length,
      premature_on_nobuy: mResults.filter((r) => r.premature_on_nobuy).length,
    },
  };
  writeFileSync(path.join(OUT, "SUMMARY.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
