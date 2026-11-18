# Final Toxel staging handover — SIMBA V2 master corrected

**Branch:** `cursor/simba-v2-final-corrected-6522`  
**PR:** https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/39  
**Evidence remediation commit:** `760007fe25eadccca90870aa930266c3d2744060`  
**Branch tip:** use `git rev-parse origin/cursor/simba-v2-final-corrected-6522` after fetch (see PR #39)  
**Base stack:** `cursor/simba-final-toxel-handover-6522` → `cursor/ai-tax-concierge-v2-phase1-0f84` → `main`  
**Production HOLD:** do not merge to `main`; do not deploy production.

## What was corrected in this verification pass

1. All **33** original master-suite failures (PAYE→crypto misroute, rent-a-room, Xero/MTD ops over-match, CIS, crypto SA) fixed via handlers/retrieval — not softened expects → **537/537**
2. Intent clarifier for ambiguous customer language
3. 20 real OpenAI multi-turn journeys + ambiguous intent probe
4. Evidence pack refreshed (screenshots, consultation recording, security retest)
5. Journey scorer uses whole-transcript tokens (LJ-13 false-fail removed)

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
- [ ] Ambiguous income clarifies before guessing (online trading, “I earn £60k”, crypto, rental)
- [ ] Catalogue/bootstrap: no internal metadata
- [ ] Mobile (physical iPhone Safari): send message → reply stays in view; Jump to latest; keyboard does not hide input; no unwanted auto-scroll when reading history
- [ ] Stripe Checkout + Calendly + Google Meet end-to-end with test payments — **do not advertise booking until done**
- [ ] Registration → email verification → package → checkout → dashboard handoff
- [ ] Owner / accountant review of tax-sensitive answers
- [ ] Confirm HTTPS + CORS allowlist

## Remaining external dependencies (BLOCKED here)

- HTTPS staging host + CORS
- Stripe + Calendly + Meet booking E2E
- Portal registration/auth E2E
- Physical-device scroll recording (iPhone Safari)
- Owner acceptance to lift HOLD

## Evidence root

`ai-tax-concierge-v2/docs/verification/simba_v2_master_evidence/`
