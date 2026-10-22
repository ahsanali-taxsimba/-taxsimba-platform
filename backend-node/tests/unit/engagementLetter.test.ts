import { describe, expect, it } from "vitest";

import {
  ENGAGEMENT_LETTER_LEGAL_TEMPLATE,
  ENGAGEMENT_TEMPLATE_VERSION,
  buildOurRef,
  buildScheduleLine,
  firmDefaults,
  formatLetterDate,
  hashBody,
  parseAddressLines,
  parseClientName,
  renderEngagementBody,
} from "../../src/domain/engagementLetter";

describe("engagement letter template", () => {
  it("is Taxsimba Group Ltd branded with no Wingate or ACCA wording", () => {
    expect(ENGAGEMENT_TEMPLATE_VERSION).toBe(2);
    expect(ENGAGEMENT_LETTER_LEGAL_TEMPLATE).toContain("Taxsimba Group Ltd");
    expect(ENGAGEMENT_LETTER_LEGAL_TEMPLATE).toContain("Terms of Engagement");
    expect(ENGAGEMENT_LETTER_LEGAL_TEMPLATE).toContain("LIMITATION OF LIABILITY");
    expect(ENGAGEMENT_LETTER_LEGAL_TEMPLATE).toContain("YOUR RIGHT TO CANCEL");
    expect(ENGAGEMENT_LETTER_LEGAL_TEMPLATE).toContain("APPOINTMENT ACCEPTANCE");
    expect(ENGAGEMENT_LETTER_LEGAL_TEMPLATE).toContain("{{schedules_block}}");
    expect(ENGAGEMENT_LETTER_LEGAL_TEMPLATE).toContain("{{firm_email}}");
    expect(ENGAGEMENT_LETTER_LEGAL_TEMPLATE).toMatch(/tax return/i);
    expect(ENGAGEMENT_LETTER_LEGAL_TEMPLATE).toMatch(/Making Tax Digital \(MTD\)/i);
    expect(ENGAGEMENT_LETTER_LEGAL_TEMPLATE).not.toMatch(/Wingate/i);
    expect(ENGAGEMENT_LETTER_LEGAL_TEMPLATE).not.toMatch(/\bACCA\b/);
    expect(ENGAGEMENT_LETTER_LEGAL_TEMPLATE).not.toContain("Ashley James Hadler");
  });

  it("defaults firm details to Taxsimba Group Ltd and admin@taxsimba.co.uk", () => {
    const firm = firmDefaults();
    expect(firm.firm_name).toBe("Taxsimba Group Ltd");
    expect(firm.email).toBe("admin@taxsimba.co.uk");
    expect(firm.our_ref_prefix).toBe("TS/EL");
    expect(firm.firm_name).not.toMatch(/Wingate/i);
  });

  it("renders client-specific fields without Wingate or ACCA", () => {
    const body = renderEngagementBody({
      client_display_name: "Mr. Ashley James Hadler",
      address_block: "4 Madison Crescent\nBexleyheath\nDA7 5SZ",
      your_ref: "Mr. Ashley James Hadler",
      our_ref: "TS/EL-1039",
      letter_date: "19 October 2026",
      dear_name: "Mr. ASHLEY JAMES HADLER",
      primary_contact: "Your assigned Taxsimba accountant",
      schedules_block:
        "Schedule 1\tTax return — preparation and submission of your Self Assessment tax return   - Package fee: £119.00 · Package: Simple",
      engagement_start_date: "19 October 2026",
      firm_signatory: "Authorised Signatory",
      firm_name: "Taxsimba Group Ltd",
      firm_email: "admin@taxsimba.co.uk",
      firm_tel: "",
      firm_tel_line: "",
      acceptance_name: "Mr ASHLEY JAMES HADLER",
      early_start_marker: "☐",
    });
    expect(body).toContain("Mr. Ashley James Hadler");
    expect(body).toContain("Our Ref:    TS/EL-1039");
    expect(body).toContain("Taxsimba Group Ltd");
    expect(body).toContain("admin@taxsimba.co.uk");
    expect(body).toContain("Package fee: £119.00");
    expect(body).toContain("recognised professional ethical standards");
    expect(body).not.toMatch(/Wingate/i);
    expect(body).not.toMatch(/\bACCA\b/);
    expect(hashBody(body)).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("client name / address helpers", () => {
  it("parses titled names and address lines", () => {
    const n = parseClientName("Mr. Ashley James Hadler");
    expect(n.title).toBe("Mr");
    expect(n.first_name).toBe("Ashley");
    expect(n.last_name).toBe("Hadler");
    expect(n.display_name_upper).toContain("ASHLEY JAMES HADLER");

    const a = parseAddressLines("4 Madison Crescent, Bexleyheath, DA7 5SZ");
    expect(a.line1).toBe("4 Madison Crescent");
    expect(a.postcode).toBe("DA7 5SZ");
  });

  it("builds our ref and schedule lines with package fees for SA and MTD", () => {
    expect(buildOurRef("CL-1039")).toBe("TS/EL-1039");
    const sa = buildScheduleLine({
      sort_order: 1,
      service_type: "SELF_ASSESSMENT",
      package_name: "Simple",
      price: 119,
    });
    expect(sa).toContain("Tax return");
    expect(sa).toContain("Package fee: £119.00");
    expect(sa).toContain("Package: Simple");
    expect(sa).not.toContain("Annual Fee Pack");

    const mtd = buildScheduleLine({
      sort_order: 2,
      service_type: "MTD_INCOME_TAX",
      package_name: "MTD Standard",
      price: 29,
      billing_frequency: "monthly",
    });
    expect(mtd).toContain("Making Tax Digital");
    expect(mtd).toContain("Package fee: £29.00");
    expect(mtd).toContain("Package: MTD Standard");
    expect(formatLetterDate("2026-10-19T12:00:00+00:00")).toMatch(/October 2026/);
  });
});
