import assert from 'node:assert/strict';
import fs from 'node:fs';
import { articles, withResolvedArticleContent } from '../src/data/articles.js';
import { remainingEnhancements, appendRemainingDepth } from '../src/data/articleRemainingBatches.js';
import { RELEASE_ORDER_SLUGS, PRIORITY_ARTICLE_SLUGS } from '../src/data/articleEditorial.js';
assert.equal(RELEASE_ORDER_SLUGS.length,120);
assert.equal(new Set(RELEASE_ORDER_SLUGS).size,120);
const examples=new Set(),downloads=new Set();
for(const [slug,entry] of Object.entries(remainingEnhancements)) {
 const article=articles.find(a=>a.slug===slug),depth=entry.depth;
 assert(article?.premiumReady,slug+' is installed');
 assert.equal(article.content.split('<!-- taxsimba-guide-depth -->').length,2,slug+' one enhancement');
 assert.equal(appendRemainingDepth(article).content,article.content,slug+' idempotent');
 assert(depth.example.join(' ').length>240,slug+' substantive example');
 assert.equal(depth.decisionRows.length,3);assert.equal(depth.questions.length,2);assert.equal(depth.worksheetPrompts.length,5);
 assert(!examples.has(depth.example.join(' ')),slug+' unique scenario');examples.add(depth.example.join(' '));
 assert(!downloads.has(article.preparationDownload),slug+' distinct worksheet');downloads.add(article.preparationDownload);
 const worksheet=fs.readFileSync('public'+article.preparationDownload,'utf8');
 for(const prompt of depth.worksheetPrompts)assert(worksheet.includes(prompt),slug+' worksheet prompt');
 assert(worksheet.includes('https://taxsimba.co.uk/blogs/'+slug),slug+' worksheet returns to correct guide');
 assert.equal(article.featuredImage,`/images/articles/${slug}-1440.webp`,slug+' metadata image is at least 1200px wide');
 for(const source of article.sources)assert(source.label.startsWith('GOV.UK — ')&&source.url.startsWith('https://www.gov.uk/'),slug+' named official source');
 for(const when of ['2026-10-05T11:00:00Z','2026-10-06T11:00:00Z','2026-11-08T11:00:00Z']) {
  const resolved=withResolvedArticleContent(article,new Date(when));
  assert(resolved.metaTitle.length<=70&&resolved.metaDescription.length<=160,slug+' valid deadline-sensitive metadata');
 }
}
assert.equal(articles.filter(a=>a.priorityRank).length,20);
assert.deepEqual([...articles].sort((a,b)=>a.releaseRank-b.releaseRank).slice(0,20).map(a=>a.slug),PRIORITY_ARTICLE_SLUGS);
console.log(`PASS: ${examples.size} distinct remaining-guide examples and worksheets, correct large metadata images, official-source labels, idempotent full-body enhancements, and priority 20 retained`);
