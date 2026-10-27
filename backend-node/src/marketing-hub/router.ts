/** Marketing Hub API — SUPER_ADMIN writes; ADMIN/SUPER_ADMIN reads. */

import { Router } from "express";
import multer from "multer";
import { z } from "zod";

import { handler, httpError, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import {
  approveAsset,
  assetSummary,
  bulkImportAssets,
  ensureAssetIndexes,
  getAsset,
  listAssets,
  readAssetBinary,
  uploadAsset,
} from "./assets";
import { buildAttributionReport, ensureAttributionIndexes, recordAttribution } from "./attribution";
import { scanDraftClaims } from "./claims";
import {
  BRAND,
  MARKETING_TARGETS,
  PLATFORM_IDS,
  PROPOSED_STARTING_PRICES,
  generationApiKey,
  marketingFixtureMode,
  marketingHubEnabled,
  marketingHubPausedEnv,
  organicPublishAuthorised,
  type PlatformId,
} from "./config";
import { buildDashboard } from "./dashboard";
import { buildTikTokManualPack, runDailyEngine } from "./engine";
import {
  advanceDraft,
  attemptPlatformPublish,
  emergencyPause,
  listAudit,
  workflowLabel,
} from "./publishing";
import { buildSeoReport } from "./seo";
import {
  appendAudit,
  ensureMarketingIndexes,
  getDraft,
  getTemplateLibrary,
  isMarketingPaused,
  listConnections,
  listDrafts,
  upsertConnection,
} from "./store";
import { assertNoFalseApprovals, templatesByBatch } from "./templates";

export const marketingHubRouter = Router();

const STAFF = ["ADMIN", "SUPER_ADMIN"] as const;
const SUPER = ["SUPER_ADMIN"] as const;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 20 },
});

function requireEnabled() {
  if (!marketingHubEnabled()) throw httpError(503, "Marketing Hub is disabled");
}

function actorOf(req: Parameters<typeof authed>[0]): string {
  return String(authed(req).email ?? authed(req).id);
}

marketingHubRouter.get(
  "/marketing-hub/status",
  auth(...STAFF),
  handler(async (_req, res) => {
    requireEnabled();
    const paused = await isMarketingPaused();
    const fixture = marketingFixtureMode();
    const hasKey = Boolean(generationApiKey());
    res.json({
      enabled: marketingHubEnabled(),
      paused,
      pausedEnv: marketingHubPausedEnv(),
      fixtureMode: fixture,
      generation: {
        mode: fixture ? "fixture_demo" : hasKey ? "real_ready" : "disconnected",
        hasApiKey: hasKey,
        note: fixture
          ? "Fixture demo mode — drafts are labelled fixture_demo, not live AI output."
          : hasKey
            ? "Real generation configured (key present). Calls will hit the generation API."
            : "Disconnected — FIXTURE_MODE=false but no MARKETING_HUB_GENERATION_API_KEY. Engine will not simulate success.",
      },
      organicPublishAuthorised: organicPublishAuthorised(),
      livePublishing: "disabled_until_authorised",
      brand: BRAND,
      targets: MARKETING_TARGETS,
      proposedStartingPrices: PROPOSED_STARTING_PRICES,
      featureMatrix: {
        dashboard_metrics: "implemented",
        fixture_engine: "implemented",
        real_generation: hasKey && !fixture ? "implemented" : "blocked_missing_credentials",
        asset_uploads: "implemented",
        oauth_live: "blocked_missing_credentials",
        live_publishing: "disabled",
        gsc_ga4_sync: "disconnected",
        utm_attribution_api: "implemented",
        utm_live_traffic: "untested_until_staging",
      },
      message:
        "Not production-ready. Live publishing stays disabled until staging verifies OAuth confirmations.",
    });
  }),
);

marketingHubRouter.get(
  "/marketing-hub/dashboard",
  auth(...STAFF),
  handler(async (_req, res) => {
    requireEnabled();
    const [dash, attr] = await Promise.all([buildDashboard(), buildAttributionReport()]);
    res.json({ ...dash, attribution: attr });
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
    const assets = await listAssets();
    const byId = new Map(assets.map((a) => [a.id, a]));
    const items = filtered.map((t) => {
      const assetId = t.id.replace(/^tmpl-/, "TS-");
      const asset = byId.get(assetId);
      return {
        ...t,
        assetId,
        linkedAsset: asset
          ? {
              id: asset.id,
              approvalStatus: asset.approvalStatus,
              isFinishedArtwork: asset.isFinishedArtwork,
              width: asset.width,
              height: asset.height,
            }
          : null,
      };
    });
    res.json({
      total: templates.length,
      batches: 12,
      batchSize: 10,
      items,
      byBatch: templatesByBatch(templates),
      note: "Placeholder templates are never finished artwork. Approve uploads on TS-001…TS-120 first.",
    });
  }),
);

marketingHubRouter.get(
  "/marketing-hub/drafts",
  auth(...STAFF),
  handler(async (_req, res) => {
    requireEnabled();
    const items = (await listDrafts(100)).map((d) => ({
      ...d,
      workflowLabel: d.workflowLabel || workflowLabel(d.stage),
      claimIssues: scanDraftClaims(d),
    }));
    res.json({ items });
  }),
);

marketingHubRouter.post(
  "/marketing-hub/engine/run-daily",
  auth(...SUPER),
  handler(async (req, res) => {
    requireEnabled();
    const result = await runDailyEngine(actorOf(req));
    const status = result.generationStatus === "disconnected" ? 409 : 200;
    res.status(status).json({
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
    try {
      const draft = await advanceDraft(req.params.id, body.stage, actorOf(req), body.detail);
      res.json({ draft: { ...draft, workflowLabel: workflowLabel(draft.stage) } });
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
    try {
      const draft = await attemptPlatformPublish(req.params.id, actorOf(req), body.platforms as PlatformId[]);
      res.json({
        draft,
        note: "Published only when a platform returns a confirmation id. Live publishing is disabled by default.",
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
  "/marketing-hub/attribution",
  auth(...STAFF),
  handler(async (_req, res) => {
    requireEnabled();
    res.json(await buildAttributionReport());
  }),
);

const AttrIn = z.object({
  kind: z.enum(["lead_registration", "checkout_started", "payment_confirmed"]),
  utm_source: z.string().max(200).optional(),
  utm_medium: z.string().max(200).optional(),
  utm_campaign: z.string().max(200).optional(),
  utm_content: z.string().max(200).optional(),
  utm_term: z.string().max(200).optional(),
  gclid: z.string().max(200).optional(),
  landing_page: z.string().max(200).optional(),
  service: z.enum(["SA", "MTD", "UNKNOWN"]).optional(),
  plan_id: z.string().max(200).optional(),
  user_id: z.string().max(200).optional(),
  session_id: z.string().max(200).optional(),
  amount_gbp: z.number().nonnegative().optional(),
  currency: z.string().max(8).optional(),
});

/**
 * Public lead/checkout attribution (non-PII only).
 * payment_confirmed is NOT accepted here — requires authenticated Stripe confirmation path.
 */
marketingHubRouter.post(
  "/marketing-hub/attribution/public",
  handler(async (req, res) => {
    requireEnabled();
    const body = parseBody(AttrIn, req.body);
    if (body.kind === "payment_confirmed") {
      throw httpError(400, "payment_confirmed requires authenticated /marketing-hub/attribution");
    }
    const result = await recordAttribution(body.kind, { ...body, user_id: undefined }, "public:utm");
    res.json(result);
  }),
);

/** Authenticated client or staff may record non-PII attribution including payments. */
marketingHubRouter.post(
  "/marketing-hub/attribution",
  auth("CLIENT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    requireEnabled();
    const body = parseBody(AttrIn, req.body);
    const me = authed(req);
    const result = await recordAttribution(
      body.kind,
      {
        ...body,
        user_id: body.user_id || String(me.id),
      },
      String(me.email ?? me.id),
    );
    res.json(result);
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
        "OAuth only when platform client IDs are configured. Until then status remains Not Connected — never simulated Connected.",
    });
  }),
);

const ConnectIn = z.object({
  platform: z.enum(PLATFORM_IDS),
  /** Staging UI harness — does NOT mark Connected with credentials. */
  mockUiPreview: z.boolean().optional(),
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
        status: "manual_only",
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
      if (body.mockUiPreview) {
        const conn = await upsertConnection(body.platform, {
          status: "error",
          displayName: `UI preview only — ${body.platform}`,
          lastError: "Mock UI preview — not a real connection. hasCredentials=false.",
          hasCredentials: false,
        });
        await appendAudit(actorOf(req), "mock_ui_preview", body.platform);
        res.json({
          platform: body.platform,
          mode: "mock_ui_preview",
          status: "not_connected",
          connection: conn,
          warning: "Preview only. Not Connected. Live publishing remains impossible.",
        });
        return;
      }
      res.json({
        platform: body.platform,
        mode: "disconnected",
        status: "not_connected",
        message: `Not Connected — set ${envName} (and secret) for official OAuth.`,
      });
      return;
    }

    res.json({
      platform: body.platform,
      mode: "oauth_ready",
      status: "not_connected",
      authorizeHint: `Use official ${body.platform} OAuth with ${envName}; store refresh tokens encrypted server-side.`,
      message: "Client ID present. Complete OAuth callback on staging before Connected+credentials.",
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
    await appendAudit(actorOf(req), "disconnect", platform);
    res.json({ connection: conn });
  }),
);

marketingHubRouter.post(
  "/marketing-hub/pause",
  auth(...SUPER),
  handler(async (req, res) => {
    requireEnabled();
    const paused = req.body?.paused !== false;
    const result = await emergencyPause(actorOf(req), paused);
    res.json({
      ...result,
      envInstruction: "Also set MARKETING_HUB_PAUSED=true on the API instance for deploy-level kill switch.",
    });
  }),
);

marketingHubRouter.get(
  "/marketing-hub/audit",
  auth(...STAFF),
  handler(async (req, res) => {
    requireEnabled();
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    res.json({ items: await listAudit(limit) });
  }),
);

/* ——— Assets TS-001…TS-120 ——— */

marketingHubRouter.get(
  "/marketing-hub/assets",
  auth(...STAFF),
  handler(async (_req, res) => {
    requireEnabled();
    const [items, summary] = await Promise.all([listAssets(), assetSummary()]);
    res.json({ items, summary });
  }),
);

marketingHubRouter.get(
  "/marketing-hub/assets/:id/preview",
  auth(...STAFF),
  handler(async (req, res) => {
    requireEnabled();
    const bin = await readAssetBinary(req.params.id);
    if (!bin) throw httpError(404, "No uploaded asset for this slot");
    res.setHeader("Content-Type", bin.contentType);
    res.setHeader("Content-Disposition", `inline; filename="${bin.filename.replace(/"/g, "")}"`);
    res.send(bin.data);
  }),
);

marketingHubRouter.post(
  "/marketing-hub/assets/:id/upload",
  auth(...SUPER),
  upload.single("file"),
  handler(async (req, res) => {
    requireEnabled();
    const m = /^TS-(\d{3})$/.exec(req.params.id);
    if (!m) throw httpError(400, "Asset id must be TS-001 … TS-120");
    const slot = Number(m[1]);
    const file = req.file;
    if (!file) throw httpError(400, "file field required");
    try {
      const asset = await uploadAsset({
        slot,
        file: {
          buffer: file.buffer,
          mimetype: file.mimetype,
          originalname: file.originalname,
          size: file.size,
        },
        actor: actorOf(req),
        notes: typeof req.body?.notes === "string" ? req.body.notes : undefined,
      });
      res.json({ asset });
    } catch (e) {
      throw httpError(400, e instanceof Error ? e.message : "Upload failed");
    }
  }),
);

marketingHubRouter.post(
  "/marketing-hub/assets/bulk-import",
  auth(...SUPER),
  upload.array("files", 20),
  handler(async (req, res) => {
    requireEnabled();
    const files = req.files as Array<{
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    }> | undefined;
    if (!files?.length) throw httpError(400, "files[] required");
    // Optional slots[] parallel to files, else parse TS-NNN from filename
    const slotsRaw = req.body?.slots;
    const slots: number[] = Array.isArray(slotsRaw)
      ? slotsRaw.map(Number)
      : typeof slotsRaw === "string"
        ? slotsRaw.split(",").map((s) => Number(s.trim()))
        : files.map((f, i) => {
            const m = /TS-(\d{3})/i.exec(f.originalname);
            return m ? Number(m[1]) : i + 1;
          });
    const items = files.map((f, i) => ({
      slot: slots[i] || i + 1,
      file: {
        buffer: f.buffer,
        mimetype: f.mimetype,
        originalname: f.originalname,
        size: f.size,
      },
    }));
    const result = await bulkImportAssets(items, actorOf(req));
    res.json(result);
  }),
);

marketingHubRouter.post(
  "/marketing-hub/assets/:id/approve",
  auth(...SUPER),
  handler(async (req, res) => {
    requireEnabled();
    const approve = req.body?.approve !== false;
    try {
      const asset = await approveAsset(req.params.id, actorOf(req), approve);
      if (approve && !asset.isFinishedArtwork) {
        throw httpError(400, "Approved flag did not stick — upload missing?");
      }
      res.json({ asset });
    } catch (e) {
      throw httpError(400, e instanceof Error ? e.message : "Approval failed");
    }
  }),
);

marketingHubRouter.get(
  "/marketing-hub/assets/:id",
  auth(...STAFF),
  handler(async (req, res) => {
    requireEnabled();
    const asset = await getAsset(req.params.id);
    if (!asset) throw httpError(404, "Unknown asset id");
    res.json({ asset });
  }),
);

export async function ensureMarketingHubBoot(): Promise<void> {
  await ensureMarketingIndexes();
  await ensureAssetIndexes();
  await ensureAttributionIndexes();
}

export { ensureMarketingIndexes };
