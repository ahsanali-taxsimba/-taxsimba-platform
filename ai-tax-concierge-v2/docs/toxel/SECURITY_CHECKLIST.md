# SIMBA AI — Security checklist

## Implemented in isolated project

- [x] Server-side secrets only (env)
- [x] No API keys in API responses / bootstrap
- [x] Rate limiting on chat/journeys
- [x] Prompt-injection pattern scrubbing
- [x] Input validation (Pydantic)
- [x] Output HTML escaping in widget
- [x] Security headers (nosniff, referrer, frame policy)
- [x] Explicit CORS allowlist
- [x] Session isolation + delete endpoint
- [x] PII redaction for analytics
- [x] Cost/usage budget on OpenAI adapter
- [x] Mock mode clearly labelled

## Requires Toxel / legal / ops

- [ ] Production secret management (not chat-pasted keys)
- [ ] Harden CORS to exact production origins only
- [ ] Durable session store with TTL / retention policy
- [ ] AuthN/Z for any client-data endpoints
- [ ] Dependency vulnerability scanning in CI
- [ ] UK GDPR DPIA / privacy notice review
- [ ] Consent model for lead capture (if added)
- [ ] WAF / abuse controls at edge
- [ ] Replace temporary emblem asset
- [ ] Penetration test before production

## Classification note

Unresolved Critical/High security gaps in production wiring must block go-live even if automated tests pass.
