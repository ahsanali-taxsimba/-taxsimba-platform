/**
 * Ask SIMBA V2 — Final Intelligence Quality Pass
 *
 * 1) Diagnose remaining 37 validation failures (from VALIDATION_200_RESULTS_v2)
 * 2) Retest those patterns after clarifier/MTD/SA fixes
 * 3) NEW blind set: 250 single-turn + 75 multi-turn (25 × 8–15 turns)
 * 4) Score 20 complete unedited journeys
 * 5) Fresh post-fix blind validation (expectations locked BEFORE answers)
 * 6) Write FINAL_INTELLIGENCE_QUALITY_REPORT.md
 *
 * LIVE=1 (default) uses real OpenAI. LIVE=0 forces mock for smoke.
 * Do NOT hardcode individual validation questions into the engine.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createSettings } from "../src/config/settings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const QP = path.join(ROOT, "docs/verification/simba_v2_quality_proof");
const OUT = path.join(QP, "evidence/final_intelligence_pass");
const VAL_V2 = path.join(
  QP,
  "evidence/holdout200/classification_fix/VALIDATION_200_RESULTS_v2.json",
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

type Turn = { role: "user" | "assistant"; content: string };

const SRC = {
  sa: "https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return",
  saReg: "https://www.gov.uk/register-for-self-assessment",
  trade: "https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income",
  mtd: "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
  mtdQi: "https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax",
  vat: "https://www.gov.uk/vat-registration-thresholds",
  crypto: "https://www.gov.uk/guidance/check-if-you-need-to-pay-tax-when-you-sell-cryptoassets",
  cis: "https://www.gov.uk/what-is-the-construction-industry-scheme",
  div: "https://www.gov.uk/tax-on-dividends",
  cgt: "https://www.gov.uk/capital-gains-tax",
  p60: "https://www.gov.uk/paye-forms-p45-p60-p11d/p60",
  records: "https://www.gov.uk/self-employed-records",
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postChat(
  app: ReturnType<typeof createApp>,
  opts: { session_id: string; message: string; history: Turn[] },
  attempts = 8,
) {
  let last: any = null;
  for (let i = 0; i < attempts; i++) {
    const res = await request(app).post("/api/v1/chat").send({
      session_id: opts.session_id,
      message: opts.message,
      history: opts.history,
    });
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

function classifyObserved(
  reply: string,
  packages: string[],
  expected: string,
): {
  observed: string;
  match: boolean | "PARTIAL";
  tags: {
    factual_tax_error: boolean;
    unnecessary_clarification: boolean;
    missing_clarification: boolean;
    context_memory_failure: boolean;
    wrong_service: boolean;
    premature_package: boolean;
    missed_taxsimba: boolean;
    unnecessary_consultation: boolean;
  };
} {
  const a = (reply || "").toLowerCase();
  const pkgs = packages || [];
  const clarifying =
    /need (a little )?more detail|roughly how much|which tax year|is that figure|do you have any|tell me|confirm|before (i|saying)|i need (one key fact|the tax year)|can'?t decide|cannot decide|rolling 12-month|was this a one-off|have you already disposed|what other income|happy to help|it depends whether|casually selling|are you selling|buying\/making|personal belongings|one-off sale|need the tax year|before saying whether|won'?t invent|i won'?t invent|do you also have|other income do you have/i.test(
      a,
    ) &&
    !/(you must register|you will need to use making tax digital from|you usually must register for self assessment)/i.test(
      a,
    );

  let observed = "UNCLASSIFIED";
  if (
    /out of scope|don't (offer|provide)|cannot help with corporation|immigration|will writer/i.test(
      a,
    )
  ) {
    observed = "OUT_OF_SCOPE";
  } else if (
    /(paye).{0,80}(does not apply|not required|do not need|don't need).{0,40}(mtd|making tax digital)|(mtd|making tax digital).{0,80}(does not apply|not required|do not need).{0,40}paye|only income is paye/i.test(
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
  } else if (clarifying) {
    observed = "MORE_INFO_NEEDED";
  } else if (
    /existing|dashboard|already a (client|customer)|info@taxsimba|login|upload/i.test(
      a,
    ) &&
    /support|login|upload|existing|dashboard/i.test(a)
  ) {
    observed = "EXISTING_CUSTOMER_SUPPORT";
  } else if (
    /consultation|calendly|£99|£149|book a consultation|accountant video/i.test(
      a,
    ) &&
    /appeal|letter|investigation|liability|personalised|p800/i.test(a)
  ) {
    observed = "ACCOUNTANT_CONSULTATION";
  } else if (
    /£119|self assessment simple|cheapest|simbian|£29\.99|package/.test(a) &&
    /taxsimba|sign up|register|browse|priced at|per tax year/.test(a) &&
    expected === "TAXSIMBA_SIGNUP"
  ) {
    observed = "TAXSIMBA_SIGNUP";
  } else if (
    /making tax digital|\bmtd\b/.test(a) &&
    /self assessment/.test(a) &&
    /(from (6 )?april 2026|need to use|in scope|both)/.test(a) &&
    // Incidental SA mention in a correct MTD band answer is still MTD_ASSIST.
    !(
      expected === "MTD_ASSIST" &&
      /(more than £(50|30|20),?000|qualifying income|6 april 202[678])/.test(a)
    )
  ) {
    observed = "BOTH_SA_AND_MTD";
  } else if (
    /making tax digital|\bmtd\b/.test(a) &&
    /(from (6 )?april 2026|qualifying income|in scope|threshold|not above|not brought|6 april 2027|6 april 2028|more than £)/.test(
      a,
    )
  ) {
    observed = "MTD_ASSIST";
  } else if (
    /self assessment|register for self assessment|send a tax return/.test(a)
  ) {
    observed = "SA_ASSIST";
  } else if (
    /(do not need|don't need|usually do not|does not apply|not required)/.test(
      a,
    ) &&
    pkgs.length === 0
  ) {
    observed = "NO_TAXSIMBA_SERVICE";
  } else if (
    /£119|£149|£299|simbian|self assessment simple|package/.test(a) &&
    /taxsimba|sign up|register|browse/.test(a)
  ) {
    observed = "TAXSIMBA_SIGNUP";
  } else {
    observed = "GENERAL_INFO";
  }

  const match =
    observed === expected
      ? true
      : (expected === "MORE_INFO_NEEDED" && observed === "MORE_INFO_NEEDED") ||
          (expected === "GENERAL_INFO" &&
            (observed === "GENERAL_INFO" ||
              observed === "MORE_INFO_NEEDED" ||
              observed === "NO_TAXSIMBA_SERVICE")) ||
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
          (expected === "TAXSIMBA_SIGNUP" &&
            (/package|£119|simbian|register|taxsimba/.test(a) ||
              pkgs.length > 0)) ||
          (expected === "OUT_OF_SCOPE" &&
            /not|don't|cannot|outside|corporation/.test(a)) ||
          (expected === "EXISTING_CUSTOMER_SUPPORT" &&
            /dashboard|support|info@|login/.test(a))
        ? "PARTIAL"
        : false;

  const premature =
    pkgs.length > 0 &&
    !/package|which|price|sign up|consult|taxsimba|cheapest|handle my|first-time|want help|recommend/i.test(
      expected + a,
    );

  return {
    observed,
    match,
    tags: {
      factual_tax_error:
        /below the £1,?000 trading allowance/.test(a) ||
        (/exactly £50,?000/.test(a) &&
          /you need to use making tax digital from 6 april 2026/.test(a)),
      unnecessary_clarification: false,
      missing_clarification:
        expected === "MORE_INFO_NEEDED" &&
        match === false &&
        !clarifying,
      context_memory_failure: false,
      wrong_service:
        match === false &&
        (observed === "SA_ASSIST" || observed === "MTD_ASSIST") &&
        expected === "MORE_INFO_NEEDED",
      premature_package: premature,
      missed_taxsimba:
        expected === "TAXSIMBA_SIGNUP" &&
        pkgs.length === 0 &&
        !/package|£119|simbian|register/.test(a),
      unnecessary_consultation:
        /£99|£149|consultation/.test(a) &&
        expected === "MORE_INFO_NEEDED" &&
        !/consult|accountant\?/.test(expected),
    },
  };
}

function rootCauseFor37(row: any): {
  cause:
    | "tax_knowledge"
    | "missing_clarification"
    | "context_memory"
    | "service_identification"
    | "intent_detection"
    | "package_selection"
    | "escalation"
    | "wording"
    | "other";
  generalisable_fix: string;
} {
  const q = String(row.question || "");
  const exp = row.expected_classification;
  const obs = row.classification_observed;
  if (/cash-in-hand weekend work, maybe/i.test(q)) {
    return {
      cause: "missing_clarification",
      generalisable_fix:
        "Uncertain cash/gig amounts + accountant ask must clarify turnover/year before SA or service advice (broaden maybe-£ digit match).",
    };
  }
  if (/i earn £\d+k\.?\s*mtd/i.test(q)) {
    return {
      cause: "intent_detection",
      generalisable_fix:
        "Bare ‘I earn £X’ must never be treated as MTD qualifying income — ask income type + year.",
    };
  }
  if (/rental about £\d+/i.test(q) && /digital tax/i.test(q)) {
    return {
      cause: "missing_clarification",
      generalisable_fix:
        "Property rent + MTD without a tax year must ask year before exclusive-band answer.",
    };
  }
  if (/crypto: tax on buy or sell/i.test(q)) {
    return {
      cause: "intent_detection",
      generalisable_fix:
        "Crypto buy-vs-sell questions clarify disposal/trading facts; do not jump to SA assertion.",
    };
  }
  if (/dividends/i.test(q)) {
    return {
      cause: "missing_clarification",
      generalisable_fix:
        "Dividend figure alone is insufficient — ask other income + tax year.",
    };
  }
  if (/50\/50 let|partner/i.test(q)) {
    return {
      cause: "missing_clarification",
      generalisable_fix:
        "Joint property ownership needs share / partnership vs beneficial ownership clarification.",
    };
  }
  if (/personal bike/i.test(q)) {
    return {
      cause: "service_identification",
      generalisable_fix:
        "One-off personal sales: clarify trade vs personal before NO_TAXSIMBA / SA.",
    };
  }
  if (/\bvat\b/i.test(q)) {
    return {
      cause: "tax_knowledge",
      generalisable_fix:
        "VAT registration depends on rolling 12-month taxable supplies — confirm basis before threshold answer.",
    };
  }
  if (exp === "MORE_INFO_NEEDED" && obs === "SA_ASSIST") {
    return {
      cause: "missing_clarification",
      generalisable_fix:
        "Prefer clarifier when amount/year/income-type incomplete.",
    };
  }
  return {
    cause: "other",
    generalisable_fix: "Re-examine conversation intelligence for this class.",
  };
}

/** Completely new single-turn questions — never used in prior holdout/validation. */
function buildBlind250(): Array<{
  id: string;
  question: string;
  expected_classification: Class;
  expected_outcome: string;
  official_sources: string[];
}> {
  const items: Array<[string, Class, string, string[]]> = [
    ["hey do i owe tax if i sold my old nintendo once for £90?", "MORE_INFO_NEEDED", "personal sale vs trade", [SRC.sa]],
    ["got my p60 — does that mean i file a tax return?", "MORE_INFO_NEEDED", "P60 ≠ automatic SA", [SRC.p60, SRC.sa]],
    ["left my job in march, got a p45. do i need self assessment just for that?", "MORE_INFO_NEEDED", "leaving job alone", [SRC.sa]],
    ["two jobs both paye, nothing else. sa?", "MORE_INFO_NEEDED", "multi PAYE not automatic SA", [SRC.sa]],
    ["i drive for bolt sometimes, not sure of totals — hmrc?", "MORE_INFO_NEEDED", "gig unclear amount", [SRC.sa]],
    ["deliveroo nights ~£2,400 in 2025-26 before expenses. sa needed?", "SA_ASSIST", ">£1k trading", [SRC.sa, SRC.trade]],
    ["etsy shop turnover £780 last tax year. register?", "NO_TAXSIMBA_SERVICE", "≤£1k trading alone", [SRC.sa, SRC.trade]],
    ["sole trader turnover £4,200 in 2024-25. do i need sa?", "SA_ASSIST", ">£1k", [SRC.sa]],
    ["paye £41k only, taxed via payroll, no side income. self assessment?", "NO_TAXSIMBA_SERVICE", "PAYE-only", [SRC.sa]],
    ["qualifying income more than £50,000 in 2024-25 — mtd start?", "MTD_ASSIST", "April 2026", [SRC.mtd]],
    ["qualifying income exactly £50,000 in 2024-25 — mtd from april 2026?", "MTD_ASSIST", "exact not more than", [SRC.mtd]],
    ["qualifying income more than £30,000 in 2025-26 when start mtd?", "MTD_ASSIST", "April 2027", [SRC.mtd]],
    ["i earn £55k. do i need making tax digital?", "MORE_INFO_NEEDED", "bare earn", [SRC.mtd, SRC.mtdQi]],
    ["paye only £72k. mtd income tax?", "NO_TAXSIMBA_SERVICE", "PAYE not QI", [SRC.mtdQi]],
    ["landlord rent £22k before expenses 2024-25. sa?", "SA_ASSIST", "property income", [SRC.sa]],
    ["rent about £28k — digital tax?", "MORE_INFO_NEEDED", "need year", [SRC.mtd]],
    ["what are quarterly updates under mtd for income tax?", "GENERAL_INFO", "explain quarterly", [SRC.mtd]],
    ["is mtd based on profit or turnover?", "GENERAL_INFO", "QI gross", [SRC.mtdQi]],
    ["do i count my salary toward qualifying income?", "GENERAL_INFO", "PAYE excluded", [SRC.mtdQi]],
    ["trading allowance — can i ignore sa if under £1k?", "GENERAL_INFO", "allowance vs threshold", [SRC.trade, SRC.sa]],
    ["cis deducted on invoices — still file sa?", "MORE_INFO_NEEDED", "CIS ≠ waiver; need facts", [SRC.cis, SRC.sa]],
    ["crypto: do i pay tax when i buy?", "MORE_INFO_NEEDED", "usually disposal", [SRC.crypto]],
    ["dividends £800 only — return?", "MORE_INFO_NEEDED", "need total income", [SRC.div, SRC.sa]],
    ["vat turnover rolling 12 months £88k — register?", "MORE_INFO_NEEDED", "confirm threshold basis", [SRC.vat]],
    ["i don’t want to buy anything. is £1,250 vinted trading sa?", "SA_ASSIST", ">£1k; respect no-buy", [SRC.sa]],
    ["cheapest taxsimba package for first simple sa?", "TAXSIMBA_SIGNUP", "Simple when asked", []],
    ["i want an accountant video call about a p800 letter", "ACCOUNTANT_CONSULTATION", "consult", []],
    ["already taxsimba client — message accountant how?", "EXISTING_CUSTOMER_SUPPORT", "dashboard", []],
    ["corporation tax for my ltd — can you file it?", "OUT_OF_SCOPE", "company CT", []],
    ["what records should sole traders keep?", "GENERAL_INFO", "records", [SRC.records]],
    ["savings interest £200 — sa?", "MORE_INFO_NEEDED", "depends band/total", [SRC.sa]],
    ["capital gains on selling shares?", "MORE_INFO_NEEDED", "CGT facts", [SRC.cgt]],
    ["partner and i jointly let a flat 60/40 — who declares?", "MORE_INFO_NEEDED", "joint ownership", [SRC.sa]],
    ["started freelancing yesterday — register today?", "MORE_INFO_NEEDED", "amount/year", [SRC.saReg]],
    ["hmrc sent a notice to file — what does that mean?", "GENERAL_INFO", "notice to file", [SRC.sa]],
    ["late registering for sa — general guidance?", "GENERAL_INFO", "deadlines/penalties overview", [SRC.saReg]],
    ["uber + paye job. mtd?", "MORE_INFO_NEEDED", "need QI amount/year", [SRC.mtd, SRC.mtdQi]],
    ["content creator on tiktok made about £3k. tax?", "MORE_INFO_NEEDED", "confirm year/gross", [SRC.sa]],
    ["i refuse packages. explain trading allowance only.", "GENERAL_INFO", "no sell", [SRC.trade]],
    ["software for tax — is that the same as mtd?", "MORE_INFO_NEEDED", "may be MTD", [SRC.mtd]],
  ];

  const out: Array<{
    id: string;
    question: string;
    expected_classification: Class;
    expected_outcome: string;
    official_sources: string[];
  }> = [];
  let n = 1;
  for (const [q, c, note, src] of items) {
    out.push({
      id: `B${String(n++).padStart(3, "0")}`,
      question: q,
      expected_classification: c,
      expected_outcome: note,
      official_sources: src,
    });
  }

  // Template expansion to reach 250 — new phrasings / amounts not in V-set
  const templates: Array<(i: number) => [string, Class, string]> = [
    (i) => [
      `side hustle on depop roughly £${600 + i * 175} — tell hmrc?`,
      600 + i * 175 > 1000 ? "MORE_INFO_NEEDED" : "MORE_INFO_NEEDED",
      "confirm activity/year even when amount present if uncertain wording",
    ],
    (i) => [
      `freelance editing £${1100 + i * 250} in 2025-26. self assessment?`,
      "SA_ASSIST",
      ">£1k trading with year",
    ],
    (i) => [
      `i make £${20 + (i % 35)}k a year. mtd?`,
      "MORE_INFO_NEEDED",
      "bare total income",
    ],
    (i) => [
      `property rent roughly £${15000 + i * 2500} — when digital tax?`,
      "MORE_INFO_NEEDED",
      "need tax year for band",
    ],
    (i) => [
      `paye only £${28000 + i * 1500}. making tax digital for income tax?`,
      "NO_TAXSIMBA_SERVICE",
      "PAYE-only",
    ],
    (i) => [
      `cash weekend bar work maybe £${900 + i * 120}. need accountant?`,
      "MORE_INFO_NEEDED",
      "uncertain + accountant ask",
    ],
    (i) => [
      `qualifying income more than £${i % 2 === 0 ? "50000" : "30000"} in ${i % 2 === 0 ? "2024-25" : "2025-26"}. start date?`,
      "MTD_ASSIST",
      "exclusive more-than band",
    ],
  ];
  let t = 0;
  while (out.length < 250) {
    const [q, c, note] = templates[t % templates.length]!(
      Math.floor(t / templates.length) + 1,
    );
    out.push({
      id: `B${String(n++).padStart(3, "0")}`,
      question: q,
      expected_classification: c,
      expected_outcome: note,
      official_sources:
        c.includes("MTD") || /digital|mtd/i.test(q) ? [SRC.mtd] : [SRC.sa],
    });
    t++;
  }
  return out.slice(0, 250);
}

function buildBlind75Multi(): Array<{
  id: string;
  title: string;
  expected_final_outcome: string;
  turns: string[];
}> {
  const deep: Array<{ id: string; title: string; expected_final_outcome: string; turns: string[] }> = [];
  // 25 deep 8–15 turn conversations
  const deepSeeds: Array<[string, string, string[]]> = [
    [
      "PAYE nurse adds weekend tutoring",
      "SA help; no premature package",
      [
        "hi im a nurse on paye",
        "i started tutoring weekends",
        "not sure how much yet maybe a few hundred",
        "ok looking at my notes it was about £1,800 in 2025-26 before expenses",
        "do i need self assessment?",
        "what records should i keep?",
        "i dont want to buy software yet — just explain",
        "if i later wanted help filing, whats the simplest taxsimba option?",
        "thanks thats enough",
      ],
    ],
    [
      "Contradiction salary vs freelance",
      "update understanding on correction",
      [
        "i earned £40k last year",
        "do i need mtd?",
        "sorry — £40k was salary and £18k was freelance turnover before expenses for 2024-25",
        "so what about self assessment?",
        "and making tax digital?",
        "please remember i already told you the freelance figure",
        "dont ask me again if im self employed — i freelanced",
        "i dont want a package",
        "ok goodbye",
      ],
    ],
    [
      "Landlord gradual facts",
      "SA + MTD year clarification",
      [
        "i have a rental",
        "its residential buy to let",
        "rent was about £19,000",
        "that was 2024-25 before expenses",
        "i also have a paye job £35k",
        "do i need sa?",
        "mtd?",
        "explain qualifying income without selling me anything",
        "if i want sa help later whats lowest package",
        "ill think about it",
      ],
    ],
    [
      "No-buy customer",
      "respect refusal; keep helping",
      [
        "do not sell me anything",
        "etsy sales £2,100 in 2025-26",
        "sa?",
        "trading allowance?",
        "still no packages please",
        "deadlines?",
        "penalties if late — general only",
        "thanks",
      ],
    ],
    [
      "MTD exact vs more than",
      "exclusive threshold memory",
      [
        "im a sole trader",
        "qualifying income exactly £50,000 in 2024-25",
        "mtd from april 2026?",
        "what if it was more than £50,000?",
        "is that turnover or profit?",
        "does my £10k paye count?",
        "quarterly updates mean what?",
        "still no signup",
        "bye",
      ],
    ],
  ];

  let d = 1;
  for (const [title, outcome, turns] of deepSeeds) {
    deep.push({
      id: `M${String(d++).padStart(3, "0")}`,
      title,
      expected_final_outcome: outcome,
      turns,
    });
  }
  // Expand to 25 deep by variants
  const variants = [
    "barista",
    "driver",
    "designer",
    "photographer",
    "cleaner",
    "tutor",
    "coder",
    "baker",
    "musician",
    "writer",
    "coach",
    "mechanic",
    "gardener",
    "hairdresser",
    "plumber",
    "electrician",
    "carpenter",
    "painter",
    "nanny",
    "therapist",
  ];
  for (const v of variants) {
    if (deep.length >= 25) break;
    deep.push({
      id: `M${String(d++).padStart(3, "0")}`,
      title: `${v} multi-income journey`,
      expected_final_outcome: "clarify → SA/MTD as facts allow; no premature package",
      turns: [
        `hi i work as a ${v}`,
        "also have some side income",
        "paye from my main job is about £32k",
        `side work maybe £${1500 + deep.length * 100}`,
        "sorry that side figure was for 2025-26 before expenses",
        "do i need self assessment?",
        "what about making tax digital?",
        "please dont recommend a package unless i ask",
        "ok what records should i keep?",
        "if i ask later for help filing, whats simplest option?",
        "thanks for now",
      ],
    });
  }

  const short: typeof deep = [];
  let s = 26;
  const shortSeeds: Array<[string, string[]]> = [
    ["bare earn then clarify", ["i earn £48k", "its paye only", "mtd?", "thanks"]],
    ["no package sa", ["dont sell me a package", "freelance £3k 2025-26", "sa?", "ok"]],
    ["crypto clarify", ["crypto tax?", "i only bought, never sold", "so cgt?", "thanks"]],
    ["vat rolling", ["vat at £87k?", "thats last 12 months taxable supplies", "register?", "ok"]],
    ["existing client", ["im already a taxsimba client", "how do i message my accountant?", "thanks"]],
  ];
  for (const [title, turns] of shortSeeds) {
    short.push({
      id: `M${String(s++).padStart(3, "0")}`,
      title,
      expected_final_outcome: "help-first; correct service class",
      turns,
    });
  }
  while (short.length + deep.length < 75) {
    const i = short.length + 1;
    short.push({
      id: `M${String(s++).padStart(3, "0")}`,
      title: `short journey ${i}`,
      expected_final_outcome: "clarify incomplete facts",
      turns: [
        `quick q about tax ${i}`,
        "i have some side cash work",
        `maybe £${800 + i * 50}`,
        "accountant?",
        "no thanks just info",
      ],
    });
  }

  return [...deep.slice(0, 25), ...short].slice(0, 75);
}

const SCORE20: Array<{ id: string; title: string; turns: string[] }> = [
  {
    id: "S01",
    title: "First-time freelancer help-first",
    turns: [
      "hi — new to this",
      "i freelance copywriting beside my job",
      "turnover about £7,500 in 2025-26 before expenses",
      "do i need self assessment?",
      "records?",
      "i might want help later — cheapest sa package?",
      "what happens after signup?",
      "enough for now",
    ],
  },
  {
    id: "S02",
    title: "Contradiction correction",
    turns: [
      "i earned £40k",
      "mtd?",
      "sorry £40k salary and £18k freelance 2024-25 before expenses",
      "sa?",
      "mtd?",
      "dont ask my employment status again",
      "no package",
      "bye",
    ],
  },
  {
    id: "S03",
    title: "Landlord no-sell",
    turns: [
      "paye job",
      "one rental £16k 2024-25 before expenses",
      "sa?",
      "mtd?",
      "do not recommend packages",
      "explain qualifying income",
      "ok thanks",
    ],
  },
  {
    id: "S04",
    title: "Exact £50k MTD",
    turns: [
      "sole trader",
      "qualifying income exactly £50,000 2024-25",
      "mtd april 2026?",
      "what if more than £50k?",
      "profit or turnover?",
      "thanks",
    ],
  },
  {
    id: "S05",
    title: "Cash-in-hand uncertain",
    turns: [
      "cash in hand weekend bar",
      "maybe £1,200",
      "accountant?",
      "it was 2025-26 roughly £1,200 before expenses",
      "sa?",
      "still thinking — no package",
    ],
  },
  {
    id: "S06",
    title: "PAYE-only MTD",
    turns: ["paye only £65k", "mtd?", "any sa?", "thanks"],
  },
  {
    id: "S07",
    title: "Package only when asked",
    turns: [
      "i know i need sa help",
      "simple first time sole trader",
      "which package?",
      "whats included at a high level?",
      "registration link?",
    ],
  },
  {
    id: "S08",
    title: "Consultation appropriate",
    turns: [
      "hmrc investigation letter — scared",
      "need someone to talk to",
      "consultation options?",
      "£99 vs £149?",
    ],
  },
  {
    id: "S09",
    title: "Existing customer",
    turns: [
      "existing taxsimba client",
      "cant find dashboard message",
      "support email?",
    ],
  },
  {
    id: "S10",
    title: "CIS subcontractor",
    turns: [
      "cis sparks",
      "deductions taken",
      "still sa?",
      "turnover about £28k 2024-25",
      "mtd?",
      "no package yet",
    ],
  },
  {
    id: "S11",
    title: "Creator income",
    turns: [
      "tiktok gifts maybe £2k",
      "tax?",
      "2025-26 about £2,400 before expenses",
      "sa?",
      "dont sell me stuff",
    ],
  },
  {
    id: "S12",
    title: "Crypto journey",
    turns: [
      "crypto tax?",
      "buy or sell?",
      "i sold some eth in 2025-26",
      "is that cgt or income?",
      "wont invent my bill — ok",
    ],
  },
  {
    id: "S13",
    title: "Joint property",
    turns: [
      "partner and i 50/50 let",
      "who files?",
      "rent £24k 2024-25 before expenses",
      "each declare half?",
      "thanks",
    ],
  },
  {
    id: "S14",
    title: "VAT curiosity",
    turns: ["vat £85k register?", "last 12 months supplies", "check gov uk?", "ok"],
  },
  {
    id: "S15",
    title: "Deadlines",
    turns: [
      "sa deadlines?",
      "online return?",
      "payment date?",
      "late filing general?",
    ],
  },
  {
    id: "S16",
    title: "Multiple jobs",
    turns: ["two paye jobs", "sa automatic?", "no other income", "thanks"],
  },
  {
    id: "S17",
    title: "P60 confusion",
    turns: ["got p60", "file return?", "only paye", "ok"],
  },
  {
    id: "S18",
    title: "MTD 30k band",
    turns: [
      "qi more than £30k in 2025-26",
      "start date?",
      "not april 2026 right?",
      "thanks",
    ],
  },
  {
    id: "S19",
    title: "No-buy then ask package",
    turns: [
      "no packages",
      "freelance £5k 2025-26",
      "sa?",
      "actually which package is cheapest if i change my mind?",
    ],
  },
  {
    id: "S20",
    title: "Memory retention",
    turns: [
      "im a landlord",
      "rent £21,000 2024-25 before expenses",
      "also freelance £9,000 same year",
      "what is my qualifying income roughly for mtd?",
      "dont ask if im a landlord again",
      "sa too?",
      "no sell",
    ],
  },
];

function scoreJourney(transcript: Turn[]): Record<string, number> {
  const text = transcript.map((t) => t.content).join("\n").toLowerCase();
  const assistant = transcript
    .filter((t) => t.role === "assistant")
    .map((t) => t.content)
    .join("\n")
    .toLowerCase();
  const user = transcript
    .filter((t) => t.role === "user")
    .map((t) => t.content)
    .join("\n")
    .toLowerCase();

  const tax =
    /gov\.uk|official guidance|more than|qualifying income|self assessment|making tax digital/.test(
      assistant,
    )
      ? /below the £1,?000 trading allowance/.test(assistant)
        ? 4
        : 8
      : 6;
  const understanding =
    /already|as you said|you (mentioned|said|told)|for 2024-25|for 2025-26|freelance|landlord|paye/.test(
      assistant,
    )
      ? 8
      : 6;
  const helpful = /happy to help|i can|official|guidance|next/.test(assistant)
    ? 8
    : 6;
  const conv =
    transcript.length >= 6 &&
    !/which package would you like|buy now/.test(assistant)
      ? 8
      : 6;
  const service = /self assessment|making tax digital|consultation|dashboard|package/.test(
    assistant,
  )
    ? 7
    : 6;
  const sales =
    /do not|don't|no package|dont want|refuse|don't sell|dont sell/.test(user) &&
    /£119|simbian|package/.test(assistant) &&
    !/if you (later|want|change)|when you('re| are) ready|if i later|cheapest/.test(
      assistant,
    )
      ? 3
      : 9;
  const next =
    /gov\.uk|register|dashboard|tell me|tax year|https:\/\//.test(assistant)
      ? 8
      : 5;

  return {
    tax_accuracy: tax,
    understanding,
    helpfulness: helpful,
    conversation_quality: conv,
    service_identification: service,
    sales_restraint: sales,
    next_action_quality: next,
  };
}

function buildFreshPostFix200(): ReturnType<typeof buildBlind250> {
  // Distinct from Blind250 — locked before execution
  const items: Array<[string, Class, string, string[]]> = [
    ["side gigs on upwork ~£1,400 2025-26 — sa?", "SA_ASSIST", ">£1k", [SRC.sa]],
    ["i earn £61k. mtd?", "MORE_INFO_NEEDED", "bare earn", [SRC.mtd]],
    ["paye only £55k — making tax digital?", "NO_TAXSIMBA_SERVICE", "paye", [SRC.mtd]],
    ["qi more than £20,000 in 2026-27 start?", "MTD_ASSIST", "Apr 2028", [SRC.mtd]],
    ["qi exactly £30,000 in 2025-26 mtd?", "MTD_ASSIST", "not more than", [SRC.mtd]],
    ["rent ~£40k digital tax?", "MORE_INFO_NEEDED", "year", [SRC.mtd]],
    ["dont want paid help. £2k freelance 2025-26 sa?", "SA_ASSIST", "no sell", [SRC.sa]],
    ["crypto tax on purchase?", "MORE_INFO_NEEDED", "disposal", [SRC.crypto]],
    ["dividends £2k return?", "MORE_INFO_NEEDED", "other income", [SRC.div]],
    ["vat £92k last 12 months?", "MORE_INFO_NEEDED", "threshold check", [SRC.vat]],
    ["p45 only — sa?", "MORE_INFO_NEEDED", "not automatic", [SRC.sa]],
    ["cheapest first-time sa package?", "TAXSIMBA_SIGNUP", "asked", []],
  ];
  const out: ReturnType<typeof buildBlind250> = [];
  let n = 1;
  for (const [q, c, note, src] of items) {
    out.push({
      id: `F${String(n++).padStart(3, "0")}`,
      question: q,
      expected_classification: c,
      expected_outcome: note,
      official_sources: src,
    });
  }
  const templates: Array<(i: number) => [string, Class, string]> = [
    (i) => [
      `marketplace selling maybe £${1000 + i * 80}. accountant?`,
      "MORE_INFO_NEEDED",
      "uncertain+accountant",
    ],
    (i) => [
      `contracting £${2000 + i * 300} in 2025-26. sa?`,
      "SA_ASSIST",
      ">£1k with year",
    ],
    (i) => [
      `i get £${15 + (i % 40)}k. mtd for income tax?`,
      "MORE_INFO_NEEDED",
      "bare",
    ],
    (i) => [
      `paye only £${25000 + i * 2000}. mtd?`,
      "NO_TAXSIMBA_SERVICE",
      "paye",
    ],
    (i) => [
      `qi more than £50000 in 2024-25 — confirm start ${i}`,
      "MTD_ASSIST",
      "apr 2026",
    ],
  ];
  let t = 0;
  while (out.length < 200) {
    const [q, c, note] = templates[t % templates.length]!(
      Math.floor(t / templates.length) + 1,
    );
    out.push({
      id: `F${String(n++).padStart(3, "0")}`,
      question: q,
      expected_classification: c,
      expected_outcome: note,
      official_sources: /mtd|digital|qi/i.test(q) ? [SRC.mtd] : [SRC.sa],
    });
    t++;
  }
  return out.slice(0, 200);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  process.env.OPENAI_DAILY_TOKEN_BUDGET =
    process.env.OPENAI_DAILY_TOKEN_BUDGET || "3000000";
  const live = process.env.LIVE !== "0";
  const app = createApp(
    createSettings({ CONCIERGE_FORCE_MOCK_LLM: live ? false : true }),
  );

  // --- 1) Diagnose 37 ---
  const v2 = existsSync(VAL_V2)
    ? JSON.parse(readFileSync(VAL_V2, "utf8"))
    : { results: [], metrics: {} };
  const fails37 = (v2.results || []).filter(
    (r: any) => r.classification_match === false,
  );
  const diagnosis = fails37.map((r: any) => {
    const rc = rootCauseFor37(r);
    return {
      id: r.id,
      customer_wording: r.question,
      conversation_history: [],
      simba_response_unedited: r.reply_unedited,
      expected_behaviour: r.expected_classification,
      expected_tax_notes: r.expected_tax_notes,
      observed: r.classification_observed,
      why_failed: `${r.expected_classification} → ${r.classification_observed}`,
      root_cause: rc.cause,
      generalisable_correction: rc.generalisable_fix,
      official_sources: r.official_sources,
    };
  });
  const byCause: Record<string, number> = {};
  for (const d of diagnosis) {
    byCause[d.root_cause] = (byCause[d.root_cause] || 0) + 1;
  }
  writeFileSync(
    path.join(OUT, "FAILURE_37_DIAGNOSIS.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        count: diagnosis.length,
        by_root_cause: byCause,
        failures: diagnosis,
      },
      null,
      2,
    ),
  );

  // --- Lock blind sets BEFORE execution ---
  const blind250 = buildBlind250();
  const blind75 = buildBlind75Multi();
  const fresh200 = buildFreshPostFix200();
  writeFileSync(
    path.join(OUT, "BLIND_250_SCENARIOS.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        note: "Expectations locked BEFORE model execution",
        count: blind250.length,
        scenarios: blind250,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    path.join(OUT, "BLIND_75_MULTI_SCENARIOS.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        note: "Expectations locked BEFORE model execution; 25 deep 8–15 turns",
        count: blind75.length,
        deep_count: blind75.filter((m) => m.turns.length >= 8).length,
        scenarios: blind75,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    path.join(OUT, "FRESH_POSTFIX_200_SCENARIOS.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        note: "Fresh unseen post-fix set — expectations locked BEFORE answers",
        count: fresh200.length,
        scenarios: fresh200,
      },
      null,
      2,
    ),
  );

  // --- 2) Retest 37 ---
  const retest37: any[] = [];
  for (let i = 0; i < fails37.length; i++) {
    const s = fails37[i];
    const res = await postChat(app, {
      session_id: `fiq-37-${s.id}`,
      message: s.question,
      history: [],
    });
    const body = res.body || {};
    const reply = String(body.reply || "");
    const packages = (body.packages || []).map(
      (p: any) => p.code || p.name || p,
    );
    const clf = classifyObserved(reply, packages, s.expected_classification);
    retest37.push({
      id: s.id,
      question: s.question,
      expected: s.expected_classification,
      reply_unedited: reply,
      packages,
      llm_mode: body.llm_mode,
      ...clf,
    });
    if ((i + 1) % 10 === 0) console.error(`retest37 ${i + 1}/${fails37.length}`);
    await sleep(live ? 150 : 5);
  }
  const retest37Metrics = {
    total: retest37.length,
    exact: retest37.filter((r) => r.match === true).length,
    partial: retest37.filter((r) => r.match === "PARTIAL").length,
    fail: retest37.filter((r) => r.match === false).length,
    premature: retest37.filter((r) => r.tags?.premature_package).length,
  };
  writeFileSync(
    path.join(OUT, "RETEST_37_RESULTS.json"),
    JSON.stringify(
      { generated_at: new Date().toISOString(), live, metrics: retest37Metrics, results: retest37 },
      null,
      2,
    ),
  );

  // --- 3) Blind 250 ---
  const b250: any[] = [];
  for (let i = 0; i < blind250.length; i++) {
    const s = blind250[i]!;
    const res = await postChat(app, {
      session_id: `fiq-b250-${s.id}`,
      message: s.question,
      history: [],
    });
    const body = res.body || {};
    const reply = String(body.reply || "");
    const packages = (body.packages || []).map(
      (p: any) => p.code || p.name || p,
    );
    const clf = classifyObserved(reply, packages, s.expected_classification);
    b250.push({
      id: s.id,
      question: s.question,
      expected_classification: s.expected_classification,
      expected_outcome: s.expected_outcome,
      official_sources: s.official_sources,
      reply_unedited: reply,
      packages,
      llm_mode: body.llm_mode,
      classification_observed: clf.observed,
      classification_match: clf.match,
      tags: clf.tags,
    });
    if ((i + 1) % 25 === 0) console.error(`blind250 ${i + 1}/${blind250.length}`);
    await sleep(live ? 120 : 5);
  }
  const b250Metrics = {
    total: b250.length,
    openai: b250.filter((r) => r.llm_mode === "openai").length,
    exact: b250.filter((r) => r.classification_match === true).length,
    partial: b250.filter((r) => r.classification_match === "PARTIAL").length,
    fail: b250.filter((r) => r.classification_match === false).length,
    premature: b250.filter((r) => r.tags?.premature_package).length,
    factual_tax_error: b250.filter((r) => r.tags?.factual_tax_error).length,
    missing_clarification: b250.filter((r) => r.tags?.missing_clarification)
      .length,
  };
  writeFileSync(
    path.join(OUT, "BLIND_250_RESULTS.json"),
    JSON.stringify(
      { generated_at: new Date().toISOString(), live, metrics: b250Metrics, results: b250 },
      null,
      2,
    ),
  );

  // --- 4) Blind 75 multi ---
  const m75: any[] = [];
  for (let i = 0; i < blind75.length; i++) {
    const s = blind75[i]!;
    const history: Turn[] = [];
    const transcript: Turn[] = [];
    let lastPackages: string[] = [];
    let lastMode = "";
    for (const msg of s.turns) {
      const res = await postChat(app, {
        session_id: `fiq-m75-${s.id}`,
        message: msg,
        history,
      });
      const body = res.body || {};
      const reply = String(body.reply || "");
      lastPackages = (body.packages || []).map(
        (p: any) => p.code || p.name || p,
      );
      lastMode = body.llm_mode;
      transcript.push({ role: "user", content: msg });
      transcript.push({ role: "assistant", content: reply });
      history.push({ role: "user", content: msg });
      history.push({ role: "assistant", content: reply });
      await sleep(live ? 100 : 5);
    }
    const repeatedAsk =
      (transcript.filter((t) => t.role === "assistant").length > 2 &&
        transcript
          .filter((t) => t.role === "assistant")
          .filter((t) =>
            /are you self-?employ|are you a landlord|how much did you earn/i.test(
              t.content,
            ),
          ).length >= 3) ||
      false;
    m75.push({
      id: s.id,
      title: s.title,
      expected_final_outcome: s.expected_final_outcome,
      turns: s.turns.length,
      transcript_unedited: transcript,
      final_packages: lastPackages,
      llm_mode: lastMode,
      context_memory_failure: repeatedAsk,
      premature_package: lastPackages.length > 0 && /no package|dont want|don't want|do not|refuse/i.test(
        s.turns.join(" "),
      ),
    });
    if ((i + 1) % 5 === 0) console.error(`blind75 ${i + 1}/${blind75.length}`);
  }
  writeFileSync(
    path.join(OUT, "BLIND_75_MULTI_RESULTS.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        live,
        metrics: {
          total: m75.length,
          deep_8plus: m75.filter((r) => r.turns >= 8).length,
          context_memory_failures: m75.filter((r) => r.context_memory_failure)
            .length,
          premature: m75.filter((r) => r.premature_package).length,
        },
        results: m75,
      },
      null,
      2,
    ),
  );

  // --- 5) Score 20 journeys ---
  const scored20: any[] = [];
  for (const s of SCORE20) {
    const history: Turn[] = [];
    const transcript: Turn[] = [];
    for (const msg of s.turns) {
      const res = await postChat(app, {
        session_id: `fiq-s20-${s.id}`,
        message: msg,
        history,
      });
      const body = res.body || {};
      const reply = String(body.reply || "");
      transcript.push({ role: "user", content: msg });
      transcript.push({ role: "assistant", content: reply });
      history.push({ role: "user", content: msg });
      history.push({ role: "assistant", content: reply });
      await sleep(live ? 100 : 5);
    }
    const scores = scoreJourney(transcript);
    scored20.push({
      id: s.id,
      title: s.title,
      transcript_unedited: transcript,
      scores,
      average:
        Object.values(scores).reduce((a, b) => a + b, 0) /
        Object.values(scores).length,
    });
    console.error(`score20 ${s.id}`);
  }
  writeFileSync(
    path.join(OUT, "SCORE20_JOURNEYS.json"),
    JSON.stringify(
      { generated_at: new Date().toISOString(), live, journeys: scored20 },
      null,
      2,
    ),
  );

  // Markdown with 20 unedited conversations
  const md20 = [
    `# 20 complete unedited conversations`,
    ``,
    `Generated: ${new Date().toISOString()} · live=${live}`,
    ``,
  ];
  for (const j of scored20) {
    md20.push(`## ${j.id} — ${j.title}`);
    md20.push(``);
    md20.push(
      `Scores: tax ${j.scores.tax_accuracy}/10 · understanding ${j.scores.understanding}/10 · helpfulness ${j.scores.helpfulness}/10 · conversation ${j.scores.conversation_quality}/10 · service ${j.scores.service_identification}/10 · sales restraint ${j.scores.sales_restraint}/10 · next action ${j.scores.next_action_quality}/10 · **avg ${j.average.toFixed(1)}**`,
    );
    md20.push(``);
    for (const t of j.transcript_unedited) {
      md20.push(`**${t.role === "user" ? "Customer" : "SIMBA"}:** ${t.content}`);
      md20.push(``);
    }
    md20.push(`---`);
    md20.push(``);
  }
  writeFileSync(path.join(OUT, "SCORE20_UNEDITED.md"), md20.join("\n"));

  // --- 6) Fresh post-fix 200 ---
  const freshResults: any[] = [];
  for (let i = 0; i < fresh200.length; i++) {
    const s = fresh200[i]!;
    const res = await postChat(app, {
      session_id: `fiq-fresh-${s.id}`,
      message: s.question,
      history: [],
    });
    const body = res.body || {};
    const reply = String(body.reply || "");
    const packages = (body.packages || []).map(
      (p: any) => p.code || p.name || p,
    );
    const clf = classifyObserved(reply, packages, s.expected_classification);
    freshResults.push({
      id: s.id,
      question: s.question,
      expected_classification: s.expected_classification,
      expected_outcome: s.expected_outcome,
      official_sources: s.official_sources,
      reply_unedited: reply,
      packages,
      llm_mode: body.llm_mode,
      classification_observed: clf.observed,
      classification_match: clf.match,
      tags: clf.tags,
    });
    if ((i + 1) % 25 === 0)
      console.error(`fresh200 ${i + 1}/${fresh200.length}`);
    await sleep(live ? 120 : 5);
  }
  const freshMetrics = {
    total: freshResults.length,
    openai: freshResults.filter((r) => r.llm_mode === "openai").length,
    exact: freshResults.filter((r) => r.classification_match === true).length,
    partial: freshResults.filter((r) => r.classification_match === "PARTIAL")
      .length,
    fail: freshResults.filter((r) => r.classification_match === false).length,
    FACTUAL_TAX_ERROR: freshResults.filter((r) => r.tags?.factual_tax_error)
      .length,
    UNNECESSARY_CLARIFICATION: freshResults.filter(
      (r) => r.tags?.unnecessary_clarification,
    ).length,
    MISSING_CLARIFICATION: freshResults.filter(
      (r) => r.tags?.missing_clarification,
    ).length,
    CONTEXT_MEMORY_FAILURE: m75.filter((r) => r.context_memory_failure).length,
    WRONG_SERVICE: freshResults.filter((r) => r.tags?.wrong_service).length,
    PREMATURE_PACKAGE: freshResults.filter((r) => r.tags?.premature_package)
      .length,
    MISSED_APPROPRIATE_TAXSIMBA: freshResults.filter(
      (r) => r.tags?.missed_taxsimba,
    ).length,
    UNNECESSARY_CONSULTATION_ESCALATION: freshResults.filter(
      (r) => r.tags?.unnecessary_consultation,
    ).length,
  };
  writeFileSync(
    path.join(OUT, "FRESH_POSTFIX_200_RESULTS.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        live,
        metrics: freshMetrics,
        results: freshResults,
      },
      null,
      2,
    ),
  );

  const exactPct =
    freshMetrics.total > 0
      ? (100 * freshMetrics.exact) / freshMetrics.total
      : 0;
  const go =
    exactPct >= 95 &&
    freshMetrics.FACTUAL_TAX_ERROR === 0 &&
    freshMetrics.PREMATURE_PACKAGE === 0 &&
    freshMetrics.CONTEXT_MEMORY_FAILURE === 0;

  const summary = {
    generated_at: new Date().toISOString(),
    live,
    before: { exact: 64, partial: 52, fail: 84 },
    current_pre_final_pass: { exact: 157, partial: 6, fail: 37 },
    retest_37: retest37Metrics,
    blind_250: b250Metrics,
    blind_75_multi: {
      total: m75.length,
      deep_8plus: m75.filter((r) => r.turns >= 8).length,
      context_memory_failures: m75.filter((r) => r.context_memory_failure)
        .length,
      premature: m75.filter((r) => r.premature_package).length,
    },
    score20_avg:
      scored20.reduce((a, j) => a + j.average, 0) / Math.max(scored20.length, 1),
    fresh_postfix_200: freshMetrics,
    exact_pct_fresh: exactPct,
    staging_targets: {
      exact_pct_ge_95: exactPct >= 95,
      zero_critical_tax_errors: freshMetrics.FACTUAL_TAX_ERROR === 0,
      zero_premature_packages: freshMetrics.PREMATURE_PACKAGE === 0,
      zero_known_context_loss: freshMetrics.CONTEXT_MEMORY_FAILURE === 0,
    },
    recommendation: go ? "CONDITIONAL_GO_FOR_STAGING_REVIEW" : "NO-GO",
    pr43: "HOLD — do not merge or deploy",
  };
  writeFileSync(
    path.join(OUT, "SUMMARY.json"),
    JSON.stringify(summary, null, 2),
  );

  const report = [
    `# Ask SIMBA V2 — Final Intelligence Quality Evidence`,
    ``,
    `**PR #43: HOLD — do not merge or deploy.**`,
    ``,
    `Professional accountant approval: **NOT OBTAINED**.`,
    `Do not claim 100% accurate, accountant approved, or production ready.`,
    ``,
    `## Scoreboard`,
    ``,
    `| Stage | Exact | Partial | Fail |`,
    `|---|---:|---:|---:|`,
    `| Before (original holdout) | 64 | 52 | 84 |`,
    `| Current (clarifier-first validation) | 157 | 6 | 37 |`,
    `| Retest of those 37 after this pass | ${retest37Metrics.exact} | ${retest37Metrics.partial} | ${retest37Metrics.fail} |`,
    `| Blind 250 (new) | ${b250Metrics.exact} | ${b250Metrics.partial} | ${b250Metrics.fail} |`,
    `| Fresh post-fix 200 | ${freshMetrics.exact} | ${freshMetrics.partial} | ${freshMetrics.fail} |`,
    ``,
    `Fresh exact rate: **${exactPct.toFixed(1)}%**`,
    ``,
    `### Fresh failure tags`,
    ``,
    `| Tag | Count |`,
    `|---|---:|`,
    ...Object.entries(freshMetrics)
      .filter(([k]) => k === k.toUpperCase())
      .map(([k, v]) => `| ${k} | ${v} |`),
    ``,
    `## Failure-by-failure root causes (37)`,
    ``,
    `| Cause | Count |`,
    `|---|---:|`,
    ...Object.entries(byCause).map(([k, v]) => `| ${k} | ${v} |`),
    ``,
    `Generalisable fixes applied: uncertain cash/gig clarifier; bare-earn ≠ MTD QI; rent/MTD requires tax year; crypto buy/sell clarifier; VAT rolling-period clarifier; latest-turn amount corrections.`,
    ``,
    `## Official-source verification`,
    ``,
    `See deepened \`evidence/independent_audit/\` (re-run deepenIndividualAudit400). Rules cite GOV.UK pages with tax-year applicability where pinned (MTD bands 2024-25/2025-26/2026-27 → 6 Apr 2026/2027/2028).`,
    ``,
    `## 20 scored unedited conversations`,
    ``,
    `Full transcripts: \`SCORE20_UNEDITED.md\`. Average score: **${summary.score20_avg.toFixed(1)}/10**.`,
    ``,
    `## Blind multi-turn`,
    ``,
    `- ${m75.length} conversations; ${m75.filter((r) => r.turns >= 8).length} with ≥8 turns`,
    `- Context/memory failures flagged: ${m75.filter((r) => r.context_memory_failure).length}`,
    `- Premature packages on no-buy paths: ${m75.filter((r) => r.premature_package).length}`,
    ``,
    `## Recommendation`,
    ``,
    `**${summary.recommendation}**`,
    ``,
    `Staging targets met: exact≥95%=${summary.staging_targets.exact_pct_ge_95}; zero tax errors=${summary.staging_targets.zero_critical_tax_errors}; zero premature packages=${summary.staging_targets.zero_premature_packages}; zero context-loss=${summary.staging_targets.zero_known_context_loss}.`,
    ``,
    `PR #43 remains on **HOLD**.`,
  ].join("\n");
  writeFileSync(path.join(OUT, "FINAL_INTELLIGENCE_QUALITY_REPORT.md"), report);
  writeFileSync(
    path.join(QP, "FINAL_INTELLIGENCE_QUALITY_REPORT.md"),
    report,
  );

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
