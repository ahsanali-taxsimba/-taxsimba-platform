# Task 8 — J-005 safe message HTML retest checklist

**Status:** LOCAL PASS  
**Branch:** `cursor/toxsl-blockers-b01-b04-80a7`  
**Tested tip (full SHA):** `a89c83fcc48bdb6f4d0d7654a3d28225c8f31994`  
**Fix commits:** `f956e8d` (sanitize + SafeMessageBody), `a89c83f` (double-escape guard)  
**Evidence ZIP:** `/opt/cursor/artifacts/task8_j005_safe_message_html.zip`  
**J-011:** UNVERIFIED  
**Staging / external inbox:** BLOCKED  
**Final Toxel handoff SHA:** deferred  

## Carry-forward

- Tasks 1–7 intact  
- Task 7 specific-notification read-persistence: **outstanding**  
- Staging / external inbox: **BLOCKED**  
- J-011: **UNVERIFIED**

## Pack criteria (J-005)

Original UAT pack ID **J-005** was not found in-repo. Criteria from Task 8 prompt + observed raw HTML defect (`<p>dfgd<p>`).

| # | Check | Local | Evidence |
|---|---|---|---|
| 1 | Confirm criteria (pack absent → prompt) | PASS | `before/criteria.json` |
| 2 | Reproduce raw HTML as text | PASS | `before/j005_BEFORE_raw_html_as_text.png` |
| 3 | SA ChatBox readable (no raw `<p>`) | PASS | `after/02_sa_chatbox_messages.png` + analysis |
| 4 | SA refresh / re-login | PASS | `after/03_*.png`, `after/04_*.png` |
| 5 | MTD Tax Return Chat readable | PASS | `after/05_mtd_messages.png` + analysis |
| 6 | Admin manage-tax Communication History | PASS | `after/06_admin_manage_tax_messages.png` + analysis |
| 7 | Malformed markup `<p>dfgd<p>` | PASS | Vitest + UI shows `dfgd` |
| 8 | Script / onerror / javascript: must not execute | PASS | XSS flags null in analyses |
| 9 | Newly created messages | PASS | `api/fresh_message_posts.json` + UI |
| 10 | Client isolation (other case) | PASS | `api/isolation_recheck.json` status **403** |
| 11 | Unit tests | PASS | 10/10 exit 0 |
| 12 | Client + admin FE builds | PASS | both exit 0 |

## Commands (retest)

```bash
cd /workspace/backend-node && npx vitest run tests/unit/sanitizeMessageHtml.test.ts
cd /workspace/tax_simba_frontend && npm run build
cd /workspace/tax_simba_admin_frontend && npm run build
cd /workspace/backend-node && node scripts/t8J005BrowserEvidence.mjs
```

## Root cause (one line)

Compat stores admin `htmlContent` as message `body`; FE rendered it as React text → tags visible; fixed with allowlisted sanitize + `SafeMessageBody` (not unrestricted HTML).
