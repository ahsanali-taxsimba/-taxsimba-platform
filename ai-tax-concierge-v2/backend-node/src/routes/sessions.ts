import { Router } from "express";
import { z } from "zod";
import type { AppLocals } from "../appTypes.js";
import { SessionDeleteSchema } from "../models/schemas.js";
import { createHandoff, consumeHandoff } from "../sessions/handoff.js";
import { sessionStore } from "../sessions/store.js";
import { zodValidate } from "./validate.js";

const HandoffCreateSchema = z.object({
  session_id: z.string().min(1).max(128),
  draft: z.string().max(4000).optional().nullable(),
});

const HandoffConsumeSchema = z.object({
  handoff_token: z.string().min(32).max(128),
});

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

  /** Create a short-lived single-use handoff for compact→workspace continuity. */
  router.post(
    "/sessions/handoff",
    zodValidate(HandoffCreateSchema),
    (req, res) => {
      const body = req.body as { session_id: string; draft?: string | null };
      const result = createHandoff(body);
      if ("error" in result) {
        res.status(404).json({
          error: {
            code: result.error,
            message:
              result.error === "session_not_found"
                ? "That chat session was not found."
                : "Unable to create a workspace handoff.",
            details: {},
          },
        });
        return;
      }
      const { analytics } = req.app.locals as AppLocals;
      analytics.record("session_handoff_created", body.session_id, {
        expires_in: result.expires_in,
      });
      res.status(201).json(result);
    },
  );

  /** Consume a handoff once — returns session history without exposing the token again. */
  router.post(
    "/sessions/handoff/consume",
    zodValidate(HandoffConsumeSchema),
    (req, res) => {
      const body = req.body as { handoff_token: string };
      const result = consumeHandoff(body.handoff_token);
      if (!result.ok) {
        const status =
          result.error === "handoff_already_used" ? 409 : 400;
        res.status(status).json({
          error: {
            code: result.error,
            message:
              "This workspace link is invalid, expired, or already used. Continue in a new chat if needed.",
            details: {},
          },
        });
        return;
      }
      const { analytics } = req.app.locals as AppLocals;
      analytics.record("session_handoff_consumed", result.data.session_id, {
        turn_count: result.data.turn_count,
      });
      res.json({
        found: true,
        session_id: result.data.session_id,
        history: result.data.history,
        draft: result.data.draft,
        turn_count: result.data.turn_count,
        auto_send: false,
      });
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
