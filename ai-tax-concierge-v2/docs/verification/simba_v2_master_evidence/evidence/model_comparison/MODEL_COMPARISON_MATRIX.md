# OpenAI model comparison matrix

Generated: 2026-11-18T04:27:47.569Z
Configured default (unchanged): `gpt-4o-mini`
Scenarios per model: 32

| Model | Pass | Fail | Critical fail | Safety hits | Median latency ms | Est. cost USD | Style avg |
|-------|-----:|-----:|--------------:|------------:|------------------:|--------------:|------------------:|
| `gpt-4o-mini` | 32 | 0 | 0 | 0 | 4 | 0.0043 | 10 |
| `gpt-4o` | 32 | 0 | 0 | 0 | 1 | 0.0714 | 10 |

**Recommendation (pending approval):** `gpt-4o-mini` — Highest critical accuracy and safety, then pass rate / style, then approximate cost. Deployed default left unchanged pending approval.

Verbatim transcripts: per-model `*_results.json` in this folder.