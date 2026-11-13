# SIMBA AI — Toxel Integration Handover

**Product:** SIMBA AI — Your UK Tax Assistant  
**Location:** `ai-tax-concierge-v2/` (isolated; do not confuse with portal/taxotools)  
**PR:** #35 (do not merge until final approval)  
**Branch:** `cursor/ai-tax-concierge-v2-phase1-0f84`

## What Toxel receives

A working AI tax concierge engine + embeddable widget. You should **not** rebuild the core chat engine or UI. Your role is to connect live systems, confirm production URLs/inclusions, run staging E2E, and perform authorised production deployment.

## Architecture (short)

- FastAPI backend under `backend/app/`
- Secure OpenAI adapter (server-side only) with mock fallback
- Versioned HMRC/GOV.UK knowledge corpus + retrieval + source verification
- 12 guided journeys
- Configurable packages / calculators / website route registry
- Embeddable widget: `/widget` + `embed.js`
- In-memory sessions + privacy-aware analytics (replace with durable stores in production)

See also: `docs/ARCHITECTURE.md`, `INTEGRATION_CONTRACTS.md`, `API.md`, `EMBEDDING.md`.

## Install (local / staging)

```bash
cd ai-tax-concierge-v2/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export OPENAI_API_KEY=...          # server-side only; never commit
export CONCIERGE_FORCE_MOCK_LLM=false
export CONCIERGE_CORS_ORIGINS=https://www.taxsimba.co.uk,https://staging.example
export WEBSITE_BASE_URL=https://www.taxsimba.co.uk
export CONSULTATION_BOOKING_URL=https://calendly.com/<real-event>
uvicorn app.main:app --host 0.0.0.0 --port 8090
```

Preview: `/widget/preview.html` · Panel: `/widget/index.html` · API docs: `/docs`

## Environment configuration

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Live OpenAI (required for non-mock) |
| `OPENAI_MODEL` | Default `gpt-4o-mini` |
| `OPENAI_TIMEOUT_SECONDS` | Default 30 |
| `CONCIERGE_FORCE_MOCK_LLM` | Force mock even if key present |
| `CONCIERGE_CORS_ORIGINS` | Explicit allowlist (no `*`) |
| `WEBSITE_BASE_URL` | Site base for future confirmed URLs |
| `CONSULTATION_BOOKING_URL` | Calendly event URL when live |

## Knowledge management

- Corpus JSON in `backend/app/knowledge/corpus/`
- Fields: source URL/title via fact metadata, tax years, `last_verified`, `effective_date`, `knowledge_version`, `review_status`
- Do **not** auto-publish AI-generated tax rules
- Flag changed GOV.UK pages for human review before updating corpus

## Mock vs live

- If no key / force mock: UI shows **Demo / mock** and `mock_notice`
- Mock tests ≠ live OpenAI verification
- Payment, Calendly, website routes, calculators marked **stub** until confirmed

## Outstanding external work for Toxel

1. Supply/confirm `OPENAI_API_KEY` in secure secret store
2. Confirm production route URLs for 17+ calculators, articles, packages, dashboard
3. Confirm SA/MTD package **inclusions** (prices already configured)
4. Wire Stripe checkout confirmation webhooks (do not process cards in SIMBA)
5. Wire Calendly booking + availability (do not invent slots)
6. Auth boundary for existing clients → dashboard messaging
7. Embed widget on staging host using official logo already in `widget/assets/taxsimba-logo.svg`
8. Staging host with HTTPS for iPhone preview
9. Human accountant review of material tax answers
10. Production deploy + rollback plan (see `DEPLOYMENT_CHECKLIST.md`)

## Isolation reminder

Do not modify TaxSimba portal, Taxotools, Marketing Hub, e-sign, or live `taxsimba.co.uk` from this package unless separately authorised.
