import assert from 'node:assert/strict';
import fs from 'node:fs';
import {articles, withResolvedArticleContent, getPublishedArticles, getCtaForArticle} from '../src/data/articles.js';
import {PRIORITY_ARTICLE_SLUGS,RELEASE_ORDER_SLUGS,enhanceArticle} from '../src/data/articleEditorial.js';
const bySlug=new Map(articles.map(a=>[a.slug,a]));
assert.equal(bySlug.size,120);assert.deepEqual([...articles].sort((a,b)=>a.releaseRank-b.releaseRank).map(a=>a.slug),RELEASE_ORDER_SLUGS);
for(const a of articles){
 assert.equal(a.editorialRevisionVersion,2,a.slug);
 assert.equal(enhanceArticle(a),a,'Repeated registry enhancement must preserve the edited record');
 assert.equal(a.reviewerName,'','A publisher label must not be shown as a named expert review');
 assert.equal(a.independentReviewStatus,'not-performed');
 assert(!/A decision guide for this situation|Two more questions you may have|Use these prompts to prepare/.test(a.content),a.slug);
 for(const href of [...a.content.matchAll(/href="(\/[^"#?]+)(?:[?#][^"]*)?"/g)].map(m=>m[1])){
  if(href.startsWith('/blogs/'))assert(bySlug.has(href.slice(7)),a.slug+' related guide exists');
  if(href.startsWith('/downloads/'))assert(fs.existsSync('public'+href),a.slug+' download exists');
 }
 assert(fs.existsSync('public'+a.preparationDownload));
 assert.equal(a.sources.length,new Set(a.sources.map(s=>s.url)).size,a.slug+' sources unique');
 assert(a.content.includes('<!-- taxsimba-priority20-depth -->')||a.content.includes('<!-- taxsimba-guide-depth -->'));
 assert(a.answer.length>60,a.slug+' direct answer');
}
const cost=bySlug.get('mtd-accountant-cost');assert(cost.content.includes('https://taxfix.com/en-uk/making-tax-digital/'));assert(cost.content.includes('not a survey'));assert(!cost.content.includes('£29.99'));
const sa=bySlug.get('self-assessment-accountant-cost');assert(sa.content.includes('https://rjaccountancy.co.uk/fees/'));assert(sa.answer.includes('plus VAT'));
for(const slug of ['join-mtd-service-mid-year','correct-mtd-quarterly-update'])assert(!/unlock|admin approval/i.test(bySlug.get(slug).content),slug+' no internal workflow jargon');
const upcoming=withResolvedArticleContent(bySlug.get('mtd-quarterly-deadline-7-november-2026'),new Date('2026-11-07T12:00:00Z'));
const overdue=withResolvedArticleContent(bySlug.get('mtd-quarterly-deadline-7-november-2026'),new Date('2026-11-08T12:00:00Z'));
assert(!upcoming.answer.includes('now overdue'));assert(overdue.answer.includes('now overdue'));assert(overdue.title.startsWith('Missed'));
assert(!overdue.content.includes('Deadline in focus:'));assert(!upcoming.content.includes('Update after 7 November 2026:'));
const before=withResolvedArticleContent(bySlug.get('self-assessment-register-by-5-october-2026'),new Date('2026-10-05T10:00:00Z'));
const after=withResolvedArticleContent(bySlug.get('self-assessment-register-by-5-october-2026'),new Date('2026-10-06T10:00:00Z'));
assert(before.answer.startsWith('Tell HMRC by'));assert(after.answer.includes('If you missed'));assert(after.title.startsWith('Missed'));
assert.equal(getCtaForArticle(bySlug.get('mtd-cumulative-quarterly-updates')).href,'/register?role=MTD');
assert.equal(getCtaForArticle(bySlug.get('self-assessment-accountant-cost')).href,'/register');
if(process.env.TAXSIMBA_PUBLISH_EDITORIAL_DRAFTS==='true')assert.equal(getPublishedArticles().length,120,'Explicit release flags expose all guides');
console.log('PASS: 120 editorial revisions; preserved order/links/assets; truthful reviewer labels; sourced cost examples; date-correct quick answers; SA/MTD destinations');
