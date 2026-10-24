# Toxel handover — HMRC content automation candidate

**Deploy only this tested candidate SHA after Toxel verification.**

This candidate is **not** marked approved by Cursor. Do **not** merge or deploy production until Toxel tests the exact SHA below, deploys it, and verifies the first automatic production run.

## Repository and branches

| Item | Value |
|---|---|
| Repository | `github.com/ahsanali-taxsimba/-taxsimba-platform` |
| **Base used for this work** | `cursor/taxsimba-v6-integration-df9b` @ `294a615de9919fde82a98c10b8685d155bc2685e` |
| **Candidate branch** | `feature/hmrc-content-automation` (identical tip also on `cursor/hmrc-content-automation-df9b` for forge PR) |
| **Candidate SHA** | `8296b2433df45276e96b15c463bfeba1f577dd1d` (automation implementation tested at `540a1e03568aebc472dc8841ed4635b80a26391d`; later commits are handover docs only) |
| PR | https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/33 |

### Why this base (not an older ZIP / SHA)

Inspected remotes and PRs. The complete **120-article** system with generated artwork, agreed **first-20** order (`PRIORITY_ARTICLE_SLUGS`), Quality V4 / Review V5 / Landlord Hub V6 verify scripts, SEO registry, and latest `/blogs` RC lives on:

`origin/cursor/taxsimba-v6-integration-df9b`

`content/taxsimba-82-articles` has the 120 registry but **lacks** the V4/V5/V6 + premium artwork layer.  
`taxsimba-p0-integration` is the staging app tip but **does not** carry the 120-article registry.  
Separate UAT application PRs are **not** in this lineage; they were **not** force-merged here to avoid overwriting the article baseline. Integrate UAT via Toxel’s normal app release process.

### Missing baseline files

| Expected | Status |
|---|---|
| `AGENTS.md` | **Missing** from repository root and `tax_simba_frontend/` |
| Quality V4 / Review V5 / Landlord Hub V6 **verify scripts** | Present on this base |
| Long-form V4/V5/V6 markdown playbooks | Not present as standalone docs (logic embedded in `src/data/*` + verify scripts) |

## What this candidate adds

Automatic HMRC/GOV.UK content maintenance **reusing the existing article template and 120-article registry** — not a second blog system.

Pipeline enforced: `detected → researched → mapped → drafted → validated → published → public_verified`  
(plus `skipped` / `blocked` / `rolled_back`).

- Maps all 120 guides to official GOV.UK sources (`backend-node/src/content-automation/fixtures/source-map.json`).
- Monitors GOV.UK Content API + search discovery; competitor sites used for **topic ideas only**.
- Calendar maintenance (tax-year rollover, deadlines, seasonal expiry) even without a new HMRC post.
- Durable Mongo job/run/revision/live/source/alert/budget collections with claim tokens, dedupe, retries, budgets.
- Pause switch, alerts, backup export/restore, atomic publish + rollback, public revision verify.
- **Runtime publishing** via `GET /api/resources/blogs` overlays merged into the existing frontend template (no GitHub merge required for routine posts once enabled).
- In-process scheduler: **08:00 Europe/London** (BST/GMT aware) when `CONTENT_AUTOMATION_ENABLED=true`.

## Database / migrations

No SQL migrations. Mongo collections created with indexes at startup:

- `content_automation_jobs`
- `content_automation_runs`
- `content_article_revisions`
- `content_article_live`
- `content_source_state`
- `content_automation_alerts`
- `content_automation_budget`

## Secret / config NAMES only

Set values in DigitalOcean / hosting — never commit values:

- `CONTENT_AUTOMATION_ENABLED`
- `CONTENT_AUTOMATION_PAUSED`
- `CONTENT_AUTOMATION_PUBLIC_BASE_URL`
- `CONTENT_AUTOMATION_ALERT_WEBHOOK_URL`
- `CONTENT_AUTOMATION_GENERATION_API_KEY`
- `CONTENT_AUTOMATION_GENERATION_API_BASE`
- `CONTENT_AUTOMATION_GENERATION_MODEL`
- `CONTENT_AUTOMATION_IMAGE_API_KEY`
- `CONTENT_AUTOMATION_IMAGE_API_BASE`
- `CONTENT_AUTOMATION_DAILY_JOB_LIMIT`
- `CONTENT_AUTOMATION_API_BUDGET`
- `CONTENT_AUTOMATION_FIXTURE_MODE`
- `MONGO_URL`

Fixture mode (no generation key) still runs the full pipeline with recorded GOV.UK samples for staging rehearsal.

## Scheduler and publishing setup

1. Deploy **backend-node** from this candidate with Mongo connected.
2. Point frontend `NEXT_PUBLIC_API_URL` at that API (existing blogs merge path).
3. On **one** API instance set `CONTENT_AUTOMATION_ENABLED=true` and `CONTENT_AUTOMATION_PAUSED=false`.
4. Set `CONTENT_AUTOMATION_PUBLIC_BASE_URL` to the public site origin.
5. Optionally set generation/image API keys; otherwise fixture/safe drafting remains available for dry-runs.
6. Optional DO cron safety net: see `.do/app-content-automation.yaml`.

**Pause:** `CONTENT_AUTOMATION_PAUSED=true`  
**Rollback overlay:** `POST /api/content-automation/rollback/:slug` (SUPER_ADMIN)  
**Backup:** `GET /api/content-automation/backup` → `POST /api/content-automation/backup/restore`

After enablement, eligible routine posts require **no** manual writing, uploading, approval, GitHub merge or frontend redeploy — overlays are served from Mongo and merged into the existing `/blogs` template.

## DigitalOcean inspection note

This cloud environment had **no** DigitalOcean API token / `doctl` access. The App Platform fragment above is derived from the repo’s `backend-node` + Docker/PM2 deploy patterns. Toxel must attach env vars to the **actual** DO app and confirm the worker logs “armed for next 08:00 Europe/London”.

## Checks

### Passed (this candidate)

- Backend unit/integration suite for content automation (see CI/local vitest output).
- Source map: 120 articles / 20 priority slugs / 142 GOV.UK URLs.
- Frontend registry still exports 120 unique slugs; first-20 order unchanged in `articleEditorial.js`.
- Existing artwork library not regenerated; new drafts use approved category fallbacks.

### Failed / unavailable (do not mark passed)

- **Live DigitalOcean production scheduler inspection** — no DO credentials in this environment.
- **Live generation API** calls — not required in fixture mode; production needs `CONTENT_AUTOMATION_GENERATION_API_KEY`.
- **Real competitor HTML scrape** — fixture ideas used unless fixture mode is off.
- **Customer payment / registration journeys** — out of scope; not retested here.

### Untested on public production

- First automatic **production** 08:00 run after enablement (Toxel must verify).
- Public CDN/cache behaviour in front of `/blogs/[slug]` after overlay publish.

## Staging rehearsal commands

```bash
cd backend-node
CONTENT_AUTOMATION_FIXTURE_MODE=true CONTENT_AUTOMATION_ENABLED=true npm test -- tests/unit/content-automation/pipeline.test.ts
# SUPER_ADMIN against staging API:
# POST /api/content-automation/demo/new-article
# POST /api/content-automation/demo/update-article
# POST /api/content-automation/rehearse-daily
```

Frontend:

```bash
cd tax_simba_frontend
npm run verify:quality-v4
npm run verify:review-v5
npm run verify:landlord-hub-v6
npm run build
```

## Production enablement (Toxel)

1. Deploy candidate SHA to staging → run demos + vitest evidence.
2. Deploy same SHA to production API + frontend (frontend change required once for overlay merge).
3. Set `CONTENT_AUTOMATION_ENABLED=true` on a single API instance.
4. Confirm logs show the London 08:00 schedule.
5. Verify first automatic run creates/updates only useful posts; confirm public `/blogs/...` shows the new revision id via API overlay.
6. Keep `CONTENT_AUTOMATION_PAUSED` ready.

**Deploy only this tested candidate SHA after Toxel verification.**
