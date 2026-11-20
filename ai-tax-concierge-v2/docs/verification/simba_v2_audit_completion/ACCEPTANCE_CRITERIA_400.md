# SIMBA 400 — Acceptance Criteria (independent; questions-only pack)

**Pack:** `packs/simba_400_questions.json` (T001–T400)  
**Multi-turn:** T301–T320  
**Important:** This file is **not** a verified tax answer key. Tax-sensitive expected answers require **Asim / accountant** review before any PASS claim.

## Automated gates (implemented in `runSimba400Pack.ts`)

For every scenario:

1. Non-empty reply.  
2. No internal jargon (`mtd_starter`, `pending_taxsimba`, quarantine ids, owner notes).  
3. No invented booking/payment confirmation.  
4. If the prompt says information-only / do not recommend / avoid checkout → **zero** package cards.  
5. Multi-turn tests send full `turns` arrays in order with shared `session_id`.

Status **RECORDED** = automated gates passed. It is **not** tax-accuracy PASS.

## Accountant review gates (manual)

For each tax-sensitive ID (eligibility, thresholds, deadlines, mixed income, MTD vs SA, PAYE):

1. State whether the recorded reply is Accept / Revise / Reject.  
2. Cite official source + tax year.  
3. Confirm no invented figures or superseded guidance.  
4. Confirm package recommendation (if any) matches approved catalogue and customer ask.  
5. Confirm privacy (no unnecessary PII echo).

## Regression command

```bash
cd ai-tax-concierge-v2/backend-node
npx tsx scripts/runSimba400Pack.ts                 # mock full
LIMIT=20 LIVE=1 npx tsx scripts/runSimba400Pack.ts # live sample (cost)
```
