# Faster hosting than Render Free

Render Free is slow (0.1 CPU, sleeps when idle). For a serious UK-wide crawl, use one of these.

## Option A — Fly.io (recommended)

Never sleeps by default when `min_machines_running = 1`. London region (`lhr`) is close to UK targets.

### 1) Install Fly CLI (on your laptop)

```bash
# Mac
brew install flyctl

# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex
```

### 2) Login + launch

```bash
fly auth login
cd taxotools-backend
fly launch --copy-config --name taxotools-crawler --region lhr --no-deploy
```

### 3) Set secrets (same as Render env vars)

```bash
fly secrets set \
  SUPABASE_URL="https://ndmkdteobpodiwokrgzb.supabase.co" \
  NEXT_PUBLIC_SUPABASE_URL="https://ndmkdteobpodiwokrgzb.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" \
  OPEN_PAGERANK_API_KEY="YOUR_OPR_KEY" \
  COMPANIES_HOUSE_API_KEY="YOUR_CH_KEY" \
  DIRECT_URL="YOUR_DIRECT_URL" \
  DATABASE_URL="YOUR_DATABASE_URL" \
  BACKEND_PORT="3200"
```

### 4) Deploy

```bash
fly deploy
```

### 5) Check

```bash
fly status
fly open /health
# or
curl https://taxotools-crawler.fly.dev/coverage
```

### 6) Stop Render (optional)

In Render dashboard → `taxotools-crawler` → **Suspend**, so you don’t run two crawlers writing the same DB.

---

## Option B — Railway

1. https://railway.app → New Project → Deploy from GitHub  
2. Repo: `asimabbasacca-del/Taxotools`  
3. Root: `taxotools-backend`  
4. Start: `node src/cron/startAlwaysOn.js`  
5. Paste the same env vars  
6. Deploy  

Railway’s hobby plan is usually faster than Render Free and doesn’t sleep the same way.

---

## Option C — Stay on Render but pay

Upgrade `taxotools-crawler` to a paid instance (at least **0.5 CPU / 512MB**).  
Still slower than Fly/Railway for crawl volume, but better than Free.

---

## Speed tips (any host)

| Setting | Faster value |
|---|---|
| `CONTINUOUS_FIRM_BATCH` | `12`–`20` |
| `CONTINUOUS_LOOP_SLEEP_MS` | `30000` |
| `MAX_PAGES_PER_DOMAIN` | `50`–`100` (still thorough, less time/firm) |
| `CRAWL_DELAY_MS` | keep `500` (polite; don’t go much lower) |

---

## Which should you pick?

| Goal | Pick |
|---|---|
| Best for UK crawl + always on | **Fly.io** |
| Easiest UI like Render | **Railway** |
| Least change | **Render paid** |
