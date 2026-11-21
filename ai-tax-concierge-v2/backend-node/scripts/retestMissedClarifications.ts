/**
 * Retest prior missed-clarification / wrong-SA cases after gate fix.
 * Not used as generalisation proof.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createSettings } from "../src/config/settings.js";
import { decidePolicy } from "../src/knowledge/decision_policy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(
  __dirname,
  "../../docs/verification/simba_v2_quality_proof/evidence/generalisation_decision_policy",
);

const CASES = [
  {
    id: "N007",
    q: "sold my old clothes on depop am I in trouble",
    expectClarifyClass: "marketplace_personal_vs_trade",
  },
  {
    id: "N008",
    q: "my wages are under PAYE so nothing else matters yeah?",
    expectClarifyClass: "employment_status_ambiguity",
  },
  {
    id: "N029",
    q: "thinking of starting a window-cleaning round — first steps?",
    expectClarifyClass: "future_intent_not_current",
  },
  {
    id: "N005",
    q: "honestly do I need to pay an accountant for this",
    expectClarifyClass: "customer_intent_unclear",
  },
  {
    id: "N042",
    q: "50k qi 24/25 — over threshold or not??",
    expectClarifyClass: null as string | null,
    note: "QI + year present; exact £50k band answer OK",
  },
  {
    id: "N048",
    q: "is crypto tax when I buy or when I sell",
    expectClarifyClass: null as string | null,
    note: "Educational buy-vs-sell — direct answer OK",
  },
];

async function postChat(app: any, body: any) {
  for (let i = 0; i < 4; i++) {
    try {
      const res = await request(app)
        .post("/api/v1/chat")
        .send(body)
        .timeout({ deadline: 90000, response: 90000 });
      if (res.status === 200 && String(res.body?.reply || "").trim()) return res;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    } catch {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
  return null;
}

function looksLikeClarify(reply: string): boolean {
  return /need (a little )?more|one key fact|were you mainly|has this activity|do you have any other untaxed|happy to help — what|was your qualifying income more than|casually|personal possessions|still only planned/i.test(
    reply,
  );
}

function looksLikeConfirmedSa(reply: string): boolean {
  return /you (will|must|need to) (register|file|submit).{0,40}self assessment|you need self assessment|register as self-employed with hmrc for self assessment/i.test(
    reply,
  );
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const live = process.env.LIVE !== "0";
  process.env.OPENAI_DAILY_TOKEN_BUDGET =
    process.env.OPENAI_DAILY_TOKEN_BUDGET || "5000000";
  const app = createApp(
    createSettings({ CONCIERGE_FORCE_MOCK_LLM: live ? false : true }),
  );

  const results: any[] = [];
  for (const c of CASES) {
    const policy = decidePolicy(c.q);
    const res = await postChat(app, {
      session_id: `retest-miss-${c.id}`,
      message: c.q,
      history: [],
    });
    const reply = String(res?.body?.reply || "");
    const packages = (res?.body?.packages || []).map(
      (p: any) => p.code || p.name || p,
    );
    const clarify = looksLikeClarify(reply) || policy.mode === "CLARIFY";
    const wrongSa =
      looksLikeConfirmedSa(reply) &&
      (c.id === "N007" || c.id === "N008" || c.id === "N029");
    const policyOk =
      c.expectClarifyClass == null
        ? policy.mode !== "CLARIFY" || policy.clarificationClass == null
          ? true
          : policy.mode === "CLARIFY"
        : policy.mode === "CLARIFY" &&
          policy.clarificationClass === c.expectClarifyClass;
    results.push({
      id: c.id,
      question: c.q,
      note: c.note || null,
      policy_mode: policy.mode,
      policy_class: policy.clarificationClass,
      policy_ok: c.expectClarifyClass
        ? policy.mode === "CLARIFY" &&
          policy.clarificationClass === c.expectClarifyClass
        : policy.mode === "EDUCATE" ||
          policy.mode === "ANSWER_OBLIGATION" ||
          policyOk,
      reply_unedited: reply,
      packages,
      live_clarify: clarify,
      wrong_sa_conclusion: wrongSa,
      premature_package: packages.length > 0,
    });
    console.error(
      c.id,
      policy.mode,
      policy.clarificationClass,
      wrongSa ? "WRONG_SA" : "ok",
      reply.slice(0, 100).replace(/\n/g, " "),
    );
  }

  const summary = {
    generated_at: new Date().toISOString(),
    live,
    total: results.length,
    policy_ok: results.filter((r) => r.policy_ok).length,
    wrong_sa: results.filter((r) => r.wrong_sa_conclusion).length,
    premature_packages: results.filter((r) => r.premature_package).length,
    results,
  };
  writeFileSync(
    path.join(OUT, "RETEST_MISSED_CLARIFICATIONS.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log(JSON.stringify({ ...summary, results: undefined }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
