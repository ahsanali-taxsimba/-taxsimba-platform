# SIMBA AI — API surface (`/api/v1`)

## Health / config

- `GET /health` → status, product, llm_mode, mock_notice, tax year
- `GET /config` → public config (never includes API keys)

## Bootstrap / catalogue

- `GET /bootstrap` → welcome, journeys, packages, calculators, routes, brand, integrations
- `GET /welcome?session_id=` → welcome ChatResponse
- `GET /catalog/packages`
- `GET /catalog/starters`
- `GET /catalog/routes`

## Chat & journeys

- `POST /chat` `{ session_id, message, tax_year?, history?, journey_state?, journey_id?, journey_option_id? }`
- `GET /journeys`
- `POST /journeys/start` `{ session_id, journey_id }`
- `POST /journeys/advance` `{ session_id, option_id, journey_state }`

## Sessions & analytics

- `GET /sessions/{session_id}`
- `POST /sessions/delete` `{ session_id }`
- `GET /analytics/summary`
- `POST /analytics/track` `{ session_id, event, meta }` — clicks only; not conversions

## Response contract (chat)

Includes: `reply`, `sources[]`, `confidence`, `disclaimer`, `assistant_name`, `is_ai_disclosure`, `follow_ups`, `packages`, `calculators`, `routes`, `journey`, `llm_mode`, `mock_notice`.
