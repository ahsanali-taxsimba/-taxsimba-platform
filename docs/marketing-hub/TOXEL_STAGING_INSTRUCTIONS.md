# Toxel — AI Marketing Hub staging instructions

**Branch:** `cursor/ai-marketing-hub-df9b`  
**Base:** `content/taxsimba-82-articles`  
**Do not merge to production until critical checklist items pass.**

## What this branch adds

Admin Marketing Hub under `/admin/marketing-hub/*` plus native API `/api/marketing-hub/*`.

## Enablement (staging)

1. Deploy `backend-node` and `tax_simba_admin_frontend` from this branch tip.  
2. Set env (see `backend-node/.env.example` Marketing Hub block):
   - `MARKETING_HUB_ENABLED=true`
   - `MARKETING_HUB_PAUSED=false` (use `true` as kill switch)
   - `MARKETING_HUB_FIXTURE_MODE=true` until generation key is ready
   - `MARKETING_HUB_ORGANIC_PUBLISH_AUTHORISED=false` until OAuth + approval + first confirmed publish succeed
3. Sign in as `SUPER_ADMIN` → sidebar **AI Marketing Hub**.
4. Confirm Dashboard shows **Not Connected / No Data** for traffic until GA4/GSC are connected (must not show fabricated numbers).
5. AI Marketing → Run daily engine (fixture) → advance draft through QA → Approval → Schedule.
6. Results → Begin OAuth only after Meta/LinkedIn/Google client IDs are in secrets. Mock UI connect is **not** live publish.
7. Attempt publish must **fail or skip** until `ORGANIC_PUBLISH_AUTHORISED=true` **and** real platform confirmation IDs exist.
8. TikTok: download posting packs only — never auto-publish.
9. Google Ads: never automate bids/budgets.
10. Verify proposed prices (£119 SA / £29.99 MTD) are **not** shown as live until checkout/VAT/terms verified.

## Rollback

- Set `MARKETING_HUB_PAUSED=true` or `MARKETING_HUB_ENABLED=false`.
- Disconnect platforms via Results UI / `POST /api/marketing-hub/connections/:platform/disconnect`.
- Redeploy previous admin+API tip without this branch.

## Credentials still required (blockers)

| Integration | Env / secret |
|---|---|
| Meta FB/IG | `META_APP_ID`, `META_APP_SECRET` + Page tokens |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| Google OAuth (GSC/GA4) | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` |
| Google Ads | `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET` + owner MCC auth |
| Generation (optional) | `MARKETING_HUB_GENERATION_API_KEY` + `FIXTURE_MODE=false` |
| Alerts | `MARKETING_HUB_ALERT_WEBHOOK_URL` |
