# Phase 2 — Chat UI + guided journeys

## Isolation

- Continues on branch `cursor/ai-tax-concierge-v2-phase1-0f84`
- Changes only under `ai-tax-concierge-v2/`
- Does **not** merge PR #35, deploy, or modify portal / taxotools / Marketing Hub

## Delivered

- Embeddable chatbot widget (`/widget`) + launcher (`embed.js`) + local preview page
- Guided journeys: Self Assessment, MTD, landlords, freelancers, CIS, first-time
- One-question-at-a-time journey engine with retained state
- Starter questions, follow-ups, source links, calculator suggestions (stub URLs)
- Catalogue-driven SA (£119 / £149 / £299), MTD (£29.99 / £59.99 / £89.99 VAT incl.), £99 consultation
- Non-pushy recommendations; inclusions never invented
- Phase 1 hardening: rate limit, security headers, clearer mock/live signalling, expanded HMRC corpus

## Not connected yet (by design)

- Live Stripe / payment checkout
- Live Calendly booking
- Confirmed production website calculator URLs / CMS deep-links
- Client portal account lookup
- Production deployment / host-site install on taxsimba.com
