# Toxsl impact / retest matrix (contract RC)

| Toxsl / defect ID | Previous result | Root cause | Correction | Changed files | Automated proof | Retest required | Carry-forward Pass? | Focused retest |
|---|---|---|---|---|---|---|---|---|
| F01 SA upload | Fail | FE `documents` vs Multer `file` | Canonical `file`; BE also accepts `documents` | `documents.ts`, `UploadDocuments.jsx` | `clientContractDto` | Yes | No | Upload PDF → refresh → re-login |
| F02 Tax Tracker | Fail | Flat cases vs nested DTO | Nested `taxReturn` + `files.allFiles` | `cases.ts` | `clientContractDto` | Yes | No | Tracker shows case + files |
| F03 Messages | Fail | `messages` vs `emails` | Both keys returned | `messages.ts` | `clientContractDto` | Yes | No | Send/list/refresh |
| F04 My Documents | Fail | Missing `downloadUrl`/`filename`/nesting | Canonical client document DTO | `clientDocumentDto.ts`, `documents.ts`, `downloadFiles.js` | `clientContractDto` | Yes | No | List + authorised download |
| F05 MTD download | Fail | null `cloudinaryUrl` | Authorised download URL | `mtd.ts` | `clientContractDto` + MTD UX suite | Yes | No | MTD doc download + 403 |
| A03 Profile route | Fail | `/dashboard/profile` 404 | Nav + redirect to edit-profile | `navbar.js`, `profile/page.js` | Playwright static guards | Yes | No | Desktop + mobile profile link |
| A05 Delete/deactivate | Fail | Dead `/client/deactivate` APIs | ACCOUNT_CLOSURE data-request | `DeleteProfile.jsx`, `nativeApiUrl.js` | Manual + profile route exists | Yes | Partial | Submit closure request once |
| A06 Token logs | Fail | console.log of tokens | Removed | TaxTracker/ChatBox/TrustPilot | Playwright static guards | Yes | No | Console during login |
| P02 MTD recurring | Partial | Checkout always `payment` | RECURRING → Stripe `subscription` mode | `payments.ts`, `compat/payments.ts` | `clientContractDto`, `releaseAcceptanceApi` | Yes | No | MTD checkout + webhook |
| P03 Billing portal | Fail | 404 | Authenticated portal + cancel→portal | `compat/payments.ts`, `MySubscriptionsUI.jsx` | `releaseAcceptanceApi` RA20 | Yes | No | Portal opens for MTD |
| N02 CTA routes | Fail | `/documents` `/messages` | Real dashboard routes | documents/cases/messages/collaboration | email render + RA tests | Yes | No | Open email CTA after auth |
| Phase 7 email | Fail | Footer tagline | Standard footer + legal links | `email.ts` | `emailRender` | Spot | Yes carry footer if green | Spot-check one receipt |
| Phase 8 wording | Fail | Direct HMRC Submission | Accountant-led copy + scan | SEO `page.client.js` | assert-no-direct-hmrc + Playwright | Spot | Yes if scan green | Spot SEO pages |
| Dual SA+MTD | Pass (prior) | — | Preserved + RA12 | — | releaseAcceptanceApi | Spot | Yes if RA12 green | SA→MTD same login |
| C-004 same account SA+MTD | Fail (UI lock) → LOCAL PASS | Intent locked CTAs; SA tracker listed MTD cases as second WIP | Dual CTAs/switcher; `all-tax-returns` SA-default; FE SA filter | `catalogueJourney.js`, banners/switcher, `MySubscriptionsUI`, layouts, `cases.ts`, `TaxTracker.jsx` | toxelC004DualService + proof (SIMULATED) | Yes staging Stripe TEST | No until staging | Both directions + tracker + replay |
| C-004 Tax Tracker dual WIP | Fail (leak) → LOCAL PASS | `all-tax-returns` returned all ACTIVE types under static year heading | Default SA-only + FE filter; case ref/year on row | `compat/cases.ts`, `TaxTracker.jsx` | C-004 tracker test + `case_ids_sa_then_mtd.json` | Yes staging | No until staging | Confirm 1 SA WIP; MTD only on MTD UI |
| Super Admin assign | Pass (prior) | — | Preserved | — | releaseAcceptanceApi RA09 | Spot | Yes | Assign 403 |
| Draft Admin gate | Pass (prior) | — | Preserved | — | draftUpload* + RA10 | Spot | Yes | Draft hidden then visible |
| Pricing SA | Pass (prior) | — | Unchanged £119/£149/£299 | — | packagePricingP0 | No | Yes | — |

**Objective:** Avoid a full paid restart — retest only Fail/Partial rows and spot-check Pass rows marked Spot.
