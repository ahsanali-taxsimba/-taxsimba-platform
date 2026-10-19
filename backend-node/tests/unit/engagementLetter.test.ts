import { describe, expect, it } from "vitest";

import {
  ENGAGEMENT_LETTER_LEGAL_TEMPLATE,
  ENGAGEMENT_TEMPLATE_VERSION,
  buildOurRef,
  buildScheduleLine,
  formatLetterDate,
  hashBody,
  parseAddressLines,
  parseClientName,
  renderEngagementBody,
} from "../../src/domain/engagementLetter";

describe("engagement letter template", () => {
  it("keeps frozen legal wording and only fills placeholders", () => {
    expect(ENGAGEMENT_TEMPLATE_VERSION).toBe(1);
    expect(ENGAGEMENT_LETTER_LEGAL_TEMPLATE).toContain("Terms of Engagement");
    expect(ENGAGEMENT_LETTER_LEGAL_TEMPLATE).toContain("LIMITATION OF LIABILITY");
    expect(ENGAGEMENT_LETTER_LEGAL_TEMPLATE).toContain("YOUR RIGHT TO CANCEL");
    expect(ENGAGEMENT_LETTER_LEGAL_TEMPLATE).toContain("APPOINTMENT ACCEPTANCE");
    expect(ENGAGEMENT_LETTER_LEGAL_TEMPLATE).toContain("{{schedules_block}}");
    expect(ENGAGEMENT_LETTER_LEGAL_TEMPLATE).not.toContain("Ashley James Hadler");
  });

  it("renders client-specific fields without altering surrounding prose", () => {
    const body = renderEngagementBody({
      client_display_name: "Mr. Ashley James Hadler",
      address_block: "4 Madison Crescent\nBexleyheath\nDA7 5SZ",
      your_ref: "Mr. Ashley James Hadler",
      our_ref: "ES/AN-1039",
      letter_date: "19 October 2026",
      dear_name: "Mr. ASHLEY JAMES HADLER",
      primary_contact: "Mr. Asim Abbas",
      schedules_block:
        "Schedule 1\tPreparation & Submission of personal Tax Return   - Already included in Annual Fee Pack (£119.00 · Simple)",
      engagement_start_date: "19 October 2026",
      firm_signatory: "Asim Abbas",
      firm_name: "Wingate Accountants Ltd",
      firm_tel: "074819 00004",
      acceptance_name: "Mr ASHLEY JAMES HADLER",
      early_start_marker: "☐",
    });
    expect(body).toContain("Mr. Ashley James Hadler");
    expect(body).toContain("Our Ref:    ES/AN-1039");
    expect(body).toContain("Preparation & Submission of personal Tax Return");
    expect(body).toContain("We adhere to the ACCA’s Code of Ethics");
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

  it("builds our ref and schedule lines from system data", () => {
    expect(buildOurRef("CL-1039")).toBe("ES/AN-1039");
    expect(buildScheduleLine({
      sort_order: 1,
      service_type: "SELF_ASSESSMENT",
      package_name: "Simple",
      price: 119,
    })).toContain("Already included in Annual Fee Pack");
    expect(formatLetterDate("2026-10-19T12:00:00+00:00")).toMatch(/October 2026/);
  });
});
