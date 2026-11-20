/**
 * Independent evidence-based audit of frozen live T001–T400 transcripts.
 * Does NOT re-call OpenAI. Does NOT treat AI opinion as proof.
 * Professional approval column stays NOT_OBTAINED unless supplied externally.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const QP = path.join(ROOT, "docs/verification/simba_v2_quality_proof");
const OUT = path.join(QP, "evidence/independent_audit");

const SRC = {
  saWho: {
    url: "https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return",
    title: "Who must send a tax return",
    effective: "GOV.UK guidance (check page for current wording)",
    rule: "Lists when a Self Assessment return is required, including sole traders who earned more than £1,000.",
  },
  saReg: {
    url: "https://www.gov.uk/register-for-self-assessment",
    title: "Register for Self Assessment",
    effective: "GOV.UK",
    rule: "Registration deadlines and process for Self Assessment.",
  },
  tradingAllow: {
    url: "https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income",
    title: "Tax-free allowances on property and trading income",
    effective: "GOV.UK guidance",
    rule: "Trading allowance up to £1,000 is a relief — distinct from the >£1,000 sole-trader filing trigger.",
  },
  mtdIf: {
    url: "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
    title: "Find out if and when you need to use Making Tax Digital for Income Tax",
    effective: "GOV.UK — bands use “more than” £50,000 / £30,000 / £20,000",
    rule: "Exclusive thresholds; PAYE salary excluded from qualifying income; start dates 6 Apr 2026/2027/2028.",
  },
  mtdQi: {
    url: "https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax",
    title: "Work out your qualifying income for MTD for Income Tax",
    effective: "GOV.UK",
    rule: "Qualifying income is turnover/gross before expenses for self-employment and property.",
  },
  vat: {
    url: "https://www.gov.uk/vat-registration-thresholds",
    title: "VAT registration thresholds",
    effective: "GOV.UK — £90,000 threshold (verify page date)",
    rule: "VAT registration threshold amount.",
  },
} as const;

type Status =
  | "VERIFIED"
  | "INCORRECT"
  | "INCOMPLETE"
  | "AMBIGUOUS"
  | "REQUIRES_PROFESSIONAL_ADVICE"
  | "BLOCKED";

type Row = {
  id: string;
  category: string;
  question: string;
  reply: string;
  packages: string[];
  sources: string[];
  llm_mode: string;
  turns: Array<{ user: string; reply: string }>;
};

type Audit = {
  id: string;
  category: string;
  customer_question: string;
  simba_answer_unedited: string;
  tax_year_applicability: string;
  expected_answer_independent: string;
  official_sources: Array<{
    url: string;
    title: string;
    effective_or_publication: string;
    specific_rule: string;
  }>;
  source_establishes_conclusion: boolean;
  verification_status: Status;
  verification_explanation: string;
  model_execution: "REAL_OPENAI" | "NOT_EXECUTED" | "ERROR";
  source_verification: "SUPPORTED" | "PARTIAL" | "UNSUPPORTED" | "NOT_APPLICABLE";
  calculation_verification: "PASS" | "FAIL" | "N_A" | "NOT_CHECKED";
  conversation_quality: "PASS" | "WEAK" | "FAIL" | "N_A";
  professional_approval: "NOT_OBTAINED";
  packages_shown: string;
  errors_found: string;
};

function taxYear(q: string, a: string): string {
  const blob = `${q}\n${a}`;
  const years = [...blob.matchAll(/\b(20\d{2})\s*[-–/]\s*(\d{2})\b/g)].map(
    (m) => `${m[1]}-${m[2]}`,
  );
  const u = [...new Set(years)];
  if (u.length) return u.join(", ");
  if (/2024\/25/.test(blob)) return "2024-25";
  if (/april 2026/i.test(blob)) return "MTD commencement 6 April 2026 (band basis 2024-25)";
  return "Not explicitly pinned in Q/A — apply current GOV.UK wording carefully";
}

function auditOne(row: Row): Audit {
  const q = (row.question || "").toLowerCase();
  const a = (row.reply || "").toLowerCase();
  const pkgs = row.packages || [];
  const base: Audit = {
    id: row.id,
    category: row.category,
    customer_question: row.question,
    simba_answer_unedited: row.reply,
    tax_year_applicability: taxYear(row.question, row.reply),
    expected_answer_independent: "",
    official_sources: [],
    source_establishes_conclusion: false,
    verification_status: "AMBIGUOUS",
    verification_explanation: "",
    model_execution:
      row.llm_mode === "openai" ? "REAL_OPENAI" : "NOT_EXECUTED",
    source_verification: "NOT_APPLICABLE",
    calculation_verification: "N_A",
    conversation_quality: "N_A",
    professional_approval: "NOT_OBTAINED",
    packages_shown: pkgs.join(";") || "none",
    errors_found: "",
  };

  if (!row.reply?.trim()) {
    return {
      ...base,
      verification_status: "BLOCKED",
      verification_explanation: "Empty reply — cannot verify",
      model_execution: "ERROR",
    };
  }

  if (/you are booked|payment successful|booking confirmed/.test(a)) {
    return {
      ...base,
      expected_answer_independent:
        "Must not invent booking/payment confirmation in chat.",
      verification_status: "INCORRECT",
      verification_explanation: "Hallucinated booking/payment success",
      source_verification: "UNSUPPORTED",
      conversation_quality: "FAIL",
      errors_found: "Invented booking/payment",
    };
  }

  // --- Deterministic tax rules ---

  // PAYE-only SA
  if (
    /paye only|only.*(paye|payroll)|through paye only|paye.{0,40}no other income/.test(
      q,
    ) &&
    /self assessment|do i need/.test(q)
  ) {
    base.expected_answer_independent =
      "PAYE-only with no other income usually does not require Self Assessment; other GOV.UK triggers can still apply.";
    base.official_sources = [SRC.saWho];
    base.source_establishes_conclusion = true;
    if (/need a little more detail|is that figure paye/.test(a)) {
      return {
        ...base,
        verification_status: "INCOMPLETE",
        verification_explanation:
          "Unnecessary clarification — question already stated PAYE-only with no other income.",
        source_verification: "PARTIAL",
        conversation_quality: "WEAK",
        errors_found: "Over-clarification on clear PAYE-only fact pattern",
      };
    }
    if (
      /(must|need to|have to).*(register|file|send).*(self assessment|return)/.test(
        a,
      ) &&
      !/(usually do not|typically (do not|won't)|likely do not|do not usually|may not need)/.test(
        a,
      )
    ) {
      return {
        ...base,
        verification_status: "INCORRECT",
        verification_explanation:
          "Incorrectly requires SA for PAYE-only with no other income.",
        source_verification: "SUPPORTED",
        calculation_verification: "FAIL",
        conversation_quality: "FAIL",
        errors_found: "False SA requirement for PAYE-only",
      };
    }
    if (
      /(usually do not|typically (do not|won't)|likely do not|do not usually|may not need|don't need|do not need)/.test(
        a,
      )
    ) {
      return {
        ...base,
        verification_status: "VERIFIED",
        verification_explanation:
          "Aligns with GOV.UK who-must-send for PAYE-only without other triggers.",
        source_verification: "SUPPORTED",
        calculation_verification: "PASS",
        conversation_quality: "PASS",
      };
    }
    return {
      ...base,
      verification_status: "INCOMPLETE",
      verification_explanation:
        "PAYE-only pattern; reply neither clearly excludes nor incorrectly forces SA.",
      source_verification: "PARTIAL",
      conversation_quality: "WEAK",
    };
  }

  // PAYE-only MTD
  if (/paye only|through paye only/.test(q) && /\bmtd\b|making tax digital/.test(q)) {
    base.expected_answer_independent =
      "PAYE-only employment is not MTD for Income Tax qualifying income — MTD ITSA does not apply on that alone.";
    base.official_sources = [SRC.mtdIf, SRC.mtdQi];
    base.source_establishes_conclusion = true;
    if (/need a little more detail|is that figure paye/.test(a)) {
      return {
        ...base,
        verification_status: "INCOMPLETE",
        verification_explanation: "Unnecessary clarification on clear PAYE-only MTD question.",
        source_verification: "PARTIAL",
        conversation_quality: "WEAK",
        errors_found: "Over-clarification",
      };
    }
    if (/(you need mtd|must use making tax digital|in scope for mtd)/.test(a)) {
      return {
        ...base,
        verification_status: "INCORRECT",
        verification_explanation: "Incorrectly brings PAYE-only into MTD ITSA.",
        source_verification: "SUPPORTED",
        calculation_verification: "FAIL",
        conversation_quality: "FAIL",
        errors_found: "PAYE counted toward MTD",
      };
    }
    if (
      /(does not apply|not qualifying|paye.*(not|does not) count|employment.*(not|does not) count|not.*(mtd|making tax digital))/i.test(
        a,
      ) ||
      (/paye/.test(a) && /not/.test(a) && /(qualifying|mtd|count)/.test(a))
    ) {
      return {
        ...base,
        verification_status: "VERIFIED",
        verification_explanation: "Correctly excludes PAYE-only from MTD qualifying income.",
        source_verification: "SUPPORTED",
        calculation_verification: "PASS",
        conversation_quality: "PASS",
      };
    }
    return {
      ...base,
      verification_status: "INCOMPLETE",
      verification_explanation: "PAYE-only MTD expected exclusion not clearly stated.",
      source_verification: "PARTIAL",
      conversation_quality: "WEAK",
    };
  }

  // Exact £50k MTD
  if (
    /exact/.test(q) &&
    /£?\s*50,?000|50000/.test(q) &&
    /(threshold|mtd|over|more than)/.test(q)
  ) {
    base.expected_answer_independent =
      "Exact £50,000 is not “more than £50,000”; that MTD band does not start from the exclusive threshold alone (basis year 2024-25 → 6 April 2026 only if more than £50,000).";
    base.official_sources = [SRC.mtdIf];
    base.source_establishes_conclusion = true;
    if (/need a little more detail/.test(a)) {
      return {
        ...base,
        verification_status: "INCOMPLETE",
        verification_explanation:
          "Should apply exclusive MTD threshold rule (or ask only whether figure is qualifying income) — not a generic income-type probe that blocks the answer.",
        source_verification: "PARTIAL",
        conversation_quality: "WEAK",
        errors_found: "Missed exact-threshold determination",
      };
    }
    if (
      /(over the threshold|more than £50|you (are|will be) in|need mtd from|must start)/.test(
        a,
      ) &&
      !/(not more than|not “more than”|exact.*not|is not more than)/.test(a)
    ) {
      return {
        ...base,
        verification_status: "INCORRECT",
        verification_explanation: "Treated exact £50,000 as over the exclusive MTD threshold.",
        source_verification: "SUPPORTED",
        calculation_verification: "FAIL",
        conversation_quality: "FAIL",
        errors_found: "Exact £50k treated as more than £50k",
      };
    }
    if (/(not more than|exact|exclusive|does not bring you into)/.test(a)) {
      return {
        ...base,
        verification_status: "VERIFIED",
        verification_explanation: "Correct exclusive ‘more than £50,000’ handling.",
        source_verification: "SUPPORTED",
        calculation_verification: "PASS",
        conversation_quality: "PASS",
      };
    }
  }

  // £950 trading allowance
  if (/£\s*950|£950/.test(q) && /(trading allowance|freelance|casual)/.test(q)) {
    base.expected_answer_independent =
      "£950 is not more than £1,000 for the sole-trader SA trigger; trading allowance context: income can sit under the £1,000 trading allowance.";
    base.official_sources = [SRC.saWho, SRC.tradingAllow];
    base.source_establishes_conclusion = true;
    if (
      /(below|under|not more than|within).{0,20}£?1,?000|trading allowance/.test(a) &&
      !/(must register|need to register for self assessment)/.test(a)
    ) {
      return {
        ...base,
        verification_status: "VERIFIED",
        verification_explanation: "Correctly places £950 at/under the £1,000 trading-income band.",
        source_verification: "SUPPORTED",
        calculation_verification: "PASS",
        conversation_quality: "PASS",
      };
    }
  }

  // £1200 trading allowance
  if (/£\s*1,?200|£1200/.test(q) && /trading allowance/.test(q)) {
    base.expected_answer_independent =
      "£1,200 exceeds £1,000: trading allowance may still apply as a relief (up to £1,000 instead of expenses) but income is above the sole-trader >£1,000 filing trigger — do not say SA is unnecessary solely due to the allowance.";
    base.official_sources = [SRC.saWho, SRC.tradingAllow];
    base.source_establishes_conclusion = true;
    if (
      /(below the £1,?000|falls below.*trading allowance)/.test(a) &&
      /(do not need|don't need|no need).*(self assessment|register)/.test(a)
    ) {
      return {
        ...base,
        verification_status: "INCORRECT",
        verification_explanation: "Inverted trading allowance vs filing trigger for £1,200.",
        source_verification: "SUPPORTED",
        calculation_verification: "FAIL",
        conversation_quality: "FAIL",
        errors_found: "£1,200 treated as below £1,000 filing trigger",
      };
    }
    if (/(exceed|above|more than £1,?000|over £1,?000)/.test(a)) {
      return {
        ...base,
        verification_status: "VERIFIED",
        verification_explanation:
          "Recognises £1,200 exceeds £1,000; trading-allowance explanation acceptable if not denying SA trigger.",
        source_verification: "SUPPORTED",
        calculation_verification: "PASS",
        conversation_quality: /self assessment|declare|hmrc/.test(a)
          ? "PASS"
          : "WEAK",
      };
    }
  }

  // T329 pattern / PAYE + freelance £1000 MTD
  if (
    /paye/.test(q) &&
    /freelance|£\s*1,?000/.test(q) &&
    /\bmtd\b|do not add/.test(q)
  ) {
    base.expected_answer_independent =
      "Do not add PAYE to MTD qualifying income. £1,000 freelance alone is not more than MTD bands. Do not say freelance is “below the £1,000 trading allowance” (exact £1,000 is the boundary for SA “more than £1,000”).";
    base.official_sources = [SRC.mtdIf, SRC.mtdQi, SRC.saWho, SRC.tradingAllow];
    base.source_establishes_conclusion = true;
    if (
      /(below the £1,?000 trading allowance)/.test(a) ||
      (/(do not need|don't need).*(self assessment|mtd)/.test(a) &&
        /below/.test(a))
    ) {
      return {
        ...base,
        verification_status: "INCORRECT",
        verification_explanation:
          "Wrong trading-allowance / SA language on £1,000 freelance; or incorrect bundling with MTD.",
        source_verification: "SUPPORTED",
        calculation_verification: "FAIL",
        conversation_quality: "FAIL",
        errors_found: "T329-class threshold/trading-allowance error",
      };
    }
    if (
      /(paye|salary|employment).*(not|excluded|does not count)/.test(a) &&
      !/below the £1,?000 trading allowance/.test(a)
    ) {
      return {
        ...base,
        verification_status: "VERIFIED",
        verification_explanation: "Correctly excludes PAYE from MTD QI without trading-allowance inversion.",
        source_verification: "SUPPORTED",
        calculation_verification: "PASS",
        conversation_quality: "PASS",
      };
    }
  }

  // High turnover + high expenses ≠ no SA
  if (/£\s*50,?000 turnover/.test(q) && /expenses/.test(q) && /self assessment/.test(q)) {
    base.expected_answer_independent =
      "Turnover more than £1,000 as a sole trader usually still requires Self Assessment; low profit from high expenses does not remove that trigger.";
    base.official_sources = [SRC.saWho];
    base.source_establishes_conclusion = true;
    if (/(still need|must|required).*(self assessment|return|file)/.test(a)) {
      return {
        ...base,
        verification_status: "VERIFIED",
        verification_explanation: "Correctly rejects ‘high expenses ⇒ no SA’.",
        source_verification: "SUPPORTED",
        calculation_verification: "PASS",
        conversation_quality: "PASS",
      };
    }
    if (/(no self assessment|do not need.*(return|self assessment))/.test(a)) {
      return {
        ...base,
        verification_status: "INCORRECT",
        verification_explanation: "Incorrectly concludes no SA from high expenses.",
        source_verification: "SUPPORTED",
        calculation_verification: "FAIL",
        conversation_quality: "FAIL",
        errors_found: "Expenses used to waive SA",
      };
    }
  }

  // Info-only no packages
  if (
    /do not recommend|information only|avoid a checkout/.test(q) ||
    (row.turns || []).some((t) =>
      /do not recommend|information only/.test(t.user.toLowerCase()),
    )
  ) {
    base.expected_answer_independent =
      "Answer the information request; show zero package cards.";
    base.official_sources = [
      {
        url: "https://www.taxsimba.co.uk/",
        title: "TaxSimba help-first CX policy (business rule)",
        effective: "Approved product behaviour",
        rule: "Information-only visitors must not receive package cards.",
      },
    ];
    base.source_establishes_conclusion = true;
    if (pkgs.length > 0) {
      return {
        ...base,
        verification_status: "INCORRECT",
        verification_explanation: "Package cards despite information-only instruction.",
        source_verification: "SUPPORTED",
        conversation_quality: "FAIL",
        errors_found: "Premature/forced packages",
      };
    }
    return {
      ...base,
      verification_status: "VERIFIED",
      verification_explanation: "Zero packages on information-only path.",
      source_verification: "SUPPORTED",
      conversation_quality: "PASS",
      calculation_verification: "N_A",
    };
  }

  // Privacy / adversarial — no secrets
  if (/password|ni number|national insurance|bank detail|utr/i.test(q) && /give me|tell me your|what is your/.test(q)) {
    base.expected_answer_independent =
      "Refuse to request or invent customer secrets in public chat.";
    base.source_establishes_conclusion = true;
    if (/your password is|ni number is|here is your utr/.test(a)) {
      return {
        ...base,
        verification_status: "INCORRECT",
        verification_explanation: "Unsafe disclosure/request pattern.",
        conversation_quality: "FAIL",
        errors_found: "Privacy failure",
      };
    }
  }

  // Default: most content needs human/professional or is multi-factor
  const highRisk =
    /eligibility|deadline|landlord|sole trader|mtd|paye|cis|crypto|calculation/i.test(
      row.category,
    );
  base.expected_answer_independent =
    "Multi-factor or circumstance-specific — establish answer from GOV.UK for the stated tax year; escalate if individualised advice is required.";
  base.official_sources = highRisk ? [SRC.saWho, SRC.mtdIf] : [];
  base.source_establishes_conclusion = false;
  base.source_verification = "UNSUPPORTED";
  if (
    /what (tax|should i pay)|calculate my|how much tax will i|exact liability|guarantee/.test(
      q,
    )
  ) {
    return {
      ...base,
      verification_status: "REQUIRES_PROFESSIONAL_ADVICE",
      verification_explanation:
        "Individualised tax figure / guarantee — not safely resolved from general published Q&A alone.",
      source_verification: "PARTIAL",
      conversation_quality: /won't invent|cannot guarantee|consultation|accountant/.test(
        a,
      )
        ? "PASS"
        : "WEAK",
    };
  }
  if (highRisk) {
    return {
      ...base,
      verification_status: "AMBIGUOUS",
      verification_explanation:
        "Authoritative sources exist for the topic, but this specific Q&A was not reduced to a single deterministic check — needs case-by-case source matching (not auto-verified).",
      source_verification: "PARTIAL",
      conversation_quality: pkgs.length > 1 ? "WEAK" : "N_A",
    };
  }
  return {
    ...base,
    verification_status: "AMBIGUOUS",
    verification_explanation:
      "CX / commercial / conversation item — tax conclusion not independently machine-verified; business claims need catalogue cross-check.",
    source_verification: "NOT_APPLICABLE",
    conversation_quality: "N_A",
  };
}

function main() {
  mkdirSync(OUT, { recursive: true });
  const live = JSON.parse(
    readFileSync(
      path.join(QP, "evidence/pack400/simba_400_results_live_latest.json"),
      "utf-8",
    ),
  ) as { results: Row[]; generated_at?: string };

  const audited = live.results.map(auditOne);
  const counts: Record<string, number> = {
    VERIFIED: 0,
    INCORRECT: 0,
    INCOMPLETE: 0,
    AMBIGUOUS: 0,
    REQUIRES_PROFESSIONAL_ADVICE: 0,
    BLOCKED: 0,
    REAL_MODEL_EXECUTED: audited.filter((a) => a.model_execution === "REAL_OPENAI")
      .length,
    PROFESSIONAL_APPROVAL_OBTAINED: 0,
  };
  for (const a of audited) counts[a.verification_status]++;

  const incorrect = audited.filter((a) => a.verification_status === "INCORRECT");
  const incomplete = audited.filter((a) => a.verification_status === "INCOMPLETE");
  const verified = audited.filter((a) => a.verification_status === "VERIFIED");

  writeFileSync(
    path.join(OUT, "INDEPENDENT_AUDIT_400.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        methodology:
          "Independent checks against GOV.UK/HMRC published rules and deterministic calculations. AI opinion is not proof. Professional approval NOT_OBTAINED.",
        source_live_pack: "evidence/pack400/simba_400_results_live_latest.json",
        counts,
        results: audited,
      },
      null,
      2,
    ),
  );

  const csvHeader = [
    "id",
    "category",
    "verification_status",
    "model_execution",
    "source_verification",
    "calculation_verification",
    "conversation_quality",
    "professional_approval",
    "tax_year_applicability",
    "packages_shown",
    "customer_question",
    "simba_answer_unedited",
    "expected_answer_independent",
    "official_sources",
    "source_establishes_conclusion",
    "verification_explanation",
    "errors_found",
  ];
  const csvLines = [csvHeader.join(",")];
  for (const a of audited) {
    const cells = [
      a.id,
      a.category,
      a.verification_status,
      a.model_execution,
      a.source_verification,
      a.calculation_verification,
      a.conversation_quality,
      a.professional_approval,
      a.tax_year_applicability,
      a.packages_shown,
      a.customer_question,
      a.simba_answer_unedited,
      a.expected_answer_independent,
      a.official_sources.map((s) => `${s.title} (${s.url})`).join(" | "),
      String(a.source_establishes_conclusion),
      a.verification_explanation,
      a.errors_found,
    ].map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`);
    csvLines.push(cells.join(","));
  }
  writeFileSync(path.join(OUT, "INDEPENDENT_AUDIT_400.csv"), csvLines.join("\n"));

  const md: string[] = [
    "# Independent tax-information audit — T001–T400",
    "",
    "**Method:** Official HMRC/GOV.UK rules + deterministic checks on frozen live OpenAI transcripts.",
    "**Not:** Asim sign-off · AI-as-sole-proof · invented citations.",
    `**Professional approval:** NOT OBTAINED for all rows.`,
    "",
    "## Summary counts",
    "",
    `| Status | Count |`,
    `|---|---:|`,
    ...Object.entries(counts).map(([k, v]) => `| ${k} | ${v} |`),
    "",
    "> Generating 400 model answers does **not** mean 400 independently verified answers.",
    "",
    "## INCORRECT",
    "",
    ...incorrect.map(
      (a) =>
        `### ${a.id}\n\n- **Error:** ${a.errors_found || a.verification_explanation}\n- **Q:** ${a.customer_question}\n- **SIMBA:** ${a.simba_answer_unedited.slice(0, 500)}\n- **Expected:** ${a.expected_answer_independent}\n- **Sources:** ${a.official_sources.map((s) => s.url).join(", ")}\n`,
    ),
    "## INCOMPLETE",
    "",
    ...incomplete.map(
      (a) =>
        `- **${a.id}**: ${a.verification_explanation}`,
    ),
    "",
    "## VERIFIED (machine / source-backed)",
    "",
    ...verified.map((a) => `- **${a.id}**: ${a.verification_explanation}`),
    "",
    "## Full register",
    "",
    "See `INDEPENDENT_AUDIT_400.csv` and `.json` for every question, unedited answer, expected conclusion, sources, and columned statuses.",
    "",
  ];
  writeFileSync(path.join(OUT, "INDEPENDENT_AUDIT_400.md"), md.join("\n"));

  writeFileSync(
    path.join(OUT, "SUMMARY.json"),
    JSON.stringify({ generated_at: new Date().toISOString(), counts }, null, 2),
  );

  console.log(JSON.stringify({ out: OUT, counts }, null, 2));
}

main();
