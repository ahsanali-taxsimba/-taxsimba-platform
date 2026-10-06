import { describe, expect, it } from "vitest";

import { assertRevealReason } from "../../src/domain/revealReason";

describe("assertRevealReason (H-007)", () => {
  it("rejects empty / whitespace", () => {
    expect(() => assertRevealReason("")).toThrow(/reason is required/i);
    expect(() => assertRevealReason("   ")).toThrow(/reason is required/i);
  });

  it("rejects short and trivial reasons", () => {
    expect(() => assertRevealReason("x")).toThrow(/at least 10/i);
    expect(() => assertRevealReason("support")).toThrow(/at least 10/i);
    expect(() => assertRevealReason("test")).toThrow(/at least 10/i);
    expect(() => assertRevealReason("xxxxxxxxxx")).toThrow(/describe why/i);
  });

  it("accepts a meaningful audit reason", () => {
    expect(assertRevealReason("  Client support call regarding UTR  ")).toBe(
      "Client support call regarding UTR",
    );
  });
});
