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

- Floating **Ask SIMBA** button bottom-right  
- Opens **only** on user click (never auto-popup)  
- Escape closes the panel and returns focus to the button  
- Mobile: panel uses safe widths; does not replace site nav  

## Local preview

```bash
cd ai-tax-concierge-v2/backend && source .venv/bin/activate
export CONCIERGE_FORCE_MOCK_LLM=false   # only if OPENAI_API_KEY is set
uvicorn app.main:app --host 127.0.0.1 --port 8090
```

Open http://127.0.0.1:8090/widget/preview.html

## Do not

- Deploy to live taxsimba.co.uk without approval  
- Point the widget at production Stripe/Calendly until staging E2E passes  
- Claim bookings/payments from chat alone  
