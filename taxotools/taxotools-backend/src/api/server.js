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
import {
  scorecardHandler,
  battleCardHandler,
  backlinkGapsHandler,
  marketsHandler,
  leadsHandler,
  changesHandler,
  ukCoverageHandler,
  importFirmsHandler,
  contentGapsHandler,
} from "./platformFeatures.js";
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
<title>TaxoTools Intelligence</title>
<style>
  :root{--bg:#0b1220;--panel:#121a2b;--line:#243149;--text:#e8eef8;--muted:#93a0b8;--ok:#3ecf8e;--accent:#6eb6ff}
  *{box-sizing:border-box}
  body{margin:0;font-family:"Segoe UI",ui-sans-serif,system-ui,sans-serif;color:var(--text);
    background:radial-gradient(900px 480px at 15% -5%,#1d3b66 0%,transparent 55%),linear-gradient(160deg,#0b1220,#10182a 60%,#0b1220)}
  main{max-width:960px;margin:0 auto;padding:40px 18px 64px}
  h1{font-size:clamp(1.6rem,3vw,2.1rem);margin:0 0 8px;letter-spacing:-.02em}
  h2{font-size:1.05rem;margin:28px 0 10px;color:#cfe0ff}
  p{color:var(--muted);line-height:1.55;margin:0 0 12px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:22px 0}
  .stat,.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px}
  .stat b{display:block;font-size:1.35rem;margin-top:6px}
  .stat span{color:var(--muted);font-size:.82rem}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
  .card a{color:var(--accent);text-decoration:none;font-weight:600}
  .card small{display:block;color:var(--muted);margin-top:6px;line-height:1.4}
  a{color:var(--accent)}
  .ok{color:var(--ok);font-weight:650}
  code{background:#0a1020;padding:2px 6px;border-radius:6px;font-size:.86em}
  form{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 8px}
  input,textarea,button{border-radius:10px;border:1px solid var(--line);background:#0d1526;color:var(--text);padding:10px 12px}
  input{min-width:220px;flex:1}
  textarea{width:100%;min-height:110px;font-family:ui-monospace,Consolas,monospace}
  button{background:#1d4f86;border-color:#2d6fad;cursor:pointer;font-weight:650}
  #out{white-space:pre-wrap;font-size:.82rem;max-height:280px;overflow:auto;background:#0a1020;border:1px solid var(--line);border-radius:12px;padding:12px;color:#c9d7ee}
</style></head><body><main>
  <h1>TaxoTools UK Intelligence</h1>
  <p>Status: <span class="ok">${control?.status || "unknown"}</span> · firms, GEO, SEO, AEO, backlinks, competitors, leads</p>
  <div class="grid">
    <div class="stat"><span>Firms</span><b>${coverage?.firms_total ?? "—"}</b></div>
    <div class="stat"><span>Crawled</span><b>${coverage?.firms_crawled ?? "—"}</b></div>
    <div class="stat"><span>GEO</span><b>${coverage?.geo_profiles ?? "—"}</b></div>
    <div class="stat"><span>SEO pages</span><b>${coverage?.seo_pages ?? "—"}</b></div>
    <div class="stat"><span>Backlinks</span><b>${coverage?.backlinks ?? "—"}</b></div>
    <div class="stat"><span>Pending</span><b>${coverage?.firms_pending_crawl ?? "—"}</b></div>
  </div>

  <h2>Intelligence APIs</h2>
  <div class="cards">
    <div class="card"><a href="/scorecard?domain=sedulo.co.uk">Scorecard</a><small>Authority + SEO + GEO + AEO + local-pack score</small></div>
    <div class="card"><a href="/battle-card?domain=sedulo.co.uk">Battle card</a><small>Local rivals, backlink &amp; content gaps</small></div>
    <div class="card"><a href="/backlink-gaps?domain=sedulo.co.uk">Backlink gaps</a><small>Domains linking to competitors, not you</small></div>
    <div class="card"><a href="/markets">City markets</a><small>UK market map · try <code>?city=Manchester</code></small></div>
    <div class="card"><a href="/leads?missing_phone=1&limit=25">Lead list</a><small>Filter weak firms · <code>&format=csv</code> export</small></div>
    <div class="card"><a href="/content-gaps?domain=sedulo.co.uk">Content / AEO gaps</a><small>Missing VAT/payroll/FAQ/local schema</small></div>
    <div class="card"><a href="/changes?days=7">Change monitor</a><small>Recent crawls &amp; new backlinks</small></div>
    <div class="card"><a href="/coverage/uk">UK coverage</a><small>By source &amp; location</small></div>
  </div>

  <h2>Quick lookup</h2>
  <form id="qform" onsubmit="return goLookup(event)">
    <input id="qdomain" placeholder="domain e.g. sedulo.co.uk" value="sedulo.co.uk"/>
    <button type="submit">Open scorecard</button>
    <button type="button" onclick="location.href='/battle-card?domain='+encodeURIComponent(document.getElementById('qdomain').value)">Battle card</button>
    <button type="button" onclick="location.href='/leads?format=csv&limit=100'">Export leads CSV</button>
  </form>

  <h2>Import firms (Name — https://site)</h2>
  <textarea id="importText" placeholder="Firm Name — https://example.co.uk"></textarea>
  <form onsubmit="return doImport(event)" style="margin-top:8px">
    <button type="submit">Import live websites</button>
  </form>
  <pre id="out"></pre>

  <p style="margin-top:22px">
    <a href="/health">/health</a> ·
    <a href="/coverage">/coverage</a> ·
    <a href="/firm?domain=sedulo.co.uk">/firm</a> ·
    <a href="/crawler/status">/crawler/status</a>
  </p>
<script>
function goLookup(e){e.preventDefault();location.href='/scorecard?domain='+encodeURIComponent(document.getElementById('qdomain').value);return false}
async function doImport(e){
  e.preventDefault();
  const out=document.getElementById('out');
  out.textContent='Importing…';
  try{
    const r=await fetch('/ops/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:document.getElementById('importText').value})});
    out.textContent=JSON.stringify(await r.json(),null,2);
  }catch(err){out.textContent=String(err)}
  return false;
}
</script>
</main></body></html>`);
});

app.get("/accountants", getAccountantsHandler);
app.get("/firm", getFirmCoreHandler);
app.get("/scorecard", scorecardHandler);
app.get("/battle-card", battleCardHandler);
app.get("/backlink-gaps", backlinkGapsHandler);
app.get("/markets", marketsHandler);
app.get("/leads", leadsHandler);
app.get("/changes", changesHandler);
app.get("/coverage/uk", ukCoverageHandler);
app.get("/content-gaps", contentGapsHandler);
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
app.post("/ops/import", importFirmsHandler);

app.post("/ops/discover", async (req, res) => {
  try {
    const r = await runDiscovery({
      includeDirectories: req.body?.directories !== false,
      deep: Boolean(req.body?.deep),
      includeRegionalGoogle: req.body?.regional !== false,
    });
    res.json(r.summary);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Force UK regional near-me style discovery (Google Maps via SerpAPI + CH by city). */
app.post("/ops/discover-regional", async (req, res) => {
  try {
    const deep = Boolean(req.body?.deep);
    const { discoverFromGoogleRegional } = await import("../discovery/googleRegional.js");
    const { discoverFromCompaniesHouseRegional } = await import(
      "../discovery/companiesHouseRegional.js"
    );
    const { UK_REGION_GRID } = await import("../discovery/ukRegions.js");
    const maxPlaces = deep
      ? UK_REGION_GRID.length
      : Number(req.body?.maxPlaces || process.env.REGIONAL_PLACE_LIMIT || 40);
    const chRegional = await discoverFromCompaniesHouseRegional({ deep, maxPlaces });
    const googleRegional = await discoverFromGoogleRegional({
      deep,
      maxPlaces,
      queries: ["accountants near me", "accountant", "chartered accountant"],
    });
    res.json({
      ok: true,
      companiesHouseRegional: chRegional.length,
      googleMapsRegional: googleRegional.length,
      places: maxPlaces,
      serpApiConfigured: Boolean(process.env.SERP_API_KEY || process.env.SERPAPI_KEY),
    });
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
