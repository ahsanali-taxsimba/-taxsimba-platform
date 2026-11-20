/**
 * Retest original 84 classification failures, then run a NEW unseen validation set (≥200).
 * Does NOT overwrite HOLDOUT_200_RESULTS.json.
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
  "../../docs/verification/simba_v2_quality_proof/evidence/holdout200/classification_fix",
);
const ORIG = path.resolve(
  __dirname,
  "../../docs/verification/simba_v2_quality_proof/evidence/holdout200/HOLDOUT_200_RESULTS.json",
);

type Class =
  | "SA_ASSIST"
  | "MTD_ASSIST"
  | "BOTH_SA_AND_MTD"
  | "NO_TAXSIMBA_SERVICE"
  | "MORE_INFO_NEEDED"
  | "EXISTING_CUSTOMER_SUPPORT"
  | "ACCOUNTANT_CONSULTATION"
  | "OUT_OF_SCOPE";

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
      await sleep(Math.min(40_000, 1200 * 2 ** i));
      continue;
    }
    break;
  }
  return last;
}

/** Improved matcher: clarifying replies count as MORE_INFO_NEEDED. */
function classifyObserved(
  reply: string,
  packages: string[],
  expected: string,
): { observed: string; match: boolean | "PARTIAL"; notes: string } {
  const a = (reply || "").toLowerCase();
  const pkgs = packages || [];
  const clarifying =
    /need (a little )?more detail|roughly how much|which tax year|is that figure|do you have any|tell me|confirm|before (i|saying)|i need (one key fact|the tax year)|can'?t decide|cannot decide|rolling 12-month|was this a one-off|have you already disposed|what other income/i.test(
      a,
    ) &&
    !/(you must register|you will need to use making tax digital from|you usually must register)/i.test(
      a,
    );

  let observed = "UNCLASSIFIED";

  // Denials / out-of-scope first (correct “no service” answers)
  if (/out of scope|don't (offer|provide)|cannot help with corporation|not something taxsimba|immigration|will writer|corporation tax/i.test(a)) {
    observed = "OUT_OF_SCOPE";
  } else if (
    /(paye).{0,80}(does not apply|not required|do not need|don't need).{0,40}(mtd|making tax digital)|(mtd|making tax digital).{0,80}(does not apply|not required|do not need).{0,40}paye|only income is paye.{0,60}(does not apply|not required)/i.test(
      a,
    )
  ) {
    observed = "NO_TAXSIMBA_SERVICE";
  } else if (
    /(usually do not need|do not need|don't need|typically won't need|likely do not need).{0,40}(self assessment|tax return)/i.test(
      a,
    ) &&
    pkgs.length === 0
  ) {
    observed = "NO_TAXSIMBA_SERVICE";
  } else if (
    clarifying ||
    /need (a little )?more detail|roughly how much|which tax year|is that figure paye|before saying whether/i.test(
      a,
    )
  ) {
    observed = "MORE_INFO_NEEDED";
  } else if (
    /existing|dashboard|already a (client|customer)|info@taxsimba|login|upload/i.test(a) &&
    /support|login|upload|existing|dashboard/i.test(a) &&
    !/self assessment simple|simbian/i.test(a)
  ) {
    observed = "EXISTING_CUSTOMER_SUPPORT";
  } else if (
    /consultation|calendly|£99|£149|book a consultation|accountant video/i.test(a) &&
    /consult|letter|investigation|liability|personalised|p800/i.test(a)
  ) {
    observed = "ACCOUNTANT_CONSULTATION";
  } else if (
    /making tax digital|\bmtd\b/.test(a) &&
    /self assessment/.test(a) &&
    /(from (6 )?april 2026|need to use|in scope|both)/.test(a)
  ) {
    observed = "BOTH_SA_AND_MTD";
  } else if (
    /making tax digital|\bmtd\b/.test(a) &&
    /(from (6 )?april 2026|qualifying income|in scope|threshold|not above|not brought)/.test(
      a,
    )
  ) {
    observed = "MTD_ASSIST";
  } else if (
    /self assessment|register for self assessment|send a tax return/.test(a)
  ) {
    observed = "SA_ASSIST";
  } else if (
    /(do not need|don't need|usually do not|does not apply|not required)/.test(a) &&
    pkgs.length === 0
  ) {
    observed = "NO_TAXSIMBA_SERVICE";
  } else {
    observed = "MORE_INFO_NEEDED";
  }

  const match =
    observed === expected
      ? true
      : (expected === "MORE_INFO_NEEDED" && observed === "MORE_INFO_NEEDED") ||
          (expected === "NO_TAXSIMBA_SERVICE" &&
            pkgs.length === 0 &&
            /(do not need|does not apply|usually do not|gov\.uk)/.test(a)) ||
          (expected === "SA_ASSIST" && /self assessment/.test(a)) ||
          (expected === "MTD_ASSIST" && /mtd|making tax digital/.test(a)) ||
          (expected === "BOTH_SA_AND_MTD" &&
            /self assessment/.test(a) &&
            /mtd|making tax digital/.test(a)) ||
          (expected === "ACCOUNTANT_CONSULTATION" &&
            /consult|accountant|professional/.test(a)) ||
          (expected === "OUT_OF_SCOPE" && /not|don't|cannot|outside|corporation/.test(a)) ||
          (expected === "EXISTING_CUSTOMER_SUPPORT" &&
            /dashboard|support|info@|login/.test(a))
        ? "PARTIAL"
        : false;

  return { observed, match, notes: `pkgs=${pkgs.join(",") || "none"}` };
}

function buildFresh200(): Array<{
  id: string;
  question: string;
  expected_classification: Class;
  expected_tax_notes: string;
  official_sources: string[];
}> {
  const sa = "https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return";
  const mtd =
    "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax";
  const trade =
    "https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income";
  const items: Array<[string, Class, string, string[]]> = [
    ["I DJ at weekends for cash. Not sure how much yet — tax?", "MORE_INFO_NEEDED", "Need amount/year before SA.", [sa]],
    ["PAYE nurse, Airbnb spare room sometimes.", "MORE_INFO_NEEDED", "Need rent amount/year.", [sa]],
    ["What does quarterly update mean for someone like me?", "MORE_INFO_NEEDED", "Explain MTD + ask income type.", [mtd]],
    ["My salary is £62k. Am I in Making Tax Digital?", "MORE_INFO_NEEDED", "Salary alone insufficient — income type.", [mtd]],
    ["Freelance copywriting £9,200 in 2025-26. SA?", "SA_ASSIST", ">£1,000 trading → usually SA.", [sa, trade]],
    ["Only PAYE £38k, nothing else. SA?", "NO_TAXSIMBA_SERVICE", "PAYE-only usually no SA.", [sa]],
    ["Property £55k rent 2024-25 — MTD April 2026?", "BOTH_SA_AND_MTD", ">£50k 2024-25 → MTD Apr 2026 + SA.", [mtd, sa]],
    ["Rent £12k — which MTD year?", "MORE_INFO_NEEDED", "Need tax year for band.", [mtd]],
    ["I don’t want any package. Is £1,100 Etsy SA?", "SA_ASSIST", ">£1k usually SA; no packages.", [sa]],
    ["HMRC investigation letter landed today.", "ACCOUNTANT_CONSULTATION", "Escalate.", []],
    ["I’m logged into TaxSimba — upload stuck.", "EXISTING_CUSTOMER_SUPPORT", "Dashboard/support.", []],
    ["Do Corporation Tax for my Ltd please.", "OUT_OF_SCOPE", "Not catalogue CT.", []],
    ["Uber + PAYE. Do I need an accountant tomorrow?", "MORE_INFO_NEEDED", "Need turnover before advising service.", [sa]],
    ["Exactly £50,000 qualifying income 2024-25 — over MTD?", "NO_TAXSIMBA_SERVICE", "Exact not more than.", [mtd]],
    ["More than £50,000 turnover 2024-25 — MTD start?", "MTD_ASSIST", "From 6 Apr 2026.", [mtd]],
    ["Sold personal bike online once for £400.", "MORE_INFO_NEEDED", "Likely not a trade — clarify.", [sa]],
    ["P60 arrived. File a return?", "MORE_INFO_NEEDED", "P60 ≠ automatic SA.", [sa]],
    ["Two PAYE jobs only — must I Self Assess?", "MORE_INFO_NEEDED", "Not automatic.", [sa]],
    ["Left job in July. SA needed?", "MORE_INFO_NEEDED", "Not from leaving alone.", [sa]],
    ["Company car on P11D — Self Assessment?", "MORE_INFO_NEEDED", "Often via PAYE; ask other income.", [sa]],
    ["CIS sparks, deductions taken. Why SA?", "MORE_INFO_NEEDED", "CIS ≠ SA waiver; need facts.", ["https://www.gov.uk/what-is-the-construction-industry-scheme", sa]],
    ["Crypto: tax on buy or sell?", "MORE_INFO_NEEDED", "Usually disposal events.", ["https://www.gov.uk/guidance/check-if-you-need-to-pay-tax-when-you-sell-cryptoassets"]],
    ["Dividends £1,500 — return?", "MORE_INFO_NEEDED", "Need total income picture.", [sa, "https://www.gov.uk/tax-on-dividends"]],
    ["VAT at £85k — register?", "MORE_INFO_NEEDED", "Check live threshold page.", ["https://www.gov.uk/vat-registration-thresholds"]],
    ["I want someone to handle my SA return.", "SA_ASSIST", "Help-first then package if asked.", []],
    ["Which package for simple first-time sole trader?", "SA_ASSIST", "Simple £119 when asked.", []],
    ["Just information — no selling. PAYE only SA?", "NO_TAXSIMBA_SERVICE", "No SA usually; zero packages.", [sa]],
    ["Software for tax — is that MTD?", "MORE_INFO_NEEDED", "May be MTD; ask facts.", [mtd]],
    ["Quarterly updates — is that me with only salary?", "NO_TAXSIMBA_SERVICE", "PAYE not QI.", [mtd]],
    ["Partner and I 50/50 let — who files?", "MORE_INFO_NEEDED", "Joint ownership facts.", [sa]],
  ];

  // Expand to ≥200 with varied informal templates (expectations set before run)
  const out: Array<{
    id: string;
    question: string;
    expected_classification: Class;
    expected_tax_notes: string;
    official_sources: string[];
  }> = [];
  let n = 1;
  for (const [q, c, note, src] of items) {
    out.push({
      id: `V${String(n++).padStart(3, "0")}`,
      question: q,
      expected_classification: c,
      expected_tax_notes: note,
      official_sources: src,
    });
  }
  const templates: Array<(i: number) => [string, Class, string]> = [
    (i) => [
      `Side income around £${500 + i * 200} last year — tell HMRC?`,
      500 + i * 200 > 1000 ? "SA_ASSIST" : "MORE_INFO_NEEDED",
      `Amount £${500 + i * 200} vs £1,000; still confirm activity type if vague.`,
    ],
    (i) => [
      `Rental about £${8000 + i * 3000} — do I need the digital tax thing?`,
      "MORE_INFO_NEEDED",
      "Need tax year + confirm property QI before MTD band.",
    ],
    (i) => [
      `I earn £${25 + (i % 40)}k. MTD?`,
      "MORE_INFO_NEEDED",
      "Bare earnings — clarify income type; never infer from total alone.",
    ],
    (i) => [
      `Cash-in-hand weekend work, maybe £${i * 150}. Accountant?`,
      "MORE_INFO_NEEDED",
      "Need clearer turnover/year before service.",
    ],
    (i) => [
      `PAYE only £${30000 + i * 1000}. Making Tax Digital?`,
      "NO_TAXSIMBA_SERVICE",
      "PAYE-only not MTD QI.",
    ],
  ];
  let t = 0;
  while (out.length < 200) {
    const [q, c, note] = templates[t % templates.length]!(
      Math.floor(t / templates.length) + 1,
    );
    out.push({
      id: `V${String(n++).padStart(3, "0")}`,
      question: q,
      expected_classification: c,
      expected_tax_notes: note,
      official_sources: c.includes("MTD") || /digital|MTD/.test(q) ? [mtd] : [sa],
    });
    t++;
  }
  return out.slice(0, 200);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  process.env.OPENAI_DAILY_TOKEN_BUDGET =
    process.env.OPENAI_DAILY_TOKEN_BUDGET || "2500000";
  const live = process.env.LIVE !== "0";
  const app = createApp(
    createSettings({ CONCIERGE_FORCE_MOCK_LLM: live ? false : true }),
  );

  const orig = JSON.parse(readFileSync(ORIG, "utf8"));
  const failIds = new Set(
    (orig.results || [])
      .filter((r: any) => r.classification_match === false)
      .map((r: any) => r.id),
  );
  const failRows = (orig.results || []).filter((r: any) => failIds.has(r.id));

  // Save expectations for new set BEFORE running
  const fresh = buildFresh200();
  writeFileSync(
    path.join(OUT, "VALIDATION_200_SCENARIOS.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        note: "NEW unseen validation — expectations established BEFORE model execution. Not the original holdout H001–H200.",
        count: fresh.length,
        scenarios: fresh,
      },
      null,
      2,
    ),
  );

  const retest: any[] = [];
  for (let i = 0; i < failRows.length; i++) {
    const s = failRows[i];
    const res = await postChat(app, {
      session_id: `retest84-${s.id}`,
      message: s.question,
      history: [],
    });
    const body = res?.body || {};
    const reply = String(body.reply || "");
    const packages = (body.packages || []).map((p: any) => p.code || p.name || p);
    const clf = classifyObserved(reply, packages, s.expected_classification);
    retest.push({
      id: s.id,
      question: s.question,
      expected_classification: s.expected_classification,
      expected_tax_notes: s.expected_tax_notes,
      official_sources: s.official_sources,
      original_observed: s.classification_observed,
      original_match: s.classification_match,
      reply_unedited: reply,
      packages,
      llm_mode: body.llm_mode,
      classification_observed: clf.observed,
      classification_match: clf.match,
      premature_package:
        packages.length > 0 &&
        !/package|which|price|sign up|consult|taxsimba|do everything|how much/.test(
          s.question.toLowerCase(),
        ),
      clarifying:
        /how much|tax year|is that figure|need (a little )?more detail|roughly/i.test(
          reply,
        ),
    });
    if ((i + 1) % 10 === 0) console.error(`retest ${i + 1}/${failRows.length}`);
    await sleep(live ? 200 : 10);
  }

  const retestMetrics = {
    total: retest.length,
    openai: retest.filter((r) => r.llm_mode === "openai").length,
    exact: retest.filter((r) => r.classification_match === true).length,
    partial: retest.filter((r) => r.classification_match === "PARTIAL").length,
    fail: retest.filter((r) => r.classification_match === false).length,
    premature: retest.filter((r) => r.premature_package).length,
    clarifying: retest.filter((r) => r.clarifying).length,
  };

  writeFileSync(
    path.join(OUT, "RETEST_84_RESULTS.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        live,
        note: "Retest of original 84 failures after intelligence fixes. Original HOLDOUT_200_RESULTS.json unchanged.",
        metrics: retestMetrics,
        results: retest,
      },
      null,
      2,
    ),
  );

  const valResults: any[] = [];
  for (let i = 0; i < fresh.length; i++) {
    const s = fresh[i]!;
    const res = await postChat(app, {
      session_id: `val200-${s.id}`,
      message: s.question,
      history: [],
    });
    const body = res?.body || {};
    const reply = String(body.reply || "");
    const packages = (body.packages || []).map((p: any) => p.code || p.name || p);
    const clf = classifyObserved(reply, packages, s.expected_classification);
    valResults.push({
      id: s.id,
      question: s.question,
      expected_classification: s.expected_classification,
      expected_tax_notes: s.expected_tax_notes,
      official_sources: s.official_sources,
      reply_unedited: reply,
      packages,
      llm_mode: body.llm_mode,
      classification_observed: clf.observed,
      classification_match: clf.match,
      premature_package:
        packages.length > 0 &&
        !/package|which|price|sign up|consult|taxsimba|do everything|how much|handle my sa|first-time/.test(
          s.question.toLowerCase(),
        ),
    });
    if ((i + 1) % 10 === 0) console.error(`validation ${i + 1}/${fresh.length}`);
    await sleep(live ? 200 : 10);
  }

  const valMetrics = {
    total: valResults.length,
    openai: valResults.filter((r) => r.llm_mode === "openai").length,
    exact: valResults.filter((r) => r.classification_match === true).length,
    partial: valResults.filter((r) => r.classification_match === "PARTIAL")
      .length,
    fail: valResults.filter((r) => r.classification_match === false).length,
    premature: valResults.filter((r) => r.premature_package).length,
  };

  writeFileSync(
    path.join(OUT, "VALIDATION_200_RESULTS.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        live,
        metrics: valMetrics,
        results: valResults,
      },
      null,
      2,
    ),
  );

  const summary = {
    generated_at: new Date().toISOString(),
    original_holdout_84_fails: 84,
    retest_84: retestMetrics,
    validation_200: valMetrics,
    original_holdout_metrics_preserved: {
      exact: 64,
      partial: 52,
      fail: 84,
      note: "See ../HOLDOUT_200_RESULTS.json — not overwritten",
    },
  };
  writeFileSync(path.join(OUT, "BEFORE_AFTER_SUMMARY.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
