# Toxel — AI Marketing Hub staging instructions (hardened)

**Single branch:** `cursor/ai-marketing-hub-df9b`  
**PR:** https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/34  
**Do not merge or deploy production until critical checklist items pass.**

## Deploy

1. Deploy `backend-node` + `tax_simba_admin_frontend` (+ client if picking up UTM hooks) from this tip.  
2. Env defaults for first staging pass:

```text
MARKETING_HUB_ENABLED=true
MARKETING_HUB_PAUSED=false
MARKETING_HUB_FIXTURE_MODE=true
MARKETING_HUB_ORGANIC_PUBLISH_AUTHORISED=false
MARKETING_HUB_DAILY_DRAFT_LIMIT=5
STORAGE_DRIVER=local   # or s3 with Spaces for assets
```

3. Sign in as **SUPER_ADMIN** → **AI Marketing Hub**.

## Verify (order)

1. **Dashboard** — traffic Not Connected; leads/paid/revenue distinct; no fabricated stats.  
2. **AI Marketing** — generation banner shows fixture_demo OR disconnected (never silent fake success).  
3. Run daily engine (fixture) → Draft → Review → Approved → Schedule.  
4. Attempt publish → must fail while `ORGANIC_PUBLISH_AUTHORISED=false`.  
5. Upload high-res asset to `TS-001` (≥1080px) → pending_review → approve → only then `isFinishedArtwork=true`.  
6. Reject a 1×1 image.  
7. Auto SEO — 120/120 preserved; GSC/GA4 Not Connected.  
8. Results — Begin OAuth without client IDs → Not Connected; UI preview is **not** Connected.  
9. Emergency pause ON → engine paused; pause OFF.  
10. Optional: set generation key + `FIXTURE_MODE=false` → real drafts; remove key → 409 disconnected.  

## Batch 01 Content Library (TS-001…TS-010)

1. After deploy, import locked originals (idempotent):

```bash
cd backend-node
STORAGE_DRIVER=local LOCAL_STORAGE_DIR=./.data/marketing-library \
  MARKETING_HUB_ENABLED=true \
  npx ts-node --transpile-only scripts/import-batch-01-library.ts
```

2. SUPER_ADMIN → **AI Marketing Hub → Content Library**.  
3. Expect exactly ten records, all `draft_awaiting_qa`, checksum-verified, Auto-publish OFF.  
4. Confirm visible prices: SA from £119; MTD from £29.99/month. Flag “HMRC compliant” on TS-001 and checkout VAT before any publish.  
5. Full evidence: `docs/marketing-hub/BATCH_01_IMPORT_REPORT.md`.

## Live publishing

Keep **disabled**. Only after OAuth credentials + a real platform confirmation id on staging may `MARKETING_HUB_ORGANIC_PUBLISH_AUTHORISED` be considered — still owner-gated for Google Ads spend.

## Rollback

- `MARKETING_HUB_PAUSED=true` and/or emergency pause API  
- `MARKETING_HUB_ENABLED=false`  
- Redeploy previous tip  

## Credentials still required

| Need | Env |
|---|---|
| Real AI drafts | `MARKETING_HUB_GENERATION_API_KEY` (+ base/model) |
| Meta FB/IG | `META_APP_ID`, `META_APP_SECRET` |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| Google GSC/GA4 | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` |
| Google Ads | `GOOGLE_ADS_CLIENT_*` + owner auth |
| Alerts | `MARKETING_HUB_ALERT_WEBHOOK_URL` |
