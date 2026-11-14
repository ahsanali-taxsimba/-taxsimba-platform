/** Official-source fetch + authenticity checks for GOV.UK / HMRC pages. */

import { createHash } from "node:crypto";
import type { FetchPageFn, PageSnapshot, WatchlistEntry } from "./types.js";

const DEFAULT_UA =
  "TaxSimba-SIMBA-HMRC-Monitor/1.0 (+https://www.taxsimba.co.uk; knowledge-verification)";

export function hostAllowed(url: string, suffixes: string[]): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (!host) return false;
    return suffixes.some(
      (s) => host === s.replace(/^\./, "") || host.endsWith(s),
    );
  } catch {
    return false;
  }
}

export function stripHtml(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = (titleMatch?.[1] || "")
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .trim();
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  return { title, text };
}

export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function extractEffectiveDates(text: string): string[] {
  const out = new Set<string>();
  const iso = text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g);
  for (const m of iso) out.add(`${m[1]}-${m[2]}-${m[3]}`);
  const dmy = text.matchAll(
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/gi,
  );
  const months: Record<string, string> = {
    january: "01",
    february: "02",
    march: "03",
    april: "04",
    may: "05",
    june: "06",
    july: "07",
    august: "08",
    september: "09",
    october: "10",
    november: "11",
    december: "12",
  };
  for (const m of dmy) {
    const day = String(m[1]).padStart(2, "0");
    const mo = months[m[2]!.toLowerCase()];
    if (mo) out.add(`${m[3]}-${mo}-${day}`);
  }
  return [...out].sort();
}

export const defaultFetchPage: FetchPageFn = async (url) => {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": DEFAULT_UA,
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  const html = await resp.text();
  return { status: resp.status, html, finalUrl: resp.url || url };
};

export async function fetchWatchPage(
  entry: WatchlistEntry,
  allowedSuffixes: string[],
  fetchPage: FetchPageFn = defaultFetchPage,
): Promise<PageSnapshot> {
  const fetched_at = new Date().toISOString();
  if (!hostAllowed(entry.url, allowedSuffixes)) {
    return {
      watch_id: entry.id,
      url: entry.url,
      fetched_at,
      http_status: 0,
      content_hash: "",
      title: "",
      text_excerpt: "",
      text_length: 0,
      authenticity: {
        host_ok: false,
        publisher_markers_ok: false,
        title_markers_ok: false,
        expected_phrases_ok: false,
        missing_phrases: entry.expected_phrases || [],
      },
      effective_dates_found: [],
      ok: false,
      error: "URL host is not an allowed official .gov.uk source",
    };
  }

  try {
    const { status, html, finalUrl } = await fetchPage(entry.url);
    if (!hostAllowed(finalUrl, allowedSuffixes)) {
      return {
        watch_id: entry.id,
        url: entry.url,
        fetched_at,
        http_status: status,
        content_hash: "",
        title: "",
        text_excerpt: "",
        text_length: 0,
        authenticity: {
          host_ok: false,
          publisher_markers_ok: false,
          title_markers_ok: false,
          expected_phrases_ok: false,
          missing_phrases: entry.expected_phrases || [],
        },
        effective_dates_found: [],
        ok: false,
        error: `Redirect left official domain: ${finalUrl}`,
      };
    }
    const { title, text } = stripHtml(html);
    const lower = `${title}\n${text}`.toLowerCase();
    const publisher_markers_ok =
      lower.includes("gov.uk") ||
      lower.includes("hmrc") ||
      lower.includes("government");
    const title_markers_ok = entry.title_markers.every((m) =>
      lower.includes(m.toLowerCase()),
    );
    const missing_phrases = (entry.expected_phrases || []).filter(
      (p) => !text.includes(p) && !text.replace(/,/g, "").includes(p.replace(/,/g, "")),
    );
    const expected_phrases_ok = missing_phrases.length === 0;
    const authenticity = {
      host_ok: true,
      publisher_markers_ok,
      title_markers_ok,
      expected_phrases_ok,
      missing_phrases,
    };
    const ok =
      status >= 200 &&
      status < 300 &&
      authenticity.host_ok &&
      authenticity.publisher_markers_ok &&
      authenticity.title_markers_ok;
    return {
      watch_id: entry.id,
      url: entry.url,
      fetched_at,
      http_status: status,
      content_hash: contentHash(text),
      title,
      text_excerpt: text.slice(0, 800),
      text_length: text.length,
      authenticity,
      effective_dates_found: extractEffectiveDates(text),
      ok,
      error: ok
        ? undefined
        : expected_phrases_ok
          ? `Authenticity or HTTP failure (status ${status})`
          : `Missing expected phrases: ${missing_phrases.join(", ")}`,
    };
  } catch (err) {
    return {
      watch_id: entry.id,
      url: entry.url,
      fetched_at,
      http_status: 0,
      content_hash: "",
      title: "",
      text_excerpt: "",
      text_length: 0,
      authenticity: {
        host_ok: true,
        publisher_markers_ok: false,
        title_markers_ok: false,
        expected_phrases_ok: false,
        missing_phrases: entry.expected_phrases || [],
      },
      effective_dates_found: [],
      ok: false,
      error: (err as Error).message || "fetch_failed",
    };
  }
}
