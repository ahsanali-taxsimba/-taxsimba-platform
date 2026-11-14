import { Router } from "express";
import { existsSync } from "node:fs";
import type { AppLocals } from "../appTypes.js";
import { VERSION } from "../version.js";
import { taxYearLabel } from "../knowledge/tax_year.js";
import { runtimePaths } from "../ops/runtime_paths.js";
import { opsTokenConfigured } from "../ops/auth.js";

export function healthRouter(): Router {
  const router = Router();

  router.get("/health", (req, res) => {
    const { settings } = req.app.locals as AppLocals;
    const mode = settings.useMockLlm ? "mock" : "openai";
    res.json({
      status: "ok",
      version: VERSION,
      phase: 3,
      product: "SIMBA AI",
      llm_mode: mode,
      current_tax_year: taxYearLabel(),
      mock_notice: mode === "mock" ? "MOCK MODE — not live OpenAI." : null,
      dynamic_systems: {
        hmrc_monitor_enabled:
          String(process.env.CONCIERGE_HMRC_MONITOR_ENABLED || "")
            .trim()
            .toLowerCase() === "true",
        catalogue_sync_enabled:
          String(process.env.CONCIERGE_CATALOGUE_SYNC_ENABLED || "")
            .trim()
            .toLowerCase() === "true",
        catalogue_live_overlay: existsSync(runtimePaths.catalogLive()),
        ops_token_configured: opsTokenConfigured(),
      },
    });
  });

  router.get("/config", (req, res) => {
    const { settings } = req.app.locals as AppLocals;
    res.json(settings.safePublicConfig());
  });

  return router;
}
