# Security verification (retest)

**Run:** 2026-11-18 ~03:45 UTC (Europe/London same clock offset)  
**Log:** `security_retest.txt`

## Results

| Suite | Result |
|-------|--------|
| `tests/intent_clarifier.test.ts` | PASS (6) |
| `tests/public_catalogue_allowlist.test.ts` | PASS (5) |
| `tests/security_suite.test.ts` | PASS (26) |
| **Total** | **37/37 PASS** |

## Controls covered (repository-accessible)

- Public catalogue metadata leakage blocked (allowlist)
- Internal prompt / owner decisions not exposed on public bootstrap
- Sensitive customer fields not echoed unsafely (privacy tests in full Vitest)
- Operational API authorisation patterns in security suite
- CORS wildcard rejected for staging/prod settings
- Rate-limit configuration present
- Invalid credentials / mock payment failure honesty (`payment_status: unavailable`)
- No free booking confirmation when Calendly/Stripe stubbed
- OpenAI key server-side only (fingerprint last4 internally; never in public responses)
- Misleading refund guarantees refused (ambiguous probe)

## Not claimed here

- Live Stripe chargeback / 3DS flows
- Live Calendly duplicate-booking race on production calendars
- Full WAF / edge HTTPS posture on customer domain (staging dependency)
