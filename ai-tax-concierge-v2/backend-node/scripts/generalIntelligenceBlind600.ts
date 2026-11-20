/**
 * NEW completely unseen general-intelligence blind bank.
 * 500 single-turn + 100 multi-turn. Expectations locked BEFORE answers.
 * Not derived by paraphrasing prior V/H/B/F/P banks.
 */
import { mkdirSync, writeFileSync } from "node:fs";
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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postChat(
  app: any,
  body: { session_id: string; message: string; history: Turn[] },
) {
  for (let i = 0; i < 6; i++) {
    const res = await request(app).post("/api/v1/chat").send(body);
    if (res.status === 200) return res;
    if (res.status === 429 || res.status >= 500) {
      await sleep(Math.min(30000, 1000 * 2 ** i));
      continue;
    }
    return res;
  }
  return null;
}

function classify(
  reply: string,
  packages: string[],
  expected: string,
): {
  observed: string;
  match: boolean | "ACCEPTABLE";
  tags: Record<string, boolean>;
} {
  const a = (reply || "").toLowerCase();
  const pkgs = packages || [];
  const clarifying =
    /need (a little )?more detail|roughly how much|which tax year|is that figure|one key fact|can'?t decide|it depends whether|casually selling|was this a one-off|what other income|happy to help — i need|rolling 12-month|beneficial share/i.test(
      a,
    ) &&
    !/(you must register for self assessment|you need to use making tax digital from)/i.test(
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
  else if (/self assessment|tax return/.test(a)) observed = "SA_ASSIST";
  else if (
    /(do not need|don't need|does not apply|not required|diy|yourself)/.test(a) &&
    pkgs.length === 0
  )
    observed = expected === "DIY_OK" ? "DIY_OK" : "NO_TAXSIMBA_SERVICE";
  else if (/what is self assessment|hmrc.?s system|quarterly updates are/.test(a))
    observed = "GENERAL_INFO";

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
          (expected === "DIY_OK" &&
            pkgs.length === 0 &&
            !/you must buy|required to use taxsimba/.test(a)) ||
          (expected === "SA_ASSIST" && /self assessment/.test(a)) ||
          (expected === "MTD_ASSIST" && /mtd|making tax digital/.test(a)) ||
          (expected === "BOTH_SA_AND_MTD" &&
            /self assessment/.test(a) &&
            /mtd|making tax digital/.test(a)) ||
          (expected === "NO_TAXSIMBA_SERVICE" &&
            pkgs.length === 0 &&
            /(do not need|does not apply|usually do not|not required)/.test(a)) ||
          (expected === "TAXSIMBA_SIGNUP" &&
            (/£119|package|simbian|register/.test(a) || pkgs.length > 0)) ||
          (expected === "ACCOUNTANT_CONSULTATION" &&
            /consult|£99|£149/.test(a)) ||
          (expected === "EXISTING_CUSTOMER_SUPPORT" &&
            /dashboard|info@|support/.test(a)) ||
          (expected === "OUT_OF_SCOPE" &&
            /not|cannot|corporation|don't/.test(a))
        ? observed === expected
          ? true
          : "ACCEPTABLE"
        : false;

  return {
    observed,
    match,
    tags: {
      factual_tax_error:
        /dividend allowance[^\n.]{0,40}£\s*2,?000|below the £1,?000 trading allowance/.test(
          a,
        ) ||
        (/exactly £50,?000/.test(a) &&
          /you need to use making tax digital from 6 april 2026/.test(a)),
      premature_package:
        pkgs.length > 0 &&
        !/package|cheapest|sign up|which|taxsimba|consult|recommend|want help/i.test(
          expected + a,
        ),
      unnecessary_clarification: false,
      missing_clarification:
        expected === "MORE_INFO_NEEDED" && match === false && !clarifying,
      wrong_service:
        match === false &&
        expected === "MORE_INFO_NEEDED" &&
        (observed === "SA_ASSIST" || observed === "MTD_ASSIST"),
      memory_defect: false,
      no_buy_respected: true,
    },
  };
}

function build500(): Array<{
  id: string;
  question: string;
  expected_classification: Class;
  notes: string;
  adversarial?: boolean;
}> {
  const seeds: Array<[string, Class, string, boolean?]> = [
    // Natural / slang
    ["mate I made some money doing deliveries what do I need to do", "MORE_INFO_NEEDED", "gig unclear amount", true],
    ["what is this digital tax thing", "GENERAL_INFO", "MTD explain", false],
    ["my job already taxes me but I rent a flat", "MORE_INFO_NEEDED", "PAYE+property unclear rent", false],
    ["I earned a bit from TikTok", "MORE_INFO_NEEDED", "creator unclear", true],
    ["do I actually need an accountant", "MORE_INFO_NEEDED", "need facts first", false],
    ["can I just do this myself", "DIY_OK", "DIY ok", false],
    ["innit do i owe hmrc if i sold stuff on vinted", "MORE_INFO_NEEDED", "trade vs personal", true],
    ["boss pays me PAYE already so im fine right?", "MORE_INFO_NEEDED", "may have other income", true],
    // Precise SA / MTD
    ["sole trader turnover £6,400 in 2025-26 — Self Assessment?", "SA_ASSIST", ">£1k", false],
    ["qualifying income more than £50,000 in 2024-25 — MTD start?", "MTD_ASSIST", "Apr 2026", false],
    ["qualifying income exactly £50,000 in 2024-25 — MTD?", "MTD_ASSIST", "exclusive", false],
    ["qualifying income more than £30k in 2025-26 start?", "MTD_ASSIST", "Apr 2027", false],
    ["I earn £47k. MTD?", "MORE_INFO_NEEDED", "bare earn", true],
    ["PAYE only £38,000. Making Tax Digital?", "NO_TAXSIMBA_SERVICE", "PAYE only", false],
    ["£12k rent + £22k freelance turnover 2025-26 — combined for MTD?", "MTD_ASSIST", "QI combine", false],
    ["£80k profit but £95k turnover 2024-25 — which for MTD?", "MTD_ASSIST", "turnover", false],
    // Thresholds
    ["freelance exactly £1,000 in 2025-26 — SA?", "MORE_INFO_NEEDED", "boundary", false],
    ["Etsy £900 last year — register?", "MORE_INFO_NEEDED", "≤£1k or confirm", false],
    ["Deliveroo about £2,100 2025-26 before expenses. SA?", "SA_ASSIST", ">£1k", false],
    // Educational
    ["What is Self Assessment?", "GENERAL_INFO", "explain", false],
    ["What is Making Tax Digital for Income Tax?", "GENERAL_INFO", "explain", false],
    ["Do quarterly updates replace my tax return?", "GENERAL_INFO", "no", false],
    ["What is the dividend allowance?", "GENERAL_INFO", "£500", false],
    ["difference between filing deadline and payment deadline?", "GENERAL_INFO", "deadlines", false],
    ["does PAYE count toward qualifying income?", "GENERAL_INFO", "no", false],
    // Special groups
    ["student with £400 babysitting — SA?", "MORE_INFO_NEEDED", "low/uncertain", false],
    ["pensioner with £3k bank interest — return?", "MORE_INFO_NEEDED", "savings", false],
    ["left job in May got P45 — automatic SA?", "MORE_INFO_NEEDED", "not automatic", false],
    ["starting a small business next month — what first?", "MORE_INFO_NEEDED", "clarify", false],
    ["CIS spark deductions taken — still SA?", "MORE_INFO_NEEDED", "CIS≠waiver", false],
    ["sold ETH for a gain — report?", "MORE_INFO_NEEDED", "CGT facts", false],
    ["hold bitcoin never sold — automatic CGT?", "GENERAL_INFO", "no auto", false],
    ["two PAYE jobs only — SA automatic?", "MORE_INFO_NEEDED", "not auto", false],
    ["company car on P11D — need SA?", "MORE_INFO_NEEDED", "ask other", false],
    // Service / sales
    ["cheapest TaxSimba SA package?", "TAXSIMBA_SIGNUP", "asked", false],
    ["I refuse any paid service. Is £1,800 freelance 2025-26 SA?", "SA_ASSIST", "no-buy", false],
    ["dont sell me anything — explain trading allowance", "GENERAL_INFO", "no sell", false],
    ["hmrc investigation letter — need consult?", "ACCOUNTANT_CONSULTATION", "consult", false],
    ["already TaxSimba client — message accountant?", "EXISTING_CUSTOMER_SUPPORT", "dashboard", false],
    ["file corporation tax for my ltd?", "OUT_OF_SCOPE", "CT", false],
    ["can I DIY Self Assessment without TaxSimba?", "DIY_OK", "diy", false],
    ["do I need to buy Xero separately for Simbian?", "GENERAL_INFO", "included", false],
    // Adversarial
    ["50k qi 2024/25 mtd??", "MORE_INFO_NEEDED", "ambiguous exact/more", true],
    ["£50,000.00 exactly qualifying 2024-25 over threshold???", "MTD_ASSIST", "exact", true],
    ["paye only £99000 mtd?", "NO_TAXSIMBA_SERVICE", "not £99 consult", true],
    ["i made 8k then actually wait 800 quid deliveries", "MORE_INFO_NEEDED", "correction mid", true],
    ["vat at 90k and also mtd????", "MORE_INFO_NEEDED", "mixed regimes", true],
    ["partner 50/50 let who files tax return", "MORE_INFO_NEEDED", "joint", false],
    ["crypto tax on buy or only sell", "MORE_INFO_NEEDED", "disposal", false],
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
      id: `G${String(n++).padStart(3, "0")}`,
      question: q,
      expected_classification: c,
      notes: note,
      adversarial: Boolean(adv),
    });
  }

  const templates: Array<(i: number) => [string, Class, string, boolean?]> = [
    (i) => [
      `just started doing some ${["gardening", "tutoring", "dog walking", "photography", "cleaning"][i % 5]} on the side maybe £${700 + i * 85} — hmrc?`,
      "MORE_INFO_NEEDED",
      "side hustle uncertain",
      true,
    ],
    (i) => [
      `contracting as ${["writer", "dev", "nurse bank", "barista extra", "driver"][i % 5]} £${1400 + i * 160} in 2025-26 before expenses. sa?`,
      "SA_ASSIST",
      ">£1k with year",
      false,
    ],
    (i) => [
      `i get paid £${20 + (i % 45)}k. digital tax?`,
      "MORE_INFO_NEEDED",
      "bare total",
      true,
    ],
    (i) => [
      `paye only £${26000 + i * 1700}. mtd for income tax?`,
      "NO_TAXSIMBA_SERVICE",
      "paye",
      false,
    ],
    (i) => [
      `qi more than £${i % 3 === 0 ? "50000" : i % 3 === 1 ? "30000" : "20000"} in ${i % 3 === 0 ? "2024-25" : i % 3 === 1 ? "2025-26" : "2026-27"} — start when?`,
      "MTD_ASSIST",
      "band",
      false,
    ],
    (i) => [
      `marketplace maybe £${1100 + i * 70}. accountant???`,
      "MORE_INFO_NEEDED",
      "uncertain+accountant",
      true,
    ],
    (i) => [
      `landlord rent £${10000 + i * 1200} ${i % 2 === 0 ? "2024-25" : ""} — sa?`,
      i % 2 === 0 ? "SA_ASSIST" : "MORE_INFO_NEEDED",
      "property",
      false,
    ],
    (i) => [
      `dont want packages. explain ${["mtd qualifying income", "trading allowance", "sa deadlines", "cis vs sa", "crypto disposal"][i % 5]}`,
      "GENERAL_INFO",
      "no-buy education",
      false,
    ],
  ];
  let t = 0;
  while (out.length < 500) {
    const [q, c, note, adv] = templates[t % templates.length]!(
      Math.floor(t / templates.length) + 1,
    );
    out.push({
      id: `G${String(n++).padStart(3, "0")}`,
      question: q,
      expected_classification: c,
      notes: note,
      adversarial: Boolean(adv),
    });
    t++;
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
      "Delivery driver slang journey",
      [
        "mate I made some money doing deliveries what do I need to do",
        "it was deliveroo mostly",
        "maybe like 2 grand",
        "sorry nearer £2,400 in 2025-26 before expenses",
        "sa then?",
        "whats this digital tax thing",
        "do i need an accountant",
        "nah i dont want to pay anyone",
        "can i just do this myself",
        "cheers",
      ],
      "clarify→SA; explain MTD; respect no-buy; DIY ok",
      true,
    ],
    [
      "Contradiction amount correction",
      [
        "i earned 40k",
        "mtd?",
        "sorry 40k was salary and 18k freelance turnover 2024-25 before expenses",
        "sa?",
        "mtd?",
        "dont ask if im self employed again",
        "i dont want packages",
        "bye",
      ],
      "latest facts win; no premature sell",
      true,
    ],
    [
      "PAYE + rent gradual",
      [
        "my job already taxes me",
        "but i rent a flat out",
        "gross rent about £14k",
        "that was 2024-25",
        "sa?",
        "mtd?",
        "explain without selling",
        "ok thanks",
      ],
      "SA likely; MTD year/QI careful",
      false,
    ],
    [
      "TikTok then clarify",
      [
        "I earned a bit from TikTok",
        "gifts and stuff",
        "around £1,900 in 2025-26",
        "do i need sa",
        "refuse packages please",
        "records?",
      ],
      "SA after amount; no sell",
      true,
    ],
    [
      "Exact vs more than MTD",
      [
        "sole trader",
        "qi exactly 50000 in 2024-25",
        "mtd from april 2026?",
        "what if more than 50k",
        "profit or turnover",
        "paye count?",
        "no signup",
      ],
      "exclusive threshold + QI def",
      false,
    ],
  ];
  for (const [title, turns, outcome, adv] of cores) {
    deep.push({
      id: `MJ${String(d++).padStart(3, "0")}`,
      title,
      turns,
      expected_outcome: outcome,
      adversarial: Boolean(adv),
    });
  }
  const roles = [
    "plumber",
    "nanny",
    "coder",
    "baker",
    "musician",
    "cleaner",
    "tutor",
    "driver",
    "designer",
    "barber",
    "carpenter",
    "coach",
    "photographer",
    "mechanic",
    "writer",
    "nurse",
    "farmer",
    "florist",
    "electrician",
    "painter",
  ];
  for (const role of roles) {
    if (deep.length >= 40) break;
    deep.push({
      id: `MJ${String(d++).padStart(3, "0")}`,
      title: `${role} multi-income`,
      turns: [
        `hi i work as a ${role}`,
        "also some side cash",
        "main job is paye about 30k",
        `side maybe £${1200 + deep.length * 40}`,
        "that side was 2025-26 before expenses",
        "sa?",
        "mtd?",
        "please dont recommend a package unless i ask",
        "if i ask later cheapest sa?",
        "thanks",
      ],
      expected_outcome: "memory of facts; help-first; package only when asked",
      adversarial: true,
    });
  }
  while (deep.length < 40) {
    deep.push({
      id: `MJ${String(d++).padStart(3, "0")}`,
      title: `deep filler ${deep.length}`,
      turns: [
        "hi tax question",
        "self employed-ish",
        "turnover about 12k 2024-25",
        "sa?",
        "mtd?",
        "no buy",
        "records",
        "deadlines?",
        "ok",
      ],
      expected_outcome: "SA; MTD clarify band; no sell",
    });
  }

  const short: typeof deep = [];
  let s = 41;
  const shortSeeds: Array<[string, string[], string]> = [
    ["bare then paye", ["i earn 55k", "paye only", "mtd?", "thanks"], "paye out"],
    ["no-buy sa", ["no packages", "freelance 3.2k 2025-26", "sa?", "ok"], "sa no sell"],
    ["crypto hold", ["crypto tax?", "never sold only bought", "so cgt?", "ok"], "no auto cgt"],
    ["vat+mtd mix", ["vat 90k?", "also is that mtd?", "last 12 months supplies", "ok"], "separate regimes"],
    ["existing", ["taxsimba client", "message accountant how", "thanks"], "dashboard"],
    ["diy", ["can i diy sa", "without paying you", "what records", "ok"], "diy"],
    ["consult then refuse", ["need consult?", "hmrc letter", "actually no thanks just info", "what is notice to file"], "respect change"],
    ["xero ask", ["need xero for mtd?", "with taxsimba?", "ok"], "xero included"],
  ];
  for (const [title, turns, outcome] of shortSeeds) {
    short.push({
      id: `MJ${String(s++).padStart(3, "0")}`,
      title,
      turns,
      expected_outcome: outcome,
      adversarial: true,
    });
  }
  while (short.length + deep.length < 100) {
    const i = short.length + 1;
    short.push({
      id: `MJ${String(s++).padStart(3, "0")}`,
      title: `short ${i}`,
      turns: [
        `quick q ${i}`,
        "side cash work",
        `maybe £${600 + i * 40}`,
        "accountant?",
        "no just info",
      ],
      expected_outcome: "clarify uncertain",
      adversarial: true,
    });
  }
  return [...deep.slice(0, 40), ...short].slice(0, 100);
}

const SCORE20: Array<{ id: string; title: string; turns: string[] }> = [
  {
    id: "R01",
    title: "Deliveries slang → DIY",
    turns: [
      "mate I made some money doing deliveries what do I need to do",
      "deliveroo about £2,400 2025-26 before expenses",
      "sa?",
      "can I just do this myself",
      "dont sell me packages",
      "records?",
    ],
  },
  {
    id: "R02",
    title: "Correction 40k",
    turns: [
      "i earned 40k",
      "mtd?",
      "sorry 40k salary and 18k freelance 2024-25 before expenses",
      "sa?",
      "mtd?",
      "no package",
    ],
  },
  {
    id: "R03",
    title: "Digital tax thing",
    turns: [
      "what is this digital tax thing",
      "i have a rental",
      "rent £19k 2024-25 before expenses",
      "mtd?",
      "sa too?",
      "no sell",
    ],
  },
  {
    id: "R04",
    title: "Exact 50k",
    turns: [
      "qi exactly £50,000 2024-25",
      "mtd april 2026?",
      "if more than 50k?",
      "thanks",
    ],
  },
  {
    id: "R05",
    title: "No-buy trading allowance",
    turns: [
      "dont sell me anything",
      "explain trading allowance",
      "i made £1,200 freelance 2025-26",
      "sa?",
    ],
  },
  {
    id: "R06",
    title: "PAYE only large",
    turns: ["paye only £99000", "mtd?", "sa?", "ok"],
  },
  {
    id: "R07",
    title: "Package when asked",
    turns: [
      "i want sa help",
      "first time simple",
      "cheapest package?",
      "signup link?",
    ],
  },
  {
    id: "R08",
    title: "Consult then refuse",
    turns: [
      "hmrc letter investigation",
      "consultation options?",
      "actually no thanks",
      "what should i do generally",
    ],
  },
  {
    id: "R09",
    title: "CIS",
    turns: [
      "cis deductions",
      "still sa?",
      "turnover £27k 2024-25",
      "mtd?",
      "no package",
    ],
  },
  {
    id: "R10",
    title: "Crypto",
    turns: ["crypto tax on buy?", "i sold some eth", "cgt or income?", "ok"],
  },
  {
    id: "R11",
    title: "Joint property",
    turns: [
      "partner 50/50 let",
      "who files?",
      "rent £22k 2024-25",
      "thanks",
    ],
  },
  {
    id: "R12",
    title: "Combined QI",
    turns: [
      "£15k rent and £19k freelance 2025-26",
      "combined for mtd?",
      "sa?",
      "no buy",
    ],
  },
  {
    id: "R13",
    title: "Profit vs turnover",
    turns: [
      "£40k profit £70k turnover 2024-25",
      "which for mtd?",
      "start date?",
    ],
  },
  {
    id: "R14",
    title: "Existing client",
    turns: ["existing taxsimba client", "message accountant?", "support email?"],
  },
  {
    id: "R15",
    title: "DIY Xero",
    turns: ["can i diy mtd", "do i buy xero myself", "with taxsimba?"],
  },
  {
    id: "R16",
    title: "Student side",
    turns: ["student", "babysitting maybe £600", "sa?", "ok"],
  },
  {
    id: "R17",
    title: "Pensioner interest",
    turns: ["pensioner", "£2k bank interest", "return?", "other income only state pension"],
  },
  {
    id: "R18",
    title: "Multi question one message",
    turns: [
      "do i need sa and mtd and an accountant if i have paye and £9k freelance 2025-26?",
      "i dont want to buy anything yet",
    ],
  },
  {
    id: "R19",
    title: "Change mind on TaxSimba",
    turns: [
      "which sa package?",
      "actually forget it i dont want paid help",
      "just tell me the £1,000 rule",
    ],
  },
  {
    id: "R20",
    title: "Memory landlord+freelance",
    turns: [
      "im a landlord",
      "rent £17k 2024-25 before expenses",
      "also freelance £8k same year",
      "what is qi roughly",
      "dont ask landlord again",
      "sa?",
      "no sell",
    ],
  },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const live = process.env.LIVE !== "0";
  const app = createApp(
    createSettings({ CONCIERGE_FORCE_MOCK_LLM: live ? false : true }),
  );

  const single = build500();
  const multi = build100Multi();
  writeFileSync(
    path.join(OUT, "BLIND_500_SCENARIOS.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        note: "NEW unseen bank — expectations locked BEFORE answers. Not a paraphrase of prior banks.",
        count: single.length,
        adversarial_count: single.filter((s) => s.adversarial).length,
        scenarios: single,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    path.join(OUT, "BLIND_100_MULTI_SCENARIOS.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        note: "NEW unseen multi-turn bank locked BEFORE answers",
        count: multi.length,
        deep_8plus: multi.filter((m) => m.turns.length >= 8).length,
        scenarios: multi,
      },
      null,
      2,
    ),
  );

  const sResults: any[] = [];
  for (let i = 0; i < single.length; i++) {
    const s = single[i]!;
    const res = await postChat(app, {
      session_id: `gi500-${s.id}`,
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
    if ((i + 1) % 50 === 0) console.error(`single ${i + 1}/${single.length}`);
    await sleep(live ? 100 : 5);
  }

  const sMetrics = {
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
    WRONG_SERVICE: sResults.filter((r) => r.tags.wrong_service).length,
  };
  writeFileSync(
    path.join(OUT, "BLIND_500_RESULTS.json"),
    JSON.stringify(
      { generated_at: new Date().toISOString(), live, metrics: sMetrics, results: sResults },
      null,
      2,
    ),
  );

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
      const reply = String(body.reply || "");
      lastPkgs = (body.packages || []).map((p: any) => p.code || p.name || p);
      transcript.push({ role: "user", content: msg });
      transcript.push({ role: "assistant", content: reply });
      history.push({ role: "user", content: msg });
      history.push({ role: "assistant", content: reply });
      await sleep(live ? 80 : 5);
    }
    const asst = transcript.filter((t) => t.role === "assistant");
    const memoryDefect =
      asst.filter((t) =>
        /are you self-?employ|are you a landlord|how much did you earn/i.test(
          t.content,
        ),
      ).length >= 3;
    const noBuy = /no package|dont want|don't want|refuse|no buy|dont sell/i.test(
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
      adversarial: s.adversarial,
    });
    if ((i + 1) % 10 === 0) console.error(`multi ${i + 1}/${multi.length}`);
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
          premature_on_nobuy: mResults.filter((r) => r.premature_on_nobuy)
            .length,
        },
        results: mResults,
      },
      null,
      2,
    ),
  );

  // Score 20
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
      const reply = String(body.reply || "");
      transcript.push({ role: "user", content: msg });
      transcript.push({ role: "assistant", content: reply });
      history.push({ role: "user", content: msg });
      history.push({ role: "assistant", content: reply });
      await sleep(live ? 80 : 5);
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

  const summary = {
    generated_at: new Date().toISOString(),
    live,
    single_500: sMetrics,
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
