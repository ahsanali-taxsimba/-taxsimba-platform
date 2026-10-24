import { createHash } from "crypto";

import { contentAutomationFixtureMode } from "../config";
import { SourceSnapshot } from "../types";
import fixturePages from "../fixtures/govuk-samples.json";

function hashBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

function basePathFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/\/$/, "") || "/";
  } catch {
    return url;
  }
}

export async function fetchGovukContent(url: string): Promise<SourceSnapshot> {
  const basePath = basePathFromUrl(url);
  if (contentAutomationFixtureMode()) {
    const sample =
      (fixturePages as Array<Record<string, unknown>>).find(
        (p) => String(p.base_path || "") === basePath || String(p.url || "") === url,
      ) || null;
    if (sample) {
      const body = JSON.stringify(sample);
      return {
        url,
        basePath,
        title: String(sample.title || ""),
        contentId: String(sample.content_id || ""),
        publicUpdatedAt: sample.public_updated_at
          ? String(sample.public_updated_at)
          : null,
        withdrawn: Boolean(sample.withdrawn_notice),
        hash: hashBody(body),
        excerpt: String(sample.description || "").slice(0, 400),
        fetchedAt: new Date().toISOString(),
      };
    }
    // Unknown URL in fixture mode: stable synthetic snapshot.
    const body = `fixture-missing:${basePath}`;
    return {
      url,
      basePath,
      title: basePath,
      publicUpdatedAt: null,
      withdrawn: false,
      hash: hashBody(body),
      excerpt: "",
      fetchedAt: new Date().toISOString(),
    };
  }

  const apiUrl = `https://www.gov.uk/api/content${basePath}`;
  const res = await fetch(apiUrl, {
    headers: { Accept: "application/json", "User-Agent": "TaxSimbaContentAutomation/1.0" },
  });
  if (res.status === 404) {
    return {
      url,
      basePath,
      withdrawn: true,
      hash: hashBody(`withdrawn:${basePath}`),
      fetchedAt: new Date().toISOString(),
      publicUpdatedAt: null,
      title: basePath,
    };
  }
  if (!res.ok) {
    throw new Error(`GOV.UK content API ${res.status} for ${basePath}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  const body = JSON.stringify(data);
  return {
    url,
    basePath,
    title: String(data.title || ""),
    contentId: data.content_id ? String(data.content_id) : undefined,
    publicUpdatedAt: data.public_updated_at ? String(data.public_updated_at) : null,
    withdrawn: Boolean(data.withdrawn_notice),
    hash: hashBody(body),
    excerpt: String(data.description || "").slice(0, 400),
    fetchedAt: new Date().toISOString(),
  };
}

/** Discovery via GOV.UK search API for monitored topics. */
export async function discoverGovukTopics(queries: string[]): Promise<
  Array<{ title: string; link: string; description: string }>
> {
  if (contentAutomationFixtureMode()) {
    return (fixturePages as Array<Record<string, unknown>>)
      .filter((p) => p.discovery)
      .map((p) => ({
        title: String(p.title || ""),
        link: `https://www.gov.uk${p.base_path}`,
        description: String(p.description || ""),
      }));
  }
  const out: Array<{ title: string; link: string; description: string }> = [];
  for (const q of queries.slice(0, 6)) {
    const url = `https://www.gov.uk/api/search.json?q=${encodeURIComponent(q)}&count=5`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "TaxSimbaContentAutomation/1.0" },
    });
    if (!res.ok) continue;
    const data = (await res.json()) as {
      results?: Array<{ title?: string; link?: string; description?: string }>;
    };
    for (const r of data.results || []) {
      if (!r.link) continue;
      out.push({
        title: r.title || "",
        link: r.link.startsWith("http") ? r.link : `https://www.gov.uk${r.link}`,
        description: r.description || "",
      });
    }
  }
  return out;
}
