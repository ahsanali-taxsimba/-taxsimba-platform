import { describe, expect, it } from "vitest";

import {
  INTAKE_CATEGORY_DEFS,
  hashFileBuffer,
} from "../../src/domain/taxReturnIntake";
import { mapCategoryToTaxSection } from "../../src/services/taxReturnIntake";

describe("tax return intake categories", () => {
  it("defines all nine intake categories with tax-section mapping", () => {
    expect(INTAKE_CATEGORY_DEFS).toHaveLength(9);
    expect(INTAKE_CATEGORY_DEFS.map((c) => c.key)).toEqual([
      "BANK_STATEMENTS",
      "FINANCIAL_STATEMENTS",
      "PENSION_DOCUMENTS",
      "EMPLOYMENT_RECORDS",
      "DIVIDENDS_INTEREST",
      "HMRC_LETTERS",
      "OTHER_INCOME",
      "OTHER_EXPENSES",
      "ANY_OTHER",
    ]);
    expect(INTAKE_CATEGORY_DEFS.filter((c) => c.mandatory).map((c) => c.key)).toEqual([
      "BANK_STATEMENTS",
      "EMPLOYMENT_RECORDS",
    ]);
  });

  it("maps categories to preparation sections", () => {
    expect(mapCategoryToTaxSection("BANK_STATEMENTS")).toBe("bank_analysis");
    expect(mapCategoryToTaxSection("EMPLOYMENT_RECORDS")).toBe("employment_income");
    expect(mapCategoryToTaxSection("DIVIDENDS_INTEREST")).toBe("investment_income");
    expect(mapCategoryToTaxSection("HMRC_LETTERS")).toBe("compliance");
    expect(mapCategoryToTaxSection("OTHER_EXPENSES")).toBe("allowable_expenses");
  });

  it("hashes file buffers for duplicate detection", () => {
    const a = hashFileBuffer(Buffer.from("hello"));
    const b = hashFileBuffer(Buffer.from("hello"));
    const c = hashFileBuffer(Buffer.from("world"));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});
