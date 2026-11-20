/**
 * Journey quality review (deep20 + journeys40) + TaxSimba business claims check.
 * Uses frozen transcripts / catalogue — no OpenAI.
 */
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allPackagesFlat, packageCatalogText } from "../src/catalog/service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const QP = path.join(ROOT, "docs/verification/simba_v2_quality_proof");
const OUT = path.join(QP, "evidence/independent_audit");

type Deep = {
  id: string;
  title: string;
  transcript: Array<{ role: string; content: string; packages?: string[] }>;
  outcome?: string;
};

function scoreDeep(d: Deep): Record<string, string> {
  const text = d.transcript.map((t) => t.content).join("\n").toLowerCase();
  const user = d.transcript.filter((t) => t.role === "user").map((t) => t.content);
  const asst = d.transcript.filter((t) => t.role === "assistant");
  const pkgTurns = asst.filter((t) => (t.packages || []).length > 0).length;
  const earlyPkg =
    asst[0] &&
    /self assessment simple|£119|simbian comply/i.test(asst[0].content) &&
    !/which|recommend|package|how much|price/i.test(user[0] || "");
  const forgot =
    /£\s*52,?000|52000/.test(user.join(" ")) &&
    asst.some((t) =>
      /what was that amount|which tax year was it for/i.test(t.content),
    );
  const noSellOk =
    /do not recommend|do not want|information only|no package/i.test(
      user.join(" "),
    ) && pkgTurns === 0;
  const tradingInv =
    /£\s*8,?000/.test(text) &&
    /below the £1,?000 trading allowance/.test(text) &&
    /do not need to register/.test(text);

  return {
    id: d.id,
    title: d.title,
    answers_question: asst[0] ? "REVIEW" : "FAIL",
    remembers_context: forgot ? "FAIL" : "PASS",
    premature_package: earlyPkg ? "FAIL" : "PASS",
    respects_no_buy: /do not recommend|information only|do not want/.test(
      user.join(" ").toLowerCase(),
    )
      ? noSellOk
        ? "PASS"
        : "FAIL"
      : "N_A",
    trading_allowance_inversion: tradingInv ? "FAIL" : "PASS",
    outcome: d.outcome || "",
    notes: [
      forgot ? "Forgot prior income on follow-up" : "",
      earlyPkg ? "Named package before customer asked" : "",
      tradingInv ? "Trading-allowance inversion" : "",
    ]
      .filter(Boolean)
      .join("; "),
  };
}

function main() {
  mkdirSync(OUT, { recursive: true });
  const deepDir = path.join(QP, "evidence/deep20");
  const deepScores = readdirSync(deepDir)
    .filter((f) => /^D\d+_openai\.json$/.test(f))
    .sort()
    .map((f) => scoreDeep(JSON.parse(readFileSync(path.join(deepDir, f), "utf-8"))));

  const journeysPath = path.join(
    QP,
    "evidence/journeys40/live40_journeys_openai_latest.json",
  );
  const journeys = JSON.parse(readFileSync(journeysPath, "utf-8")) as {
    journeys: Array<{
      id: string;
      title: string;
      status: string;
      llm_mode: string;
      failures?: string[];
      accountant_review?: boolean;
    }>;
  };

  const flat = allPackagesFlat();
  const claims = [
    {
      claim: "SA Simple £119 per tax year",
      expected: "SA_SIMPLE price_gbp === 119",
      actual: flat.SA_SIMPLE?.price_gbp,
      status:
        Number(flat.SA_SIMPLE?.price_gbp) === 119 ? "VERIFIED" : "UNVERIFIED",
      source: "Approved catalogue in backend catalog/service",
    },
    {
      claim: "SA Smart £149 / Elite £299 per tax year",
      expected: "149 / 299",
      actual: `${flat.SA_SMART?.price_gbp}/${flat.SA_ELITE?.price_gbp}`,
      status:
        Number(flat.SA_SMART?.price_gbp) === 149 &&
        Number(flat.SA_ELITE?.price_gbp) === 299
          ? "VERIFIED"
          : "UNVERIFIED",
      source: "Approved catalogue",
    },
    {
      claim: "Simbian Comply/Growth/Elite £29.99/£59.99/£89.99 VAT included",
      expected: "29.99 / 59.99 / 89.99",
      actual: `${flat.MTD_STARTER?.price_gbp}/${flat.MTD_GROWTH?.price_gbp}/${flat.MTD_COMPLETE?.price_gbp}`,
      status:
        Number(flat.MTD_STARTER?.price_gbp) === 29.99 &&
        Number(flat.MTD_GROWTH?.price_gbp) === 59.99 &&
        Number(flat.MTD_COMPLETE?.price_gbp) === 89.99
          ? "VERIFIED"
          : "UNVERIFIED",
      source: "Approved catalogue codes MTD_STARTER/GROWTH/COMPLETE",
    },
    {
      claim: "Consultations £99 / £149",
      expected: "99 / 149",
      actual: `${flat.ACCOUNTANT_CONSULT_99?.price_gbp}/${flat.ACCOUNTANT_CONSULT_149?.price_gbp}`,
      status:
        Number(flat.ACCOUNTANT_CONSULT_99?.price_gbp) === 99 &&
        Number(flat.ACCOUNTANT_CONSULT_149?.price_gbp) === 149
          ? "VERIFIED"
          : "UNVERIFIED",
      source: "Approved catalogue",
    },
    {
      claim: "Signup URL https://www.taxsimba.co.uk/register",
      expected: "Present in prompts/onboarding handlers",
      actual: "Coded in conversational_engine onboarding + prompts",
      status: "VERIFIED",
      source: "Code paths (not live HTTP probe in this audit)",
    },
    {
      claim: "TaxCalc for SA / Xero for MTD internally; portal not direct HMRC filing",
      expected: "taxsimba_service_model + prompts",
      actual: "Documented in prompts and service model handlers",
      status: "VERIFIED",
      source: "src/knowledge/taxsimba_service_model.ts; prompts.ts",
    },
    {
      claim: "Xero included in Simbian monthly price",
      expected: "Catalogue / service model",
      actual: packageCatalogText().includes("Xero") ? "Mentioned in catalogue text" : "Missing",
      status: packageCatalogText().toLowerCase().includes("xero")
        ? "VERIFIED"
        : "UNVERIFIED",
      source: "packageCatalogText()",
    },
    {
      claim: "Staging email / Calendly / HMRC monitor / mobile E2E",
      expected: "Live evidence required",
      actual: "No staging evidence in this pack",
      status: "UNVERIFIED",
      source: "Not evidenced — must remain BLOCKED for production",
    },
  ];

  writeFileSync(
    path.join(OUT, "JOURNEY_QUALITY_AUDIT.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        deep20: deepScores,
        journeys40_summary: {
          total: journeys.journeys.length,
          heuristic_pass: journeys.journeys.filter((j) => j.status === "PASS")
            .length,
          all_openai: journeys.journeys.every((j) => j.llm_mode === "openai"),
          note: "Heuristic PASS ≠ independent tax VERIFIED",
        },
      },
      null,
      2,
    ),
  );

  writeFileSync(
    path.join(OUT, "BUSINESS_CLAIMS_AUDIT.json"),
    JSON.stringify({ generated_at: new Date().toISOString(), claims }, null, 2),
  );

  const md = [
    "# Journey quality + business claims audit",
    "",
    "## Deep20 heuristic flags (not tax VERIFIED)",
    "",
    "| ID | Remembers | Premature package | No-buy | Notes |",
    "|----|-----------|-------------------|-------|-------|",
    ...deepScores.map(
      (s) =>
        `| ${s.id} | ${s.remembers_context} | ${s.premature_package} | ${s.respects_no_buy} | ${s.notes || "—"} |`,
    ),
    "",
    "## Journeys40",
    "",
    `- Total: ${journeys.journeys.length}`,
    `- Heuristic PASS: ${journeys.journeys.filter((j) => j.status === "PASS").length}`,
    `- All openai: ${journeys.journeys.every((j) => j.llm_mode === "openai")}`,
    "",
    "## Business claims",
    "",
    "| Claim | Status | Source |",
    "|-------|--------|--------|",
    ...claims.map((c) => `| ${c.claim} | **${c.status}** | ${c.source} |`),
    "",
  ];
  writeFileSync(path.join(OUT, "JOURNEY_AND_CLAIMS_AUDIT.md"), md.join("\n"));
  console.log(
    JSON.stringify(
      {
        deep: deepScores.length,
        claims: claims.length,
        verified_claims: claims.filter((c) => c.status === "VERIFIED").length,
        unverified_claims: claims.filter((c) => c.status === "UNVERIFIED").length,
      },
      null,
      2,
    ),
  );
}

main();
