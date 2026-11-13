import { Router } from "express";
import type { AppLocals } from "../appTypes.js";
import { VERSION } from "../version.js";
import { taxYearLabel } from "../knowledge/tax_year.js";

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
    });
  });

  router.get("/config", (req, res) => {
    const { settings } = req.app.locals as AppLocals;
    res.json(settings.safePublicConfig());
  });

  return router;
}
