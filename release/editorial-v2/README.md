# TaxSimba editorial revision 2 — 21 October 2026

This is the newest editorial source, continuing the recovered complete-120 project. Keep the selected 20 first, followed by the remaining 100. All 120 URLs, images and worksheets are retained. Do not replace newer application code wholesale.

## What changed

- Rewrote the quick answer for all 120 guides to answer the particular question directly.
- Replaced the main bodies of all 20 priority guides, plus the three broad guides flagged as thin in the audit.
- Added 16 further topic-specific explanations: separate-business reporting, salary versus rent, CIS credits, platform payouts, repairs, savings interest, home-working rates, mileage by tax year, SA302 retrieval, high salary, pension gross-up, token swaps, letting statements, replacement items, Gift Aid and loan repayments.
- Removed repeated section introductions, internal payment-unlock/admin wording from the affected priority guides, the duplicated end checklist and the extra repeated cost-comparison widget. Retained useful topic-specific examples, decision tables, questions and downloads.
- Added dated, linked advertised-price examples to the cost guides. These are provider offers, not market averages or TaxSimba prices. Check their current terms before publication and maintain them when offers change.
- Narrowed the tax-saving title to sole traders, keeping the URL. Added a real scope and six actionable checks.
- Removed generic corporate reviewer labels from the revised records. Explicitly record that independent review has not been performed; do not turn internal edit flags into a human/expert endorsement.
- Added deadline-sensitive quick answers for registration and the 7 November MTD update, plus tests that dates switch correctly.

The new body edits preserve and improve the earlier practical content; this is not a clean-sheet rebuild. Historical evidence in release/complete120 and earlier batch directories describes the previous copy. Use this directory and README_EDITORIAL_V2.md for the current scope. Previous original-body-preservation assertions no longer describe the edited text.

## Validation and limits

The clean dependency install, existing complete-release/priority20/guide-depth/registry/field checks and the new editorial-v2 regression checks passed. The final normal production build passed and prepared the standalone server. HTTP_RESULTS.json records the final page, metadata, asset, download and sitemap checks.

A new Chromium browser could not be downloaded in this environment, so no fresh rendered desktop/mobile or screen-reader pass is claimed for this revision. The newly introduced tables use the existing focusable horizontal-scroll component. Toxel should check final copy at 320px, 390px and desktop on staging.

This is AI-assisted editorial work with selected current official-source checks. It is not an independent professional review, a complete 120-query competitor study, a plagiarism-clearance service or proof of ranking results. Complex tax claims and product promises still need suitable review against the actual service. Do not label the set human-authored, independently approved, best in the UK or guaranteed to rank.

Google's guidance permits useful AI-assisted work and warns against scaled pages that add little value. The revision therefore improves answers and evidence; it does not use AI-detector evasion, invented experience, fake quotes or fake reviewers.

## Build and integrate

Read CURSOR_START_HERE_120.md for the original repository-preservation instructions, then use this newer revision's files and evidence. In tax_simba_frontend:

```sh
npm ci
npm run verify:editorial-v2
npm run build
npm run release:start
```

Tested with Node 24.19.0. Existing Next configuration skips lint and TypeScript checks; they are not claimed as passed. The normal build intentionally enables the all-120 publication overlay for the chosen deployment environment. Preserve actual domain/API/auth/payment/email settings and the real first-publication timestamp. A review build is not authorization to publish the article batch. Keep staging noindex; complete the editorial/tax and live customer-flow checks before a public release.

The ZIP contains source, not installed dependencies, production credentials or compiled output. INTEGRATION_FILES.json lists differences from the recovered baseline. Merge only the intended changes into the latest application branch, retain newer unrelated work and provide Toxel one reviewed branch/commit. Do not apply old batch patches over this revision.

ALL_ARTICLES.json is a reference export of revised registry content. CHANGELOG.json records changes per article; it is not a list of 120 independent approvals. New snapshots are kept alongside historical evidence instead of overwriting it.
