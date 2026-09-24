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
import { getCoverageStats } from "../supabase/insertDomain.js";
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
    mode: "continuous-intelligence",
    supabase: Boolean(env.supabaseUrl),
  });
});

app.get("/accountants", getAccountantsHandler);
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
