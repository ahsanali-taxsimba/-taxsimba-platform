# SIMBA AI — Embedding guide (Toxel)

## Brand (do not invent alternatives)

Tokens taken from TaxSimba `design_guidelines.json` and confirmed against taxsimba.co.uk CSS (`#006B3C`):

| Token | Value |
|-------|-------|
| Primary | `#006B3C` |
| Primary action | `#078A4B` |
| Soft background | `#F1F8F4` / nav selected `#EAF5EE` |
| Surface | `#FFFFFF` |
| Text | `#161B18` / secondary `#626A65` |
| Border | `#E3E7E4` |
| Heading font | Manrope |
| Body font | Public Sans |
| Logo | `/widget/assets/taxsimba-logo.svg` (official taxsimba.co.uk asset) |

No lions, mascots, gold accent scheme, or decorative bouncing animations.

## Install (staging)

```html
<script
  src="https://STAGING_HOST/widget/embed.js"
  data-api-base="https://STAGING_HOST"
  defer
></script>
```

Behaviour:

- Floating premium **Ask SIMBA / AI Tax Assistant** button (bottom-right by default)  
- Session welcome card (“Need help with your tax?”) — once per visitor session; dismissible; launcher stays available  
- Opens compact chat (`/widget/chat.html`) **only** on user click (never auto-popup)  
- Compact chat quick actions: Self Assessment · Making Tax Digital · Choose the right package · Book a £99 accountant consultation · Ask a tax question  
- Expand control opens the full SIMBA workspace (`/widget/index.html`) — do not remove it  
- Escape closes the panel and returns focus to the button  
- Mobile: fullscreen drawer when open; host page clicks pass through empty overlay space (`pointer-events`)  
- No unread badges, lions, or mascots

## Local preview (Node — preferred)

```bash
cd ai-tax-concierge-v2/backend-node
npm ci && npm run build
export CONCIERGE_FORCE_MOCK_LLM=false   # only if OPENAI_API_KEY is set
PORT=8091 npm start
```

Open http://127.0.0.1:8091/widget/preview.html

Python reference (optional dual-run): `uvicorn` on `:8090` under `ai-tax-concierge-v2/backend/`.

## Do not

- Deploy to live taxsimba.co.uk without approval  
- Point the widget at production Stripe/Calendly until staging E2E passes  
- Claim bookings/payments from chat alone  
