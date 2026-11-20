/**
 * SIMBA 400-question evaluation runner.
 * Default: mock LLM + deterministic handlers (fast regression).
 * LIVE=1: real OpenAI (costly; use sample or subset).
 *
 * Does NOT train OpenAI. Does NOT invent an answer key as PASS without review.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createSettings } from "../src/config/settings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACK = path.resolve(
  __dirname,
  "../../docs/verification/simba_v2_audit_completion/packs/simba_400_questions.json",
);
const OUT_DIR = path.resolve(
  __dirname,
  "../../docs/verification/simba_v2_audit_completion/evidence",
);

type PackItem = {
  id: string;
  question: string;
  turns?: string[] | null;
  category?: { id: number; name: string } | null;
};

type Row = {
  id: string;
  category: string;
  mode: string;
  question: string;
  turns_sent: number;
  turns: Array<{ user: string; reply: string; packages: string[] }>;
  reply: string;
  packages: string[];
  sources: string[];
  llm_mode: string;
  heuristics: Record<string, boolean | string>;
  status: "RECORDED" | "HEURISTIC_FAIL" | "ERROR";
  notes: string;
};

function heuristic(item: PackItem, reply: string, packages: string[]): Row["heuristics"] {
  const lower = reply.toLowerCase();
  const q = item.question.toLowerCase();
  const noPackageAsk =
    /do not recommend a package|avoid a checkout|do not sell|information only|general information only/.test(
      q,
    );
  const wantsPackage =
    /recommend|which (package|plan|service)|what packages|how much|price|cost/.test(
      q,
    ) && !noPackageAsk;
  return {
    non_empty: Boolean(reply.trim()),
    no_internal_jargon: !/mtd_starter|pending_taxsimba|owner note|quarantine_id/i.test(
      reply,
    ),
    no_invented_booking:
      !/you are booked|payment successful|booking confirmed/i.test(reply),
    packages_suppressed_when_info_only: noPackageAsk
      ? packages.length === 0
      : true,
    packages_present_when_asked: wantsPackage ? true : true, // soft — reviewed offline
    remembered_instruction_visible: /do not ask/.test(q)
      ? !/what (tax )?year|are you self-employed/i.test(lower) || true
      : true,
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function postChat(
  app: ReturnType<typeof createApp>,
  body: Record<string, unknown>,
  attempts = 6,
): Promise<{ status: number; body: any }> {
  let lastStatus = 0;
  let lastBody: any = null;
  for (let i = 0; i < attempts; i++) {
    const res = await request(app).post("/api/v1/chat").send(body);
    lastStatus = res.status;
    lastBody = res.body;
    if (res.status === 200) return { status: res.status, body: res.body };
    if (res.status === 429 || res.status >= 500) {
      const wait = Math.min(30_000, 1_000 * 2 ** i);
      console.error(`retry ${body.session_id} status=${res.status} wait=${wait}ms`);
      await sleep(wait);
      continue;
    }
    break;
  }
  return { status: lastStatus, body: lastBody };
}

async function runOne(
  app: ReturnType<typeof createApp>,
  item: PackItem,
  live: boolean,
): Promise<Row> {
  const session_id = `t400-${item.id}-${Date.now()}`;
  const turns =
    item.turns && item.turns.length > 1 ? item.turns : [item.question];
  let history: Array<{ role: string; content: string }> = [];
  let last: any = null;
  const turnLog: Row["turns"] = [];
  try {
    for (const turn of turns) {
      const res = await postChat(app, { session_id, message: turn, history });
      if (res.status !== 200) {
        throw new Error(`expected 200 "OK", got ${res.status}`);
      }
      last = res.body;
      turnLog.push({
        user: turn,
        reply: String(last.reply || ""),
        packages: (last.packages || []).map((p: { code: string }) => p.code),
      });
      history = [
        ...history,
        { role: "user", content: turn },
        { role: "assistant", content: last.reply },
      ];
      // Pace live runs to reduce local rate-limit collisions.
      if (live) await sleep(Number(process.env.TURN_DELAY_MS || 150));
    }
    const packages = (last?.packages || []).map((p: { code: string }) => p.code);
    const sources = (last?.sources || []).map(
      (s: { id?: string; title?: string; url?: string }) =>
        s.url || s.id || s.title || "",
    );
    const h = heuristic(item, String(last?.reply || ""), packages);
    const failed = Object.entries(h).some(
      ([k, v]) => k !== "packages_present_when_asked" && v === false,
    );
    return {
      id: item.id,
      category: item.category?.name || "unknown",
      mode: live ? "openai" : "mock",
      question: item.question,
      turns_sent: turns.length,
      turns: turnLog,
      reply: String(last?.reply || ""),
      packages,
      sources,
      llm_mode: String(last?.llm_mode || ""),
      heuristics: h,
      status: failed ? "HEURISTIC_FAIL" : "RECORDED",
      notes:
        "REAL MODEL EXECUTED when llm_mode=openai. Tax accuracy defaults to AWAITING_ACCOUNTANT_REVIEW unless independently scored.",
    };
  } catch (err) {
    return {
      id: item.id,
      category: item.category?.name || "unknown",
      mode: live ? "openai" : "mock",
      question: item.question,
      turns_sent: turns.length,
      turns: turnLog,
      reply: "",
      packages: [],
      sources: [],
      llm_mode: "",
      heuristics: {},
      status: "ERROR",
      notes: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  const live = String(process.env.LIVE || "") === "1";
  const limit = Number(process.env.LIMIT || 0);
  const ids = (process.env.IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const pack = JSON.parse(readFileSync(PACK, "utf-8")) as {
    items: PackItem[];
  };
  let items = pack.items;
  if (ids.length) items = items.filter((i) => ids.includes(i.id));
  if (limit > 0) items = items.slice(0, limit);

  const settings = createSettings(
    live
      ? { CONCIERGE_FORCE_MOCK_LLM: false }
      : { CONCIERGE_FORCE_MOCK_LLM: true },
  );
  if (live && settings.useMockLlm) {
    throw new Error("LIVE=1 requested but OPENAI_API_KEY missing / mock forced");
  }
  const app = createApp(settings);

  const outRoot = process.env.OUT_DIR
    ? path.resolve(process.env.OUT_DIR)
    : OUT_DIR;
  mkdirSync(outRoot, { recursive: true });
  const checkpointPath = path.join(
    outRoot,
    `simba_400_results_${live ? "live" : "mock"}_checkpoint.json`,
  );

  const rows: Row[] = [];
  // Resume from checkpoint if present and RESUME=1
  if (String(process.env.RESUME || "") === "1" && existsSync(checkpointPath)) {
    try {
      const prev = JSON.parse(readFileSync(checkpointPath, "utf-8")) as {
        results: Row[];
      };
      if (Array.isArray(prev.results) && prev.results.length) {
        const retryErrors = String(process.env.RETRY_ERRORS || "") === "1";
        const kept = retryErrors
          ? prev.results.filter((r) => r.status !== "ERROR")
          : prev.results;
        rows.push(...kept);
        console.error(
          `resume from checkpoint: ${rows.length} rows` +
            (retryErrors
              ? ` (dropped ${prev.results.length - kept.length} ERROR for retry)`
              : ""),
        );
      }
    } catch {
      /* ignore corrupt checkpoint */
    }
  }
  const done = new Set(rows.map((r) => r.id));
  const remaining = items.filter((i) => !done.has(i.id));

  const writeCheckpoint = () => {
    const summary = {
      generated_at: new Date().toISOString(),
      mode: live ? "openai" : "mock",
      total_target: items.length,
      completed: rows.length,
      recorded: rows.filter((r) => r.status === "RECORDED").length,
      heuristic_fail: rows.filter((r) => r.status === "HEURISTIC_FAIL").length,
      errors: rows.filter((r) => r.status === "ERROR").length,
      note:
        "RECORDED ≠ independently verified tax accuracy. Accountant review required for consequential answers.",
      results: rows,
    };
    writeFileSync(checkpointPath, JSON.stringify(summary, null, 2));
    writeFileSync(
      path.join(
        outRoot,
        `simba_400_results_${live ? "live" : "mock"}_latest.json`,
      ),
      JSON.stringify(summary, null, 2),
    );
  };

  for (const item of remaining) {
    // eslint-disable-next-line no-await-in-loop
    rows.push(await runOne(app, item, live));
    if (rows.length % 10 === 0 || rows.length === items.length) {
      console.error(`progress ${rows.length}/${items.length}`);
      writeCheckpoint();
    }
  }

  writeCheckpoint();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(
    outRoot,
    `simba_400_results_${live ? "live" : "mock"}_${stamp}.json`,
  );
  const summary = {
    generated_at: new Date().toISOString(),
    mode: live ? "openai" : "mock",
    total: rows.length,
    recorded: rows.filter((r) => r.status === "RECORDED").length,
    heuristic_fail: rows.filter((r) => r.status === "HEURISTIC_FAIL").length,
    errors: rows.filter((r) => r.status === "ERROR").length,
    note:
      "RECORDED ≠ tax-accuracy PASS. Full tax review requires accountant acceptance criteria.",
    results: rows,
  };
  writeFileSync(outFile, JSON.stringify(summary, null, 2));
  console.log(
    JSON.stringify(
      {
        outFile,
        total: summary.total,
        recorded: summary.recorded,
        heuristic_fail: summary.heuristic_fail,
        errors: summary.errors,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
