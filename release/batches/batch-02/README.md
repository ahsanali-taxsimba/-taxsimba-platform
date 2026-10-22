# TaxSimba — batch 02, launch priority 11–20

This batch follows the saved Batch 01 checkpoint. It completes the remaining ten selected launch-priority guides. The release sequence is 20 priority guides, then the other 100, in twelve batches of ten overall. It is a staging/content checkpoint, not the final all-120 production release.

The ten guides retain their existing slugs, complete article bodies, official-source links and related-guide destinations. They gain individual illustrations in the agreed green/cream style, three responsive WebP sizes, search titles and descriptions, descriptive image text, short introductions, quick answers and three expandable practical steps. Read SOURCE_CHECKS.md for targeted factual and service-scope corrections.

The shared guide hub now uses a cream masthead, serif editorial headings and a two-column desktop card grid with ten guides per page. The first two pages show the selected twenty in their agreed order; all 120 remain searchable and reachable in the staging release overlay. Narrow phones show a single column. The existing official SVG logo is preserved. The comparison image was a design preview, not a screenshot or an exact pixel specification.

## Cursor integration

The small Batch 02 download is an incremental source package. It REQUIRES the Batch 01 source project supplied in the earlier three ZIPs (or the equivalent Git checkpoint). It is not a standalone app. Do not deploy this ZIP directly.

Use one cumulative content release branch. If Batch 01 is represented by Git commit c5d2168714da319eb6f1e7cd58124382048b7444, apply the included binary patch with git apply --check before git apply --index. If the project was assembled from the source ZIPs instead, compare the included changed-files tree and base/new file hashes against the existing files before applying changes. Preserve later unrelated changes. Do not overwrite a newer frontend wholesale.

From tax_simba_frontend, install dependencies with npm ci, then run npm run verify:batch01, npm run verify:batch02 and npm run release:build. That last command enables the 120-article LOCAL/STAGING overlay and prepares the standalone server. Preserve production host, API, payment and environment configuration. Keep credentials out of Git.

The release:deploy-build completeness guard still refuses the final production release while only twenty guides have finished the premium repair. Keep the real first-publication timestamp at deployment; do not invent reviewer names or publication dates.

After all twelve batches are complete and integrated checks pass, Cursor can push the final branch/SHA for Toxel. No backend migration is introduced by this batch. No GitHub push, production deployment, payment or account creation was performed here.
