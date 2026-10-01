import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { required } from "../config/env";
import { clean, col, Doc } from "../db/mongo";
import { httpError } from "../http/errors";
import { ACCESS_COOKIE, JWT_ALGORITHM } from "../services/auth";

declare module "express-serve-static-core" {
  interface Request {
    user?: Doc;
  }
}

/** Cookie session first, Bearer token second — identical to auth.get_current_user. */
export async function currentUser(req: Request): Promise<Doc> {
  let token: string | undefined = req.cookies?.[ACCESS_COOKIE];
  if (!token) {
    const header = req.header("authorization") ?? "";
    if (header.startsWith("Bearer ")) token = header.slice(7);
  }
  if (!token) throw httpError(401, "Not authenticated");
  let payload: Doc;
  try {
    payload = jwt.verify(token, required("JWT_SECRET"), { algorithms: [JWT_ALGORITHM] }) as Doc;
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) throw httpError(401, "Token expired");
    throw httpError(401, "Invalid token");
  }
  if (payload.type !== "access") throw httpError(401, "Invalid token");
  const found = (await col("users").findOne({ id: payload.sub })) as Doc | null;
  if (!found || found.is_active === false) throw httpError(401, "User not found");
  return clean(found) as Doc;
}

/** Express guard: authenticates and, when roles are given, enforces them (403). */
export function auth(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    currentUser(req)
      .then((user) => {
        if (roles.length && !roles.includes(user.role)) {
          throw httpError(403, "Insufficient permissions");
        }
        req.user = user;
        next();
      })
      .catch(next);
  };
}

/** The authenticated user for a route mounted behind `auth()`. */
export function user(req: Request): Doc {
  if (!req.user) throw httpError(401, "Not authenticated");
  return req.user;
}
