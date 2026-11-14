# Production deployment checklist (Toxel)

## Before deploy

- [ ] PR #35 reviewed and approved (do not merge until authorised)
- [ ] OpenAI key in secret store; spend alerts on
- [ ] CORS origins exact
- [ ] Package inclusions confirmed in catalogue JSON
- [ ] Production URLs confirmed in route registry
- [ ] Stripe + Calendly webhooks verified
- [ ] Emblem replaced with approved asset
- [ ] Human tax review of material answers
- [ ] Staging E2E on iPhone Safari + desktop
- [ ] No Critical/High open defects

## Deploy

- [ ] Deploy only `ai-tax-concierge-v2` service
- [ ] Health check `/api/v1/health` shows `llm_mode=openai` and no mock_notice
- [ ] Embed script on staging page before production site
- [ ] Monitor latency, error rate, token spend

## Rollback

- [ ] Remove/disable embed script on host site (host-site change; separate approval)
- [ ] Roll back container/image to previous SIMBA release
- [ ] Force mock or disable service via env if OpenAI outage
- [ ] Preserve logs for incident review (redacted)

## Do not

- Deploy unfinished stubs as “live booking/payment complete”
- Claim live OpenAI verification without a real key run
- Modify portal/taxotools as part of this deploy unless separately ticketed
