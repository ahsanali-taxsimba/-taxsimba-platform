/**
 * Operational controls for HMRC content automation.
 * SUPER_ADMIN for mutating controls; authenticated staff can read status.
 */
import { Router } from "express";
import { z } from "zod";

import {
  runDemoNewArticle,
  runDemoUpdateExisting,
  runDailyContentAutomation,
} from "../content-automation/pipeline/dailyRun";
import { advanceJob } from "../content-automation/pipeline/runJob";
import {
  CONTENT_AUTOMATION_SECRET_NAMES,
  contentAutomationEnabled,
  contentAutomationPaused,
} from "../content-automation/config";
import {
  exportBackup,
  getJob,
  listAlerts,
  listLiveOverlays,
  restoreBackup,
  rollbackLive,
} from "../content-automation/store";
import { runContentAutomationNow } from "../content-automation/worker";
import { handler, httpError, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";

export const contentAutomationRouter = Router();

contentAutomationRouter.get(
  "/content-automation/status",
  auth("ADMIN", "SUPER_ADMIN", "ACCOUNTANT"),
  handler(async (_req, res) => {
    const live = await listLiveOverlays();
    const alerts = await listAlerts(20);
    res.json({
      enabled: contentAutomationEnabled(),
      paused: contentAutomationPaused(),
      secretNames: CONTENT_AUTOMATION_SECRET_NAMES,
      liveOverlayCount: live.length,
      liveSlugs: live.map((l) => l.slug),
      recentAlerts: alerts,
      schedule: "08:00 Europe/London daily when CONTENT_AUTOMATION_ENABLED=true",
    });
  }),
);

contentAutomationRouter.post(
  "/content-automation/run-now",
  auth("SUPER_ADMIN"),
  handler(async (_req, res) => {
    const result = await runContentAutomationNow();
    res.json({ ok: true, result });
  }),
);

contentAutomationRouter.post(
  "/content-automation/demo/new-article",
  auth("SUPER_ADMIN"),
  handler(async (_req, res) => {
    const job = await runDemoNewArticle();
    res.json({ ok: true, job });
  }),
);

contentAutomationRouter.post(
  "/content-automation/demo/update-article",
  auth("SUPER_ADMIN"),
  handler(async (_req, res) => {
    const job = await runDemoUpdateExisting();
    res.json({ ok: true, job });
  }),
);

contentAutomationRouter.post(
  "/content-automation/jobs/:jobId/advance",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const job = await advanceJob(req.params.jobId);
    if (!job) throw httpError(409, "Job could not be claimed or found");
    res.json({ ok: true, job });
  }),
);

contentAutomationRouter.get(
  "/content-automation/jobs/:jobId",
  auth("ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const job = await getJob(req.params.jobId);
    if (!job) throw httpError(404, "Job not found");
    res.json(job);
  }),
);

contentAutomationRouter.post(
  "/content-automation/rollback/:slug",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const body = parseBody(
      z.object({ previousRevisionId: z.string().nullable(), jobId: z.string() }),
      req.body,
    );
    const ok = await rollbackLive(req.params.slug, body.previousRevisionId, body.jobId);
    if (!ok) throw httpError(404, "Nothing to roll back");
    res.json({ ok: true });
  }),
);

contentAutomationRouter.get(
  "/content-automation/backup",
  auth("SUPER_ADMIN"),
  handler(async (_req, res) => {
    res.json(await exportBackup());
  }),
);

contentAutomationRouter.post(
  "/content-automation/backup/restore",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    await restoreBackup(req.body || {});
    res.json({ ok: true, restoredBy: me.id });
  }),
);

contentAutomationRouter.post(
  "/content-automation/rehearse-daily",
  auth("SUPER_ADMIN"),
  handler(async (_req, res) => {
    const result = await runDailyContentAutomation(new Date(), { ignoreEnabledFlag: true });
    res.json(result);
  }),
);
