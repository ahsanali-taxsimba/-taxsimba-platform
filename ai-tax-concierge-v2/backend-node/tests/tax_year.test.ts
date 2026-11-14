import { describe, expect, it } from "vitest";
import {
  appliesToYear,
  resolveTaxYear,
  taxYearBounds,
  taxYearLabel,
} from "../src/knowledge/tax_year.js";

describe("tax year utilities", () => {
  it("tax_year_label after 6 April", () => {
    expect(taxYearLabel(new Date(2025, 3, 6))).toBe("2025-26");
    expect(taxYearLabel(new Date(2025, 11, 1))).toBe("2025-26");
  });

  it("tax_year_label before 6 April", () => {
    expect(taxYearLabel(new Date(2025, 3, 5))).toBe("2024-25");
    expect(taxYearLabel(new Date(2026, 0, 31))).toBe("2025-26");
  });

  it("tax_year_bounds", () => {
    const [start, end] = taxYearBounds("2025-26");
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(3);
    expect(start.getDate()).toBe(6);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(3);
    expect(end.getDate()).toBe(5);
  });

  it("resolve_explicit_override", () => {
    expect(resolveTaxYear("2024/25")).toBe("2024-25");
  });

  it("applies_to_year", () => {
    expect(appliesToYear(["2024-25", "2025-26"], "2025-26")).toBe(true);
    expect(appliesToYear(["2024-25"], "2025-26")).toBe(false);
  });
});
