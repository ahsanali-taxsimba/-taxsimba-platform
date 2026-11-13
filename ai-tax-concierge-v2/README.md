# SIMBA AI — Your UK Tax Assistant

Standalone TaxSimba AI Concierge V2, branded as **SIMBA AI**. Isolated under `ai-tax-concierge-v2/` — does not modify the TaxSimba portal, Taxotools, Marketing Hub, or live website.

## Quick start

```bash
cd ai-tax-concierge-v2/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Optional live AI: export OPENAI_API_KEY=...  (never commit)
uvicorn app.main:app --host 127.0.0.1 --port 8090
```

- Preview embed: http://127.0.0.1:8090/widget/preview.html  
- Full panel: http://127.0.0.1:8090/widget/index.html  
- API docs: http://127.0.0.1:8090/docs  

Without an API key the service runs in **MOCK MODE** (clearly labelled). Mock output is not live OpenAI verification.

## Tests

```bash
cd ai-tax-concierge-v2/backend && source .venv/bin/activate && pytest -q
```

## Toxel handover

See `docs/toxel/HANDOVER.md` and `docs/READINESS.md`.

## Brand note

Branding uses the official TaxSimba logo (`widget/assets/taxsimba-logo.svg`) and design tokens `#006B3C` / `#078A4B` (Manrope + Public Sans).
