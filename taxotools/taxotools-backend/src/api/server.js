import express from "express";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";
import { getBacklinksHandler } from "./getBacklinks.js";
import { getReferringDomainsHandler } from "./getReferringDomains.js";
import { getAccountantsHandler } from "./getAccountants.js";
import { competitorBacklinksHandler } from "./competitorBacklinks.js";
import {
  getKeywordsHandler,
  getSeoHandler,
  getGeoHandler,
  getAeoHandler,
  getCompetitorsHandler,
  getCrawlerStatusHandler,
} from "./intelligenceHandlers.js";
import { getFirmCoreHandler } from "./getFirmCore.js";
import { getCoverageStats } from "../supabase/insertDomain.js";
import { getSupabase } from "../supabase/client.js";
import { runDiscovery } from "../discovery/index.js";
import { runCrawl } from "../crawler/index.js";
import { runCycle } from "../cron/runCycle.js";
import { dailyKeywordUpdate } from "../cron/dailyKeywords.js";
import { dailySeoGeoAeoRefresh } from "../cron/dailySeo.js";

const log = logger("api");
const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "taxotools-backend",
    mode: "core-backlinks-geo-seo-competitors",
    supabase: Boolean(env.supabaseUrl),
    collectKeywords: env.collectKeywords,
  });
});

app.get("/", async (_req, res) => {
  let coverage = null;
  let control = null;
  try {
    coverage = await getCoverageStats();
  } catch {
    // ignore
  }
  try {
    const { data } = await getSupabase()
      .from("crawler_control")
      .select("*")
      .eq("id", "uk-accountancy")
      .maybeSingle();
    control = data;
  } catch {
    // ignore
  }
  res.type("html").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>TaxoTools Crawler</title>
<style>
  :root{--bg:#0f1419;--card:#1a2332;--text:#e7ecf3;--muted:#9aa8bc;--ok:#3ecf8e;--accent:#5b9fd4}
  body{margin:0;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,sans-serif;background:radial-gradient(1200px 600px at 20% -10%,#1e3a5f 0%,var(--bg) 55%);color:var(--text);min-height:100vh}
  main{max-width:780px;margin:0 auto;padding:48px 20px}
  h1{font-size:1.75rem;margin:0 0 8px}
  p{color:var(--muted);line-height:1.5}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:28px 0}
  .stat{background:var(--card);border:1px solid #2a3548;border-radius:12px;padding:16px}
  .stat b{display:block;font-size:1.4rem;margin-top:6px}
  .stat span{color:var(--muted);font-size:.85rem}
  a{color:var(--accent)}
  .ok{color:var(--ok);font-weight:600}
  code{background:#111827;padding:2px 6px;border-radius:6px}
</style></head><body><main>
  <h1>TaxoTools UK Crawler</h1>
  <p>Status: <span class="ok">${control?.status || "unknown"}</span> · Core focus: firms, GEO, SEO, AEO, backlinks, competitors</p>
  <div class="grid">
    <div class="stat"><span>Firms</span><b>${coverage?.firms_total ?? "—"}</b></div>
    <div class="stat"><span>Crawled</span><b>${coverage?.firms_crawled ?? "—"}</b></div>
    <div class="stat"><span>GEO profiles</span><b>${coverage?.geo_profiles ?? "—"}</b></div>
    <div class="stat"><span>SEO pages</span><b>${coverage?.seo_pages ?? "—"}</b></div>
    <div class="stat"><span>Backlinks</span><b>${coverage?.backlinks ?? "—"}</b></div>
    <div class="stat"><span>Pending</span><b>${coverage?.firms_pending_crawl ?? "—"}</b></div>
  </div>
  <p><b>Core firm API:</b> <code>/firm?domain=mooreks.co.uk</code></p>
  <p>
    <a href="/health">/health</a> ·
    <a href="/coverage">/coverage</a> ·
    <a href="/accountants">/accountants</a> ·
    <a href="/firm?domain=mooreks.co.uk">/firm example</a> ·
    <a href="/crawler/status">/crawler/status</a>
  </p>
</main></body></html>`);
});

app.get("/accountants", getAccountantsHandler);
app.get("/firm", getFirmCoreHandler);
app.get("/backlinks", getBacklinksHandler);
app.get("/referring-domains", getReferringDomainsHandler);
app.get("/competitor-backlinks", competitorBacklinksHandler);
app.get("/keywords", getKeywordsHandler);
app.get("/seo", getSeoHandler);
app.get("/geo", getGeoHandler);
app.get("/aeo", getAeoHandler);
app.get("/competitors", getCompetitorsHandler);
app.get("/crawler/status", getCrawlerStatusHandler);
app.get("/coverage", async (_req, res) => {
  try {
    const coverage = await getCoverageStats();
    res.json({ ok: true, coverage, at: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/ops/discover", async (req, res) => {
  try {
    const r = await runDiscovery({ includeDirectories: req.body?.directories !== false });
    res.json(r.summary);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/ops/crawl", async (req, res) => {
  try {
    const r = await runCrawl({
      limit: Number(req.body?.limit || 10),
      includeCommonCrawl: req.body?.commonCrawl !== false,
      maxPages: req.body?.maxPages ? Number(req.body.maxPages) : undefined,
    });
    res.json(r);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/ops/cycle", async (_req, res) => {
  try {
    const r = await runCycle({ firmLimit: 10 });
    res.json(r);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/ops/keywords", async (req, res) => {
  try {
    const r = await dailyKeywordUpdate({ limit: Number(req.body?.limit || 20) });
    res.json(r);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/ops/seo-refresh", async (req, res) => {
  try {
    const r = await dailySeoGeoAeoRefresh({
      limit: Number(req.body?.limit || 10),
      maxPages: Number(req.body?.maxPages || 15),
    });
    res.json(r);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(env.port, () => {
  log.info(`TaxoTools continuous intelligence API on :${env.port}`);
});
