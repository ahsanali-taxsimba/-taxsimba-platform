import { describe, expect, it } from "vitest";

import {
  DOCUMENT_TYPES,
  HMRC_CONSENT_TEXT,
  REQUEST_STATUSES,
  hashPayload,
  hashToken,
  mintSigningToken,
  renderMerge,
} from "../../src/domain/esign";
import { buildCertificateHtml } from "../../src/services/esign";

describe("esign domain", () => {
  it("hashes payloads canonically regardless of key order", () => {
    const a = hashPayload({ b: 2, a: 1, nested: { z: 9, y: 8 } });
    const b = hashPayload({ a: 1, nested: { y: 8, z: 9 }, b: 2 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("mints unique signing tokens and hashes them", () => {
    const t1 = mintSigningToken();
    const t2 = mintSigningToken();
    expect(t1).not.toBe(t2);
    expect(t1.length).toBeGreaterThan(20);
    expect(hashToken(t1)).toHaveLength(64);
    expect(hashToken(t1)).not.toBe(t1);
  });

  it("renders merge fields into templates", () => {
    const out = renderMerge("Hello {{client_name}} — due {{figures.total}}", {
      client_name: "Alex",
      figures: { total: "£100" },
    });
    expect(out).toBe("Hello Alex — due £100");
  });

  it("exposes the HMRC consent wording and core enums", () => {
    expect(HMRC_CONSENT_TEXT).toMatch(/authorise submission to HMRC/i);
    expect(DOCUMENT_TYPES).toContain("SA_SUMMARY_APPROVAL");
    expect(DOCUMENT_TYPES).toContain("MTD_QUARTERLY_APPROVAL");
    expect(REQUEST_STATUSES).toContain("SIGNED");
  });
});

describe("signature certificate", () => {
  it("includes document hash, signers and event timeline", () => {
    const html = buildCertificateHtml({
      document: {
        id: "doc-1",
        title: "SA approval",
        type: "SA_SUMMARY_APPROVAL",
        version: 1,
        calculation_hash: "abc123",
        client_name: "Alex",
        tax_period_label: "2024/25",
        case_id: "case-1",
        mtd_period_id: null,
      },
      request: {
        id: "req-1",
        sent_at: "2026-01-01T00:00:00+00:00",
        completed_at: "2026-01-02T00:00:00+00:00",
        expires_at: "2026-01-15T00:00:00+00:00",
      },
      signers: [
        {
          name: "Alex",
          email: "alex@example.com",
          role: "CLIENT",
          signed_at: "2026-01-02T00:00:00+00:00",
          signature_type: "CLICK",
        },
      ],
      events: [
        {
          timestamp: "2026-01-01T00:00:00+00:00",
          event_type: "SENT",
          ip: "1.2.3.4",
          user_agent: "TestAgent",
        },
        {
          timestamp: "2026-01-02T00:00:00+00:00",
          event_type: "SIGNED",
          ip: "1.2.3.4",
          user_agent: "TestAgent",
        },
      ],
    });
    expect(html).toContain("Signature certificate");
    expect(html).toContain("abc123");
    expect(html).toContain("Alex");
    expect(html).toContain("SIGNED");
    expect(html).toContain(HMRC_CONSENT_TEXT);
  });
});
