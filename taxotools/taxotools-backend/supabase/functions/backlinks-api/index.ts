// Supabase Edge Function stubs — deploy with `supabase functions deploy`
// Heavy crawl work should stay on the Node worker; these proxy or trigger jobs.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const backend = Deno.env.get("TAXOTOOLS_BACKEND_URL") || "http://localhost:3200";
  const path = url.pathname.replace(/^\/backlinks-api/, "") || "/health";
  const target = `${backend}${path}${url.search}`;
  const res = await fetch(target, {
    method: req.method,
    headers: req.headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.text(),
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
  });
});
