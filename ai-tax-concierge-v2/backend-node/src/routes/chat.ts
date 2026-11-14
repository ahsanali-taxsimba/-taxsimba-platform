import { Router } from "express";
import type { AppLocals } from "../appTypes.js";
import { ChatRequestSchema } from "../models/schemas.js";
import { chatLimiter } from "../security/ratelimit.js";
import { zodValidate } from "./validate.js";

export function chatRouter(): Router {
  const router = Router();

  router.post("/chat", zodValidate(ChatRequestSchema), async (req, res, next) => {
    try {
      const payload = req.body as ReturnType<typeof ChatRequestSchema.parse>;
      const peer = req.ip || "unknown";
      chatLimiter.check(`${peer}:${payload.session_id}`);
      const { engine } = req.app.locals as AppLocals;
      const result = await engine.handle(payload);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
