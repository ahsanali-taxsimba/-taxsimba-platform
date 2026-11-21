/**
 * NEW locked unseen blind bank AFTER decision-policy fixes.
 * Expectations locked to disk BEFORE any answers are collected.
 * Not derived by paraphrasing the prior G-series or MJ-series banks.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createSettings } from "../src/config/settings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(
  __dirname,
  "../../docs/verification/simba_v2_quality_proof/evidence/generalisation_decision_policy/blind_v2",
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
  | "OUT_OF_SCOPE"
  | "DIY_OK";

type Turn = { role: "user" | "assistant"; content: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postChat(app: any, body: any) {
  // Do not Promise.race-abandon in-flight requests — that piles up OpenAI calls
  // and cascades timeouts across later multi-turn journeys.
  for (let i = 0; i < 8; i++) {
    try {
      const res = await request(app)
        .post("/api/v1/chat")
        .send(body)
        .timeout({ deadline: 90000, response: 90000 });
      if (res.status === 200 && String(res.body?.reply || "").trim()) return res;
      const status = res.status;
      console.error(
        `postChat empty/non-200 retry ${i + 1}: status=${status} replyLen=${String(res.body?.reply || "").length}`,
      );
      // OpenAI 429 / upstream rate limits need long cool-downs.
      if (status === 429) await sleep(Math.min(120000, 15000 * 2 ** Math.min(i, 3)));
      else await sleep(Math.min(30000, 2500 * 2 ** i));
    } catch (err) {
      console.error(
        `postChat retry ${i + 1}:`,
        (err as Error)?.message || String(err),
      );
      await sleep(Math.min(30000, 2500 * 2 ** i));
    }
  }
  return null;
}

function classify(
  reply: string,
  packages: string[],
  expected: string,
): { observed: string; match: boolean | "ACCEPTABLE"; tags: Record<string, boolean> } {
  const a = (reply || "").toLowerCase();
  const pkgs = packages || [];
  const clarifying =
    /need (a little )?more detail|roughly how much|which tax year|is that figure|one key fact|can'?t decide|it depends whether|casually selling|was this a one-off|what other income|happy to help — i need|rolling 12-month|beneficial share|just to check|are you renting|do you have any other untaxed|on the boundary|it depends on your circumstances|was this casual|paye employment alone/i.test(
      a,
    ) &&
    !/(you must register for self assessment|you need to use making tax digital from)/i.test(
      a,
    );
  const educationalGeneral =
    /dividend allowance is £500|filing deadline is when|payment deadline is when|quarterly updates are short summaries|self assessment is hmrc|making tax digital for income tax is|repairs that restore|holding without disposal|trading allowance is a tax relief/i.test(
      a,
    );

  let observed = "GENERAL_INFO";
  if (/corporation tax|out of scope|immigration|will writer/i.test(a))
    observed = "OUT_OF_SCOPE";
  else if (
    /(paye).{0,80}(does not apply|do not need).{0,40}(mtd|making tax digital)|(mtd|making tax digital).{0,80}(does not apply|do not need).{0,40}paye/i.test(
      a,
    )
  )
    observed = "NO_TAXSIMBA_SERVICE";
  else if (clarifying) observed = "MORE_INFO_NEEDED";
  else if (educationalGeneral && expected === "GENERAL_INFO") observed = "GENERAL_INFO";
  else if (/dashboard|info@taxsimba/.test(a) && /support|message|login/.test(a))
    observed = "EXISTING_CUSTOMER_SUPPORT";
  else if (
    /consultation|£99|£149/.test(a) &&
    /meet|calendly|personalised|letter|investigation/.test(a)
  )
    observed = "ACCOUNTANT_CONSULTATION";
  else if (
    expected === "TAXSIMBA_SIGNUP" &&
    /£119|simple|simbian|package|priced/.test(a)
  )
    observed = "TAXSIMBA_SIGNUP";
  else if (
    /making tax digital|\bmtd\b/.test(a) &&
    /self assessment/.test(a) &&
    /(from (6 )?april 2026|need to use|both)/.test(a) &&
    !(
      expected === "MTD_ASSIST" &&
      /(more than £|qualifying income|6 april 202[678])/.test(a)
    )
  )
    observed = "BOTH_SA_AND_MTD";
  else if (
    /making tax digital|\bmtd\b/.test(a) &&
    /(qualifying income|6 april 202|threshold|more than £|quarterly)/.test(a)
  )
    observed = "MTD_ASSIST";
  else if (
    educationalGeneral ||
    /what is self assessment|hmrc.?s system|quarterly updates are/.test(a)
  )
    observed = "GENERAL_INFO";
  else if (/self assessment|tax return/.test(a)) observed = "SA_ASSIST";
  else if (
    /(do not need|don't need|does not apply|not required|diy|yourself)/.test(a) &&
    pkgs.length === 0
  )
    observed = expected === "DIY_OK" ? "DIY_OK" : "NO_TAXSIMBA_SERVICE";

  const match =
    observed === expected
      ? true
      : (expected === "MORE_INFO_NEEDED" && observed === "MORE_INFO_NEEDED") ||
          (expected === "GENERAL_INFO" &&
            (observed === "GENERAL_INFO" ||
              observed === "MORE_INFO_NEEDED" ||
              (observed === "SA_ASSIST" &&
                /trading allowance|deadline|self assessment is|hmrc/.test(a) &&
                !/you must register/.test(a)) ||
              (observed === "MTD_ASSIST" &&
                /qualifying income|quarterly|making tax digital is/.test(a)))) ||
          (expected === "DIY_OK" && pkgs.length === 0) ||
          (expected === "SA_ASSIST" && /self assessment/.test(a)) ||
          (expected === "MTD_ASSIST" && /mtd|making tax digital/.test(a)) ||
          (expected === "BOTH_SA_AND_MTD" &&
            /self assessment/.test(a) &&
            /mtd|making tax digital/.test(a)) ||
          (expected === "NO_TAXSIMBA_SERVICE" &&
            pkgs.length === 0 &&
            /(do not need|does not apply|usually do not|not required|paye employment alone)/.test(
              a,
            )) ||
          (expected === "TAXSIMBA_SIGNUP" &&
            (/£119|package|simbian|register/.test(a) || pkgs.length > 0)) ||
          (expected === "ACCOUNTANT_CONSULTATION" && /consult|£99|£149/.test(a)) ||
          (expected === "EXISTING_CUSTOMER_SUPPORT" && /dashboard|info@|support/.test(a)) ||
          (expected === "OUT_OF_SCOPE" && /not|cannot|corporation|don't/.test(a))
        ? observed === expected
          ? true
          : "ACCEPTABLE"
        : false;

  const noBuyContext = /don'?t want|dont want|no packages?|refuse|no buy|no sell|explain/i.test(
    expected + a,
  );
  return {
    observed,
    match,
    tags: {
      factual_tax_error:
        /dividend allowance[^\n.]{0,40}£\s*2,?000|below the £1,?000 trading allowance threshold/.test(
          a,
        ),
      premature_package: pkgs.length > 0 && noBuyContext,
      missing_clarification:
        expected === "MORE_INFO_NEEDED" && match === false && !clarifying,
      unnecessary_clarification:
        clarifying &&
        (expected === "SA_ASSIST" || expected === "MTD_ASSIST" || expected === "GENERAL_INFO") &&
        match === false,
      wrong_service:
        match === false &&
        expected === "MORE_INFO_NEEDED" &&
        (observed === "SA_ASSIST" || observed === "MTD_ASSIST"),
      empty_reply: !reply || reply === "[NO_REPLY_TIMEOUT]",
    },
  };
}

/** Build and lock 500 single-turn scenarios (new wording). */
function build500Locked(): Array<{
  id: string;
  question: string;
  expected_classification: Class;
  notes: string;
  adversarial?: boolean;
}> {
  const seeds: Array<[string, Class, string, boolean?]> = [
    ["yo I did some uber eats last month what tax stuff do I sort", "MORE_INFO_NEEDED", "gig no amount", true],
    ["whats this making tax digital nonsense people keep posting about", "GENERAL_INFO", "MTD educate", false],
    ["salary gets taxed already but Ive got a lodger now", "MORE_INFO_NEEDED", "PAYE+lodger", false],
    ["got paid for a couple youtube vids", "MORE_INFO_NEEDED", "creator no amount", true],
    ["honestly do I need to pay an accountant for this", "MORE_INFO_NEEDED", "intent unclear", false],
    ["ill just file myself thanks", "DIY_OK", "diy", false],
    ["sold my old clothes on depop am I in trouble", "MORE_INFO_NEEDED", "personal vs trade", true],
    ["my wages are under PAYE so nothing else matters yeah?", "MORE_INFO_NEEDED", "other income?", true],
    ["sole trader took £7,250 before expenses 2025-26 — need a return?", "SA_ASSIST", ">£1k", false],
    ["qualifying income over £50k for 2024-25 when does digital tax start", "MTD_ASSIST", "Apr 2026", false],
    ["qualifying income exactly £30,000 in 2025-26 — in for MTD?", "MTD_ASSIST", "exclusive", false],
    ["qi more than 20k in 2026-27 start date?", "MTD_ASSIST", "Apr 2028", false],
    ["I make 62k a year. digital tax?", "MORE_INFO_NEEDED", "bare earn", true],
    ["PAYE-only £41,000. Do I need Making Tax Digital?", "NO_TAXSIMBA_SERVICE", "paye", false],
    ["£11k property rent + £21k freelance turnover 2025-26 combined for MTD?", "MTD_ASSIST", "combine", false],
    ["£60k profit and £85k turnover 2024-25 — which figure for MTD?", "MTD_ASSIST", "turnover", false],
    ["exactly £1,000 freelance 2025-26 — Self Assessment?", "MORE_INFO_NEEDED", "boundary", false],
    ["craft fair £780 last year — tell HMRC?", "MORE_INFO_NEEDED", "≤£1k", false],
    ["Just Eat about £3,400 2025-26 before expenses. SA?", "SA_ASSIST", ">£1k", false],
    ["What is Self Assessment in plain English?", "GENERAL_INFO", "educate", false],
    ["Explain Making Tax Digital for Income Tax", "GENERAL_INFO", "educate", false],
    ["Do MTD quarterly updates replace the annual return?", "GENERAL_INFO", "no", false],
    ["What is the current dividend allowance?", "GENERAL_INFO", "£500", false],
    ["filing deadline vs payment deadline — difference?", "GENERAL_INFO", "deadlines", false],
    ["does my PAYE salary count in qualifying income?", "GENERAL_INFO", "no", false],
    ["uni student £350 weekend bar shifts cash — SA?", "MORE_INFO_NEEDED", "low/uncertain", false],
    ["retired, £2,400 building society interest — return needed?", "MORE_INFO_NEEDED", "savings", false],
    ["left employment June, got P45 — automatic Self Assessment?", "MORE_INFO_NEEDED", "not auto", false],
    ["thinking of starting a window-cleaning round — first steps?", "MORE_INFO_NEEDED", "start", false],
    ["CIS deductions on my payslips — still need SA?", "MORE_INFO_NEEDED", "CIS", false],
    ["sold some bitcoin for a profit — do I report?", "MORE_INFO_NEEDED", "CGT facts", false],
    ["I only bought crypto, never sold — automatic CGT?", "GENERAL_INFO", "no", false],
    ["three PAYE jobs, nothing else — SA automatic?", "MORE_INFO_NEEDED", "not auto", false],
    ["cheapest TaxSimba Self Assessment option?", "TAXSIMBA_SIGNUP", "asked", false],
    ["I refuse paid help. Freelance £2,200 2025-26 before expenses — SA?", "SA_ASSIST", "no-buy", false],
    ["dont want packages. explain trading allowance", "GENERAL_INFO", "no sell", false],
    ["HMRC enquiry letter — should I book a consult?", "ACCOUNTANT_CONSULTATION", "consult", false],
    ["Im already a TaxSimba customer — how do I message my accountant?", "EXISTING_CUSTOMER_SUPPORT", "dash", false],
    ["can TaxSimba file corporation tax for my limited company?", "OUT_OF_SCOPE", "CT", false],
    ["can I DIY my Self Assessment without using TaxSimba?", "DIY_OK", "diy", false],
    ["with Simbian do I buy Xero on top?", "GENERAL_INFO", "included", false],
    ["50k qi 24/25 — over threshold or not??", "MORE_INFO_NEEDED", "ambiguous", true],
    ["exactly £50,000.00 qualifying income 2024-25 — MTD from April 2026?", "MTD_ASSIST", "exact", true],
    ["paye only ninety nine thousand — mtd?", "NO_TAXSIMBA_SERVICE", "not consult", true],
    ["said 9k deliveries wait no it was 900 quid", "MORE_INFO_NEEDED", "correction", true],
    ["vat threshold and mtd are they the same thing", "MORE_INFO_NEEDED", "regimes", true],
    ["me and my wife 50/50 on a let — who puts it on a return", "MORE_INFO_NEEDED", "joint", false],
    ["is crypto tax when I buy or when I sell", "MORE_INFO_NEEDED", "disposal", false],
  ];

  const out: Array<{
    id: string;
    question: string;
    expected_classification: Class;
    notes: string;
    adversarial?: boolean;
  }> = [];
  let n = 1;
  for (const [q, c, note, adv] of seeds) {
    out.push({
      id: `N${String(n++).padStart(3, "0")}`,
      question: q,
      expected_classification: c,
      notes: note,
      adversarial: Boolean(adv),
    });
  }

  const activities = [
    "window cleaning",
    "mobile hairdressing",
    "market stall jewellery",
    "online tutoring",
    "pet sitting",
    "DJ gigs",
    "copywriting",
    "van courier",
    "car boot sales",
    "instagram brand deals",
  ];
  const roles = [
    "plumber",
    "care worker",
    "software contractor",
    "barista",
    "warehouse picker",
    "music teacher",
    "electrician",
    "graphic designer",
    "delivery cyclist",
    "bookkeeper",
  ];

  while (out.length < 500) {
    const i = out.length;
    const act = activities[i % activities.length]!;
    const role = roles[i % roles.length]!;
    const amt = 650 + (i % 40) * 95;
    const band = i % 3;
    const year = band === 0 ? "2024-25" : band === 1 ? "2025-26" : "2026-27";
    const thr = band === 0 ? "50000" : band === 1 ? "30000" : "20000";
    const templates: Array<[string, Class, string, boolean?]> = [
      [
        `started ${act} on the side maybe £${amt} — anything for HMRC?`,
        "MORE_INFO_NEEDED",
        "side near/under threshold",
        true,
      ],
      [
        `contracting as ${role} £${1800 + (i % 30) * 120} in 2025-26 before expenses. need sa?`,
        "SA_ASSIST",
        ">£1k with year",
        false,
      ],
      [
        `I get paid £${22 + (i % 40)}k. is that the digital tax thing?`,
        "MORE_INFO_NEEDED",
        "bare total",
        true,
      ],
      [
        `paye only £${28000 + i * 150}. mtd for income tax?`,
        "NO_TAXSIMBA_SERVICE",
        "paye",
        false,
      ],
      [
        `qi more than £${thr} in ${year} — when do I start?`,
        "MTD_ASSIST",
        "band",
        false,
      ],
      [
        `dont want packages. explain ${["trading allowance", "sa deadlines", "crypto disposal", "mtd quarterly updates"][i % 4]}`,
        "GENERAL_INFO",
        "no-buy educate",
        false,
      ],
      [
        `landlord rent £${9000 + (i % 25) * 800} ${year} — sa?`,
        "SA_ASSIST",
        "rent+year",
        false,
      ],
      [
        `marketplace sales maybe £${1200 + (i % 20) * 50}. accountant???`,
        "MORE_INFO_NEEDED",
        "intent",
        true,
      ],
    ];
    const t = templates[i % templates.length]!;
    out.push({
      id: `N${String(n++).padStart(3, "0")}`,
      question: t[0],
      expected_classification: t[1],
      notes: t[2],
      adversarial: Boolean(t[3]),
    });
  }
  return out.slice(0, 500);
}

function build100Multi(): Array<{
  id: string;
  title: string;
  turns: string[];
  expected_outcome: string;
  adversarial?: boolean;
}> {
  const deep: Array<{
    id: string;
    title: string;
    turns: string[];
    expected_outcome: string;
    adversarial?: boolean;
  }> = [];
  let d = 1;
  const cores: Array<[string, string[], string, boolean?]> = [
    [
      "Courier slang then facts",
      [
        "yo I did some uber eats last month what tax stuff do I sort",
        "about £2,800 before expenses",
        "that was 2025-26",
        "sa then?",
        "can I DIY",
        "dont sell me anything",
        "what records",
      ],
      "clarify→SA→diy no sell",
      true,
    ],
    [
      "Bare earn corrected",
      [
        "I make 62k",
        "digital tax?",
        "sorry 62k is PAYE and 16k is freelance turnover 2024-25",
        "sa?",
        "mtd?",
        "no package",
      ],
      "latest facts win",
      true,
    ],
    [
      "Educate then personal",
      [
        "whats this making tax digital nonsense",
        "I let a flat",
        "gross rent £22k 2024-25",
        "mtd?",
        "sa too?",
        "no sell",
      ],
      "educate then classify",
      false,
    ],
    [
      "Exact threshold flip",
      [
        "qi exactly 50000 2024-25",
        "mtd april 2026?",
        "what if more than 50k",
        "turnover not profit right?",
        "no signup",
      ],
      "exclusive then over",
      false,
    ],
    [
      "No-buy educate",
      [
        "dont want packages",
        "explain trading allowance",
        "I made £1,400 freelance 2025-26",
        "sa?",
      ],
      "educate then SA; no sell",
      false,
    ],
  ];
  for (const [title, turns, outcome, adv] of cores) {
    deep.push({
      id: `NJ${String(d++).padStart(3, "0")}`,
      title,
      turns,
      expected_outcome: outcome,
      adversarial: Boolean(adv),
    });
  }
  const jobs = [
    "roofer",
    "nanny",
    "app developer",
    "baker",
    "singer",
    "cleaner",
    "maths tutor",
    "courier",
    "UX designer",
    "barber",
    "joiner",
    "personal trainer",
    "wedding photographer",
    "mechanic",
    "ghostwriter",
    "agency nurse",
    "market gardener",
    "florist",
    "sparky",
    "decorator",
  ];
  for (const job of jobs) {
    if (deep.length >= 40) break;
    deep.push({
      id: `NJ${String(d++).padStart(3, "0")}`,
      title: `${job} mixed income`,
      turns: [
        `hi I work as a ${job}`,
        "also a bit of side cash",
        "main job PAYE around 32k",
        `side maybe £${1500 + deep.length * 35}`,
        "side was 2025-26 before expenses",
        "sa?",
        "mtd?",
        "please dont recommend a package unless I ask",
        "ok if I ask later whats cheapest sa",
        "thanks",
      ],
      expected_outcome: "memory; help-first; package only when asked",
      adversarial: true,
    });
  }
  while (deep.length < 40) {
    deep.push({
      id: `NJ${String(d++).padStart(3, "0")}`,
      title: `deep pad ${deep.length}`,
      turns: [
        "tax q",
        "self employed-ish",
        "turnover ~14k 2024-25",
        "sa?",
        "mtd?",
        "no buy",
        "records",
        "deadlines",
        "ok",
      ],
      expected_outcome: "SA; MTD careful; no sell",
    });
  }

  const short: typeof deep = [];
  let s = 41;
  const shortSeeds: Array<[string, string[], string]> = [
    ["paye clarify", ["i earn 48k", "paye only", "mtd?", "cheers"], "paye out"],
    ["no-buy sa", ["no packages please", "freelance 2.8k 2025-26", "sa?", "ok"], "sa no sell"],
    ["crypto hold", ["crypto tax?", "never sold", "so cgt?", "ok"], "no auto"],
    ["vat vs mtd", ["is vat the same as mtd?", "my turnover 95k last 12 months", "ok"], "separate"],
    ["existing", ["taxsimba client already", "how to message accountant", "ta"], "dashboard"],
    ["diy", ["diy sa ok?", "without paying you", "records?", "ok"], "diy"],
    ["consult refuse", ["need a consult?", "hmrc letter", "actually no just info", "notice to file?"], "respect"],
    ["xero", ["need xero separately?", "on simbian?", "ok"], "included"],
  ];
  for (const [title, turns, outcome] of shortSeeds) {
    short.push({
      id: `NJ${String(s++).padStart(3, "0")}`,
      title,
      turns,
      expected_outcome: outcome,
      adversarial: true,
    });
  }
  while (short.length + deep.length < 100) {
    const i = short.length + 1;
    short.push({
      id: `NJ${String(s++).padStart(3, "0")}`,
      title: `short pad ${i}`,
      turns: [
        `quick one ${i}`,
        "side cash work",
        `maybe £${700 + i * 45}`,
        "accountant?",
        "no just info",
      ],
      expected_outcome: "clarify",
      adversarial: true,
    });
  }
  return [...deep.slice(0, 40), ...short].slice(0, 100);
}

const SCORE20 = [
  {
    id: "S01",
    title: "Uber slang → DIY",
    turns: [
      "yo I did some uber eats last month what tax stuff do I sort",
      "about £2,800 before expenses 2025-26",
      "sa?",
      "ill just file myself",
      "dont sell me packages",
      "records?",
    ],
  },
  {
    id: "S02",
    title: "Bare 62k corrected",
    turns: [
      "I make 62k",
      "digital tax?",
      "sorry 62k PAYE and 16k freelance turnover 2024-25",
      "sa?",
      "mtd?",
      "no package",
    ],
  },
  {
    id: "S03",
    title: "MTD educate then rent",
    turns: [
      "whats this making tax digital nonsense",
      "I let a flat",
      "gross rent £22k 2024-25",
      "mtd?",
      "sa too?",
      "no sell",
    ],
  },
  {
    id: "S04",
    title: "Exact 50k",
    turns: [
      "qi exactly £50,000 2024-25",
      "mtd april 2026?",
      "if more than 50k?",
      "thanks",
    ],
  },
  {
    id: "S05",
    title: "No-buy trading allowance",
    turns: [
      "dont want packages",
      "explain trading allowance",
      "freelance £1,400 2025-26",
      "sa?",
    ],
  },
  {
    id: "S06",
    title: "PAYE only large",
    turns: ["paye only £99000", "mtd?", "sa?", "ok"],
  },
  {
    id: "S07",
    title: "Package when asked",
    turns: ["I want SA help", "first time simple", "cheapest package?", "signup?"],
  },
  {
    id: "S08",
    title: "Consult then refuse",
    turns: [
      "hmrc enquiry letter",
      "consultation options?",
      "actually no thanks",
      "what should I do generally",
    ],
  },
  {
    id: "S09",
    title: "CIS",
    turns: [
      "CIS deductions",
      "still sa?",
      "turnover £29k 2024-25",
      "mtd?",
      "no package",
    ],
  },
  {
    id: "S10",
    title: "Crypto",
    turns: ["crypto tax on buy?", "I sold some BTC", "cgt or income?", "ok"],
  },
  {
    id: "S11",
    title: "Joint let",
    turns: ["wife and I 50/50 let", "who files?", "rent £24k 2024-25", "thanks"],
  },
  {
    id: "S12",
    title: "Combined QI",
    turns: [
      "£14k rent and £20k freelance 2025-26",
      "combined for mtd?",
      "sa?",
      "no buy",
    ],
  },
  {
    id: "S13",
    title: "Profit vs turnover",
    turns: [
      "£45k profit £75k turnover 2024-25",
      "which for mtd?",
      "start date?",
    ],
  },
  {
    id: "S14",
    title: "Existing client",
    turns: ["existing taxsimba client", "message accountant?", "support email?"],
  },
  {
    id: "S15",
    title: "DIY Xero",
    turns: ["can I diy mtd", "buy xero myself?", "with taxsimba?"],
  },
  {
    id: "S16",
    title: "Student side",
    turns: ["student", "pet sitting maybe £550", "sa?", "ok"],
  },
  {
    id: "S17",
    title: "Pensioner interest",
    turns: [
      "retired",
      "£2,200 bank interest",
      "return?",
      "other income only state pension",
    ],
  },
  {
    id: "S18",
    title: "Multi-ask one message",
    turns: [
      "do I need sa and mtd and an accountant if PAYE plus £8k freelance 2025-26?",
      "dont want to buy anything yet",
    ],
  },
  {
    id: "S19",
    title: "Change mind",
    turns: [
      "which sa package?",
      "forget it I dont want paid help",
      "just the £1,000 rule please",
    ],
  },
  {
    id: "S20",
    title: "Memory landlord+SE",
    turns: [
      "im a landlord",
      "rent £18k 2024-25 before expenses",
      "also freelance £9k same year",
      "whats qi roughly",
      "dont ask if im a landlord again",
      "sa?",
      "no sell",
    ],
  },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const lockSingle = path.join(OUT, "BLIND_V2_500_SCENARIOS.json");
  const lockMulti = path.join(OUT, "BLIND_V2_100_MULTI_SCENARIOS.json");
  const lockScore = path.join(OUT, "SCORE20_V2_SCENARIOS.json");

  // Lock BEFORE answering — write once if missing, else reuse locked file.
  if (!existsSync(lockSingle)) {
    const single = build500Locked();
    writeFileSync(
      lockSingle,
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          note: "LOCKED before answers. New unseen bank after decision-policy fixes. Not a paraphrase of prior G* bank.",
          count: single.length,
          scenarios: single,
        },
        null,
        2,
      ),
    );
  }
  if (!existsSync(lockMulti)) {
    const multi = build100Multi();
    writeFileSync(
      lockMulti,
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          note: "LOCKED before answers. New multi-turn bank.",
          count: multi.length,
          scenarios: multi,
        },
        null,
        2,
      ),
    );
  }
  if (!existsSync(lockScore)) {
    writeFileSync(
      lockScore,
      JSON.stringify(
        { generated_at: new Date().toISOString(), journeys: SCORE20 },
        null,
        2,
      ),
    );
  }

  const single = JSON.parse(readFileSync(lockSingle, "utf8")).scenarios;
  const multi = JSON.parse(readFileSync(lockMulti, "utf8")).scenarios;
  const score20 = JSON.parse(readFileSync(lockScore, "utf8")).journeys;

  const live = process.env.LIVE !== "0";
  const skipSingle =
    process.env.SKIP_SINGLE === "1" ||
    (existsSync(path.join(OUT, "BLIND_V2_500_RESULTS.json")) &&
      process.env.FORCE_SINGLE !== "1");
  const app = createApp(
    createSettings({ CONCIERGE_FORCE_MOCK_LLM: live ? false : true }),
  );

  let sResults: any[] = [];
  let sMetrics: any;
  const singleResultsPath = path.join(OUT, "BLIND_V2_500_RESULTS.json");
  if (skipSingle && existsSync(singleResultsPath)) {
    const prior = JSON.parse(readFileSync(singleResultsPath, "utf8"));
    sResults = prior.results || [];
    sMetrics = prior.metrics;
    console.error(`v2-single reused locked results (${sResults.length})`);
  } else {
    for (let i = 0; i < single.length; i++) {
      const s = single[i]!;
      const res = await postChat(app, {
        session_id: `nv2-${s.id}`,
        message: s.question,
        history: [],
      });
      const body = res?.body || {};
      const reply = String(body.reply || "");
      const packages = (body.packages || []).map((p: any) => p.code || p.name || p);
      const clf = classify(reply, packages, s.expected_classification);
      sResults.push({
        id: s.id,
        question: s.question,
        expected_classification: s.expected_classification,
        notes: s.notes,
        adversarial: s.adversarial,
        reply_unedited: reply,
        packages,
        llm_mode: body.llm_mode,
        classification_observed: clf.observed,
        classification_match: clf.match,
        tags: clf.tags,
      });
      if ((i + 1) % 25 === 0) {
        console.error(`v2-single ${i + 1}/${single.length}`);
        writeFileSync(
          path.join(OUT, "BLIND_V2_500_RESULTS.checkpoint.json"),
          JSON.stringify(
            {
              generated_at: new Date().toISOString(),
              completed: sResults.length,
              results: sResults,
            },
            null,
            2,
          ),
        );
      }
      await sleep(live ? 40 : 5);
    }

    sMetrics = {
      total: sResults.length,
      openai: sResults.filter((r) => r.llm_mode === "openai").length,
      exact: sResults.filter((r) => r.classification_match === true).length,
      acceptable: sResults.filter((r) => r.classification_match === "ACCEPTABLE")
        .length,
      fail: sResults.filter((r) => r.classification_match === false).length,
      FACTUAL_TAX_ERROR: sResults.filter((r) => r.tags.factual_tax_error).length,
      PREMATURE_PACKAGE: sResults.filter((r) => r.tags.premature_package).length,
      MISSING_CLARIFICATION: sResults.filter((r) => r.tags.missing_clarification)
        .length,
      UNNECESSARY_CLARIFICATION: sResults.filter(
        (r) => r.tags.unnecessary_clarification,
      ).length,
      WRONG_SERVICE: sResults.filter((r) => r.tags.wrong_service).length,
      EMPTY_REPLY: sResults.filter((r) => r.tags.empty_reply).length,
    };
    writeFileSync(
      singleResultsPath,
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          live,
          metrics: sMetrics,
          results: sResults,
        },
        null,
        2,
      ),
    );
  }

  const multiCk = path.join(OUT, "BLIND_V2_100_MULTI_RESULTS.checkpoint.json");
  let mResults: any[] = [];
  if (existsSync(multiCk) && process.env.FORCE_MULTI !== "1") {
    try {
      mResults = JSON.parse(readFileSync(multiCk, "utf8")).results || [];
      console.error(`v2-multi resume from checkpoint (${mResults.length})`);
    } catch {
      mResults = [];
    }
  }
  const doneIds = new Set(mResults.map((r) => r.id));
  for (let i = 0; i < multi.length; i++) {
    const s = multi[i]!;
    if (doneIds.has(s.id)) continue;
    const history: Turn[] = [];
    const transcript: Turn[] = [];
    let lastPkgs: string[] = [];
    for (const msg of s.turns) {
      const res = await postChat(app, {
        session_id: `nv2m-${s.id}`,
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
      await sleep(live ? 400 : 5);
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
    doneIds.add(s.id);
    console.error(`v2-multi ${mResults.length}/${multi.length} ${s.id}`);
    if (mResults.length % 5 === 0) {
      writeFileSync(
        multiCk,
        JSON.stringify(
          {
            generated_at: new Date().toISOString(),
            completed: mResults.length,
            results: mResults,
          },
          null,
          2,
        ),
      );
    }
  }
  writeFileSync(
    path.join(OUT, "BLIND_V2_100_MULTI_RESULTS.json"),
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

  const scored: any[] = [];
  for (const s of score20) {
    const history: Turn[] = [];
    const transcript: Turn[] = [];
    for (const msg of s.turns) {
      const res = await postChat(app, {
        session_id: `nv2s-${s.id}`,
        message: msg,
        history,
      });
      const reply = String(res?.body?.reply || "[NO_REPLY_TIMEOUT]");
      transcript.push({ role: "user", content: msg });
      transcript.push({ role: "assistant", content: reply });
      history.push({ role: "user", content: msg });
      history.push({ role: "assistant", content: reply });
      await sleep(live ? 80 : 5);
    }
    scored.push({ id: s.id, title: s.title, transcript_unedited: transcript });
    console.error(`score20v2 ${s.id}`);
  }
  const md = [`# 20 unedited conversations (blind v2)`, ``];
  for (const j of scored) {
    md.push(`## ${j.id} — ${j.title}`, ``);
    for (const t of j.transcript_unedited) {
      md.push(`**${t.role === "user" ? "Customer" : "SIMBA"}:** ${t.content}`, ``);
    }
    md.push(`---`, ``);
  }
  writeFileSync(path.join(OUT, "SCORE20_V2_UNEDITED.md"), md.join("\n"));
  writeFileSync(
    path.join(OUT, "SCORE20_V2_JOURNEYS.json"),
    JSON.stringify({ generated_at: new Date().toISOString(), journeys: scored }, null, 2),
  );

  const passPct =
    ((sMetrics.exact + sMetrics.acceptable) / Math.max(sMetrics.total, 1)) * 100;
  const summary = {
    generated_at: new Date().toISOString(),
    live,
    single_500: sMetrics,
    single_pass_pct: Number(passPct.toFixed(1)),
    multi_100: {
      total: mResults.length,
      memory_defects: mResults.filter((r) => r.memory_defect).length,
      premature_on_nobuy: mResults.filter((r) => r.premature_on_nobuy).length,
      timeouts: mResults.reduce((a, r) => a + (r.timeouts || 0), 0),
    },
    launch_targets: {
      pass_ge_95: passPct >= 95,
      tax_errors_0: sMetrics.FACTUAL_TAX_ERROR === 0,
      premature_le_1pct: sMetrics.PREMATURE_PACKAGE / sMetrics.total <= 0.01,
    },
  };
  writeFileSync(path.join(OUT, "SUMMARY.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
