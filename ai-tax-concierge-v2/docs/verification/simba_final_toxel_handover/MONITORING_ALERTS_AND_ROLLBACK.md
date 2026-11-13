# Monitoring, Alerts and Rollback

## Monitor

- `/api/v1/health` availability and `llm_mode`
- `/api/v1/knowledge/freshness` alerts[]
- Admin knowledge quarantine/pending counts
- Catalogue sync meta `status` (`ok`/`unavailable`/`invalid`)
- OpenAI error rate / latency / cost
- 4xx/5xx and rate-limit hits

## Alerts (knowledge)

Critical source fetch failure or quarantine → surfaced in monitor result `alerts` and freshness payload. Scheduler writes `data/knowledge/audit/*.jsonl`.

## Rollback

1. Knowledge: admin rollback to prior `knowledge_version`
2. Catalogue staging: restore endpoint
3. Application: previous container/image/commit
4. Never change production prices from this SIMBA admin staging harness
