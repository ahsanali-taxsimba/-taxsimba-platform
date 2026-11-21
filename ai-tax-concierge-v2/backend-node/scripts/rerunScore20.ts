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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postChat(app: any, body: any) {
  for (let i = 0; i < 5; i++) {
    try {
      const res = await request(app)
        .post("/api/v1/chat")
        .send(body)
        .timeout({ deadline: 60000, response: 60000 });
      if (res.status === 200) return res;
      await sleep(Math.min(20000, 1000 * 2 ** i));
    } catch {
      await sleep(Math.min(20000, 1000 * 2 ** i));
    }
  }
  return null;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const app = createApp(createSettings({ CONCIERGE_FORCE_MOCK_LLM: false }));
  const SCORE20 = JSON.parse(readFileSync(path.join(OUT, "SCORE20_SCENARIOS.json"), "utf8"))
    .journeys as Array<{ id: string; title: string; turns: string[] }>;
  const scored: any[] = [];
  for (const s of SCORE20) {
    const history: Turn[] = [];
    const transcript: Turn[] = [];
    for (const msg of s.turns) {
      const res = await postChat(app, {
        session_id: `gi20b-${s.id}`,
        message: msg,
        history,
      });
      const reply = String(res?.body?.reply || "[NO_REPLY_TIMEOUT]");
      transcript.push({ role: "user", content: msg });
      transcript.push({ role: "assistant", content: reply });
      history.push({ role: "user", content: msg });
      history.push({ role: "assistant", content: reply });
      await sleep(200);
    }
    scored.push({ id: s.id, title: s.title, transcript_unedited: transcript });
    console.error(`score20 ${s.id}`);
  }
  const md = [`# 20 representative unedited conversations (re-run, 60s timeout)`, ``];
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
    JSON.stringify({ generated_at: new Date().toISOString(), note: "re-run 60s timeout", journeys: scored }, null, 2),
  );
  const timeouts = scored.reduce(
    (a, j) =>
      a +
      j.transcript_unedited.filter(
        (t: Turn) => t.role === "assistant" && String(t.content).includes("[NO_REPLY_TIMEOUT]"),
      ).length,
    0,
  );
  console.log(JSON.stringify({ journeys: scored.length, timeouts }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
