# Visual & recording evidence index

**Timezone note:** file timestamps on the agent VM are UTC; user zone Europe/London (UTC+0 on 2026-11-18).

## Screenshots (real application — not mockups)

| # | File | Shows |
|---|------|-------|
| 1 | `screenshots/01_preview_ask_simba_launcher.webp` | Ask SIMBA launcher |
| 2 | `screenshots/02_workspace_welcome.webp` | Workspace welcome |
| 3 | `screenshots/03_live_openai_qa_prices_mtd.webp` | Live Q&A / prices / MTD |
| 4 | `screenshots/04_ask_simba_launcher_welcome.webp` | Launcher + welcome |
| 5 | `screenshots/05_workspace_live_ai_welcome.webp` | Live AI welcome / Digital Tax Assistant |
| 6 | `screenshots/06_compact_chat_header.webp` | Compact chat header / branding |
| 7 | `screenshots/07_mobile_width_chat.webp` | Mobile-width layout |
| 8 | `screenshots/08_consultations_99_149.webp` | Consultation £99/20 + £149/40 |
| — | `screenshots/live_chat_evidence.html` | Static HTML evidence page used for browser Q&A capture |

Mirrored under `/opt/cursor/artifacts/` as `simba_*.webp`.

## Screen recordings

| Journey requested | Status | Artefact |
|-------------------|--------|----------|
| 1 Tax Q → details → package | **Partial** — Q&A screenshots + live API transcripts; interactive widget typing flaky in VM | Screenshots 03/05 + `live_openai_journeys_20.json` |
| 2 MTD eligibility | **Verified via API + UI copy** | Live MTD 8/8 + screenshot 03 |
| 3 Paid consultation explanation | **Recorded** | `recordings/simba_consultation_evidence_journey.mp4` (+ `/opt/cursor/artifacts/simba_consultation_evidence_journey.mp4`) |
| 4 Mobile keyboard / scroll | **BLOCKED** on physical iPhone Safari | Code present; mobile-width screenshot only — **Toxel staging acceptance** |

## Full transcripts (≥20)

| Set | Count | Source | Path |
|-----|------:|--------|------|
| Live OpenAI multi-turn journeys | 20 | Real OpenAI API | `evidence/live_openai_journeys_20.json` |
| Ambiguous intents | 10 | Real OpenAI adapter + deterministic short-circuits | `evidence/ambiguous_intent_live.json` |
| HTTP chat demo | multi-turn | Real OpenAI API over HTTP | `evidence/live_api_chat_demo.json` |
| Master multiturn | 50 | Mock/deterministic | `transcripts/multiturn_50.json` |
| Master single-turn verbatim | 537 | Mock/deterministic | `transcripts/single_turn_verbatim.md` |

Never present mock suite answers as live OpenAI output — check `obtained_via` / `llm_mode` on each artefact.
