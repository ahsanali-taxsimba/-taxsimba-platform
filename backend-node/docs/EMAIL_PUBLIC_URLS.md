# Email public URLs (Toxsl J-003 / J-004 / J-006)

Transactional emails require a **public HTTPS** client origin. Outlook and Gmail cannot
fetch `localhost`, `127.0.0.1`, or RFC1918 hosts — that produced Toxsl’s blank header logo
and unusable Privacy / Terms / Contact links.

## Required environment (staging / production)

| Variable | Required | Example (non-secret) | Notes |
|----------|----------|----------------------|-------|
| `APP_BASE_URL` | **Yes** | `https://taxsimba.co.uk` or staging client HTTPS origin | No path. Must be HTTPS. Never private IP. Used for CTAs and default logo. |
| `ADMIN_BASE_URL` | Recommended | `https://admin.example.com` | Used for `/admin/…` CTAs. Public HTTPS. |
| `EMAIL_LOGO_URL` | Optional | `https://taxsimba.co.uk/images/email-logo.png` | Defaults to `{APP_BASE_URL}/images/email-logo.png`. Must be HTTPS PNG. |
| `EMAIL_LEGAL_BASE_URL` | Optional | `https://taxsimba.co.uk` | Privacy/Terms/Contact origin when legal pages differ from the app origin. Defaults to `APP_BASE_URL`. |
| `EMAIL_ALLOW_LOCAL_BASE_URL` | Local only | `true` | Permits `http://127.0.0.1` APP_BASE_URL for Mailpit / production-build proof. **Hard-ignored** on staging/production (Render / `APP_ENV=staging|production` / other PaaS markers) even if accidentally set. |
| `EMAIL_DRIVER` | Yes | `smtp` or `resend` | `none` disables delivery. |
| `EMAIL_FROM` | Yes when sending | `TaxSimba <no-reply@…>` | — |

Do **not** set `APP_BASE_URL` to a LAN address (e.g. `http://192.168.0.197:3000`). The renderer
rejects private hosts. Invalid URL config persists a **FAILED** `email_messages` row with
`last_error` prefixed `EMAIL_PUBLIC_URL_CONFIG:` — mail is **not** silently discarded.

`EMAIL_ALLOW_LOCAL_BASE_URL=true` is for **local Mailpit proof only**. On Render (or when
`APP_ENV` / `DEPLOY_ENV` is `staging` / `production` / `uat`), the flag is ignored even if
set — private email URLs cannot be enabled by accident.

## Logo asset

Use `/images/email-logo.png` (white mark). Site `/images/logo.png` is brand-green and is
invisible on the `#37a267` email header in Outlook (J-003).

## Deploy / restart

1. Set `APP_BASE_URL` (and optionally `EMAIL_LOGO_URL` / `EMAIL_LEGAL_BASE_URL`) on the API / worker environment.
2. Ensure `public/images/email-logo.png` is deployed on the client origin referenced by the logo URL (HTTP 200 PNG over HTTPS).
3. Restart the Node API process and any reminder/email worker (`REMINDERS_ENABLED` instance).
4. Trigger a **new** email — previously queued/sent HTML is not rewritten.
5. Open the message in Outlook (and Gmail) and verify logo + every CTA + legal links.
6. Query `email_messages` for `status: "FAILED"` / `EMAIL_PUBLIC_URL_CONFIG` if sends look missing.

## Final URL patterns (when `APP_BASE_URL=https://taxsimba.co.uk`)

- Logo: `https://taxsimba.co.uk/images/email-logo.png`
- CTA: `{APP_BASE_URL}` + path (e.g. `/dashboard`, `/verify-email?token=…`)
- Privacy: `{EMAIL_LEGAL_BASE_URL or APP_BASE_URL}/privacy-policy`
- Terms: `{EMAIL_LEGAL_BASE_URL or APP_BASE_URL}/terms-and-conditions`
- Contact: `{EMAIL_LEGAL_BASE_URL or APP_BASE_URL}/contact-us`

## Staging note (`render.yaml`)

Blueprint staging client: `https://taxsimba-staging-web.onrender.com` with `EMAIL_DRIVER=none`.
Real Outlook/Gmail delivery requires enabling SMTP/Resend on that environment and deploying
`email-logo.png` to the client origin. If legal pages should stay on production marketing,
set `EMAIL_LEGAL_BASE_URL=https://taxsimba.co.uk`.
