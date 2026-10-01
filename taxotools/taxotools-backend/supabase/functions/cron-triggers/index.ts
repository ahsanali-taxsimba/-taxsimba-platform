// Edge cron trigger examples — schedule via Supabase Dashboard → Edge Functions → Schedules
// Prefer calling the Node API ops endpoints (Edge has short timeouts).
// For true 24/7 crawling, run `npm run continuous` on a long-lived host.

async function post(path, body = {}) {
  const backend = Deno.env.get("TAXOTOOLS_BACKEND_URL");
  if (!backend) return;
  await fetch(`${backend}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

Deno.cron?.("daily-keywords", "0 2 * * *", () => post("/ops/keywords", { limit: 50 }));
Deno.cron?.("daily-seo-geo-aeo", "30 2 * * *", () => post("/ops/seo-refresh", { limit: 20, maxPages: 25 }));
Deno.cron?.("weekly-crawl", "0 3 * * 0", () => post("/ops/crawl", { limit: 50 }));
Deno.cron?.("weekly-authority", "0 4 * * 0", () => post("/ops/cycle", {}));
Deno.cron?.("monthly-discovery", "0 5 1 * *", () => post("/ops/discover", { directories: true }));
