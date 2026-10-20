/**
 * Proves slug-based upsert of the 82-article package is idempotent
 * and yields 120 unique planned records without a second database.
 */
import {
  articles,
  getArticleRegistryStats,
  mergeArticleBatches,
  next82Articles,
  original38Articles,
  upsertArticlesBySlug,
} from "../src/data/articles.js";
import { next82Articles as again } from "../src/data/articles.next82.js";

const stats = getArticleRegistryStats();
const second = upsertArticlesBySlug(articles, again);
const third = mergeArticleBatches(original38Articles, next82Articles, again);

const errors = [];
if (stats.originalBaseline !== 38) errors.push(`original baseline ${stats.originalBaseline} !== 38`);
if (stats.next82Count !== 82) errors.push(`next82 ${stats.next82Count} !== 82`);
if (stats.total !== 120) errors.push(`total ${stats.total} !== 120`);
if (stats.uniqueSlugs !== 120) errors.push(`uniqueSlugs ${stats.uniqueSlugs} !== 120`);
if (stats.uniqueIds !== 120) errors.push(`uniqueIds ${stats.uniqueIds} !== 120`);
if (stats.publishedCount !== 38) {
  errors.push(`published ${stats.publishedCount} !== 38 (drafts must stay private)`);
}
if (stats.draftCount !== 82) errors.push(`drafts ${stats.draftCount} !== 82`);
if (second.length !== 120) errors.push(`repeat upsert length ${second.length} !== 120`);
if (third.length !== 120) errors.push(`triple merge length ${third.length} !== 120`);
if (stats.repeatUpsertTotal !== 120) {
  errors.push(`stats.repeatUpsertTotal ${stats.repeatUpsertTotal} !== 120`);
}

if (errors.length) {
  console.error("FAIL article upsert verification:\n- " + errors.join("\n- "));
  console.error(stats);
  process.exit(1);
}

console.log(
  "PASS: 120 unique articles; original 38 preserved; 82 drafts unpublished; repeat upsert created no duplicates",
);
console.log(JSON.stringify(stats, null, 2));
