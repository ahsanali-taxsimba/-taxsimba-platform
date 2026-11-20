/**
 * Build readable quality-proof review artefacts from existing live evidence.
 * Does NOT re-call OpenAI. Expands independent verification where rules allow.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const QP = path.join(ROOT, "docs/verification/simba_v2_quality_proof");
const OUT = path.join(QP, "evidence/review");

const SA_WHO =
  "https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return";
const SA_REG = "https://www.gov.uk/register-for-self-assessment";
const MTD_IF =
  "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax";
const TRADING_ALLOW =
  "https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income";

type PackItem = {
  id: string;
  question: string;
  turns?: string[] | null;
  category?: { id: number; name: string } | null;
};

type LiveRow = {
  id: string;
  category: string;
  question: string;
  reply: string;
  packages: string[];
  sources: string[];
  llm_mode: string;
  status: string;
  turns: Array<{ user: string; reply: string; packages: string[] }>;
  turns_sent: number;
  notes?: string;
};

type Verdict =
  | "VERIFIED_PASS"
  | "FAIL"
  | "BLOCKED"
  | "AWAITING_ACCOUNTANT_REVIEW";

type Scored = LiveRow & {
  tax_year_context: string;
  expected_conclusion: string;
  expected_sources: string[];
  verification_basis: "deterministic_rule" | "catalogue_claim" | "professional_judgement";
  tax_status: Verdict;
  tax_reason: string;
  independent_notes: string;
};

function taxYearContext(q: string, reply: string): string {
  const blob = `${q}\n${reply}`;
  const years = [
    ...blob.matchAll(/\b(20\d{2})\s*[-–/]\s*(\d{2})\b/g),
  ].map((m) => `${m[1]}-${m[2]}`);
  const uniq = [...new Set(years)];
  if (uniq.length) return uniq.join(", ");
  if (/april 2026|6 april 2026/i.test(blob)) return "MTD band from 6 April 2026 (basis year 2024-25)";
  if (/april 2027|6 april 2027/i.test(blob)) return "MTD band from 6 April 2027 (basis year 2025-26)";
  if (/april 2028|6 april 2028/i.test(blob)) return "MTD band from 6 April 2028 (basis year 2026-27)";
  return "Not explicitly pinned — treat as current GOV.UK guidance unless stated";
}

function expectedFor(item: PackItem): {
  conclusion: string;
  sources: string[];
  basis: Scored["verification_basis"];
} {
  const q = item.question.toLowerCase();

  if (/paye only|only.*(paye|payroll)|through paye only/.test(q) && /self assessment|do i need/.test(q)) {
    return {
      conclusion:
        "PAYE-only with no other income usually does not require Self Assessment; confirm against GOV.UK who-must-send (other triggers can still apply).",
      sources: [SA_WHO],
      basis: "deterministic_rule",
    };
  }
  if (/paye only/.test(q) && /\bmtd\b|making tax digital/.test(q)) {
    return {
      conclusion:
        "PAYE-only employment is not qualifying income for MTD for Income Tax — MTD ITSA does not apply on that fact pattern alone.",
      sources: [MTD_IF],
      basis: "deterministic_rule",
    };
  }
  if (/exactly|exact/.test(q) && /£\s*50,?000|50000/.test(q) && /(mtd|threshold|over)/.test(q)) {
    return {
      conclusion:
        "Exact £50,000 is NOT “more than £50,000”; that MTD band does not start from the exclusive threshold wording alone.",
      sources: [MTD_IF],
      basis: "deterministic_rule",
    };
  }
  if (/£\s*50,?000/.test(q) && /2024/.test(q) && /more than|over £50|above £50/.test(q)) {
    return {
      conclusion: "More than £50,000 qualifying income in 2024-25 → MTD from 6 April 2026.",
      sources: [MTD_IF],
      basis: "deterministic_rule",
    };
  }
  if (/£\s*950|£950/.test(q) && /(trading allowance|freelance|casual)/.test(q)) {
    return {
      conclusion:
        "£950 trading income is not more than £1,000 — that sole-trader SA trigger alone usually does not apply; other reasons may still require a return.",
      sources: [SA_WHO, TRADING_ALLOW],
      basis: "deterministic_rule",
    };
  }
  if (/£\s*1,?200|£1200/.test(q) && /trading allowance/.test(q)) {
    return {
      conclusion:
        "£1,200 exceeds £1,000: trading allowance may reduce taxable profit by up to £1,000, but income above £1,000 usually still engages Self Assessment filing/registration rules.",
      sources: [SA_WHO, TRADING_ALLOW],
      basis: "deterministic_rule",
    };
  }
  if (/£\s*50,?000 turnover/.test(q) && /£\s*49,?000 expenses|49000 expenses/.test(q)) {
    return {
      conclusion:
        "High expenses do not remove SA merely because profit is low; sole-trader turnover more than £1,000 usually still requires SA. Do not equate low profit with ‘no SA’.",
      sources: [SA_WHO],
      basis: "deterministic_rule",
    };
  }
  if (/do not add them for mtd|do not add.*(paye|salary).*mtd/.test(q)) {
    return {
      conclusion:
        "PAYE salary is excluded from MTD qualifying income; only self-employment/property qualifying income counts.",
      sources: [MTD_IF],
      basis: "deterministic_rule",
    };
  }
  if (/do not recommend a package|information only|avoid a checkout/.test(q)) {
    return {
      conclusion: "Answer the tax question; show zero package cards.",
      sources: ["TaxSimba help-first CX rules"],
      basis: "catalogue_claim",
    };
  }
  if (/xero separately|buy xero/.test(q)) {
    return {
      conclusion:
        "On Simbian plans Xero is included in the monthly price — customers do not need to buy Xero separately for TaxSimba’s MTD service.",
      sources: ["TaxSimba approved catalogue — Simbian Xero mapping"],
      basis: "catalogue_claim",
    };
  }
  if (/portal.*(hmrc|file)|files? directly to hmrc/.test(q)) {
    return {
      conclusion:
        "TaxSimba portal is not a direct HMRC filing integration; accountants use approved tools; portal handles registration/payment/docs/messaging.",
      sources: ["TaxSimba operating model"],
      basis: "catalogue_claim",
    };
  }

  return {
    conclusion:
      "Fact-pattern or multi-factor tax conclusion — requires Asim professional judgement against effective-dated HMRC guidance.",
    sources: [],
    basis: "professional_judgement",
  };
}

function classify(row: LiveRow, expected: ReturnType<typeof expectedFor>): {
  tax_status: Verdict;
  tax_reason: string;
  independent_notes: string;
} {
  const q = (row.question || "").toLowerCase();
  const reply = (row.reply || "").toLowerCase();
  const pkgs = row.packages || [];
  const corpus = `${q}\n${reply}\n${(row.turns || [])
    .map((t) => `${t.user}\n${t.reply}`)
    .join("\n")
    .toLowerCase()}`;

  if (row.status === "ERROR" || !row.reply?.trim()) {
    return {
      tax_status: "BLOCKED",
      tax_reason: "No usable live reply",
      independent_notes: "",
    };
  }
  if (/you are booked|payment successful|booking confirmed/.test(reply)) {
    return {
      tax_status: "FAIL",
      tax_reason: "Invented booking/payment confirmation",
      independent_notes: "",
    };
  }

  // Threshold inversion: trading income above £1k described as below allowance
  if (
    /£\s*[2-9],?\d{3}|£\s*\d{2,},?\d{3}/.test(corpus) &&
    /(freelance|self-?employ|sole[- ]?trader|trading|handmade|casual freelance)/.test(
      corpus,
    ) &&
    /(below the £?1,?000|falls below.*£?1,?000|under the £?1,?000)/.test(reply) &&
    /(do not need|won't need|no need).*(register|self assessment|file)/.test(reply)
  ) {
    return {
      tax_status: "FAIL",
      tax_reason:
        "Threshold inversion: trading income above £1,000 treated as below threshold / no SA",
      independent_notes: `Expected: ${expected.conclusion}`,
    };
  }

  // Exact £50k treated as over MTD threshold
  if (
    /exactly £?50,?000|£50,?000 exactly|earn £50,?000 exactly/.test(q) &&
    /(over the threshold|more than £50,?000|above the £50,?000|you (are|will be) in|must start mtd|need mtd from)/.test(
      reply,
    ) &&
    !/(not more than|not “more than”|not over|exact.*not|£50,?000 is not more than)/.test(
      reply,
    )
  ) {
    return {
      tax_status: "FAIL",
      tax_reason:
        "Exact £50,000 treated as meeting exclusive ‘more than £50,000’ MTD band",
      independent_notes: expected.conclusion,
    };
  }

  // £50k turnover + high expenses → claims no SA
  if (
    /£\s*50,?000 turnover/.test(q) &&
    /expenses/.test(q) &&
    /(no self assessment|do not need.*(self assessment|return)|won't need.*(return|self assessment))/.test(
      reply,
    )
  ) {
    return {
      tax_status: "FAIL",
      tax_reason:
        "High expenses incorrectly used to conclude no Self Assessment despite high turnover",
      independent_notes: expected.conclusion,
    };
  }

  // Info-only with packages
  if (
    (/do not recommend|information only|avoid a checkout/.test(q) ||
      /do not recommend|information only/.test(
        (row.turns || []).map((t) => t.user).join(" ").toLowerCase(),
      )) &&
    pkgs.length > 0
  ) {
    return {
      tax_status: "FAIL",
      tax_reason: "Package cards shown despite information-only instruction",
      independent_notes: "",
    };
  }

  // PAYE-only SA: should not insist SA is required solely from PAYE salary
  if (
    /paye only|only.*(paye|payroll)/.test(q) &&
    /self assessment/.test(q) &&
    !/(other income|freelance|property|self-?employ)/.test(q) &&
    /(you must|you need to|you will need to).*(register|file|send).*(self assessment|return)/.test(
      reply,
    ) &&
    !/(usually do not|typically (do not|won't)|likely do not|may not need|do not usually need)/.test(
      reply,
    )
  ) {
    return {
      tax_status: "FAIL",
      tax_reason:
        "PAYE-only fact pattern incorrectly stated as requiring Self Assessment",
      independent_notes: expected.conclusion,
    };
  }

  // PAYE-only MTD: must exclude
  if (
    /paye only/.test(q) &&
    /\bmtd\b|making tax digital/.test(q) &&
    /(you need mtd|must use making tax digital|you are in scope for mtd)/.test(reply)
  ) {
    return {
      tax_status: "FAIL",
      tax_reason: "PAYE-only incorrectly brought into MTD for Income Tax",
      independent_notes: expected.conclusion,
    };
  }

  // Positive deterministic passes
  if (
    expected.basis === "deterministic_rule" &&
    /paye only/.test(q) &&
    /self assessment/.test(q) &&
    /(do not usually|typically (do not|won't)|usually (do not|won't)|likely do not|may not need)/.test(
      reply,
    )
  ) {
    return {
      tax_status: "VERIFIED_PASS",
      tax_reason:
        "Correctly indicates PAYE-only usually does not force Self Assessment (with caveats acceptable).",
      independent_notes: expected.conclusion,
    };
  }

  if (
    /paye only/.test(q) &&
    /\bmtd\b|making tax digital/.test(q) &&
    /(does not apply|not qualifying|paye.*(not|does not) count|employment.*(not|does not) count)/.test(
      reply,
    )
  ) {
    return {
      tax_status: "VERIFIED_PASS",
      tax_reason: "Correctly excludes PAYE-only from MTD for Income Tax qualifying income.",
      independent_notes: expected.conclusion,
    };
  }

  if (
    /exactly|exact/.test(q) &&
    /£\s*50,?000|50000/.test(q) &&
    /(not more than|not “more than”|exact.*not|is not more than £50)/.test(reply)
  ) {
    return {
      tax_status: "VERIFIED_PASS",
      tax_reason: "Correct exclusive ‘more than £50,000’ MTD boundary handling.",
      independent_notes: expected.conclusion,
    };
  }

  if (
    /£\s*950|£950/.test(q) &&
    /(not more than £1,?000|below the £1,?000|not above the £1,?000|under £1,?000)/.test(
      reply,
    ) &&
    !/(you must register|you need to register for self assessment)/.test(reply)
  ) {
    return {
      tax_status: "VERIFIED_PASS",
      tax_reason: "Correctly treats £950 as not more than £1,000 sole-trader SA trigger.",
      independent_notes: expected.conclusion,
    };
  }

  if (
    /£\s*1,?200|£1200/.test(q) &&
    /trading allowance/.test(q) &&
    /(more than £1,?000|above £1,?000|exceeds £1,?000)/.test(reply)
  ) {
    return {
      tax_status: "VERIFIED_PASS",
      tax_reason:
        "Correctly separates trading-allowance relief from the >£1,000 SA filing trigger for £1,200 income.",
      independent_notes: expected.conclusion,
    };
  }

  if (
    /do not add them for mtd/.test(q) &&
    /(paye|salary|employment).*(not|excluded|does not count)/.test(reply)
  ) {
    return {
      tax_status: "VERIFIED_PASS",
      tax_reason: "Correctly excludes PAYE from MTD qualifying income aggregation.",
      independent_notes: expected.conclusion,
    };
  }

  if (
    (/do not recommend|information only/.test(q) ||
      /do not recommend|information only/.test(
        (row.turns || []).map((t) => t.user).join(" ").toLowerCase(),
      )) &&
    pkgs.length === 0
  ) {
    return {
      tax_status: "VERIFIED_PASS",
      tax_reason: "Information-only instruction respected (zero package cards).",
      independent_notes: expected.conclusion,
    };
  }

  if (
    /more than £50,?000|over £50,?000/.test(q) &&
    /2024/.test(q) &&
    /6 april 2026|april 2026/.test(reply) &&
    /qualifying income|before expenses|turnover/.test(reply) &&
    !(/£30,?000/.test(reply) && /april 2026/.test(reply))
  ) {
    return {
      tax_status: "VERIFIED_PASS",
      tax_reason: "Correct >£50k / 2024-25 → 6 April 2026 MTD pairing.",
      independent_notes: expected.conclusion,
    };
  }

  if (
    /buy xero|xero separately/.test(q) &&
    /(included|do not need to buy xero separately)/.test(reply)
  ) {
    return {
      tax_status: "VERIFIED_PASS",
      tax_reason: "Correct TaxSimba-first Xero inclusion claim.",
      independent_notes: expected.conclusion,
    };
  }

  if (
    /(portal|file).*(hmrc)/.test(q) &&
    /(not.*(direct|itself).*hmrc|not a direct hmrc)/.test(reply)
  ) {
    return {
      tax_status: "VERIFIED_PASS",
      tax_reason: "Correct portal ≠ direct HMRC filing positioning.",
      independent_notes: expected.conclusion,
    };
  }

  // Generic trading >£1k correct language
  if (
    /£\s*[2-9],?\d{3}|£\s*\d{2,},?\d{3}/.test(corpus) &&
    /(freelance|self-?employ|sole[- ]?trader|trading)/.test(corpus) &&
    /(more than £1,?000|above the £1,?000)/.test(reply) &&
    /(must (usually )?register|usually must register|need to register|must send a .*return)/.test(
      reply,
    ) &&
    !/(falls below the £1,?000|below the £1,?000 trading allowance)/.test(reply)
  ) {
    return {
      tax_status: "VERIFIED_PASS",
      tax_reason:
        "Correctly applies sole-trader ‘more than £1,000’ Self Assessment rule to stated trading income.",
      independent_notes: expected.conclusion,
    };
  }

  return {
    tax_status: "AWAITING_ACCOUNTANT_REVIEW",
    tax_reason:
      expected.basis === "professional_judgement"
        ? "Requires Asim judgement — not solely machine-verifiable from the question facts."
        : "Deterministic expectation exists but reply did not clearly match pass/fail patterns — escalate to Asim.",
    independent_notes: expected.conclusion,
  };
}

function esc(s: string): string {
  return s.replace(/\|/g, "\\|");
}

function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(path.join(OUT, "by_category"), { recursive: true });
  mkdirSync(path.join(OUT, "deep20"), { recursive: true });

  const pack = JSON.parse(
    readFileSync(
      path.join(
        ROOT,
        "docs/verification/simba_v2_audit_completion/packs/simba_400_questions.json",
      ),
      "utf-8",
    ),
  ) as { items: PackItem[] };
  const live = JSON.parse(
    readFileSync(
      path.join(QP, "evidence/pack400/simba_400_results_live_latest.json"),
      "utf-8",
    ),
  ) as { results: LiveRow[]; mode?: string; generated_at?: string };

  const byId = Object.fromEntries(pack.items.map((i) => [i.id, i]));
  const scored: Scored[] = live.results.map((row) => {
    const item = byId[row.id] || {
      id: row.id,
      question: row.question,
      category: { id: 0, name: row.category },
    };
    const expected = expectedFor(item);
    const c = classify(row, expected);
    return {
      ...row,
      question: row.question || item.question,
      tax_year_context: taxYearContext(row.question || item.question, row.reply),
      expected_conclusion: expected.conclusion,
      expected_sources: expected.sources,
      verification_basis: expected.basis,
      tax_status: c.tax_status,
      tax_reason: c.tax_reason,
      independent_notes: c.independent_notes,
    };
  });

  const counts = {
    REAL_MODEL_EXECUTED: scored.filter((r) => r.llm_mode === "openai").length,
    VERIFIED_PASS: scored.filter((r) => r.tax_status === "VERIFIED_PASS").length,
    FAIL: scored.filter((r) => r.tax_status === "FAIL").length,
    BLOCKED: scored.filter((r) => r.tax_status === "BLOCKED").length,
    AWAITING_ACCOUNTANT_REVIEW: scored.filter(
      (r) => r.tax_status === "AWAITING_ACCOUNTANT_REVIEW",
    ).length,
    ACCOUNTANT_APPROVED: 0,
  };

  writeFileSync(
    path.join(OUT, "FULL_ANSWER_REGISTER.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        source_live: "evidence/pack400/simba_400_results_live_latest.json",
        note: "VERIFIED_PASS ≠ accountant approved. 400 executed ≠ 400 accurate.",
        counts,
        results: scored,
      },
      null,
      2,
    ),
  );

  // Master markdown register (complete answers)
  const md: string[] = [
    "# Complete T001–T400 Answer Register (Live OpenAI)",
    "",
    `Generated: ${new Date().toISOString()} (report times Europe/London = UTC+0 on this date)`,
    "",
    "**Honesty rule:** REAL MODEL EXECUTED counts are not tax-accuracy passes.",
    "",
    "## Independent verification summary",
    "",
    `| Category | Count |`,
    `|---|---:|`,
    `| REAL MODEL EXECUTED | ${counts.REAL_MODEL_EXECUTED} |`,
    `| INDEPENDENTLY VERIFIED PASS | ${counts.VERIFIED_PASS} |`,
    `| FAIL | ${counts.FAIL} |`,
    `| BLOCKED | ${counts.BLOCKED} |`,
    `| AWAITING ACCOUNTANT REVIEW | ${counts.AWAITING_ACCOUNTANT_REVIEW} |`,
    `| ACCOUNTANT APPROVED | ${counts.ACCOUNTANT_APPROVED} |`,
    "",
    "Per-category files: `by_category/`. Machine-readable: `FULL_ANSWER_REGISTER.json`.",
    "",
  ];

  const byCat = new Map<string, Scored[]>();
  for (const r of scored) {
    const c = r.category || "unknown";
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c)!.push(r);
  }

  for (const [cat, rows] of [...byCat.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const catMd: string[] = [
      `# ${cat}`,
      "",
      `| ID | Review status | Verification basis |`,
      `|----|---------------|--------------------|`,
    ];
    md.push(`## ${cat}`, "");
    for (const r of rows) {
      const block = [
        `### ${r.id}`,
        "",
        `- **Review status:** ${r.tax_status}`,
        `- **Verification basis:** ${r.verification_basis}`,
        `- **Tax-year context:** ${r.tax_year_context}`,
        `- **Model / mode:** ${r.llm_mode} (live pack)`,
        `- **Packages shown:** ${r.packages.length ? r.packages.join(", ") : "none"}`,
        `- **Independent reason:** ${r.tax_reason}`,
        "",
        "**Customer question**",
        "",
        "> " + (r.question || "").replace(/\n/g, "\n> "),
        "",
        "**Expected conclusion (for challenge)**",
        "",
        r.expected_conclusion,
        "",
        "**Expected / supporting sources**",
        "",
        ...(r.expected_sources.length
          ? r.expected_sources.map((s) => `- ${s}`)
          : ["- (none pre-assigned — Asim to cite)"]),
        "",
        "**Actual SIMBA response (unedited)**",
        "",
        r.reply || "_(empty)_",
        "",
        "**Sources returned with reply**",
        "",
        ...(r.sources?.length
          ? r.sources.map((s) => `- ${s}`)
          : ["- (none)"]),
        "",
      ];
      if (r.turns?.length > 1) {
        block.push("**Multi-turn transcript**", "");
        for (const t of r.turns) {
          block.push(`- **Customer:** ${t.user}`);
          block.push(`- **SIMBA:** ${t.reply}`);
          block.push("");
        }
      }
      block.push("---", "");
      md.push(...block);
      catMd.push(
        `| ${r.id} | ${r.tax_status} | ${r.verification_basis} |`,
      );
      catMd.push(...block.slice(1));
    }
    const safe = cat.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
    writeFileSync(path.join(OUT, "by_category", `${safe}.md`), catMd.join("\n"));
  }

  writeFileSync(path.join(OUT, "FULL_ANSWER_REGISTER.md"), md.join("\n"));

  // Compact CSV
  const csv = [
    "id,category,tax_status,verification_basis,tax_year_context,packages,question,reply,expected_conclusion,tax_reason,sources",
  ];
  for (const r of scored) {
    const cells = [
      r.id,
      r.category,
      r.tax_status,
      r.verification_basis,
      r.tax_year_context,
      r.packages.join(";"),
      r.question,
      r.reply,
      r.expected_conclusion,
      r.tax_reason,
      (r.sources || []).join(" "),
    ].map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`);
    csv.push(cells.join(","));
  }
  writeFileSync(path.join(OUT, "FULL_ANSWER_REGISTER.csv"), csv.join("\n"));

  // Failures + awaiting priority lists
  const fails = scored.filter((r) => r.tax_status === "FAIL");
  const awaiting = scored.filter(
    (r) => r.tax_status === "AWAITING_ACCOUNTANT_REVIEW",
  );
  const verified = scored.filter((r) => r.tax_status === "VERIFIED_PASS");

  writeFileSync(
    path.join(OUT, "INDEPENDENT_VERIFICATION_SUMMARY.md"),
    [
      "# Independent verification summary (machine)",
      "",
      `Counts: ${JSON.stringify(counts, null, 2)}`,
      "",
      "## VERIFIED_PASS IDs",
      verified.map((r) => `- **${r.id}**: ${r.tax_reason}`).join("\n") ||
        "_none_",
      "",
      "## FAIL IDs",
      fails.map((r) => `- **${r.id}**: ${r.tax_reason}`).join("\n") ||
        "_none in this pass_",
      "",
      "## AWAITING ACCOUNTANT REVIEW — prioritised (tax risk)",
      "",
      "### P1 — Thresholds / eligibility / calculations",
      awaiting
        .filter((r) =>
          /eligibility|deadlines|calculations|landlords|sole traders|mtd|paye|cis|crypto/i.test(
            r.category,
          ),
        )
        .map(
          (r) =>
            `- **${r.id}** (${r.category}): ${esc(r.question).slice(0, 120)}`,
        )
        .join("\n"),
      "",
      "### P2 — Packages / onboarding / commercial claims",
      awaiting
        .filter((r) =>
          /package|registration|document|consultation|lead/i.test(r.category),
        )
        .map(
          (r) =>
            `- **${r.id}** (${r.category}): ${esc(r.question).slice(0, 120)}`,
        )
        .join("\n"),
      "",
      "### P3 — Conversation / UX / adversarial",
      awaiting
        .filter((r) =>
          /conversation|contradiction|ux|privacy|adversarial/i.test(r.category),
        )
        .map(
          (r) =>
            `- **${r.id}** (${r.category}): ${esc(r.question).slice(0, 120)}`,
        )
        .join("\n"),
      "",
    ].join("\n"),
  );

  // Deep20 readable transcripts
  const deepIndex: string[] = [
    "# Deep conversations D01–D20 (unedited)",
    "",
    "Each file is the complete customer ↔ SIMBA transcript from opening to outcome.",
    "",
  ];
  for (let i = 1; i <= 20; i++) {
    const id = `D${String(i).padStart(2, "0")}`;
    const fp = path.join(QP, `evidence/deep20/${id}_openai.json`);
    const d = JSON.parse(readFileSync(fp, "utf-8")) as {
      id: string;
      title: string;
      goal?: string;
      turn_count: number;
      outcome?: string;
      tax_accuracy_status?: string;
      scores?: Record<string, number>;
      transcript: Array<{
        role: string;
        content: string;
        packages?: string[];
        sources?: string[];
      }>;
    };
    const lines = [
      `# ${d.id} — ${d.title}`,
      "",
      `- **Goal:** ${d.goal || "—"}`,
      `- **Turns:** ${d.turn_count}`,
      `- **Outcome class:** ${d.outcome || "—"}`,
      `- **Tax accuracy status:** ${d.tax_accuracy_status || "AWAITING_ACCOUNTANT_REVIEW"}`,
      `- **Environment:** local cloud-agent OpenAI (` +
        "`llm_mode=openai`" +
        `)`,
      "",
      "## Full transcript (unedited)",
      "",
    ];
    let n = 0;
    for (const t of d.transcript) {
      if (t.role === "user") {
        n += 1;
        lines.push(`### Turn ${n} — Customer`, "", t.content, "");
      } else {
        lines.push(`### Turn ${n} — SIMBA`, "", t.content, "");
        if (t.packages?.length) {
          lines.push(`**Packages shown:** ${t.packages.join(", ")}`, "");
        }
        if (t.sources?.length) {
          lines.push("**Sources:**", ...t.sources.map((s) => `- ${s}`), "");
        }
      }
    }
    if (d.scores) {
      lines.push("## Auto scores (1–10)", "", "```json", JSON.stringify(d.scores, null, 2), "```", "");
    }
    writeFileSync(path.join(OUT, "deep20", `${id}.md`), lines.join("\n"));
    deepIndex.push(`- [${id} — ${d.title}](./deep20/${id}.md)`);
  }
  writeFileSync(path.join(OUT, "DEEP20_INDEX.md"), deepIndex.join("\n") + "\n");

  writeFileSync(
    path.join(OUT, "COUNTS.json"),
    JSON.stringify({ generated_at: new Date().toISOString(), counts }, null, 2),
  );

  console.log(JSON.stringify({ out: OUT, counts }, null, 2));
}

main();
