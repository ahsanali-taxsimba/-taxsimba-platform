# SIMBA V2 — Final master handover report

**Date:** 2026-11-18 (Europe/London)  
**PR:** https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/39  
**Branch:** `cursor/simba-v2-final-corrected-6522`  
**Production:** **HOLD — NO-GO** until Toxel staging + owner approval  

## 1. Executive summary

SIMBA V2 is ready for **HTTPS staging handoff**. Critical product defects found in this pass (especially long-chat history truncation at ~6–8 turns) are fixed and retested with real OpenAI continuous 20- and 50-turn conversations. Personalised package cards, lead capture (outbox), consultation honesty, tax accuracy suites and responsive evidence are in place. Live Stripe/Calendly/SMTP/portal E2E and physical devices remain **BLOCKED** for Toxel.

## 2. Previously completed (preserved)

- Digital Tax Assistant identity, welcome, dual consultations £99/20 + £149/40  
- Deterministic MTD eligibility + original 33 scenario defect fixes → 537/537  
- Model comparison keep `gpt-4o-mini`  
- Mobile responsive screenshot set  

## 3. Gaps found this pass

| Gap | Impact | Fix |
|-----|--------|-----|
| Client + OpenAI history `slice(-12)` | Chat “stops”/forgets after ~6–8 Qs | `packConversationHistory` + slice(-100)/session 120 |
| Chat rate limit 40/min | Could stall long chats | Raised to 90/min |
| Package cards lacked recommended badge/CTA | Weak conversion UX | Premium `ts-pkg-card` UI |
| No lead capture API | No enquiry pipeline | `/api/v1/leads` + outbox |

## 4. Defects corrected

- D16 Long-conversation truncation — **PASS** 20/20 and 50/50 continuous  
- D13 Email-as-default consultation — already corrected; preserved  
- Package recommendation presentation — **PASS**  

## 5. Requirements matrix

See `REQUIREMENTS_TO_EVIDENCE_MATRIX.md`.

## 6. Automated tests

- Vitest **520/520 PASS** (`evidence/vitest_master_final.txt`)  
- Master suite previously **537/537** + multiturn **50/50**  

## 7–8. Long conversations + tax accuracy

- `evidence/long_conversation_20.json` / `long_conversation_50.json` — **0 failures**, memory probe recalled £32,000  
- `evidence/TAX_ACCURACY_VERIFICATION_REPORT.md`  

## 9–12. Friendly OpenAI + package screenshots

- `evidence/conversion_journeys_AE.json`  
- `evidence/personalised_package_recommendations.json`  
- Screenshots: `screenshots/responsive/packages_desktop_1280.png`, `packages_mobile_390.png`, welcome + consult panels  

## 13–16. Visual evidence / purchase links

- Choose-this-package → `https://www.taxsimba.co.uk/self-assessment` or `/making-tax-digital`  
- Browser emulation only — physical device **BLOCKED**  

## 17. Consultation integration

- UX ready; live booking **BLOCKED** until Calendly+Stripe+Meet verified  

## 18. HMRC automatic updates

- Pipeline **IMPLEMENTED** + unit tested; staging scheduler/ops token **BLOCKED** to claim continuous ops  

## 19. Lead capture

- API **PASS**; outbox notification **PASS** (`evidence/lead_capture_api.json`, outbox `*.txt`)  
- SMTP transporter **BLOCKED** (configure `SMTP_HOST` + approved mailer)  

## 20. Registration-to-dashboard

- **BLOCKED** — portal E2E not in SIMBA repo scope  

## 21. Model comparison

- Keep **`gpt-4o-mini`** — see `evidence/model_comparison/`  

## 22. Security

- Allowlist + security suite green; keys server-side; rate limits active  

## 23. Physical-device testing

- **BLOCKED** — mandatory for Toxel (iPhone Safari + Android)  

## 24. Outstanding Toxel dependencies

1. Deploy this exact commit to HTTPS staging  
2. Enable CORS allowlist, OpenAI key, ops token  
3. Wire SMTP for leads; Calendly/Stripe/Meet; set `CONSULTATION_BOOKING_LIVE=true` only after E2E  
4. Enable HMRC monitor scheduler  
5. Portal registration/checkout/dashboard E2E  
6. Physical mobile scroll/keyboard acceptance  
7. Accountant review of material tax answers; owner launch approval  

## 25. Final commit SHA

`4376ee1b94722aa69a6a693d0fd374634cb0163b`  

## 26. GO / NO-GO

**NO-GO production.**  
**GO staging handoff** with blockers listed above.
