import fs from "node:fs";
import path from "node:path";
import { articles, getPublishedArticles } from "../src/data/articles.js";
import { PRIORITY_ARTICLE_SLUGS } from "../src/data/articleEditorial.js";

const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const slugs = articles.map((a) => a.slug);
const descriptions = articles.map((a) => a.metaDescription);
if (new Set(descriptions).size !== 120) fail("meta descriptions must be unique");
if (new Set(articles.map((a) => a.title)).size !== 120) fail("titles must be unique");
for (const slug of PRIORITY_ARTICLE_SLUGS) if (!slugs.includes(slug)) fail(`missing priority article: ${slug}`);
const published = getPublishedArticles();
if (published.length === 120 && published.slice(0, 20).map((a) => a.slug).join() !== PRIORITY_ARTICLE_SLUGS.join()) fail("priority 20 order changed");
if (articles.length !== 120) fail(`expected 120 articles, found ${articles.length}`);
if (new Set(slugs).size !== 120) fail("article slugs are not unique");
if (PRIORITY_ARTICLE_SLUGS.length !== 20 || new Set(PRIORITY_ARTICLE_SLUGS).size !== 20) fail("priority list must contain 20 unique articles");
for (const article of articles) {
  if (!article.title || !article.metaDescription || !article.content) fail(`incomplete article: ${article.slug}`);
  if (/…|\.{3}/.test(article.metaDescription)) fail(`truncated description: ${article.slug}`);
  for (const slug of article.relatedSlugs || []) if (!slugs.includes(slug)) fail(`missing related guide ${slug} on ${article.slug}`);
  if (!article.sources?.length) fail(`missing sources: ${article.slug}`);
  for (const source of article.sources || []) if (!/^https:\/\//.test(source.url)) fail(`invalid source: ${article.slug}`);
  for (const width of [480, 960, 1440]) {
    const file = path.resolve(`public/images/articles/${article.slug}-${width}.webp`);
    if (!fs.existsSync(file) || fs.statSync(file).size < 1000) fail(`missing artwork: ${file}`);
  }
}
if (process.env.TAXSIMBA_PUBLISH_EDITORIAL_DRAFTS === "true" && getPublishedArticles().length !== 120) fail(`release should expose 120 articles, found ${getPublishedArticles().length}`);
if (!process.exitCode) console.log("PASS: 120 articles, priority 20, SEO fields and 360 responsive artworks verified");
