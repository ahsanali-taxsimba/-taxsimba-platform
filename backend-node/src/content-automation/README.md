# TaxSimba HMRC content automation

Runs inside `backend-node`. Reuses the existing 120-article registry and `/blogs` template.

## Pipeline

`detected → researched → mapped → drafted → validated → published → public_verified`

## Daily schedule

When `CONTENT_AUTOMATION_ENABLED=true`, the worker arms for **08:00 Europe/London** (DST-aware).

## Local / staging demos

```bash
CONTENT_AUTOMATION_FIXTURE_MODE=true CONTENT_AUTOMATION_ENABLED=true \
  npm test -- tests/unit/content-automation/pipeline.test.ts
```

SUPER_ADMIN HTTP demos:

- `POST /api/content-automation/demo/new-article`
- `POST /api/content-automation/demo/update-article`
- `POST /api/content-automation/rehearse-daily`
- `GET /api/content-automation/backup`

Public overlays: `GET /api/resources/blogs` and `GET /api/resources/blogs/:slug`.

See `docs/content-automation/TOXEL_HMRC_CONTENT_AUTOMATION_HANDOVER.md`.
