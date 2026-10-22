# TaxSimba — enhanced priority twenty

This update strengthens all twenty selected launch guides. It does not increase the completion count: 20 of 120 have finished the premium presentation work, and the remaining 100 are still to follow.

Each priority guide now contains a distinct illustrative scenario, a three-row decision table, two relevant follow-up answers and an optional plain-text preparation worksheet. The twenty worksheets are available without signup. They are planning aids, not tax returns or filing confirmations. Existing article text, titles, slugs, metadata, illustrations, official-source links and related links remain intact. Reading-time estimates include the additions.

The contents list is a native keyboard-accessible disclosure so longer articles do not place a long link list above the answer on phones. The visible Updated date records this content edit, not a new professional-review claim. BlogPosting dateModified uses the latest valid visible content-update, review or publication date; no invented accountant identity or credentials have been added. The site does not promise FAQ rich results.

## Integration

The consolidated download requires the saved Batch 01 source project (the three source ZIPs), or its equivalent commit c5d2168714da319eb6f1e7cd58124382048b7444. It includes Batch 02 and this depth upgrade together, so it supersedes the earlier Batch 02 integration ZIP. Do not apply both patches in sequence without checking the state of the files.

Use one cumulative release branch. Read INTEGRATION_MANIFEST.json and compare base/new SHA-256 hashes. If Batch 01 is the exact Git base, run git apply --check batch02.patch before applying it. Otherwise compare the changed-files tree and preserve newer unrelated work. Do not overwrite the whole frontend. If Batch 02 is already integrated, compare only outstanding differences against the new hashes rather than forcing the complete patch.

From tax_simba_frontend run npm ci, npm run verify:batch01, npm run verify:batch02, npm run verify:priority20 and npm run release:build. The release build enables the existing all-120 LOCAL/STAGING publication overlay. It is not proof that the remaining illustrations are complete. The final release:deploy-build guard still rejects a 20/120 premium checkpoint.

Keep the real production API, payment, host and environment configuration. Do not invent first-publication dates, reviews or credentials. No backend migration, account creation, payment, GitHub push or production deployment is introduced here. Toxel should receive the final integrated branch/SHA after the complete 120-article release is finished.

## Limits

This is a content and engineering improvement, not independent accountant sign-off, a whole-market audit, or proof of improved Google rankings. The build configuration skips lint/type validation. Live speed, indexing, search performance and enquiries still need measurement after deployment. See QUALITY_STANDARD.md for the factual and competitive basis of this update.
