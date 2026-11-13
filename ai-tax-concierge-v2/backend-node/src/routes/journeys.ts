import { Router } from "express";
import type { AppLocals } from "../appTypes.js";
import { ValidationConciergeError } from "../core/errors.js";
import { listJourneys } from "../journeys/engine.js";
import {
  JourneyAdvanceSchema,
  JourneyStartSchema,
} from "../models/schemas.js";
import { chatLimiter } from "../security/ratelimit.js";
import { zodValidate } from "./validate.js";

export function journeysRouter(): Router {
  const router = Router();

  router.get("/journeys", (_req, res) => {
    res.json({ journeys: listJourneys() });
  });

  router.post(
    "/journeys/start",
    zodValidate(JourneyStartSchema),
    (req, res, next) => {
      try {
        const body = req.body as ReturnType<typeof JourneyStartSchema.parse>;
        chatLimiter.check(`journey:${body.session_id}`);
        const { engine } = req.app.locals as AppLocals;
        const result = engine.startGuided(body.journey_id, body.session_id);
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/journeys/advance",
    zodValidate(JourneyAdvanceSchema),
    async (req, res, next) => {
      try {
        const body = req.body as ReturnType<typeof JourneyAdvanceSchema.parse>;
        chatLimiter.check(`journey:${body.session_id}`);
        const { engine } = req.app.locals as AppLocals;
        let label = body.option_id;
        if (body.journey_state.current) {
          for (const opt of body.journey_state.current.options) {
            if (opt.id === body.option_id) {
              label = opt.label;
              break;
            }
          }
        }
        const result = await engine.handle({
          session_id: body.session_id,
          message: label,
          journey_option_id: body.option_id,
          journey_state: body.journey_state,
        });
        res.json(result);
      } catch (err) {
        if (err instanceof ValidationConciergeError) {
          next(err);
          return;
        }
        if (err instanceof Error && err.message) {
          next(new ValidationConciergeError(err.message));
          return;
        }
        next(err);
      }
    },
  );

  return router;
}
