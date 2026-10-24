import { loadSourceMap } from "../store";
import { SourceSnapshot } from "../types";

export type MappingResult = {
  action: "update" | "create" | "skip";
  slug?: string;
  reason: string;
  existingTitle?: string;
  firstPublishedAt?: string | null;
};

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const w of a) if (b.has(w)) n += 1;
  return n / Math.max(a.size, b.size);
}

/** Map a source change or topic idea onto an existing guide or a new slug. */
export function mapToArticle(input: {
  source: SourceSnapshot;
  topicTitle?: string;
  forceNew?: boolean;
}): MappingResult {
  const map = loadSourceMap();
  const url = input.source.url;

  const bySource = map.articles.filter((a) =>
    (a.sources || []).some((s) => s.url === url || s.url.replace(/\/$/, "") === url.replace(/\/$/, "")),
  );
  if (bySource.length === 1) {
    return {
      action: "update",
      slug: bySource[0].slug,
      reason: "Exact GOV.UK source already mapped to one TaxSimba guide",
      existingTitle: bySource[0].title,
      firstPublishedAt: bySource[0].publishedAt,
    };
  }
  if (bySource.length > 1) {
    // Prefer highest release rank (lower number).
    const sorted = [...bySource].sort(
      (a, b) => (a.releaseRank || 999) - (b.releaseRank || 999),
    );
    return {
      action: "update",
      slug: sorted[0].slug,
      reason: `Multiple guides cite this source; updating primary ${sorted[0].slug}`,
      existingTitle: sorted[0].title,
      firstPublishedAt: sorted[0].publishedAt,
    };
  }

  const needle = tokenize(`${input.source.title || ""} ${input.topicTitle || ""} ${input.source.excerpt || ""}`);
  let best: { slug: string; score: number; title: string; publishedAt?: string | null } | null =
    null;
  for (const a of map.articles) {
    const score = overlapScore(needle, tokenize(`${a.title} ${a.category}`));
    if (!best || score > best.score) {
      best = { slug: a.slug, score, title: a.title, publishedAt: a.publishedAt };
    }
  }
  if (best && best.score >= 0.28 && !input.forceNew) {
    return {
      action: "update",
      slug: best.slug,
      reason: `Topic overlaps existing guide (${(best.score * 100).toFixed(0)}%)`,
      existingTitle: best.title,
      firstPublishedAt: best.publishedAt,
    };
  }

  if (!input.forceNew && best && best.score >= 0.18) {
    return {
      action: "skip",
      slug: best.slug,
      reason: "Likely duplicate / thin announcement — prefer updating the existing guide",
      existingTitle: best.title,
      firstPublishedAt: best.publishedAt,
    };
  }

  const base = (input.topicTitle || input.source.title || "hmrc-guidance")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
  const slug = base || `hmrc-update-${Date.now()}`;
  const exists = map.articles.some((a) => a.slug === slug);
  return {
    action: exists ? "skip" : "create",
    slug: exists ? undefined : slug,
    reason: exists
      ? "Generated slug collides with an existing article"
      : "No close existing guide — create a distinct practical article",
  };
}
