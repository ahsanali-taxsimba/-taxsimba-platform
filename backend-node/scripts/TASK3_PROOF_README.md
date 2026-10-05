# Task 3 email branding — local Mailpit proof scripts

Reusable proof helpers for Toxsl J-003 / J-004 / J-006. Generated screenshots and
email HTML belong under `/opt/cursor/artifacts/task3-local` (or `TASK3_ARTIFACT_DIR`)
and must **not** be committed.

## Prerequisites

- MongoDB, Mailpit (`:1025` / `:8025`)
- Frontend production build on `http://127.0.0.1:3000`
- Backend production build on `http://127.0.0.1:8002` with SMTP → Mailpit
- Local-only: `EMAIL_ALLOW_LOCAL_BASE_URL=true` (hard-ignored on Render / staging / production)

## Commands (from `backend-node`)

```bash
export TASK3_ARTIFACT_DIR=/opt/cursor/artifacts/task3-local
export TASK3_SHA=$(git rev-parse HEAD)
export EMAIL_ALLOW_LOCAL_BASE_URL=true
export APP_BASE_URL=http://127.0.0.1:3000
export ADMIN_BASE_URL=http://127.0.0.1:3001

npx tsx scripts/task3SeedEntitled.ts
npx tsx scripts/task3FixEngagement.ts   # optional if seed already wrote engagement
npx tsx scripts/task3QueueDocEmails.ts
npx tsx scripts/task3EntitledCtaProof.ts
npx tsx scripts/task3LocalMailpitProof.ts
```

Ephemeral local credentials are written only to `$TASK3_ARTIFACT_DIR/entitled_seed.json`
(outside git). Override with `TASK3_PROOF_EMAIL` / `TASK3_PROOF_PASSWORD` if needed.

## What each script proves

| Script | Proof |
|--------|--------|
| `task3SeedEntitled.ts` | Entitled SA client + outstanding document request + case-scoped email CTAs |
| `task3QueueDocEmails.ts` | Document / review / purchase / admin review messages into Mailpit |
| `task3EntitledCtaProof.ts` | After CTA login, **correct document/case** is visible (not only dashboard open) |
| `task3LocalMailpitProof.ts` | Verify/reset journeys, legal content, logo, staging local-allow guard, admin rewrite |
| `task3FixEngagement.ts` | Repair engagement acceptance for a seeded client |

## Staging / Outlook-Gmail

These scripts do **not** constitute Outlook/Gmail or staging deploy proof. See
`docs/STAGING_EMAIL_DEPLOY_RUNBOOK.md`.
