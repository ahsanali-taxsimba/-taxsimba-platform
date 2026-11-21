import { describe, expect, it } from "vitest";
import { answerMtdEligibility } from "../src/knowledge/mtd_eligibility.js";
import { answerMtdOperationsQuestion } from "../src/knowledge/mtd_operations.js";
import { answerAmbiguousIntent } from "../src/knowledge/intent_clarifier.js";
import { DIVIDEND_ALLOWANCE_GBP } from "../src/knowledge/uk_tax_facts.js";

describe("source-backed tax fact fixes", () => {
  it("dividend_allowance_is_500_not_2000", () => {
    expect(DIVIDEND_ALLOWANCE_GBP).toBe(500);
    const r = answerAmbiguousIntent(
      "I receive dividends from shares. When might Self Assessment be required?",
    );
    expect(r?.customer_reply).toMatch(/£500/);
    expect(r?.customer_reply).not.toMatch(/£2,000|£2000/);
  });

  it("combines_rent_and_self_employment_for_qi", () => {
    const r = answerMtdEligibility(
      "I have £15,000 rent and £18,000 self-employment turnover in 2025/26. Are they combined for MTD?",
    );
    expect(r?.handled).toBe(true);
    // Combined £33,000 > £30,000 for 2025-26 → April 2027
    expect(r?.customer_reply).toMatch(/33,?000|combined|more than £30,000/i);
    expect(r?.customer_reply).toMatch(/6 April 2027/);
    expect(r?.customer_reply.toLowerCase()).not.toMatch(
      /considered separately for tax purposes/,
    );
  });

  it("uses_turnover_not_profit_and_not_vat_for_mtd", () => {
    const r = answerMtdEligibility(
      "I made £70,000 profit but £90,000 turnover in 2024/25. Which number matters for MTD?",
    );
    expect(r?.handled).toBe(true);
    expect(r?.customer_reply.toLowerCase()).toMatch(/turnover|qualifying|before expenses/);
    expect(r?.customer_reply).toMatch(/6 April 2026/);
    expect(r?.customer_reply.toLowerCase()).not.toMatch(/vat registration/);
  });

  it("multi_year_qi_maps_each_band_correctly", () => {
    const r = answerMtdEligibility(
      "I earned £55,000 in 2025/26 but only £20,000 in 2024/25. Which start date should be assessed for MTD?",
    );
    expect(r?.handled).toBe(true);
    expect(r?.customer_reply).toMatch(/2024-25/);
    expect(r?.customer_reply).toMatch(/2025-26/);
    expect(r?.customer_reply).toMatch(/6 April 2027/);
    // Must not claim April 2026 solely from the 2025-26 £55k figure
    expect(r?.customer_reply).not.toMatch(
      /2025-26[^\n]{0,80}6 April 2026/,
    );
  });

  it("agents_can_submit_quarterly_updates", () => {
    const r = answerMtdOperationsQuestion(
      "Can my accountant submit my MTD updates for me?",
    );
    expect(r).toBeTruthy();
    expect(r!.toLowerCase()).toMatch(/yes|can complete and submit|authorise/);
    expect(r!.toLowerCase()).not.toMatch(/cannot submit them directly/);
  });

  it("quarterly_updates_do_not_replace_return", () => {
    const r = answerMtdOperationsQuestion(
      "Do quarterly updates replace my year-end tax return entirely?",
    );
    expect(r).toBeTruthy();
    expect(r!.toLowerCase()).toMatch(/do not replace|not replace/);
    expect(r!.toLowerCase()).toMatch(/tax return|self assessment/);
  });

  it("explains_sa_without_package_dump", () => {
    const r = answerAmbiguousIntent("What is Self Assessment?");
    expect(r?.handled).toBe(true);
    expect(r?.customer_reply.toLowerCase()).toMatch(/self assessment/);
    expect(r?.customer_reply).not.toMatch(/£119|Simple £119|Simbian/);
  });

  it("explains_repairs_vs_improvements_without_catalogue", () => {
    const r = answerAmbiguousIntent(
      "What is the difference between repairs and improvements for landlords?",
    );
    expect(r?.handled).toBe(true);
    expect(r?.customer_reply.toLowerCase()).toMatch(/repair|restore|capital|improvement/);
    expect(r?.customer_reply).not.toMatch(/£119|Simbian Comply/);
    expect(r?.customer_reply).toMatch(/gov\.uk\/guidance\/income-tax-when-you-rent-out-a-property/);
  });

  it("explains_quarterly_vs_final_declaration_without_catalogue_dump", () => {
    const r = answerMtdOperationsQuestion(
      "What is the difference between quarterly updates and the final declaration?",
    );
    expect(r).toBeTruthy();
    expect(r!.toLowerCase()).toMatch(/not tax returns|do not replace|not replace/);
    expect(r!).not.toMatch(/£119|Self Assessment \(per tax year\)/);
  });
});
