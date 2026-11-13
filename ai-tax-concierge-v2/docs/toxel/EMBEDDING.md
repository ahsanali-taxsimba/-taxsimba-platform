# SIMBA AI — Widget embedding guide

## Minimal embed (does not restyle host site)

```html
<script
  src="https://SIMBA_HOST/widget/embed.js"
  data-api-base="https://SIMBA_HOST"></script>
```

Adds a compact floating **Ask SIMBA** launcher and iframe panel only.

## Full panel

Open `https://SIMBA_HOST/widget/index.html`

## Brand notes

- Customer name: **SIMBA AI**
- Subtitle: **Your UK Tax Assistant**
- Colours: deep emerald `#0B3D2E`, white, gold `#C6A75E`
- Emblem: `/widget/assets/simba-emblem.svg` is a **temporary placeholder** — replace with approved TaxSimba asset before production
- Welcome: “Hello, I’m Simba, TaxSimba’s AI assistant…”
- AI disclosure shown in UI

## Mobile

- Responsive panel; safe-area padding for composer
- Host page styles are not overridden beyond launcher CSS scoped to `#simba-*` IDs
