import { describe, expect, it } from "vitest";

import {
  escapeHtml,
  formatPlainLinesAsSafeHtml,
  sanitizeMessageHtml,
} from "../../src/utils/sanitizeMessageHtml";

describe("sanitizeMessageHtml (J-005)", () => {
  it("renders intended <p> formatting without exposing raw tags as text", () => {
    const out = sanitizeMessageHtml("<p>dfgd</p>");
    expect(out).toBe("<p>dfgd</p>");
    expect(out).not.toMatch(/&lt;p&gt;/);
  });

  it("handles malformed UAT-style markup <p>dfgd<p>", () => {
    const out = sanitizeMessageHtml("<p>dfgd<p>");
    expect(out).toContain("dfgd");
    expect(out).toContain("<p>");
    expect(out).not.toMatch(/&lt;p&gt;dfgd/);
  });

  it("strips script tags and does not preserve executable payloads", () => {
    const out = sanitizeMessageHtml(
      '<p>hi</p><script>window.__xss=1</script><img src=x onerror="alert(1)">',
    );
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/onerror/i);
    expect(out).not.toMatch(/window\.__xss/);
    expect(out).toContain("hi");
  });

  it("strips event-handler attributes on allowlisted tags", () => {
    const out = sanitizeMessageHtml('<p onclick="alert(1)">click me</p>');
    expect(out).toBe("<p>click me</p>");
    expect(out).not.toMatch(/onclick/i);
  });

  it("neutralizes javascript: hrefs", () => {
    const out = sanitizeMessageHtml('<a href="javascript:alert(1)">go</a>');
    expect(out).not.toMatch(/javascript:/i);
    expect(out).toContain("go");
  });

  it("keeps safe http(s) links", () => {
    const out = sanitizeMessageHtml('<a href="https://example.com/x">go</a>');
    expect(out).toContain('href="https://example.com/x"');
    expect(out).toContain("rel=");
  });

  it("escapes plain text and preserves newlines as br", () => {
    expect(sanitizeMessageHtml("a < b\nc")).toBe("a &lt; b<br/>c");
  });

  it("formatPlainLinesAsSafeHtml escapes compose input", () => {
    const out = formatPlainLinesAsSafeHtml("<script>x</script>\nok");
    expect(out).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(out).toContain("<p");
    expect(out).toContain(">ok</p>");
  });

  it("escapeHtml escapes entities", () => {
    expect(escapeHtml(`<a "b">`)).toBe("&lt;a &quot;b&quot;&gt;");
  });
});
