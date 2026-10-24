import { loadSourceMap } from "../store";
import { ArticleDraft, EvidenceConflict, ValidationIssue } from "../types";

const BANNED =
  /\bguarantee(?:d|s)? you\b|\blast chance\b|\bonly \d+ left\b|\bbuy now\b|\bact now\b|\bsave £\d+\b|\bfrom just £\d+\b|\bcheapest\b|\b100% accurate\b|\bguaranteed (?:refund|saving|result|acceptance)\b/i;

export function validateDraft(
  draft: ArticleDraft,
  opts: { conflictingEvidence?: EvidenceConflict[] } = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const map = loadSourceMap();

  if (!draft.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug)) {
    issues.push({ severity: "error", code: "slug", message: "Slug missing or invalid" });
  }
  if (!draft.title || draft.title.length < 12) {
    issues.push({ severity: "error", code: "title", message: "Title too short" });
  }
  if (!draft.content || draft.content.replace(/<[^>]+>/g, "").trim().length < 400) {
    issues.push({
      severity: "error",
      code: "thin_content",
      message: "Draft is too thin to replace or publish useful guidance",
    });
  }
  if (!draft.metaTitle || draft.metaTitle.length > 65) {
    issues.push({
      severity: "error",
      code: "meta_title",
      message: "metaTitle required and must be ≤ 65 characters",
    });
  }
  if (!draft.metaDescription || draft.metaDescription.length > 160) {
    issues.push({
      severity: "error",
      code: "meta_description",
      message: "metaDescription required and must be ≤ 160 characters",
    });
  }
  if (!draft.sources?.length || !draft.sources.every((s) => /^https:\/\/www\.gov\.uk\//.test(s.url))) {
    issues.push({
      severity: "error",
      code: "sources",
      message: "At least one verified GOV.UK https source URL is required",
    });
  }
  if (!draft.featuredImage || !draft.featuredImageAlt) {
    issues.push({
      severity: "error",
      code: "image",
      message: "featuredImage and descriptive featuredImageAlt are required",
    });
  }
  if (BANNED.test(`${draft.title} ${draft.excerpt} ${draft.content} ${draft.metaDescription}`)) {
    issues.push({
      severity: "error",
      code: "honesty",
      message: "Draft contains invented urgency, guarantees or price claims",
    });
  }
  if (!/Immediate answer|immediate answer/.test(draft.content)) {
    issues.push({
      severity: "warn",
      code: "immediate_answer",
      message: "Draft should open with a clear immediate answer",
    });
  }
  if (draft.isUpdate) {
    const existing = map.articles.find((a) => a.slug === draft.slug);
    if (!existing) {
      issues.push({
        severity: "error",
        code: "update_missing_base",
        message: "Update targets a slug that is not in the 120-article registry",
      });
    } else if (
      existing.publishedAt &&
      draft.publishedAt &&
      new Date(draft.publishedAt).getTime() !== new Date(existing.publishedAt).getTime() &&
      // Allow ISO string normalisation differences of < 1s
      Math.abs(new Date(draft.publishedAt).getTime() - new Date(existing.publishedAt).getTime()) > 1000
    ) {
      // For drafts that were never published (null), skip.
      if (existing.status === "published") {
        issues.push({
          severity: "error",
          code: "preserve_published_at",
          message: "Updates must preserve the existing first-publication date",
        });
      }
    }
    // Do not allow a short draft to wipe a substantial guide.
    const newWords = estimateWords(draft.content);
    if (existing && newWords < 350) {
      issues.push({
        severity: "error",
        code: "preserve_detail",
        message: "Refusing to replace a substantial guide with a short generic update",
      });
    }
  } else {
    if (map.articles.some((a) => a.slug === draft.slug)) {
      issues.push({
        severity: "error",
        code: "duplicate_slug",
        message: "New article slug collides with the existing 120-article registry",
      });
    }
  }

  for (const slug of draft.relatedSlugs || []) {
    if (!map.articles.some((a) => a.slug === slug) && slug !== draft.slug) {
      issues.push({
        severity: "warn",
        code: "related_slug",
        message: `Related slug not in registry: ${slug}`,
      });
    }
  }

  for (const conflict of opts.conflictingEvidence || []) {
    issues.push({
      severity: "error",
      code: `evidence_${conflict.code}`,
      message: conflict.message,
    });
  }

  return issues;
}

function estimateWords(text: string): number {
  return text.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
}

export function hasBlockingIssues(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
