# TaxSimba — batch 01 of 12

This checkpoint completes the premium presentation work for launch priority ranks 1–10. All 120 source articles remain in the repository. The other 110 have not completed this visual repair; this is not the final 120-article production release.

The official TaxSimba SVG logo and existing article slugs remain unchanged. First-batch work includes ten individual editorial illustrations in the agreed green/cream style, 30 responsive WebP files, individual SEO titles/descriptions, image descriptions, a short-answer panel, serif article headings, native keyboard-accessible expandable steps and complete article bodies. Important wording remains HTML rather than text embedded in images.

Article copy is retained except for targeted corrections in the two fee guides and joining-mid-year guide: stale fixed-price claims now point to current package pages, the monthly fee calculation is explicitly illustrative, personal-return fee deductibility is clearer, and unverified admin/payment/unlock promises are removed. Sources and existing service/signup destinations are preserved.

## Cursor integration

The accompanying full Git bundle is self-contained. Fetch its branch into the existing repository and integrate on the one cumulative content release branch. Preserve later repository changes during integration; do not overwrite a newer frontend wholesale.

```bash
git fetch /absolute/path/TaxSimba_Batch_01.bundle content/taxsimba-editorial-batch-01:content/taxsimba-editorial-batch-01
git switch content/taxsimba-editorial-batch-01
cd tax_simba_frontend
npm ci
npm run verify:batch01
npm run release:build
npm run release:start
```

The release build is available for local/staging inspection and enables the existing 120-article publication overlay. It must not be used as evidence that all illustrations have been repaired. The new `release:deploy-build` command includes a completeness guard and refuses the final all-120 production build while only ten articles are marked ready.

Do not invent publication or reviewer dates. Persist the real first-publication timestamp in deployment configuration, as described in the earlier release handoff. Keep production API, host, port and payment configuration; do not commit credentials or local environment files.

Complete the next batches in the agreed order: launch ranks 11–20, then the remaining 100 existing slugs in ten batches. After all 120 are repaired and verified, Cursor pushes the final integrated branch/SHA for Toxel to deploy. There is no backend migration in this batch.
