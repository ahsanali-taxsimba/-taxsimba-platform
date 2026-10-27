/**
 * Marketing Hub API integration tests.
 * LABEL: fixture / mocked credentials — does NOT verify live platform publishing.
 */
import { readFileSync } from "fs";
import path from "path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";

import { bootTestApp, dropTestDb, makeUser, ORIGIN } from "../helpers/app";

describe("marketing hub API (fixture / mocked — not live publish)", () => {
  let app: Express;
  let superToken: string;
  let adminToken: string;
  let clientToken: string;

  beforeAll(async () => {
    process.env.MARKETING_HUB_ENABLED = "true";
    process.env.MARKETING_HUB_PAUSED = "false";
    process.env.MARKETING_HUB_FIXTURE_MODE = "true";
    process.env.MARKETING_HUB_ORGANIC_PUBLISH_AUTHORISED = "false";
    process.env.MARKETING_HUB_DAILY_DRAFT_LIMIT = "50";
    delete process.env.MARKETING_HUB_GENERATION_API_KEY;
    process.env.STORAGE_DRIVER = "local";
    const boot = await bootTestApp();
    app = boot.app;
    superToken = (await makeUser("SUPER_ADMIN", "mh-super")).token;
    adminToken = (await makeUser("ADMIN", "mh-admin")).token;
    clientToken = (await makeUser("CLIENT", "mh-client")).token;
  }, 120_000);

  afterAll(async () => {
    await dropTestDb();
  });

  it("status distinguishes fixture vs disconnected real mode", async () => {
    const res = await request(app)
      .get("/api/marketing-hub/status")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.generation.mode).toBe("fixture_demo");
    expect(res.body.organicPublishAuthorised).toBe(false);
    expect(res.body.livePublishing).toBe("disabled_until_authorised");
    expect(res.body.brand.logoSource).toContain("logo.svg");
  });

  it("ADMIN can read dashboard; accountant denied", async () => {
    const ok = await request(app)
      .get("/api/marketing-hub/dashboard")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(ok.status).toBe(200);
    const traffic = ok.body.metrics.find((m: { key: string }) => m.key === "website_traffic");
    expect(traffic.value).toBeNull();
    expect(["not_connected", "no_data"]).toContain(traffic.state);
    expect(ok.body.attribution).toBeTruthy();
    expect(ok.body.attribution.leads).toBeTypeOf("number");

    const accountant = await makeUser("ACCOUNTANT", "mh-acct");
    const denied = await request(app)
      .get("/api/marketing-hub/dashboard")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${accountant.token}`);
    expect(denied.status).toBe(403);
  });

  it("returns disconnected (409) when real mode has no API key — no simulated drafts", async () => {
    process.env.MARKETING_HUB_FIXTURE_MODE = "false";
    delete process.env.MARKETING_HUB_GENERATION_API_KEY;
    const res = await request(app)
      .post("/api/marketing-hub/engine/run-daily")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(409);
    expect(res.body.generationStatus).toBe("disconnected");
    expect(res.body.created).toEqual([]);
    process.env.MARKETING_HUB_FIXTURE_MODE = "true";
  });

  it("fixture engine + workflow Draft→Review→Approved→Scheduled; live publish blocked", async () => {
    const run = await request(app)
      .post("/api/marketing-hub/engine/run-daily")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`);
    expect(run.status).toBe(200);
    expect(run.body.generationStatus).toBe("fixture_demo");
    expect(run.body.created.length).toBeGreaterThan(0);
    expect(run.body.created[0].fixtureMode).toBe(true);
    expect(run.body.created[0].workflowLabel).toBe("Draft");

    const id = run.body.created[0].id;
    await request(app)
      .post(`/api/marketing-hub/drafts/${id}/advance`)
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ stage: "content_qa" })
      .expect(200);
    await request(app)
      .post(`/api/marketing-hub/drafts/${id}/advance`)
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ stage: "approval" })
      .expect(200);
    const scheduled = await request(app)
      .post(`/api/marketing-hub/drafts/${id}/advance`)
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ stage: "scheduled" });
    expect(scheduled.status).toBe(200);
    expect(scheduled.body.draft.workflowLabel).toBe("Scheduled");

    const pub = await request(app)
      .post(`/api/marketing-hub/drafts/${id}/publish`)
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ platforms: ["facebook_pages"] });
    expect(pub.status).toBe(400);
    expect(String(pub.body.detail || "")).toMatch(/disabled|not authorised|ORGANIC/i);

    const audit = await request(app)
      .get("/api/marketing-hub/audit")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`);
    expect(audit.status).toBe(200);
    expect(audit.body.items.length).toBeGreaterThan(0);
  });

  it("blocks unsupported HMRC endorsement claims before schedule", async () => {
    const { insertDraft } = await import("../../src/marketing-hub/store");
    const bad = await insertDraft({
      id: "draft-claim-block-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stage: "approval",
      focus: "SELF_ASSESSMENT",
      title: "Bad claim",
      caption: "We are HMRC approved",
      copyLong: "HMRC approved service",
      sources: [],
      nation: "UK",
      fixtureMode: true,
      artworkApproved: false,
      approvedBy: "tester",
      approvedAt: new Date().toISOString(),
      workflowLabel: "Approved",
      audit: [],
    });
    const res = await request(app)
      .post(`/api/marketing-hub/drafts/${bad.id}/advance`)
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ stage: "scheduled" });
    expect(res.status).toBe(400);
    expect(String(res.body.detail || "")).toMatch(/HMRC endorsement/i);
  });

  it("uploads TS-001 asset, keeps pending until approve; placeholders not finished", async () => {
    const png = readFileSync(path.join(__dirname, "../fixtures/marketing-asset-1080.png"));
    const up = await request(app)
      .post("/api/marketing-hub/assets/TS-001/upload")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`)
      .attach("file", png, "hero-original.png");
    expect(up.status).toBe(200);
    expect(up.body.asset.id).toBe("TS-001");
    expect(up.body.asset.originalFilename).toBe("hero-original.png");
    expect(up.body.asset.width).toBe(1080);
    expect(up.body.asset.approvalStatus).toBe("pending_review");
    expect(up.body.asset.isFinishedArtwork).toBe(false);

    const list = await request(app)
      .get("/api/marketing-hub/assets")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.summary.totalSlots).toBe(120);
    expect(list.body.items[0].isFinishedArtwork).toBe(false);

    const approve = await request(app)
      .post("/api/marketing-hub/assets/TS-001/approve")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ approve: true });
    expect(approve.status).toBe(200);
    expect(approve.body.asset.isFinishedArtwork).toBe(true);
    expect(approve.body.asset.approvalStatus).toBe("approved");

    const preview = await request(app)
      .get("/api/marketing-hub/assets/TS-001/preview")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(preview.status).toBe(200);
    expect(preview.headers["content-type"]).toMatch(/image/);
  });

  it("rejects low-resolution uploads", async () => {
    // 1x1 png
    const tiny = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const res = await request(app)
      .post("/api/marketing-hub/assets/TS-002/upload")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`)
      .attach("file", tiny, "tiny.png");
    expect(res.status).toBe(400);
    expect(String(res.body.detail || "")).toMatch(/1080|High-resolution/i);
  });

  it("connections stay Not Connected; UI preview is not Connected", async () => {
    const res = await request(app)
      .get("/api/marketing-hub/connections")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    const fb = res.body.items.find((i: { platform: string }) => i.platform === "facebook_pages");
    expect(fb.status).toBe("not_connected");

    const preview = await request(app)
      .post("/api/marketing-hub/connections/begin")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ platform: "facebook_pages", mockUiPreview: true });
    expect(preview.status).toBe(200);
    expect(preview.body.warning).toMatch(/Not Connected/i);
    expect(preview.body.connection.hasCredentials).toBe(false);
  });

  it("seo preserves 120 guides; GSC/GA4 disconnected", async () => {
    const res = await request(app)
      .get("/api/marketing-hub/seo")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.articlePreservation.found).toBe(120);
    expect(res.body.articlePreservation.ok).toBe(true);
    expect(res.body.google.searchConsole).toBe("not_connected");
    expect(res.body.google.analytics4).toBe("not_connected");
  });

  it("records public lead attribution and authenticated payment attribution with dedupe", async () => {
    const lead = await request(app)
      .post("/api/marketing-hub/attribution/public")
      .set("Origin", ORIGIN)
      .send({
        kind: "lead_registration",
        utm_campaign: "sa-spring",
        utm_source: "google",
        service: "SA",
      });
    expect(lead.status).toBe(200);
    expect(lead.body.recorded).toBe(true);

    const pay1 = await request(app)
      .post("/api/marketing-hub/attribution")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        kind: "payment_confirmed",
        session_id: "cs_test_attr_1",
        amount_gbp: 119,
        utm_campaign: "sa-spring",
        service: "SA",
      });
    expect(pay1.status).toBe(200);
    expect(pay1.body.recorded).toBe(true);

    const pay2 = await request(app)
      .post("/api/marketing-hub/attribution")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        kind: "payment_confirmed",
        session_id: "cs_test_attr_1",
        amount_gbp: 119,
        utm_campaign: "sa-spring",
        service: "SA",
      });
    expect(pay2.status).toBe(200);
    expect(pay2.body.recorded).toBe(false);
    expect(pay2.body.reason).toBe("duplicate_prevented");

    const report = await request(app)
      .get("/api/marketing-hub/attribution")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`);
    expect(report.body.leads).toBeGreaterThanOrEqual(1);
    expect(report.body.paidCustomers).toBeGreaterThanOrEqual(1);
    expect(report.body.revenueGbp).toBeGreaterThanOrEqual(119);
  });

  it("emergency pause blocks scheduling", async () => {
    await request(app)
      .post("/api/marketing-hub/pause")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ paused: true })
      .expect(200);

    const run = await request(app)
      .post("/api/marketing-hub/engine/run-daily")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`);
    expect(run.body.generationStatus).toBe("paused");

    await request(app)
      .post("/api/marketing-hub/pause")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ paused: false })
      .expect(200);
  });
});
