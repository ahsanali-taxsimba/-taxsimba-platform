/** GOV.UK Content API client + text extraction for official pages. */

import { createHash } from "node:crypto";
import type { ContentApiMeta, FetchContentApiFn, PageSnapshot, WatchlistEntry } from "./types.js";
import { extractEffectiveDates, hostAllowed, stripHtml } from "./fetcher.js";

const DEFAULT_CONTENT_API = "https://www.gov.uk/api/content";
const UA = "TaxSimba-SIMBA-HMRC-Monitor/1.1 (+https://www.taxsimba.co.uk; content-api)";

export function contentApiBase(): string {
  return (
    process.env.GOVUK_CONTENT_API_BASE?.trim() ||
    DEFAULT_CONTENT_API
  ).replace(/\/$/, "");
}

export function pathFromGovUrl(url: string): string {
  const u = new URL(url);
  return u.pathname.replace(/\/$/, "") || "/";
}

function flattenDetailsText(details: Record<string, unknown> | null | undefined): string {
  if (!details) return "";
  const chunks: string[] = [];
  const body = details.body;
  if (typeof body === "string") chunks.push(body);
  const parts = details.parts;
  if (Array.isArray(parts)) {
    for (const part of parts) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (typeof p.title === "string") chunks.push(p.title);
      if (typeof p.body === "string") chunks.push(p.body);
    }
  }
  return chunks.join("\n");
}

export function textFromContentItem(json: Record<string, unknown>): {
  title: string;
  text: string;
  meta: ContentApiMeta;
} {
  const details = (json.details || {}) as Record<string, unknown>;
  const rawHtml = flattenDetailsText(details);
  const { text } = stripHtml(rawHtml);
  const withdrawn = (json.withdrawn_notice || {}) as Record<string, unknown>;
  const withdrawnAt = typeof withdrawn.withdrawn_at === "string" ? withdrawn.withdrawn_at : null;
  const meta: ContentApiMeta = {
    content_id: (json.content_id as string) || null,
    base_path: (json.base_path as string) || null,
    document_type: (json.document_type as string) || null,
    schema_name: (json.schema_name as string) || null,
    public_updated_at: (json.public_updated_at as string) || null,
    first_published_at: (json.first_published_at as string) || null,
    updated_at: (json.updated_at as string) || null,
    withdrawn: Boolean(withdrawnAt),
    withdrawn_at: withdrawnAt,
    withdrawn_explanation:
      typeof withdrawn.explanation === "string" ? withdrawn.explanation : null,
    publishing_app: (json.publishing_app as string) || null,
  };
  return {
    title: String(json.title || ""),
    text,
    meta,
  };
}

export const defaultFetchContentApi: FetchContentApiFn = async (basePath) => {
  const path = basePath.startsWith("/") ? basePath : `/${basePath}`;
  const url = `${contentApiBase()}${path}`;
  const resp = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    redirect: "follow",
  });
  if (resp.status === 404 || resp.status === 410) {
    return { status: resp.status, json: null, finalPath: path };
  }
  const json = (await resp.json()) as Record<string, unknown>;
  // Follow redirect document_type via redirects[].destination
  if (json.document_type === "redirect") {
    const redirects = (json.redirects || []) as Array<{ destination?: string }>;
    const dest = redirects[0]?.destination;
    if (dest) {
      return defaultFetchContentApi(dest);
    }
  }
  return {
    status: resp.status,
    json,
    finalPath: String(json.base_path || path),
  };
};

export async function fetchOfficialContent(
  entry: WatchlistEntry,
  allowedSuffixes: string[],
  opts?: {
    fetchContentApi?: FetchContentApiFn;
    fetchPage?: import("./types.js").FetchPageFn;
  },
): Promise<PageSnapshot> {
  const fetched_at = new Date().toISOString();
  const pageUrl = entry.url;
  if (!hostAllowed(pageUrl, allowedSuffixes)) {
    return emptySnap(entry, fetched_at, "URL host is not an allowed official .gov.uk source");
  }

  const basePath = entry.base_path || pathFromGovUrl(pageUrl);
  const fetchApi = opts?.fetchContentApi || defaultFetchContentApi;

  try {
    const { status, json, finalPath } = await fetchApi(basePath);
    if (!json || status >= 400) {
      // Optional HTML fallback
      if (opts?.fetchPage) {
        return htmlFallback(entry, allowedSuffixes, opts.fetchPage, fetched_at);
      }
      return emptySnap(
        entry,
        fetched_at,
        `Content API unavailable (${status}) for ${basePath}`,
        status,
      );
    }
    if (!hostAllowed(`https://www.gov.uk${finalPath}`, allowedSuffixes)) {
      return emptySnap(entry, fetched_at, `Content left official path: ${finalPath}`);
    }

    const { title, text, meta } = textFromContentItem(json);
    if (meta.withdrawn) {
      const snap = buildSnap({
        entry,
        fetched_at,
        status,
        source_mode: "content_api",
        title,
        text,
        meta,
        pageUrl,
      });
      snap.ok = false;
      snap.error = `Official content withdrawn at ${meta.withdrawn_at}`;
      return snap;
    }

    const lower = `${title}\n${text}`.toLowerCase();
    const publisher_markers_ok =
      lower.includes("gov.uk") ||
      lower.includes("hmrc") ||
      lower.includes("government") ||
      meta.publishing_app === "government-frontend" ||
      Boolean(meta.content_id);
    const title_markers_ok = entry.title_markers.every((m) =>
      lower.includes(m.toLowerCase()),
    );
    const missing_phrases = (entry.expected_phrases || []).filter((p) => {
      const norm = text.replace(/,/g, "");
      return !text.includes(p) && !norm.includes(p.replace(/,/g, ""));
    });
    const authenticity = {
      host_ok: true,
      publisher_markers_ok,
      title_markers_ok,
      expected_phrases_ok: missing_phrases.length === 0,
      missing_phrases,
    };
    const ok =
      status >= 200 &&
      status < 300 &&
      authenticity.host_ok &&
      authenticity.publisher_markers_ok &&
      authenticity.title_markers_ok &&
      // Title + body: short Content API fixtures/pages still authenticate when markers match
      `${title}\n${text}`.trim().length > 40;

    const version_token = [
      meta.content_id || "",
      meta.public_updated_at || "",
      meta.updated_at || "",
      createHash("sha256").update(text).digest("hex").slice(0, 16),
    ].join("|");

    return {
      watch_id: entry.id,
      url: pageUrl,
      fetched_at,
      http_status: status,
      source_mode: "content_api",
      content_hash: createHash("sha256").update(text).digest("hex"),
      version_token,
      title,
      text_excerpt: text.slice(0, 1000),
      full_text: text,
      text_length: text.length,
      content_api: meta,
      authenticity,
      effective_dates_found: extractEffectiveDates(text),
      ok,
      error: ok
        ? undefined
        : authenticity.expected_phrases_ok
          ? `Authenticity/content failure (status ${status})`
          : `Missing expected phrases: ${missing_phrases.join(", ")}`,
    };
  } catch (err) {
    if (opts?.fetchPage) {
      try {
        return await htmlFallback(entry, allowedSuffixes, opts.fetchPage, fetched_at);
      } catch {
        /* fall through */
      }
    }
    return emptySnap(entry, fetched_at, (err as Error).message || "content_api_fetch_failed");
  }
}

async function htmlFallback(
  entry: WatchlistEntry,
  allowedSuffixes: string[],
  fetchPage: import("./types.js").FetchPageFn,
  fetched_at: string,
): Promise<PageSnapshot> {
  const { fetchWatchPage } = await import("./fetcher.js");
  const snap = await fetchWatchPage(entry, allowedSuffixes, fetchPage);
  return {
    ...snap,
    source_mode: "html_fallback",
    version_token: snap.content_hash,
  };
}

function emptySnap(
  entry: WatchlistEntry,
  fetched_at: string,
  error: string,
  status = 0,
): PageSnapshot {
  return {
    watch_id: entry.id,
    url: entry.url,
    fetched_at,
    http_status: status,
    source_mode: "error",
    content_hash: "",
    version_token: "",
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
    error,
  };
}

function buildSnap(args: {
  entry: WatchlistEntry;
  fetched_at: string;
  status: number;
  source_mode: PageSnapshot["source_mode"];
  title: string;
  text: string;
  meta: ContentApiMeta;
  pageUrl: string;
}): PageSnapshot {
  const hash = createHash("sha256").update(args.text).digest("hex");
  return {
    watch_id: args.entry.id,
    url: args.pageUrl,
    fetched_at: args.fetched_at,
    http_status: args.status,
    source_mode: args.source_mode,
    content_hash: hash,
    version_token: hash,
    title: args.title,
    text_excerpt: args.text.slice(0, 1000),
    text_length: args.text.length,
    content_api: args.meta,
    authenticity: {
      host_ok: true,
      publisher_markers_ok: true,
      title_markers_ok: true,
      expected_phrases_ok: true,
      missing_phrases: [],
    },
    effective_dates_found: extractEffectiveDates(args.text),
    ok: true,
  };
}
