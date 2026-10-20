# Service landing page implementation backlog

**Status:** clearly labelled backlog — not implemented in the 82-article import PR.

The article package’s `SERVICE_LANDING_PAGE_PLAN.md` and `OPPORTUNITY_ROADMAP_OCT_2026_TO_APR_2027.md` describe conversion landing pages. Per the deployment instruction, thin landing pages must not be created silently. P1 pages should only be built when Toxel confirms the live service scope, price source and CTA against canonical product/billing data.

## P1 candidates (awaiting product confirmation)

| Landing page | Intent | Blocker before build |
|---|---|---|
| MTD accountant service | Managed-service comparison | Confirm package cards + CTA vs `/mtd-information` / catalogue |
| MTD catch-up / missed quarter | Urgent recovery | Confirm separately quoted catch-up work presentation |
| MTD for sole traders — April 2027 | £30k cohort | Confirm threshold copy vs live checker |
| MTD for landlords — April 2027 | Landlord cohort | Confirm property/joint-ownership scope |
| Online Self Assessment accountant | Purchase intent | Confirm `/pricing` / SA packages as canonical price source |
| Landlord tax return service | Specialist purchase | Confirm inclusions/exclusions |
| Sole-trader tax return service | Specialist purchase | Confirm inclusions/exclusions |
| CIS tax return and refund service | Specialist purchase | Confirm “refund not guaranteed” wording |
| Late and overdue tax return help | Urgent purchase | Confirm quote-after-review flow |

## Rules for a future implementation PR

- Derive prices only from the live catalogue / billing configuration — never hard-code article or landing prices when a canonical source can render them.
- Preserve accountant-led and email-only MTD positioning.
- Do not change payments, subscriptions, access controls or checkout logic in a content PR.
- Keep drafts out of routes, sitemap and related content until the publisher release.
