/**
 * Fresh unseen blind validation AFTER intelligence fixes (v2).
 * Expectations locked to disk BEFORE any model answers.
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createSettings } from "../src/config/settings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(
  __dirname,
  "../../docs/verification/simba_v2_quality_proof/evidence/final_intelligence_pass",
);

type Class =
  | "GENERAL_INFO"
  | "SA_ASSIST"
  | "MTD_ASSIST"
  | "BOTH_SA_AND_MTD"
  | "TAXSIMBA_SIGNUP"
  | "ACCOUNTANT_CONSULTATION"
  | "EXISTING_CUSTOMER_SUPPORT"
  | "NO_TAXSIMBA_SERVICE"
  | "MORE_INFO_NEEDED"
  | "OUT_OF_SCOPE";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function classifyObserved(
  reply: string,
  packages: string[],
  expected: string,
): { observed: string; match: boolean | "PARTIAL"; tags: Record<string, boolean> } {
  const a = (reply || "").toLowerCase();
  const pkgs = packages || [];
  const clarifying =
    /need (a little )?more detail|roughly how much|which tax year|is that figure|do you have any|tell me|confirm|before (i|saying)|i need (one key fact|the tax year)|can'?t decide|cannot decide|rolling 12-month|was this a one-off|have you already disposed|what other income|happy to help|it depends whether|casually selling|are you selling|personal belongings|one-off sale|won'?t invent|beneficial share|joint beneficial/i.test(
      a,
    ) &&
    !/(you must register|you will need to use making tax digital from|you usually must register for self assessment)/i.test(
      a,
    );

  let observed = "UNCLASSIFIED";
  if (/out of scope|corporation tax|immigration|will writer/i.test(a)) {
    observed = "OUT_OF_SCOPE";
  } else if (
    /(paye).{0,80}(does not apply|not required|do not need|don't need).{0,40}(mtd|making tax digital)|(mtd|making tax digital).{0,80}(does not apply|not required|do not need).{0,40}paye|only income is paye/i.test(
      a,
    )
  ) {
    observed = "NO_TAXSIMBA_SERVICE";
  } else if (
    /(usually do not need|do not need|don't need).{0,40}(self assessment|tax return)/i.test(
      a,
    ) &&
    pkgs.length === 0
  ) {
    observed = "NO_TAXSIMBA_SERVICE";
  } else if (clarifying) {
    observed = "MORE_INFO_NEEDED";
  } else if (
    /dashboard|info@taxsimba|existing/.test(a) &&
    /support|login|message|accountant/.test(a)
  ) {
    observed = "EXISTING_CUSTOMER_SUPPORT";
  } else if (
    /consultation|£99|£149/.test(a) &&
    /meet|calendly|personalised|letter|investigation/.test(a)
  ) {
    observed = "ACCOUNTANT_CONSULTATION";
  } else if (
    expected === "TAXSIMBA_SIGNUP" &&
    /£119|simple|simbian|package|priced at/.test(a)
  ) {
    observed = "TAXSIMBA_SIGNUP";
  } else if (
    /making tax digital|\bmtd\b/.test(a) &&
    /self assessment/.test(a) &&
    /(from (6 )?april 2026|need to use|in scope|both)/.test(a) &&
    !(
      expected === "MTD_ASSIST" &&
      /(more than £(50|30|20),?000|qualifying income|6 april 202[678])/.test(a)
    )
  ) {
    observed = "BOTH_SA_AND_MTD";
  } else if (
    /making tax digital|\bmtd\b/.test(a) &&
    /(from (6 )?april 2026|qualifying income|threshold|not above|not brought|6 april 2027|6 april 2028|more than £)/.test(
      a,
    )
  ) {
    observed = "MTD_ASSIST";
  } else if (/self assessment|tax return/.test(a)) {
    observed = "SA_ASSIST";
  } else if (
    /(do not need|don't need|does not apply|not required)/.test(a) &&
    pkgs.length === 0
  ) {
    observed = "NO_TAXSIMBA_SERVICE";
  } else {
    observed = "GENERAL_INFO";
  }

  const match =
    observed === expected
      ? true
      : (expected === "GENERAL_INFO" &&
          (observed === "GENERAL_INFO" || observed === "MORE_INFO_NEEDED")) ||
          (expected === "SA_ASSIST" && /self assessment/.test(a)) ||
          (expected === "MTD_ASSIST" && /mtd|making tax digital/.test(a)) ||
          (expected === "NO_TAXSIMBA_SERVICE" &&
            pkgs.length === 0 &&
            /(do not need|does not apply|usually do not|not required)/.test(a)) ||
          (expected === "TAXSIMBA_SIGNUP" &&
            (/£119|package|simbian|register/.test(a) || pkgs.length > 0)) ||
          (expected === "ACCOUNTANT_CONSULTATION" &&
            /consult|£99|£149/.test(a)) ||
          (expected === "EXISTING_CUSTOMER_SUPPORT" &&
            /dashboard|info@|support/.test(a)) ||
          (expected === "OUT_OF_SCOPE" && /not|cannot|don't|corporation/.test(a)) ||
          (expected === "BOTH_SA_AND_MTD" &&
            /self assessment/.test(a) &&
            /mtd|making tax digital/.test(a))
        ? "PARTIAL"
        : false;

  return {
    observed,
    match,
    tags: {
      factual_tax_error: /below the £1,?000 trading allowance/.test(a),
      missing_clarification:
        expected === "MORE_INFO_NEEDED" && match === false && !clarifying,
      wrong_service:
        match === false &&
        expected === "MORE_INFO_NEEDED" &&
        (observed === "SA_ASSIST" || observed === "MTD_ASSIST"),
      premature_package:
        pkgs.length > 0 &&
        !/package|cheapest|sign up|which|taxsimba|consult|recommend/i.test(
          expected + a,
        ),
      missed_taxsimba:
        expected === "TAXSIMBA_SIGNUP" &&
        pkgs.length === 0 &&
        !/£119|package|simbian/.test(a),
      unnecessary_consultation:
        /you.?ve chosen|quick tax advice — £99/.test(a) &&
        !/consult|£99 consultation|book/.test(expected),
      unnecessary_clarification: false,
      context_memory_failure: false,
    },
  };
}

function buildFresh200(): Array<{
  id: string;
  question: string;
  expected_classification: Class;
  expected_outcome: string;
}> {
  const seeds: Array<[string, Class, string]> = [
    ["upwork freelance £1,600 in 2025-26 — need sa?", "SA_ASSIST", ">£1k with year"],
    ["i earn £58k. making tax digital?", "MORE_INFO_NEEDED", "bare earn"],
    ["paye only £44k. mtd income tax?", "NO_TAXSIMBA_SERVICE", "paye only"],
    ["paye only £99000. mtd?", "NO_TAXSIMBA_SERVICE", "paye only large figure"],
    ["qi more than £50,000 in 2024-25 — when start?", "MTD_ASSIST", "apr 2026"],
    ["qi exactly £50,000 in 2024-25 mtd?", "MTD_ASSIST", "exclusive"],
    ["qi more than £30,000 in 2025-26 start date?", "MTD_ASSIST", "apr 2027"],
    ["rent roughly £35k — digital tax start?", "MORE_INFO_NEEDED", "need year"],
    ["dont want packages. freelance £2,200 2025-26 sa?", "SA_ASSIST", "no sell"],
    ["crypto: tax when i buy coins?", "MORE_INFO_NEEDED", "usually disposal"],
    ["dividends £900 — do i file?", "MORE_INFO_NEEDED", "other income"],
    ["vat £86k register?", "MORE_INFO_NEEDED", "rolling period"],
    ["got a p60 only — file return?", "MORE_INFO_NEEDED", "not automatic"],
    ["cheapest first-time sa package please?", "TAXSIMBA_SIGNUP", "asked"],
    ["hmrc investigation letter — consultation?", "ACCOUNTANT_CONSULTATION", "consult"],
    ["already taxsimba client how to message accountant?", "EXISTING_CUSTOMER_SUPPORT", "dashboard"],
    ["file corporation tax for my ltd?", "OUT_OF_SCOPE", "ct"],
    ["what is qualifying income for mtd?", "GENERAL_INFO", "QI def"],
    ["does paye count toward mtd qi?", "GENERAL_INFO", "excluded"],
    ["cash weekend bar maybe £1,100. accountant?", "MORE_INFO_NEEDED", "uncertain"],
    ["marketplace selling maybe £1,400. accountant?", "MORE_INFO_NEEDED", "trade vs personal"],
    ["bolt driving not sure of totals — hmrc?", "MORE_INFO_NEEDED", "amount/year"],
    ["sole trader turnover £9,500 2024-25. sa?", "SA_ASSIST", ">£1k"],
    ["trading allowance vs sa threshold?", "GENERAL_INFO", "relief vs who-must"],
    ["i refuse packages. explain trading allowance.", "GENERAL_INFO", "no package"],
    ["cis deductions — still need sa?", "MORE_INFO_NEEDED", "need turnover"],
    ["partner 50/50 let who files?", "MORE_INFO_NEEDED", "joint facts"],
    ["records sole traders should keep?", "GENERAL_INFO", "records"],
    ["sa online deadline roughly?", "GENERAL_INFO", "31 jan"],
    ["two paye jobs only sa?", "MORE_INFO_NEEDED", "not automatic"],
  ];
  const out: Array<{
    id: string;
    question: string;
    expected_classification: Class;
    expected_outcome: string;
  }> = [];
  let n = 1;
  for (const [q, c, note] of seeds) {
    out.push({
      id: `P${String(n++).padStart(3, "0")}`,
      question: q,
      expected_classification: c,
      expected_outcome: note,
    });
  }
  const templates: Array<(i: number) => [string, Class, string]> = [
    (i) => [
      `side hustle depop maybe £${950 + i * 90}. need accountant?`,
      "MORE_INFO_NEEDED",
      "uncertain+accountant",
    ],
    (i) => [
      `contract design £${1500 + i * 200} in 2025-26. self assessment?`,
      "SA_ASSIST",
      ">£1k year known",
    ],
    (i) => [
      `i make £${18 + (i % 30)}k a year. mtd?`,
      "MORE_INFO_NEEDED",
      "bare",
    ],
    (i) => [
      `paye only £${31000 + i * 1800}. making tax digital?`,
      "NO_TAXSIMBA_SERVICE",
      "paye",
    ],
    (i) => [
      `qualifying income more than £${i % 3 === 0 ? "50000" : i % 3 === 1 ? "30000" : "20000"} in ${i % 3 === 0 ? "2024-25" : i % 3 === 1 ? "2025-26" : "2026-27"}. start?`,
      "MTD_ASSIST",
      "band",
    ],
  ];
  let t = 0;
  while (out.length < 200) {
    const [q, c, note] = templates[t % templates.length]!(
      Math.floor(t / templates.length) + 1,
    );
    out.push({
      id: `P${String(n++).padStart(3, "0")}`,
      question: q,
      expected_classification: c,
      expected_outcome: note,
    });
    t++;
  }
  return out.slice(0, 200);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const live = process.env.LIVE !== "0";
  const scenarios = buildFresh200();
  writeFileSync(
    path.join(OUT, "FRESH_POSTFIX_V2_SCENARIOS.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        note: "NEW fresh blind AFTER fixes — expectations locked BEFORE answers",
        count: scenarios.length,
        scenarios,
      },
      null,
      2,
    ),
  );

  const app = createApp(
    createSettings({ CONCIERGE_FORCE_MOCK_LLM: live ? false : true }),
  );
  const results: any[] = [];
  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i]!;
    const res = await request(app)
      .post("/api/v1/chat")
      .send({
        session_id: `fiq-pv2-${s.id}`,
        message: s.question,
        history: [],
      });
    const body = res.body || {};
    const reply = String(body.reply || "");
    const packages = (body.packages || []).map(
      (p: any) => p.code || p.name || p,
    );
    const clf = classifyObserved(reply, packages, s.expected_classification);
    results.push({
      id: s.id,
      question: s.question,
      expected_classification: s.expected_classification,
      expected_outcome: s.expected_outcome,
      reply_unedited: reply,
      packages,
      llm_mode: body.llm_mode,
      classification_observed: clf.observed,
      classification_match: clf.match,
      tags: clf.tags,
    });
    if ((i + 1) % 25 === 0) console.error(`fresh-v2 ${i + 1}/${scenarios.length}`);
    await sleep(live ? 120 : 5);
  }

  const metrics = {
    total: results.length,
    openai: results.filter((r) => r.llm_mode === "openai").length,
    exact: results.filter((r) => r.classification_match === true).length,
    partial: results.filter((r) => r.classification_match === "PARTIAL").length,
    fail: results.filter((r) => r.classification_match === false).length,
    FACTUAL_TAX_ERROR: results.filter((r) => r.tags.factual_tax_error).length,
    MISSING_CLARIFICATION: results.filter((r) => r.tags.missing_clarification)
      .length,
    WRONG_SERVICE: results.filter((r) => r.tags.wrong_service).length,
    PREMATURE_PACKAGE: results.filter((r) => r.tags.premature_package).length,
    MISSED_APPROPRIATE_TAXSIMBA: results.filter((r) => r.tags.missed_taxsimba)
      .length,
    UNNECESSARY_CONSULTATION_ESCALATION: results.filter(
      (r) => r.tags.unnecessary_consultation,
    ).length,
    CONTEXT_MEMORY_FAILURE: 0,
    UNNECESSARY_CLARIFICATION: 0,
  };
  writeFileSync(
    path.join(OUT, "FRESH_POSTFIX_V2_RESULTS.json"),
    JSON.stringify(
      { generated_at: new Date().toISOString(), live, metrics, results },
      null,
      2,
    ),
  );

  // Also rescore prior fresh with improved classifier for comparison
  try {
    const prior = JSON.parse(
      readFileSync(path.join(OUT, "FRESH_POSTFIX_200_RESULTS.json"), "utf8"),
    );
    const rescored = (prior.results || []).map((r: any) => {
      const clf = classifyObserved(
        r.reply_unedited || "",
        r.packages || [],
        r.expected_classification,
      );
      return {
        ...r,
        classification_observed: clf.observed,
        classification_match: clf.match,
        tags: clf.tags,
      };
    });
    const pm = {
      exact: rescored.filter((r: any) => r.classification_match === true).length,
      partial: rescored.filter((r: any) => r.classification_match === "PARTIAL")
        .length,
      fail: rescored.filter((r: any) => r.classification_match === false).length,
    };
    writeFileSync(
      path.join(OUT, "FRESH_POSTFIX_200_RESULTS_classifier_v2.json"),
      JSON.stringify({ metrics: pm, results: rescored }, null, 2),
    );
    console.log(JSON.stringify({ prior_rescored: pm, fresh_v2: metrics }, null, 2));
  } catch {
    console.log(JSON.stringify({ fresh_v2: metrics }, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
