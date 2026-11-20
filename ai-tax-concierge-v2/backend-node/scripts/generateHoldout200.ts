/**
 * Generate 200 unseen holdout scenarios with independent expected classifications.
 * Expected outcomes are written BEFORE any SIMBA run and must not be injected into prompts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(
  __dirname,
  "../../docs/verification/simba_v2_quality_proof/evidence/holdout200",
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

type Scenario = {
  id: string;
  question: string;
  topic: string;
  style: "simple" | "complicated" | "vague" | "incomplete" | "misleading" | "contradictory" | "multi_topic";
  expected_classification: Class;
  expected_tax_notes: string;
  official_sources: string[];
  multi_turn?: string[];
  run_multi_turn: boolean;
};

const sources = {
  saWho: "https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return",
  trading: "https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income",
  mtd: "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
  mtdQi: "https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax",
  property: "https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-working-out-your-rental-income",
  cis: "https://www.gov.uk/what-is-the-construction-industry-scheme",
  crypto: "https://www.gov.uk/guidance/check-if-you-need-to-pay-tax-when-you-sell-cryptoassets",
  deadlines: "https://www.gov.uk/self-assessment-tax-returns/deadlines",
  penalties: "https://www.gov.uk/self-assessment-tax-returns/penalties",
  dividends: "https://www.gov.uk/tax-on-dividends",
  vat: "https://www.gov.uk/vat-registration-thresholds",
  register: "https://www.gov.uk/register-for-self-assessment",
};

function S(
  n: number,
  question: string,
  topic: string,
  style: Scenario["style"],
  expected_classification: Class,
  expected_tax_notes: string,
  official_sources: string[],
  multi_turn?: string[],
  forceMulti = false,
): Scenario {
  return {
    id: `H${String(n).padStart(3, "0")}`,
    question,
    topic,
    style,
    expected_classification,
    expected_tax_notes,
    official_sources,
    multi_turn,
    run_multi_turn: forceMulti || Boolean(multi_turn?.length),
  };
}

const scenarios: Scenario[] = [];
let n = 1;

// --- Natural language / informal (mandatory examples + variants) ---
scenarios.push(
  S(n++, "I work full-time but make money on TikTok. Do I need to tell HMRC?", "gig", "vague", "MORE_INFO_NEEDED", "Need turnover amount/tax year; if self-employment >£1,000 usually SA.", [sources.saWho, sources.trading]),
  S(n++, "I rent out my flat but my employer already takes tax.", "property", "misleading", "MORE_INFO_NEEDED", "PAYE does not tax rental; property income usually needs SA. Ask rent amount/year.", [sources.property, sources.saWho]),
  S(n++, "I earn £55k. Does this new digital tax thing apply to me?", "mtd", "vague", "MORE_INFO_NEEDED", "£55k alone unclear — need income type (PAYE vs self-emp/property) and tax year for MTD QI.", [sources.mtd, sources.mtdQi]),
  S(n++, "I’m an Uber driver. Do I need an accountant?", "gig", "simple", "MORE_INFO_NEEDED", "Likely self-employed; SA if >£1,000. Accountant optional — TaxSimba SA possible; don’t force Elite.", [sources.saWho]),
  S(n++, "I haven’t done my tax for two years. What happens?", "penalties", "complicated", "ACCOUNTANT_CONSULTATION", "Late filing/payment penalties likely; urge check GOV.UK + consider consultation for backlog.", [sources.penalties, sources.deadlines]),
  S(n++, "I sell things online. Do I have to pay tax?", "trading", "vague", "MORE_INFO_NEEDED", "Depends if trading vs hobby and amounts; >£1,000 trading usually SA.", [sources.saWho, sources.trading]),
  S(n++, "I have two jobs and a side business.", "multi", "incomplete", "MORE_INFO_NEEDED", "Need side-business turnover; PAYE jobs alone may not need SA.", [sources.saWho]),
  S(n++, "I want someone to do everything for me.", "service", "simple", "SA_ASSIST", "Intent for full-service — explain accountant-led TaxSimba; clarify SA vs MTD after facts.", []),
  S(n++, "I already use Xero. Can TaxSimba still help?", "mtd", "simple", "MTD_ASSIST", "TaxSimba uses Xero for MTD; existing Xero may still fit Simbian — clarify, don’t invent dual software fees.", []),
  S(n++, "I received an HMRC letter and don’t understand it.", "hmrc", "vague", "ACCOUNTANT_CONSULTATION", "Cannot interpret personal HMRC letter contents safely — escalate consultation/support.", []),
);

// Employment / PAYE
const payeQs: Array<[string, Class, string]> = [
  ["My only income is PAYE salary £42,000. Do I need Self Assessment?", "NO_TAXSIMBA_SERVICE", "PAYE-only usually no SA."],
  ["PAYE £90,000 only — do I need Making Tax Digital?", "NO_TAXSIMBA_SERVICE", "PAYE not QI for MTD ITSA."],
  ["I got a P60. What do I do with it?", "MORE_INFO_NEEDED", "P60 is employment summary; SA only if other triggers."],
  ["Does having two PAYE jobs mean I must file a tax return?", "MORE_INFO_NEEDED", "Not automatically; undertaxed PAYE / other income can trigger SA."],
  ["My employer underpaid my tax. Do I need an accountant?", "MORE_INFO_NEEDED", "May be PAYE reconciliation; not automatically TaxSimba SA."],
  ["I left my job mid-year. Do I still need Self Assessment?", "MORE_INFO_NEEDED", "Leaving job alone ≠ SA; ask other income."],
  ["Company car benefit — is that Self Assessment?", "MORE_INFO_NEEDED", "Often via PAYE/P11D; confirm other income."],
  ["I only have PAYE and £200 bank interest. SA?", "MORE_INFO_NEEDED", "Small interest often covered; check GOV.UK who-must-send."],
];
for (const [q, c, note] of payeQs) {
  scenarios.push(S(n++, q, "paye", "simple", c, note, [sources.saWho, sources.mtdQi]));
}

// Self-employment / freelance
const se: Array<[string, Class, string, Scenario["style"]]> = [
  ["Freelance turnover about £8,000 in 2025-26 plus PAYE job. Do I register for Self Assessment?", "SA_ASSIST", "£8k > £1,000 → usually SA. Trading allowance ≠ waiver.", "simple"],
  ["I made £900 selling crafts this year. Do I need to register?", "NO_TAXSIMBA_SERVICE", "£900 not more than £1,000 (other triggers aside).", "simple"],
  ["Exactly £1,000 freelance. Am I below the trading allowance so no SA?", "MORE_INFO_NEEDED", "Exact £1,000 is boundary for ‘more than £1,000’; don’t say below allowance.", "misleading"],
  ["My turnover is £50,000 but expenses are £49,000 so profit is tiny — surely no Self Assessment?", "SA_ASSIST", "Turnover >£1,000 still usually SA.", "misleading"],
  ["I started freelancing last month. When do I register?", "SA_ASSIST", "Register by 5 Oct after tax year you started if required.", "simple"],
  ["Do I need MTD if my sole-trader turnover was £52,000 in 2024-25?", "MTD_ASSIST", "More than £50k 2024-25 → MTD from 6 Apr 2026; also usually SA.", "simple"],
  ["Sole trader £28,000 in 2024-25 — MTD from April 2026?", "NO_TAXSIMBA_SERVICE", "£28k not more than £50k for 2026 cohort; may hit later bands.", "simple"],
  ["I’m a sole trader earning exactly £50,000 in 2024-25. Am I over the MTD threshold?", "NO_TAXSIMBA_SERVICE", "Exact £50k is not more than £50k.", "simple"],
  ["Can I use the £1,000 trading allowance instead of registering?", "MORE_INFO_NEEDED", "Allowance is relief; if earned >£1,000 usually still register.", "misleading"],
  ["I invoice as a sole trader through an app. Is that CIS?", "MORE_INFO_NEEDED", "CIS is construction-specific — clarify trade.", "vague"],
];
for (const [q, c, note, style] of se) {
  scenarios.push(S(n++, q, "self_employment", style, c, note, [sources.saWho, sources.trading, sources.mtd, sources.register]));
}

// Property
const prop: Array<[string, Class, string]> = [
  ["Buy-to-let rent £18,000 before expenses 2024-25 and PAYE job — Self Assessment?", "SA_ASSIST", "Property income usually SA."],
  ["Rent £18,000 — do I need MTD for landlords from April 2026?", "NO_TAXSIMBA_SERVICE", "£18k not more than £50k for 2026 band."],
  ["I let a room in my home. Do I need TaxSimba?", "MORE_INFO_NEEDED", "Rent-a-room / amounts matter."],
  ["Property income £60,000 2024-25 — MTD?", "BOTH_SA_AND_MTD", "SA yes; QI >£50k → MTD Apr 2026."],
  ["My tenant pays me cash. How do I report it?", "SA_ASSIST", "Still taxable rental income — SA records."],
  ["Do allowable property expenses reduce my MTD qualifying income?", "MORE_INFO_NEEDED", "QI is typically before expenses — confirm GOV.UK QI page."],
];
for (const [q, c, note] of prop) {
  scenarios.push(S(n++, q, "property", "simple", c, note, [sources.property, sources.saWho, sources.mtdQi]));
}

// MTD wording informal
scenarios.push(
  S(n++, "What’s this Making Tax Digital thing I keep hearing about?", "mtd", "vague", "MORE_INFO_NEEDED", "Explain MTD ITSA high-level; ask income type/amount/year.", [sources.mtd]),
  S(n++, "Do I need special software for tax now?", "mtd", "vague", "MORE_INFO_NEEDED", "May refer to MTD; ask if self-emp/property and QI.", [sources.mtd]),
  S(n++, "HMRC said something about quarterly updates — is that me?", "mtd", "incomplete", "MORE_INFO_NEEDED", "Quarterly updates = MTD ITSA if in scope.", [sources.mtd]),
  S(n++, "I have PAYE £50,000 and freelance £2,000. Add them for MTD?", "mtd", "misleading", "NO_TAXSIMBA_SERVICE", "Do not add PAYE to QI; £2k alone not MTD bands.", [sources.mtdQi]),
  S(n++, "More than £50,000 turnover 2024-25 — when does MTD start?", "mtd", "simple", "MTD_ASSIST", "From 6 April 2026.", [sources.mtd]),
);

// CIS
scenarios.push(
  S(n++, "I’m CIS and tax is already deducted. Why would I file a return?", "cis", "misleading", "SA_ASSIST", "CIS deductions ≠ automatic SA exemption for subcontractors.", [sources.cis, sources.saWho]),
  S(n++, "CIS refund — can TaxSimba get my money back?", "cis", "vague", "MORE_INFO_NEEDED", "May be SA; don’t promise refund amounts.", [sources.cis]),
  S(n++, "I’m a limited company CIS contractor. Can you do my Corporation Tax?", "cis", "simple", "OUT_OF_SCOPE", "Corp tax/limited company accounts not TaxSimba catalogue default.", []),
);

// Crypto / investments / pensions / overseas
scenarios.push(
  S(n++, "I sold Bitcoin for a profit. How much tax do I owe?", "crypto", "complicated", "ACCOUNTANT_CONSULTATION", "Need disposal history/costs; don’t invent liability.", [sources.crypto]),
  S(n++, "Do I pay tax when I buy crypto or only when I sell?", "crypto", "simple", "MORE_INFO_NEEDED", "Usually disposal events; check GOV.UK crypto guidance.", [sources.crypto]),
  S(n++, "Dividend income £2,000 — Self Assessment?", "investments", "incomplete", "MORE_INFO_NEEDED", "Depends on total income/other factors — who-must-send.", [sources.dividends, sources.saWho]),
  S(n++, "I took a pension lump sum. What’s my tax?", "pensions", "complicated", "ACCOUNTANT_CONSULTATION", "Pension taxation fact-specific.", []),
  S(n++, "I worked abroad for 6 months. UK tax?", "overseas", "complicated", "ACCOUNTANT_CONSULTATION", "Residence/domicile — professional advice.", []),
  S(n++, "Foreign rental income — do I need Self Assessment?", "overseas", "incomplete", "MORE_INFO_NEEDED", "Often yes for UK residents — confirm residence.", [sources.saWho]),
);

// Deadlines / penalties / letters
scenarios.push(
  S(n++, "When is the Self Assessment deadline?", "deadlines", "simple", "NO_TAXSIMBA_SERVICE", "Typically 31 January online for prior tax year — state year carefully.", [sources.deadlines]),
  S(n++, "I missed the January deadline. What now?", "penalties", "simple", "SA_ASSIST", "Penalties accrue; file ASAP; TaxSimba may help SA.", [sources.penalties]),
  S(n++, "HMRC charged me a late filing penalty. Is that fair?", "penalties", "complicated", "ACCOUNTANT_CONSULTATION", "Appeal/facts — escalate.", [sources.penalties]),
  S(n++, "I got a brown envelope from HMRC about a tax investigation.", "hmrc", "complicated", "ACCOUNTANT_CONSULTATION", "Investigation — professional help.", []),
);

// VAT / out of scope
scenarios.push(
  S(n++, "Do I need to register for VAT at £85,000 turnover?", "vat", "simple", "MORE_INFO_NEEDED", "Check current VAT threshold on GOV.UK (historically £90k) — verify page.", [sources.vat]),
  S(n++, "Can TaxSimba do my limited company accounts?", "out_of_scope", "simple", "OUT_OF_SCOPE", "Not approved catalogue CT filing.", []),
  S(n++, "I need help with Immigration / visa taxes.", "out_of_scope", "simple", "OUT_OF_SCOPE", "Outside TaxSimba SA/MTD services.", []),
  S(n++, "Can you recommend a will writer?", "out_of_scope", "simple", "OUT_OF_SCOPE", "Outside scope.", []),
);

// TaxSimba services / packages / support
scenarios.push(
  S(n++, "Which TaxSimba Self Assessment package is cheapest?", "packages", "simple", "SA_ASSIST", "Simple £119/year from catalogue — only when asking packages.", []),
  S(n++, "Compare all your packages and dump every price.", "packages", "simple", "MORE_INFO_NEEDED", "Prefer not full dump unless asked; if asked, catalogue only.", []),
  S(n++, "I already know I need Self Assessment help.", "packages", "simple", "SA_ASSIST", "Help-first; don’t SKU on turn 1 unless asked which package.", []),
  S(n++, "Book me a consultation for tomorrow and take payment now.", "consultation", "misleading", "ACCOUNTANT_CONSULTATION", "Must not invent booking/payment; give Calendly/consult prices only.", []),
  S(n++, "I’m an existing TaxSimba client — where do I upload documents?", "support", "simple", "EXISTING_CUSTOMER_SUPPORT", "Dashboard/support — no new package push.", []),
  S(n++, "My login doesn’t work.", "support", "simple", "EXISTING_CUSTOMER_SUPPORT", "Support route info@ / dashboard.", []),
  S(n++, "Do you file directly to HMRC from the TaxSimba website?", "service", "simple", "MORE_INFO_NEEDED", "Accountant-led; TaxCalc/Xero internally; portal not direct DIY HMRC filing claim.", []),
  S(n++, "Is Xero included in Simbian Comply?", "packages", "simple", "MTD_ASSIST", "Catalogue: Xero included in Simbian monthly — verify wording.", []),
  S(n++, "I do not want any package — just tell me if I need SA for £8k freelance.", "sa", "simple", "NO_TAXSIMBA_SERVICE", "Answer SA yes; zero packages.", [sources.saWho]),
  S(n++, "Sign me up for both Simple SA and Simbian even if I only have PAYE.", "packages", "misleading", "NO_TAXSIMBA_SERVICE", "Must not sell unnecessary duplicate; PAYE-only usually neither.", [sources.saWho]),
);

// Contradictory / multi-topic
scenarios.push(
  S(n++, "I have no self-employment income. Also my freelance made £12,000. Do I need SA?", "contradiction", "contradictory", "MORE_INFO_NEEDED", "Contradiction — clarify which is true before concluding.", [sources.saWho]),
  S(n++, "I said earlier turnover was £40k but actually it was £55k for 2024-25. MTD?", "mtd", "contradictory", "MTD_ASSIST", "Use corrected £55k >£50k → Apr 2026.", [sources.mtd]),
  S(n++, "Landlord and Uber driver and PAYE — what do I need?", "multi_topic", "multi_topic", "MORE_INFO_NEEDED", "Need amounts per stream and years for SA/MTD.", [sources.saWho, sources.mtd]),
  S(n++, "Tell me everything about tax and also sell me your best package.", "multi_topic", "multi_topic", "MORE_INFO_NEEDED", "Don’t dump catalogue; ask primary need.", []),
);

// Fill to 200 with varied informal scenarios
const fillers: Array<[string, string, Class, string, string[]]> = [
  ["Is Christmas party tip income taxable?", "employment", "MORE_INFO_NEEDED", "Tips can be taxable — facts needed.", [sources.saWho]],
  ["I swapped services with a friend instead of invoicing. Taxable?", "trading", "MORE_INFO_NEEDED", "Barter can be taxable trading.", [sources.saWho]],
  ["OnlyFans income — Self Assessment?", "gig", "MORE_INFO_NEEDED", "Likely self-employment if >£1,000.", [sources.saWho]],
  ["Etsy shop £3,500 sales — register?", "trading", "SA_ASSIST", ">£1,000 usually SA.", [sources.saWho]],
  ["I inherited a house and rent it now.", "property", "SA_ASSIST", "Rental usually SA.", [sources.property]],
  ["Student with £1,500 tutoring.", "gig", "SA_ASSIST", ">£1,000 usually SA.", [sources.saWho]],
  ["Retired, only state pension.", "pensions", "MORE_INFO_NEEDED", "Often no SA; check other income.", [sources.saWho]],
  ["Do I need MTD for VAT?", "vat", "MORE_INFO_NEEDED", "MTD VAT separate from ITSA — clarify.", [sources.vat]],
  ["What’s the difference between Self Assessment and MTD?", "mtd", "MORE_INFO_NEEDED", "Explain both at high level.", [sources.mtd, sources.saWho]],
  ["Can I do my own tax on GOV.UK for free?", "sa", "NO_TAXSIMBA_SERVICE", "Yes DIY possible; TaxSimba optional.", [sources.register]],
  ["I need Corporation Tax and payroll for my Ltd.", "out_of_scope", "OUT_OF_SCOPE", "Outside approved SA/MTD personal services.", []],
  ["How do I appeal a penalty?", "penalties", "ACCOUNTANT_CONSULTATION", "Process on GOV.UK; complex → consult.", [sources.penalties]],
  ["What software do you use to file?", "service", "MORE_INFO_NEEDED", "TaxCalc SA / Xero MTD internally.", []],
  ["Is consultation free?", "consultation", "ACCOUNTANT_CONSULTATION", "No — £99/£149 catalogue.", []],
  ["Call me back about my taxes.", "consultation", "MORE_INFO_NEEDED", "No phone onboarding promise; email/consult links.", []],
  ["I’m PAYE but got £600 interest from peer-to-peer lending.", "investments", "MORE_INFO_NEEDED", "May need SA depending on totals.", [sources.saWho]],
  ["High Income Child Benefit Charge — help?", "sa", "ACCOUNTANT_CONSULTATION", "HICBC often via SA — fact specific.", [sources.saWho]],
  ["I transferred a property to my spouse. CGT?", "property", "ACCOUNTANT_CONSULTATION", "CGT/spouse rules — advice.", []],
  ["Do you guarantee no HMRC enquiry?", "service", "NO_TAXSIMBA_SERVICE", "Must not guarantee.", []],
  ["What’s your phone number for onboarding?", "support", "EXISTING_CUSTOMER_SUPPORT", "No phone onboarding — email/dashboard.", []],
];

for (const [q, topic, c, note, src] of fillers) {
  if (scenarios.length >= 160) break;
  scenarios.push(S(n++, q, topic, "simple", c, note, src));
}

// More to reach 200
const templates: Array<(i: number) => Scenario> = [
  (i) => S(n++, `Side hustle about £${1000 + i * 250} last year — do I need to tell HMRC?`, "gig", "incomplete", i * 250 + 1000 > 1000 ? "SA_ASSIST" : "MORE_INFO_NEEDED", `Amount £${1000 + i * 250} vs £1,000 threshold.`, [sources.saWho], undefined, false),
  (i) => S(n++, `Property rent roughly £${10000 + i * 5000} — MTD?`, "property", "incomplete", "MORE_INFO_NEEDED", "Need tax year for band; ask year.", [sources.mtd], undefined, false),
  (i) => S(n++, `I earn £${30 + i}k — am I a higher-rate taxpayer and does that change MTD?`, "mtd", "misleading", "MORE_INFO_NEEDED", "MTD uses QI not PAYE tax band alone.", [sources.mtdQi]),
];

let t = 0;
while (scenarios.length < 200) {
  scenarios.push(templates[t % templates.length]!(Math.floor(t / templates.length) + 1));
  t++;
}

// Select 50 for multi-turn journeys
const multiIds = new Set<string>();
const prefer = scenarios.filter((s) =>
  ["MORE_INFO_NEEDED", "SA_ASSIST", "MTD_ASSIST", "BOTH_SA_AND_MTD", "ACCOUNTANT_CONSULTATION"].includes(
    s.expected_classification,
  ),
);
for (const s of prefer) {
  if (multiIds.size >= 50) break;
  multiIds.add(s.id);
  if (!s.multi_turn?.length) {
    // Generic clarifying follow-ups
    if (s.expected_classification === "MORE_INFO_NEEDED") {
      s.multi_turn = [
        "It was self-employment / freelancing, about £8,000 before expenses for 2025-26.",
        "Do I need Self Assessment then?",
        "I do not want a paid package — just the answer.",
      ];
    } else if (s.expected_classification === "MTD_ASSIST" || s.expected_classification === "BOTH_SA_AND_MTD") {
      s.multi_turn = [
        "That figure is self-employment turnover before expenses for 2024-25.",
        "So do I need Making Tax Digital from April 2026?",
        "What would TaxSimba do for me if I wanted help?",
      ];
    } else if (s.expected_classification === "SA_ASSIST") {
      s.multi_turn = [
        "Yes, sole trader / freelance.",
        "Which package fits a simple first-time filer?",
        "Where do I register?",
      ];
    } else {
      s.multi_turn = [
        "Can you explain what I should do next?",
        "Should I book a consultation?",
      ];
    }
    s.run_multi_turn = true;
  }
}
// Force exactly 50 flags
for (const s of scenarios) {
  s.run_multi_turn = multiIds.has(s.id);
}

scenarios.splice(200);
// renumber ids
scenarios.forEach((s, i) => {
  s.id = `H${String(i + 1).padStart(3, "0")}`;
});
// re-apply 50 multi on first 50 eligible after renumber
let mc = 0;
for (const s of scenarios) {
  if (mc < 50 && s.multi_turn?.length) {
    s.run_multi_turn = true;
    mc++;
  } else if (!s.multi_turn?.length) {
    s.run_multi_turn = false;
  }
}
// ensure 50
mc = scenarios.filter((s) => s.run_multi_turn).length;
if (mc < 50) {
  for (const s of scenarios) {
    if (mc >= 50) break;
    if (!s.run_multi_turn) {
      s.multi_turn = [
        "For 2025-26 it was about £8,000 self-employment turnover.",
        "Do I need Self Assessment?",
        "Please do not recommend a package.",
      ];
      s.run_multi_turn = true;
      mc++;
    }
  }
}

mkdirSync(OUT_DIR, { recursive: true });
const payload = {
  generated_at: new Date().toISOString(),
  purpose: "Unseen holdout — not used to develop T001–T400. Expected classifications set BEFORE SIMBA run.",
  count: scenarios.length,
  multi_turn_count: scenarios.filter((s) => s.run_multi_turn).length,
  scenarios,
};
writeFileSync(path.join(OUT_DIR, "HOLDOUT_200_SCENARIOS.json"), JSON.stringify(payload, null, 2));

// Human-readable questions list
const md = [
  `# Holdout 200 unseen scenarios (expectations BEFORE SIMBA run)`,
  ``,
  `Count: ${scenarios.length}. Multi-turn flagged: ${scenarios.filter((s) => s.run_multi_turn).length}.`,
  ``,
  `| ID | Class | Topic | Question |`,
  `|----|-------|-------|----------|`,
  ...scenarios.map(
    (s) =>
      `| ${s.id} | ${s.expected_classification} | ${s.topic} | ${s.question.replace(/\|/g, "/")} |`,
  ),
].join("\n");
writeFileSync(path.join(OUT_DIR, "HOLDOUT_200_SCENARIOS.md"), md);
console.log(JSON.stringify({ out: OUT_DIR, count: scenarios.length, multi: scenarios.filter((s) => s.run_multi_turn).length }, null, 2));
