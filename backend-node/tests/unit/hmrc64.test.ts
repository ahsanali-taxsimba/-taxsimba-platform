import { describe, expect, it } from "vitest";

import {
  evaluatePrecheck,
  buildFillFields,
} from "../../src/services/hmrc64";
import { renderHmrc64Html, splitAddress } from "../../src/domain/hmrc64";

describe("splitAddress", () => {
  it("extracts UK postcode and lines", () => {
    const a = splitAddress("12 High Street, Leeds, West Yorkshire, LS1 2AB");
    expect(a.postcode).toBe("LS1 2AB");
    expect(a.line1).toBe("12 High Street");
    expect(a.line2).toBe("Leeds");
  });

  it("handles empty address", () => {
    expect(splitAddress("")).toEqual({ line1: "", line2: "", line3: "", postcode: "" });
  });
});

describe("buildFillFields + precheck", () => {
  it("maps client master data into 64-8 boxes", () => {
    const fields = buildFillFields({
      name: "Jordan Client",
      address: "1 Tax Lane\nLondon\nSW1A 1AA",
      date_of_birth: "1990-05-01",
      utr: "1234567890",
      ni_number: "QQ123456C",
    });
    expect(fields.client_full_name).toBe("Jordan Client");
    expect(fields.utr).toBe("1234567890");
    expect(fields.ni_number).toBe("QQ123456C");
    expect(fields.address_postcode).toBe("SW1A 1AA");
    expect(evaluatePrecheck(fields).ready).toBe(true);
  });

  it("blocks generate when name or address missing", () => {
    const fields = buildFillFields({ name: "", address: "" });
    const r = evaluatePrecheck(fields);
    expect(r.ready).toBe(false);
    expect(r.missing.join(" ")).toMatch(/name/i);
  });
});

describe("renderHmrc64Html", () => {
  it("keeps HMRC labels and inserts values only", () => {
    const html = renderHmrc64Html(
      {
        client_full_name: "Jordan Client",
        address_line_1: "1 Tax Lane",
        address_line_2: "London",
        address_line_3: "",
        address_postcode: "SW1A 1AA",
        date_of_birth: "1990-05-01",
        ni_number: "QQ123456C",
        utr: "1234567890",
        business_name: "",
        business_utr: "",
        vat_registration_number: "",
        company_registration_number: "",
        agent_name: "TaxSimba",
        agent_address: "UK",
        agent_phone: "",
        agent_reference: "A123",
      },
      { generated_at: "2026-01-01T00:00:00.000Z" },
    );
    expect(html).toContain("Authorising your agent");
    expect(html).toContain("National Insurance number");
    expect(html).toContain("Unique Taxpayer Reference (UTR)");
    expect(html).toContain("Jordan Client");
    expect(html).toContain('data-field="utr"');
  });
});
