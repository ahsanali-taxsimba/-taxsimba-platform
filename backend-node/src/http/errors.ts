import { NextFunction, Request, Response } from "express";
import { ZodError, ZodIssue, ZodTypeAny } from "zod";

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

const PYDANTIC_DOCS = "https://errors.pydantic.dev/2.13/v/";

/** Pydantic's wording for the issues zod reports, so error text matches the reference. */
function pydanticIssue(issue: ZodIssue): { type: string; msg: string } {
  if (issue.code === "invalid_type") {
    if (issue.received === "undefined") return { type: "missing", msg: "Field required" };
    return { type: `${issue.expected}_type`, msg: `Input should be a valid ${issue.expected}` };
  }
  return { type: issue.code, msg: issue.message };
}

/** Mirrors FastAPI's 422 validation envelope so the frontend's apiError() renders the same. */
export function parseBody<T extends ZodTypeAny>(schema: T, body: unknown): ReturnType<T["parse"]> {
  try {
    return schema.parse(body ?? {});
  } catch (e) {
    if (e instanceof ZodError) {
      throw new HttpError(
        422,
        e.issues.map((i) => {
          const { type, msg } = pydanticIssue(i);
          return {
            type,
            loc: ["body", ...i.path.map((p) => String(p))],
            msg,
            input: body ?? {},
            url: `${PYDANTIC_DOCS}${type}`,
          };
        }),
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
