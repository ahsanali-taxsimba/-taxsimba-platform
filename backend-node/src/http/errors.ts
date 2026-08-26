import { NextFunction, Request, Response } from "express";
import { ZodError, ZodTypeAny } from "zod";

/** FastAPI-compatible error: the body is always {"detail": ...}. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public detail: unknown,
    public headers: Record<string, string> = {},
  ) {
    super(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
}

export function httpError(status: number, detail: unknown, headers: Record<string, string> = {}) {
  return new HttpError(status, detail, headers);
}

/** Wraps an async handler so rejected promises reach the error middleware. */
export function handler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

/** Mirrors FastAPI's 422 validation envelope so the frontend's apiError() renders the same. */
export function parseBody<T extends ZodTypeAny>(schema: T, body: unknown): ReturnType<T["parse"]> {
  try {
    return schema.parse(body ?? {});
  } catch (e) {
    if (e instanceof ZodError) {
      throw new HttpError(
        422,
        e.issues.map((i) => ({
          loc: ["body", ...i.path.map((p) => String(p))],
          msg: i.message,
          type: i.code,
        })),
      );
    }
    throw e;
  }
}

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof HttpError) {
    for (const [k, v] of Object.entries(err.headers)) res.setHeader(k, v);
    res.status(err.status).json({ detail: err.detail });
    return;
  }
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ detail: "Internal Server Error" });
}
