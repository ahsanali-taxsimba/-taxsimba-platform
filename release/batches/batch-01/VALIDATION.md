# Validation of batch 01

- Clean production build passed after the final CSS corrections.
- Batch verifier passed for ten launch-priority guides, complete bodies, unique metadata, quick answers, three expandable steps, source links, CTA destinations and 30 responsive illustration files.
- Chromium browser checks passed for every batch article at desktop and 390px mobile width: HTTP 200, one H1, loaded hero illustration, meaningful hero alt, meta description, canonical, parseable JSON-LD, full article text, official sources, keyboard-expandable steps and no page-level horizontal overflow.
- Hub browser checks passed: all 120 guides reached through pagination, search, no-results state and MTD category filtering.
- Public /register, /register?role=MTD, /pricing and /mtd-information routes returned 200. No account creation, personal-data submission, authenticated checkout or payment occurred; those are not claimed as tested.
- First ten slugs, original article titles, sources and related links were compared with the input snapshot and preserved. Official logo matches the starting repository file byte for byte.
- Desktop and mobile screenshots are supplied from the running production build, not generated UI mockups. Initial screenshot inspection exposed a narrow-column title bug and a mobile CTA overflow; both were corrected before the passing run.
- Google/HMRC source checks and narrowly scoped copy corrections are recorded in SOURCE_CHECKS.md. No invented reviewer was added.

Existing build settings skip type checking and linting; this build pass does not certify those checks. Existing CSS compatibility warnings remain. Production host/API/payment configuration was not changed. This is batch 01 of 12, not the final repaired release of all 120 articles.
