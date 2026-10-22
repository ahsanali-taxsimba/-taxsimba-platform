/**
 * Controlled publisher release for the 82 editorially approved draft articles.
 *
 * Default: drafts stay unpublished (safe for review PRs).
 *
 * At intentional deployment time set BOTH the server and public env vars so
 * server routes/sitemap AND client hub filters/counts stay aligned:
 *
 *   TAXSIMBA_PUBLISH_EDITORIAL_DRAFTS=true
 *   TAXSIMBA_EDITORIAL_PUBLISHED_AT=2026-10-20T03:00:00.000Z
 *   NEXT_PUBLIC_TAXSIMBA_PUBLISH_EDITORIAL_DRAFTS=true
 *   NEXT_PUBLIC_TAXSIMBA_EDITORIAL_PUBLISHED_AT=2026-10-20T03:00:00.000Z
 *   npm run build && npm run start
 *
 * NEXT_PUBLIC_* values are inlined at build time for client components.
 *
 * Or run:
 *   npm run release:publish-editorial -- --at=2026-10-20T03:00:00.000Z --print-env
 *
 * Merge/rebase note: content/taxsimba-82-articles is based on live production tip
 * cursor/taxsimba-seo-cleanup-80a7 @ 0d21a049… (38 live slugs).
 */
function readEnvFlag(...names) {
  for (const name of names) {
    const raw = process.env[name];
    if (raw == null) continue;
    if (["1", "true", "yes", "on"].includes(String(raw).trim().toLowerCase())) {
      return true;
    }
  }
  return false;
}

function readEnvValue(...names) {
  for (const name of names) {
    const raw = process.env[name];
    if (raw != null && String(raw).trim()) return String(raw).trim();
  }
  return null;
}

export const editorialDraftRelease = {
  enabled: readEnvFlag(
    "TAXSIMBA_PUBLISH_EDITORIAL_DRAFTS",
    "NEXT_PUBLIC_TAXSIMBA_PUBLISH_EDITORIAL_DRAFTS",
  ),
  publishedAt: readEnvValue(
    "TAXSIMBA_EDITORIAL_PUBLISHED_AT",
    "NEXT_PUBLIC_TAXSIMBA_EDITORIAL_PUBLISHED_AT",
  ),
};

export function isEditorialDraftReleaseReady() {
  if (!editorialDraftRelease.enabled) return false;
  const at = editorialDraftRelease.publishedAt;
  if (!at) return false;
  const date = new Date(at);
  return !Number.isNaN(date.getTime());
}

/** Records imported as the second/third editorial batches. */
export function isEditoriallyApprovedDraft(article) {
  if (!article) return false;
  return (
    article.status === "draft" &&
    ((article.releaseReadiness === "editorially-approved-publisher-release-required" &&
      article.editorialReviewStatus === "verified-against-official-guidance") ||
     (article.releaseReadiness === "publisher-review-required" &&
      article.editorialReviewStatus === "ai-assisted-editorial-revision"))
  );
}
