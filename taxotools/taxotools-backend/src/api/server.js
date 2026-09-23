import express from "express";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";
import { getBacklinksHandler } from "./getBacklinks.js";
import { getReferringDomainsHandler } from "./getReferringDomains.js";
import { getAccountantsHandler } from "./getAccountants.js";
import { competitorBacklinksHandler } from "./competitorBacklinks.js";
import { runDiscovery } from "../discovery/index.js";
import { runCrawl } from "../crawler/index.js";
import { runCycle } from "../cron/runCycle.js";

const log = logger("api");
const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "taxotools-backend",
    supabase: Boolean(env.supabaseUrl),
  });
});

app.get("/backlinks", getBacklinksHandler);
app.get("/referring-domains", getReferringDomainsHandler);
app.get("/accountants", getAccountantsHandler);
app.get("/competitor-backlinks", competitorBacklinksHandler);

// Ops triggers (protect in production with a secret header)
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

app.listen(env.port, () => {
  log.info(`TaxoTools UK backlinks API on :${env.port}`);
});
