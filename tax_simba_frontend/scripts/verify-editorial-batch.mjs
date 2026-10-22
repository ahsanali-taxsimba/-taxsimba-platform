import assert from 'node:assert/strict';
import fs from 'node:fs';
import {articles,getCtaForArticle,getContextualServiceCta} from '../src/data/articles.js';
import {PRIORITY_ARTICLE_SLUGS,RELEASE_ORDER_SLUGS} from '../src/data/articleEditorial.js';
import {remainingEnhancements} from '../src/data/articleRemainingBatches.js';
const batchNumber=Number(process.argv.find(a=>a.startsWith('--batch='))?.split('=')[1]||1);
const complete=process.argv.includes('--complete-release');
assert(complete||(Number.isInteger(batchNumber)&&batchNumber>=1&&batchNumber<=12),'batch must be 1–12');
const selectedSlugs=complete?RELEASE_ORDER_SLUGS:RELEASE_ORDER_SLUGS.slice((batchNumber-1)*10,batchNumber*10);
const batch=articles.filter(a=>selectedSlugs.includes(a.slug));
assert.ok(batch.every(a=>a.premiumReady));
assert.equal(batch.length,selectedSlugs.length);
assert.deepEqual(batch.map(a=>a.slug).sort(),[...selectedSlugs].sort());
assert.equal(new Set(batch.map(a=>a.metaDescription)).size,batch.length);
for(const a of batch){
assert.ok(a.metaTitle.length<=70&&a.metaDescription.length<=160,a.slug+' metadata length');
assert.ok(a.answer&&a.dek&&a.featuredImageAlt.length>35&&a.details.length===3,a.slug+' editorial fields');
assert.ok(a.content.length>1500&&a.sources.length>0,a.slug+' full article');
assert.ok(getCtaForArticle(a).href.startsWith('/')&&getContextualServiceCta(a).href.startsWith('/'));
for(const width of [480,960,1440])assert.ok(fs.statSync(`public/images/articles/${a.slug}-${width}.webp`).size>1000);
for(const related of a.relatedSlugs)assert.ok(articles.some(x=>x.slug===related));
}
if(process.argv.includes('--complete-release'))assert.equal(articles.filter(a=>a.premiumReady).length,120,'Full 120-article visual release is not yet complete');
assert.equal(articles.filter(a=>a.premiumReady).length,20+Object.keys(remainingEnhancements).length,'Ready count matches installed editorial entries');
console.log(`PASS: ${complete?'complete release':'batch '+batchNumber}: ${batch.length} guides have complete bodies, SEO metadata, quick answers, steps, sources, CTAs and responsive illustrations; ${20+Object.keys(remainingEnhancements).length} ready in total`);
