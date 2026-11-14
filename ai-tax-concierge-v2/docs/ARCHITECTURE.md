# Architecture — TaxSimba AI Tax Concierge V2 (Phase 1–2)

> **Node.js runtime (approved migration in progress):** Primary implementation is Express + TypeScript under [`backend-node/`](../backend-node/). Python FastAPI under `backend/` is retained for dual-run comparison until staging cutover. Widget JS/CSS/HTML is unchanged. See [`PYTHON_VS_NODE_PARITY_REPORT.md`](./PYTHON_VS_NODE_PARITY_REPORT.md) and [`ARCHITECTURE_DECISION_NODEJS.md`](./ARCHITECTURE_DECISION_NODEJS.md).

## Isolation

```
ai-tax-concierge-v2/          ← new product root (only tree touched)
  docs/
  backend/
    app/                      ← FastAPI application
    tests/
```

Existing TaxSimba portal and TaxoTools remain untouched. External systems (live website, Stripe, Calendly, client portal) are represented as **stub/config adapters** and are not called in Phase 1.

## High-level components

```
┌────────────────────┐   ┌──────────────────────┐   ┌──────────────────┐
│ Embeddable widget  │──▶│ FastAPI /api/v1/*    │──▶│ Conversational   │
│ /widget + embed.js │   │ chat, journeys,      │   │ Engine + journeys│
└────────────────────┘   │ bootstrap, catalog   │   └────────┬─────────┘
                         └──────────────────────┘            │
                ┌────────────────────────────────────────────┼────────────┐
                ▼                        ▼                   ▼            ▼
      ┌──────────────────┐   ┌────────────────┐   ┌──────────────┐  ┌────────────┐
      │ Knowledge +      │   │ Catalogue      │   │ LLM Adapter  │  │ Analytics  │
      │ source verify    │   │ packages/calcs │   │ OpenAI|Mock  │  │ (privacy)  │
      └──────────────────┘   └────────────────┘   └──────────────┘  └────────────┘
```

## Request flow (chat)

1. `POST /api/v1/chat` validates payload (session id, message, optional tax year).
2. Privacy layer redacts obvious PII for analytics (UTR, NI, email, phone).
3. Knowledge retriever ranks curated HMRC-aligned facts for the query + tax year.
4. Source verifier attaches official URLs, publisher, and tax-year validity.
5. Conversational engine builds a grounded system prompt and calls the LLM adapter.
6. Response returns answer text, confidence, sources, tax year context, and disclaimers.

## Secure AI

- `OPENAI_API_KEY` is server-only (`Settings` from env).
- When unset, `MockLLMAdapter` returns deterministic grounded replies for local/dev/tests.
- Model name and temperature are server-configured; clients cannot override them.
- Adapter errors map to structured API errors without leaking upstream payloads.

## Knowledge & verification

- Corpus is versioned JSON under `app/knowledge/corpus/`.
- Retrieval is keyword + tax-year filtered (foundation for later vector RAG).
- Every cited fact must have: `id`, `title`, `summary`, `tax_years`, `source_url`, `publisher` (HMRC or GOV.UK).
- Answers without verified sources include an explicit caution and accountant pathway hint.

## Adapters (stubs in Phase 1)

| Adapter        | Purpose                         | Phase 1 behaviour      |
|----------------|---------------------------------|------------------------|
| `llm`          | OpenAI chat completions         | Live or mock           |
| `website`      | Deep-link / navigation hints    | Config map stub        |
| `payment`      | SA/MTD package checkout         | Mock unavailable       |
| `calendly`     | £99 consultation booking        | Mock URL stub          |
| `client_portal`| Existing TaxSimba account link  | Mock unavailable       |

## Tax year awareness

`TaxYearService` resolves the current UK tax year (6 Apr → 5 Apr) and accepts an explicit override on chat requests. Knowledge records declare applicable years; retrieval prefers matching years and falls back with a labelled caveat.

## Testing

- Unit tests: tax year, retrieval, verification, privacy, conversational engine (mock LLM).
- API tests: health, chat happy path, validation, missing-source caution.
- No dependency on live OpenAI or external networks in CI.
