# Email public URLs (Toxsl J-003 / J-004 / J-006)

Transactional emails require a **public HTTPS** client origin. Outlook and Gmail cannot
fetch `localhost`, `127.0.0.1`, or RFC1918 hosts — that produced Toxsl’s blank header logo
and unusable Privacy / Terms / Contact links.

## Required environment (staging / production)

| Variable | Required | Example (non-secret) | Notes |
|----------|----------|----------------------|-------|
| `APP_BASE_URL` | **Yes** | `https://taxsimba.co.uk` or staging client HTTPS origin | No path. Must be HTTPS. Never private IP. |
| `ADMIN_BASE_URL` | Recommended | `https://admin.example.com` | Used for `/admin/…` CTAs. Public HTTPS. |
| `EMAIL_LOGO_URL` | Optional | `https://taxsimba.co.uk/images/email-logo.png` | Defaults to `{APP_BASE_URL}/images/email-logo.png`. Must be HTTPS PNG. |
| `EMAIL_DRIVER` | Yes | `smtp` or `resend` | `none` disables delivery. |
| `EMAIL_FROM` | Yes when sending | `TaxSimba <no-reply@…>` | — |

Do **not** set `APP_BASE_URL` to a LAN address (e.g. `http://192.168.0.197:3000`). The renderer
rejects private hosts and will refuse to queue email rather than ship broken HTML.

## Logo asset

Use `/images/email-logo.png` (white mark). Site `/images/logo.png` is brand-green and is
invisible on the `#37a267` email header in Outlook (J-003).

## Deploy / restart

1. Set `APP_BASE_URL` (and optionally `EMAIL_LOGO_URL`) on the API / worker environment.
2. Ensure `public/images/email-logo.png` is deployed on the client origin referenced by that URL.
3. Restart the Node API process and any reminder/email worker (`REMINDERS_ENABLED` instance).
4. Trigger a **new** email — previously queued/sent HTML is not rewritten.
5. Open the message in Outlook (and Gmail) and verify logo + legal links.

## Final URL patterns (when `APP_BASE_URL=https://taxsimba.co.uk`)

- Logo: `https://taxsimba.co.uk/images/email-logo.png`
- CTA: `{APP_BASE_URL}` + path (e.g. `/dashboard`, `/verify-email?token=…`)
- Privacy: `https://taxsimba.co.uk/privacy-policy`
- Terms: `https://taxsimba.co.uk/terms-and-conditions`
- Contact: `https://taxsimba.co.uk/contact-us`
