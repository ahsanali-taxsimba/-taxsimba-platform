# Phase 1 — Delivery checklist

## Isolation

- [x] Feature branch: `cursor/ai-tax-concierge-v2-phase1-0f84`
- [x] Project directory: `ai-tax-concierge-v2/` only
- [x] No changes to `backend/`, `frontend/`, or `taxotools/`

## Delivered

- [x] Architecture document
- [x] Secure server-side OpenAI adapter (+ mock fallback)
- [x] Conversational engine with grounded prompts
- [x] UK tax-year service
- [x] Curated HMRC/GOV.UK knowledge corpus
- [x] Retrieval + source verification (gov.uk host + publisher policy)
- [x] Privacy redaction for analytics
- [x] Stub adapters: website, payment, Calendly, client portal
- [x] FastAPI health + chat endpoints
- [x] Automated pytest suite

## Explicitly deferred (Phase 2+)

- Embeddable chatbot UI
- Guided journeys
- Live package recommendations / Stripe
- Live Calendly booking
- Website navigation deep-links against production CMS
- Deployment
