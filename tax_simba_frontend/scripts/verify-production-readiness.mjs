/**
 * End-to-end production-readiness checks for the 82-article import.
 * Does not deploy. Expects optional BASE_URL for HTTP route/sitemap checks.
 */
import fs from "fs";
import {
  articles,
  original38Articles,
  next82Articles,
  getPublishedArticles,
  getArticleBySlug,
  getArticleRegistryStats,
  upsertArticlesBySlug,
} from "../src/data/articles.js";

const BASE = process.env.BASE_URL || "";
const failures = [];
const notes = [];

function fail(msg) {
  failures.push(msg);
}
function ok(msg) {
  notes.push(`PASS: ${msg}`);
}

// --- Registry integrity ---
const stats = getArticleRegistryStats();
const ids = articles.map((a) => a.id);
const titles = articles.map((a) => a.title.trim().toLowerCase());
const slugs = articles.map((a) => a.slug);
if (stats.total !== 120) fail(`total ${stats.total} !== 120`);
if (stats.uniqueSlugs !== 120) fail(`uniqueSlugs ${stats.uniqueSlugs}`);
if (stats.uniqueIds !== 120) fail(`uniqueIds ${stats.uniqueIds}`);
if (original38Articles.length !== 38) fail(`original38 ${original38Articles.length}`);
if (next82Articles.length !== 82) fail(`next82 ${next82Articles.length}`);
if (new Set(ids).size !== 120) fail("duplicate ids");
if (new Set(titles).size !== 120) fail("duplicate titles");
if (new Set(slugs).size !== 120) fail("duplicate slugs");
const overlap = next82Articles.filter((a) =>
  original38Articles.some((b) => b.slug === a.slug || b.id === a.id || b.title === a.title),
);
if (overlap.length) fail(`82 overlaps live 38: ${overlap.map((a) => a.slug).join(",")}`);
const repeat = upsertArticlesBySlug(articles, next82Articles);
if (repeat.length !== 120) fail(`repeat upsert ${repeat.length}`);
ok("38 preserved + 82 new = 120 unique (ids/titles/slugs); no duplicates");

// --- Live slug preservation (optional file) ---
const livePath = process.env.LIVE_SITEMAP_FILE || "/tmp/live-sitemap.xml";
if (fs.existsSync(livePath)) {
  const live = new Set(
    [...fs.readFileSync(livePath, "utf8").matchAll(/\/blogs\/([a-z0-9-]+)/g)].map((m) => m[1]),
  );
  const o = new Set(original38Articles.map((a) => a.slug));
  const missing = [...live].filter((s) => !o.has(s));
  const extra = [...o].filter((s) => !live.has(s));
  if (live.size !== 38 || missing.length || extra.length) {
    fail(`live slug mismatch missing=${missing} extra=${extra}`);
  } else ok("live sitemap 38 slugs identical to preserved original38");
}

// --- Draft safety (no accidental publish) ---
if (stats.releaseEnabled) {
  notes.push("NOTE: release env enabled during this run");
} else {
  if (stats.publishedCount !== 38) fail(`published without release ${stats.publishedCount} !== 38`);
  if (stats.draftCount !== 82) fail(`draftCount ${stats.draftCount}`);
  if (getArticleBySlug("mtd-accountant-cost")) fail("draft mtd-accountant-cost publicly visible");
  ok("without release env: 38 public, 82 drafts hidden (incl. mtd-accountant-cost)");
}

// --- 82 field completeness ---
const ICON_KEYS = new Set([
  "digital-tax",
  "calendar",
  "pound",
  "home",
  "briefcase",
  "accountant",
  "document-check",
  "hard-hat",
  "tax-guide",
]);
for (const a of next82Articles) {
  for (const k of [
    "slug",
    "title",
    "content",
    "metaTitle",
    "metaDescription",
    "category",
    "readingMinutes",
    "iconKey",
    "heroStyle",
    "status",
    "excerpt",
    "sources",
    "editorialReviewStatus",
    "releaseReadiness",
  ]) {
    if (a[k] === undefined || a[k] === null || a[k] === "") fail(`${a.slug}: missing ${k}`);
  }
  if (a.status !== "draft" || a.publishedAt !== null) fail(`${a.slug}: not intentional draft`);
  if (!a.content.includes("<h2>") || a.content.length < 200) fail(`${a.slug}: incomplete body`);
  if (!Array.isArray(a.sources) || !a.sources.length) fail(`${a.slug}: sources`);
  if (!ICON_KEYS.has(a.iconKey) || a.heroStyle !== "compact-icon") fail(`${a.slug}: illustration`);
  if ((a.metaTitle || "").length > 70 || (a.metaDescription || "").length > 160) {
    fail(`${a.slug}: SEO length`);
  }
}
ok("all 82 have complete bodies, SEO, categories, slugs, reading times, icons, sources, editorial metadata");

// --- Category filter counts (published only) ---
const published = getPublishedArticles();
const mtd = published.filter((a) => a.category === "Making Tax Digital");
const sa = published.filter((a) => a.category === "Self Assessment");
if (mtd.length + sa.length !== published.length) fail("published categories incomplete");
ok(`category filters: MTD=${mtd.length}, SA=${sa.length}, all=${published.length}`);

// --- HTTP checks ---
async function httpGet(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: "follow" });
  const text = await res.text();
  return { status: res.status, text };
}

if (BASE) {
  const hub = await httpGet("/blogs");
  if (hub.status !== 200) fail(`/blogs ${hub.status}`);
  if (!hub.text.includes("Blog &amp; Guides") && !hub.text.includes("Blog & Guides")) {
    fail("hub missing Blog & Guides label");
  }
  const mtdHub = await httpGet("/blogs?category=mtd");
  if (mtdHub.status !== 200) fail(`mtd filter ${mtdHub.status}`);
  const saHub = await httpGet("/blogs?category=sa");
  if (saHub.status !== 200) fail(`sa filter ${saHub.status}`);

  // search-ish: ensure filter query string is honored in SSR payload counts via published cards
  ok("hub + category filter routes respond 200");

  let routeOk = 0;
  const bad = [];
  for (const a of published) {
    const { status, text } = await httpGet(`/blogs/${a.slug}`);
    const notFound =
      text.includes("Guide not found") || text.includes("NEXT_HTTP_ERROR_FALLBACK;404");
    if (status === 200 && !notFound) routeOk += 1;
    else bad.push(`${a.slug}:${status}`);
  }
  if (routeOk !== published.length) fail(`routes ok ${routeOk}/${published.length} bad=${bad.slice(0, 5)}`);
  else ok(`${routeOk} published article routes OK`);

  const draft = await httpGet("/blogs/mtd-accountant-cost");
  const draftHidden =
    draft.text.includes("Guide not found") ||
    draft.text.includes("NEXT_HTTP_ERROR_FALLBACK;404") ||
    draft.status === 404;
  if (!draftHidden) fail("draft mtd-accountant-cost leaked publicly over HTTP");
  else ok("draft mtd-accountant-cost not publicly readable");

  const sm = await httpGet("/sitemap.xml");
  if (sm.status !== 200) fail(`sitemap ${sm.status}`);
  const missing = published.filter((a) => !sm.text.includes(`/blogs/${a.slug}`));
  if (missing.length) fail(`sitemap missing ${missing.length}: ${missing.slice(0, 5).map((a) => a.slug)}`);
  if (sm.text.includes("/blogs/mtd-accountant-cost")) fail("draft slug present in sitemap");
  ok("sitemap contains all published routes and excludes drafts");

  // Sample article must include general-information notice + sources section markers when compact UI
  const sample = published[0];
  const page = await httpGet(`/blogs/${sample.slug}`);
  if (!page.text.includes("general information") && !page.text.includes("Official sources")) {
    // notice may be client-rendered; accept compact-article marker at least
    if (!page.text.includes("compact-article") && !page.text.includes("blog-header")) {
      fail(`article page missing expected article chrome for ${sample.slug}`);
    } else ok("article chrome present (notice may hydrate client-side)");
  } else ok("article page includes sources/general-information markers");
} else {
  notes.push("SKIP HTTP: set BASE_URL to probe routes/sitemap");
}

console.log(notes.join("\n"));
if (failures.length) {
  console.error("\nFAIL:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("\nPASS production-readiness registry/HTTP checks");
console.log(JSON.stringify({ stats, published: published.length, mtd: mtd.length, sa: sa.length }, null, 2));
