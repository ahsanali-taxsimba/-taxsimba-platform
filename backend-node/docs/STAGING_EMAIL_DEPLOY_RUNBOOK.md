# Staging email branding deploy runbook (Task 3)

Authorized staging blueprint hosts from `render.yaml` currently return HTTP 404 and
`EMAIL_DRIVER=none`. This agent has **no** Render/Vercel/Fly credentials and **no**
GitHub Actions deploy workflows in-repo. Deployment status: **BLOCKED**.

## Missing access
- Render dashboard API token / deploy rights for `taxsimba-staging-api` and `taxsimba-staging-web`
- OR alternative authorized staging hostnames + deploy pipeline credentials
- Staging SMTP or Resend credentials (not production)

## Exact deploy steps when access exists
1. Deploy **this branch** frontend (`tax_simba_frontend`) so `/images/email-logo.png` is HTTPS 200 PNG.
2. Deploy **this branch** backend (`backend-node`) with:
   - `APP_BASE_URL=https://<staging-client-origin>`
   - `ADMIN_BASE_URL=https://<staging-admin-origin>`
   - `EMAIL_LEGAL_BASE_URL=https://taxsimba.co.uk` (if legal pages stay on marketing)
   - `EMAIL_ALLOW_LOCAL_BASE_URL` **unset/false**
   - `EMAIL_DRIVER=smtp` or `resend` + matching secrets
   - `EMAIL_FROM` verified sender
3. Enable reminders on exactly one instance if needed (`REMINDERS_ENABLED=true`).
4. Restart API/worker. Confirm health + logo URL HTTP 200.
5. Trigger new verification email; open in Outlook + Gmail; click every CTA and footer link.
6. Confirm deployed SHA matches branch tip.
