/** Marketing Hub API — SUPER_ADMIN (and ADMIN read for dashboard). */

import { Router } from "express";
import { z } from "zod";

import { handler, httpError, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import {
  BRAND,
  MARKETING_TARGETS,
  PLATFORM_IDS,
  PROPOSED_STARTING_PRICES,
  marketingFixtureMode,
  marketingHubEnabled,
  marketingHubPaused,
  organicPublishAuthorised,
  type PlatformId,
} from "./config";
import { buildDashboard } from "./dashboard";
import { buildTikTokManualPack, runDailyEngine } from "./engine";
import { advanceDraft, attemptPlatformPublish, globalPause } from "./publishing";
import { buildSeoReport } from "./seo";
import {
  appendAudit,
  ensureMarketingIndexes,
  getDraft,
  getTemplateLibrary,
  listConnections,
  listDrafts,
  upsertConnection,
} from "./store";
import { assertNoFalseApprovals, templatesByBatch } from "./templates";

export const marketingHubRouter = Router();

const STAFF = ["ADMIN", "SUPER_ADMIN"] as const;
const SUPER = ["SUPER_ADMIN"] as const;

function requireEnabled() {
  if (!marketingHubEnabled()) throw httpError(503, "Marketing Hub is disabled");
}

marketingHubRouter.get(
  "/marketing-hub/status",
  auth(...STAFF),
  handler(async (_req, res) => {
    requireEnabled();
    res.json({
      enabled: marketingHubEnabled(),
      paused: marketingHubPaused(),
      fixtureMode: marketingFixtureMode(),
      organicPublishAuthorised: organicPublishAuthorised(),
      brand: BRAND,
      targets: MARKETING_TARGETS,
      proposedStartingPrices: PROPOSED_STARTING_PRICES,
      message:
        "Not production-ready until staging verifies real OAuth, publishing confirmations and attribution.",
    });
  }),
);

marketingHubRouter.get(
  "/marketing-hub/dashboard",
  auth(...STAFF),
  handler(async (_req, res) => {
    requireEnabled();
    res.json(await buildDashboard());
  }),
);

marketingHubRouter.get(
  "/marketing-hub/templates",
  auth(...STAFF),
  handler(async (req, res) => {
    requireEnabled();
    const templates = getTemplateLibrary();
    assertNoFalseApprovals(templates);
    const batch = typeof req.query.batch === "string" ? Number(req.query.batch) : undefined;
    const filtered = batch && Number.isFinite(batch) ? templates.filter((t) => t.batch === batch) : templates;
    res.json({
      total: templates.length,
      batches: 12,
      batchSize: 10,
      items: filtered,
      byBatch: templatesByBatch(templates),
      note: "No template is marked approved while artwork is missing.",
    });
  }),
);

marketingHubRouter.get(
  "/marketing-hub/drafts",
  auth(...STAFF),
  handler(async (_req, res) => {
    requireEnabled();
    res.json({ items: await listDrafts(100) });
  }),
);

marketingHubRouter.post(
  "/marketing-hub/engine/run-daily",
  auth(...SUPER),
  handler(async (req, res) => {
    requireEnabled();
    const actor = String(authed(req).email ?? authed(req).id);
    const result = await runDailyEngine(actor);
    res.json({
      ...result,
      searchDemandNote:
        "Real search-demand evidence requires connected GSC. Until then evidence is labelled unavailable.",
    });
  }),
);

const AdvanceIn = z.object({
  stage: z.enum([
    "ai_draft",
    "content_qa",
    "approval",
    "scheduled",
    "platform_publishing",
    "confirmed_published",
    "failed",
    "paused",
  ]),
  detail: z.string().optional(),
});

marketingHubRouter.post(
  "/marketing-hub/drafts/:id/advance",
  auth(...SUPER),
  handler(async (req, res) => {
    requireEnabled();
    const body = parseBody(AdvanceIn, req.body);
    const actor = String(authed(req).email ?? authed(req).id);
    try {
      const draft = await advanceDraft(req.params.id, body.stage, actor, body.detail);
      res.json({ draft });
    } catch (e) {
      throw httpError(400, e instanceof Error ? e.message : "Advance failed");
    }
  }),
);

const PublishIn = z.object({
  platforms: z.array(z.enum(PLATFORM_IDS)).min(1),
});

marketingHubRouter.post(
  "/marketing-hub/drafts/:id/publish",
  auth(...SUPER),
  handler(async (req, res) => {
    requireEnabled();
    const body = parseBody(PublishIn, req.body);
    const actor = String(authed(req).email ?? authed(req).id);
    try {
      const draft = await attemptPlatformPublish(req.params.id, actor, body.platforms as PlatformId[]);
      res.json({
        draft,
        note: "Published is only set when a platform returns a confirmation id. Mocks never count as live publish.",
      });
    } catch (e) {
      throw httpError(400, e instanceof Error ? e.message : "Publish failed");
    }
  }),
);

marketingHubRouter.get(
  "/marketing-hub/drafts/:id/tiktok-pack",
  auth(...STAFF),
  handler(async (req, res) => {
    requireEnabled();
    const draft = await getDraft(req.params.id);
    if (!draft) throw httpError(404, "Draft not found");
    res.json(buildTikTokManualPack(draft));
  }),
);

marketingHubRouter.get(
  "/marketing-hub/seo",
  auth(...STAFF),
  handler(async (_req, res) => {
    requireEnabled();
    res.json(await buildSeoReport());
  }),
);

marketingHubRouter.get(
  "/marketing-hub/connections",
  auth(...STAFF),
  handler(async (_req, res) => {
    requireEnabled();
    res.json({
      items: await listConnections(),
      oauthNote:
        "OAuth authorisation URLs are issued only when platform client IDs are configured in env. Until then status remains Not Connected.",
    });
  }),
);

const ConnectIn = z.object({
  platform: z.enum(PLATFORM_IDS),
  /** Staging harness only — marks a mock connection for UI testing. Never enables live publish. */
  mockConnect: z.boolean().optional(),
});

marketingHubRouter.post(
  "/marketing-hub/connections/begin",
  auth(...SUPER),
  handler(async (req, res) => {
    requireEnabled();
    const body = parseBody(ConnectIn, req.body);
    if (body.platform === "tiktok_manual") {
      res.json({
        platform: body.platform,
        mode: "manual_only",
        message: "TikTok is manual only. Use draft TikTok packs — no OAuth.",
      });
      return;
    }

    const clientIdEnv: Record<string, string> = {
      facebook_pages: "META_APP_ID",
      instagram_professional: "META_APP_ID",
      linkedin_company: "LINKEDIN_CLIENT_ID",
      google_ads: "GOOGLE_ADS_CLIENT_ID",
      google_search_console: "GOOGLE_OAUTH_CLIENT_ID",
      google_analytics_4: "GOOGLE_OAUTH_CLIENT_ID",
    };
    const envName = clientIdEnv[body.platform];
    const clientId = envName ? process.env[envName] : undefined;

    if (!clientId) {
      if (body.mockConnect) {
        const conn = await upsertConnection(body.platform, {
          status: "connected",
          displayName: `Mock ${body.platform}`,
          lastSyncAt: new Date().toISOString(),
          hasCredentials: false,
        });
        await appendAudit(String(authed(req).email ?? authed(req).id), "mock_connect", body.platform);
        res.json({
          platform: body.platform,
          mode: "mock_ui_only",
          connection: conn,
          warning:
            "Mock connection for UI/testing only. hasCredentials=false — live publishing remains blocked.",
        });
        return;
      }
      res.json({
        platform: body.platform,
        mode: "not_configured",
        status: "not_connected",
        message: `Set ${envName} (and secret) to begin official OAuth. Currently Not Connected.`,
      });
      return;
    }

    // Return a structured auth intent — actual redirect URI wiring is staging-configured.
    res.json({
      platform: body.platform,
      mode: "oauth_ready",
      authorizeHint: `Use official ${body.platform} OAuth with client ${envName}; store refresh tokens encrypted server-side.`,
      status: "not_connected",
      message: "Client ID present. Complete OAuth callback wiring on staging before marking Connected with credentials.",
    });
  }),
);

marketingHubRouter.post(
  "/marketing-hub/connections/:platform/disconnect",
  auth(...SUPER),
  handler(async (req, res) => {
    requireEnabled();
    const platform = req.params.platform as PlatformId;
    if (!PLATFORM_IDS.includes(platform)) throw httpError(400, "Unknown platform");
    const conn = await upsertConnection(platform, {
      status: platform === "tiktok_manual" ? "manual_only" : "not_connected",
      hasCredentials: false,
      lastError: undefined,
      displayName: platform === "tiktok_manual" ? "TikTok (manual posting packs)" : undefined,
    });
    await appendAudit(String(authed(req).email ?? authed(req).id), "disconnect", platform);
    res.json({ connection: conn });
  }),
);

marketingHubRouter.post(
  "/marketing-hub/pause",
  auth(...SUPER),
  handler(async (req, res) => {
    requireEnabled();
    await globalPause(String(authed(req).email ?? authed(req).id));
    res.json({
      ok: true,
      instruction: "Set MARKETING_HUB_PAUSED=true on the API instance for a durable kill switch.",
    });
  }),
);

export { ensureMarketingIndexes };
