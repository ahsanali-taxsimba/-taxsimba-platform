# Keep the UK accountancy crawler running 24/7 (outside Cursor)

Cursor Cloud stops when the agent ends. For a crawler that **never stops**,
host `taxotools-backend` on Render (free tier works for a start).

## Easiest path — Render (about 5 minutes)

1. Open https://render.com and sign up (GitHub login).
2. **New → Web Service** → connect repo `ahsanali-taxsimba/-taxsimba-platform`.
3. Settings:
   - **Root Directory:** `taxotools/taxotools-backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node src/cron/startAlwaysOn.js`
   - **Instance type:** Free
4. Add Environment Variables (from your laptop `taxotools/.env`):

| Key | Value |
|---|---|
| `SUPABASE_URL` | `https://ndmkdteobpodiwokrgzb.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_URL` | same as above |
| `SUPABASE_SERVICE_ROLE_KEY` | your service role key |
| `OPEN_PAGERANK_API_KEY` | your Open PageRank key |
| `COMPANIES_HOUSE_API_KEY` | your Companies House key |
| `DIRECT_URL` | your Supabase direct Postgres URL |
| `DATABASE_URL` | your Supabase pooler URL (optional) |
| `BACKEND_PORT` | `3200` |

5. Click **Create Web Service**.
6. When it shows **Live**, open `/health` and `/crawler/status` on the Render URL.

You can close Cursor, close the laptop, and close Supabase — crawling continues on Render and keeps writing to Supabase.

## Local always-on (only while this machine is on)

```bash
cd taxotools/taxotools-backend
npm run always-on
```

## Pause / resume

In Supabase → Table `crawler_control` → set `status` to `paused` or `running`.
