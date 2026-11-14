import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { AppLocals } from "../appTypes.js";
import { WELCOME_MESSAGE } from "../ai/prompts.js";
import {
  publicCatalogPayload,
  startersCatalog,
} from "../catalog/service.js";
import { listJourneys } from "../journeys/engine.js";
import { taxYearLabel } from "../knowledge/tax_year.js";
import {
  calculatorCount,
  listRoutes,
} from "../routes_registry/service.js";

export function catalogRouter(): Router {
  const router = Router();

  router.get("/bootstrap", (req, res) => {
    const { settings } = req.app.locals as AppLocals;
    const catalog = publicCatalogPayload(settings.websiteBaseUrl);
    const llmMode = settings.useMockLlm ? "mock" : "openai";
    const packages = catalog.packages as Record<string, any>;
    res.json({
      product: "SIMBA AI",
      subtitle: "SIMBA AI Tax Assistant",
      phase: 3,
      assistant_name: "SIMBA AI",
      welcome_message: WELCOME_MESSAGE,
      ai_disclosure:
        "SIMBA is an AI assistant from TaxSimba — not a qualified human accountant, " +
        "not an HMRC representative, and not government-approved AI.",
      llm_mode: llmMode,
      mock_notice: llmMode === "mock" ? "MOCK MODE — not live OpenAI." : null,
      current_tax_year: taxYearLabel(),
      disclaimer:
        "General UK tax information only — not personalised advice. " +
        "Sources are verified GOV.UK / HMRC links when available.",
      starters: catalog.starters,
      journeys: listJourneys(),
      packages: catalog.packages,
      calculators: catalog.calculators,
      routes: listRoutes(),
      calculator_registry_count: calculatorCount(),
      consultation: {
        ...packages.consultation,
        duration_minutes: packages.consultation?.duration_minutes ?? 30,
        meeting: packages.consultation?.meeting ?? "Google Meet",
      },
      brand: {
        primary: "#006B3C",
        primary_action: "#078A4B",
        background_soft: "#F1F8F4",
        border: "#E3E7E4",
        text: "#161B18",
        fonts: { heading: "Manrope", body: "Public Sans" },
        logo: "/widget/assets/taxsimba-logo.svg",
        logo_status: "official_taxsimba_co_uk_asset",
        source: "design_guidelines.json + taxsimba.co.uk/images/logo.svg",
      },
      integrations: {
        openai: llmMode,
        payment: "mock_unavailable",
        calendly: "stub",
        website_nav: "partial_live_verified",
        client_portal: "mock_unavailable",
        analytics: "in_memory",
      },
      embed: {
        script_path: "/widget/embed.js",
        iframe_path: "/widget/index.html",
      },
    });
  });

  router.get("/welcome", (req, res) => {
    const { engine } = req.app.locals as AppLocals;
    const sid =
      typeof req.query.session_id === "string"
        ? req.query.session_id
        : randomUUID();
    res.json(engine.welcome(sid));
  });

  router.get("/catalog/packages", (req, res) => {
    const { settings } = req.app.locals as AppLocals;
    res.json(publicCatalogPayload(settings.websiteBaseUrl).packages);
  });

  router.get("/catalog/starters", (_req, res) => {
    res.json(startersCatalog());
  });

  router.get("/catalog/routes", (_req, res) => {
    res.json(listRoutes());
  });

  return router;
}
