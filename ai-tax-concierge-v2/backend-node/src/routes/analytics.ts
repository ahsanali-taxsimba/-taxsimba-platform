import { Router } from "express";
import type { AppLocals } from "../appTypes.js";
import { AnalyticsTrackSchema } from "../models/schemas.js";
import { zodValidate } from "./validate.js";

const ALLOWED = new Set([
  "launcher_open",
  "conversation_started",
  "panel_view",
  "topic_click",
  "journey_start",
  "package_click",
  "calculator_click",
  "consultation_click",
  "route_click",
  "registration_click",
  "satisfaction_yes",
  "satisfaction_no",
]);

export function analyticsRouter(): Router {
  const router = Router();

  router.get("/analytics/summary", (req, res) => {
    const { analytics } = req.app.locals as AppLocals;
    res.json(analytics.summary());
  });

  router.post(
    "/analytics/track",
    zodValidate(AnalyticsTrackSchema),
    (req, res) => {
      const body = req.body as {
        session_id: string;
        event: string;
        meta: Record<string, unknown>;
      };
      if (!ALLOWED.has(body.event)) {
        res.json({ accepted: false, reason: "event_not_allowed" });
        return;
      }
      const safeMeta: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body.meta || {})) {
        if (["code", "id", "path", "label", "panel", "journey"].includes(k)) {
          safeMeta[k] = v;
        }
      }
      const { analytics } = req.app.locals as AppLocals;
      analytics.record(body.event, body.session_id, safeMeta);
      res.json({
        accepted: true,
        note: "Engagement event recorded — not a verified registration, purchase or booking",
      });
    },
  );

  return router;
}
