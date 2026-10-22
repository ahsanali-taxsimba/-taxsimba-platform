# TaxSimba review handover — Version 5

21 October 2026. Continues Quality V4; all 120 URLs and the agreed first-20 card order are preserved.

## Decision and review scope

The article layer is a tested deployment candidate after the changes listed below. My review is an AI editorial/source review, not an independent accountant’s certification. I reviewed the core answer and preparation logic for each of the 120 guides against the retrieved official source set, and examined selected specialist qualifications and the first-20 customer journey more closely. This is not an exhaustive legal opinion on every sentence or every personal circumstance.

No fabricated professional approval is recorded: reviewerName remains blank and independentReviewStatus remains not-performed. The earlier proposal to obtain a separate human review is not presented as a completed check or as an automatic technical prerequisite that the user has satisfied. This handover supports an informed publisher decision using the AI review and its explicit limits.

Toxel still needs to validate the actual deployment environment, real package availability and the live customer journey. A local release with external requests blocked cannot certify live authentication, payment, email, permissions or accountant assignment. These checks need the real configured service; do not mark them passed because /register returned 200.

## Concrete changes from V4

- Qualified the first-20 HMRC-signup guide: HMRC may check an already-filed 2025/26 return as well as earlier information.
- Added the temporary 2026/27 SA109 MTD-exemption distinction to the exemption guide and linked it from non-resident/FIG guides. Whether automatic or application-based depends on return history and expected information. It does not remove annual reporting duties.
- Added Scotland’s Pension Age Winter Heating Payment to the winter-payment charge explanation.
- Rechecked Taxfix, RJ Accountancy and Sleek’s actual advertised examples; added provider references to the cost guides’ source lists. These remain examples, not a representative market average or a TaxSimba quote.
- Removed a redundant second fee-comparison scenario in the first cost guide while retaining one worked comparison and the interactive tool.
- Corrected the linked local MTD service page: suitable spreadsheets plus bridging software can be used; quarterly-update penalty points are not applied for 2026/27; late-payment penalties are separate and are not points based. Removed the unsupported generalisation that most competing systems are unready.
- Added a date-sensitive seasonal guide section on the hub, preserving the agreed 20-first card order. It surfaces current signup, November deadline and cumulative-record tasks, switches after the November deadline and expires after January.
- Corrected the repayment-help action to the canonical HMRC refund page.
- Stabilised the shared font wrapper so SSR and client renders keep the same DOM structure, following intermittent recoverable hydration warnings in repeat browser runs.
- Fixed shared article link/button contrast and underlined text links after an automated accessibility scan identified colour contrast and link-distinction failures. Kept the initial calculator prompt neutral until amounts are entered.

## Are the first 20 still the hottest?

They remain a defensible conversion-led mix: two cost comparisons, service choice and handover, immediate reporting problems, target customer groups, deadline cases and proof of service. I cannot establish that these are the twenty highest-demand UK searches: no verified keyword-volume, Search Console or paid-signup dataset was supplied.

The strongest immediate seasonal emphasis is HMRC signup, cumulative updates, correction/catch-up, the earlier return and eligible December coding. The official second-update date provides a concrete reason to prepare, without inventing a penalty for the first-year quarterly update.

The November deadline guide (33), qualifying-income guide (21), annual-deadline guide (23) and missed-update guide (30) are useful challengers for promotion. The seasonal section promotes the deadline task without silently replacing the agreed first twenty. Driver/delivery and authorisation/proof guides still serve valuable audiences and trust tasks, but are not proven to be the hottest acquisition searches today.

## Selected competitor reassessment

The earlier 120-topic comparison remains a research map, not a final independent superiority test. This pass rechecked selected current alternatives and the claims relevant to our priority content.

| Alternative | Observed strength | TaxSimba approach and remaining limit |
| --- | --- | --- |
| Taxfix MTD plans | Clear division of work and real advertised tiers; product demo and offer detail | Our quote tool separates scope, recurring and one-off charges, while the articles explain accountant-led preparation. Do not claim to beat its price or scope without equivalent actual package evidence. |
| FreeAgent HMRC signup guide | Concrete product setup and next steps for readers signed up by HMRC | Our narrow guide adds a client-ready preparation route and directs the right question to support. Do not invent TaxSimba screenshots or buttons to simulate an equally documented product journey. |
| Sage second-update guide | Broad current workflow, cumulative dates and correction context | Our shorter task-specific guides and arithmetic aid can be easier for a narrow task. Shorter copy is not by itself proof of greater usefulness. |
| RJ Accountancy fee schedule | Actual base charges, scope and additional accounting/quarterly work explained | Our comparison asks about the complete job and displays provider examples with VAT/scope caveats. No cherry-picked universal “cheapest” claim. |
| Sleek SA fee guide | Named tax professional and clear advertised starting offer | Our honest publisher attribution and source references cannot be dressed up as equivalent human credentials. Actual reviewer attribution remains absent. |

The credible route to leadership is reliable task completion: answer clearly, show an example, let the reader check the arithmetic, explain the next action, and connect it to the service actually provided. Market-best, ranking and conversion claims remain unproven until measured.

## Toxel release steps

1. Compare this source with the newest repository work and merge the intended changes only; preserve newer unrelated application code and real environment values. The recovered complete120 commit was d55d79c33646f59a416505a5140c993f09c6fc30; this package is subsequent local source, not a pushed SHA.
2. Run npm ci, npm run verify:review-v5, npm run verify:quality-v4, npm run verify:competitive-v3, npm run verify:articles, npm run verify:article-fields and npm run build inside tax_simba_frontend. Start with npm run release:start using the actual environment.
3. Confirm the real package prices/scope, SA and MTD signup destinations, verification, post-purchase dashboard and accountant assignment on the deployed candidate. Confirm email and payment behavior in the project’s test flow. No migration or unrelated backend change is requested.
4. Keep the first-publication timestamp stable. Check seasonal/deadline state for the London date and verify sitemap/indexing settings for the intended environment.
5. Provide one integration branch, exact committed SHA, deployment result and rollback target. This package does not claim that a branch was pushed or production was deployed.

## Evidence boundaries

CORE_ANSWER_REVIEW.json records 120 bounded AI reviews. SOURCE_RETRIEVAL_INDEX.json records 142 retrieved official pages; retrieving text is not proof that every source assertion is correct. BROWSER_RESULTS.json and ACCESSIBILITY_RESULTS.json record the actual automated browser scope and any remaining findings. BUILD_LOG.txt and HTTP_RESULTS.json record engineering checks. Inspect their outcomes, not just their existence.

Screen-reader user testing, full WCAG conformance, real Core Web Vitals, independent professional tax approval, actual reader success, national search reach and paid-signup uplift are not certified. Existing global/header/footer claims outside the article work are not endorsed by this audit. In particular, a public page’s rating or security badge is not evidence of certification by itself.

## Priority twenty, individually

| Order | Guide | Why keep it | Timeliness limit |
| --- | --- | --- | --- |
| 1 | How Much Does an MTD Accountant Cost? What to Compare Before You Buy | Keep leading: the reader is comparing service scope and total cost, not just learning a tax definition. | Evergreen; refresh quoted offers weekly. |
| 2 | How Much Does a Self Assessment Accountant Cost? Compare the Full Service | Keep leading: clear route to the appropriate SA package and an honest full-service comparison. | Strong ahead of the annual filing season. |
| 3 | Joining an MTD Service Mid-Year: What Happens to Earlier Quarters? | Keep: year-to-date catch-up and responsibility are practical reasons to seek managed help. | Strong near quarterly deadlines; confirm acceptance and cut-offs. |
| 4 | Can I Switch MTD Accountants Halfway Through the Tax Year? | Keep distinct from joining: focus on export, access, permissions and the next filer. | Year-round buying intent; less broad seasonal reach than deadline content. |
| 5 | Does MTD Mean Paying Income Tax Every Quarter? | Keep as reassurance: explains that service invoices and tax payments are different. | Not established as a high-volume acquisition query. |
| 6 | Self Assessment for 2025/26 and MTD for 2026/27: Why Both May Be Due | Keep prominent: two active years can cause a customer to buy the wrong scope or miss work. | Timely during autumn 2026 and January 2027. |
| 7 | Are MTD Quarterly Updates Cumulative? A Simple Worked Example | Keep prominent: a worked correction and interactive totals solve an immediate task. | Direct fit with the second cumulative update. |
| 8 | Found a Mistake After an MTD Update? How to Prepare for a Correction | Keep: distinguishes in-year corrections, fourth-update changes and annual amendments. | Stage-specific urgency, not a guaranteed fine. |
| 9 | Waiting for a UTR Before January? Steps to Take While You Wait | Keep: gives a retrieval/escalation route while records are prepared. | Relevant ahead of January; a missing UTR does not make a purchase the only solution. |
| 10 | Employed and Self-Employed: What Your Accountant Needs for One Tax Return | Keep: brings PAYE and trade records into one personal-return pack. | Broad annual relevance; no proof it is a top-20 searched query. |
| 11 | Uber and Private-Hire Driver Tax Returns: A Record-Keeping Checklist | Keep as an audience guide: gross platform earnings and vehicle history are useful. | Evergreen niche; not one of the strongest immediate MTD news topics. |
| 12 | Deliveroo, Uber Eats and Courier Tax Returns: Getting Your Records Ready | Keep as an audience guide; distinguish multi-app and vehicle records from private hire. | Evergreen niche; watch overlap with the driver guide. |
| 13 | MTD Software or an Accountant-Managed Service: Which Do You Need? | Keep: compare division of work before selling software or managed support. | A strong competitive decision page; actual package evidence remains important. |
| 14 | Authorising Your MTD Accountant Without Sharing Your Password | Keep for authorisation safety and confidence in the process. | Supports onboarding; not proven to bring the most new traffic. |
| 15 | Several Years of Unfiled Tax Returns: How to Put Them in Order | Keep: triage by year and agree case acceptance and scope. | Strong need, but specialist work must not be sold as a routine return. |
| 16 | Appealing a Self Assessment Penalty: Evidence, Deadlines and Next Steps | Keep: factual appeal route and evidence plan; no cancellation promise. | Urgent when a notice exists, not a universal seasonal deadline. |
| 17 | Sold a Rental Property? Check the 60-Day Capital Gains Tax Deadline | Keep: the 60-day check and date tool address a distinct property problem. | High consequence for affected sellers; not a universal deadline. |
| 18 | Pay Self Assessment Through Your Tax Code: The 30 December Deadline | Keep prominent: the 30 December route is relevant for eligible PAYE collection. | Specific to the bill and conditions; expires after the applicable date. |
| 19 | Has My MTD Update Been Submitted? How to Check the Evidence | Keep: evidence of delivery is an accountant-led trust point. | Especially useful for existing or switching clients; acquisition demand unmeasured. |
| 20 | HMRC Signed Me Up for Making Tax Digital — What Do I Do Next? | Keep prominent: HMRC signup creates a clear next-step problem now. | Supported by current HMRC guidance; recheck how latest return data are used. |

## Sources for the current priority/competitor check

- HMRC signup: https://www.gov.uk/guidance/sign-up-for-making-tax-digital-for-income-tax
- HMRC automatic signup: https://www.gov.uk/guidance/check-what-to-do-if-hmrc-has-signed-you-up-for-making-tax-digital-for-income-tax
- HMRC quarterly dates: https://makingtaxdigital.campaign.gov.uk/quarterly-updates/
- HMRC exemption conditions: https://www.gov.uk/guidance/find-out-if-you-can-get-an-exemption-from-making-tax-digital-for-income-tax
- Taxfix plans: https://taxfix.com/en-uk/making-tax-digital/
- FreeAgent: https://www.freeagent.com/blog/hmrc-mtd-signed-up-what-now/
- Sage: https://www.sage.com/en-gb/blog/mtd-quarterly-update/
- RJ Accountancy: https://rjaccountancy.co.uk/fees/
- Sleek: https://sleek.com/uk/resources/how-much-do-accountants-charge-for-self-assessment/

## Final completed verification

- Normal production build and all included article/order/date/tool regression checks passed.
- All 120 article pages passed browser checks at 320px, 390px and 1440px; no horizontal overflow, missing tested hero, empty article link, unlabelled article input or uncaught JavaScript error was recorded in the final run.
- Quote fill/compare/blank state, signed cumulative correction, property-date input and hub search/filter interactions passed.
- After shared contrast/link-style fixes, axe-core 4.10.3 recorded zero violations in the selected A/AA article-region checks across all 120 pages at 390px. Incomplete/manual checks remain listed; this is not full WCAG or screen-reader certification.
- HTTP checks passed 120 articles, 120 downloads, 360 image responses and 120 sitemap entries.
- No live signup, payment, email or accountant assignment was submitted or certified.
