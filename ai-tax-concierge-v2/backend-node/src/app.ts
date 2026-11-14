/**
 * Express entrypoint for SIMBA AI (TaxSimba AI Tax Concierge V2 — Node port).
 *
 * Dual-run note: Python uvicorn defaults to :8090; Node server.ts defaults to
 * PORT||8091 so both can run side-by-side during parity checks.
 */

import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import path from "node:path";
import { existsSync } from "node:fs";

import { buildLlmAdapter, buildStubAdapters } from "./adapters/factory.js";
import { ConversationalEngine } from "./ai/conversational_engine.js";
import { AnalyticsRecorder } from "./analytics/events.js";
import { createSettings, getSettings, type Settings } from "./config/settings.js";
import { ConciergeError } from "./core/errors.js";
import { WIDGET_DIR } from "./paths.js";
import { healthRouter } from "./routes/health.js";
import { chatRouter } from "./routes/chat.js";
import { journeysRouter } from "./routes/journeys.js";
import { catalogRouter } from "./routes/catalog.js";
import { sessionsRouter } from "./routes/sessions.js";
import { analyticsRouter } from "./routes/analytics.js";
import { opsRouter } from "./routes/ops.js";
import { sessionStore } from "./sessions/store.js";
import { VERSION } from "./version.js";
import type { AppLocals } from "./appTypes.js";
import { ensureRuntimeDirs } from "./ops/runtime_paths.js";

export function createApp(settings?: Settings): Express {
  const resolved = settings ?? getSettings();
  const app = express();
  ensureRuntimeDirs();

  const llm = buildLlmAdapter(resolved);
  const analyticsRecorder = new AnalyticsRecorder();
  const stubs = buildStubAdapters(resolved);
  const engine = new ConversationalEngine({
    llm,
    analytics: analyticsRecorder,
    settings: resolved,
    sessions: sessionStore,
  });

  const locals: AppLocals = {
    settings: resolved,
    llm,
    stubs,
    analytics: analyticsRecorder,
    sessions: sessionStore,
    engine,
  };
  app.locals = Object.assign(app.locals, locals);

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.use(
    cors({
      origin: (origin, cb) => {
        const allowed = resolved.corsOrigins;
        if (!origin) {
          cb(null, true);
          return;
        }
        if (allowed.includes(origin) || allowed.includes("*")) {
          cb(null, true);
          return;
        }
        // Reflect allowed origin only — reject others without erroring OPTIONS
        cb(null, false);
      },
      credentials: false,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Accept"],
    }),
  );

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    const p = req.path;
    if (p.startsWith("/widget")) {
      res.setHeader("Content-Security-Policy", "frame-ancestors *");
    } else {
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
    }
    if (p.startsWith("/api/")) {
      res.setHeader("Cache-Control", "no-store");
    }
    next();
  });

  const prefix = "/api/v1";
  app.use(prefix, healthRouter());
  app.use(prefix, chatRouter());
  app.use(prefix, journeysRouter());
  app.use(prefix, catalogRouter());
  app.use(prefix, sessionsRouter());
  app.use(prefix, analyticsRouter());
  app.use(prefix, opsRouter());

  const widgetPath = path.resolve(WIDGET_DIR);
  if (existsSync(widgetPath)) {
    app.use(
      "/widget",
      express.static(widgetPath, {
        index: ["index.html"],
        fallthrough: true,
      }),
    );
  }

  app.get("/", (_req, res) => {
    res.json({
      product: "SIMBA AI",
      subtitle: "SIMBA AI Tax Assistant",
      phase: "master-completion",
      version: VERSION,
      preview: "/widget/preview.html",
      embed: "/widget/embed.js",
      docs: "/docs",
      handover_docs: "ai-tax-concierge-v2/docs/toxel/",
      runtime: "node",
      note: "Node default port 8091 (Python often 8090) for side-by-side dual-run.",
    });
  });

  app.use(
    (
      err: unknown,
      _req: Request,
      res: Response,
      _next: NextFunction,
    ) => {
      if (err instanceof ConciergeError) {
        res.status(err.statusCode).json({
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
          },
        });
        return;
      }
      console.error(err);
      res.status(500).json({
        error: {
          code: "internal_error",
          message: "Internal server error",
          details: {},
        },
      });
    },
  );

  return app;
}

export { createSettings };
