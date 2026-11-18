import { randomUUID } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import type { AppLocals } from "../appTypes.js";
import { WELCOME_MESSAGE } from "../ai/prompts.js";
import {
  publicCatalogPayload,
  startersCatalog,
} from "../catalog/service.js";
import { listJourneys } from "../journeys/engine.js";
import { taxYearLabel } from "../knowledge/tax_year.js";
import { listRoutes } from "../routes_registry/service.js";
import { publicApiLimiter } from "../security/ratelimit.js";

function limitPublic(req: Request, _res: Response, next: NextFunction) {
  try {
    publicApiLimiter.check(req.ip || "unknown");
    next();
  } catch (err) {
    next(err);
  }
}

function publicRoutes(websiteBaseUrl: string) {
  const raw = listRoutes();
  const routes = (raw.routes || []) as Array<Record<string, any>>;
  return routes
    .filter(
      (r) => r.status === "live_verified" || r.status === "soft_or_generic",
    )
    .map((r) => ({
      id: r.id,
      label: r.label,
      path: r.path,
      url: `${websiteBaseUrl.replace(/\/$/, "")}${r.path}`,
    }));
}

export function catalogRouter(): Router {
  const router = Router();
  router.use(limitPublic);

  router.get("/bootstrap", (req, res) => {
    const { settings } = req.app.locals as AppLocals;
    const catalog = publicCatalogPayload(settings.websiteBaseUrl);
    const llmMode = settings.useMockLlm ? "mock" : "openai";
    const packages = catalog.packages as Record<string, any>;
    const bookingLive = settings.consultationBookingLive;
    const consultList = Array.isArray(packages.consultations)
      ? packages.consultations
      : packages.consultation
        ? [packages.consultation]
        : [];
    res.json({
      product: "SIMBA",
      subtitle: "Your Digital Tax Assistant",
      phase: 3,
      assistant_name: "SIMBA",
      welcome_message: WELCOME_MESSAGE,
      ai_disclosure:
        "SIMBA is AI-powered — a Digital Tax Assistant from TaxSimba, not a qualified human accountant " +
        "or HMRC representative.",
      llm_mode: llmMode,
      mock_notice: llmMode === "mock" ? "MOCK MODE — not live OpenAI." : null,
      current_tax_year: taxYearLabel(),
      disclaimer:
        "General UK tax information only — not personalised advice. " +
        "Sources are verified GOV.UK / HMRC links when available.",
      starters: catalog.starters,
      journeys: listJourneys().map((j) => ({
        id: j.id,
        title: j.title,
      })),
      packages,
      calculators: catalog.calculators,
      routes: publicRoutes(settings.websiteBaseUrl),
      email_enquiry: "info@taxsimba.co.uk",
      free_callback_available: false,
      consultations: consultList.map((c: Record<string, any>) => ({
        code: c.code,
        name: c.name,
        price_gbp: c.price_gbp,
        billing: c.billing || "one-off",
        vat_note: c.vat_note || "",
        duration_minutes: c.duration_minutes,
        meeting: c.meeting || "Google Meet",
        booking_available: bookingLive,
        booking_note: bookingLive
          ? "Online booking is available when payment and scheduling are confirmed."
          : "Online booking/payment is not connected yet.",
        inclusions: c.inclusions || [],
        exclusions: c.exclusions || [
          "Tax return filing",
          "Bookkeeping",
          "Written report",
          "Free phone callback",
        ],
      })),
      consultation: {
        ...(consultList[0] || {}),
        code: consultList[0]?.code || "ACCOUNTANT_CONSULT_99",
        name: consultList[0]?.name || "Quick Tax Advice",
        price_gbp: consultList[0]?.price_gbp ?? 99,
        duration_minutes: consultList[0]?.duration_minutes ?? 20,
        meeting: "Google Meet",
        booking_available: bookingLive,
        booking_note: bookingLive
          ? "Online booking is available when payment and scheduling are confirmed."
          : "Online booking/payment is not connected yet.",
      },
      brand: {
        primary: "#006B3C",
        primary_action: "#078A4B",
        background_soft: "#F1F8F4",
        border: "#E3E7E4",
        text: "#161B18",
        fonts: { heading: "Manrope", body: "Public Sans" },
        logo: "/widget/assets/taxsimba-logo.svg",
      },
      integrations: {
        openai: llmMode,
        payment: "unavailable",
        calendly: bookingLive ? "live" : "not_connected",
        client_portal: "not_connected_in_chat",
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

  router.get("/catalog/routes", (req, res) => {
    const { settings } = req.app.locals as AppLocals;
    res.json(publicRoutes(settings.websiteBaseUrl));
  });

  return router;
}
