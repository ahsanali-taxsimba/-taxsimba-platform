# OpenAI model comparison — CX audit

**Configured / deployed default (unchanged):** `gpt-4o-mini`  
**Compared:** `gpt-4o-mini`, `gpt-4o`  
**Scenarios per model:** 32 (accuracy/safety suite)  
**Deployed model switched?** **No** — pending owner approval.

## Matrix

See `MODEL_COMPARISON_MATRIX.md`.

| Model | Suite pass | Critical fails | Safety hits | Median latency* | Approx. cost USD |
|-------|-----------:|---------------:|------------:|----------------:|-----------------:|
| `gpt-4o-mini` | 32/32 | 0 | 0 | 4 ms | 0.0043 |
| `gpt-4o` | 32/32 | 0 | 0 | 1 ms | 0.0714 |

\*Many suite turns are answered by deterministic handlers (MTD/consult/clarifiers), so median latency can be near-instant. Open-ended style samples below show live-model latency.

## Open-ended style sample (live model turns)

### gpt-4o-mini

- **3006 ms · 117 words · mode=openai** — Q: I feel overwhelmed by tax. Can you reassure me and outline the first three practical steps without s
  - A (preview): It's completely normal to feel overwhelmed by tax matters, but taking it step by step can help. Here are three practical steps to get you started:  1. **Understand Your Obligations**: Familiarise yourself with your tax r…
- **2559 ms · 103 words · mode=openai** — Q: Describe how TaxSimba’s Simbian Comply differs from Self Assessment Simple in everyday language.
  - A (preview): TaxSimba's Simbian Comply and Self Assessment Simple serve different purposes.   Simbian Comply is a monthly subscription service that helps you manage your ongoing tax obligations digitally, including quarterly updates …
- **2224 ms · 102 words · mode=openai** — Q: I changed my mind halfway: I thought I was a sole trader but I actually receive only PAYE salary and
  - A (preview): If you receive only a PAYE salary and small bank interest, you may not need to file a Self Assessment tax return unless you have other untaxed income or meet specific criteria. Check the following:  1. **Personal Savings…
### gpt-4o

- **1645 ms · 130 words · mode=openai** — Q: I feel overwhelmed by tax. Can you reassure me and outline the first three practical steps without s
  - A (preview): Absolutely, managing tax can feel daunting, but taking it step by step can make it more manageable. Here are three practical steps to get started:  1. **Gather Your Documents**: Collect all relevant financial documents, …
- **1338 ms · 102 words · mode=openai** — Q: Describe how TaxSimba’s Simbian Comply differs from Self Assessment Simple in everyday language.
  - A (preview): TaxSimba's Simbian Comply and Self Assessment Simple serve different purposes. Simbian Comply is designed for ongoing digital tax management, helping you keep digital records and meet quarterly obligations under Making T…
- **1083 ms · 84 words · mode=openai** — Q: I changed my mind halfway: I thought I was a sole trader but I actually receive only PAYE salary and
  - A (preview): If you receive only a PAYE salary and small bank interest, you might not need to file a Self Assessment tax return. However, it's important to check if your total income, including any bank interest, exceeds your Persona…

## Recommendation

**Keep `gpt-4o-mini`** as the default for now.

Rationale: equal critical accuracy/safety on the 32-scenario harness; lower approximate cost; deterministic tax safeguards already short-circuit critical MTD/consult rules regardless of model. `gpt-4o` can be reconsidered later for warmth on open-ended turns after owner review of `open_ended_style_sample.json` — **do not switch without approval**.

## Adapter config

- Env: `OPENAI_MODEL` (default `gpt-4o-mini`)
- Adapter: `OpenAIAdapter` — timeout 30s, max_tokens 700, daily token budget 250k, retries 2
- Fallback: mock LLM if key missing or `CONCIERGE_FORCE_MOCK_LLM=true`
