/**
 * Allowlisted message-body sanitizer (shared logic mirrored in client/admin FE).
 * Used for unit tests and optional server-side defense-in-depth.
 */
const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "div",
  "span",
  "h3",
  "h4",
]);

const VOID_TAGS = new Set(["br"]);

export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function looksLikeHtml(value: string | null | undefined): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(String(value ?? ""));
}

/** Decode common entities once, then escape — avoids double-encoding compose output. */
function normalizeTextNode(value: string): string {
  const decoded = String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return escapeHtml(decoded);
}

function sanitizeHref(raw: string | null | undefined): string | null {
  const href = String(raw ?? "").trim();
  if (!href) return null;
  if (/^\s*javascript:/i.test(href)) return null;
  if (/^\s*data:/i.test(href)) return null;
  if (/^\s*vbscript:/i.test(href)) return null;
  if (/^(https?:|mailto:|\/|#)/i.test(href)) return href;
  return null;
}

export function sanitizeMessageHtml(raw: string | null | undefined): string {
  const input = String(raw ?? "");
  if (!input.trim()) return "";

  if (!looksLikeHtml(input)) {
    return escapeHtml(input).replace(/\r\n|\r|\n/g, "<br/>");
  }

  let html = input
    .replace(
      /<\s*(script|style|iframe|object|embed|link|meta|base)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      "",
    )
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|base)[^>]*\/?\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  html = html.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  html = html.replace(/\s(href|src|xlink:href)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, "");

  const out: string[] = [];
  const openAnchorSafe: boolean[] = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)/g;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html)) !== null) {
    if (match[3] != null) {
      out.push(normalizeTextNode(match[3]));
      continue;
    }
    const tagName = String(match[1] || "").toLowerCase();
    const full = match[0];
    const isClose = /^<\s*\//.test(full);
    const selfClosing = /\/\s*>$/.test(full) || VOID_TAGS.has(tagName);

    if (tagName === "a") {
      if (isClose) {
        const wasSafe = openAnchorSafe.pop();
        out.push(wasSafe === false ? "</span>" : "</a>");
        continue;
      }
      const hrefMatch = full.match(/\bhref\s*=\s*(["'])(.*?)\1/i);
      const safeHref = hrefMatch ? sanitizeHref(hrefMatch[2]) : null;
      if (safeHref) {
        openAnchorSafe.push(true);
        out.push(
          `<a href="${escapeHtml(safeHref)}" rel="noopener noreferrer" target="_blank">`,
        );
      } else {
        openAnchorSafe.push(false);
        out.push("<span>");
      }
      continue;
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      continue;
    }

    if (isClose) {
      out.push(`</${tagName}>`);
      continue;
    }

    if (tagName === "br" || selfClosing) {
      out.push("<br/>");
    } else {
      out.push(`<${tagName}>`);
    }
  }

  return out.join("");
}

export function formatPlainLinesAsSafeHtml(plainText: string | null | undefined): string {
  const text = String(plainText ?? "");
  if (!text.trim()) return "";
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(
      (line) =>
        `<p style="margin-bottom: 15px; color: #666; font-size: 16px; line-height: 1.6;">${escapeHtml(line)}</p>`,
    )
    .join("");
}
