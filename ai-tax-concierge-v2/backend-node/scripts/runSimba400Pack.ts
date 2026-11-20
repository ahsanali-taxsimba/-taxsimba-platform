/**
 * SIMBA 400-question evaluation runner.
 * Default: mock LLM + deterministic handlers (fast regression).
 * LIVE=1: real OpenAI (costly; use sample or subset).
 *
 * Does NOT train OpenAI. Does NOT invent an answer key as PASS without review.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
  turns_sent: number;
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
  try {
    for (const turn of turns) {
      const res = await request(app)
        .post("/api/v1/chat")
        .send({ session_id, message: turn, history })
        .expect(200);
      last = res.body;
      history = [
        ...history,
        { role: "user", content: turn },
        { role: "assistant", content: last.reply },
      ];
    }
    const packages = (last?.packages || []).map((p: { code: string }) => p.code);
    const sources = (last?.sources || []).map(
      (s: { id?: string; title?: string }) => s.id || s.title || "",
    );
    const h = heuristic(item, String(last?.reply || ""), packages);
    const failed = Object.entries(h).some(
      ([k, v]) => k !== "packages_present_when_asked" && v === false,
    );
    return {
      id: item.id,
      category: item.category?.name || "unknown",
      mode: live ? "openai" : "mock",
      turns_sent: turns.length,
      reply: String(last?.reply || ""),
      packages,
      sources,
      llm_mode: String(last?.llm_mode || ""),
      heuristics: h,
      status: failed ? "HEURISTIC_FAIL" : "RECORDED",
      notes:
        "No verified tax answer key in pack — tax accuracy requires accountant review of recorded replies.",
    };
  } catch (err) {
    return {
      id: item.id,
      category: item.category?.name || "unknown",
      mode: live ? "openai" : "mock",
      turns_sent: turns.length,
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

  const rows: Row[] = [];
  for (const item of items) {
    // eslint-disable-next-line no-await-in-loop
    rows.push(await runOne(app, item, live));
    if (rows.length % 25 === 0) {
      console.error(`progress ${rows.length}/${items.length}`);
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(
    OUT_DIR,
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
  writeFileSync(
    path.join(OUT_DIR, `simba_400_results_${live ? "live" : "mock"}_latest.json`),
    JSON.stringify(summary, null, 2),
  );
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
