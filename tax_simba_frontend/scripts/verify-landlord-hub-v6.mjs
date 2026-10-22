import fs from 'node:fs';
import assert from 'node:assert/strict';
import { LANDLORD_GUIDES, LANDLORD_PATHS, getLandlordJourney } from '../src/data/landlordJourney.js';
const articles=JSON.parse(fs.readFileSync('../release/review-v5/ALL_ARTICLES.json','utf8'));
assert.equal(new Set(LANDLORD_GUIDES.map(g=>g[0])).size,17);
for(const [slug,,kind] of LANDLORD_GUIDES){
 assert(articles.some(a=>a.slug===slug),`Missing guide ${slug}`);
 assert.equal(getLandlordJourney(slug).href,kind==='MTD'?LANDLORD_PATHS.mtd:kind==='SA'?LANDLORD_PATHS.sa:'/contact-us');
}
assert.equal(getLandlordJourney('mtd-accountant-cost'),null);
for(const route of Object.values(LANDLORD_PATHS)){
 const source=fs.readFileSync(`src/app${route}/page.js`,'utf8');
 assert(source.includes(`path:'${route}'`));
 for(const image of source.matchAll(/ogImage:'([^']+)'/g))assert(fs.existsSync('public'+image[1]),image[1]);
}
const body=fs.readFileSync('src/components/landlords/LandlordPages.jsx','utf8');
for(const match of body.matchAll(/href="\/blogs\/([^"#?]+)"/g))assert(articles.some(a=>a.slug===match[1]),match[1]);
assert(body.includes("signup:'/register'"));assert(body.includes("signup:'/register?role=MTD'"));
console.log('PASS: 17 unique existing guides mapped to appropriate service/free/specialist routes; service canonicals, artwork, inline guide links and separate signup paths verified.');
