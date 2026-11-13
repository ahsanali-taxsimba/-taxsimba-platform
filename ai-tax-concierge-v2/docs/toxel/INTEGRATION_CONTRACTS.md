# SIMBA AI — Integration contracts (stubs → live)

All adapters currently return stub/mock payloads unless noted.

## OpenAI

- Server-only `OPENAI_API_KEY`
- Retries, timeout, daily token budget
- Prompt-injection scrubbing + system addendum
- Redacted analytics only

## Website / navigation

- Registry: `backend/app/routes_registry/routes.json`
- Status `stub` until Toxel sets confirmed production paths
- Never auto-redirect; user click required

## Calculators (17+ configured stubs)

Listed in route registry with `kind: calculator`. Suggest only; URLs null until confirmed.

## Stripe / payments

- `MockPaymentAdapter.create_checkout` → `status: unavailable`
- Live rule: SIMBA may deep-link to checkout; **verified payment completion** only from Stripe webhooks / authoritative backend — never claim paid from chat alone

## Calendly / consultation

- Catalogue: £99 · 30 minutes · Google Meet · `booking_status: stub`
- Live rule: show booking URL only when configured; **verified booking** only from Calendly webhook/API

## Client auth / dashboard

- Existing clients: guide to secure dashboard messaging
- Do not expose client data without authenticated portal integration

## Analytics

- Distinguish `*_click` vs `*_conversion_verified`
- Only authoritative systems may emit conversion-verified events
