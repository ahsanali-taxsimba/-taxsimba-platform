# Security and Privacy Report

## Automated

- `tests/security_suite.test.ts` — PASS within 479 suite
- `tests/privacy.test.ts` — PASS
- OpenAI key server-side only; bootstrap omits secrets
- Admin token gate for production admin routes
- CORS allowlist; CSP frame-ancestors for widget; no-store on `/api/`
- Staging price override refused when `CONCIERGE_ENV=production`

## Documented for privacy review (no secret values)

| Flow | Data | Processor |
|------|------|-----------|
| Chat | User messages, session id | TaxSimba Node + OpenAI (when live) |
| Analytics | Engagement events (in-memory) | TaxSimba Node |
| Knowledge fetch | Public GOV.UK HTML | TaxSimba Node egress |
| Catalogue sync | Public/approved JSON | TaxSimba Node |
| Stripe/Calendly/Portal | BLOCKED pending wiring | Toxel |

## Residual

- Live dependency CVE scan in staging CI (Toxel)
- Production admin token + network controls
- Retention/deletion policy owner approval
- Prompt-injection suite automated; continuous red-team recommended
