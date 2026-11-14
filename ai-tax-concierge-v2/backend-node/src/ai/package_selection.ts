/**
 * Circumstance-based package selection from catalogue prices only.
 * Never invents inclusions. Never defaults to the most expensive tier alone.
 */

export function refineJourneyPackages(
  base: string[],
  tags: string[],
  answers: Record<string, string>,
  journeyId: string,
): string[] {
  const tagSet = new Set(tags || []);
  const ans = answers || {};

  if (journeyId === "existing_client" || tagSet.has("existing_client")) {
    return [];
  }

  if (journeyId === "consultation" || (tagSet.has("consult") && journeyId === "consultation")) {
    return ["ACCOUNTANT_CONSULT_99"];
  }

  if (journeyId === "unsure_service") {
    if (tagSet.has("existing_client") || ans.us_need === "existing") return [];
    if (ans.us_need === "talk_human" || tagSet.has("consult")) {
      return ["ACCOUNTANT_CONSULT_99"];
    }
    if (ans.us_need === "mtd_help" || tagSet.has("mtd")) {
      return ["MTD_STARTER", "MTD_GROWTH"];
    }
    if (ans.us_need === "file_sa" || tagSet.has("sa")) {
      if (ans.us_depth === "done_for_me") return ["SA_SMART", "SA_ELITE"];
      return ["SA_SIMPLE", "SA_SMART"];
    }
    return ["SA_SIMPLE", "SA_SMART", "MTD_STARTER"];
  }

  let codes = [...(base || [])];

  const simpleSignals =
    tagSet.has("first_time") ||
    ["none", "starting", "new", "curious", "diy", "explore"].includes(
      Object.values(ans).find((v) =>
        ["none", "starting", "new", "curious", "diy", "explore"].includes(v),
      ) || "",
    ) ||
    ans.ft_confidence === "none" ||
    ans.st_stage === "starting" ||
    ans.fr_start === "new";

  const complexSignals =
    tagSet.has("multiple_income") ||
    tagSet.has("missed_deadline") ||
    ans.mi_mix === "several" ||
    ans.ll_type === "multiple" ||
    ans.md_status === "hmrc_contact" ||
    ans.us_depth === "done_for_me";

  if (journeyId === "mtd") {
    if (ans.mtd_records === "yes") codes = ["MTD_STARTER", "MTD_GROWTH"];
    else if (ans.mtd_records === "no") codes = ["MTD_GROWTH", "MTD_COMPLETE"];
    else codes = ["MTD_STARTER", "MTD_GROWTH"];
  }

  if (journeyId === "self_employed" || journeyId === "freelancer" || journeyId === "sole_trader") {
    if (complexSignals) codes = ["SA_SMART", "SA_ELITE"];
    else if (simpleSignals) codes = ["SA_SIMPLE", "SA_SMART"];
    else codes = codes.filter((c) => c !== "SA_ELITE");
    if (!codes.length) codes = ["SA_SIMPLE", "SA_SMART"];
  }

  if (journeyId === "first_time") {
    codes = ["SA_SIMPLE", "SA_SMART"];
  }

  if (journeyId === "landlord") {
    if (ans.ll_type === "room") codes = ["SA_SIMPLE", "SA_SMART"];
    else if (ans.ll_type === "multiple") codes = ["SA_SMART", "SA_ELITE", "MTD_GROWTH"];
    else codes = ["SA_SMART", "MTD_GROWTH"];
  }

  if (journeyId === "cis") {
    codes = ["SA_SIMPLE", "SA_SMART"];
  }

  if (journeyId === "multiple_income") {
    if (ans.mi_mix === "several") codes = ["SA_SMART", "SA_ELITE", "MTD_GROWTH"];
    else codes = ["SA_SMART", "SA_ELITE"];
  }

  if (journeyId === "missed_deadline") {
    codes = ["SA_SMART", "ACCOUNTANT_CONSULT_99"];
    if (ans.md_status === "hmrc_contact") {
      // Keep a mid-tier option so we never push only the most expensive SA package.
      codes = ["SA_SMART", "SA_ELITE", "ACCOUNTANT_CONSULT_99"];
    }
  }

  // Never leave only the most expensive catalogue tier.
  if (codes.length === 1 && codes[0] === "SA_ELITE") {
    codes = ["SA_SMART", "SA_ELITE"];
  }
  if (codes.length === 1 && codes[0] === "MTD_COMPLETE") {
    codes = ["MTD_GROWTH", "MTD_COMPLETE"];
  }

  // Prefer not to auto-include Elite for simple first-time visitors.
  if (simpleSignals && !complexSignals) {
    codes = codes.filter((c) => c !== "SA_ELITE" && c !== "MTD_COMPLETE");
  }

  // Missed-deadline + HMRC contact stays complex even if other simple tags appear.
  if (journeyId === "missed_deadline" && ans.md_status === "hmrc_contact") {
    codes = ["SA_SMART", "SA_ELITE", "ACCOUNTANT_CONSULT_99"];
  }

  return [...new Set(codes)];
}

/** Free-text circumstance → catalogue codes (prices only; no invented inclusions). */
export function selectPackagesForMessage(message: string): string[] {
  const lower = (message || "").toLowerCase();

  if (
    /\b(existing (taxsimba )?client|already (a )?taxsimba|logged ?in|my dashboard|message my (assigned )?accountant|my assigned accountant)\b/.test(
      lower,
    )
  ) {
    return [];
  }

  if (
    /\b(don'?t want to buy|do not want to buy|not looking to buy|no sales|just information|information only|only want information|do not sell|don'?t sell)\b/.test(
      lower,
    )
  ) {
    return [];
  }

  const wantsConsult =
    /\bconsult|accountant consultation|speak to (an )?accountant|talk to (an )?accountant|book a call|£99|99 consultation\b/.test(
      lower,
    );
  const wantsMtd = /\bmtd\b|\bmaking tax digital\b/.test(lower);
  const wantsSa =
    /\bself assessment\b|\bsa package\b|\bfiling\b|\btax return\b/.test(lower);
  const complex =
    /\b(multiple|several|complex|director|limited company|hmrc letter|penalty|missed deadline|portfolio)\b/.test(
      lower,
    );
  const simple =
    /\b(first time|beginner|just started|side hustle|simple|basic)\b/.test(
      lower,
    );
  const landlord = /\blandlord\b|\brental\b|\bproperty income\b/.test(lower);
  const cis = /\bcis\b|\bsubcontractor\b|\bconstruction\b/.test(lower);
  const freelancer =
    /\bfreelanc|\bself-?employed\b|\bsole trader\b|\bown business\b/.test(
      lower,
    );

  if (wantsConsult && !wantsSa && !wantsMtd) {
    return ["ACCOUNTANT_CONSULT_99"];
  }

  if (wantsMtd && (lower.includes("plan") || lower.includes("price") || lower.includes("cost") || lower.includes("package"))) {
    // Always lead with the lowest suitable MTD price.
    if (complex) return ["MTD_GROWTH", "MTD_COMPLETE"];
    return ["MTD_STARTER", "MTD_GROWTH"];
  }

  if (landlord) {
    // Landlords: start with mid SA; add MTD Growth as optional — never Elite alone.
    if (complex) return ["SA_SMART", "MTD_GROWTH", "SA_ELITE"];
    return ["SA_SMART", "MTD_STARTER", "MTD_GROWTH"];
  }

  if (cis) return ["SA_SIMPLE", "SA_SMART"];

  if (freelancer || wantsSa) {
    if (complex) return ["SA_SMART", "SA_ELITE"];
    if (simple) return ["SA_SIMPLE", "SA_SMART"];
    if (
      lower.includes("package") ||
      lower.includes("price") ||
      lower.includes("cost") ||
      lower.includes("how much")
    ) {
      return ["SA_SIMPLE", "SA_SMART", "SA_ELITE"];
    }
    return ["SA_SIMPLE", "SA_SMART"];
  }

  return [];
}

export function primaryRecommendationIsNotMostExpensive(
  codes: string[],
): boolean {
  if (!codes.length) return true;
  const saOrder = ["SA_SIMPLE", "SA_SMART", "SA_ELITE"];
  const mtdOrder = ["MTD_STARTER", "MTD_GROWTH", "MTD_COMPLETE"];
  const sa = codes.filter((c) => saOrder.includes(c));
  const mtd = codes.filter((c) => mtdOrder.includes(c));
  if (sa.length === 1 && sa[0] === "SA_ELITE") return false;
  if (mtd.length === 1 && mtd[0] === "MTD_COMPLETE") return false;
  if (sa.length > 1 && sa[0] === "SA_ELITE") return false;
  if (mtd.length > 1 && mtd[0] === "MTD_COMPLETE") return false;
  return true;
}
