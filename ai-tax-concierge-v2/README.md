# TaxSimba AI Tax Concierge V2

Standalone UK tax assistant for TaxSimba. Fully isolated from the existing TaxSimba portal (`backend/`, `frontend/`), TaxoTools (`taxotools/`), and Marketing Hub.

## Phase status

- **Phase 1:** Secure AI backend, knowledge retrieval, source verification — done
- **Phase 2:** Embeddable chatbot UI + guided journeys + catalogue recommendations — this branch
- **Phase 3:** Not started (awaiting approval)

## Quick start (local preview)

```bash
cd ai-tax-concierge-v2/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# optional: export OPENAI_API_KEY=... for live AI; otherwise mock mode
uvicorn app.main:app --reload --host 127.0.0.1 --port 8090
```

Open:

- Preview host page: http://127.0.0.1:8090/widget/preview.html
- Full panel: http://127.0.0.1:8090/widget/index.html
- API docs: http://127.0.0.1:8090/docs

### Embed on a host page (does not change host design)

```html
<script
  src="http://127.0.0.1:8090/widget/embed.js"
  data-api-base="http://127.0.0.1:8090"
  async></script>
```

## Tests

```bash
cd ai-tax-concierge-v2/backend
source .venv/bin/activate
pytest -q
```

## Security notes

- OpenAI keys are server-side only and never returned by `/api/v1/config` or `/bootstrap`
- Chat endpoints are rate-limited
- Analytics store redacted text only
- Package prices come from `app/catalog/packages.json` — inclusions are not invented
- Calculator / booking / payment integrations remain stubbed until Phase 3 wiring
