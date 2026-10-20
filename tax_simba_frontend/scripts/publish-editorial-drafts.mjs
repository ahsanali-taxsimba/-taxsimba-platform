#!/usr/bin/env node
/**
 * Controlled release helper for the 82 editorially approved draft articles.
 *
 * Does NOT merge or deploy. It only validates / simulates / documents the
 * env-based publisher switch used at deployment time.
 *
 * Usage:
 *   npm run release:publish-editorial -- --help
 *   npm run release:publish-editorial -- --dry-run
 *   TAXSIMBA_PUBLISH_EDITORIAL_DRAFTS=true \
 *     TAXSIMBA_EDITORIAL_PUBLISHED_AT=2026-10-20T12:00:00.000Z \
 *     npm run release:publish-editorial -- --verify
 *   npm run release:publish-editorial -- --at=2026-10-20T12:00:00.000Z --print-env
 */
import {
  articles,
  getPublishedArticles,
  getArticleRegistryStats,
  isPubliclyVisibleArticle,
  withReleaseResolution,
} from "../src/data/articles.js";
import {
  editorialDraftRelease,
  isEditorialDraftReleaseReady,
  isEditoriallyApprovedDraft,
} from "../src/data/articleReleaseConfig.js";

function parseArgs(argv) {
  const out = { at: null, verify: false, dryRun: false, printEnv: false, help: false };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--verify") out.verify = true;
    else if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--print-env") out.printEnv = true;
    else if (arg.startsWith("--at=")) out.at = arg.slice("--at=".length);
  }
  return out;
}

function help() {
  console.log(`Controlled editorial draft release

Default state: 82 articles remain status=draft / publishedAt=null.

Deploy-time publish (recommended):
  TAXSIMBA_PUBLISH_EDITORIAL_DRAFTS=true \\
  TAXSIMBA_EDITORIAL_PUBLISHED_AT=<ISO-8601> \\
  npm run build && npm run start

Helpers:
  --dry-run     Show how many drafts would become public if release were enabled
  --verify      Assert release env is set and exactly 120 articles are public
  --at=ISO      Timestamp used with --print-env
  --print-env   Print the exact env export lines for deployment
`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  help();
  process.exit(0);
}

const drafts = articles.filter(isEditoriallyApprovedDraft);
const stats = getArticleRegistryStats();

if (args.printEnv) {
  const at = args.at || editorialDraftRelease.publishedAt || new Date().toISOString();
  console.log(`export TAXSIMBA_PUBLISH_EDITORIAL_DRAFTS=true`);
  console.log(`export TAXSIMBA_EDITORIAL_PUBLISHED_AT=${at}`);
  console.log(`export NEXT_PUBLIC_TAXSIMBA_PUBLISH_EDITORIAL_DRAFTS=true`);
  console.log(`export NEXT_PUBLIC_TAXSIMBA_EDITORIAL_PUBLISHED_AT=${at}`);
  console.log(`# then: npm run build && npm run start`);
  console.log(`# verify: npm run release:publish-editorial -- --verify`);
  process.exit(0);
}

if (args.dryRun) {
  const pretendAt = args.at || new Date().toISOString();
  // Simulate without mutating process env permanently for module cache: resolve manually
  const simulated = articles.map((a) => {
    if (!isEditoriallyApprovedDraft(a)) return a;
    return {
      ...a,
      status: "published",
      publishedAt: pretendAt,
      reviewedAt: a.reviewedAt || pretendAt,
    };
  });
  const publicCount = simulated.filter((a) => {
    if (a.status === "draft" || a.status === "unpublished") return false;
    if (!a.publishedAt) return false;
    const d = new Date(a.publishedAt);
    return !Number.isNaN(d.getTime()) && d.getTime() <= Date.now() + 1000;
  }).length;
  console.log(
    JSON.stringify(
      {
        mode: "dry-run",
        editorialDrafts: drafts.length,
        wouldBePublic: publicCount,
        currentPublicWithoutRelease: getPublishedArticles().length,
        registryTotal: stats.total,
        pretendPublishedAt: pretendAt,
      },
      null,
      2,
    ),
  );
  if (drafts.length !== 82 || publicCount !== 120) {
    console.error("FAIL dry-run expectations");
    process.exit(1);
  }
  console.log("PASS dry-run: enabling release would publish 82 drafts → 120 public");
  process.exit(0);
}

if (args.verify) {
  if (!isEditorialDraftReleaseReady()) {
    console.error(
      "FAIL: release not enabled. Set TAXSIMBA_PUBLISH_EDITORIAL_DRAFTS=true and TAXSIMBA_EDITORIAL_PUBLISHED_AT=<ISO>",
    );
    console.error({ editorialDraftRelease });
    process.exit(1);
  }
  const published = getPublishedArticles();
  const publicSlugs = new Set(published.map((a) => a.slug));
  const mtdCost = published.find((a) => a.slug === "mtd-accountant-cost");
  const errors = [];
  if (published.length !== 120) errors.push(`published=${published.length} !== 120`);
  if (publicSlugs.size !== 120) errors.push(`unique published slugs=${publicSlugs.size} !== 120`);
  if (!mtdCost) errors.push("mtd-accountant-cost not public after release");
  if (!mtdCost?.content || mtdCost.content.length < 200) {
    errors.push("mtd-accountant-cost missing body after release");
  }
  const hiddenEditorial = articles
    .filter((a) => a.releaseReadiness === "editorially-approved-publisher-release-required")
    .map(withReleaseResolution)
    .filter((a) => !isPubliclyVisibleArticle(a));
  if (hiddenEditorial.length) {
    errors.push(`${hiddenEditorial.length} editorial records still hidden`);
  }
  if (errors.length) {
    console.error("FAIL release verify:\n- " + errors.join("\n- "));
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      {
        mode: "verify",
        publishedCount: published.length,
        uniqueSlugs: publicSlugs.size,
        publishedAt: editorialDraftRelease.publishedAt,
        mtdAccountantCost: true,
      },
      null,
      2,
    ),
  );
  console.log("PASS: release enabled; exactly 120 public articles including mtd-accountant-cost");
  process.exit(0);
}

help();
console.log("\nCurrent state:");
console.log(
  JSON.stringify(
    {
      releaseReady: isEditorialDraftReleaseReady(),
      editorialDraftRelease,
      editorialDrafts: drafts.length,
      publicNow: getPublishedArticles().length,
      registryTotal: stats.total,
    },
    null,
    2,
  ),
);
