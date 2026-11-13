# SIMBA AI — Live OpenAI verification evidence

**Date:** 2026-11-13 (Europe/London)  
**Branch / PR:** `cursor/ai-tax-concierge-v2-phase1-0f84` / #35  
**Isolation:** `ai-tax-concierge-v2/` only — portal / taxotools / Marketing Hub untouched  

## 1. Secret availability check (no value exposed)

| Check | Result |
|-------|--------|
| `os.environ["OPENAI_API_KEY"]` present | **False** |
| Key length | **0** |
| `Settings().openai_api_key` present | **False** |
| `Settings().use_mock_llm` | **True** |
| `list-available-secrets` for `ai-tax-concierge-v2` | No secret values held / available to this VM |
| Process env names containing OPENAI/API_KEY/SECRET | **None** |

**Conclusion:** The running Cloud Agent session does **not** have `OPENAI_API_KEY` injected. Live OpenAI calls were **not** made.

Likely configuration causes:
1. Secret saved in a different Cursor surface than this environment’s runtime secrets (e.g. App Secrets for publish vs Cloud Agent environment secrets).
2. Secret saved after this agent booted — Cloud Agent env vars are typically injected at session start; a relaunch may be required.
3. Secret name mismatch (must be exactly `OPENAI_API_KEY`).

## 2. OpenAI adapter configuration (code inspection)

| Item | Value |
|------|-------|
| Client | `openai.AsyncOpenAI` |
| Default API base | `https://api.openai.com/v1` |
| Call | `chat.completions.create` |
| Default model | `gpt-4o-mini` (`OPENAI_MODEL`) |
| Timeout | `OPENAI_TIMEOUT_SECONDS` (default 30) |
| Retries | 2 |
| Daily token budget | 250,000 |
| Mock selection | Forced when key empty or `CONCIERGE_FORCE_MOCK_LLM=true` |

Source: `backend/app/adapters/llm_openai.py`, `backend/app/adapters/factory.py`, `backend/app/core/config.py`.

## 3. Live connectivity / 30+ conversation tests

| Item | Result |
|------|--------|
| Live connectivity ping | **NOT RUN** (blocked) |
| 30+ live UK tax questions | **NOT RUN** (blocked) |
| Multi-turn live conversations | **NOT RUN** (blocked) |
| Journey / package / £99 pathway under live LLM | **NOT RUN** (blocked) |
| Mock substituted as live? | **No** — harness refused to proceed |

Harness: `backend/scripts/live_openai_verification.py`  
Machine report: `docs/verification/live_openai_report_latest.json` (status `BLOCKED`)

The harness is ready to execute **genuine** OpenAI calls once `OPENAI_API_KEY` is present. It exits code `2` when the key is missing and will not call the mock adapter as a substitute.

## 4. Automated regression (mock)

Command: `pytest -q` in `ai-tax-concierge-v2/backend`

| Result | Count |
|--------|-------|
| Passed | **175** |
| Failed | **0** |

These are **mock / unit / integration** tests. They are **not** proof of live OpenAI behaviour.

## 5. Distinction summary

| Evidence class | Status |
|----------------|--------|
| Mock automated suite | Pass (175) |
| Live OpenAI connectivity | Blocked |
| Live 30+ tax conversations | Blocked |
| Live tax-source accountant review pack | Blocked pending live answers |

## 6. Unresolved blockers

1. **High:** Inject `OPENAI_API_KEY` into this Cloud Agent environment and relaunch/continue so `os.environ` contains it.
2. After injection: rerun `python scripts/live_openai_verification.py` and attach the completed JSON report.
3. Human accountant review of material live answers still required before production.

## 7. Approval wait

Stopped here per instructions. No merge. No deploy. No mock results labelled as live.
