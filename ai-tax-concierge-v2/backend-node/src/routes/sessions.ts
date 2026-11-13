import { Router } from "express";
import type { AppLocals } from "../appTypes.js";
import { SessionDeleteSchema } from "../models/schemas.js";
import { sessionStore } from "../sessions/store.js";
import { zodValidate } from "./validate.js";

export function sessionsRouter(): Router {
  const router = Router();

  router.post(
    "/sessions/delete",
    zodValidate(SessionDeleteSchema),
    (req, res) => {
      const body = req.body as { session_id: string };
      const ok = sessionStore.delete(body.session_id);
      const { analytics } = req.app.locals as AppLocals;
      analytics.record("session_deleted", body.session_id, { deleted: ok });
      res.json({ deleted: ok, session_id: body.session_id });
    },
  );

  router.get("/sessions/:session_id", (req, res) => {
    const sessionId = req.params.session_id!;
    const rec = sessionStore.get(sessionId);
    if (!rec) {
      res.json({ found: false, session_id: sessionId });
      return;
    }
    res.json({
      found: true,
      session_id: rec.session_id,
      turn_count: rec.history.length,
      has_journey: rec.journey_state !== null,
      updated_at: rec.updated_at.toISOString(),
    });
  });

  return router;
}
