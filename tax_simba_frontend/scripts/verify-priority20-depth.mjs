import assert from 'node:assert/strict';
import fs from 'node:fs';
import { articles } from '../src/data/articles.js';
import { enhanceArticle, PRIORITY_ARTICLE_SLUGS } from '../src/data/articleEditorial.js';
import { priority20Upgrades } from '../src/data/articlePriority20Depth.js';
import { articleJsonLd } from '../src/lib/seo.js';

assert.deepEqual(Object.keys(priority20Upgrades).sort(), [...PRIORITY_ARTICLE_SLUGS].sort());
assert.equal(new Set(Object.values(priority20Upgrades).map(u=>u.exampleTitle)).size,20);
assert.equal(new Set(Object.values(priority20Upgrades).flatMap(u=>u.questions.map(q=>q[0]))).size,40);
for (const slug of PRIORITY_ARTICLE_SLUGS) {
  const article = articles.find(a=>a.slug===slug);
  const upgrade = priority20Upgrades[slug];
  assert.equal(article.content.split('<!-- taxsimba-priority20-depth -->').length,2,slug+' one enrichment');
  assert.equal(enhanceArticle(article).content,article.content,slug+' idempotent enhancement');
  assert.equal(upgrade.decisionRows.length,3);
  assert.equal(upgrade.questions.length,2);
  assert.equal(upgrade.worksheetPrompts.length,5);
  assert.ok(article.readingMinutes>=3,slug+' reading estimate includes additions');
  const download = fs.readFileSync('public'+article.preparationDownload,'utf8');
  assert.ok(download.includes(article.title)&&download.includes('/blogs/'+slug),slug+' matching worksheet');
  assert.ok(article.content.includes(article.preparationDownload),slug+' real download link');
  assert.ok(articleJsonLd(article).dateModified,slug+' update date');
}
assert.equal(articles.length,120);
console.log('PASS: all twenty priority guides have distinct scenarios, decisions, forty follow-up answers and matching worksheets; enhancement is idempotent');
