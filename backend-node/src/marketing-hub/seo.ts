/**
 * Auto SEO intelligence — prioritises improving existing guides.
 * Does not invent search volumes, mass-publish AI articles, or create artificial backlinks.
 */

import { readFileSync, existsSync } from "fs";
import path from "path";

import { listConnections } from "./store";
import type { SeoRecommendation } from "./types";

type InventoryRow = {
  slug: string;
  title: string;
  launch_priority_rank?: string;
  publication_status?: string;
  category?: string;
};

function inventoryPath(): string {
  return path.resolve(
    __dirname,
    "../../../tax_simba_frontend/docs/inventories/taxsimba_articles_inventory_all120.csv",
  );
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(raw: string): InventoryRow[] {
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  const idx = (name: string) => headers.indexOf(name);
  const slugI = idx("slug");
  const titleI = idx("title");
  const rankI = idx("launch_priority_rank");
  const statusI = idx("publication_status");
  const catI = idx("category");
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    return {
      slug: cols[slugI] ?? "",
      title: cols[titleI] ?? "",
      launch_priority_rank: rankI >= 0 ? cols[rankI] : undefined,
      publication_status: statusI >= 0 ? cols[statusI] : undefined,
      category: catI >= 0 ? cols[catI] : undefined,
    };
  }).filter((r) => r.slug);
}

export function loadArticleInventory(): { count: number; rows: InventoryRow[]; source: string; ok: boolean } {
  const p = inventoryPath();
  if (!existsSync(p)) {
    return { count: 0, rows: [], source: p, ok: false };
  }
  const rows = parseCsv(readFileSync(p, "utf8"));
  return { count: rows.length, rows, source: p, ok: rows.length === 120 };
}

export async function buildSeoReport(): Promise<{
  generatedAt: string;
  articlePreservation: {
    expected: 120;
    found: number;
    ok: boolean;
    note: string;
  };
  google: {
    searchConsole: "not_connected" | "connected_pending_sync";
    analytics4: "not_connected" | "connected_pending_sync";
    note: string;
  };
  recommendations: SeoRecommendation[];
  guards: string[];
}> {
  const inventory = loadArticleInventory();
  const connections = await listConnections();
  const gsc = connections.find((c) => c.platform === "google_search_console");
  const ga4 = connections.find((c) => c.platform === "google_analytics_4");

  const top = inventory.rows
    .filter((r) => r.launch_priority_rank && Number(r.launch_priority_rank) > 0 && Number(r.launch_priority_rank) <= 20)
    .slice(0, 20);

  const recommendations: SeoRecommendation[] = top.slice(0, 8).map((r, i) => ({
    id: `seo-rec-${r.slug}`,
    priority: i < 3 ? "P1" : i < 6 ? "P2" : "P3",
    slug: r.slug,
    title: r.title,
    action: "Improve existing guide: refresh immediate answer, verify GOV.UK sources, strengthen internal links to related guides — do not create a duplicate URL.",
    rationale: `Launch priority rank ${r.launch_priority_rank}. Prefer updating /blogs/${r.slug} over publishing a new page.`,
    preserveUrl: true,
    requiresHumanReview: true,
  }));

  // Technical SEO checklist items (manual / staging verification — not claimed pass)
  recommendations.push({
    id: "seo-rec-technical-sitemap",
    priority: "P2",
    slug: "(site-wide)",
    title: "Sitemap and canonical review",
    action: "Confirm /sitemap.xml includes all public guide slugs and that each guide uses buildPageMetadata canonical tags.",
    rationale: "Existing Next.js sitemap route and seo.js helpers must stay the source of truth.",
    preserveUrl: true,
    requiresHumanReview: true,
  });

  return {
    generatedAt: new Date().toISOString(),
    articlePreservation: {
      expected: 120,
      found: inventory.count,
      ok: inventory.ok,
      note: inventory.ok
        ? "Inventory CSV lists 120 unique guides — preserve URLs, dates and priority order."
        : `Inventory missing or incomplete at ${inventory.source} (found ${inventory.count}).`,
    },
    google: {
      searchConsole: gsc?.status === "connected" ? "connected_pending_sync" : "not_connected",
      analytics4: ga4?.status === "connected" ? "connected_pending_sync" : "not_connected",
      note: "No search volumes are invented. Connect authorised GSC/GA4 APIs on staging to sync real queries.",
    },
    recommendations,
    guards: [
      "Do not mass-publish AI articles.",
      "Do not create artificial backlinks.",
      "Do not promise rankings.",
      "Do not invent search volumes.",
      "Material tax guidance requires human review before publish.",
      "Prioritise improving existing articles over new duplicate pages.",
    ],
  };
}
