/**
 * Controlled publisher release for the 82 editorially approved draft articles.
 *
 * Default: drafts stay unpublished (safe for review PRs).
 *
 * At intentional deployment time, enable BOTH env vars (or set the values below
 * in the release commit) so public consumers expose all approved drafts with a
 * real publication timestamp — never a fabricated backdate.
 *
 *   TAXSIMBA_PUBLISH_EDITORIAL_DRAFTS=true \
 *   TAXSIMBA_EDITORIAL_PUBLISHED_AT=2026-10-20T12:00:00.000Z \
 *   npm run build && npm run start
 *
 * Or run the documented helper (does not merge/deploy by itself):
 *
 *   npm run release:publish-editorial -- --at=2026-10-20T12:00:00.000Z --verify
 *
 * Merge order (blocker until done):
 * 1) Merge the existing 38-article SEO branch (cursor/taxsimba-seo-cleanup-80a7 / PR #4)
 *    into the production base / main first.
 * 2) Rebase content/taxsimba-82-articles onto that updated main before final approval.
 */
function readEnvFlag(name) {
  const raw = process.env[name];
  if (raw == null) return false;
  return ["1", "true", "yes", "on"].includes(String(raw).trim().toLowerCase());
}

export const editorialDraftRelease = {
  /**
   * When true, editorially approved draft records become publicly visible using
   * `publishedAt` below. Keep false until the release owner intentionally publishes.
   */
  enabled: readEnvFlag("TAXSIMBA_PUBLISH_EDITORIAL_DRAFTS"),
  /**
   * Real publication timestamp (ISO-8601). Required when enabled.
   * Example: "2026-10-20T12:00:00.000Z"
   */
  publishedAt: process.env.TAXSIMBA_EDITORIAL_PUBLISHED_AT || null,
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
    article.releaseReadiness === "editorially-approved-publisher-release-required" &&
    article.editorialReviewStatus === "verified-against-official-guidance"
  );
}
