# SIMBA AI — Integration contracts (stubs → live)

Adapters remain stub/mock unless noted. Clicks are never verified conversions.

## OpenAI

- Server-only `OPENAI_API_KEY`
- Retries, timeout, daily token budget
- Prompt-injection scrubbing + system addendum
- Redacted analytics only

## Website / navigation

- Registry: `backend/app/routes_registry/routes.json`
- Statuses: `live_verified` | `soft_or_generic` | `stub`
- Never auto-redirect; user click required

## Calculators (17)

- Catalogue: `backend/app/catalog/calculators.json`
- Paths title-verified on taxsimba.co.uk (`url_status: live_verified`)
- Suggest + deep-link only; SIMBA does not execute calculators

## Stripe / payments

- `MockPaymentAdapter.create_checkout` → `status: unavailable`
- Live rule: SIMBA may deep-link to checkout; **verified payment completion** only from Stripe webhooks / authoritative backend — never claim paid from chat alone

## Calendly / consultation

- Catalogue: £99 · 30 minutes · Google Meet · `booking_status: stub`
- Live rule: show booking URL only when configured; **verified booking** only from Calendly webhook/API

## Client auth / dashboard

- Existing clients: guide to secure dashboard messaging
- Do not expose client data without authenticated portal integration

## Analytics (in-memory)

Engagement (allowed): `launcher_open`, `conversation_started`, `panel_view`, `topic_click`, `journey_start`, `package_click`, `calculator_click`, `consultation_click`, `route_click`, `registration_click`

Verified conversions (server-only, not emitted by widget): `*_conversion_verified`

- Distinguish clicks vs conversions
- Only authoritative systems may emit conversion-verified events
- Durable analytics / CRM remains a Toxel concern
