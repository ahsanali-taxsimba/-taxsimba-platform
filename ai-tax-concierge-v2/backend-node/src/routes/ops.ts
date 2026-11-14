/** Ops endpoints for HMRC monitor + catalogue sync (token-protected). */

import { Router } from "express";
import { requireOpsToken } from "../ops/auth.js";
import {
  approveQuarantine,
  hmrcStatus,
  listQuarantine,
  rejectQuarantine,
  rollbackPublishedOverlay,
  runHmrcMonitorCycle,
} from "../knowledge/monitor/service.js";
import {
  catalogSyncStatus,
  rollbackCatalogueOverlay,
  syncCatalogueFromUpstream,
} from "../catalog/sync/service.js";
import { ConciergeError } from "../core/errors.js";

export function opsRouter(): Router {
  const router = Router();
  router.use(requireOpsToken);

  router.get("/ops/hmrc/status", (_req, res) => {
    res.json(hmrcStatus());
  });

  router.post("/ops/hmrc/run", async (_req, res, next) => {
    try {
      const result = await runHmrcMonitorCycle();
      res.json({ ok: true, result });
    } catch (err) {
      next(err);
    }
  });

  router.get("/ops/hmrc/quarantine", (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json({ items: listQuarantine(status) });
  });

  router.post("/ops/hmrc/quarantine/:id/approve", (req, res, next) => {
    try {
      const overlay = approveQuarantine(req.params.id, {
        accountant_note: String(req.body?.accountant_note || ""),
        fact_patches: Array.isArray(req.body?.fact_patches)
          ? req.body.fact_patches
          : undefined,
      });
      res.json({ ok: true, overlay });
    } catch (err) {
      next(
        new ConciergeError((err as Error).message, {
          code: "quarantine_approve_failed",
          statusCode: 400,
        }),
      );
    }
  });

  router.post("/ops/hmrc/quarantine/:id/reject", (req, res, next) => {
    try {
      const item = rejectQuarantine(
        req.params.id,
        String(req.body?.accountant_note || ""),
      );
      res.json({ ok: true, item });
    } catch (err) {
      next(
        new ConciergeError((err as Error).message, {
          code: "quarantine_reject_failed",
          statusCode: 400,
        }),
      );
    }
  });

  router.post("/ops/hmrc/rollback", (_req, res) => {
    res.json({ ok: true, ...rollbackPublishedOverlay() });
  });

  router.get("/ops/catalog/status", (_req, res) => {
    res.json(catalogSyncStatus());
  });

  router.post("/ops/catalog/sync", async (_req, res, next) => {
    try {
      const result = await syncCatalogueFromUpstream();
      res.json({ ok: true, result });
    } catch (err) {
      next(err);
    }
  });

  router.post("/ops/catalog/rollback", (_req, res) => {
    res.json({ ok: true, ...rollbackCatalogueOverlay() });
  });

  return router;
}
