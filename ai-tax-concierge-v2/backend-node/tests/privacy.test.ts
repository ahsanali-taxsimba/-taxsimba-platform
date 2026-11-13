import { describe, expect, it } from "vitest";
import { privacyFlags, redactPii } from "../src/core/privacy.js";

describe("privacy redaction", () => {
  it("redact_email_and_ni", () => {
    const text = "Contact me at jane.doe@example.com NI QQ123456C please";
    const redacted = redactPii(text);
    expect(redacted).not.toContain("jane.doe@example.com");
    expect(redacted).toContain("[REDACTED_EMAIL]");
    expect(redacted).not.toContain("QQ123456C");
    expect(redacted).toContain("[REDACTED_NI]");
  });

  it("redact_utr_and_phone", () => {
    const text = "UTR 1234567890 phone 07123 456789";
    const redacted = redactPii(text);
    expect(redacted).not.toContain("1234567890");
    expect(redacted).toContain("[REDACTED_UTR]");
    expect(redacted).toContain("[REDACTED_PHONE]");
  });

  it("privacy_flags", () => {
    const flags = privacyFlags("email test@example.com");
    expect(flags.email).toBe(true);
    expect(flags.ni).toBe(false);
  });
});
