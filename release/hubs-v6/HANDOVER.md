# TaxSimba landlord hub and service journey — V6

Continues Reviewed V5. All 120 article records and their agreed first-20 order are preserved. This is source for Cursor/Toxel integration, not a deployed website.

## What changed

- New `/landlords` hub: three clear routes for annual filing, ongoing MTD and checking eligibility; a gross-rent example; 17 existing landlord/property guides grouped by customer task; separate specialist-case route.
- Existing `/rental-income-service` becomes the focused landlord Self Assessment service page. Existing `/rental-income-tax` becomes the focused landlord MTD service page. Both explain responsibilities, preparation, scope checks, current-package links, questions and appropriate onboarding.
- The old annual-service alias `/services/rental-income-tax-returns` permanently redirects to `/rental-income-service`; excluded from the sitemap. Other service URLs are untouched.
- Desktop/mobile resource navigation, footer and blog hub link to the landlord hub. The 17 mapped guides get a hub/service return link alongside their original task-specific action. Sale/disclosure guides lead to a specialist enquiry, rather than promising inclusion in a routine package.
- Shared scoped responsive styling, canonical metadata, breadcrumb and Service/CollectionPage structured data. No invented offer, price, review, rating, qualification, ranking or scarcity claim.
- A small development-script adapter accepts the preview host's flags and translates them to Next.js CLI arguments. Production start/build behavior remains the existing release workflow.

## Why this approach

The saved inventory already covers 17 directly relevant landlord/property topics. Better discovery and service clarity were a more useful first step than more article volume. Guides remain specific answers; commercial pages explain the service and buying decision.

A selected competitor check of Taxfix's landlord page showed clear audience positioning and a direct service route. This update aims to make our own responsibilities, preparation and annual-versus-MTD choice explicit. It does not establish competitive superiority, keyword volume or conversion uplift.

TaxSimba's public pricing content did not expose reliable package amounts in the retrieved page. The new pages link to the existing current-price destinations rather than inventing a landlord price or replicating a stale figure. Specialist acceptance, bookkeeping/software scope and annual/catch-up inclusions still depend on the actual chosen package. No backend package or checkout logic is changed.

## Validation and limits

A clean dependency installation and the production release build were run. The included landlord regression check verifies 17 unique existing guide slugs, destination mapping, metadata images, canonicals, inline links and distinct SA/MTD signup paths. Existing 120-article release checks remain in the build pipeline.

STATIC_HTML_RESULTS.json records inspection of the three production-rendered pages: one main H1, matching canonical, valid structured data and published guide links. This is not browser or accessibility certification.

The preview initially rejected generic host flags; a Next.js-compatible adapter was added. The browser entry call then stalled and was aborted, so new-page visual/browser QA is not marked passed. V5 browser/accessibility evidence remains historical and must not be presented as a fresh V6 run. Toxel must check the three pages on mobile/desktop, keyboard/FAQ/jump-link behavior, the 17 guide return paths, the permanent redirect and sitemap in its candidate environment.

Actual package contents, availability, signup, verification, payment, email and accountant assignment also need the configured deployment environment. An article or service-page build is not evidence of those flows. No professional certification or Google-ranking guarantee is supplied.

## Cursor and Toxel integration

1. Compare this source with the newest repository; merge only intended files using INTEGRATION_FILES.json and DELETED_FILES.json. Preserve newer unrelated code, environment values and first-publication timestamp. Remove the superseded `src/app/rental-income-tax/page.client.js` only after confirming no newer references.
2. In `tax_simba_frontend`, run `npm ci`, `npm run verify:landlord-hub-v6` and `npm run build`. Production uses the existing `npm run release:start` flow. No database migration is requested.
3. Confirm actual SA/MTD package scope and prices shown on the linked existing package pages. The new pages deliberately do not invent or override those values.
4. Test the candidate journeys and browser checks listed above. Verify staging noindex settings before launch and production indexability after the intended release.
5. Provide one integration branch, exact committed SHA, deployment result and rollback target. No branch push or production deployment is claimed by this ZIP.

## Sources checked for this change

- https://taxsimba.co.uk/pricing
- https://taxsimba.co.uk/mtd-information
- https://taxfix.com/en-uk/landlords-2/
- https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
- https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-working-out-your-rental-income
