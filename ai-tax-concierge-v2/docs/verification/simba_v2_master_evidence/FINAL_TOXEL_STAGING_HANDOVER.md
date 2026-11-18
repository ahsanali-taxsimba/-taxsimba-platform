# Final Toxel staging handover — SIMBA V2 master corrected

**Branch:** `cursor/simba-v2-final-corrected-6522`  
**PR:** https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/39  
**Primary report:** `FINAL_CORRECTIONS_AND_VERIFICATION_REPORT.md`  
**Branch tip:** use `git rev-parse origin/cursor/simba-v2-final-corrected-6522` after fetch (see PR #39)  
**Base stack:** `cursor/simba-final-toxel-handover-6522` → `cursor/ai-tax-concierge-v2-phase1-0f84` → `main`  
**Production HOLD:** do not merge to `main`; do not deploy production.

## What was corrected

1. All **33** original master-suite failures fixed → **537/537**
2. Intent clarifier for ambiguous customer language
3. 20 real OpenAI multi-turn journeys + ambiguous intent probe
4. Evidence pack refreshed (screenshots, consultation recording, security retest)
5. Journey scorer uses whole-transcript tokens (LJ-13 false-fail removed)
6. **Consultation UX:** select option → matching Calendly event → **pay within Calendly** → Meet; email only as unavailable fallback. **Do not** build a separate Stripe Checkout page for consultations.
7. Mobile Menu drawer (hamburger + **Menu**); truncated “–Op…” removed; horizontal mobile tabs removed
8. OpenAI model comparison — **keep gpt-4o-mini** pending approval
9. **Long-chat fix:** continuous **20/50-turn** OpenAI conversations PASS with memory
10. **Personalised package cards** with Recommended badge + Choose this package CTA
11. **Lead capture API** + secure outbox notification (SMTP still to wire on staging)
12. Final corrections report + requirements matrix updated

## Deploy (staging only)

```bash
git fetch origin cursor/simba-v2-final-corrected-6522
git checkout cursor/simba-v2-final-corrected-6522
cd ai-tax-concierge-v2/backend-node
npm ci && npm test && npm run build
# env: CONCIERGE_ENV=staging, OPENAI_API_KEY, CORS exact origins (no *),
# CONSULTATION_BOOKING_URL_99 / CONSULTATION_BOOKING_URL_149 = real Calendly event URLs,
# CONSULTATION_BOOKING_LIVE=false until Calendly payment + Meet E2E verified,
# SMTP for leads, HMRC monitor + catalogue sync enabled with ops token
npm start
```

## Staging acceptance (must)

- [ ] Welcome + Ask SIMBA + TaxSimba logo on mobile/desktop
- [ ] Consultations show £99/20 and £149/40; no free callback; no 30-minute copy
- [ ] Consultation journey: select option → live Calendly event → pay within Calendly → Meet (email only if booking down)
- [ ] Both Book consultation buttons open the correct Calendly event URLs
- [ ] Exact £50k/£30k/£20k + PAYE+trading + Ltd company MTD checks
- [ ] Ambiguous income clarifies before guessing
- [ ] Catalogue/bootstrap: no internal metadata
- [ ] Mobile Menu button readable; drawer works; no “–Op…” truncation
- [ ] Mobile (physical iPhone Safari): send message → reply stays in view; Jump to latest; keyboard does not hide input
- [ ] Calendly payment + Google Meet end-to-end (success, failure, cancel, reschedule) — set `CONSULTATION_BOOKING_LIVE=true` only after done
- [ ] Registration → email verification → package → checkout → dashboard handoff
- [ ] Owner / accountant review of tax-sensitive answers + model choice (`gpt-4o-mini` recommended)
- [ ] Confirm HTTPS + CORS allowlist
- [ ] SMTP lead notification arrives in TaxSimba inbox
- [ ] HMRC monitor scheduler runs with ops token

## Remaining external dependencies (BLOCKED here)

- HTTPS staging host + CORS
- Calendly events + Calendly-integrated payment + Meet booking E2E
- SMTP lead delivery
- Portal registration/auth E2E
- Physical-device scroll recording (iPhone Safari / Android)
- Owner acceptance to lift HOLD

## Evidence root

`ai-tax-concierge-v2/docs/verification/simba_v2_master_evidence/`  
Start with `FINAL_CORRECTIONS_AND_VERIFICATION_REPORT.md`.
