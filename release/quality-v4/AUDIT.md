# TaxSimba 120-article quality, UK coverage and conversion audit

Assessed 21 October 2026, continuing Competitive V3. Scope: the 120 saved articles, article template, three tools and release evidence. This is an editorial/engineering audit with selected current official-source checks, not an independent tax sign-off or a complete test of every tax assertion.

## Finding

The package has a useful technical and editorial foundation, but “most useful in the UK” and paid-conversion superiority remain unmeasured. Its clearest advantage should be helping readers understand the next task and move into appropriate accountant-led support. Real deadlines can create a reason to act; an article should not imply that purchasing is compulsory, that every visitor needs a return, or that buying stops a tax penalty.

## What was measured and changed

| Angle | Evidence | Result and practical limit |
| --- | --- | --- |
| Immediate answer and practical help | All 120 registry records, examples, decisions and free worksheets | Structure checks pass. Reader understanding and satisfaction have not been tested. |
| Plain language | V3 body word range 522–1,107; median 589.5; article-level average sentence lengths 10.8–18.8 words | Useful writing diagnostics, not a comprehension score or evidence of human authorship. No repeated topic paragraphs of 20+ words across guides, excluding standard regional notices introduced in V4. Semantic repetition still needs human reading. |
| Tax accuracy | 140 pre-V4 source URLs checked; all responded successfully. Selected current HMRC rules checked for deadlines, penalties and nation differences | Link availability does not validate the assertions. No qualified named tax review is recorded for any of the 120. |
| Coverage across the UK | V3 bodies had no explicit home-nation mentions | Added home-nation context on 34 relevant guides, plus savings/dividend distinctions on two more. England, Scotland, Wales and Northern Ireland are recorded in the scope register. This is not a detailed review of all devolved rules or proof of national search reach. |
| Search presentation | Unique stable URLs, existing canonical/sitemap/schema checks, title and description lengths | Shortened six metadata titles that exceeded the editorial 65-character target; all 120 descriptions remain at most 160 characters. These are editing targets, not Google display guarantees. Rankings, indexing, search demand and backlinks are not measured. |
| Search intent overlap | Existing topic set includes closely related eligibility, service-choice, correction and payment guides | Keep distinct customer questions and cross-link them. A one-to-one query/result reassessment and Search Console query ownership remain needed; do not mark overlapping pages as winners from a title scan. |
| Conversion relevance | Existing common mid-article message appeared on every guide | Added 120 mapped service-fit actions across 14 intent groups. Eligibility guides point to the checker; payment difficulty points first to HMRC support. Case acceptance and specialist scope remain explicit. Paid-signup uplift is not measured. |
| Urgency and accuracy over time | Topic-matched deadlines and filing stages | Added source-linked, London-date-aware timing messages for appropriate guides. Quarterly, annual and PAYE-coding messages switch or expire; property and appeal prompts ask for the actual case date. No fake availability, discount expiry, automatic penalty or guaranteed turnaround. |
| Trust and attribution | Publisher bylines and source references; reviewer fields blank | Keep honest AI-assisted editing records. Real reviewer name, credentials, review date and scope are open work. Do not invent a biography or award. |
| Tools, accessibility and layout | Existing arithmetic tests; labels, semantic headings, focus styling and responsive CSS; V4 boundary tests | Code and server checks support the implementation. No fresh browser/mobile/screen-reader test or Core Web Vitals measurement has been completed. |
| Live customer journey and privacy | Routes are checked by HTTP; tools use local component state | A 200 response does not test registration, payment, authentication, accountant assignment or email. No live purchase was made. Analytics implementation must follow the existing consent system and exclude tax values and personal identifiers. |
| Maintenance | 120-item register with risk, review interval, due date, required owner role and missing review evidence | 80 time-sensitive items: weekly change monitoring; 10 specialist items: monthly; 30 others: quarterly. Required owners are not yet assigned. The register and command are delivered; monitoring is not running automatically. |

## What should make a reader act

1. Explain the applicable obligation and date: “If you need a 2025/26 return, the usual online deadline is 31 January 2027; check the HMRC notice that applies to you.”
2. Explain preparation: missing evidence and queries take time, so agree the work before the filing deadline.
3. State the service benefit: the accountant handles agreed preparation, the client supplies complete information and reviews before filing.
4. Give the appropriate next action: check eligibility, compare the package, confirm specialist acceptance, or use HMRC’s free route where that is the immediate need.
5. Keep fees and tax separate. Buying support does not itself file anything, pay HMRC, extend a deadline or guarantee an appeal result.

Do not threaten a quarterly MTD penalty in 2026/27 to sell a package: HMRC states no penalties for missing those quarterly-update deadlines in that year. Annual returns and tax payments need their own accurate treatment. Paper, online and PAYE-coding dates must not be presented as interchangeable.

## National maintenance rules

- Check taxpayer status and moves, rather than assuming a UK office location determines personal tax rates. Scottish non-savings income differs; savings and dividend rules remain UK rules. Welsh rates are set separately.
- Keep the applicable tax year on rates, allowances, worked examples and loan calculations. A future-year change should not silently rewrite the earlier return’s guidance.
- UK-wide availability of TaxSimba is a product/operational claim to confirm separately. The article audit does not prove service capacity in every nation, language support or local professional coverage.
- Do not mass-produce near-identical city pages. Monitor the real UK query and customer data before deciding whether a genuinely different regional guide is needed.

## Maintenance workflow delivered

Use release/quality-v4/MAINTENANCE_REGISTER.json and npm run audit:maintenance in tax_simba_frontend. Optional --as-of=YYYY-MM-DD can be supplied to the underlying script. It lists reviews due and missing owners/reviewer evidence; it does not perform or mark a tax review complete.

The first scheduled change-monitoring due date is 28 October 2026 for time-sensitive records. This is a proposed review queue, not a claim those records received a full tax review today. Deduplicate shared HMRC sources: one changed page can trigger review of several affected guides. Assign a real content owner and tax reviewer before relying on the process.

Check immediately after an HMRC update, Budget or fiscal statement, tax-year change, relevant devolved announcement, TaxSimba package/scope change, broken source, substantive reader complaint or observed reporting error. Check dated deadline pages in advance and on rollover. Recheck competitor prices weekly while they are quoted, and remove or update unsupported offers. Never alter reviewedAt simply because a script ran; record the reviewer and the exact checks completed.

## Live measurement still required

No connected Search Console, analytics, payment attribution or customer feedback dataset was available. The following measurements are specified, not claimed as implemented or already collected.

| Measure | Definition | Evidence needed |
| --- | --- | --- |
| Search click-through | Organic clicks / impressions for each page and query | Search Console; UK country filter, device and branded/non-branded split. |
| Qualified next-step rate | Relevant CTA clicks / eligible article sessions | Consented analytics event with article slug, placement and destination. |
| Signup completion | Completed registrations attributed to article sessions / relevant article sessions | Registration confirmation event, deduplication and declared attribution window. |
| Paid customer rate | Completed payments attributed to article sessions / relevant article sessions | Server-confirmed payment, deduplicated transaction and chosen attribution model. Exclude test and refunded orders from final net reporting. |
| Assisted conversion | Article viewed earlier in the declared journey before purchase | Consented attribution; report separately from direct credit and do not double-count revenue. |
| Usefulness | Readers can correctly identify next action and required evidence | Moderated reader tasks and optional helpful/unhelpful feedback, with sample sizes. |
| Quality of acquisition | Accepted scope, successful onboarding, cancellations/refunds and avoidable support questions | Product/customer-service records with privacy controls. Cheap clicks or pressured purchases are not enough. |
| Geographic coverage | Relevant search and accepted-customer distribution across UK nations | Appropriate aggregate reporting. Do not infer tax residence from approximate analytics location. |

Track article view, tool engagement, download, service CTA click, signup start/completion and server-confirmed payment. Do not send amounts entered in tools, UTRs, email addresses, bank information, tax documents or full query strings into analytics. Connect to the existing consent mechanism; do not add an unconditional tracker.

Start with a baseline after verified publication and instrumentation. Compare the first 20 separately from the remaining 100, then by intent, device and relevant national context. Test clearer explanations or CTA wording against qualified completed purchases and user outcomes. Use sample sizes and uncertainty; do not invent an uplift from two clicks. There is no responsible numerical conversion target until a baseline and traffic quality are known.

## Intent boundaries to preserve

| Cluster | Primary question | Keep supporting guides distinct |
| --- | --- | --- |
| MTD eligibility | Qualifying income and phased start | Salary, CIS gross income, joint ownership, exemptions and wrong signup answer their own cases. |
| MTD service choice | Software versus managed work | Agent capability, authorisation and main/supporting roles explain different responsibilities. |
| Reporting | What is sent | Cumulative arithmetic, corrections, quiet periods and proof of filing each resolve a separate task. |
| Annual deadlines | Dates for the return | Registration, coding and quarterly deadlines must retain their own applicability. |
| Payment | Understanding the amount due | Payments on account, reduction claims, inability to pay and coding are different questions. |
| Property | Rental records and costs | Disposal urgency, mortgage relief, repairs, joint ownership and non-residence need their specific facts. |
| CIS | Income and credit on the return | Refunds, deduction rate, missing statements, expenses and gross-payment status must not become copies. |

## Release decision

Engineering checks support further staging review. The strongest unresolved gates are recorded qualified tax review, verified product-scope evidence, actual browser/mobile/accessibility and live customer-flow checks. Market leadership, nationwide search reach and conversion performance remain unproven. Keep the 20 priority guides first; review them first before approving the remaining 100.

## Source references for this audit

- HMRC Scottish Income Tax: https://www.gov.uk/scottish-income-tax
- HMRC Welsh Income Tax: https://www.gov.uk/welsh-income-tax
- HMRC filing deadlines: https://www.gov.uk/self-assessment-tax-returns/deadlines
- HMRC MTD penalties: https://www.gov.uk/guidance/penalties-for-making-tax-digital-for-income-tax
- HMRC PAYE collection: https://www.gov.uk/pay-self-assessment-tax-bill/through-your-tax-code
- HMRC payment difficulty: https://www.gov.uk/difficulties-paying-hmrc
- Google people-first content: https://developers.google.com/search/docs/fundamentals/creating-helpful-content

## Per-article audit register

The metrics below are diagnostics, not quality scores or proof of ranking. All 120 have unmeasured paid conversion and no qualified tax review recorded. UK note means an explicit home-nation/rate distinction was added; other guides primarily cover common UK processes and still require their relevant scope check.

| Order | Guide | V3 words / average sentence | UK note | Service-fit group | Change-monitoring interval / first due |
| --- | --- | --- | --- | --- | --- |
| 1 | How Much Does an MTD Accountant Cost? What to Compare Before You Buy | 737 / 12.7 | Common process; confirm scope | cost | 7 days / 2026-10-28 |
| 2 | How Much Does a Self Assessment Accountant Cost? Compare the Full Service | 712 / 13.7 | Common process; confirm scope | cost | 7 days / 2026-10-28 |
| 3 | Joining an MTD Service Mid-Year: What Happens to Earlier Quarters? | 627 / 14.6 | Common process; confirm scope | handover | 7 days / 2026-10-28 |
| 4 | Can I Switch MTD Accountants Halfway Through the Tax Year? | 571 / 13.6 | Common process; confirm scope | handover | 7 days / 2026-10-28 |
| 5 | Does MTD Mean Paying Income Tax Every Quarter? | 559 / 14.0 | Common process; confirm scope | mtd | 90 days / 2027-01-19 |
| 6 | Self Assessment for 2025/26 and MTD for 2026/27: Why Both May Be Due | 583 / 15.3 | Common process; confirm scope | mtd | 90 days / 2027-01-19 |
| 7 | Are MTD Quarterly Updates Cumulative? A Simple Worked Example | 577 / 14.4 | Common process; confirm scope | mtd | 7 days / 2026-10-28 |
| 8 | Found a Mistake After an MTD Update? How to Prepare for a Correction | 557 / 13.9 | Common process; confirm scope | mtd | 7 days / 2026-10-28 |
| 9 | Waiting for a UTR Before January? Steps to Take While You Wait | 576 / 13.4 | Common process; confirm scope | return | 7 days / 2026-10-28 |
| 10 | Employed and Self-Employed: What Your Accountant Needs for One Tax Return | 561 / 14.8 | Yes | return | 7 days / 2026-10-28 |
| 11 | Uber and Private-Hire Driver Tax Returns: A Record-Keeping Checklist | 617 / 12.6 | Common process; confirm scope | cis | 7 days / 2026-10-28 |
| 12 | Deliveroo, Uber Eats and Courier Tax Returns: Getting Your Records Ready | 558 / 13.9 | Common process; confirm scope | cis | 7 days / 2026-10-28 |
| 13 | MTD Software or an Accountant-Managed Service: Which Do You Need? | 581 / 15.7 | Common process; confirm scope | mtd | 90 days / 2027-01-19 |
| 14 | Authorising Your MTD Accountant Without Sharing Your Password | 566 / 13.8 | Common process; confirm scope | mtd | 90 days / 2027-01-19 |
| 15 | Several Years of Unfiled Tax Returns: How to Put Them in Order | 585 / 14.3 | Common process; confirm scope | backlog | 30 days / 2026-11-20 |
| 16 | Appealing a Self Assessment Penalty: Evidence, Deadlines and Next Steps | 564 / 13.4 | Common process; confirm scope | appeal | 7 days / 2026-10-28 |
| 17 | Sold a Rental Property? Check the 60-Day Capital Gains Tax Deadline | 569 / 13.5 | Common process; confirm scope | property-sale | 7 days / 2026-10-28 |
| 18 | Pay Self Assessment Through Your Tax Code: The 30 December Deadline | 603 / 16.8 | Common process; confirm scope | payment | 7 days / 2026-10-28 |
| 19 | Has My MTD Update Been Submitted? How to Check the Evidence | 534 / 13.0 | Common process; confirm scope | mtd | 90 days / 2027-01-19 |
| 20 | HMRC Signed Me Up for Making Tax Digital — What Do I Do Next? | 635 / 14.1 | Common process; confirm scope | mtd | 7 days / 2026-10-28 |
| 21 | MTD Qualifying Income Explained — Does the £50,000 Rule Apply to Me? | 581 / 18.2 | Common process; confirm scope | eligibility | 90 days / 2027-01-19 |
| 22 | MTD Quarterly Updates — What Do I Actually Need to Send? | 595 / 15.7 | Common process; confirm scope | mtd | 7 days / 2026-10-28 |
| 23 | Self Assessment Deadline 2027 — Dates You Need to Know | 599 / 15.0 | Common process; confirm scope | return | 7 days / 2026-10-28 |
| 24 | What Documents Do I Need for My Self Assessment Tax Return? | 544 / 17.5 | Common process; confirm scope | return | 7 days / 2026-10-28 |
| 25 | A Simple Guide to UK Self Assessment | 522 / 14.1 | Yes | return | 7 days / 2026-10-28 |
| 26 | Six Tax-Saving Checks for UK Sole Traders | 580 / 11.8 | Yes | return | 7 days / 2026-10-28 |
| 27 | Making Tax Digital (MTD): What You Need to Know | 534 / 12.7 | Common process; confirm scope | mtd | 7 days / 2026-10-28 |
| 28 | Can an Accountant Handle Making Tax Digital for Me? | 654 / 15.6 | Common process; confirm scope | mtd | 7 days / 2026-10-28 |
| 29 | MTD Digital Records — What You Actually Need to Keep | 791 / 18.8 | Common process; confirm scope | mtd | 7 days / 2026-10-28 |
| 30 | I Missed an MTD Quarterly Update — What Should I Do Now? | 635 / 15.9 | Common process; confirm scope | mtd | 7 days / 2026-10-28 |
| 31 | Payments on Account Explained — Why Is HMRC Asking for More? | 744 / 15.8 | Yes | payment | 90 days / 2027-01-19 |
| 32 | Late Self Assessment Filing — Penalties and What To Do Now | 966 / 15.1 | Common process; confirm scope | backlog | 7 days / 2026-10-28 |
| 33 | MTD Quarterly Deadline: What You Need to Do Before 7 November 2026 | 727 / 14.0 | Common process; confirm scope | mtd | 7 days / 2026-10-28 |
| 34 | MTD for Landlords: What Landlords Need to Do in 2026/27 | 741 / 14.0 | Common process; confirm scope | mtd | 7 days / 2026-10-28 |
| 35 | MTD for Sole Traders: What You Need to Do in 2026/27 | 662 / 13.2 | Common process; confirm scope | mtd | 7 days / 2026-10-28 |
| 36 | HMRC Says I Need Making Tax Digital, But I Think They’re Wrong — What Should I Do? | 742 / 12.4 | Common process; confirm scope | eligibility | 90 days / 2027-01-19 |
| 37 | Making Tax Digital £30,000 Rule: Who Needs to Prepare for April 2027? | 646 / 14.0 | Common process; confirm scope | eligibility | 7 days / 2026-10-28 |
| 38 | Does Making Tax Digital Replace Self Assessment? | 693 / 16.1 | Common process; confirm scope | mtd | 90 days / 2027-01-19 |
| 39 | Making Tax Digital Exemptions: Who Does Not Have to Use MTD? | 854 / 17.4 | Common process; confirm scope | eligibility | 7 days / 2026-10-28 |
| 40 | Self Assessment for Landlords: What You Need for Your 2025/26 Tax Return | 677 / 15.4 | Yes | return | 7 days / 2026-10-28 |
| 41 | Self Assessment for Sole Traders: What You Need for Your 2025/26 Tax Return | 598 / 13.9 | Yes | return | 7 days / 2026-10-28 |
| 42 | Do I Need to Register for Self Assessment by 5 October 2026? | 782 / 16.0 | Common process; confirm scope | return | 7 days / 2026-10-28 |
| 43 | I Cannot Pay My Self Assessment Tax Bill — What Should I Do? | 895 / 15.2 | Common process; confirm scope | payment | 90 days / 2027-01-19 |
| 44 | How to Reduce Self Assessment Payments on Account | 801 / 16.0 | Common process; confirm scope | payment | 90 days / 2027-01-19 |
| 45 | Landlord Mortgage Interest Tax Relief: How Finance Costs Work Now | 740 / 16.8 | Yes | return | 7 days / 2026-10-28 |
| 46 | CIS Deductions on Your Self Assessment Return: How Subcontractors Reclaim Tax | 763 / 15.0 | Common process; confirm scope | cis | 7 days / 2026-10-28 |
| 47 | I Haven’t Declared Rental Income to HMRC — What Should I Do? | 1107 / 16.3 | Common process; confirm scope | backlog | 30 days / 2026-11-20 |
| 48 | Do I Need Self Assessment for a Side Hustle? | 712 / 14.2 | Common process; confirm scope | return | 7 days / 2026-10-28 |
| 49 | Trading Allowance £1,000: Do I Still Need to Tell HMRC? | 683 / 13.9 | Common process; confirm scope | return | 90 days / 2027-01-19 |
| 50 | How to Amend a Self Assessment Tax Return | 677 / 15.0 | Common process; confirm scope | amendment | 90 days / 2027-01-19 |
| 51 | MTD for Income Tax vs MTD for VAT: What’s the Difference? | 652 / 13.6 | Common process; confirm scope | mtd | 90 days / 2027-01-19 |
| 52 | Can I Use Spreadsheets for Making Tax Digital? | 612 / 14.6 | Common process; confirm scope | mtd | 7 days / 2026-10-28 |
| 53 | CIS Tax Refunds: How Subcontractors Claim Back CIS Deductions | 774 / 13.1 | Common process; confirm scope | cis | 7 days / 2026-10-28 |
| 54 | 20% vs 30% CIS Deductions: Why Am I Paying More? | 708 / 15.1 | Common process; confirm scope | cis | 7 days / 2026-10-28 |
| 55 | CIS Payment and Deduction Statements: What Subcontractors Need to Keep | 765 / 15 | Common process; confirm scope | cis | 7 days / 2026-10-28 |
| 56 | CIS Allowable Expenses for Subcontractors: What Can You Claim? | 725 / 13.7 | Common process; confirm scope | cis | 7 days / 2026-10-28 |
| 57 | CIS Gross Payment Status: What It Means and Who Can Apply | 700 / 15.2 | Common process; confirm scope | cis | 7 days / 2026-10-28 |
| 58 | No Income This Quarter: Do I Still Need an MTD Update? | 571 / 10.8 | Common process; confirm scope | mtd | 7 days / 2026-10-28 |
| 59 | Two Self-Employed Businesses: How Does MTD Reporting Work? | 652 / 11.6 | Common process; confirm scope | mtd | 7 days / 2026-10-28 |
| 60 | Employed and a Landlord: Does Your Salary Count Towards MTD? | 636 / 11.6 | Yes | mtd | 7 days / 2026-10-28 |
| 61 | MTD for Jointly Owned Rental Property: What Each Owner Should Check | 586 / 11.3 | Common process; confirm scope | mtd | 7 days / 2026-10-28 |
| 62 | CIS Subcontractors and MTD: Gross Income Is Not Your Bank Receipt | 637 / 12.0 | Common process; confirm scope | mtd | 7 days / 2026-10-28 |
| 63 | Bank Feeds and MTD: Why Connected Does Not Mean Complete | 567 / 10.9 | Common process; confirm scope | mtd | 7 days / 2026-10-28 |
| 64 | My Income Has Fallen: Can I Stop Using MTD? | 570 / 11.4 | Common process; confirm scope | eligibility | 7 days / 2026-10-28 |
| 65 | Self-Employed Hairdressers and Beauty Professionals: Tax Return Preparation | 580 / 10.9 | Yes | return | 7 days / 2026-10-28 |
| 66 | Company Directors: Your Personal Tax Return Is Different from Company Filing | 665 / 12.3 | Yes | director | 7 days / 2026-10-28 |
| 67 | Vinted and eBay: Does Selling Your Own Clothes Mean You Owe Tax? | 597 / 11.7 | Common process; confirm scope | check-sa | 90 days / 2027-01-19 |
| 68 | Etsy Seller Tax Returns: Why Your Bank Payout Is Not the Whole Record | 637 / 12.2 | Common process; confirm scope | return | 7 days / 2026-10-28 |
| 69 | Airbnb and Holiday-Let Tax Returns After the Furnished Holiday Lettings Changes | 561 / 11.2 | Yes | return | 7 days / 2026-10-28 |
| 70 | Joint Rental Property on a Tax Return: Do Both Owners Report the Same Amount? | 572 / 11.9 | Yes | return | 7 days / 2026-10-28 |
| 71 | Landlord Repairs or Improvements: What to Send Your Accountant | 628 / 11.6 | Yes | return | 7 days / 2026-10-28 |
| 72 | Savings Interest: When Do You Need to Tell HMRC or File a Return? | 671 / 12.2 | Yes | check-sa | 90 days / 2027-01-19 |
| 73 | Working from Home When Self-Employed: Preparing an Expense Claim | 658 / 12.0 | Yes | return | 7 days / 2026-10-28 |
| 74 | Mileage or Actual Vehicle Costs: Which Records Does Your Accountant Need? | 661 / 11.8 | Yes | return | 7 days / 2026-10-28 |
| 75 | SA302 and Tax-Year Overview: Evidence for a Mortgage Application | 650 / 12.0 | Common process; confirm scope | check-sa | 90 days / 2027-01-19 |
| 76 | High Salary Alone: Do You Actually Need Self Assessment? | 684 / 13.2 | Yes | return | 90 days / 2027-01-19 |
| 77 | Lost Receipts Before Your Tax Return? What to Do Next | 592 / 11.6 | Common process; confirm scope | return | 7 days / 2026-10-28 |
| 78 | Child Benefit and Self Assessment: Check Whether PAYE Is an Option | 588 / 12.2 | Common process; confirm scope | check-sa | 7 days / 2026-10-28 |
| 79 | Pension Contributions and Adjusted Net Income: What to Tell Your Accountant | 633 / 11.7 | Yes | complex | 30 days / 2026-11-20 |
| 80 | Crypto Swaps and Tax: Why Not Cashing Out Does Not Settle the Question | 654 / 12.1 | Common process; confirm scope | complex | 30 days / 2026-11-20 |
| 81 | MTD Standard or Calendar Update Periods: Which Should You Use? | 563 / 12.0 | Common process; confirm scope | mtd | 7 days / 2026-10-28 |
| 82 | MTD Records Below £90,000: When Simpler Categorisation Applies | 561 / 12.2 | Common process; confirm scope | mtd | 7 days / 2026-10-28 |
| 83 | Self-Employed and a Landlord: How Your MTD Updates Fit Together | 550 / 12.2 | Common process; confirm scope | mtd | 7 days / 2026-10-28 |
| 84 | Main or Supporting MTD Accountant: Who Files Your Annual Return? | 554 / 12.6 | Common process; confirm scope | mtd | 90 days / 2027-01-19 |
| 85 | Why Your MTD Tax Estimate May Differ From Your Final Bill | 548 / 12.2 | Common process; confirm scope | mtd | 90 days / 2027-01-19 |
| 86 | Does Partnership Income Put You Into MTD for Income Tax? | 554 / 13.2 | Common process; confirm scope | mtd | 90 days / 2027-01-19 |
| 87 | MTD and Limited Company Directors: Which Income Counts? | 570 / 12.1 | Common process; confirm scope | mtd | 90 days / 2027-01-19 |
| 88 | Starting a New Business or Rental Income While Already in MTD | 591 / 13.1 | Common process; confirm scope | mtd | 90 days / 2027-01-19 |
| 89 | Letting Agent Statements and MTD: Record Gross Rent, Not Just the Payout | 607 / 12.9 | Common process; confirm scope | mtd | 7 days / 2026-10-28 |
| 90 | Should You Join MTD Voluntarily Before Your Compulsory Start Date? | 545 / 13.0 | Common process; confirm scope | mtd | 90 days / 2027-01-19 |
| 91 | MTD From April 2028: What the £20,000 Threshold Means | 555 / 12.9 | Common process; confirm scope | eligibility | 7 days / 2026-10-28 |
| 92 | Is a Receipt Photo Enough for MTD? What Your Records Need | 555 / 12.3 | Common process; confirm scope | mtd | 7 days / 2026-10-28 |
| 93 | MTD Software or HMRC Unavailable Near a Deadline: What to Do | 560 / 12.2 | Common process; confirm scope | mtd | 7 days / 2026-10-28 |
| 94 | Dividend Tax: Keep Your 2025/26 Return Separate From 2026/27 Rates | 552 / 12 | Yes | complex | 7 days / 2026-10-28 |
| 95 | Student and Postgraduate Loans on Self Assessment: Avoid Double Counting | 586 / 13.0 | Common process; confirm scope | complex | 30 days / 2026-11-20 |
| 96 | Self-Employed National Insurance for Your 2025/26 Tax Return | 582 / 13.2 | Common process; confirm scope | complex | 7 days / 2026-10-28 |
| 97 | Cash Basis or Traditional Accounting: Which Figures Go on Your Return? | 568 / 12.3 | Yes | return | 7 days / 2026-10-28 |
| 98 | Made a Self-Employed Loss? What to Check Before Claiming Relief | 676 / 12.3 | Yes | complex | 30 days / 2026-11-20 |
| 99 | Stopped Being Self-Employed? Your Final Return Still Matters | 536 / 12.2 | Common process; confirm scope | return | 90 days / 2027-01-19 |
| 100 | Content Creator Tax: Sponsorships, Platform Income and Gifted Products | 534 / 11.9 | Yes | return | 7 days / 2026-10-28 |
| 101 | Private Tutor Tax Returns: Fees, Platforms and Term-Time Records | 525 / 12.2 | Yes | return | 7 days / 2026-10-28 |
| 102 | Personal Trainer Tax: Gym Fees, Client Packages and Online Coaching | 536 / 11.7 | Yes | return | 7 days / 2026-10-28 |
| 103 | Self-Employed Cleaner Tax Returns: Cash Payments and Business Records | 533 / 11.8 | Yes | return | 7 days / 2026-10-28 |
| 104 | Rent a Room Relief: When Lodger Income Needs a Tax Return | 543 / 12.1 | Yes | return | 7 days / 2026-10-28 |
| 105 | Landlord Furniture and Appliances: Replacement of Domestic Items Relief | 609 / 13.5 | Yes | return | 7 days / 2026-10-28 |
| 106 | Can Landlords Claim Expenses While a Rental Property Is Empty? | 562 / 12.8 | Yes | return | 7 days / 2026-10-28 |
| 107 | Living Abroad With UK Rental Income: Withholding and Your Tax Return | 544 / 12.4 | Yes | complex | 30 days / 2026-11-20 |
| 108 | Foreign Income on a 2025/26 Tax Return: What Changed From April 2025? | 556 / 12.4 | Yes | complex | 7 days / 2026-10-28 |
| 109 | Sold Shares Outside an ISA? The Records Needed for Capital Gains Tax | 551 / 12.5 | Common process; confirm scope | complex | 30 days / 2026-11-20 |
| 110 | Crypto Reporting From 2026: What Providers Tell HMRC and What You Still Do | 567 / 12.3 | Common process; confirm scope | complex | 7 days / 2026-10-28 |
| 111 | Winter Fuel Payment and Your 2025/26 Self Assessment Return | 573 / 13.0 | Common process; confirm scope | complex | 7 days / 2026-10-28 |
| 112 | Self Assessment Refund Pending: What to Check Before Chasing HMRC | 567 / 12.3 | Common process; confirm scope | check-sa | 90 days / 2027-01-19 |
| 113 | Gift Aid on Self Assessment: Claim the Right Relief Without Double Counting | 631 / 12.9 | Yes | complex | 30 days / 2026-11-20 |
| 114 | State Pension on Self Assessment: Why Bank Payments May Not Be the Right Figure | 547 / 11.9 | Yes | check-sa | 90 days / 2027-01-19 |
| 115 | No Longer Need Self Assessment? Ask HMRC Before You Stop Filing | 560 / 12.7 | Common process; confirm scope | check-sa | 90 days / 2027-01-19 |
| 116 | P800 or Simple Assessment PA302: Do You Also Need a Tax Return? | 559 / 13.3 | Common process; confirm scope | check-sa | 90 days / 2027-01-19 |
| 117 | Business Loans on Self Assessment: Interest, Borrowing and Repayments | 613 / 12.8 | Yes | complex | 30 days / 2026-11-20 |
| 118 | Basis Period Transition Profits: What Still Goes on a 2025/26 Return? | 620 / 12.2 | Yes | complex | 7 days / 2026-10-28 |
| 119 | Can You Claim Business Costs Paid Before You Started Trading? | 558 / 12.7 | Yes | return | 90 days / 2027-01-19 |
| 120 | Tools, Laptops and Equipment: Expenses or Capital Allowances? | 561 / 12.5 | Yes | return | 7 days / 2026-10-28 |
