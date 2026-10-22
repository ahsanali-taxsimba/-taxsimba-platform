# TaxSimba 120 article release repair — 21 October 2026

The release keeps the agreed priority 20 first, then the remaining 100. Existing article slugs, all full article bodies, official sources, related links and service/signup destinations are preserved.

## Repairs

- Hub pagination now slices the same server-provided merged registry used by the filters. It no longer replaces the 120-guide page count with the API's smaller count, nor requires another API request to browse the local guides.
- Added labelled, case-insensitive search across titles, excerpts and tags. Search and category changes reset to page one. A result count announces changes; current pagination has aria-current.
- Replaced all 82 clipped draft descriptions with complete, topic-specific sentences from their introductions. Original 38 descriptions remain unchanged.
- Full article text precedes the checklist, comparison and service prompt. All existing article sections and link targets remain intact.
- Explicit deployment publication timestamps are respected and invalid/future timestamps rejected. Existing timestamps remain stable for rebuilds in the same workspace.
- Verification now checks unique titles/descriptions, ellipses, actual priority order, related slugs, sources and all 360 image files.

## Evidence

- npm ci and clean npm run release:build: passed. Existing Autoprefixer warnings remain. The project's existing build configuration skips lint/type validation; build success is not a lint/type audit.
- All 120 built article routes: HTTP 200 with server-rendered article body, official-source section and JSON-LD.
- All 120 URLs present in sitemap.xml.
- Hub and labelled search markup render; registration, MTD registration, pricing, MTD information and MTD checker routes return 200.
- All 40 distinct internal article/service destinations exist in the route registry.
- Field comparison confirms every field of all 82 draft records is unchanged except metaDescription. Original 38 source registry is unchanged.
- Official /images/logo.svg matches the live TaxSimba asset byte for byte: SHA-256 ca8dfea8843f873b8f65794bfae8dd55bb8f4c08dc1dc5bb0b7cce487dfb5e09. Navbar/footer logo references remain unchanged.

## Limits and deployment checks

Browser installation failed in this environment. Interactive pagination, search/filter behaviour, keyboard operation and mobile visual layout have code review but no completed browser run in this repair. Toxel should smoke-test them on staging, including page 10 and a no-results search.

Registration routes and CTA destinations were checked without creating an account, submitting personal details or making a payment. Complete authenticated signup/checkout and configured production API checks on staging before production release.

This repair preserves the supplied editorial tax copy and source URLs. It is not a new line-by-line tax review, a fresh check of every external source URL, or confirmation that all current service prices match checkout. No new reviewer or review date has been invented. Rankings and rich results are not guaranteed.

No remote Git branch was pushed and nothing was deployed.
