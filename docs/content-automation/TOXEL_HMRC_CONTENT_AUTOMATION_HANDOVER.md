# Toxel handover — HMRC content automation (PR #33)

**Deploy only this tested candidate SHA after Toxel verification.**

This candidate is **not** approved by Cursor. Do **not** merge or deploy production until Toxel:

1. Tests **real** generation + publishing on staging  
2. Enables the scheduler  
3. Verifies the **first scheduled production run**  

---

## 1. ONE final candidate

| Item | Value |
|---|---|
| Repository | `github.com/ahsanali-taxsimba/-taxsimba-platform` |
| **Final branch** | `cursor/hmrc-content-automation-df9b` |
| **PR** | https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/33 |
| **Base branch** | `cursor/taxsimba-v6-integration-df9b` |
| **Tested / deploy tip SHA** | `bc3d6f603a51afb2fe99e63dfd3e5a0bd9a04bb3` — confirm with `git rev-parse origin/cursor/hmrc-content-automation-df9b` before deploy |

Checks were re-run on this tip after stamping. Content/demos landed in `a75deacccaee0e17d31d61e34ac91a0afb61c0d9`; this tip adds the SHA stamp only.

Alias note: `feature/hmrc-content-automation` is kept **fast-forward identical** to the forge branch for historical naming only. **Use only `cursor/hmrc-content-automation-df9b` + PR #33.**

### Why two SHAs appeared earlier (resolved)

| SHA | Role |
|---|---|
| `540a1e03568aebc472dc8841ed4635b80a26391d` | First implementation commit (automation code). Early handover referred to this while later **docs-only** commits moved the tip. |
| Tip after docs commits | Contained the same code as `540a1e0` plus handover markdown. That split was confusing. |

**This handover:** one branch, one PR, one tip SHA that has had **all applicable checks re-run** after demos + docs updates. Treat that tip as the only deploy candidate.

---

## 2. UAT-approved application release — integration blocker

| Release | Tip inspected |
|---|---|
| Latest UAT-approved app baseline | `toxel-uat-approved` @ `b0853bc1b4107789ea4df299bfc3815c1adcb43d` (per `START_HERE_TOXEL.md`) |

**Findings**

- `toxel-uat-approved` is **not** an ancestor of this content-automation tip.
- It has **no** `tax_simba_frontend/src/data/articles.js` / 120-article registry (only legacy `staticBlogs.js`).
- This candidate preserves **120 articles, artwork, URLs, first-20 order** from `cursor/taxsimba-v6-integration-df9b`.
- A trial merge-tree against UAT shows **many “changed in both” paths** across frontend/backend (~318-file delta surface).

### Blocker for Toxel (must not ignore)

**This PR tip does not contain the UAT-approved application fixes, and the UAT tip does not contain the 120-article system.**  
Combining both requires a **separate, deliberate integration merge** (UAT app line ↔ content/V6 line) before production automation can sit on the same SHA as the UAT app suite.

**Do not** treat PR #33 alone as a full app+content production release until that merge is planned and verified.

What PR #33 *does* deliver: content automation on the **article/V6** line, safe to stage for content automation testing without claiming UAT app parity.

---

## 3. Demo outputs (existing template)

Fixture-mode pipeline demos (same template fields as live guides: title, meta, sources, CTA, artwork fallback, immediate answer, steps, GOV.UK links):

| Demo | Path | Result |
|---|---|---|
| **New article** | `docs/content-automation/demos/new-article.json` (+ `.preview.html`) | slug `national-insurance-for-the-self-employed-what-to-check-this-tax-year`, stage `public_verified`, `isUpdate: false` |
| **Updated guide** | `docs/content-automation/demos/updated-guide.json` (+ `.preview.html`) | slug `hmrc-signed-me-up-for-making-tax-digital`, stage `public_verified`, `isUpdate: true`, **`publishedAt` preserved** `2026-09-14T14:00:00.000Z` |

These prove the **pipeline + template shape**. They are **fixture tests**, not real generation-API / live GOV.UK / production publish proof.

---

## 4. Configuration — fixture vs real end-to-end

### 4a. Fixture / CI tests (what Cursor ran)

| Variable | Value for fixture |
|---|---|
| `CONTENT_AUTOMATION_FIXTURE_MODE` | `true` |
| `CONTENT_AUTOMATION_ENABLED` | `true` (for worker/tests) |
| `CONTENT_AUTOMATION_PAUSED` | `false` |
| `CONTENT_AUTOMATION_GENERATION_API_KEY` | **unset** (deterministic fixture drafts) |
| `MONGO_URL` | test / memory Mongo |

Commands:

```bash
cd backend-node
CONTENT_AUTOMATION_FIXTURE_MODE=true CONTENT_AUTOMATION_ENABLED=true \
  npm test -- tests/unit/content-automation/pipeline.test.ts
npx ts-node --transpile-only scripts/export-content-automation-demos.ts
```

### 4b. Real staging / production (Toxel must configure)

**Secret / config NAMES only — set values in DigitalOcean; never commit values.**

| Name | Purpose |
|---|---|
| `MONGO_URL` | Durable job/revision/live overlay storage |
| `CONTENT_AUTOMATION_ENABLED` | `true` on **one** API instance to arm 08:00 Europe/London |
| `CONTENT_AUTOMATION_PAUSED` | `true` to pause without redeploy |
| `CONTENT_AUTOMATION_FIXTURE_MODE` | **`false`** for real runs |
| `CONTENT_AUTOMATION_PUBLIC_BASE_URL` | Public site origin (e.g. staging/production URL) |
| `CONTENT_AUTOMATION_GENERATION_API_KEY` | Server-side text generation API key |
| `CONTENT_AUTOMATION_GENERATION_API_BASE` | e.g. `https://api.openai.com/v1` |
| `CONTENT_AUTOMATION_GENERATION_MODEL` | e.g. `gpt-4.1-mini` |
| `CONTENT_AUTOMATION_IMAGE_API_KEY` | Optional image API (else approved artwork fallbacks) |
| `CONTENT_AUTOMATION_IMAGE_API_BASE` | Optional image API base |
| `CONTENT_AUTOMATION_ALERT_WEBHOOK_URL` | Ops alert webhook |
| `CONTENT_AUTOMATION_DAILY_JOB_LIMIT` | Bound jobs/day (default 5) |
| `CONTENT_AUTOMATION_API_BUDGET` | Bound GOV.UK/API units/day (default 40) |
| `NEXT_PUBLIC_API_URL` | Frontend → API that serves `/api/resources/blogs` overlays |

**DigitalOcean scheduling**

- Preferred: in-process worker in `backend-node` (`startContentAutomationWorker`) when `CONTENT_AUTOMATION_ENABLED=true` → **08:00 Europe/London** (DST-aware).
- Optional safety cron: `.do/app-content-automation.yaml` (`15 8 * * *` Europe/London) calling `POST /api/content-automation/run-now` as SUPER_ADMIN if the timer fails.
- Run automation on **one** instance only.

**Publishing path (real)**

1. Worker validates → writes Mongo live overlay  
2. `GET /api/resources/blogs` + `GET /api/resources/blogs/:slug` serve overlays  
3. Frontend `mergeArticlesWithApi` / `getBlogBySlug` apply overlays onto the **existing** template  
4. Updates preserve original `publishedAt` / listing rank; new slugs appear without GitHub merge  

**Alerts**

- Webhook via `CONTENT_AUTOMATION_ALERT_WEBHOOK_URL`  
- Codes include `missing_scheduler`, `automation_paused`, `api_budget`, `run_failed`, `tick_failure`  
- Status: `GET /api/content-automation/status`  

**Pause / rollback / backup**

```text
Pause:     CONTENT_AUTOMATION_PAUSED=true
Rollback:  POST /api/content-automation/rollback/:slug  (SUPER_ADMIN)
Backup:    GET  /api/content-automation/backup
Restore:   POST /api/content-automation/backup/restore
```

### 4c. What is still Toxel’s real E2E (not claimed passed here)

| Test | Cursor status |
|---|---|
| Live GOV.UK Content API fetch with fixture mode off | **Untested here** |
| Live generation API draft | **Untested here** |
| Overlay visible on staging `/blogs/[slug]` after publish | **Toxel staging** |
| DO 08:00 schedule without Cursor open | **Toxel** |
| First production scheduled run | **Toxel after enablement** |
| Combined tip with `toxel-uat-approved` app fixes | **Blocked** (see §2) |

---

## 5. Checks re-run on the final tip

Recorded in the final PR update after this document lands. Required suite:

```bash
# Backend
cd backend-node && npm run typecheck
CONTENT_AUTOMATION_FIXTURE_MODE=true CONTENT_AUTOMATION_ENABLED=true \
  npm test -- tests/unit/content-automation/pipeline.test.ts

# Frontend article baseline
cd tax_simba_frontend
npm run verify:quality-v4
npm run verify:review-v5
npm run verify:landlord-hub-v6
npm run verify:premium
npm run build
```

Preserve expectations: **120** unique articles, **first-20** = `PRIORITY_ARTICLE_SLUGS`, artwork library untouched.

---

## 6. Enablement sequence (Toxel)

1. Confirm tip SHA on `cursor/hmrc-content-automation-df9b` / PR #33.  
2. Deploy API + frontend from **that tip** to **staging** (knowing UAT-app parity is a separate merge — §2).  
3. Set real secrets (§4b); `CONTENT_AUTOMATION_FIXTURE_MODE=false`.  
4. SUPER_ADMIN: `POST /api/content-automation/demo/new-article` and `.../demo/update-article` **with real keys** on staging; confirm public pages.  
5. Set `CONTENT_AUTOMATION_ENABLED=true` on one API instance; confirm log “armed for next 08:00 Europe/London”.  
6. Only after staging real E2E: production deploy of the **same SHA**, enable, verify first scheduled run.  
7. Keep `CONTENT_AUTOMATION_PAUSED` ready.

**Deploy only this tested candidate SHA after Toxel verification.**
