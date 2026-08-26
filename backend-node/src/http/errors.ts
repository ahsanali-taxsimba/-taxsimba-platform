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

/** Pydantic reports the offending value, which for a field error is the value at its path. */
function inputAt(body: unknown, path: (string | number)[]): unknown {
  let cursor: unknown = body ?? {};
  for (const key of path) {
    if (cursor && typeof cursor === "object") {
      cursor = (cursor as Record<string, unknown>)[String(key)];
    } else {
      return undefined;
    }
  }
  return cursor;
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
            input: type === "missing" ? (body ?? {}) : inputAt(body, i.path),
            url: `${PYDANTIC_DOCS}${type}`,
          };
        }),
      );
    }
    throw e;
  }
}

/** Python's json module wording for the parse failures Node's parser reports. */
function jsonDecodeDetail(message: string): string {
  if (/property name/i.test(message)) return "Expecting property name enclosed in double quotes";
  if (/after property value|Expected ',' or/i.test(message)) return "Expecting ',' delimiter";
  if (/after property name|Expected ':'/i.test(message)) return "Expecting ':' delimiter";
  return "Expecting value";
}

/**
 * A body that is not valid JSON must answer like FastAPI (422 json_invalid), not as an
 * unhandled server error.
 */
export function jsonBodyErrorMiddleware(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (err instanceof SyntaxError && "body" in err) {
    const raw = (err as SyntaxError & { body?: unknown }).body;
    const position = /position (\d+)/.exec(err.message);
    const loc = position ? Number(position[1]) : typeof raw === "string" ? raw.length : 0;
    next(
      new HttpError(422, [
        {
          type: "json_invalid",
          loc: ["body", loc],
          msg: "JSON decode error",
          input: {},
          ctx: { error: jsonDecodeDetail(err.message) },
        },
      ]),
    );
    return;
  }
  next(err);
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
