import {articles} from '../src/data/articles.js';
import {articleQualityActions} from '../src/data/articleQualityActions.js';
const asOf=process.argv.find(v=>/^--as-of=/.test(v))?.slice(8)||new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf))throw new Error('Use --as-of=YYYY-MM-DD');
const rows=articles.map(a=>({rank:a.releaseRank,slug:a.slug,risk:articleQualityActions[a.slug].risk,due:articleQualityActions[a.slug].nextSourceReviewDue,ownerAssigned:articleQualityActions[a.slug].ownerAssigned,qualifiedTaxReviewRecorded:Boolean(a.reviewedAt&&a.reviewerName)}));
const due=rows.filter(x=>x.due<=asOf).sort((a,b)=>a.rank-b.rank);
console.log(JSON.stringify({asOf,sourceReviewDue:due,unassignedOwners:rows.filter(x=>!x.ownerAssigned).length,missingQualifiedReview:rows.filter(x=>!x.qualifiedTaxReviewRecorded).length,scope:'Review queue only. Running this script neither checks source content nor completes a professional review.'},null,2));
