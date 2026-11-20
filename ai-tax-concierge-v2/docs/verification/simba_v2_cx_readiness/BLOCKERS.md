# Consolidated blockers (CX readiness pass)

| # | Blocker | Owner | Notes |
|---|---------|-------|-------|
| 1 | Staging URL + CORS origins | Toxel | Real mobile/desktop + embed |
| 2 | Staging OpenAI confirmation | Toxel | Agent PASS ≠ staging |
| 3 | HMRC monitor ops cycle | Toxel | Header token + enabled flag |
| 4 | SMTP delivery | Toxel | Not mock outbox |
| 5 | Calendly + payment + Meet | Business/Toxel | Live booking |
| 6 | Portal test accounts | Toxel | Register → pay → dashboard |
| 7 | Asim tax sign-off | Asim | 400 pack + consequential rules |
| 8 | Deploy approval | Toxel | After gates |
| 9 | Multi-node leads store | Architecture | FS unsuitable without shared volume/DB |

No production changes. No invented credentials.
