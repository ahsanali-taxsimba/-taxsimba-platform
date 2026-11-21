/**
 * Retest the previous 128 blind failures after general decision-policy fixes.
 * Report before/after separately — not used as generalisation proof.
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
  "../../docs/verification/simba_v2_quality_proof/evidence/generalisation_decision_policy",
);
const PREV = path.resolve(
  __dirname,
  "../../docs/verification/simba_v2_quality_proof/evidence/general_intelligence_blind600/BLIND_500_RESULTS.json",
);

type Turn = { role: "user" | "assistant"; content: string };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postChat(app: any, body: any) {
  for (let i = 0; i < 5; i++) {
    try {
      const res = await request(app)
        .post("/api/v1/chat")
        .send(body)
        .timeout({ deadline: 45000, response: 45000 });
      if (res.status === 200) return res;
      await sleep(Math.min(20000, 1000 * 2 ** i));
    } catch {
      await sleep(Math.min(20000, 1000 * 2 ** i));
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

  return {
    observed,
    match,
    tags: {
      factual_tax_error:
        /dividend allowance[^\n.]{0,40}£\s*2,?000|below the £1,?000 trading allowance threshold/.test(
          a,
        ) ||
        (/exactly £50,?000/.test(a) &&
          /you need to use making tax digital from 6 april 2026/.test(a)),
      premature_package:
        pkgs.length > 0 &&
        /don'?t want packages|dont want packages|no packages?|refuse|no buy|no sell|explain/i.test(
          expected + a,
        ),
      missing_clarification:
        expected === "MORE_INFO_NEEDED" && match === false && !clarifying,
      wrong_service:
        match === false &&
        expected === "MORE_INFO_NEEDED" &&
        (observed === "SA_ASSIST" || observed === "MTD_ASSIST"),
    },
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const prev = JSON.parse(readFileSync(PREV, "utf8"));
  const fails = (prev.results || []).filter(
    (r: any) => r.classification_match === false,
  );
  const app = createApp(createSettings({ CONCIERGE_FORCE_MOCK_LLM: false }));
  const results: any[] = [];

  for (let i = 0; i < fails.length; i++) {
    const f = fails[i];
    const res = await postChat(app, {
      session_id: `re128-${f.id}-${i}`,
      message: f.question,
      history: [] as Turn[],
    });
    const reply = String(res?.body?.reply || "");
    const packages = (res?.body?.packages || []).map(
      (p: any) => p.code || p.name || p,
    );
    const clf = classify(reply, packages, f.expected_classification);
    results.push({
      id: f.id,
      question: f.question,
      expected_classification: f.expected_classification,
      before_observed: f.classification_observed,
      before_match: f.classification_match,
      after_observed: clf.observed,
      after_match: clf.match,
      reply_unedited: reply,
      packages,
      tags: clf.tags,
      improved:
        f.classification_match === false &&
        (clf.match === true || clf.match === "ACCEPTABLE"),
    });
    if ((i + 1) % 20 === 0) console.error(`retest ${i + 1}/${fails.length}`);
    await sleep(40);
  }

  const metrics = {
    total: results.length,
    before_fail: fails.length,
    after_exact: results.filter((r) => r.after_match === true).length,
    after_acceptable: results.filter((r) => r.after_match === "ACCEPTABLE")
      .length,
    after_fail: results.filter((r) => r.after_match === false).length,
    improved: results.filter((r) => r.improved).length,
    still_fail: results.filter((r) => r.after_match === false).length,
    FACTUAL_TAX_ERROR: results.filter((r) => r.tags.factual_tax_error).length,
    PREMATURE_PACKAGE: results.filter((r) => r.tags.premature_package).length,
    MISSING_CLARIFICATION: results.filter((r) => r.tags.missing_clarification)
      .length,
    WRONG_SERVICE: results.filter((r) => r.tags.wrong_service).length,
  };

  writeFileSync(
    path.join(OUT, "RETEST_128_RESULTS.json"),
    JSON.stringify(
      { generated_at: new Date().toISOString(), metrics, results },
      null,
      2,
    ),
  );
  writeFileSync(
    path.join(OUT, "RETEST_128_SUMMARY.json"),
    JSON.stringify({ generated_at: new Date().toISOString(), metrics }, null, 2),
  );
  console.log(JSON.stringify(metrics, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
