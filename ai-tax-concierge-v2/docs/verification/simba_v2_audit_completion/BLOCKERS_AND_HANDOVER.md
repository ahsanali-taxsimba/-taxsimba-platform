# Consolidated external-access blockers (single handover)

| # | Blocker | Needed from | Why blocked | Exact ask |
|---|---------|-------------|-------------|-----------|
| 1 | Staging HTTPS URL + embed origin | Toxel | Cannot prove CORS, embed, mobile/desktop, handoff in real browsers | Staging URL + allowed origins list |
| 2 | Staging `OPENAI_API_KEY` confirmation | Toxel | Agent env PASS ≠ staging | Confirm staging env + health `llm_mode=openai` |
| 3 | `CONCIERGE_OPS_TOKEN` + monitor enabled | Toxel | HMRC cycle not run | Enable monitor; run ops cycle; retain logs |
| 4 | SMTP credentials | Toxel | Lead email E2E | Staging SMTP; send one test to controlled inbox |
| 5 | Calendly + payment + Meet | Business / Toxel | Live booking not authorised | Approved URLs + `CONSULTATION_BOOKING_LIVE=true` when ready |
| 6 | Portal test accounts | Toxel | Registration/checkout/dashboard | Controlled accounts; no live customer charges |
| 7 | Tax answer sign-off | Asim | 400 pack has no answer key | Review recorded replies + criteria |
| 8 | Deploy / rollback approval | Toxel | Production HOLD | Approve staging deploy of completion branch |
| 9 | Durable leads for multi-node | Toxel / architecture | FS store not shared | Approve shared volume or DB; migrate without dropping data |

No credentials were invented. No production settings were changed.
