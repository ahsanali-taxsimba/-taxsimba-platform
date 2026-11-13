# SIMBA AI — Security & privacy review (pre-handover)

**Date:** 2026-11-13 (Europe/London) · **PR #35**

| Control | Status | Evidence |
|---------|--------|----------|
| OpenAI key server-only | PASS | Settings alias; never in bootstrap/health; live key length only logged |
| No secrets in frontend | PASS | Widget has no key; embed uses API base only |
| Prompt-injection scrubbing | PASS | `security/injection.py` + live probe |
| Rate limiting | PASS | `security/ratelimit.py` + suite |
| Session isolation | PASS | In-memory session IDs; delete endpoint |
| PII redaction in analytics | PASS | `privacy.py` + analytics summary note |
| Input validation | PASS | Chat schema max length / tax year |
| OpenAI retries + budget | PASS | Adapter retries + 250k daily token budget |
| Payment double-submit safety | BLOCKED | No live payment path |
| Booking confirmation authenticity | BLOCKED | Stub only — must not claim booked/paid |
| Durable audit logging / alerts | PARTIAL | In-memory analytics only |
| DPIA / legal retention policy | NOT TESTED | Legal/Toxel |
| Production edge auth / WAF | NOT TESTED | Hosting |

**Severity still open**

| Severity | Item |
|----------|------|
| High | Live payment/booking/portal integrations absent |
| Medium | In-memory sessions/analytics not durable across restarts |
| Medium | Soft/generic public routes need Toxel confirmation |
| Low | Legacy `simba-emblem.svg` retained unused (not referenced by UI) |
