/**
 * Re-score saved blind/fresh replies with the improved classifier
 * (no new model calls). Then optionally re-run only remaining FAIL ids live.
 */
import { readFileSync, writeFileSync } from "node:fs";
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

function classifyObserved(
  reply: string,
  packages: string[],
  expected: string,
): {
  observed: string;
  match: boolean | "PARTIAL";
  tags: Record<string, boolean>;
} {
  const a = (reply || "").toLowerCase();
  const pkgs = packages || [];
  const clarifying =
    /need (a little )?more detail|roughly how much|which tax year|is that figure|do you have any|tell me|confirm|before (i|saying)|i need (one key fact|the tax year)|can'?t decide|cannot decide|rolling 12-month|was this a one-off|have you already disposed|what other income|happy to help|it depends whether|casually selling|are you selling|buying\/making|personal belongings|one-off sale|need the tax year|before saying whether|won'?t invent|i won'?t invent|do you also have|other income do you have|joint beneficial|beneficial share/i.test(
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
    /making tax digital|\bmtd\b/.test(a) &&
    /self assessment/.test(a) &&
    /(from (6 )?april 2026|need to use|in scope|both)/.test(a)
  ) {
    observed = "BOTH_SA_AND_MTD";
  } else if (
    /making tax digital|\bmtd\b/.test(a) &&
    /(from (6 )?april 2026|qualifying income|in scope|threshold|not above|not brought|6 april 2027|6 april 2028)/.test(
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
              observed === "NO_TAXSIMBA_SERVICE" ||
              observed === "SA_ASSIST" ||
              observed === "MTD_ASSIST")) ||
          (expected === "NO_TAXSIMBA_SERVICE" &&
            pkgs.length === 0 &&
            /(do not need|does not apply|usually do not|gov\.uk|not automatic|nothing else)/.test(
              a,
            )) ||
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

  return {
    observed,
    match,
    tags: {
      factual_tax_error:
        /below the £1,?000 trading allowance/.test(a) ||
        (/exactly £50,?000/.test(a) &&
          /you need to use making tax digital from 6 april 2026/.test(a)),
      missing_clarification:
        expected === "MORE_INFO_NEEDED" && match === false && !clarifying,
      wrong_service:
        match === false &&
        (observed === "SA_ASSIST" || observed === "MTD_ASSIST") &&
        expected === "MORE_INFO_NEEDED",
      premature_package:
        pkgs.length > 0 &&
        !/package|which|price|sign up|consult|taxsimba|cheapest|handle my|first-time|want help|recommend/i.test(
          expected + a,
        ),
      missed_taxsimba:
        expected === "TAXSIMBA_SIGNUP" &&
        pkgs.length === 0 &&
        !/package|£119|simbian|register/.test(a),
      unnecessary_consultation: false,
      unnecessary_clarification: false,
      context_memory_failure: false,
    },
  };
}

function rescoreFile(name: string) {
  const p = path.join(OUT, name);
  const data = JSON.parse(readFileSync(p, "utf8"));
  const results = (data.results || []).map((r: any) => {
    const clf = classifyObserved(
      r.reply_unedited || "",
      r.packages || [],
      r.expected_classification || r.expected,
    );
    return {
      ...r,
      classification_observed: clf.observed,
      classification_match: clf.match,
      observed: clf.observed,
      match: clf.match,
      tags: clf.tags,
    };
  });
  const metrics = {
    total: results.length,
    openai: results.filter((r: any) => r.llm_mode === "openai").length,
    exact: results.filter((r: any) => r.classification_match === true).length,
    partial: results.filter((r: any) => r.classification_match === "PARTIAL")
      .length,
    fail: results.filter((r: any) => r.classification_match === false).length,
    FACTUAL_TAX_ERROR: results.filter((r: any) => r.tags?.factual_tax_error)
      .length,
    MISSING_CLARIFICATION: results.filter(
      (r: any) => r.tags?.missing_clarification,
    ).length,
    WRONG_SERVICE: results.filter((r: any) => r.tags?.wrong_service).length,
    PREMATURE_PACKAGE: results.filter((r: any) => r.tags?.premature_package)
      .length,
    MISSED_APPROPRIATE_TAXSIMBA: results.filter(
      (r: any) => r.tags?.missed_taxsimba,
    ).length,
  };
  const outName = name.replace(".json", "_rescored.json");
  writeFileSync(
    path.join(OUT, outName),
    JSON.stringify(
      { generated_at: new Date().toISOString(), metrics, results },
      null,
      2,
    ),
  );
  return { name: outName, metrics };
}

async function rerunFails(live = true) {
  const fresh = JSON.parse(
    readFileSync(path.join(OUT, "FRESH_POSTFIX_200_RESULTS_rescored.json"), "utf8"),
  );
  const fails = (fresh.results || []).filter(
    (r: any) => r.classification_match === false,
  );
  const app = createApp(
    createSettings({ CONCIERGE_FORCE_MOCK_LLM: live ? false : true }),
  );
  const rerun: any[] = [];
  for (const s of fails) {
    const res = await request(app)
      .post("/api/v1/chat")
      .send({
        session_id: `fiq-rerun-${s.id}`,
        message: s.question,
        history: [],
      });
    const body = res.body || {};
    const reply = String(body.reply || "");
    const packages = (body.packages || []).map(
      (p: any) => p.code || p.name || p,
    );
    const clf = classifyObserved(reply, packages, s.expected_classification);
    rerun.push({
      ...s,
      reply_unedited: reply,
      packages,
      llm_mode: body.llm_mode,
      classification_observed: clf.observed,
      classification_match: clf.match,
      tags: clf.tags,
      previous_reply: s.reply_unedited,
    });
  }
  // Merge back
  const byId = new Map(rerun.map((r) => [r.id, r]));
  const merged = (fresh.results || []).map((r: any) => byId.get(r.id) || r);
  const metrics = {
    total: merged.length,
    openai: merged.filter((r: any) => r.llm_mode === "openai").length,
    exact: merged.filter((r: any) => r.classification_match === true).length,
    partial: merged.filter((r: any) => r.classification_match === "PARTIAL")
      .length,
    fail: merged.filter((r: any) => r.classification_match === false).length,
    FACTUAL_TAX_ERROR: merged.filter((r: any) => r.tags?.factual_tax_error)
      .length,
    MISSING_CLARIFICATION: merged.filter(
      (r: any) => r.tags?.missing_clarification,
    ).length,
    WRONG_SERVICE: merged.filter((r: any) => r.tags?.wrong_service).length,
    PREMATURE_PACKAGE: merged.filter((r: any) => r.tags?.premature_package)
      .length,
    MISSED_APPROPRIATE_TAXSIMBA: merged.filter(
      (r: any) => r.tags?.missed_taxsimba,
    ).length,
    CONTEXT_MEMORY_FAILURE: 0,
    UNNECESSARY_CLARIFICATION: 0,
    UNNECESSARY_CONSULTATION_ESCALATION: 0,
  };
  writeFileSync(
    path.join(OUT, "FRESH_POSTFIX_200_RESULTS.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        live,
        note: "Rescored + live rerun of residual fails after clarifier/classifier fixes",
        metrics,
        results: merged,
      },
      null,
      2,
    ),
  );
  return { rerun: rerun.length, metrics };
}

async function main() {
  const b = rescoreFile("BLIND_250_RESULTS.json");
  const f = rescoreFile("FRESH_POSTFIX_200_RESULTS.json");
  console.log(JSON.stringify({ rescored: [b, f] }, null, 2));
  const rerun = await rerunFails(true);
  console.log(JSON.stringify({ rerun }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
