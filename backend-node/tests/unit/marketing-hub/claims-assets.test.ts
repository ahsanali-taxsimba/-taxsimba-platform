import { readFileSync } from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

import { scanDraftClaims } from "../../../src/marketing-hub/claims";
import { readImageDimensions } from "../../../src/marketing-hub/imageDims";
import { assetIdForSlot, emptyAssetSlot, validateAssetFile } from "../../../src/marketing-hub/assets";

describe("publication claim guards", () => {
  it("blocks HMRC endorsement, fake reviews and unverified prices", () => {
    const issues = scanDraftClaims({
      focus: "SELF_ASSESSMENT",
      title: "File with us",
      caption: "We are HMRC approved and rated 5 stars on Trustpilot",
      copyLong: "Only £99 this week — guaranteed refund",
      googleAdsDraft: "",
      landingCta: "",
      videoScript: "",
    });
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("hmrc_endorsement");
    expect(codes).toContain("fake_review");
    expect(codes).toContain("unverified_price");
    expect(codes).toContain("guaranteed_outcome");
  });

  it("allows clean fixture-style copy", () => {
    const issues = scanDraftClaims({
      focus: "MTD",
      title: "MTD quarterly habits",
      caption: "Check GOV.UK for your tax year before you act.",
      copyLong: "TaxSimba provides accountant-led support. Not personal tax advice.",
      googleAdsDraft: "Owner must set bids — no automated spend.",
      landingCta: "Compare MTD support — verify live price on checkout.",
      videoScript: "Use approved logo assets only.",
    });
    expect(issues).toEqual([]);
  });
});

describe("asset slots and dimensions", () => {
  it("maps stable TS-001…TS-120 ids", () => {
    expect(assetIdForSlot(1)).toBe("TS-001");
    expect(assetIdForSlot(120)).toBe("TS-120");
    expect(emptyAssetSlot(5).isFinishedArtwork).toBe(false);
    expect(emptyAssetSlot(5).approvalStatus).toBe("unuploaded");
  });

  it("reads 1080 PNG fixture and validates high-res", () => {
    const png = readFileSync(path.join(__dirname, "../../fixtures/marketing-asset-1080.png"));
    const dims = readImageDimensions(png);
    expect(dims.width).toBe(1080);
    expect(dims.height).toBe(1080);
    expect(dims.format).toBe("png");
    const ok = validateAssetFile({
      buffer: png,
      mimetype: "image/png",
      originalname: "hero.png",
      size: png.length,
    });
    expect(ok.ok).toBe(true);
  });
});
