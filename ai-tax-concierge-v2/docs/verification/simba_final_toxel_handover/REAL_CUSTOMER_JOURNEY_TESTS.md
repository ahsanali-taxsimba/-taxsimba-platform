# Real Customer Journey Tests

| Journey | Automated | Live E2E | Status |
|---------|-----------|----------|--------|
| First-time SA | journeys + package tests | BLOCKED | PASS automated |
| Multiple incomes / SE / landlord / CIS / employed+SE | tax_intelligence + journeys | BLOCKED | PASS automated |
| MTD eligible / voluntary | knowledge + recommendations | BLOCKED | PASS automated |
| Both SA+MTD | recommendations | BLOCKED | PASS automated |
| Existing customer recognition | conversation tests | BLOCKED portal | PARTIAL |
| Late filer / complex / challenge / future rules / insufficient info | conversation + helpful tests | BLOCKED | PASS automated |
| Refunds questions | content rules | BLOCKED legal quote | PARTIAL — no invented policy |
| Registration / checkout / consult booking | — | BLOCKED | Needs Toxel |
| Desktop/mobile widget | screenshots + a11y tests | — | PASS evidence in `screenshots/` |

Do not treat mock/link-open as completed Stripe/Calendly/portal E2E.
