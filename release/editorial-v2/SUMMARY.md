# TaxSimba 120 articles — editorial revision 2

The existing project has been improved in place. The agreed 20 remain first, followed by the remaining 100. No live deployment or GitHub push was performed.

## Completed

- 120 specific quick answers rewritten.
- Main bodies of all 20 priority guides rewritten for clearer decisions and practical next steps.
- Three broad guides expanded; the tax-saving guide narrowed to sole traders.
- Sixteen added explanations/calculations, including gross-to-net payouts, tax-year mileage rates, home-working bands, savings reporting, pensions, token swaps and loan payments.
- Dated and linked provider-price examples added to the two cost guides, including VAT and scope distinctions. These are not a market average or a claim about TaxSimba’s own fees.
- Repeated section introductions and duplicate checklist/comparison components removed. Useful examples, questions, tables and all 120 downloads retained.
- Generic “Reviewed by TaxSimba” labels removed. No independent review or invented personal experience claimed.
- Deadline quick answers now change correctly after the relevant dates.

## Checked again

Clean dependency install; original completion, priority-20, depth, registry and field checks; new editorial regression checks; and the normal production build all passed. The built server returned all 120 article pages with one H1, correct canonical metadata and parseable structured data. All 360 image responses and 120 downloads passed. The sitemap included all 120 article URLs. The hub, registration, SA pricing and MTD information routes returned HTTP 200.

The HTTP run deliberately blocked external API traffic and tested the local article registry. It does not establish live customer signup, payment or email success. Existing Next configuration skips lint and TypeScript checks. No new rendered mobile/desktop pass was completed because a usable Chromium download was unavailable. The new tables use the established scrollable table component; verify the final pages on staging at 320px, 390px and desktop.

## What this establishes—and what it does not

The copy is more direct, specific and less repetitive. The package is buildable and has working local article assets, downloads, metadata and sitemap entries. It is still AI-assisted work. It has not been independently certified as the best set in the market, and Google rankings cannot be guaranteed.

Selected new facts were checked against current HMRC guidance and price examples against the providers’ own pages on 21 October 2026. The source ledger identifies that scope. This was not a full new verification of every sentence in all 120 articles. A qualified tax review, real customer reading feedback and staging checks remain before final public approval.

Google’s guidance focuses on accuracy, relevance and added value. It warns against generating many pages without useful value; it does not require hiding AI assistance. Read: https://developers.google.com/search/docs/fundamentals/using-gen-ai-content

## Cursor handover

Use this newest ZIP. Read TaxSimba_Source/README_EDITORIAL_V2.md and release/editorial-v2/ first. Integrate the changed editorial files into the latest application branch, preserving newer application work and actual production settings. Do not apply earlier batch patches over it. The normal build includes the new editorial checks.

This replaces the earlier buildable ZIP as the current working version. Historical records inside the source describe older copy; the editorial-v2 directory is authoritative for this revision. The archive contains source and assets, not dependencies, credentials or compiled output.
