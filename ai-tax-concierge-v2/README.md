# SIMBA AI — Your UK Tax Assistant

Standalone TaxSimba AI Concierge V2, branded as **SIMBA AI**. Isolated under `ai-tax-concierge-v2/` — does not modify the TaxSimba portal, Taxotools, Marketing Hub, or live website.

## Quick start (Node.js — recommended)

```bash
cd ai-tax-concierge-v2/backend-node
npm ci
# Optional live AI: export OPENAI_API_KEY=...  (never commit)
export CONCIERGE_FORCE_MOCK_LLM=false
PORT=8091 npm start
```

- Preview embed: http://127.0.0.1:8091/widget/preview.html  
- Full panel: http://127.0.0.1:8091/widget/index.html  

Without an API key the service runs in **MOCK MODE** (clearly labelled). Mock output is not live OpenAI verification.

### Python reference (retained for dual-run)

```bash
cd ai-tax-concierge-v2/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8090
```

## Tests

```bash
# Node parity suite (212)
cd ai-tax-concierge-v2/backend-node && npm test

# Python reference
cd ai-tax-concierge-v2/backend && source .venv/bin/activate && pytest -q
```

## Toxel handover

See `docs/toxel/NODE_DEPLOYMENT_HANDOVER.md`, `docs/PYTHON_VS_NODE_PARITY_REPORT.md`, and `docs/toxel/HANDOVER.md`.

## Brand note

Branding uses the official TaxSimba logo (`widget/assets/taxsimba-logo.svg`) and design tokens `#006B3C` / `#078A4B` (Manrope + Public Sans).
