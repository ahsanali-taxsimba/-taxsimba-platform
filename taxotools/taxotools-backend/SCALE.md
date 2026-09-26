# Scale Fly machines without duplicate crawls

Yes — you can run **2–4 machines**. With the claim system, each firm is locked to one worker (`FOR UPDATE SKIP LOCKED`), so machines do **not** crawl the same company at the same time.

## How it works

1. Machine A claims firm `example.co.uk` → status `running`, `claimed_by = machine-A`
2. Machine B skips that firm and claims the next free one
3. If a machine dies, the lease expires (~30 min) and another machine can take it

## Setup

### 1) Apply DB claim function (once)

From `taxotools-backend`:

```bash
npm run db:apply
```

(Or run `supabase-schema-claims.sql` in Supabase SQL editor.)

### 2) Deploy latest crawler code to Fly

### 3) Scale machines

Fly dashboard → **Machines** / **Scale** → set count to **2** or **3**  
(or CLI: `fly scale count 3`)

Recommended for your 512MB box: **start with 2**, then try 3.

### 4) Optional Fly env (fast + multi-machine)

```
CRAWL_CONCURRENCY=3
CONTINUOUS_FIRM_BATCH=12
CRAWL_DELAY_MS=250
CRAWL_CLAIM_LEASE_SECONDS=1800
```

Keep `CRAWL_CONCURRENCY` modest on small RAM (2–3 per machine).

## Expected speed

| Machines | Approx effect |
|---|---|
| 1 | current speed |
| 2 | ~2× firms/hour |
| 3 | ~3× (until CPU/network saturates) |

## Important

- Don’t run **both** an old single-machine build and a new claiming build together
- Suspend any old host (Render already deleted)
- All machines must share the **same Supabase** project
