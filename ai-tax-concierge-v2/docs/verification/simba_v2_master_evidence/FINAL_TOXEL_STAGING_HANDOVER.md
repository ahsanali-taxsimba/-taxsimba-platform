# Final Toxel staging handover — SIMBA V2 master corrected

**Branch:** `cursor/simba-v2-final-corrected-6522`  
**PR:** https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/39  
**Commit SHA (branch tip):** `801918014f878137842060eacc1617e03e93d747`  
**Main remediation commit:** `cd8e1b2608b45ff7e057b59cc2d353882996285f`  
**Base:** `cursor/simba-final-toxel-handover-6522`  
**Production HOLD:** do not merge to `main`; do not deploy production.

## What changed (summary)

1. Identity + welcome + Ask SIMBA branding (no “AI Tax Assistant” heading)
2. Consultations: Quick £99/20 min + Extended £149/40 min; email info@taxsimba.co.uk; no free callbacks
3. Deterministic MTD with PAYE/Ltd exclusions and exclusive thresholds
4. Mobile scroll fix + Jump to latest
5. Master evidence: 537 scenarios + 50 multiturns + automated/live probes

## Deploy (staging only)

```bash
git fetch origin cursor/simba-v2-final-corrected-6522
git checkout cursor/simba-v2-final-corrected-6522
cd ai-tax-concierge-v2/backend-node
npm ci && npm test && npm run build
# env: CONCIERGE_ENV=staging, OPENAI_API_KEY, CORS exact origins (no *),
# CONSULTATION_BOOKING_LIVE=false until Stripe/Calendly verified,
# HMRC monitor + catalogue sync enabled with ops token
npm start
```

## Staging acceptance (must)

- [ ] Welcome + Ask SIMBA + TaxSimba logo on mobile/desktop
- [ ] Consultations show £99/20 and £149/40; no free callback; no 30-minute copy
- [ ] Exact £50k/£30k/£20k + PAYE+trading + Ltd company MTD checks
- [ ] Catalogue/bootstrap: no internal metadata
- [ ] Mobile: send message → reply stays in view; Jump to latest works
- [ ] Booking/payment not claimed live until integrations verified
- [ ] Owner / accountant review of tax-sensitive answers

## Remaining external dependencies

- HTTPS staging host + CORS
- Stripe + Calendly verification before advertising booking
- Portal registration/auth E2E
- Physical-device scroll recording
- Broader live OpenAI tax suite on staging
- Owner acceptance to lift HOLD
