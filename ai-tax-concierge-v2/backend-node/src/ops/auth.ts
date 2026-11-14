/** Ops-route auth — staging/admin token only; never expose in bootstrap. */

import type { Request, Response, NextFunction } from "express";

export function opsTokenConfigured(): boolean {
  return Boolean(process.env.CONCIERGE_OPS_TOKEN?.trim());
}

export function requireOpsToken(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.CONCIERGE_OPS_TOKEN?.trim();
  if (!expected) {
    res.status(503).json({
      error: {
        code: "ops_token_not_configured",
        message:
          "CONCIERGE_OPS_TOKEN is not set. Dynamic ops endpoints are disabled until configured in staging secrets.",
        details: {},
      },
    });
    return;
  }
  const provided =
    String(req.header("x-concierge-ops-token") || "").trim() ||
    String(req.query.ops_token || "").trim();
  if (!provided || provided !== expected) {
    res.status(401).json({
      error: {
        code: "unauthorized",
        message: "Invalid or missing ops token",
        details: {},
      },
    });
    return;
  }
  next();
}
