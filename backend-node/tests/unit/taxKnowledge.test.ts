import { describe, expect, it } from "vitest";

import {
  SUGGESTED_TAGS,
  TAX_KNOWLEDGE_CATEGORIES,
  canEditKnowledge,
  canViewKnowledge,
} from "../../src/domain/taxKnowledge";
import { knowledgeMeta } from "../../src/services/taxKnowledge";

describe("Tax Knowledge Library ACL", () => {
  it("allows accountants and admins to view and edit", () => {
    for (const role of ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"]) {
      expect(canViewKnowledge(role)).toBe(true);
      expect(canEditKnowledge(role)).toBe(true);
    }
  });

  it("treats junior accountants as notes-only (no edit)", () => {
    expect(canViewKnowledge("JUNIOR_ACCOUNTANT")).toBe(true);
    expect(canEditKnowledge("JUNIOR_ACCOUNTANT")).toBe(false);
  });

  it("blocks clients", () => {
    expect(canViewKnowledge("CLIENT")).toBe(false);
    expect(canEditKnowledge("CLIENT")).toBe(false);
  });

  it("allows manager / senior accountant editors when those roles exist", () => {
    expect(canEditKnowledge("MANAGER")).toBe(true);
    expect(canEditKnowledge("SENIOR_ACCOUNTANT")).toBe(true);
  });
});

describe("Tax Knowledge catalogue metadata", () => {
  it("exposes SA/CT/VAT/PAYE/CIS/MTD/AML/General categories", () => {
    expect(TAX_KNOWLEDGE_CATEGORIES).toEqual([
      "SA",
      "CT",
      "VAT",
      "PAYE",
      "CIS",
      "MTD",
      "AML",
      "General",
    ]);
  });

  it("includes suggested HMRC-style tags", () => {
    expect(SUGGESTED_TAGS).toContain("HMRC Manual");
    expect(SUGGESTED_TAGS).toContain("MTD ITSA");
    expect(SUGGESTED_TAGS).toContain("VAT Flat Rate");
  });

  it("knowledgeMeta mirrors domain constants", () => {
    const meta = knowledgeMeta();
    expect(meta.categories).toEqual([...TAX_KNOWLEDGE_CATEGORIES]);
    expect(meta.suggested_tags).toEqual([...SUGGESTED_TAGS]);
  });
});
