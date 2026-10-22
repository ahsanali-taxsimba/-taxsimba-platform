import assert from 'node:assert/strict';
import fs from 'node:fs';
import {articles} from '../src/data/articles.js';
import {quoteTotal,cumulativeTotals,propertyDeadline} from '../src/data/articleToolMath.js';
assert.equal(quoteTotal({recurring:20,payments:12,setup:120,extras:180,vatPercent:0}),540);
assert.equal(quoteTotal({recurring:42,payments:12,setup:0,extras:0,vatPercent:20}),604.8);
assert.equal(quoteTotal({recurring:'',payments:12,setup:0,extras:0,vatPercent:0}),null);
assert.equal(quoteTotal({recurring:1,payments:1.5,setup:0,extras:0,vatPercent:0}),null);
assert.equal(quoteTotal({recurring:-1,payments:12,setup:0,extras:0,vatPercent:0}),null);
assert.equal(quoteTotal({recurring:'Infinity',payments:12,setup:0,extras:0,vatPercent:0}),null);
assert.deepEqual(cumulativeTotals(12000,3000,15000,4000,0,-240),{income:27000,expenses:6760});
assert.equal(cumulativeTotals(0,0,0,0,0,-1),null);
assert.equal(cumulativeTotals('',0,0,0,0,0),null);
assert.equal(cumulativeTotals(0,0,0,0,'',0),null);
assert.equal(propertyDeadline('2026-10-20'),'2026-12-19');
assert.equal(propertyDeadline('2028-01-01'),'2028-03-01');
assert.equal(propertyDeadline('2026-02-30'),null);
assert.equal(propertyDeadline('2021-10-26'),null);
assert.equal(propertyDeadline(''),null);
const b=new Map(articles.map(a=>[a.slug,a]));
assert.equal(articles.length,120);
for(const a of articles){
 assert.equal(a.competitiveRevisionVersion,3,a.slug);
 assert.equal(a.independentReviewStatus,'not-performed');
 assert.equal(a.reviewerName,'');
 const download=fs.readFileSync('public'+a.preparationDownload,'utf8');
 assert(download.includes(a.releaseRank<=20?'PRACTICAL TASK':'DECISION TO RESOLVE'),a.slug+' upgraded download');
 assert(download.includes('Person responsible')||download.includes('who will obtain'),a.slug+' named follow-up prompt');
 if(a.releaseRank>20){assert.equal((a.content.match(/Illustrative preparation example\./g)||[]).length,1,a.slug+' replacement rather than duplicate example');assert(a.content.includes('<strong>Check:</strong>'));}
}
assert(b.get('correct-mtd-quarterly-update').content.includes('resending')||b.get('correct-mtd-quarterly-update').content.includes('resend the fourth'));
assert(b.get('company-director-personal-tax-return').content.includes('highest percentage shareholding'));
assert(b.get('cis-payment-deduction-statements').content.includes('BX9 1BX'));
assert(b.get('mtd-new-business-new-rental-income').answer.includes('not necessarily start immediately'));
assert(b.get('basis-period-transition-profit-2025-26').content.includes('£25,000'));
console.log('PASS: all 120 targeted revisions and worksheets; calculator normal/invalid/leap-year cases; five specialist corrections; truthful review labels.');
