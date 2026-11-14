import { describe, expect, it } from "vitest";
import {
  answerInclusionsQuestion,
  recommendForMessage,
  toPackageCards,
} from "../src/ai/recommendations.js";
import { mockPackageReply, buildSystemPrompt } from "../src/ai/prompts.js";
import {
  packagesCatalog,
  packageCatalogText,
} from "../src/catalog/service.js";

const WEBSITE = "https://www.taxsimba.co.uk";

describe("owner commercial decisions — controlled approval", () => {
  it("preserves_approved_catalogue_names_prices_and_skus", () => {
    const cat = packagesCatalog();
    expect(cat.version).toMatch(/owner-decisions|xero-approved|website-reconciliation/);
    expect(cat.detailed_recommendations_status).toBe(
      "website_reconciled_owner_decisions_applied",
    );
    expect(cat.self_assessment.map((p: { price_gbp: number }) => p.price_gbp)).toEqual([
      119, 149, 299,
    ]);
    expect(cat.mtd.map((p: { name: string; code: string; price_gbp: number }) => [
      p.code,
      p.name,
      p.price_gbp,
    ])).toEqual([
      ["MTD_STARTER", "Simbian Comply", 29.99],
      ["MTD_GROWTH", "Simbian Growth", 59.99],
      ["MTD_COMPLETE", "Simbian Elite", 89.99],
    ]);
    expect(cat.consultation.price_gbp).toBe(99);
    expect(cat.consultation.duration_minutes).toBe(30);
  });

  it("records_five_owner_decisions_and_removed_claims", () => {
    const cat = packagesCatalog();
    expect(cat.owner_decisions.xero_included_in_mtd_price).toBe("approved");
    expect(cat.owner_decisions.xero_customers_pay_separately).toBe(false);
    expect(cat.owner_decisions.xero_exact_licence_mapping).toBe(
      "verified_from_website_catalogue",
    );
    expect(cat.owner_decisions.bookkeeping_numerical_limits_approved).toBe(true);
    expect(cat.owner_decisions.bookkeeping_transaction_limits).toBe(
      "NO_FIXED_MONTHLY_TRANSACTION_CAPS",
    );
    expect(cat.owner_decisions.mtd_includes_annual_sa_subject_to_scope).toBe(
      "approved_subject_to_customer_responsibilities",
    );
    expect(cat.owner_decisions.consultation_scope_approved).toBe(true);
    expect(cat.removed_customer_claims).toEqual(
      expect.arrayContaining([
        "priority support",
        "priority turnaround",
        "quarterly business reviews",
        "proactive tax planning",
      ]),
    );
  });

  it("consultation_boundaries_approved", () => {
    const c = packagesCatalog().consultation;
    expect(c.inclusions_status).toBe("approved");
    expect(c.exclusions_status).toBe("approved");
    expect(c.inclusions).toEqual([
      "One 30-minute accountant-led Google Meet advice session",
    ]);
    expect(c.exclusions).toEqual([
      "Tax return filing",
      "Bookkeeping",
      "Written report",
    ]);
    const cards = toPackageCards(["ACCOUNTANT_CONSULT_99"]);
    expect(cards[0].inclusions).toEqual(c.inclusions);
  });

  it("inclusions_answer_states_xero_without_invented_licence", () => {
    const reply = answerInclusionsQuestion(
      "Does Simbian Elite include free Xero Grow forever and a 24/7 phone helpline?",
    );
    expect(reply).toBeTruthy();
    const lower = reply!.toLowerCase();
    expect(lower).toContain("xero software is included");
    expect(lower).toMatch(/do not pay separately|no separate/);
    expect(lower).toContain("xero grow");
    expect(lower).not.toContain("xero grow forever");
    expect(lower).toMatch(/helpline|priority support/);
    expect(lower).toContain("removed");
  });

  it("xero_inclusion_does_not_suggest_separate_customer_charge", () => {
    const fact = packagesCatalog().approved_customer_facts.find(
      (f: { id: string }) => f.id === "xero_in_mtd_price",
    );
    expect(fact.status).toBe("approved");
    expect(fact.text.toLowerCase()).toContain("do not pay separately");
    expect(fact.text).toContain("29.99");
    expect(fact.text).toContain("59.99");
    expect(fact.text).toContain("89.99");
    const reply = answerInclusionsQuestion(
      "Do I need to buy Xero separately on Simbian Comply?",
    );
    const lower = reply!.toLowerCase();
    expect(lower).toMatch(/do not pay separately|included in the .* monthly/);
    expect(lower).not.toMatch(/you must buy xero separately|pay extra for xero/);
  });

  it("inclusions_answer_bookkeeping_without_unlimited_promise", () => {
    const reply = answerInclusionsQuestion(
      "Is unlimited bookkeeping included in Simbian Comply?",
    );
    expect(reply).toBeTruthy();
    const lower = reply!.toLowerCase();
    expect(lower).toContain("no fixed monthly transaction caps");
    expect(lower).toContain("not");
    expect(lower).toMatch(/not (mean |a promise of )?unlimited|not unlimited/);
    expect(lower).not.toMatch(/unlimited bookkeeping is included/);
    expect(lower).not.toContain("undecided");
  });

  it("inclusions_answer_mtd_annual_sa_subject_to_scope", () => {
    const reply = answerInclusionsQuestion(
      "What is included in MTD packages for year-end Self Assessment?",
    );
    expect(reply).toBeTruthy();
    const lower = reply!.toLowerCase();
    expect(lower).toContain("year-end self assessment");
    expect(lower).toContain("customer responsibilities");
  });

  it("no_priority_or_qbr_or_planning_promises", () => {
    const reply = answerInclusionsQuestion(
      "Do Smart or Elite include priority support, quarterly business reviews or proactive tax planning?",
    );
    expect(reply).toBeTruthy();
    const lower = reply!.toLowerCase();
    expect(lower).toContain("removed");
    expect(lower).not.toMatch(/includes priority accountant messaging/);
    expect(lower).not.toMatch(/includes quarterly business reviews/);
    expect(lower).not.toMatch(/includes proactive tax planning advice/);

    const text = packageCatalogText().toLowerCase();
    expect(text).toContain("removed");
    expect(text).toContain("never invent");
    expect(text).toContain("simbian comply");

    const prompt = buildSystemPrompt("2025-26", [], "mock").toLowerCase();
    expect(prompt).toContain("priority support");
    expect(prompt).toContain("removed");
  });

  it("sa_packages_do_not_retain_removed_premium_bullets", () => {
    const cat = packagesCatalog();
    const smart = cat.self_assessment.find(
      (p: { code: string }) => p.code === "SA_SMART",
    );
    const elite = cat.self_assessment.find(
      (p: { code: string }) => p.code === "SA_ELITE",
    );
    expect(smart.inclusions).not.toContain("Priority accountant messaging");
    expect(smart.removed_inclusions).toContain("Priority accountant messaging");
    expect(elite.inclusions).not.toContain("Priority turnaround");
    expect(elite.inclusions).not.toContain("Tax planning conversation");
    expect(elite.removed_inclusions).toEqual(
      expect.arrayContaining(["Tax planning conversation", "Priority turnaround"]),
    );
  });

  it("mtd_packages_remove_premium_claims", () => {
    const cat = packagesCatalog();
    for (const p of cat.mtd) {
      const active = [
        p.description,
        ...(p.inclusions || []),
      ]
        .join(" ")
        .toLowerCase();
      expect(active).not.toContain("quarterly business reviews");
      expect(active).not.toContain("proactive tax planning advice");
      expect(active).not.toContain("priority email");
      expect(active).not.toContain("proactive tax planning");
    }
    const growth = cat.mtd.find((p: { code: string }) => p.code === "MTD_GROWTH");
    expect(growth.removed_inclusions).toContain("Quarterly business reviews");
  });

  it("recommendations_and_links_for_common_profiles", () => {
    const landlord = recommendForMessage(
      "I am a landlord with rental income over £50k — which MTD package?",
      null,
      WEBSITE,
    );
    expect(landlord.packages[0]?.code).toBe("MTD_STARTER");
    expect(landlord.packages[0]?.registration_path).toBe("/making-tax-digital");

    const sole = recommendForMessage(
      "I am a first time sole trader with simple income — which Self Assessment package?",
      null,
      WEBSITE,
    );
    expect(sole.packages[0]?.code).toBe("SA_SIMPLE");
    expect(sole.packages[0]?.registration_path).toBe("/self-assessment");

    const cis = recommendForMessage(
      "I am a CIS subcontractor needing Self Assessment",
      null,
      WEBSITE,
    );
    expect(cis.packages.map((p) => p.code)[0]).toMatch(/^SA_/);

    const multi = recommendForMessage(
      "I have multiple complex income sources and need a Self Assessment package",
      null,
      WEBSITE,
    );
    expect(multi.packages.map((p) => p.code)).toContain("SA_SMART");
  });

  it("unknown_inclusion_behaviour_stays_safe", () => {
    const reply = answerInclusionsQuestion(
      "What amendments and refunds are included in each package?",
    );
    expect(reply).toBeTruthy();
    const lower = reply!.toLowerCase();
    expect(lower).toMatch(/taxsimba must confirm|pending|unknown|not yet/);
    expect(lower).not.toMatch(/amendments are included free/);
  });

  it("mock_package_reply_matches_owner_decisions", () => {
    const reply = mockPackageReply("How much do MTD plans cost?");
    expect(reply).toBeTruthy();
    const lower = reply!.toLowerCase();
    expect(lower).toContain("29.99");
    expect(lower).toContain("xero");
    expect(lower).toContain("xero simple");
    expect(lower).toContain("customer responsibilities");
    expect(lower).toContain("will not invent");
  });

  it("sign_up_links_present_in_catalogue_text", () => {
    const text = packageCatalogText();
    expect(text).toContain("https://www.taxsimba.co.uk/self-assessment");
    expect(text).toContain("https://www.taxsimba.co.uk/making-tax-digital");
    expect(text).toContain("https://www.taxsimba.co.uk/register");
  });
});
