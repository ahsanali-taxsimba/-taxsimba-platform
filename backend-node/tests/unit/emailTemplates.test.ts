import { describe, expect, it } from "vitest";

import { applyMergeTokens, EMAIL_TEMPLATE_SEEDS } from "../../src/domain/emailTemplates";
import { normalizeMergeValues, previewTemplate } from "../../src/services/emailTemplates";

describe("Taxsimba email template catalogue", () => {
  it("seeds six Taxsimba Group Ltd templates", () => {
    expect(EMAIL_TEMPLATE_SEEDS).toHaveLength(6);
    expect(EMAIL_TEMPLATE_SEEDS.filter((t) => t.category === "admin")).toHaveLength(3);
    expect(EMAIL_TEMPLATE_SEEDS.filter((t) => t.category === "accountant")).toHaveLength(3);
    for (const t of EMAIL_TEMPLATE_SEEDS) {
      expect(t.title).toMatch(/Taxsimba Group Ltd/);
      expect(t.is_active).toBe(true);
    }
  });
});

describe("merge tokens", () => {
  it("replaces square-bracket placeholders", () => {
    const out = applyMergeTokens("Dear [Client Name], from [Staff Name].", {
      "[Client Name]": "Alex Client",
      "[Staff Name]": "Sam Accountant",
    });
    expect(out).toBe("Dear Alex Client, from Sam Accountant.");
  });

  it("previews a template with normalised merge values", () => {
    const tpl = {
      subject: "Hello [Client Name]",
      body: "Missing: [Missing Item 1] and [Missing Item 2]",
    };
    const merge = normalizeMergeValues({
      "Client Name": "Jordan",
      "[Missing Item 1]": "P60",
      "[Missing Item 2]": "Bank statements",
    });
    const preview = previewTemplate(tpl, merge);
    expect(preview.subject).toBe("Hello Jordan");
    expect(preview.body).toContain("P60");
    expect(preview.body).toContain("Bank statements");
  });
});
