# TaxSimba AI Tax Concierge V2

Standalone UK tax assistant for TaxSimba. This project is **fully isolated** from the existing TaxSimba portal (`backend/`, `frontend/`) and TaxoTools (`taxotools/`).

## Phase 1 scope (this branch)

1. Isolated project + feature branch
2. Architecture and project structure
3. Secure server-side OpenAI integration + conversational engine
4. Foundational UK tax knowledge retrieval with HMRC source verification
5. Automated tests for those components

Later phases (chatbot UI, guided journeys, packages, £99 consultation, website/payment/Calendly adapters, embed) are **out of scope** until Phase 1 is approved.

## Quick start

```bash
cd ai-tax-concierge-v2/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env   # optional: set OPENAI_API_KEY for live AI

# Run API (mock AI if no key)
uvicorn app.main:app --reload --port 8090

# Run tests
pytest -q
```

## Security notes

- OpenAI API keys are read **only** from server environment variables.
- Keys are never returned in API responses or logged.
- Chat endpoints accept user text only; no client-supplied model overrides.
- PII redaction is applied before analytics events are recorded.

## Isolation guarantee

All code lives under `ai-tax-concierge-v2/`. No files outside this directory are modified for this product.
