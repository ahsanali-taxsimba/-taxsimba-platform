// Edge cron trigger examples — schedule via Supabase Dashboard → Edge Functions → Schedules
// Prefer calling the Node API ops endpoints for real crawls (Edge has short timeouts).

Deno.cron?.("weekly-crawl", "0 3 * * 0", async () => {
  const backend = Deno.env.get("TAXOTOOLS_BACKEND_URL");
  if (!backend) return;
  await fetch(`${backend}/ops/crawl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit: 50 }),
  });
});
