# LeadInbox

Standalone lead database for **Outlook**, **Business WhatsApp**, and **website forms**.

## What it does

- Stores every inbound enquiry in one Postgres database (PGlite locally)
- Webhook endpoints for Outlook / Power Automate, Meta WhatsApp Cloud API, and website forms
- Dashboard to search, filter, update pipeline status, and add notes
- Private Cursor sign-in (no custom auth) when published as private/team

## Local development

```bash
cd lead-inbox
npm install
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Sample leads load automatically.

## Secrets (published app)

| Secret | Used for |
| --- | --- |
| `FORM_WEBHOOK_SECRET` | Website form webhook header `x-webhook-secret` |
| `OUTLOOK_WEBHOOK_SECRET` | Outlook / Power Automate webhook |
| `WHATSAPP_VERIFY_TOKEN` | Meta webhook verification |
| `WHATSAPP_APP_SECRET` | Meta `X-Hub-Signature-256` validation |

Enable each connection in **Connections** to get a private webhook URL (`?token=…`).

## Website form example

```bash
curl -X POST "$WEBHOOK_URL" \
  -H "content-type: application/json" \
  -H "x-webhook-secret: $FORM_WEBHOOK_SECRET" \
  -d '{"name":"Alex","email":"alex@firm.com","message":"Need a quote"}'
```
