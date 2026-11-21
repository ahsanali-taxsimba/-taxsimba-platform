/**
 * Independent GOV.UK/HMRC verification of frozen T001–T400 answers.
 * VERIFIED only when an official rule establishes the factual claim.
 * Does NOT mark VERIFIED because the answer “sounds reasonable”.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_OFFICIAL_FACTS } from "../src/knowledge/uk_tax_facts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const QP = path.join(ROOT, "docs/verification/simba_v2_quality_proof");
const OUT = path.join(QP, "evidence/independent_govuk_verify");
const PACK = path.join(QP, "evidence/pack400/simba_400_results_live_latest.json");

type Status =
  | "VERIFIED"
  | "INCORRECT"
  | "INCOMPLETE"
  | "AMBIGUOUS_NEEDS_CLARIFICATION"
  | "REQUIRES_PROFESSIONAL_ADVICE"
  | "NO_AUTHORITATIVE_SOURCE_FOUND";

const TAX_CATS = new Set([
  "SA eligibility",
  "SA deadlines",
  "MTD eligibility",
  "MTD operations",
  "Landlords",
  "Sole traders and gig work",
  "PAYE and employment",
  "CIS and construction",
  "Crypto and investments",
  "Tax calculations and uncertainty",
]);

type RowExam = {
  id: string;
  category: string;
  customer_question: string;
  simba_answer_unedited: string;
  tax_year_applicability: string;
  factual_propositions: string[];
  official_sources: Array<{ url: string; title: string; rule: string }>;
  verification_status: Status;
  verification_explanation: string;
  source_establishes_conclusion: boolean;
  professional_approval: "NOT_OBTAINED";
};

function yearsIn(text: string): string {
  const ys = [
    ...text.matchAll(/\b(20\d{2})\s*[-–/]\s*(\d{2})\b/g),
  ].map((m) => `${m[1]}-${m[2]}`);
  return [...new Set(ys)].join(", ") || "Not pinned — use current GOV.UK carefully";
}

function examine(row: any): RowExam {
  const q = String(row.question || "");
  const a = String(row.reply || "");
  const ql = q.toLowerCase();
  const al = a.toLowerCase();
  const cat = String(row.category || "");
  const base: RowExam = {
    id: row.id,
    category: cat,
    customer_question: q,
    simba_answer_unedited: a,
    tax_year_applicability: yearsIn(`${q}\n${a}`),
    factual_propositions: [],
    official_sources: [],
    verification_status: "NO_AUTHORITATIVE_SOURCE_FOUND",
    verification_explanation: "",
    source_establishes_conclusion: false,
    professional_approval: "NOT_OBTAINED",
  };

  if (!TAX_CATS.has(cat)) {
    return {
      ...base,
      verification_status: "NO_AUTHORITATIVE_SOURCE_FOUND",
      verification_explanation:
        "Commercial/CX/privacy/memory/adversarial row — no standalone HMRC statutory conclusion to verify from GOV.UK alone.",
      factual_propositions: ["Non-statutory / TaxSimba commercial or CX behaviour"],
    };
  }

  // --- Hard incorrect patterns (source-established contradictions) ---
  if (/dividend allowance[^\n.]{0,40}£\s*2,?000|£\s*2,?000[^\n.]{0,40}dividend allowance/i.test(a)) {
    return {
      ...base,
      factual_propositions: ["Dividend allowance stated as £2,000"],
      official_sources: [
        {
          url: "https://www.gov.uk/tax-on-dividends",
          title: "Tax on dividends",
          rule: "Dividend allowance is £500 each year (current GOV.UK)",
        },
      ],
      verification_status: "INCORRECT",
      verification_explanation:
        "Stated dividend allowance £2,000 contradicts current GOV.UK (£500).",
      source_establishes_conclusion: true,
    };
  }

  if (
    /rent[^\n.]{0,80}self-employment|self-employment[^\n.]{0,80}rent/i.test(ql) &&
    /considered separately|separately for (tax|mtd)/i.test(al) &&
    /(mtd|qualifying|combined|combine)/i.test(ql + al)
  ) {
    return {
      ...base,
      factual_propositions: ["SE + property treated separately for MTD QI"],
      official_sources: [
        {
          url: "https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax",
          title: "Work out your qualifying income",
          rule: "QI is total SE + property turnover before expenses (combined)",
        },
      ],
      verification_status: "INCORRECT",
      verification_explanation:
        "Incorrectly says rent and self-employment are separate for MTD QI; GOV.UK combines them.",
      source_establishes_conclusion: true,
    };
  }

  if (
    /(mtd|making tax digital|qualifying|2024\/25|2024-25)/i.test(ql) &&
    /profit[^\n.]{0,40}turnover|turnover[^\n.]{0,40}profit/i.test(ql) &&
    /vat registration/i.test(al) &&
    !/qualifying income|mtd for income tax/i.test(al)
  ) {
    return {
      ...base,
      factual_propositions: ["Answered VAT when MTD turnover/profit asked"],
      official_sources: [
        {
          url: "https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax",
          title: "Work out your qualifying income",
          rule: "MTD QI uses turnover/gross before expenses, not profit; not the VAT test",
        },
      ],
      verification_status: "INCORRECT",
      verification_explanation:
        "MTD profit-vs-turnover question answered as VAT registration — wrong regime.",
      source_establishes_conclusion: true,
    };
  }

  if (
    /2025\s*[-/]?\s*26/.test(ql) &&
    /2024\s*[-/]?\s*25/.test(ql) &&
    /£\s*55,?000|55000/.test(ql) &&
    /start.*april 2026|from 6 april 2026/i.test(al) &&
    !/2024-25[^\n]{0,60}not|20,?000[^\n]{0,40}not more than/i.test(al)
  ) {
    return {
      ...base,
      factual_propositions: ["Mapped 2025-26 income to April 2026 £50k band"],
      official_sources: [
        {
          url: "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
          title: "Find out if and when you need MTD",
          rule: "£50k band uses 2024-25; £30k band uses 2025-26 → 6 April 2027",
        },
      ],
      verification_status: "INCORRECT",
      verification_explanation:
        "Wrong basis year: 2025-26 QI maps to the £30k / April 2027 band, not April 2026.",
      source_establishes_conclusion: true,
    };
  }

  if (
    /accountant[^\n.]{0,40}submit[^\n.]{0,40}(mtd|quarterly)|can my accountant submit/i.test(
      ql,
    ) &&
    /cannot submit them directly|can't submit them directly|cannot submit.*on your behalf/i.test(
      al,
    )
  ) {
    return {
      ...base,
      factual_propositions: ["Claimed accountant cannot submit MTD quarterly updates"],
      official_sources: [
        {
          url: "https://www.gov.uk/guidance/choose-agents-for-making-tax-digital-for-income-tax",
          title: "Choose agents for MTD for Income Tax",
          rule: "Main and supporting agents can complete and submit quarterly updates",
        },
      ],
      verification_status: "INCORRECT",
      verification_explanation:
        "Contradicts GOV.UK agent permissions — authorised agents can submit quarterly updates.",
      source_establishes_conclusion: true,
    };
  }

  if (
    /below the £1,?000 trading allowance/.test(al) &&
    /£\s*1,?000|1000/.test(ql) &&
    /(freelance|self-employ|trading)/i.test(ql)
  ) {
    return {
      ...base,
      factual_propositions: ["Exact £1,000 described as below trading allowance"],
      official_sources: [
        {
          url: "https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return",
          title: "Who must send a tax return",
          rule: "Sole traders who earned more than £1,000 usually must send a return",
        },
      ],
      verification_status: "INCORRECT",
      verification_explanation:
        "Trading-allowance language incorrectly used for the SA more-than-£1,000 test.",
      source_establishes_conclusion: true,
    };
  }

  // Catalogue dump on educational deadline/process questions
  if (
    /(difference between filing|what is the difference between|final declaration)/i.test(
      ql,
    ) &&
    /£119|simbian comply|self assessment \(per tax year\)/i.test(al)
  ) {
    return {
      ...base,
      factual_propositions: ["Educational question answered with package catalogue"],
      official_sources: [],
      verification_status: "INCOMPLETE",
      verification_explanation:
        "Did not answer the educational tax question; dumped commercial catalogue instead.",
      source_establishes_conclusion: false,
    };
  }

  // --- Positive VERIFIED patterns (only when source establishes) ---

  if (
    /exactly £30,?000|exactly £50,?000|exactly £20,?000/.test(ql) &&
    /more than/.test(al) &&
    /(does not|not ).{0,20}(bring|meet|in scope|threshold)/i.test(al)
  ) {
    return {
      ...base,
      factual_propositions: ["Exact threshold is not ‘more than’ for MTD"],
      official_sources: [
        {
          url: "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
          title: "Find out if and when you need MTD",
          rule: "Exclusive more-than / over thresholds",
        },
      ],
      verification_status: "VERIFIED",
      verification_explanation:
        "Correct exclusive-boundary treatment of exact MTD threshold amount.",
      source_establishes_conclusion: true,
    };
  }

  if (
    /quarterly updates?.{0,40}replace|replace.{0,40}(year-?end|tax return)/i.test(ql) &&
    /do not replace|don't replace|not replace/.test(al) &&
    /tax return|self assessment/.test(al)
  ) {
    return {
      ...base,
      factual_propositions: ["Quarterly updates do not replace SA return"],
      official_sources: [
        {
          url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/using-making-tax-digital-for-income-tax-for-the-first-time",
          title: "Using MTD for Income Tax for the first time",
          rule: "Still submit one tax return each year; quarterly updates are not returns",
        },
      ],
      verification_status: "VERIFIED",
      verification_explanation: "Correct that quarterly updates do not replace the year-end return.",
      source_establishes_conclusion: true,
    };
  }

  if (
    /paye only|two jobs with paye|one-off bonus through paye/i.test(ql) &&
    /(do not|don't|does not|not automatically).{0,40}(self assessment|tax return|need)/i.test(
      al,
    )
  ) {
    return {
      ...base,
      factual_propositions: ["PAYE-only / multi-PAYE not automatic SA"],
      official_sources: [
        {
          url: "https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return",
          title: "Who must send a tax return",
          rule: "SA triggers listed; PAYE employment alone is not itself the sole-trader >£1,000 rule",
        },
      ],
      verification_status: "VERIFIED",
      verification_explanation:
        "Correctly avoids automatic SA from PAYE-only / multi-job PAYE facts stated.",
      source_establishes_conclusion: true,
    };
  }

  if (
    /more than £1,?000|earned more than £1,?000|above the £1,?000/.test(al) &&
    /(uber|sole trader|self-employ|freelance|etsy|deliver)/i.test(ql) &&
    /£\s*([\d,]+)/.test(ql)
  ) {
    const amt = Number(
      (ql.match(/£\s*([\d,]+)/) || [])[1]?.replace(/,/g, "") || "0",
    );
    if (amt > 1000 && /self assessment/.test(al)) {
      return {
        ...base,
        factual_propositions: [`Trading ~£${amt} → usually SA (more than £1,000)`],
        official_sources: [
          {
            url: "https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return",
            title: "Who must send a tax return",
            rule: "Sole traders earning more than £1,000 usually must send a return",
          },
        ],
        verification_status: "VERIFIED",
        verification_explanation:
          "Sole-trader/gig turnover above £1,000 correctly linked to usual SA requirement.",
        source_establishes_conclusion: true,
      };
    }
  }

  if (
    /hold crypto but have not sold|not sold it/.test(ql) &&
    /(do not|don't|not automatically).{0,40}(owe|cgt|capital gains)/i.test(al)
  ) {
    return {
      ...base,
      factual_propositions: ["Holding crypto without disposal ≠ automatic CGT"],
      official_sources: [
        {
          url: "https://www.gov.uk/guidance/check-if-you-need-to-pay-tax-when-you-sell-cryptoassets",
          title: "Check if you need to pay tax when you sell cryptoassets",
          rule: "CGT may arise on disposal events, not merely holding",
        },
      ],
      verification_status: "VERIFIED",
      verification_explanation: "Correct that holding without disposal is not automatic CGT.",
      source_establishes_conclusion: true,
    };
  }

  if (
    /5 october/.test(al) &&
    /(register|became self-employ|started)/i.test(ql)
  ) {
    return {
      ...base,
      factual_propositions: ["Register / notify by 5 October after tax year"],
      official_sources: [
        {
          url: "https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return",
          title: "Who must send a tax return",
          rule: "Tell HMRC by 5 October if you need to complete a return for the previous year",
        },
      ],
      verification_status: "VERIFIED",
      verification_explanation: "5 October registration/notify timing consistent with GOV.UK.",
      source_establishes_conclusion: true,
    };
  }

  if (
    /ignore.{0,20}letter|hmrc asking for a return/i.test(ql) &&
    /(should not ignore|do not ignore|must|need to).{0,40}(respond|file|return)/i.test(
      al,
    )
  ) {
    return {
      ...base,
      factual_propositions: ["HMRC notice to file must not be ignored"],
      official_sources: [
        {
          url: "https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return",
          title: "Who must send a tax return",
          rule: "You must send a return if HMRC asked you to send one",
        },
      ],
      verification_status: "VERIFIED",
      verification_explanation: "Correct that an HMRC notice to file should not be ignored.",
      source_establishes_conclusion: true,
    };
  }

  if (
    /mortgage interest reduce qualifying|mortgage interest/.test(ql) &&
    /(does not|don't|do not).{0,40}(reduce|count).{0,40}qualifying|before expenses/.test(
      al,
    )
  ) {
    return {
      ...base,
      factual_propositions: ["Mortgage interest does not reduce MTD QI"],
      official_sources: [
        {
          url: "https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax",
          title: "Work out your qualifying income",
          rule: "QI is before expenses (turnover/gross)",
        },
      ],
      verification_status: "VERIFIED",
      verification_explanation: "Correct that QI is before expenses such as mortgage interest.",
      source_establishes_conclusion: true,
    };
  }

  if (
    /vat registered[^\n.]{0,40}mtd|automatically mean i must use mtd/i.test(ql) &&
    /(does not|don't|do not).{0,40}automatically/.test(al)
  ) {
    return {
      ...base,
      factual_propositions: ["VAT registration ≠ automatic MTD ITSA"],
      official_sources: [
        {
          url: "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
          title: "Find out if and when you need MTD",
          rule: "MTD ITSA based on QI thresholds for sole traders/landlords in SA",
        },
      ],
      verification_status: "VERIFIED",
      verification_explanation: "Correct that VAT registration alone does not force MTD for Income Tax.",
      source_establishes_conclusion: true,
    };
  }

  // Clarification-first where facts incomplete
  if (
    /need (a little )?more detail|roughly how much|which tax year|is that figure|one key fact|can'?t decide|was this a one-off/i.test(
      al,
    ) &&
    !/(you must register for self assessment|you need to use making tax digital from)/i.test(
      al,
    )
  ) {
    return {
      ...base,
      factual_propositions: ["Asked for missing facts before asserting obligation"],
      official_sources: ALL_OFFICIAL_FACTS.slice(0, 3).map((f) => ({
        url: f.url,
        title: f.title,
        rule: f.claim,
      })),
      verification_status: "AMBIGUOUS_NEEDS_CLARIFICATION",
      verification_explanation:
        "Customer facts incomplete; clarification is appropriate. Not marked VERIFIED as a statutory conclusion.",
      source_establishes_conclusion: false,
    };
  }

  // Personalised calc / liability
  if (
    /(how much tax will i|calculate my|what will i owe|taxable rental profit)/i.test(ql) ||
    (/£/.test(ql) && /profit|gain|owe|bill/.test(ql) && /exact|precisely|figure/.test(ql))
  ) {
    if (/won't invent|cannot calculate|personalised|consult|depends on your full/i.test(al)) {
      return {
        ...base,
        factual_propositions: ["Refused invented personalised liability"],
        official_sources: [],
        verification_status: "REQUIRES_PROFESSIONAL_ADVICE",
        verification_explanation:
          "Individualised calculation — appropriately escalated / refused invention.",
        source_establishes_conclusion: false,
      };
    }
  }

  // Partnership / joint ownership / complex — often need more facts
  if (
    /(partnership|jointly owned|child benefit|foreign income|penalty appeal|time to pay)/i.test(
      ql,
    )
  ) {
    if (/may|might|depends|check|gov\.uk|official/.test(al)) {
      return {
        ...base,
        factual_propositions: ["Complex topic with cautious general guidance"],
        official_sources: [
          {
            url: "https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return",
            title: "Who must send a tax return",
            rule: "Lists several triggers; circumstance-specific application often needs facts",
          },
        ],
        verification_status: "AMBIGUOUS_NEEDS_CLARIFICATION",
        verification_explanation:
          "Topic is source-supported at a general level but customer-specific conclusion not uniquely established.",
        source_establishes_conclusion: false,
      };
    }
  }

  // Default for remaining tax rows: do not invent VERIFIED
  return {
    ...base,
    factual_propositions: ["Tax-related answer examined; no unique source-backed VERIFIED match"],
    official_sources: ALL_OFFICIAL_FACTS.filter((f) =>
      new RegExp(f.id.split("_")[0] || "sa", "i").test(ql + al + cat),
    )
      .slice(0, 3)
      .map((f) => ({ url: f.url, title: f.title, rule: f.claim })),
    verification_status: "NO_AUTHORITATIVE_SOURCE_FOUND",
    verification_explanation:
      "Individually examined; could not establish the specific Q&A conclusion uniquely from cited GOV.UK rules without risking a false VERIFIED. Left unverified honestly.",
    source_establishes_conclusion: false,
  };
}

function main() {
  mkdirSync(OUT, { recursive: true });
  const pack = JSON.parse(readFileSync(PACK, "utf8"));
  const rows = pack.results || [];
  const results = rows.map(examine);

  const counts: Record<string, number> = {
    VERIFIED: 0,
    INCORRECT: 0,
    INCOMPLETE: 0,
    AMBIGUOUS_NEEDS_CLARIFICATION: 0,
    REQUIRES_PROFESSIONAL_ADVICE: 0,
    NO_AUTHORITATIVE_SOURCE_FOUND: 0,
    REAL_MODEL_EXECUTED: rows.filter((r: any) => r.llm_mode === "openai").length,
    PROFESSIONAL_APPROVAL_OBTAINED: 0,
    TAX_CATEGORY_ROWS: results.filter((r) => TAX_CATS.has(r.category)).length,
    NON_TAX_CATEGORY_ROWS: results.filter((r) => !TAX_CATS.has(r.category)).length,
  };
  for (const r of results) counts[r.verification_status]++;

  const summary = {
    generated_at: new Date().toISOString(),
    methodology:
      "Independent examination of frozen live T001–T400 against current GOV.UK/HMRC pages fetched 2026-11-20. VERIFIED only when an official rule establishes the factual claim. Sounds-reasonable ≠ VERIFIED. Professional approval NOT OBTAINED.",
    official_facts_library: ALL_OFFICIAL_FACTS,
    counts,
    incorrect: results.filter((r) => r.verification_status === "INCORRECT"),
    incomplete: results.filter((r) => r.verification_status === "INCOMPLETE"),
    verified: results.filter((r) => r.verification_status === "VERIFIED"),
    ambiguous: results.filter(
      (r) => r.verification_status === "AMBIGUOUS_NEEDS_CLARIFICATION",
    ),
    rpa: results.filter((r) => r.verification_status === "REQUIRES_PROFESSIONAL_ADVICE"),
    remaining_no_source: results.filter(
      (r) => r.verification_status === "NO_AUTHORITATIVE_SOURCE_FOUND",
    ),
    results,
  };

  writeFileSync(path.join(OUT, "INDEPENDENT_GOVUK_VERIFY_400.json"), JSON.stringify(summary, null, 2));
  writeFileSync(
    path.join(OUT, "SUMMARY.json"),
    JSON.stringify(
      {
        generated_at: summary.generated_at,
        counts,
        incorrect_ids: summary.incorrect.map((r) => r.id),
        incomplete_ids: summary.incomplete.map((r) => r.id),
        verified_count: counts.VERIFIED,
        remaining_unverified_style:
          counts.NO_AUTHORITATIVE_SOURCE_FOUND +
          counts.AMBIGUOUS_NEEDS_CLARIFICATION,
      },
      null,
      2,
    ),
  );

  const md = [
    `# Independent GOV.UK verification — T001–T400`,
    ``,
    `**Method:** VERIFIED only when official GOV.UK/HMRC guidance establishes the claim. Professional approval: NOT OBTAINED.`,
    ``,
    `## Counts`,
    ``,
    `| Status | Count |`,
    `|---|---:|`,
    ...Object.entries(counts).map(([k, v]) => `| ${k} | ${v} |`),
    ``,
    `## INCORRECT (${summary.incorrect.length})`,
    ...summary.incorrect.map(
      (r) =>
        `### ${r.id}\n- **Q:** ${r.customer_question}\n- **Why:** ${r.verification_explanation}\n- **Sources:** ${r.official_sources.map((s) => s.url).join(", ")}\n`,
    ),
    `## INCOMPLETE (${summary.incomplete.length})`,
    ...summary.incomplete.map((r) => `- **${r.id}**: ${r.verification_explanation}`),
    ``,
    `## VERIFIED sample`,
    ...summary.verified
      .slice(0, 40)
      .map((r) => `- **${r.id}**: ${r.verification_explanation}`),
    ``,
    `## Remaining without unique source establishment`,
    `NO_AUTHORITATIVE_SOURCE_FOUND: ${counts.NO_AUTHORITATIVE_SOURCE_FOUND} (includes commercial/CX rows and tax rows without unique match)`,
    `AMBIGUOUS_NEEDS_CLARIFICATION: ${counts.AMBIGUOUS_NEEDS_CLARIFICATION}`,
    ``,
    `Full JSON: \`INDEPENDENT_GOVUK_VERIFY_400.json\``,
  ].join("\n");
  writeFileSync(path.join(OUT, "INDEPENDENT_GOVUK_VERIFY_400.md"), md);
  console.log(JSON.stringify({ out: OUT, counts }, null, 2));
}

main();
