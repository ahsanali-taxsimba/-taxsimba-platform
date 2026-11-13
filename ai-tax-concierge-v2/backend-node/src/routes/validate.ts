import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

/** Validate body with Zod; return 422 on failure (FastAPI-compatible). */
export function zodValidate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        detail: parsed.error.issues.map((i) => ({
          loc: ["body", ...i.path],
          msg: i.message,
          type: i.code,
        })),
      });
      return;
    }
    req.body = parsed.data;
    next();
  };
}
